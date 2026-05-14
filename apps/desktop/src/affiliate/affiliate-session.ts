import { createLogger } from "@rivonclaw/logger";
import {
  GQL,
  ScopeType,
  type AffiliateNewMessageFrame,
  type AffiliateOrderAttributedFrame,
  type AffiliateSampleApplicationUpdatedFrame,
  type AffiliateTargetCollaborationUpdatedFrame,
} from "@rivonclaw/core";
import type { AffiliateConversationSignalPayload } from "../cloud/backend-subscription-client.js";
import { openClawConnector } from "../openclaw/index.js";
import { rootStore } from "../app/store/desktop-store.js";
import { normalizePlatform } from "../utils/platform.js";
import { getAuthSession } from "../auth/session-ref.js";
import {
  AFFILIATE_CONVERSATION_MESSAGE_DELTA_QUERY,
  AFFILIATE_WORKSPACE_QUERY,
  RESOLVE_AFFILIATE_WORK_ITEM_MUTATION,
  type AffiliateConversationMessageDeltaQueryResult,
  type AffiliateWorkspaceQueryResult,
  type ResolveAffiliateWorkItemMutationResult,
} from "../cloud/affiliate-queries.js";
import { readLatestUserSessionAnchor } from "../utils/openclaw-session-anchor.js";
import { buildAffiliateAgentRunRequest } from "./affiliate-agent-run-factory.js";

const log = createLogger("affiliate-session");

export const DEFAULT_AFFILIATE_RUN_PROFILE_ID = "AFFILIATE_OPERATOR";
const DEBUG_AFFILIATE_PROMPT =
  process.env.DEBUG_AFFILIATE_PROMPT === "1" || process.env.RIVONCLAW_DEBUG_AFFILIATE_PROMPT === "1";

export interface AffiliateShopContext {
  /** MongoDB ObjectId used by backend affiliate tools. */
  objectId: string;
  /** Platform shop ID from TikTok webhook shop_id. */
  platformShopId: string;
  shopName: string;
  platform?: string;
  /** RunProfile ID for affiliate sessions. Defaults to AFFILIATE_OPERATOR. */
  runProfileId?: string;
  /** Per-shop affiliate business instructions configured by the merchant. */
  businessPrompt?: string | null;
}

export interface AffiliateContext {
  shopId: string;
  platformShopId: string;
  triggerKind: AffiliateTriggerKind;
  triggerId: string;
  conversationId?: string;
  creatorImUserId?: string;
  creatorId?: string | null;
  productId?: string | null;
  sampleApplicationId?: string;
  collaborationRecordId?: string;
  orderId?: string | null;
}

export interface AffiliateDispatchResult {
  runId?: string;
}

export enum AffiliateTriggerKind {
  CREATOR_MESSAGE = "CREATOR_MESSAGE",
  SAMPLE_APPLICATION = "SAMPLE_APPLICATION",
  TARGET_COLLABORATION = "TARGET_COLLABORATION",
  ORDER_ATTRIBUTION = "ORDER_ATTRIBUTION",
}

export class AffiliateSession {
  readonly platform: string;
  readonly scopeKey: string;

  private gatewaySetupReady = false;
  private activeRunId: string | null = null;
  private dispatchGeneration = 0;
  private pendingRunCompletions = new Map<string, GQL.AffiliateWorkItem>();

  constructor(
    private readonly shop: AffiliateShopContext,
    readonly affiliateContext: AffiliateContext,
  ) {
    this.platform = shop.platform ?? normalizePlatform("TIKTOK_SHOP");
    this.scopeKey = AffiliateSession.buildScopeKey(this.platform, affiliateContext);
  }

  static buildScopeKey(platform: string, context: AffiliateContext): string {
    if (context.triggerKind === AffiliateTriggerKind.CREATOR_MESSAGE && context.conversationId) {
      return `agent:main:affiliate:${platform}:${context.conversationId}`;
    }
    return `agent:main:affiliate:${platform}:${context.triggerKind.toLowerCase()}:${context.triggerId}`;
  }

  get extraSystemPrompt(): string {
    return [
      "## Affiliate / Creator Management Agent",
      "",
      "You are operating an affiliate creator-management workflow for a TikTok Shop seller.",
      "This is not a customer-service conversation. Do not assume your assistant text is sent to the creator.",
      "",
      "## Operating Model",
      "- Use backend affiliate tools as the source of truth for campaigns, creator lifecycle state, tags, approval policies, and action execution.",
      "- Every agent-dispatched affiliate work item must end with exactly one affiliate_resolve_work_item call. A final text response alone does not complete the work item.",
      "- If you need to message a creator, approve or reject a sample, create a target collaboration, block a creator, or update campaign setup, use affiliate_resolve_work_item with decision REQUEST_ACTION and a typed action payload.",
      "- If no platform action is needed, use affiliate_resolve_work_item with decision NO_ACTION_NEEDED, NEEDS_STAFF_REVIEW, or DEFERRED.",
      "- If affiliate_resolve_work_item returns a proposal requiring approval, stop there and make your final assistant response exactly NO_REPLY; do not try to bypass approval.",
      "- Background affiliate runs must not speak in webchat. Put staff-facing detail in operatorSummary, then make the final assistant response exactly NO_REPLY.",
      "- If the merchant explicitly approves or rejects a pending proposal in the current conversation, use affiliate_decide_proposal.",
      "- Do not rely on memory for creator history or policy. Ask tools for state when needed.",
      "- Never put a platform sample application ID into campaignId. For sample events, use platformApplicationId or sampleApplicationRecordId.",
      "",
      "## Workflow Discipline",
      "- Desktop resolves a small affiliate workspace snapshot before dispatch when possible. Use it as the initial fact set.",
      "- Call affiliate_get_workspace only when the injected workspace snapshot is missing, stale, or needs additional filters.",
      "- Treat creator messages as continuation work: understand the request, check relevant campaign/collaboration/sample state, then resolve the work item through affiliate_resolve_work_item.",
      "- Treat sample application events as triage work: inspect creator value, product/sample policy, stock/fulfillment facts exposed by tools, then resolve the work item through affiliate_resolve_work_item.",
      "- Treat collaboration events as lifecycle work: reconcile local state, decide whether follow-up is needed, and avoid duplicate outreach.",
      "- Treat attributed order events as evidence for relation health/ROI; do not message the creator unless there is a clear business reason.",
      "- Use operatorSummary for staff-facing summaries. Keep it short: current fact, recommended/attempted action, proposal id if approval is required.",
      "",
      "## Current Affiliate Context",
      `- Shop ID: ${this.affiliateContext.shopId}`,
      `- Platform Shop ID: ${this.affiliateContext.platformShopId}`,
      `- Shop Name: ${this.shop.shopName}`,
      `- Trigger Kind: ${this.affiliateContext.triggerKind}`,
      `- Trigger ID: ${this.affiliateContext.triggerId}`,
      ...(this.affiliateContext.conversationId ? [`- Conversation ID: ${this.affiliateContext.conversationId}`] : []),
      ...(this.affiliateContext.creatorImUserId ? [`- Creator IM User ID: ${this.affiliateContext.creatorImUserId}`] : []),
      ...(this.affiliateContext.creatorId ? [`- Creator ID: ${this.affiliateContext.creatorId}`] : []),
      ...(this.affiliateContext.productId ? [`- Product ID: ${this.affiliateContext.productId}`] : []),
      ...(this.affiliateContext.sampleApplicationId ? [`- Sample Application ID: ${this.affiliateContext.sampleApplicationId}`] : []),
      ...(this.affiliateContext.collaborationRecordId ? [`- Collaboration ID: ${this.affiliateContext.collaborationRecordId}`] : []),
      ...(this.affiliateContext.orderId ? [`- Order ID: ${this.affiliateContext.orderId}`] : []),
    ].join("\n");
  }

  async handleCreatorMessage(frame: AffiliateNewMessageFrame): Promise<AffiliateDispatchResult> {
    const generation = this.beginConversationTakeover();
    const message = await this.buildCreatorConversationWorkPackage({
      conversationId: frame.conversationId,
      currentMessageId: frame.messageId,
      messageType: frame.messageType,
      senderRole: frame.senderRole,
      creatorImUserId: frame.imUserId,
      fallbackContent: this.parseMessageContent(frame),
      eventTime: String(frame.createTime),
    });

    if (generation !== this.dispatchGeneration) return { runId: undefined };

    const result = await this.dispatch({
      message,
      idempotencyKey: `affiliate:${this.platform}:${frame.messageId}`,
      abortActive: false,
    });
    return result;
  }

  async handleConversationSignal(signal: AffiliateConversationSignalPayload): Promise<AffiliateDispatchResult> {
    if (isAffiliateMessageSignal(signal.type) && signal.conversationId && signal.messageId) {
      const generation = this.beginConversationTakeover();
      const workspaceSnapshot = await this.buildWorkspaceSnapshot({
        includePolicies: true,
        platformConversationId: signal.conversationId,
        limit: 20,
      });
      const message = await this.buildCreatorConversationWorkPackage({
        conversationId: signal.conversationId,
        currentMessageId: signal.messageId,
        messageType: signal.messageType ?? undefined,
        senderRole: signal.senderRole ?? undefined,
        creatorImUserId: signal.creatorImId ?? undefined,
        eventTime: String(signal.eventTime),
      });
      if (generation !== this.dispatchGeneration) return { runId: undefined };
      return this.dispatch({
        message: appendOptionalSection(message, workspaceSnapshot),
        idempotencyKey: buildSignalIdempotencyKey(this.platform, signal),
        abortActive: false,
      });
    }

    const workspaceSnapshot = await this.buildWorkspaceSnapshot({
      includePolicies: true,
      platformApplicationId: signal.platformApplicationId ?? undefined,
      limit: 20,
    });

    const message = [
      "[Affiliate Backend Signal]",
      `Signal Type: ${signal.type}`,
      `Source: ${signal.source}`,
      `Work Signal: ${signal.workSignal}`,
      `Shop ID: ${signal.shopId}`,
      `Platform Shop ID: ${signal.platformShopId}`,
      ...(signal.collaborationRecordId ? [`Collaboration ID: ${signal.collaborationRecordId}`] : []),
      ...(signal.processingStatus ? [`Processing Status: ${signal.processingStatus}`] : []),
      ...(signal.processReasons?.length ? [`Process Reasons: ${signal.processReasons.join(", ")}`] : []),
      ...(signal.conversationId ? [`Conversation ID: ${signal.conversationId}`] : []),
      ...(signal.messageId ? [`Message ID: ${signal.messageId}`] : []),
      ...(signal.messageType ? [`Message Type: ${signal.messageType}`] : []),
      ...(signal.messageDirection ? [`Message Direction: ${signal.messageDirection}`] : []),
      ...(signal.creatorImId ? [`Creator IM User ID: ${signal.creatorImId}`] : []),
      ...(signal.creatorOpenId ? [`Creator Open ID: ${signal.creatorOpenId}`] : []),
      ...(signal.platformApplicationId ? [`Sample Application ID: ${signal.platformApplicationId}`] : []),
      ...(signal.platformTargetCollaborationId ? [`Target Collaboration ID: ${signal.platformTargetCollaborationId}`] : []),
      ...(signal.platformStatus ? [`Platform Status: ${signal.platformStatus}`] : []),
      ...(signal.platformFulfillmentStatus ? [`Platform Fulfillment Status: ${signal.platformFulfillmentStatus}`] : []),
      ...(signal.platformFulfillmentId ? [`Platform Fulfillment ID: ${signal.platformFulfillmentId}`] : []),
      ...(signal.contentId ? [`Content ID: ${signal.contentId}`] : []),
      ...(signal.productId ? [`Product ID: ${signal.productId}`] : []),
      ...(signal.orderId ? [`Order ID: ${signal.orderId}`] : []),
      ...(signal.platformProgramId ? [`Platform Program ID: ${signal.platformProgramId}`] : []),
      ...(signal.notificationId ? [`Notification ID: ${signal.notificationId}`] : []),
      `Event Time: ${signal.eventTime}`,
      "",
      "Backend has already materialized or updated affiliate state for this signal.",
      "Use the injected workspace snapshot below as the current backend fact set.",
      "If the snapshot contains a matching sampleApplicationRecord in PENDING_REVIEW, resolve the work item through affiliate_resolve_work_item.",
      "If the snapshot contains a matching collaboration with CREATOR_MESSAGE_NEEDS_REPLY, use decision REQUEST_ACTION with action.type SEND_MESSAGE when a reply is needed.",
      "If approval policy requires review, affiliate_resolve_work_item returns an ActionProposal instead of executing.",
    ].join("\n");

    return this.dispatch({
      message: appendOptionalSection(message, workspaceSnapshot),
      idempotencyKey: buildSignalIdempotencyKey(this.platform, signal),
    });
  }

  async handleWorkItem(workItem: GQL.AffiliateWorkItem): Promise<AffiliateDispatchResult> {
    if (!workItem.agentDispatchRecommended) {
      log.info(`Affiliate work item ${workItem.id} does not recommend agent dispatch; skipping`);
      return { runId: undefined };
    }

    let conversationDelta: string | undefined;
    let generation: number | undefined;
    if (
      workItem.workKind === "CREATOR_REPLY_NEEDED" &&
      workItem.collaboration.platformConversationId &&
      workItem.collaboration.lastCreatorMessageId
    ) {
      generation = this.beginConversationTakeover();
      conversationDelta = await this.buildCreatorConversationWorkPackage({
        conversationId: workItem.collaboration.platformConversationId,
        currentMessageId: workItem.collaboration.lastCreatorMessageId,
        creatorImUserId: workItem.collaboration.creatorImId ?? undefined,
        eventTime: workItem.collaboration.lastCreatorMessageAt ?? undefined,
      });
      if (generation !== this.dispatchGeneration) return { runId: undefined };
    }

    const request = buildAffiliateAgentRunRequest({
      workItem,
      platform: this.platform,
      conversationDelta,
      businessPrompt: this.shop.businessPrompt,
    });
    if (!request) return { runId: undefined };

    const result = await this.dispatch(request);
    if (result.runId) {
      this.pendingRunCompletions.set(result.runId, workItem);
    }
    return result;
  }

  onRunCompleted(runId: string, options: { errored?: boolean } = {}): void {
    if (this.activeRunId === runId) {
      this.activeRunId = null;
    }
    const workItem = this.pendingRunCompletions.get(runId);
    if (workItem == null) return;
    this.pendingRunCompletions.delete(runId);
    if (options.errored) {
      log.warn(
        `Affiliate agent run ended with gateway error; leaving work item unacked for retry: ` +
        `runId=${runId} collaboration=${workItem.collaborationRecordId}`,
      );
      return;
    }
    void this.completeWorkItemIfUnresolved(runId, workItem);
  }

  private async setup(): Promise<void> {
    if (this.gatewaySetupReady) return;

    const runProfileId = this.shop.runProfileId ?? DEFAULT_AFFILIATE_RUN_PROFILE_ID;
    rootStore.toolCapability.setSessionRunProfile(this.scopeKey, runProfileId);

    await rootStore.llmManager.applyModelForSession(this.scopeKey, {
      type: ScopeType.AFFILIATE_SESSION,
      shopId: this.shop.objectId,
    });

    this.gatewaySetupReady = true;
  }

  private async dispatch(params: {
    message: string;
    idempotencyKey: string;
    abortActive?: boolean;
  }): Promise<AffiliateDispatchResult> {
    if (params.abortActive !== false) this.abortActiveRun();
    await this.setup();
    this.logDispatchPromptContext(params);
    const response = await openClawConnector.request<AffiliateDispatchResult>("agent", {
      sessionKey: this.scopeKey,
      message: params.message,
      extraSystemPrompt: this.extraSystemPrompt,
      promptMode: "raw",
      idempotencyKey: params.idempotencyKey,
    });

    if (response?.runId) {
      this.activeRunId = response.runId;
      log.info(`Affiliate agent run dispatched: runId=${response.runId} scope=${this.scopeKey}`);
    } else {
      this.activeRunId = null;
    }
    return { runId: response?.runId };
  }

  private logDispatchPromptContext(params: {
    message: string;
    idempotencyKey: string;
  }): void {
    log.info(
      [
        "Affiliate dispatch prompt context",
        `scope=${this.scopeKey}`,
        `idempotencyKey=${params.idempotencyKey}`,
        `triggerKind=${this.affiliateContext.triggerKind}`,
        `triggerId=${this.affiliateContext.triggerId}`,
        `shopId=${this.affiliateContext.shopId}`,
        `conversationId=${this.affiliateContext.conversationId ?? ""}`,
        `collaborationRecordId=${this.affiliateContext.collaborationRecordId ?? ""}`,
        `messageChars=${params.message.length}`,
        `systemPromptChars=${this.extraSystemPrompt.length}`,
        `debugFullPrompt=${DEBUG_AFFILIATE_PROMPT}`,
      ].join(" "),
    );

    if (!DEBUG_AFFILIATE_PROMPT) return;
    log.info([
      "[Affiliate Dispatch Full Prompt]",
      `scope=${this.scopeKey}`,
      `idempotencyKey=${params.idempotencyKey}`,
      "",
      "## extraSystemPrompt",
      this.extraSystemPrompt,
      "",
      "## userMessage",
      params.message,
      "[/Affiliate Dispatch Full Prompt]",
    ].join("\n"));
  }

  private abortActiveRun(): void {
    const previousRunId = this.activeRunId;
    if (!previousRunId) return;
    void openClawConnector.request("chat.abort", { sessionKey: this.scopeKey })
      .catch((err: unknown) => log.warn(`Failed to abort affiliate run ${previousRunId}: ${String(err)}`));
  }

  private async completeWorkItemIfUnresolved(runId: string, workItem: GQL.AffiliateWorkItem): Promise<void> {
    const authSession = getAuthSession();
    if (!authSession) {
      log.warn(`No auth session available, cannot complete affiliate work item for run ${runId}`);
      return;
    }

    try {
      const result = await authSession.graphqlFetch<ResolveAffiliateWorkItemMutationResult>(
        RESOLVE_AFFILIATE_WORK_ITEM_MUTATION,
        {
          input: {
            shopId: workItem.shopId,
            collaborationRecordId: workItem.collaborationRecordId,
            handledSignalAt: workItem.collaboration.lastSignalAt ?? null,
            decision: "FAILED_OR_INCOMPLETE",
            operatorSummary: `Agent run ${runId} completed without a structured affiliate_resolve_work_item decision.`,
          },
        },
      );
      const payload = result.resolveAffiliateWorkItem;
      log.info(
        `Affiliate work item completion callback: runId=${runId} ` +
        `collaboration=${workItem.collaborationRecordId} decision=${payload.decision} ` +
        `stale=${payload.stale} status=${payload.collaborationRecord?.processingStatus ?? ""}`,
      );
    } catch (err) {
      log.error(`Failed to complete unresolved affiliate work item for run ${runId}:`, err);
    }
  }

  private beginConversationTakeover(): number {
    this.dispatchGeneration += 1;
    this.abortActiveRun();
    return this.dispatchGeneration;
  }

  private async buildCreatorConversationWorkPackage(params: {
    conversationId: string;
    currentMessageId: string;
    messageType?: string;
    senderRole?: string;
    creatorImUserId?: string;
    fallbackContent?: string;
    eventTime?: string;
  }): Promise<string> {
    const delta = await this.fetchCreatorConversationDelta(params);
    if (!delta) {
      return [
        "[Affiliate Creator Conversation Update]",
        `Conversation ID: ${params.conversationId}`,
        `Current Message ID: ${params.currentMessageId}`,
        ...(params.senderRole ? [`Current Sender Role: ${params.senderRole}`] : []),
        ...(params.messageType ? [`Current Message Type: ${params.messageType}`] : []),
        ...(params.eventTime ? [`Event Time: ${params.eventTime}`] : []),
        "",
        "Conversation delta could not be fetched before dispatch. Use affiliate_get_workspace and, if needed, affiliate conversation message tools before taking action.",
        ...(params.fallbackContent ? ["", "[Webhook Fallback Content]", params.fallbackContent] : []),
      ].join("\n");
    }

    const timelineItems = delta.items ?? [];
    const timeline = timelineItems.map((message, index) => {
      const side = resolveAffiliateMessageSide(message, params.creatorImUserId);
      return [
        `${index + 1}. [${side}]`,
        `   messageId: ${message.messageId ?? ""}`,
        `   createTime: ${message.createTime ?? ""}`,
        `   type: ${message.type ?? ""}`,
        `   senderId: ${message.senderId ?? ""}`,
        `   text: ${affiliateMessageText(message)}`,
      ].join("\n");
    });
    const semanticHints = deriveAffiliateMessageSemanticHints(timelineItems, params.creatorImUserId);

    return [
      "[Affiliate Creator Conversation Work Package]",
      "",
      "This is the authoritative platform conversation delta for the current inbound trigger.",
      "It is bounded by the current inbound message ID; newer platform messages must be handled by later triggers.",
      "The timeline may overlap with earlier session context if the local anchor could not be matched exactly.",
      "",
      "## Delta Meta",
      `- Conversation ID: ${params.conversationId}`,
      `- Current Message ID: ${params.currentMessageId}`,
      `- Completeness: ${delta.meta.completeness}`,
      `- Anchor Match: ${delta.meta.anchorMatchType}`,
      `- Current Message Found: ${delta.meta.currentMessageFound}`,
      `- Anchor Matched: ${delta.meta.anchorMatched}`,
      `- Page Limit Reached: ${delta.meta.pageLimitReached}`,
      "",
      "## Ordered Platform Timeline",
      ...(timeline.length ? timeline : ["(No platform messages returned in this delta.)"]),
      "",
      ...(semanticHints.length ? ["## Derived Message Hints", ...semanticHints, ""] : []),
      "## Task",
      "Handle the latest creator-side message in the ordered platform timeline.",
      "If the delta is incomplete or includes seller-side/human messages that change the commitment context, be conservative and use affiliate_resolve_work_item with REQUEST_ACTION to draft a proposal, or NEEDS_STAFF_REVIEW when no safe action can be proposed.",
    ].join("\n");
  }

  private async fetchCreatorConversationDelta(params: {
    conversationId: string;
    currentMessageId: string;
  }): Promise<GQL.EcomAffiliateMessageDelta | null> {
    const authSession = getAuthSession();
    if (!authSession) {
      log.warn("No auth session available, cannot fetch affiliate conversation delta");
      return null;
    }

    try {
      const anchor = await readLatestUserSessionAnchor(this.scopeKey);
      const result = await authSession.graphqlFetch<AffiliateConversationMessageDeltaQueryResult>(
        AFFILIATE_CONVERSATION_MESSAGE_DELTA_QUERY,
        {
          shopId: this.affiliateContext.shopId,
          conversationId: params.conversationId,
          currentMessageId: params.currentMessageId,
          anchor: anchor ?? null,
          maxPages: 20,
        },
      );
      return result.affiliateConversationMessageDelta;
    } catch (err) {
      log.warn(`Failed to fetch affiliate conversation delta for ${params.conversationId}: ${String(err)}`);
      return null;
    }
  }

  private async fetchWorkspace(params: {
    includePolicies?: boolean;
    platformApplicationId?: string;
    platformConversationId?: string;
    limit?: number;
  }): Promise<GQL.AffiliateWorkspacePayload | null> {
    const authSession = getAuthSession();
    if (!authSession) {
      log.warn("No auth session available, cannot fetch affiliate workspace");
      return null;
    }

    try {
      const result = await authSession.graphqlFetch<AffiliateWorkspaceQueryResult>(
        AFFILIATE_WORKSPACE_QUERY,
        {
          input: {
            shopId: this.affiliateContext.shopId,
            includePolicies: params.includePolicies ?? true,
            platformApplicationId: params.platformApplicationId,
            platformConversationId: params.platformConversationId,
            limit: params.limit ?? 20,
          },
        },
      );
      return result.affiliateWorkspace;
    } catch (err) {
      log.warn(`Failed to fetch affiliate workspace for ${this.affiliateContext.shopId}: ${String(err)}`);
      return null;
    }
  }

  private async buildWorkspaceSnapshot(params: {
    includePolicies?: boolean;
    platformApplicationId?: string;
    platformConversationId?: string;
    limit?: number;
  }): Promise<string | undefined> {
    const workspace = await this.fetchWorkspace(params);
    if (!workspace) return undefined;
    return renderWorkspaceSnapshot(workspace);
  }

  async handleSampleApplicationUpdated(frame: AffiliateSampleApplicationUpdatedFrame): Promise<AffiliateDispatchResult> {
    const workspaceSnapshot = await this.buildWorkspaceSnapshot({
      includePolicies: true,
      platformApplicationId: frame.applicationId,
      limit: 20,
    });
    return this.dispatch({
      message: appendOptionalSection([
        "[Affiliate Sample Application Updated]",
        `Application ID: ${frame.applicationId}`,
        `Creator ID: ${frame.creatorId ?? ""}`,
        `Product ID: ${frame.productId ?? ""}`,
        `Status: ${frame.status}`,
        `Event Time: ${frame.eventTime}`,
        "",
        "Use the injected workspace snapshot as the current backend fact set.",
        ...(this.shop.businessPrompt?.trim()
          ? ["", "## Merchant Affiliate Instructions", this.shop.businessPrompt.trim(), ""]
          : []),
        "If the matching sampleApplicationRecord is PENDING_REVIEW, resolve the work item through affiliate_resolve_work_item.",
        "Use operatorSummary for staff-facing reasoning. Creator-facing text belongs only in action.messageIntent.text.",
        "Do not pass this platform application ID as campaignId.",
      ].join("\n"), workspaceSnapshot),
      idempotencyKey: `affiliate:${this.platform}:sample:${frame.applicationId}:${frame.status}:${frame.eventTime}`,
    });
  }

  async handleTargetCollaborationUpdated(frame: AffiliateTargetCollaborationUpdatedFrame): Promise<AffiliateDispatchResult> {
    return this.dispatch({
      message: [
        "[Affiliate Target Collaboration Updated]",
        `Collaboration ID: ${frame.collaborationId}`,
        `Creator ID: ${frame.creatorId ?? ""}`,
        `Product ID: ${frame.productId ?? ""}`,
        `Status: ${frame.status}`,
        `Event Time: ${frame.eventTime}`,
      ].join("\n"),
      idempotencyKey: `affiliate:${this.platform}:target-collab:${frame.collaborationId}:${frame.status}:${frame.eventTime}`,
    });
  }

  async handleOrderAttributed(frame: AffiliateOrderAttributedFrame): Promise<AffiliateDispatchResult> {
    return this.dispatch({
      message: [
        "[Affiliate Order Attributed]",
        `Order ID: ${frame.orderId}`,
        `Creator ID: ${frame.creatorId ?? ""}`,
        `Product ID: ${frame.productId ?? ""}`,
        `Event Time: ${frame.eventTime}`,
      ].join("\n"),
      idempotencyKey: `affiliate:${this.platform}:order-attributed:${frame.orderId}:${frame.eventTime}`,
    });
  }

  private parseMessageContent(frame: AffiliateNewMessageFrame): string {
    if (frame.messageType.toUpperCase() === "TEXT") {
      try {
        const parsed = JSON.parse(frame.content) as Record<string, unknown>;
        if (typeof parsed.content === "string") return parsed.content;
        if (typeof parsed.text === "string") return parsed.text;
      } catch {
        // Not JSON — use raw content.
      }
      return frame.content;
    }
    return `[${frame.messageType}] ${frame.content}`;
  }
}

function buildSignalIdempotencyKey(platform: string, signal: AffiliateConversationSignalPayload): string {
  const stableId = signal.messageId
    ?? signal.platformApplicationId
    ?? signal.platformTargetCollaborationId
    ?? signal.platformFulfillmentId
    ?? signal.collaborationRecordId
    ?? signal.orderId
    ?? signal.conversationId
    ?? signal.notificationId
    ?? "unknown";
  return `affiliate:${platform}:signal:${signal.type}:${stableId}:${signal.eventTime}`;
}

function isAffiliateMessageSignal(type: AffiliateConversationSignalPayload["type"]): boolean {
  return type === "CREATOR_MESSAGE_RECEIVED" || type === "AFFILIATE_CONVERSATION_MESSAGE_OBSERVED";
}

function appendOptionalSection(message: string, section?: string): string {
  return section ? `${message}\n\n${section}` : message;
}

function renderWorkspaceSnapshot(workspace: GQL.AffiliateWorkspacePayload): string {
  const samples = workspace.sampleApplicationRecords ?? [];
  const collaborations = workspace.collaborationRecords ?? [];
  const proposals = workspace.actionProposals ?? [];
  const policies = workspace.approvalPolicies ?? [];

  const sampleLines = samples.length
    ? samples.map((sample, index) => [
      `${index + 1}. sampleApplicationRecordId: ${sample.id}`,
      `   platformApplicationId: ${sample.platformApplicationId}`,
      `   creatorId: ${sample.creatorId ?? ""}`,
      `   productId: ${sample.productId ?? ""}`,
      `   status: ${sample.status}`,
      `   shipmentStatus: ${sample.shipmentStatus ?? ""}`,
      `   contentFulfillmentStatus: ${sample.contentFulfillmentStatus ?? ""}`,
      `   platformApplicationStatus: ${sample.platformApplicationStatus ?? ""}`,
      `   updatedAt: ${sample.updatedAt}`,
    ].join("\n"))
    : ["(none)"];

  const collaborationLines = collaborations.length
    ? collaborations.map((collaboration, index) => [
      `${index + 1}. collaborationRecordId: ${collaboration.id}`,
      `   creatorId: ${collaboration.creatorId}`,
      `   productId: ${collaboration.productId ?? ""}`,
      `   sampleApplicationRecordId: ${collaboration.sampleApplicationRecordId ?? ""}`,
      `   platformConversationId: ${collaboration.platformConversationId ?? ""}`,
      `   lifecycleStage: ${collaboration.lifecycleStage}`,
      `   processingStatus: ${collaboration.processingStatus}`,
      `   processReasons: ${(collaboration.processReasons ?? []).join(", ")}`,
      `   lastCreatorMessageId: ${collaboration.lastCreatorMessageId ?? ""}`,
      `   lastCreatorMessageAt: ${collaboration.lastCreatorMessageAt ?? ""}`,
      `   lastSignalAt: ${collaboration.lastSignalAt ?? ""}`,
      `   workHandledUntil: ${collaboration.workHandledUntil ?? ""}`,
      `   nextSellerActionAt: ${collaboration.nextSellerActionAt ?? ""}`,
    ].join("\n"))
    : ["(none)"];

  const proposalLines = proposals.length
    ? proposals.map((proposal, index) => [
      `${index + 1}. proposalId: ${proposal.id}`,
      `   type: ${proposal.type}`,
      `   status: ${proposal.status}`,
      `   operatorSummary: ${proposal.operatorSummary}`,
      `   collaborationRecordId: ${proposal.collaborationRecordId ?? ""}`,
      `   creatorId: ${proposal.creatorId ?? ""}`,
    ].join("\n"))
    : ["(none)"];

  const policyLines = policies.length
    ? policies.map((policy, index) =>
      `${index + 1}. ${policy.reason ?? policy.id} action=${policy.action} enabled=${policy.enabled}`,
    )
    : ["(none)"];

  return [
    "[Resolved Affiliate Workspace Snapshot]",
    "",
    "This snapshot was fetched by Desktop before dispatch. Prefer these IDs over guessing tool arguments.",
    "",
    "## Sample Application Records",
    ...sampleLines,
    "",
    "## Creator Collaborations",
    ...collaborationLines,
    "",
    "## Pending / Recent Action Proposals",
    ...proposalLines,
    "",
    "## Active Approval Policies",
    ...policyLines,
  ].join("\n");
}

function affiliateMessageText(message: GQL.EcomAffiliateMessage): string {
  const content = message.content ?? "";
  if (!content) return "";
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (typeof parsed.content === "string") return parsed.content;
    if (typeof parsed.text === "string") return parsed.text;
  } catch {
    // Raw non-JSON content is acceptable.
  }
  return content;
}

function resolveAffiliateMessageSide(
  message: GQL.EcomAffiliateMessage,
  creatorImUserId?: string,
): "CREATOR" | "SELLER_OR_SYSTEM" | "UNKNOWN" {
  if (!message.senderId) return "UNKNOWN";
  if (creatorImUserId && message.senderId === creatorImUserId) return "CREATOR";
  return "SELLER_OR_SYSTEM";
}

function deriveAffiliateMessageSemanticHints(
  messages: GQL.EcomAffiliateMessage[],
  creatorImUserId?: string,
): string[] {
  const latestCreatorMessage = [...messages]
    .reverse()
    .find((message) => resolveAffiliateMessageSide(message, creatorImUserId) === "CREATOR");
  if (!latestCreatorMessage) return [];

  const latestCreatorText = affiliateMessageText(latestCreatorMessage).trim();
  if (!looksLikeOpaqueAdCodeToken(latestCreatorText)) return [];

  const previousSellerAskedForAdCode = messages.some((message) => {
    if (message.messageId === latestCreatorMessage.messageId) return false;
    if (resolveAffiliateMessageSide(message, creatorImUserId) !== "SELLER_OR_SYSTEM") return false;
    return mentionsAdAuthorizationCode(affiliateMessageText(message));
  });

  if (!previousSellerAskedForAdCode) return [];

  return [
    "- The latest creator message is token-shaped and an earlier seller-side message asked for an ad code / ad authorization code.",
    "- Treat the latest creator message as a likely ad authorization code, not as unreadable text. Do not ask the creator to resend only because it is not natural language.",
    "- If there is no dedicated ad-code validation or ads handoff tool available, propose acknowledging receipt and routing it to the marketing/ads workflow.",
  ];
}

function mentionsAdAuthorizationCode(text: string): boolean {
  return /\b(ad\s*(code|authorization|auth)|authorization\s*code|auth\s*code|spark\s*ads?|video\s*code)\b/i.test(text)
    || /广告.*(授权|代码|码)/i.test(text)
    || /(授权|投流).*(代码|码)/i.test(text);
}

function looksLikeOpaqueAdCodeToken(text: string): boolean {
  const value = text.trim();
  if (value.length < 16 || value.length > 256) return false;
  if (/\s/.test(value)) return false;
  if (/^https?:\/\//i.test(value)) return false;
  if (/^#[A-Za-z0-9+/=_-]{12,}$/.test(value)) return true;
  return /^[A-Za-z0-9+/=_-]{24,}$/.test(value) && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
}
