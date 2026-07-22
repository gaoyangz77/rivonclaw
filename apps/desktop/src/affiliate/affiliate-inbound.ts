import { createLogger } from "@rivonclaw/logger";
import type { GatewayEventFrame } from "@rivonclaw/gateway";
import {
  GQL,
  type AffiliateNewMessageFrame,
  type AffiliateOrderAttributedFrame,
  type AffiliateSampleApplicationUpdatedFrame,
  type AffiliateTargetCollaborationUpdatedFrame,
  type EcommerceRelayFrame,
} from "@rivonclaw/core";
import {
  AffiliateSession,
  AffiliateTriggerKind,
  DEFAULT_AFFILIATE_RUN_PROFILE_ID,
  type AffiliateContext,
  type AffiliateShopContext,
} from "./affiliate-session.js";
import { normalizePlatform } from "../utils/platform.js";
import { localeToStaffLanguage, type StaffLanguage } from "../i18n/locale.js";
import type { AffiliateRelationshipSignalPayload } from "../cloud/backend-subscription-client.js";
import type { AffiliateWorkItemPayload } from "../cloud/backend-subscription-client.js";
import {
  AFFILIATE_WORK_ITEMS_QUERY,
  type AffiliateWorkItemsQueryResult,
} from "../cloud/affiliate-queries.js";
import { getAuthSession } from "../auth/session-ref.js";
import { rootStore } from "../app/store/desktop-store.js";
import { resolveSampleApplicationRecordId } from "./affiliate-agent-run-factory.js";

const log = createLogger("affiliate-inbound");
const MAX_ACTIVE_AFFILIATE_AGENT_RUNS = Math.max(
  1,
  Number.parseInt(process.env.RIVONCLAW_MAX_ACTIVE_AFFILIATE_AGENT_RUNS ?? "1", 10) || 1,
);
const MAX_QUEUED_AFFILIATE_WORK_ITEMS = parseOptionalPositiveInteger(
  process.env.RIVONCLAW_MAX_QUEUED_AFFILIATE_WORK_ITEMS,
);
const AFFILIATE_WORK_CATCH_UP_LIMIT = parseOptionalPositiveInteger(
  process.env.RIVONCLAW_AFFILIATE_WORK_CATCH_UP_LIMIT,
) ?? 20;
const AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS_ENV =
  "RIVONCLAW_AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS";

export interface AffiliateShopSource {
  id: string;
  userId?: string | null;
  platform?: string | null;
  platformShopId?: string | null;
  shopName?: string | null;
  runProfileId?: string | null;
  businessPrompt?: string | null;
  decisionThresholds?: GQL.AffiliateDecisionThresholds | null;
}

export class AffiliateInbound {
  constructor(private locale?: string) {}

  /** Affiliate shop context keyed by platformShopId from relay frames. */
  private shopContexts = new Map<string, AffiliateShopContext>();

  /** Long-lived affiliate sessions keyed by affiliate scope key. */
  private sessions = new Map<string, AffiliateSession>();

  /** Agent run id -> affiliate session key, used only for run lifecycle cleanup. */
  private runIndex = new Map<string, string>();

  /** Agent run id -> work item version, used to suppress duplicates only while a run is active. */
  private runWorkItemVersions = new Map<string, { versionKey: string; version: string }>();

  /** Work item versions currently owned by an active agent run. */
  private inFlightWorkItemVersions = new Set<string>();

  /** Work item handlers that have reserved capacity but have not returned a run id yet. */
  private pendingDispatchCount = 0;

  /** Work items waiting for local agent capacity. Keyed by semantic work item key. */
  private pendingWorkItems = new Map<string, AffiliateWorkItemPayload>();

  /** Prevents concurrent queue drains from reserving the same local capacity. */
  private workItemQueueDrainInProgress = false;

  /** Work item semantic key -> last dispatched backend state version. */
  private dispatchedWorkItemVersions = new Map<string, string>();

  /** Shop object ids with an in-flight catch-up query. */
  private catchUpInFlightShopIds = new Set<string>();

  updateLocale(locale: string | undefined): void {
    if (this.locale === locale) return;
    this.locale = locale;
    const staffLanguage = normalizeStaffLanguage(locale);
    for (const [platformShopId, ctx] of this.shopContexts) {
      this.shopContexts.set(platformShopId, {
        ...ctx,
        staffLanguage,
      });
    }
    for (const session of this.sessions.values()) {
      const shop = this.shopContexts.get(session.affiliateContext.platformShopId);
      if (shop) session.updateShopContext(shop);
    }
  }

  syncFromShops(shops: Iterable<AffiliateShopSource>): Set<string> {
    const activeShopIds = new Set<string>();

    for (const shop of shops) {
      const platformShopId = shop.platformShopId ?? "";
      if (!platformShopId) continue;

      activeShopIds.add(platformShopId);
      const ctx: AffiliateShopContext = {
        userId: shop.userId ?? "",
        objectId: shop.id,
        platformShopId,
        shopName: shop.shopName ?? platformShopId,
        platform: normalizePlatform(shop.platform ?? "TIKTOK_SHOP"),
        runProfileId: shop.runProfileId ?? DEFAULT_AFFILIATE_RUN_PROFILE_ID,
        businessPrompt: shop.businessPrompt ?? "",
        decisionThresholds: shop.decisionThresholds ?? null,
        staffLanguage: normalizeStaffLanguage(this.locale),
      };

      const existing = this.shopContexts.get(platformShopId);
      if (!existing || !this.shopContextEqual(existing, ctx)) {
        this.shopContexts.set(platformShopId, ctx);
        log.info(`Affiliate shop context set: platform=${platformShopId} object=${shop.id}`);
      }
    }

    for (const [platformShopId] of this.shopContexts) {
      if (!activeShopIds.has(platformShopId)) {
        log.info(`Affiliate shop ${platformShopId} no longer active in cache, removing context`);
        this.removeShopContext(platformShopId);
      }
    }

    return activeShopIds;
  }

  removeShopContext(platformShopId: string): void {
    this.shopContexts.delete(platformShopId);
  }

  hasShopContext(platformShopId: string): boolean {
    return this.shopContexts.has(platformShopId);
  }

  getShopContext(platformShopId: string): AffiliateShopContext | undefined {
    return this.shopContexts.get(platformShopId);
  }

  async catchUpCurrentWorkItems(): Promise<void> {
    const controlledRelationshipIds = getControlledLiveTestRelationshipIds();
    if (controlledRelationshipIds) {
      log.warn(
        `Skipping Affiliate startup catch-up because an exact live-test cohort is active: ` +
        `relationships=${controlledRelationshipIds.size}`,
      );
      return;
    }
    await Promise.all([...this.shopContexts.values()].map((shop) => this.catchUpShopWorkItems(shop)));
  }

  private async catchUpShopWorkItems(shop: AffiliateShopContext): Promise<void> {
    if (this.catchUpInFlightShopIds.has(shop.objectId)) return;
    const authSession = getAuthSession();
    if (!authSession) return;

    this.catchUpInFlightShopIds.add(shop.objectId);
    try {
      const agentWorkResult = await authSession.graphqlFetch<AffiliateWorkItemsQueryResult>(
        AFFILIATE_WORK_ITEMS_QUERY,
        {
          input: {
            shopId: shop.objectId,
            processingStatus: GQL.AffiliateRelationshipProcessingStatus.AgentRequired,
            agentDispatchRecommended: true,
            limit: AFFILIATE_WORK_CATCH_UP_LIMIT,
          },
        },
      );
      const workItems = uniqueWorkItems(agentWorkResult.affiliateWorkItems ?? []);
      if (workItems.length > 0) {
        log.info(
          `Affiliate work catch-up fetched ${workItems.length} item(s): ` +
          `shop=${shop.platformShopId} limit=${AFFILIATE_WORK_CATCH_UP_LIMIT}`,
        );
      }
      for (const workItem of workItems) {
        await this.handleWorkItem(workItem);
      }
    } catch (err) {
      log.error(`Failed to catch up affiliate work items for shop ${shop.platformShopId}:`, err);
    } finally {
      this.catchUpInFlightShopIds.delete(shop.objectId);
    }
  }

  handleGatewayEvent(evt: GatewayEventFrame): void {
    const payload = evt.payload as { runId?: string; state?: string } | undefined;
    if (!payload?.runId) return;
    if (payload.state !== "final" && payload.state !== "error") return;

    const sessionKey = this.runIndex.get(payload.runId);
    if (!sessionKey) return;

    this.sessions.get(sessionKey)?.onRunCompleted(payload.runId, { errored: payload.state === "error" });
    const workVersion = this.runWorkItemVersions.get(payload.runId);
    if (workVersion) {
      this.inFlightWorkItemVersions.delete(`${workVersion.versionKey}:${workVersion.version}`);
      if (
        payload.state === "error" &&
        this.dispatchedWorkItemVersions.get(workVersion.versionKey) === workVersion.version
      ) {
        this.dispatchedWorkItemVersions.delete(workVersion.versionKey);
      }
      this.runWorkItemVersions.delete(payload.runId);
    }
    this.runIndex.delete(payload.runId);
    this.drainWorkItemQueue();
  }

  handleAgentEvent(evt: GatewayEventFrame): boolean {
    const payload = evt.payload as {
      runId?: string;
      stream?: string;
      data?: Record<string, unknown>;
    } | undefined;
    if (!payload?.runId) return false;
    const sessionKey = this.runIndex.get(payload.runId);
    if (!sessionKey) return false;
    return this.sessions.get(sessionKey)?.handleAgentEvent(payload) ?? false;
  }

  async handleFrame(frame: EcommerceRelayFrame): Promise<boolean> {
    switch (frame.type) {
      case "affiliate_tiktok_new_message":
        await this.onNewMessage(frame as AffiliateNewMessageFrame);
        return true;
      case "affiliate_tiktok_sample_application_updated":
        await this.onSampleApplicationUpdated(frame as AffiliateSampleApplicationUpdatedFrame);
        return true;
      case "affiliate_tiktok_target_collaboration_updated":
        await this.onTargetCollaborationUpdated(frame as AffiliateTargetCollaborationUpdatedFrame);
        return true;
      case "affiliate_tiktok_order_attributed":
        await this.onOrderAttributed(frame as AffiliateOrderAttributedFrame);
        return true;
      default:
        return false;
    }
  }

  async handleSignal(signal: AffiliateRelationshipSignalPayload): Promise<boolean> {
    if (signal.workSignal === false) {
      log.info(`Ignoring non-work affiliate signal: type=${signal.type} shop=${signal.platformShopId}`);
      return true;
    }

    const shop = this.shopContexts.get(signal.platformShopId);
    if (!shop) {
      log.error(`No affiliate shop context for platform shopId ${signal.platformShopId}, dropping backend signal`);
      return false;
    }

    const creatorRelationshipId = signal.creatorRelationshipId?.trim();
    if (!creatorRelationshipId) {
      log.warn(
        `Affiliate signal missing creatorRelationshipId: type=${signal.type} shop=${signal.platformShopId}`,
      );
      return false;
    }
    return this.refreshRelationshipWorkItem(shop, creatorRelationshipId, signal.type);
  }

  private async refreshRelationshipWorkItem(
    shop: AffiliateShopContext,
    creatorRelationshipId: string,
    signalType: string,
  ): Promise<boolean> {
    const authSession = getAuthSession();
    if (!authSession) {
      log.warn(`No auth session available for affiliate relationship refresh ${creatorRelationshipId}`);
      return false;
    }
    try {
      const result = await authSession.graphqlFetch<AffiliateWorkItemsQueryResult>(
        AFFILIATE_WORK_ITEMS_QUERY,
        {
          input: {
            shopId: shop.objectId,
            creatorRelationshipId,
            limit: 10,
          },
        },
      );
      const workItems = result.affiliateWorkItems ?? [];
      if (workItems.length === 0) {
        log.info(
          `Affiliate signal produced no dispatchable relationship work: ` +
          `type=${signalType} relationship=${creatorRelationshipId}`,
        );
        return true;
      }
      for (const workItem of workItems) {
        await this.handleWorkItem(workItem);
      }
      return true;
    } catch (err) {
      log.error(
        `Failed to refresh affiliate relationship work after ${signalType} for ${creatorRelationshipId}:`,
        err,
      );
      return false;
    }
  }

  async handleWorkItem(workItem: AffiliateWorkItemPayload): Promise<boolean> {
    const controlledRelationshipIds = getControlledLiveTestRelationshipIds();
    if (
      controlledRelationshipIds &&
      !controlledRelationshipIds.has(workItem.creatorRelationshipId)
    ) {
      log.warn(
        `Ignoring Affiliate work item outside the exact live-test cohort: ` +
        `relationship=${workItem.creatorRelationshipId} kind=${workItem.workKind}`,
      );
      return true;
    }
    const shouldDispatchToLocalAgent = shouldDispatchWorkItemToLocalAgent(workItem);
    if (!shouldDispatchToLocalAgent) {
      log.info(`Ignoring affiliate work item that is not locally agent-actionable: id=${workItem.id} kind=${workItem.workKind}`);
      return true;
    }

    const versionKey = this.buildWorkItemVersionKey(workItem);
    const version = this.buildWorkItemVersion(workItem);
    if (version && this.dispatchedWorkItemVersions.get(versionKey) === version) {
      log.info(
        `Ignoring unchanged affiliate work item version: id=${workItem.id} kind=${workItem.workKind} version=${version}`,
      );
      return true;
    }
    if (version && this.inFlightWorkItemVersions.has(`${versionKey}:${version}`)) {
      log.info(
        `Ignoring in-flight affiliate work item version: id=${workItem.id} kind=${workItem.workKind} version=${version}`,
      );
      return true;
    }

    const activeOrPendingWork = this.runIndex.size + this.pendingDispatchCount;
    if (activeOrPendingWork >= MAX_ACTIVE_AFFILIATE_AGENT_RUNS) {
      this.enqueueWorkItem(workItem, versionKey, version);
      return true;
    }

    return await this.dispatchWorkItem(workItem, versionKey, version);
  }

  private async dispatchWorkItem(
    workItem: AffiliateWorkItemPayload,
    versionKey: string,
    version: string,
  ): Promise<boolean> {
    const shop = this.findRoutedShopContext(workItem);
    if (!shop) {
      log.error(
        `No affiliate shop context for work item routes ${(workItem.routingPlatformShopIds ?? []).join(",") || workItem.focusPlatformShopId}, dropping work item`,
      );
      return false;
    }

    const context = this.buildContextFromWorkItem(shop, workItem);
    if (context == null) {
      log.warn(`Affiliate work item missing stable trigger context: id=${workItem.id} kind=${workItem.workKind}`);
      return false;
    }

    const session = this.getOrCreateSession(shop, context);
    this.pendingDispatchCount += 1;
    try {
      const result = await session.handleWorkItem(workItem);
      if (result.runId) {
        this.runIndex.set(result.runId, session.scopeKey);
        if (version) {
          this.dispatchedWorkItemVersions.set(versionKey, version);
          this.runWorkItemVersions.set(result.runId, { versionKey, version });
          this.inFlightWorkItemVersions.add(`${versionKey}:${version}`);
        }
      }
      return true;
    } catch (err) {
      log.error(`Failed to handle affiliate work item ${workItem.id}:`, err);
      return false;
    } finally {
      this.pendingDispatchCount = Math.max(0, this.pendingDispatchCount - 1);
      this.drainWorkItemQueue();
    }
  }

  private enqueueWorkItem(workItem: AffiliateWorkItemPayload, versionKey: string, version: string): void {
    const queued = this.pendingWorkItems.get(versionKey);
    const queuedVersion = queued ? this.buildWorkItemVersion(queued) : "";
    if (queued && queuedVersion === version) {
      log.info(
        `Ignoring already queued affiliate work item version: id=${workItem.id} kind=${workItem.workKind} version=${version}`,
      );
      return;
    }

    if (queued) {
      this.pendingWorkItems.delete(versionKey);
    } else if (
      MAX_QUEUED_AFFILIATE_WORK_ITEMS != null &&
      this.pendingWorkItems.size >= MAX_QUEUED_AFFILIATE_WORK_ITEMS
    ) {
      const oldestKey = this.pendingWorkItems.keys().next().value as string | undefined;
      if (oldestKey) {
        const oldest = this.pendingWorkItems.get(oldestKey);
        this.pendingWorkItems.delete(oldestKey);
        log.warn(
          `Dropping oldest queued affiliate work item because queue is full: ` +
          `id=${oldest?.id ?? oldestKey} kind=${oldest?.workKind ?? "UNKNOWN"} limit=${MAX_QUEUED_AFFILIATE_WORK_ITEMS}`,
        );
      }
    }

    this.pendingWorkItems.set(versionKey, workItem);
    log.info(
      `Queued affiliate work item until local affiliate capacity is available: ` +
      `active=${this.runIndex.size} pending=${this.pendingDispatchCount} queued=${this.pendingWorkItems.size} ` +
      `limit=${MAX_ACTIVE_AFFILIATE_AGENT_RUNS} id=${workItem.id} kind=${workItem.workKind}`,
    );
  }

  private drainWorkItemQueue(): void {
    if (this.workItemQueueDrainInProgress) return;
    this.workItemQueueDrainInProgress = true;
    void this.drainWorkItemQueueLoop()
      .catch((err) => {
        log.error("Unexpected failure while draining queued affiliate work items:", err);
        return false;
      })
      .then((allowImmediateRedrain) => {
        this.workItemQueueDrainInProgress = false;
        if (
          allowImmediateRedrain &&
          this.pendingWorkItems.size > 0 &&
          this.runIndex.size + this.pendingDispatchCount < MAX_ACTIVE_AFFILIATE_AGENT_RUNS
        ) {
          this.drainWorkItemQueue();
        }
      });
  }

  private async drainWorkItemQueueLoop(): Promise<boolean> {
    while (
      this.pendingWorkItems.size > 0 &&
      this.runIndex.size + this.pendingDispatchCount < MAX_ACTIVE_AFFILIATE_AGENT_RUNS
    ) {
      const next = this.pendingWorkItems.entries().next().value as [string, AffiliateWorkItemPayload] | undefined;
      if (!next) return true;
      const [versionKey, workItem] = next;
      this.pendingWorkItems.delete(versionKey);

      this.pendingDispatchCount += 1;
      let authoritativeWorkItem: AffiliateWorkItemPayload | null;
      try {
        authoritativeWorkItem = await this.refreshQueuedWorkItem(workItem, versionKey);
      } catch (err) {
        this.pendingWorkItems.set(versionKey, workItem);
        log.error(`Failed to refresh queued affiliate work item ${workItem.id}; leaving it queued:`, err);
        return false;
      } finally {
        this.pendingDispatchCount = Math.max(0, this.pendingDispatchCount - 1);
      }
      if (!authoritativeWorkItem) continue;

      const authoritativeVersionKey = this.buildWorkItemVersionKey(authoritativeWorkItem);
      const version = this.buildWorkItemVersion(authoritativeWorkItem);
      if (version && this.dispatchedWorkItemVersions.get(authoritativeVersionKey) === version) {
        log.info(
          `Skipping queued affiliate work item because version already dispatched: ` +
          `id=${authoritativeWorkItem.id} kind=${authoritativeWorkItem.workKind} version=${version}`,
        );
        continue;
      }
      if (version && this.inFlightWorkItemVersions.has(`${authoritativeVersionKey}:${version}`)) {
        log.info(
          `Skipping queued affiliate work item because version is already in flight: ` +
          `id=${authoritativeWorkItem.id} kind=${authoritativeWorkItem.workKind} version=${version}`,
        );
        continue;
      }
      await this.dispatchWorkItem(authoritativeWorkItem, authoritativeVersionKey, version);
    }
    return true;
  }

  private async refreshQueuedWorkItem(
    queuedWorkItem: AffiliateWorkItemPayload,
    queuedVersionKey: string,
  ): Promise<AffiliateWorkItemPayload | null> {
    const authSession = getAuthSession();
    if (!authSession) {
      throw new Error("No auth session available for queued affiliate work refresh");
    }
    const shop = this.findRoutedShopContext(queuedWorkItem);
    if (!shop) {
      log.warn(
        `Dropping queued affiliate work item because no routed shop remains: ` +
        `id=${queuedWorkItem.id} kind=${queuedWorkItem.workKind}`,
      );
      return null;
    }
    const result = await authSession.graphqlFetch<AffiliateWorkItemsQueryResult>(
      AFFILIATE_WORK_ITEMS_QUERY,
      {
        input: {
          shopId: shop.objectId,
          creatorRelationshipId: queuedWorkItem.creatorRelationshipId,
          limit: 10,
        },
      },
    );
    const authoritativeWorkItem = (result.affiliateWorkItems ?? []).find(
      (candidate) => this.buildWorkItemVersionKey(candidate) === queuedVersionKey,
    );
    if (!authoritativeWorkItem || !shouldDispatchWorkItemToLocalAgent(authoritativeWorkItem)) {
      log.info(
        `Dropping queued affiliate work item that is no longer agent-actionable: ` +
        `id=${queuedWorkItem.id} kind=${queuedWorkItem.workKind}`,
      );
      return null;
    }
    return authoritativeWorkItem;
  }

  private buildWorkItemVersionKey(workItem: AffiliateWorkItemPayload): string {
    return `${workItem.id}:${workItem.workKind}`;
  }

  private buildWorkItemVersion(workItem: AffiliateWorkItemPayload): string {
    return workItem.versionAt ?? "";
  }

  private async onNewMessage(frame: AffiliateNewMessageFrame): Promise<void> {
    log.info(
      `Incoming raw affiliate platform message signal: ` +
      `shop=${frame.shopId} route=${frame.conversationId} msg=${frame.messageId} sender=${frame.senderRole}`,
    );

    const shop = this.shopContexts.get(frame.shopId);
    if (!shop) {
      log.error(`No affiliate shop context for platform shopId ${frame.shopId}, dropping message`);
      return;
    }

    log.warn(
      `Dropping raw affiliate platform message ${frame.messageId} because no creatorRelationshipId was provided; ` +
      "platform messages must be materialized by backend before agent dispatch",
    );
    return;

  }

  private async onSampleApplicationUpdated(frame: AffiliateSampleApplicationUpdatedFrame): Promise<void> {
    log.info(`Affiliate sample application event: shop=${frame.shopId} application=${frame.applicationId} status=${frame.status}`);

    const shop = this.shopContexts.get(frame.shopId);
    if (!shop) {
      log.error(`No affiliate shop context for platform shopId ${frame.shopId}, dropping sample event`);
      return;
    }
    log.warn(
      `Dropping raw affiliate sample event ${frame.applicationId}; ` +
      "sample events must be reconciled by backend and dispatched as AffiliateWorkItem before agent handling",
    );
  }

  private async onTargetCollaborationUpdated(frame: AffiliateTargetCollaborationUpdatedFrame): Promise<void> {
    log.info(`Affiliate target collaboration event: shop=${frame.shopId} collaboration=${frame.collaborationId} status=${frame.status}`);

    const shop = this.shopContexts.get(frame.shopId);
    if (!shop) {
      log.error(`No affiliate shop context for platform shopId ${frame.shopId}, dropping target collaboration event`);
      return;
    }
    log.warn(
      `Dropping raw affiliate target collaboration event ${frame.collaborationId}; ` +
      "target collaboration events must be reconciled by backend and dispatched as AffiliateWorkItem before agent handling",
    );
  }

  private async onOrderAttributed(frame: AffiliateOrderAttributedFrame): Promise<void> {
    log.info(`Affiliate order attribution event: shop=${frame.shopId} order=${frame.orderId}`);

    const shop = this.shopContexts.get(frame.shopId);
    if (!shop) {
      log.error(`No affiliate shop context for platform shopId ${frame.shopId}, dropping order attribution event`);
      return;
    }
    log.warn(
      `Dropping raw affiliate order attribution event ${frame.orderId}; ` +
      "order attribution events must be reconciled by backend and dispatched as AffiliateWorkItem before agent handling",
    );
  }

  private getOrCreateSession(shop: AffiliateShopContext, params: AffiliateContext): AffiliateSession {
    const platform = shop.platform ?? normalizePlatform("TIKTOK_SHOP");
    const sessionKey = AffiliateSession.buildScopeKey(platform, params);
    const existing = this.sessions.get(sessionKey);
    if (existing) {
      existing.updateShopContext(shop);
      return existing;
    }

    const session = new AffiliateSession(shop, params);
    this.sessions.set(session.scopeKey, session);
    return session;
  }

  private findRoutedShopContext(workItem: AffiliateWorkItemPayload): AffiliateShopContext | undefined {
    const platformShopIds = uniqueNonEmpty([
      ...(workItem.routingPlatformShopIds ?? []),
      workItem.focusPlatformShopId,
    ]);
    for (const platformShopId of platformShopIds) {
      const shop = this.shopContexts.get(platformShopId);
      if (shop) return shop;
    }
    return undefined;
  }

  private buildContextFromWorkItem(
    shop: AffiliateShopContext,
    workItem: AffiliateWorkItemPayload,
  ): AffiliateContext | null {
    const collaboration = workItem.collaboration;
    const relationship = workItem.creatorRelationship ?? workItem.context?.creatorRelation ?? null;
    const creatorRelationshipId = workItem.creatorRelationshipId ?? relationship?.id ?? undefined;
    if (!creatorRelationshipId) return null;
    const base: Omit<AffiliateContext, "triggerKind" | "triggerId"> = {
      userId: this.resolveWorkItemUserId(shop, workItem),
      shopId: shop.objectId,
      platformShopId: shop.platformShopId,
      creatorImUserId: collaboration?.creatorImId ?? undefined,
      creatorId: collaboration?.creatorId ?? relationship?.creatorId ?? undefined,
      creatorRelationshipId,
      productId: collaboration?.productId ?? undefined,
      collaborationRecordId: workItem.collaborationRecordId ?? undefined,
    };

    const requiredAction = workItem.requiredAction;
    switch (requiredAction) {
      case GQL.AffiliateRelationshipRequiredAction.ReplyToCreator:
        return {
          ...base,
          triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
          triggerId: base.creatorRelationshipId,
        };
      case GQL.AffiliateRelationshipRequiredAction.CompleteCollaborationTask: {
        const sampleTriggerId = resolveSampleApplicationRecordId(workItem);
        if (!sampleTriggerId) return null;
        return {
          ...base,
          triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
          triggerId: sampleTriggerId,
          sampleApplicationRecordId: sampleTriggerId,
        };
      }
      default:
        return this.buildContextFromWorkKindFallback(base, workItem);
    }
  }

  private resolveWorkItemUserId(
    shop: AffiliateShopContext,
    workItem: AffiliateWorkItemPayload,
  ): string {
    const workItemUserId = (workItem as { userId?: string | null }).userId?.trim();
    const relationshipUserId = workItem.creatorRelationship?.userId?.trim();
    return workItemUserId || relationshipUserId || shop.userId || rootStore.currentUser?.userId || "";
  }

  private buildContextFromWorkKindFallback(
    base: Omit<AffiliateContext, "triggerKind" | "triggerId">,
    workItem: AffiliateWorkItemPayload,
  ): AffiliateContext | null {
    const collaboration = workItem.collaboration;
    switch (workItem.workKind) {
      case GQL.AffiliateWorkKind.InboundMessageTriage:
        return {
          ...base,
          triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
          triggerId: base.creatorRelationshipId,
        };
      case GQL.AffiliateWorkKind.SampleApplicationDecision:
      case GQL.AffiliateWorkKind.SampleShipment: {
        const sampleTriggerId = resolveSampleApplicationRecordId(workItem);
        if (!sampleTriggerId) return null;
        return {
          ...base,
          triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
          triggerId: sampleTriggerId,
          sampleApplicationRecordId: sampleTriggerId,
        };
      }
      default:
        return {
          ...base,
          triggerKind: AffiliateTriggerKind.TARGET_COLLABORATION,
          triggerId: base.creatorRelationshipId,
        };
    }
  }

  private shopContextEqual(a: AffiliateShopContext, b: AffiliateShopContext): boolean {
    return (
      a.objectId === b.objectId &&
      a.userId === b.userId &&
      a.platformShopId === b.platformShopId &&
      a.platform === b.platform &&
      a.shopName === b.shopName &&
      a.runProfileId === b.runProfileId &&
      (a.businessPrompt ?? "") === (b.businessPrompt ?? "") &&
      (a.decisionThresholds?.minExpectedSalesUnits ?? null) === (b.decisionThresholds?.minExpectedSalesUnits ?? null) &&
      a.staffLanguage === b.staffLanguage
    );
  }
}

function getControlledLiveTestRelationshipIds(): Set<string> | null {
  const raw = process.env[AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS_ENV]?.trim();
  if (!raw) return null;
  const relationshipIds = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return relationshipIds.length > 0 ? new Set(relationshipIds) : null;
}

function parseOptionalPositiveInteger(value: string | undefined): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function shouldDispatchWorkItemToLocalAgent(workItem: AffiliateWorkItemPayload): boolean {
  return workItem.agentDispatchRecommended;
}

function uniqueWorkItems(workItems: AffiliateWorkItemPayload[]): AffiliateWorkItemPayload[] {
  const seen = new Set<string>();
  const result: AffiliateWorkItemPayload[] = [];
  for (const workItem of workItems) {
    const key = [
      workItem.creatorRelationshipId,
      workItem.workKind,
      workItem.versionAt ?? "",
    ].join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(workItem);
  }
  return result;
}

function normalizeStaffLanguage(locale: string | undefined): StaffLanguage {
  return localeToStaffLanguage(locale);
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
}
