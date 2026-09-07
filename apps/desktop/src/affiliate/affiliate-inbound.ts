import {
  AFFILIATE_MAX_CONCURRENT_ENV,
  DEFAULT_AFFILIATE_MAX_CONCURRENT,
} from "@rivonclaw/core/node";
import { createLogger } from "@rivonclaw/logger";
import type { GatewayEventFrame } from "@rivonclaw/gateway";
import {
  GQL,
} from "@rivonclaw/core";
import {
  AffiliateSession,
  AffiliateTriggerKind,
  DEBUG_AFFILIATE_PROMPT,
  DEFAULT_AFFILIATE_RUN_PROFILE_ID,
  type AffiliateContext,
  type AffiliateShopContext,
} from "./affiliate-session.js";
import { normalizePlatform } from "../utils/platform.js";
import { localeToStaffLanguage, type StaffLanguage } from "../i18n/locale.js";
import type { AffiliateWorkItemPayload } from "../cloud/backend-subscription-client.js";
import {
  AFFILIATE_WORK_ITEMS_QUERY,
  type AffiliateWorkItemsQueryResult,
} from "../cloud/affiliate-queries.js";
import { getAuthSession } from "../auth/session-ref.js";
import { rootStore } from "../app/store/desktop-store.js";
import { resolveSampleApplicationRecordId } from "./affiliate-agent-run-factory.js";

const AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS_ENV =
  "RIVONCLAW_AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS";
const log = createLogger("affiliate-inbound");
const MAX_ACTIVE_AFFILIATE_AGENT_RUNS = resolveMaxActiveAffiliateAgentRuns();
const MAX_QUEUED_AFFILIATE_WORK_ITEMS = parseOptionalPositiveInteger(
  process.env.RIVONCLAW_MAX_QUEUED_AFFILIATE_WORK_ITEMS,
);

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
  constructor(private locale?: string) {
    logAffiliateContainmentStartup();
  }

  /** Affiliate shop context keyed by platformShopId from relay frames. */
  private shopContexts = new Map<string, AffiliateShopContext>();

  /** Long-lived affiliate sessions keyed by affiliate scope key. */
  private sessions = new Map<string, AffiliateSession>();

  /** Agent run id -> affiliate session key, used only for run lifecycle cleanup. */
  private runIndex = new Map<string, string>();

  /**
   * A snapshot identifies a dispatch command, not the business facts it contains.
   * Keep accepted IDs for this process: evicting one could admit a delayed duplicate
   * while its proposal is pending (and its committed checkpoint is still unchanged).
   */
  private acceptedDispatchIds = new Set<string>();
  private runDispatches = new Map<string, { relationshipId: string; dispatchId: string }>();
  /** Reserved before preparation starts, and held until checkpoint finalization finishes. */
  private activeRelationships = new Set<string>();
  private finalizingRuns = new Set<string>();
  /** Terminal events can arrive before the agent RPC returns its run id. */
  private earlyTerminalStates = new Map<string, "final" | "error">();

  /** Work item handlers that have reserved capacity but have not returned a run id yet. */
  private pendingDispatchCount = 0;

  /** Coalesce notifications per Relationship; drain reads its current authoritative work. */
  private pendingWorkItems = new Map<string, AffiliateWorkItemPayload>();

  /** Prevents concurrent queue drains from reserving the same local capacity. */
  private workItemQueueDrainInProgress = false;

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

  handleGatewayEvent(evt: GatewayEventFrame): void {
    const payload = evt.payload as { runId?: string; state?: string } | undefined;
    if (!payload?.runId) return;
    if (payload.state !== "final" && payload.state !== "error") return;

    const sessionKey = this.runIndex.get(payload.runId);
    if (!sessionKey) {
      if (this.pendingDispatchCount > 0 && !this.earlyTerminalStates.has(payload.runId)) {
        this.earlyTerminalStates.set(payload.runId, payload.state);
      }
      return;
    }
    if (this.finalizingRuns.has(payload.runId)) return;
    this.finalizingRuns.add(payload.runId);
    // Do not block gateway event delivery while checkpoint RPCs are completing.
    void this.finalizeRun(payload.runId, sessionKey, payload.state === "error");
  }

  private async finalizeRun(runId: string, sessionKey: string, errored: boolean): Promise<void> {
    const dispatch = this.runDispatches.get(runId);
    try {
      await this.sessions.get(sessionKey)?.onRunCompleted(runId, { errored });
    } catch (err) {
      errored = true;
      log.error(`Failed to complete Affiliate run ${runId}:`, err);
    } finally {
      if (dispatch) {
        if (errored) this.acceptedDispatchIds.delete(dispatch.dispatchId);
        this.activeRelationships.delete(dispatch.relationshipId);
      }
      this.runDispatches.delete(runId);
      this.runIndex.delete(runId);
      this.finalizingRuns.delete(runId);
      this.drainWorkItemQueue();
    }
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

    const dispatchId = this.dispatchId(workItem);
    if (this.acceptedDispatchIds.has(dispatchId)) {
      log.info(`Ignoring duplicate Affiliate dispatch: id=${workItem.id} snapshot=${dispatchId}`);
      // A previous refresh may have failed. A later notification can retry the
      // retained queue, but never directly re-admits the duplicate command.
      if (this.pendingWorkItems.has(workItem.creatorRelationshipId)) this.drainWorkItemQueue();
      return true;
    }

    const activeOrPendingWork = this.runIndex.size + this.pendingDispatchCount;
    if (this.activeRelationships.has(workItem.creatorRelationshipId) ||
        activeOrPendingWork >= MAX_ACTIVE_AFFILIATE_AGENT_RUNS ||
        this.pendingWorkItems.has(workItem.creatorRelationshipId)) {
      this.enqueueWorkItem(workItem);
      this.drainWorkItemQueue();
      return true;
    }

    return await this.dispatchWorkItem(workItem);
  }

  private async dispatchWorkItem(
    workItem: AffiliateWorkItemPayload,
  ): Promise<boolean> {
    const shop = this.findRoutedShopContext(workItem);
    if (!shop) {
      log.error(
        `No affiliate shop context for work item routes ${(workItem.routingPlatformShopIds ?? []).join(",") || workItem.triggerPlatformShopId}, dropping work item`,
      );
      return false;
    }

    const context = this.buildContextFromWorkItem(shop, workItem);
    if (context == null) {
      log.warn(`Affiliate work item missing stable trigger context: id=${workItem.id} kind=${workItem.workKind}`);
      return false;
    }

    const session = this.getOrCreateSession(shop, context);
    const dispatchId = this.dispatchId(workItem);
    this.acceptedDispatchIds.add(dispatchId);
    this.activeRelationships.add(workItem.creatorRelationshipId);
    this.pendingDispatchCount += 1;
    let started = false;
    try {
      const result = await session.handleWorkItem(workItem);
      if (result.runId) {
        started = true;
        this.runIndex.set(result.runId, session.scopeKey);
        this.runDispatches.set(result.runId, {
          relationshipId: workItem.creatorRelationshipId,
          dispatchId,
        });
        const earlyState = this.earlyTerminalStates.get(result.runId);
        if (earlyState) {
          this.earlyTerminalStates.delete(result.runId);
          this.finalizingRuns.add(result.runId);
          void this.finalizeRun(result.runId, session.scopeKey, earlyState === "error");
        }
      }
      return true;
    } catch (err) {
      log.error(`Failed to handle affiliate work item ${workItem.id}:`, err);
      return false;
    } finally {
      if (!started) {
        this.acceptedDispatchIds.delete(dispatchId);
        this.activeRelationships.delete(workItem.creatorRelationshipId);
      }
      this.pendingDispatchCount = Math.max(0, this.pendingDispatchCount - 1);
      if (this.pendingDispatchCount === 0) this.earlyTerminalStates.clear();
      this.drainWorkItemQueue();
    }
  }

  private enqueueWorkItem(workItem: AffiliateWorkItemPayload): void {
    const relationshipId = workItem.creatorRelationshipId;
    const queued = this.pendingWorkItems.get(relationshipId);

    if (queued) {
      this.pendingWorkItems.delete(relationshipId);
    } else if (
      MAX_QUEUED_AFFILIATE_WORK_ITEMS != null &&
      this.pendingWorkItems.size >= MAX_QUEUED_AFFILIATE_WORK_ITEMS
    ) {
      const oldestKey = this.pendingWorkItems.keys().next().value as string | undefined;
      if (oldestKey) {
        const oldest = this.pendingWorkItems.get(oldestKey);
        this.pendingWorkItems.delete(oldestKey);
        if (oldest) this.acceptedDispatchIds.delete(this.dispatchId(oldest));
        log.warn(
          `Dropping oldest queued affiliate work item because queue is full: ` +
          `id=${oldest?.id ?? oldestKey} kind=${oldest?.workKind ?? "UNKNOWN"} limit=${MAX_QUEUED_AFFILIATE_WORK_ITEMS}`,
        );
      }
    }

    this.acceptedDispatchIds.add(this.dispatchId(workItem));
    this.pendingWorkItems.set(relationshipId, workItem);
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
          this.hasRunnableQueuedWork() &&
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
      const next = [...this.pendingWorkItems.entries()].find(
        ([relationshipId]) => !this.activeRelationships.has(relationshipId),
      );
      if (!next) return true;
      const [relationshipId, workItem] = next;
      this.pendingWorkItems.delete(relationshipId);
      this.activeRelationships.add(relationshipId);

      this.pendingDispatchCount += 1;
      let authoritativeWorkItem: AffiliateWorkItemPayload | null;
      try {
        authoritativeWorkItem = await this.refreshQueuedWorkItem(workItem);
      } catch (err) {
        if (!this.pendingWorkItems.has(relationshipId)) this.pendingWorkItems.set(relationshipId, workItem);
        this.activeRelationships.delete(relationshipId);
        log.error(`Failed to refresh queued affiliate work item ${workItem.id}; leaving it queued:`, err);
        return false;
      } finally {
        this.pendingDispatchCount = Math.max(0, this.pendingDispatchCount - 1);
      }
      if (!authoritativeWorkItem) {
        this.activeRelationships.delete(relationshipId);
        continue;
      }
      try {
        await this.dispatchWorkItem(authoritativeWorkItem);
      } finally {
        if (![...this.runDispatches.values()].some((run) => run.relationshipId === relationshipId)) {
          this.activeRelationships.delete(relationshipId);
        }
      }
    }
    return true;
  }

  private async refreshQueuedWorkItem(
    queuedWorkItem: AffiliateWorkItemPayload,
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
          agentDispatchRecommended: true,
          // This re-fetch is the authoritative dispatch read: the backend
          // mints a fresh immutable agenda snapshot per returned work item.
          dispatch: true,
          limit: 10,
        },
      },
    );
    const authoritativeWorkItem = (result.affiliateWorkItems ?? []).find(
      (candidate) => candidate.creatorRelationshipId === queuedWorkItem.creatorRelationshipId,
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

  private hasRunnableQueuedWork(): boolean {
    return [...this.pendingWorkItems.keys()].some((id) => !this.activeRelationships.has(id));
  }

  private dispatchId(workItem: AffiliateWorkItemPayload): string {
    const id = workItem.agendaItemsSnapshotId?.trim();
    if (!id) throw new Error(`Affiliate dispatch missing agendaItemsSnapshotId: ${workItem.id}`);
    return id;
  }

  private getOrCreateSession(shop: AffiliateShopContext, params: AffiliateContext): AffiliateSession {
    const platform = shop.platform ?? normalizePlatform("TIKTOK_SHOP");
    const sessionKey = AffiliateSession.buildScopeKey(platform, params);
    const existing = this.sessions.get(sessionKey);
    if (existing) {
      existing.updateShopContext(shop);
      existing.updateAffiliateContext(params);
      return existing;
    }

    const session = new AffiliateSession(shop, params);
    this.sessions.set(session.scopeKey, session);
    return session;
  }

  private findRoutedShopContext(workItem: AffiliateWorkItemPayload): AffiliateShopContext | undefined {
    const triggerPlatformShopId = workItem.triggerPlatformShopId?.trim();
    if (!triggerPlatformShopId) return undefined;
    const shop = this.shopContexts.get(triggerPlatformShopId);
    if (!shop || shop.objectId !== workItem.triggerShopId) return undefined;
    return shop;
  }

  private buildContextFromWorkItem(
    shop: AffiliateShopContext,
    workItem: AffiliateWorkItemPayload,
  ): AffiliateContext | null {
    const relationship = workItem.creatorRelationship ?? workItem.context?.creatorRelation ?? null;
    const creatorProfile = workItem.context?.creatorProfile ?? null;
    const creatorRelationshipId = workItem.creatorRelationshipId ?? relationship?.id ?? undefined;
    if (!creatorRelationshipId) return null;
    if (shop.objectId !== workItem.triggerShopId || shop.platformShopId !== workItem.triggerPlatformShopId) {
      return null;
    }
    const base: Omit<AffiliateContext, "triggerKind" | "triggerId"> = {
      userId: this.resolveWorkItemUserId(shop, workItem),
      routingShopId: workItem.triggerShopId,
      platformShopId: workItem.triggerPlatformShopId,
      creatorImUserId: creatorProfile?.creatorImId ?? undefined,
      creatorId: creatorProfile?.id ?? relationship?.creatorId ?? undefined,
      creatorOpenId: creatorProfile?.creatorOpenId ?? undefined,
      creatorRelationshipId,
      frozenAgendaProductShopPairsJson: JSON.stringify(
        collectFrozenAgendaProductShopPairs(workItem),
      ),
      affiliateCollaborationId: workItem.affiliateCollaborationId ?? undefined,
    };

    const requiredAction = workItem.requiredAction;
    switch (requiredAction) {
      case GQL.AffiliateRelationshipRequiredAction.HandleCreatorMessage:
        return {
          ...base,
          triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
          triggerId: base.creatorRelationshipId,
        };
      // A Provider-closed Sample Application. The sample decision is gone, but
      // the run is still anchored on that exact application so the Agent reads
      // the closed record rather than an unrelated one.
      case GQL.AffiliateRelationshipRequiredAction.HandleSampleTerminalState:
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
    switch (workItem.workKind) {
      case GQL.AffiliateWorkKind.InboundMessageTriage:
        return {
          ...base,
          triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
          triggerId: base.creatorRelationshipId,
        };
      case GQL.AffiliateWorkKind.SampleApplicationDecision:
      case GQL.AffiliateWorkKind.SamplePlatformTerminalFollowUp:
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

/**
 * Emits the Affiliate live-test containment proof as a single greppable line.
 *
 * The protocol requires proving, before any controlled dispatch, that this
 * Desktop process itself parsed and applied the containment filter. Reading the
 * launching shell's environment is not sufficient — it cannot show that the
 * value survived into the process (for example when Turbo's `dev.passThroughEnv`
 * drops it). Both the filter and the concurrency ceiling reported here are read
 * exactly as the dispatch path reads them, so the line cannot disagree with the
 * rule that is actually enforced.
 */
function logAffiliateContainmentStartup(): void {
  const controlledRelationshipIds = getControlledLiveTestRelationshipIds();
  if (!controlledRelationshipIds) {
    log.warn(
      [
        "Affiliate containment startup",
        "liveTestFilter=absent",
        "relationshipIdCount=0",
        `maxActiveAffiliateAgentRuns=${MAX_ACTIVE_AFFILIATE_AGENT_RUNS}`,
        `debugFullPrompt=${DEBUG_AFFILIATE_PROMPT}`,
        `-- UNFILTERED: ${AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS_ENV} is not set in this Desktop process,`,
        "so every Affiliate work item is dispatchable",
      ].join(" "),
    );
    return;
  }
  log.info(
    [
      "Affiliate containment startup",
      "liveTestFilter=active",
      `relationshipIdCount=${controlledRelationshipIds.size}`,
      `relationshipIds=${[...controlledRelationshipIds].sort().join(",")}`,
      `maxActiveAffiliateAgentRuns=${MAX_ACTIVE_AFFILIATE_AGENT_RUNS}`,
      `debugFullPrompt=${DEBUG_AFFILIATE_PROMPT}`,
    ].join(" "),
  );
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

/**
 * Concurrent affiliate work-item runs.
 *
 * Two tiers: an explicit override, then the shared product default, which is
 * also what the office layout draws desks from. Those two used to be
 * independent numbers, and a department with more concurrency than chairs
 * quietly scatters its workers into other rooms rather than failing.
 *
 * A live-test cohort deliberately does NOT shrink this pool. Containment is the
 * relationship filter's job: it decides *which* work may dispatch, and it
 * already refuses everything outside the cohort. Sizing the pool to the cohort
 * only decided how many of those allowed runs could proceed at once, which made
 * a controlled test serialize work that production would run in parallel — so
 * the test measured a concurrency the product never uses.
 */
export function resolveMaxActiveAffiliateAgentRuns(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const explicit = parseOptionalPositiveInteger(env[AFFILIATE_MAX_CONCURRENT_ENV]);
  if (explicit != null) return explicit;
  return DEFAULT_AFFILIATE_MAX_CONCURRENT;
}

function parseOptionalPositiveInteger(value: string | undefined): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function shouldDispatchWorkItemToLocalAgent(workItem: AffiliateWorkItemPayload): boolean {
  return workItem.agentDispatchRecommended;
}

function collectFrozenAgendaProductShopPairs(
  workItem: AffiliateWorkItemPayload,
): Array<{ productId: string; shopId: string }> {
  const pairs = new Map<string, { productId: string; shopId: string }>();
  for (const item of workItem.agentWorkingAgendaItems ?? []) {
    if (item.productId && item.shopId) {
      pairs.set(`${item.productId}:${item.shopId}`, {
        productId: item.productId,
        shopId: item.shopId,
      });
    }
    const turns = [
      ...(item.conversationWindow?.creatorTurns ?? []),
      ...(item.conversationWindow?.sellerAnchor
        ? [item.conversationWindow.sellerAnchor]
        : []),
    ];
    for (const part of turns.flatMap((turn) => turn.parts ?? [])) {
      if (!part.productId || !part.shopId) continue;
      pairs.set(`${part.productId}:${part.shopId}`, {
        productId: part.productId,
        shopId: part.shopId,
      });
    }
  }
  return [...pairs.values()];
}

function normalizeStaffLanguage(locale: string | undefined): StaffLanguage {
  return localeToStaffLanguage(locale);
}
