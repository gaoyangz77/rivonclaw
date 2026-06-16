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
import { requestAgent } from "../gateway/agent-tooling-readiness.js";
import { rootStore } from "../app/store/desktop-store.js";
import { normalizePlatform } from "../utils/platform.js";
import { getAuthSession } from "../auth/session-ref.js";
import {
  AFFILIATE_ACTION_PROPOSAL_DELTA_QUERY,
  AFFILIATE_CONVERSATION_MESSAGE_DELTA_QUERY,
  AFFILIATE_EXPECTED_SALES_PREDICTIONS_QUERY,
  AFFILIATE_WORK_ITEMS_QUERY,
  AFFILIATE_WORKSPACE_QUERY,
  RESOLVE_AFFILIATE_WORK_ITEM_MUTATION,
  type AffiliateActionProposalDeltaQueryResult,
  type AffiliateExpectedSalesPredictionsQueryResult,
  type AffiliateConversationMessageDeltaQueryResult,
  type AffiliateWorkItemsQueryResult,
  type AffiliateWorkspaceQueryResult,
  type ResolveAffiliateWorkItemMutationResult,
} from "../cloud/affiliate-queries.js";
import { readLatestUserSessionAnchor } from "../utils/openclaw-session-anchor.js";
import type { StaffLanguage } from "../i18n/locale.js";
import { buildAffiliateAgentRunRequest } from "./affiliate-agent-run-factory.js";

const log = createLogger("affiliate-session");

export const DEFAULT_AFFILIATE_RUN_PROFILE_ID = "AFFILIATE_OPERATOR";
const DEBUG_AFFILIATE_PROMPT =
  process.env.DEBUG_AFFILIATE_PROMPT === "1" || process.env.RIVONCLAW_DEBUG_AFFILIATE_PROMPT === "1";

const predictionMemo = new Map<string, Promise<AffiliatePredictionDispatchContext>>();

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
  /** Per-shop default affiliate decision thresholds configured by the merchant. */
  decisionThresholds?: GQL.AffiliateDecisionThresholds | null;
  /** Staff-facing language for operatorSummary and internal review text. */
  staffLanguage?: StaffLanguage;
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
      "- If you need to message a creator, review a sample application, or create a target collaboration on TikTok, use affiliate_resolve_work_item with decision REQUEST_ACTION and a typed platform action payload.",
      "- affiliate_resolve_work_item supports only three platform action types: SEND_MESSAGE, REVIEW_SAMPLE_APPLICATION, and CREATE_TARGET_COLLABORATION. Do not invent action types such as CHANGE_COMMISSION; use NEEDS_STAFF_REVIEW for unsupported seller operations.",
      "- Each REQUEST_ACTION action must populate exactly one intent matching its type: SEND_MESSAGE -> messageIntent, REVIEW_SAMPLE_APPLICATION -> sampleReviewIntent, CREATE_TARGET_COLLABORATION -> targetCollaborationIntent.",
      "- For SEND_MESSAGE, messageIntent.text is required and must contain the exact creator-facing message. Do not put the intended creator message only in operatorSummary.",
      "- For REVIEW_SAMPLE_APPLICATION, put sampleApplicationRecordId, platformApplicationId, decision, and rejectReason only inside sampleReviewIntent, never at the action top level.",
      "- Omit optional fields when unknown. Never send empty strings for Date, ID, or object fields. nextSellerActionAt is only for DEFERRED decisions and must be a valid ISO timestamp.",
      "- If no platform action is needed, use affiliate_resolve_work_item with decision NO_ACTION_NEEDED, NEEDS_STAFF_REVIEW, or DEFERRED.",
      "- If affiliate_resolve_work_item returns a proposal requiring approval, stop there and make your final assistant response exactly NO_REPLY; do not try to bypass approval.",
      "- Background affiliate runs must not speak in webchat. Put staff-facing detail in operatorSummary, then make the final assistant response exactly NO_REPLY.",
      `- Write every operatorSummary and staff-facing explanation in ${this.shop.staffLanguage ?? "English"}.`,
      "- If the merchant explicitly approves or rejects a pending proposal in the current conversation, use affiliate_decide_proposal.",
      "- Do not rely on memory for creator history or policy. Ask tools for state when needed.",
      "- Never put a platform sample application ID into campaignId. For sample events, use platformApplicationId or sampleApplicationRecordId.",
      "",
      "## Workflow Discipline",
      "- Desktop resolves a small affiliate workspace snapshot before dispatch when possible. Use it as the initial fact set.",
      "- Call affiliate_get_workspace when a decision depends on dynamic facts not present in the injected snapshot, such as creator follower count, creator relation/tags, sample status, product context, approval policies, campaign setup, or pending proposals.",
      "- If you need a variable fact to apply a merchant rule or make a decision, for example follower count, GMV, prior performance, sample cost, inventory, or fulfillment state, fetch the narrow current workspace with affiliate_get_workspace before deciding.",
      "- Treat creator messages as continuation work: understand the request, check relevant campaign/collaboration/sample state, then resolve the work item through affiliate_resolve_work_item.",
      "- Treat sample application events as triage work: inspect creator value, product/sample policy, stock/fulfillment facts exposed by tools, then resolve the work item through affiliate_resolve_work_item.",
      "- Treat collaboration events as lifecycle work: reconcile local state, decide whether follow-up is needed, and avoid duplicate outreach.",
      "- Treat attributed order events as evidence for relation health/ROI; do not message the creator unless there is a clear business reason.",
      "- Use operatorSummary for staff-facing summaries. Keep it short: current fact, recommended/attempted action, proposal id if approval is required.",
      `- operatorSummary language: ${this.shop.staffLanguage ?? "English"}. Creator-facing messages should use the creator's language instead.`,
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
      isCreatorReplyWorkItem(workItem) &&
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

    const predictionContext = await this.resolvePredictionDispatchContext(workItem);
    const thresholdContext = await this.resolveDecisionThresholdDispatchContext(workItem);
    if (isSampleReviewWorkItem(workItem)) {
      if (await this.resolveDeterministicSampleReviewIfAvailable(workItem, predictionContext, thresholdContext)) {
        return { runId: undefined };
      }
      await this.resolveSampleReviewNeedsStaffReview(workItem, predictionContext, thresholdContext);
      return { runId: undefined };
    }

    const request = buildAffiliateAgentRunRequest({
      workItem,
      platform: this.platform,
      conversationDelta,
      proposalDeltaSection: await this.buildProposalDeltaSection(workItem),
      ...predictionContext,
      ...thresholdContext,
      businessPrompt: this.shop.businessPrompt,
      staffLanguage: this.shop.staffLanguage,
    });
    if (!request) return { runId: undefined };

    const result = await this.dispatch(request);
    if (result.runId) {
      this.pendingRunCompletions.set(result.runId, workItem);
    }
    return result;
  }

  private async resolveDeterministicSampleReviewIfAvailable(
    workItem: GQL.AffiliateWorkItem,
    predictionContext: AffiliatePredictionDispatchContext,
    thresholdContext: AffiliateDecisionThresholdDispatchContext,
  ): Promise<boolean> {
    const defaultDecision = computeSampleReviewDefaultDecision(
      workItem,
      predictionContext,
      thresholdContext,
      this.shop.staffLanguage,
    );
    if (!defaultDecision) return false;

    const sample = workItem.sampleApplicationRecord;
    if (!sample?.id || !sample.platformApplicationId) return false;

    const authSession = getAuthSession();
    if (!authSession) {
      log.warn(`No auth session available, cannot resolve deterministic sample review for ${workItem.id}`);
      return false;
    }

    const action: Record<string, unknown> = {
      type: "REVIEW_SAMPLE_APPLICATION",
      predictionCacheIds: predictionContext.predictionCacheIds ?? [],
      sampleReviewIntent: {
        sampleApplicationRecordId: sample.id,
        platformApplicationId: sample.platformApplicationId,
        decision: defaultDecision.decision,
        ...(defaultDecision.decision === "REJECT" ? { rejectReason: "OTHER" } : {}),
      },
    };

    const result = await authSession.graphqlFetch<ResolveAffiliateWorkItemMutationResult>(
      RESOLVE_AFFILIATE_WORK_ITEM_MUTATION,
      {
        input: {
          shopId: workItem.shopId,
          collaborationRecordId: workItem.collaborationRecordId,
          handledSignalAt: workItem.collaboration.lastSignalAt ?? null,
          decision: "REQUEST_ACTION",
          operatorSummary: defaultDecision.operatorSummary,
          action,
        },
      },
    );
    const payload = result.resolveAffiliateWorkItem;
    log.info(
      `Deterministic affiliate sample review resolved: collaboration=${workItem.collaborationRecordId} ` +
      `decision=${defaultDecision.decision} mode=${payload.actionMode ?? ""} ` +
      `proposal=${payload.proposal?.id ?? ""} stale=${payload.stale} ` +
      `status=${payload.collaborationRecord?.processingStatus ?? ""}`,
    );
    return true;
  }

  private async resolveSampleReviewNeedsStaffReview(
    workItem: GQL.AffiliateWorkItem,
    predictionContext: AffiliatePredictionDispatchContext,
    thresholdContext: AffiliateDecisionThresholdDispatchContext,
  ): Promise<void> {
    const authSession = getAuthSession();
    if (!authSession) {
      log.warn(`No auth session available, cannot mark sample review for staff handling: ${workItem.id}`);
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
            decision: "NEEDS_STAFF_REVIEW",
            operatorSummary: renderSampleReviewNeedsStaffReviewSummary({
              workItem,
              predictionContext,
              thresholdContext,
              staffLanguage: this.shop.staffLanguage,
            }),
          },
        },
      );
      const payload = result.resolveAffiliateWorkItem;
      log.info(
        `Deterministic affiliate sample review deferred to staff: collaboration=${workItem.collaborationRecordId} ` +
        `stale=${payload.stale} status=${payload.collaborationRecord?.processingStatus ?? ""}`,
      );
    } catch (err) {
      log.error(`Failed to mark sample review work item for staff handling ${workItem.id}:`, err);
    }
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
    const response = await requestAgent<AffiliateDispatchResult>({
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
      if (await this.isWorkItemAlreadyHandled(workItem)) {
        log.info(
          `Affiliate work item already resolved by agent tool call; skipping fallback completion: ` +
          `runId=${runId} collaboration=${workItem.collaborationRecordId}`,
        );
        return;
      }

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

  private async isWorkItemAlreadyHandled(workItem: GQL.AffiliateWorkItem): Promise<boolean> {
    const boundary = parseOptionalDate(workItem.collaboration.lastSignalAt ?? workItem.versionAt);
    if (!boundary) return false;

    const authSession = getAuthSession();
    if (!authSession) return false;

    const result = await authSession.graphqlFetch<AffiliateWorkItemsQueryResult>(
      AFFILIATE_WORK_ITEMS_QUERY,
      {
        input: {
          shopId: this.affiliateContext.shopId,
          collaborationRecordId: workItem.collaborationRecordId,
          limit: 1,
        },
      },
    );
    const currentWorkItem = result.affiliateWorkItems[0];
    const handledUntil = parseOptionalDate(currentWorkItem?.collaboration?.workHandledUntil);
    return handledUntil != null && handledUntil.getTime() >= boundary.getTime();
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

  private async buildProposalDeltaSection(workItem: GQL.AffiliateWorkItem): Promise<string> {
    const authSession = getAuthSession();
    if (!authSession) {
      log.warn("No auth session available, cannot fetch affiliate proposal delta");
      return "## Proposal Events Since Last Work Boundary\n(unavailable: no auth session)";
    }

    try {
      const since = workItem.collaboration.workHandledUntil ?? null;
      if (since == null) {
        return [
          "## Proposal Events Since Last Work Boundary",
          "(none: this collaboration has no handled work boundary yet)",
        ].join("\n");
      }
      const result = await authSession.graphqlFetch<AffiliateActionProposalDeltaQueryResult>(
        AFFILIATE_ACTION_PROPOSAL_DELTA_QUERY,
        {
          input: {
            shopId: workItem.shopId,
            collaborationRecordId: workItem.collaborationRecordId,
            since,
            limit: 8,
          },
        },
      );
      return renderProposalDelta(result.affiliateActionProposalDelta ?? [], since);
    } catch (err) {
      log.warn(`Failed to fetch affiliate proposal delta for ${workItem.collaborationRecordId}: ${String(err)}`);
      return "## Proposal Events Since Last Work Boundary\n(unavailable: backend query failed)";
    }
  }

  private async fetchWorkspace(params: {
    includePolicies?: boolean;
    campaignId?: string;
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
            campaignId: params.campaignId,
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

  private async resolveDecisionThresholdDispatchContext(
    workItem: GQL.AffiliateWorkItem,
  ): Promise<AffiliateDecisionThresholdDispatchContext> {
    const shopThresholds = this.shop.decisionThresholds ?? null;
    const campaignId = workItem.context?.affiliateCollaboration?.campaignId ?? null;

    if (campaignId) {
      const workspace = await this.fetchWorkspace({
        includePolicies: false,
        campaignId,
        limit: 1,
      });
      const campaign = workspace?.campaigns?.find(item => item.id === campaignId);
      if (hasConfiguredDecisionThreshold(campaign?.decisionThresholds)) {
        return {
          decisionThresholds: campaign.decisionThresholds,
          decisionThresholdSource: `campaign:${campaign.name || campaign.id}`,
        };
      }
    }

    return {
      decisionThresholds: shopThresholds,
      decisionThresholdSource: hasConfiguredDecisionThreshold(shopThresholds) ? "shop default" : null,
    };
  }

  private async resolvePredictionDispatchContext(
    workItem: GQL.AffiliateWorkItem,
  ): Promise<AffiliatePredictionDispatchContext> {
    const scenario = selectExpectedSalesPredictionScenario(workItem);
    if (!scenario) {
      return { predictionSection: "## Affiliate Prediction\n(not applicable for this work item)" };
    }

    const existingSnapshot = workItem.collaboration.predictionSnapshots?.find(
      snapshot => snapshot.status === GQL.AffiliatePredictionStatus.Ok,
    );
    if (existingSnapshot) {
      const output = existingSnapshot.output ?? {};
      const sourceCacheId =
        typeof existingSnapshot.sourceCacheId === "string" &&
        existingSnapshot.sourceCacheId.length > 0
          ? existingSnapshot.sourceCacheId
          : null;
      return {
        predictionSection: renderExpectedSalesPredictionSnapshotSection(existingSnapshot.scenario, existingSnapshot),
        predictionCacheIds: sourceCacheId ? [sourceCacheId] : [],
        primaryPrediction: {
          status: existingSnapshot.status,
          expectedSalesUnits: numberFromUnknown(output.expectedSalesUnits),
          cacheId: sourceCacheId,
        },
      };
    }

    const memoKey = workItem.collaborationRecordId;
    const existing = predictionMemo.get(memoKey);
    if (existing) return existing;

    const promise = this.fetchAndRenderExpectedSalesPrediction(workItem, scenario)
      .then((context) => {
        if ((context.predictionCacheIds?.length ?? 0) === 0) {
          predictionMemo.delete(memoKey);
        }
        return context;
      })
      .catch((err: unknown) => {
        predictionMemo.delete(memoKey);
        log.warn(`Failed to resolve affiliate prediction for ${memoKey}: ${String(err)}`);
        return {
          predictionSection: [
            "## Affiliate Prediction",
            `- Scenario: ${scenario}`,
            "- Status: UNAVAILABLE",
            "- Cache IDs: (none)",
            "- Note: prediction could not be resolved before dispatch; continue with current backend work context.",
          ].join("\n"),
          predictionCacheIds: [],
        };
      });
    predictionMemo.set(memoKey, promise);
    return promise;
  }

  private async fetchAndRenderExpectedSalesPrediction(
    workItem: GQL.AffiliateWorkItem,
    scenario: GQL.AffiliateExpectedSalesPredictionScenario,
  ): Promise<AffiliatePredictionDispatchContext> {
    const authSession = getAuthSession();
    if (!authSession) {
      return {
        predictionSection: [
          "## Affiliate Prediction",
          `- Scenario: ${scenario}`,
          "- Status: UNAVAILABLE",
          "- Cache IDs: (none)",
          "- Note: no auth session was available before dispatch.",
        ].join("\n"),
        predictionCacheIds: [],
      };
    }

    const input = buildExpectedSalesPredictionInput(this.affiliateContext.shopId, scenario, workItem);
    const result = await authSession.graphqlFetch<AffiliateExpectedSalesPredictionsQueryResult>(
      AFFILIATE_EXPECTED_SALES_PREDICTIONS_QUERY,
      { input },
    );
    const payload = result.affiliateExpectedSalesPredictions;
    const predictions = payload.predictions ?? [];
    const cacheIds = predictions
      .map(prediction => prediction.cacheId)
      .filter((cacheId): cacheId is string => typeof cacheId === "string" && cacheId.length > 0);
    return {
      predictionSection: renderExpectedSalesPredictionPayloadSection(scenario, payload),
      predictionCacheIds: cacheIds,
      primaryPrediction: extractPrimaryPrediction(predictions),
    };
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
        `Use operatorSummary for staff-facing reasoning in ${this.shop.staffLanguage ?? "English"}. Creator-facing text belongs only in action.messageIntent.text.`,
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

interface AffiliatePredictionDispatchContext {
  predictionSection?: string;
  predictionCacheIds?: readonly string[];
  primaryPrediction?: AffiliatePrimaryPrediction | null;
}

interface AffiliateDecisionThresholdDispatchContext {
  decisionThresholds?: GQL.AffiliateDecisionThresholds | null;
  decisionThresholdSource?: string | null;
}

interface AffiliatePrimaryPrediction {
  status?: string | null;
  expectedSalesUnits?: number | null;
  cacheId?: string | null;
}

interface SampleReviewDefaultDecision {
  decision: GQL.AffiliateSampleReviewDecision;
  expectedSalesUnits: number;
  minExpectedSalesUnits: number;
  predictionStatus: string;
  operatorSummary: string;
}

function hasConfiguredDecisionThreshold(
  thresholds: GQL.AffiliateDecisionThresholds | null | undefined,
): thresholds is GQL.AffiliateDecisionThresholds {
  return typeof thresholds?.minExpectedSalesUnits === "number";
}

function selectExpectedSalesPredictionScenario(
  workItem: GQL.AffiliateWorkItem,
): GQL.AffiliateExpectedSalesPredictionScenario | null {
  if (isSampleReviewWorkItem(workItem)) return GQL.AffiliateExpectedSalesPredictionScenario.SampleReview;
  if (isCreatorReplyWorkItem(workItem) || isContentFollowUpWorkItem(workItem)) {
    return GQL.AffiliateExpectedSalesPredictionScenario.TargetCollaborationPlanning;
  }
  return null;
}

function buildExpectedSalesPredictionInput(
  shopId: string,
  scenario: GQL.AffiliateExpectedSalesPredictionScenario,
  workItem: GQL.AffiliateWorkItem,
): GQL.AffiliateExpectedSalesPredictionInput {
  const collaboration = workItem.collaboration;
  const sample = workItem.sampleApplicationRecord ?? workItem.context?.primarySampleApplication ?? null;
  const creatorProfile = workItem.context?.creatorProfile ?? null;
  const productId = collaboration.productId ?? sample?.productId ?? workItem.context?.productContext?.productId ?? null;
  const subject: GQL.AffiliateExpectedSalesPredictionSubjectInput = {
    creatorId: collaboration.creatorId ?? creatorProfile?.id ?? undefined,
    creatorOpenId: collaboration.creatorOpenId ?? creatorProfile?.creatorOpenId ?? undefined,
    productId: productId ?? undefined,
    affiliateCollaborationId: collaboration.affiliateCollaborationId ?? undefined,
    platformCollaborationId: collaboration.platformCollaborationId ?? undefined,
  };

  if (scenario === GQL.AffiliateExpectedSalesPredictionScenario.SampleReview) {
    subject.sampleApplicationRecordId = sample?.id ?? collaboration.sampleApplicationRecordId ?? undefined;
    subject.platformApplicationId = sample?.platformApplicationId ?? undefined;
  }

  return {
    shopId,
    scenario,
    context: {
      affiliateCollaborationId: collaboration.affiliateCollaborationId ?? undefined,
      platformCollaborationId: collaboration.platformCollaborationId ?? undefined,
      productId: productId ?? undefined,
    },
    subjects: [subject],
  };
}

function extractPrimaryPrediction(
  predictions: readonly GQL.AffiliateExpectedSalesSubjectPrediction[],
): AffiliatePrimaryPrediction | null {
  const prediction = predictions.find(item => isOkPredictionStatus(item.status)) ?? predictions[0];
  if (!prediction) return null;
  return {
    status: String(prediction.status),
    expectedSalesUnits: typeof prediction.expectedSalesUnits === "number" && Number.isFinite(prediction.expectedSalesUnits)
      ? prediction.expectedSalesUnits
      : null,
    cacheId: prediction.cacheId ?? null,
  };
}

function computeSampleReviewDefaultDecision(
  workItem: GQL.AffiliateWorkItem,
  predictionContext: AffiliatePredictionDispatchContext,
  thresholdContext: AffiliateDecisionThresholdDispatchContext,
  staffLanguage?: StaffLanguage,
): SampleReviewDefaultDecision | null {
  if (!isSampleReviewWorkItem(workItem)) return null;

  const minExpectedSalesUnits = thresholdContext.decisionThresholds?.minExpectedSalesUnits;
  const prediction = predictionContext.primaryPrediction;
  const expectedSalesUnits = prediction?.expectedSalesUnits;
  const predictionStatus = prediction?.status ?? "";
  if (
    typeof minExpectedSalesUnits !== "number"
    || !isOkPredictionStatus(predictionStatus)
    || typeof expectedSalesUnits !== "number"
    || !Number.isFinite(expectedSalesUnits)
  ) {
    return null;
  }

  const decision = expectedSalesUnits < minExpectedSalesUnits
    ? GQL.AffiliateSampleReviewDecision.Reject
    : GQL.AffiliateSampleReviewDecision.Approve;

  return {
    decision,
    expectedSalesUnits,
    minExpectedSalesUnits,
    predictionStatus,
    operatorSummary: renderSampleReviewDefaultOperatorSummary({
      decision,
      expectedSalesUnits,
      minExpectedSalesUnits,
      staffLanguage,
    }),
  };
}

function isCreatorReplyWorkItem(workItem: GQL.AffiliateWorkItem): boolean {
  return (
    workItem.requiredAction === GQL.AffiliateCollaborationRequiredAction.RespondToCreator ||
    workItem.workKind === GQL.AffiliateWorkKind.CreatorReplyNeeded
  );
}

function isSampleReviewWorkItem(workItem: GQL.AffiliateWorkItem): boolean {
  return (
    workItem.requiredAction === GQL.AffiliateCollaborationRequiredAction.ReviewSampleApplication ||
    workItem.workKind === GQL.AffiliateWorkKind.SampleReviewNeeded
  );
}

function isContentFollowUpWorkItem(workItem: GQL.AffiliateWorkItem): boolean {
  return (
    workItem.requiredAction === GQL.AffiliateCollaborationRequiredAction.FollowUpContent ||
    workItem.workKind === GQL.AffiliateWorkKind.ContentFollowUpDue
  );
}

function renderSampleReviewDefaultOperatorSummary(params: {
  decision: GQL.AffiliateSampleReviewDecision;
  expectedSalesUnits: number;
  minExpectedSalesUnits: number;
  staffLanguage?: StaffLanguage;
}): string {
  const expectedSales = formatMaybeNumber(params.expectedSalesUnits);
  const threshold = formatMaybeNumber(params.minExpectedSalesUnits);
  const isReject = params.decision === GQL.AffiliateSampleReviewDecision.Reject;
  switch (params.staffLanguage) {
    case "Chinese":
      return isReject
        ? `预估销量模型认为这个达人带这款商品大约能卖 ${expectedSales} 件，低于店铺最低要求 ${threshold} 件，建议拒绝这次样品申请。`
        : `预估销量模型认为这个达人带这款商品大约能卖 ${expectedSales} 件，达到店铺最低要求 ${threshold} 件，建议通过这次样品申请。`;
    case "German":
      return isReject
        ? `Das Verkaufsmodell schätzt für diesen Creator und dieses Produkt etwa ${expectedSales} Verkäufe, weniger als das Shop-Minimum von ${threshold}. Daher wird empfohlen, diese Musteranfrage abzulehnen.`
        : `Das Verkaufsmodell schätzt für diesen Creator und dieses Produkt etwa ${expectedSales} Verkäufe und erreicht damit das Shop-Minimum von ${threshold}. Daher wird empfohlen, diese Musteranfrage zu genehmigen.`;
    case "Spanish":
      return isReject
        ? `El modelo estima que este creador vendería aproximadamente ${expectedSales} unidades de este producto, por debajo del mínimo de la tienda de ${threshold}; se recomienda rechazar esta solicitud de muestra.`
        : `El modelo estima que este creador vendería aproximadamente ${expectedSales} unidades de este producto, alcanzando el mínimo de la tienda de ${threshold}; se recomienda aprobar esta solicitud de muestra.`;
    case "French":
      return isReject
        ? `Le modèle estime que ce créateur vendrait environ ${expectedSales} unités de ce produit, sous le minimum boutique de ${threshold}; il est recommandé de refuser cette demande d'échantillon.`
        : `Le modèle estime que ce créateur vendrait environ ${expectedSales} unités de ce produit, ce qui atteint le minimum boutique de ${threshold}; il est recommandé d'approuver cette demande d'échantillon.`;
    case "Indonesian":
      return isReject
        ? `Model memperkirakan kreator ini akan menjual sekitar ${expectedSales} unit untuk produk ini, di bawah minimum toko ${threshold}, jadi permintaan sampel ini disarankan untuk ditolak.`
        : `Model memperkirakan kreator ini akan menjual sekitar ${expectedSales} unit untuk produk ini, memenuhi minimum toko ${threshold}, jadi permintaan sampel ini disarankan untuk disetujui.`;
    case "Italian":
      return isReject
        ? `Il modello stima che questo creator venderà circa ${expectedSales} unità di questo prodotto, sotto il minimo del negozio di ${threshold}; si consiglia di rifiutare questa richiesta di campione.`
        : `Il modello stima che questo creator venderà circa ${expectedSales} unità di questo prodotto, raggiungendo il minimo del negozio di ${threshold}; si consiglia di approvare questa richiesta di campione.`;
    case "Thai":
      return isReject
        ? `โมเดลคาดว่าครีเอเตอร์รายนี้จะขายสินค้านี้ได้ประมาณ ${expectedSales} ชิ้น ต่ำกว่าเกณฑ์ขั้นต่ำของร้านที่ ${threshold} ชิ้น จึงแนะนำให้ปฏิเสธคำขอตัวอย่างนี้`
        : `โมเดลคาดว่าครีเอเตอร์รายนี้จะขายสินค้านี้ได้ประมาณ ${expectedSales} ชิ้น ถึงเกณฑ์ขั้นต่ำของร้านที่ ${threshold} ชิ้น จึงแนะนำให้อนุมัติคำขอตัวอย่างนี้`;
    default:
      break;
  }
  return isReject
    ? `The expected-sales model estimates about ${expectedSales} units for this creator and product, below the shop minimum of ${threshold}, so rejecting this sample request is recommended.`
    : `The expected-sales model estimates about ${expectedSales} units for this creator and product, meeting the shop minimum of ${threshold}, so approving this sample request is recommended.`;
}

function renderSampleReviewNeedsStaffReviewSummary(params: {
  workItem: GQL.AffiliateWorkItem;
  predictionContext: AffiliatePredictionDispatchContext;
  thresholdContext: AffiliateDecisionThresholdDispatchContext;
  staffLanguage?: StaffLanguage;
}): string {
  const reasons: SampleReviewStaffReason[] = [];
  const sample = params.workItem.sampleApplicationRecord;
  const prediction = params.predictionContext.primaryPrediction;
  if (!sample?.id || !sample.platformApplicationId) reasons.push("MISSING_SAMPLE_IDENTIFIERS");
  if (!hasConfiguredDecisionThreshold(params.thresholdContext.decisionThresholds)) reasons.push("MISSING_DECISION_THRESHOLD");
  if (!prediction || !isOkPredictionStatus(prediction.status ?? "") || typeof prediction.expectedSalesUnits !== "number") {
    reasons.push("MISSING_USABLE_PREDICTION");
  }
  if (reasons.length === 0) reasons.push("NO_SAFE_AUTOMATIC_DECISION");

  const reasonText = reasons.map(reason => renderSampleReviewStaffReason(reason, params.staffLanguage)).join("; ");
  switch (params.staffLanguage) {
    case "Chinese":
      return `样品申请没有自动生成通过/拒绝建议：${reasonText}。请人工查看后处理。`;
    case "German":
      return `Für diese Musteranfrage wurde keine automatische Genehmigungs-/Ablehnungsentscheidung erstellt: ${reasonText}. Bitte manuell prüfen.`;
    case "Spanish":
      return `No se generó una decisión automática de aprobar/rechazar para esta solicitud de muestra: ${reasonText}. Revísala manualmente.`;
    case "French":
      return `Aucune décision automatique d'approbation/refus n'a été générée pour cette demande d'échantillon : ${reasonText}. Veuillez la vérifier manuellement.`;
    case "Indonesian":
      return `Keputusan otomatis untuk menyetujui/menolak permintaan sampel ini tidak dibuat: ${reasonText}. Harap tinjau secara manual.`;
    case "Italian":
      return `Non è stata generata una decisione automatica di approvazione/rifiuto per questa richiesta di campione: ${reasonText}. Controllala manualmente.`;
    case "Thai":
      return `ไม่ได้สร้างคำแนะนำอัตโนมัติให้อนุมัติ/ปฏิเสธคำขอตัวอย่างนี้: ${reasonText} โปรดตรวจสอบด้วยตนเอง`;
    default:
      return `No automatic approve/reject decision was created for this sample request: ${reasonText}. Please review it manually.`;
  }
}

type SampleReviewStaffReason =
  | "MISSING_SAMPLE_IDENTIFIERS"
  | "MISSING_DECISION_THRESHOLD"
  | "MISSING_USABLE_PREDICTION"
  | "NO_SAFE_AUTOMATIC_DECISION";

function renderSampleReviewStaffReason(reason: SampleReviewStaffReason, staffLanguage?: StaffLanguage): string {
  const labels: Record<SampleReviewStaffReason, Record<StaffLanguage | "default", string>> = {
    MISSING_SAMPLE_IDENTIFIERS: {
      Chinese: "缺少样品申请标识",
      German: "Musteranfrage-IDs fehlen",
      Spanish: "faltan identificadores de la solicitud de muestra",
      French: "identifiants de demande d'échantillon manquants",
      Indonesian: "identitas permintaan sampel tidak lengkap",
      Italian: "mancano gli identificativi della richiesta di campione",
      Thai: "ไม่มีรหัสคำขอตัวอย่างครบถ้วน",
      English: "missing sample application identifiers",
      default: "missing sample application identifiers",
    },
    MISSING_DECISION_THRESHOLD: {
      Chinese: "店铺没有配置决策阈值",
      German: "kein Shop-Entscheidungsschwellenwert konfiguriert",
      Spanish: "no hay un umbral de decisión configurado para la tienda",
      French: "aucun seuil de décision boutique n'est configuré",
      Indonesian: "ambang keputusan toko belum dikonfigurasi",
      Italian: "nessuna soglia decisionale del negozio configurata",
      Thai: "ยังไม่ได้ตั้งค่าเกณฑ์ตัดสินใจของร้าน",
      English: "no shop decision threshold is configured",
      default: "no shop decision threshold is configured",
    },
    MISSING_USABLE_PREDICTION: {
      Chinese: "没有可用的预估销量结果",
      German: "keine nutzbare Verkaufsprognose verfügbar",
      Spanish: "no hay una predicción de ventas utilizable",
      French: "aucune prédiction de ventes utilisable n'est disponible",
      Indonesian: "prediksi penjualan yang dapat digunakan tidak tersedia",
      Italian: "nessuna previsione di vendita utilizzabile disponibile",
      Thai: "ไม่มีผลคาดการณ์ยอดขายที่ใช้ได้",
      English: "no usable expected-sales prediction is available",
      default: "no usable expected-sales prediction is available",
    },
    NO_SAFE_AUTOMATIC_DECISION: {
      Chinese: "系统无法形成安全的自动判断",
      German: "keine sichere automatische Entscheidung möglich",
      Spanish: "no se pudo formar una decisión automática segura",
      French: "aucune décision automatique sûre n'a pu être formée",
      Indonesian: "sistem tidak dapat membuat keputusan otomatis yang aman",
      Italian: "non è stato possibile formare una decisione automatica sicura",
      Thai: "ระบบไม่สามารถตัดสินใจอัตโนมัติได้อย่างปลอดภัย",
      English: "deterministic sample review could not form a safe decision",
      default: "deterministic sample review could not form a safe decision",
    },
  };
  return labels[reason][staffLanguage ?? "default"] ?? labels[reason].default;
}

function isOkPredictionStatus(status: unknown): boolean {
  return String(status ?? "").toUpperCase() === "OK";
}

function renderExpectedSalesPredictionSnapshotSection(
  scenario: GQL.AffiliateExpectedSalesPredictionScenario,
  snapshot: GQL.AffiliateCollaborationRecordPredictionSnapshot,
): string {
  const output = snapshot.output ?? {};
  const expectedSalesUnits = numberFromUnknown(output.expectedSalesUnits);
  return [
    "## Affiliate Prediction",
    `- Scenario: ${scenario}`,
    "- Status: ALREADY_CAPTURED_ON_COLLABORATION",
    `- Captured At: ${snapshot.capturedAt ?? ""}`,
    `- Predicted Expected Sales Units: ${formatMaybeNumber(expectedSalesUnits)}`,
    `- Merchant Meaning: ${renderPredictionPlainMeaning(expectedSalesUnits)}`,
    "- Caveat: expectedSalesUnits is a calibrated expected-value forecast, not a guaranteed result.",
    "- Cache IDs: (none needed; this collaboration already has a persisted prediction snapshot)",
  ].join("\n");
}

function renderExpectedSalesPredictionPayloadSection(
  scenario: GQL.AffiliateExpectedSalesPredictionScenario,
  payload: GQL.AffiliateExpectedSalesPredictionPayload,
): string {
  const predictions = payload.predictions ?? [];
  const lines = predictions.length
    ? predictions.map((prediction, index) => renderExpectedSalesPredictionLine(index, prediction))
    : ["(none)"];
  const cacheIds = predictions
    .map(prediction => prediction.cacheId)
    .filter((cacheId): cacheId is string => typeof cacheId === "string" && cacheId.length > 0);
  return [
    "## Affiliate Prediction",
    "This prediction was resolved by Desktop before dispatch. If you request an action, preserve the cache IDs so Backend can snapshot the exact prediction used for this decision.",
    `- Scenario: ${scenario}`,
    `- Payload Status: ${payload.status}`,
    `- Cache IDs: ${cacheIds.length ? cacheIds.join(", ") : "(none)"}`,
    "",
    "### Subject Predictions",
    ...lines,
  ].join("\n");
}

function renderExpectedSalesPredictionLine(index: number, prediction: GQL.AffiliateExpectedSalesSubjectPrediction): string {
  const bucket = prediction.predictionBucket;
  const thresholdProbabilities = prediction.thresholdProbabilities;
  const thresholdPercentiles = prediction.thresholdPercentiles;
  const interval = prediction.predictionInterval;
  return [
    `${index + 1}. status=${prediction.status} cacheId=${prediction.cacheId ?? ""}`,
    `   expectedSalesUnits=${formatMaybeNumber(prediction.expectedSalesUnits)} (calibrated expected-value forecast)`,
    `   expectedSalesPercentile=${formatPercentile(prediction.expectedSalesPercentile)}`,
    interval
      ? `   expectedSalesInterval=${formatMaybeNumber(interval.lowerExpectedSalesUnits)}-${formatMaybeNumber(interval.upperExpectedSalesUnits)} confidence=${formatProbability(interval.confidenceLevel)} method=${interval.method ?? ""}`
      : "   expectedSalesInterval=(none)",
    bucket
      ? `   predictionBucket=index:${bucket.bucketIndex ?? ""} sampleCount:${bucket.sampleCount ?? ""} actualAvgUnits:${formatMaybeNumber(bucket.actualAvgUnits)} actualMedianUnits:${formatMaybeNumber(bucket.actualMedianUnits)} zeroRate:${formatMaybeNumber(bucket.actualZeroRate)}`
      : "   predictionBucket=(none)",
    thresholdProbabilities
      ? `   probabilities=P>=1:${formatProbability(thresholdProbabilities.unitsGe1)} P>=2:${formatProbability(thresholdProbabilities.unitsGe2)} P>=3:${formatProbability(thresholdProbabilities.unitsGe3)} P>=5:${formatProbability(thresholdProbabilities.unitsGe5)} P>=10:${formatProbability(thresholdProbabilities.unitsGe10)}`
      : "   probabilities=(none)",
    thresholdPercentiles
      ? `   probabilityRanks=P>=1 top:${formatTopPercent(thresholdPercentiles.unitsGe1?.topPercent)} P>=3 top:${formatTopPercent(thresholdPercentiles.unitsGe3?.topPercent)} P>=10 top:${formatTopPercent(thresholdPercentiles.unitsGe10?.topPercent)}`
      : "   probabilityRanks=(none)",
    `   merchantMeaning=${renderPredictionPlainMeaning(prediction.expectedSalesUnits)}`,
    `   creator=${prediction.resolvedContext?.creatorNickname ?? prediction.resolvedContext?.creatorUsername ?? prediction.resolvedContext?.creatorId ?? prediction.subject.creatorId ?? ""}`,
    `   product=${prediction.resolvedContext?.productTitle ?? prediction.resolvedContext?.productId ?? prediction.subject.productId ?? ""}`,
    `   sample=${prediction.resolvedContext?.sampleApplicationRecordId ?? prediction.subject.sampleApplicationRecordId ?? ""}`,
    ...(prediction.message ? [`   message=${prediction.message}`] : []),
  ].join("\n");
}

function formatMaybeNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatProbability(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return `${Math.round(value * 100)}%`;
}

function formatPercentile(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return `${Math.round(value * 100)}th`;
}

function formatTopPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return `${Math.round(value * 100)}%`;
}

function renderPredictionPlainMeaning(expectedSalesUnits: number | null | undefined): string {
  if (typeof expectedSalesUnits !== "number" || !Number.isFinite(expectedSalesUnits)) {
    return "No usable sales estimate is available for this creator/product pair.";
  }
  if (expectedSalesUnits <= 0) {
    return "The expected-sales model estimates near-zero unit sales for this creator/product pair, after adjusting to the shop/account's historical outcome scale.";
  }
  if (expectedSalesUnits === 1) {
    return "The expected-sales model estimates about 1 unit for this creator/product pair, after adjusting to the shop/account's historical outcome scale.";
  }
  return `The expected-sales model estimates about ${formatMaybeNumber(expectedSalesUnits)} units for this creator/product pair, after adjusting to the shop/account's historical outcome scale.`;
}

function numberFromUnknown(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function isAffiliateMessageSignal(type: AffiliateConversationSignalPayload["type"]): boolean {
  return type === "CREATOR_MESSAGE_RECEIVED" || type === "AFFILIATE_CONVERSATION_MESSAGE_OBSERVED";
}

function appendOptionalSection(message: string, section?: string): string {
  return section ? `${message}\n\n${section}` : message;
}

function renderProposalDelta(proposals: GQL.ActionProposal[], since: string | null | undefined): string {
  const header = [
    "## Proposal Events Since Last Work Boundary",
    `Since: ${since ?? "(no prior work boundary; showing latest bounded proposal events)"}`,
  ];
  if (proposals.length === 0) {
    return [...header, "(none)"].join("\n");
  }
  return [
    ...header,
    ...proposals.slice(0, 8).flatMap((proposal, index) => [
      `${index + 1}. proposalId=${proposal.id} type=${proposal.type} status=${proposal.status} updatedAt=${proposal.updatedAt ?? ""}`,
      `   operatorSummary=${proposal.operatorSummary ?? ""}`,
      proposal.decision?.note ? `   decisionNote=${proposal.decision.note}` : "   decisionNote=(none)",
      proposal.steps?.length
        ? `   steps=${proposal.steps.map(step => `${step.type}:${step.operatorSummary ?? ""}`).join(" | ")}`
        : "   steps=(none)",
      proposal.messageIntent?.text ? `   messageText=${proposal.messageIntent.text}` : "   messageText=(none)",
      proposal.sampleReviewIntent
        ? `   sampleReview=${proposal.sampleReviewIntent.decision} platformApplicationId=${proposal.sampleReviewIntent.platformApplicationId}`
        : "   sampleReview=(none)",
    ]),
    "",
    "Use this section only to understand draft actions that were already proposed, rejected, superseded, or executed after the last handled work boundary. Do not treat it as stable workspace state.",
  ].join("\n");
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
      `   sampleWorkStatus: ${sample.sampleWorkStatus}`,
      `   observedContentCount: ${sample.observedContentCount}`,
      `   latestObservedContentAt: ${sample.latestObservedContentAt ?? ""}`,
      `   latestObservedContentId: ${sample.latestObservedContentId ?? ""}`,
      `   latestObservedContentUrl: ${sample.latestObservedContentUrl ?? ""}`,
      `   latestObservedContentFormat: ${sample.latestObservedContentFormat ?? ""}`,
      `   latestObservedContentPaidOrderCount: ${sample.latestObservedContentPaidOrderCount ?? ""}`,
      `   latestObservedContentViewCount: ${sample.latestObservedContentViewCount ?? ""}`,
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
