import { randomUUID } from "node:crypto";
import { createLogger } from "@rivonclaw/logger";
import {
  GQL,
  ScopeType,
  type AffiliateNewMessageFrame,
  type AffiliateOrderAttributedFrame,
  type AffiliateSampleApplicationUpdatedFrame,
  type AffiliateTargetCollaborationUpdatedFrame,
} from "@rivonclaw/core";
import type { AffiliateRelationshipSignalPayload } from "../cloud/backend-subscription-client.js";
import { openClawConnector } from "../openclaw/index.js";
import { requestAgent } from "../gateway/agent-tooling-readiness.js";
import { rootStore } from "../app/store/desktop-store.js";
import { normalizePlatform } from "../utils/platform.js";
import { getAuthSession } from "../auth/session-ref.js";
import {
  AFFILIATE_ACTION_PROPOSAL_DELTA_QUERY,
  AFFILIATE_RELATIONSHIP_HISTORY_QUERY,
  DELIVER_AFFILIATE_CREATOR_TEXT_MUTATION,
  AFFILIATE_WORK_ITEMS_QUERY,
  AFFILIATE_WORKSPACE_QUERY,
  RESOLVE_AFFILIATE_WORK_ITEM_MUTATION,
  type AffiliateActionProposalDeltaQueryResult,
  type AffiliateRelationshipHistoryQueryResult,
  type DeliverAffiliateCreatorTextMutationResult,
  type AffiliateWorkItemsQueryResult,
  type AffiliateWorkspaceQueryResult,
  type ResolveAffiliateWorkItemMutationResult,
} from "../cloud/affiliate-queries.js";
import type { StaffLanguage } from "../i18n/locale.js";
import { buildAffiliateAgentRunRequest } from "./affiliate-agent-run-factory.js";
import {
  registerActiveAffiliateRunCheckpoint,
  unregisterActiveAffiliateRunCheckpoint,
} from "./affiliate-run-checkpoints.js";

const log = createLogger("affiliate-session");

export const DEFAULT_AFFILIATE_RUN_PROFILE_ID = "AFFILIATE_OPERATOR";
const DEBUG_AFFILIATE_PROMPT =
  process.env.DEBUG_AFFILIATE_PROMPT === "1" || process.env.RIVONCLAW_DEBUG_AFFILIATE_PROMPT === "1";
const AGENT_RUNTIME_FAILURE_PATTERNS = [
  /resourceexhausted/i,
  /worker local total request limit/i,
  /llm idle timeout/i,
  /produced no reply before the idle watchdog/i,
  /timed out before a response was generated/i,
  /profile .* timed out/i,
];
const AFFILIATE_CHECKPOINT_PLUGIN_ID = "rivonclaw-capability-manager";
const AFFILIATE_CHECKPOINT_EXTENSION_NAMESPACE = "affiliateCheckpoint";

export interface AffiliateShopContext {
  /** Backend user id owning this affiliate shop. */
  userId?: string;
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
  userId?: string;
  shopId: string;
  platformShopId: string;
  triggerKind: AffiliateTriggerKind;
  triggerId: string;
  creatorImUserId?: string;
  creatorId?: string | null;
  creatorRelationshipId: string;
  productId?: string | null;
  sampleApplicationId?: string;
  collaborationRecordId?: string;
  orderId?: string | null;
}

export interface AffiliateDispatchResult {
  runId?: string;
  runMode?: AffiliateAgentRunMode;
}

interface AffiliateRunCheckpoint {
  baseCheckpointId: string | null;
  candidateCheckpointId: string;
}

export enum AffiliateAgentRunMode {
  OPERATOR_REASONING = "OPERATOR_REASONING",
  CREATOR_OUTREACH = "CREATOR_OUTREACH",
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
  private runCheckpoints = new Map<string, AffiliateRunCheckpoint>();
  private runtimeFailedRuns = new Set<string>();
  private creatorOutreachRuns = new Map<string, {
    text: string;
    deliveryCount: number;
    preferredChannel?: GQL.AffiliateMessageChannel;
  }>();

  constructor(
    private shop: AffiliateShopContext,
    affiliateContext: AffiliateContext,
  ) {
    this.affiliateContext = {
      ...affiliateContext,
      userId: affiliateContext.userId ?? shop.userId ?? "",
    };
    this.platform = shop.platform ?? normalizePlatform("TIKTOK_SHOP");
    this.scopeKey = AffiliateSession.buildScopeKey(this.platform, this.affiliateContext);
  }

  readonly affiliateContext: AffiliateContext;

  updateShopContext(shop: AffiliateShopContext): void {
    this.shop = shop;
  }

  static buildScopeKey(_platform: string, context: AffiliateContext): string {
    if (!context.userId) {
      throw new Error("userId is required for affiliate agent sessions");
    }
    if (!context.creatorRelationshipId) {
      throw new Error("creatorRelationshipId is required for affiliate agent sessions");
    }
    return `agent:main:affiliate:${context.userId}:${context.creatorRelationshipId}`;
  }

  get extraSystemPrompt(): string {
    return this.buildExtraSystemPrompt(AffiliateAgentRunMode.OPERATOR_REASONING);
  }

  private buildExtraSystemPrompt(runMode: AffiliateAgentRunMode): string {
    const isCreatorOutreach = runMode === AffiliateAgentRunMode.CREATOR_OUTREACH;
    return [
      "## Affiliate / Creator Management Agent",
      "",
      "You are operating an affiliate creator-management workflow for a TikTok Shop seller.",
      isCreatorOutreach
        ? "The active run is creator-facing. Your final assistant text may be delivered to the creator by the affiliate bridge."
        : "This is not a customer-service conversation. Do not assume your assistant text is sent to the creator.",
      "",
      "## Active Run Mode",
      `- ${runMode}`,
      ...(isCreatorOutreach
        ? [
          "- CREATOR_OUTREACH: final assistant text is creator-facing and may be auto-forwarded through direct-channel delivery such as WhatsApp or Outlook email.",
          "- Keep internal reasoning, tool plans, JSON, and operator notes out of final assistant text.",
          "- If no creator-facing reply should be sent, make the final assistant response exactly NO_REPLY.",
          "- Do not call affiliate_resolve_work_item just to send a plain reply; the bridge delivers the final assistant text.",
        ]
        : [
          "- OPERATOR_REASONING: assistant output is internal/operator-facing and must not be auto-sent to a creator.",
          "- For backend work items, put staff-facing detail in operatorSummary, then make the final assistant response exactly NO_REPLY after the required tool call.",
        ]),
      "",
      "## Channel Model",
      "- WhatsApp and Outlook email are direct affiliate outreach channels for non-China TikTok Shop creator communication.",
      "- TikTok Shop platform chat is mainly for first contact, asking the creator for WhatsApp/email, and fallback when direct-channel delivery is unavailable or fails.",
      "- Keep context at the seller-creator relationship level: WhatsApp, Outlook email, and platform chat are different channels for the same relationship, not separate memories.",
      "- When the creator provides or corrects a WhatsApp number, use affiliate_set_creator_whatsapp. Use affiliate_check_creator_whatsapp when the number needs validation.",
      "- When the creator provides or corrects an email address, use affiliate_set_creator_email.",
      "- Use affiliate_get_creator_contact_state to inspect current channel availability and affiliate_get_relationship_history for immutable relationship-level events across platform chat, WhatsApp, email, delivery attempts, proposal decisions, sample milestones, and lifecycle events. Use affiliate_get_workspace for current collaboration/sample/proposal state.",
      "- Treat provider route identifiers as transport provenance only. Do not use them as the workspace boundary or as primary keys for affiliate tools.",
      "",
      "## Operating Model",
      "- Use backend affiliate tools as the source of truth for campaigns, creator lifecycle state, tags, approval policies, and action execution.",
      "- OPERATOR_REASONING work-item runs must end with exactly one affiliate_resolve_work_item call. A final text response alone does not complete a backend work item.",
      "- CREATOR_OUTREACH signal runs are different: for a plain creator reply, final assistant text is the message to deliver and affiliate_resolve_work_item is not required.",
      "- If a structured TikTok platform action is needed, such as reviewing a sample application or creating a target collaboration, use affiliate_resolve_work_item with decision REQUEST_ACTION and a typed platform action payload.",
      "- affiliate_resolve_work_item supports only three platform action types: SEND_MESSAGE, REVIEW_SAMPLE_APPLICATION, and CREATE_TARGET_COLLABORATION. Do not invent action types such as CHANGE_COMMISSION; use NEEDS_STAFF_REVIEW for unsupported seller operations.",
      "- Each REQUEST_ACTION action must populate the required payload matching its type: SEND_MESSAGE -> messageText, REVIEW_SAMPLE_APPLICATION -> sampleApplicationRecordId + platformApplicationId + sampleReviewDecision, CREATE_TARGET_COLLABORATION -> targetCollaborationIntent.",
      "- For SEND_MESSAGE, action.messageText is required and must contain the final text the creator should receive. Do not put the intended creator message only in operatorSummary.",
      "- For REVIEW_SAMPLE_APPLICATION, use action.sampleApplicationRecordId, action.platformApplicationId, action.sampleReviewDecision, and optional action.rejectReason. Do not send sampleReviewIntent: {}.",
      "- Omit optional fields when unknown. Never send empty strings for Date, ID, or object fields. nextSellerActionAt is only for DEFERRED decisions and must be a valid ISO timestamp.",
      "- If no platform action is needed, use affiliate_resolve_work_item with decision NO_ACTION_NEEDED, NEEDS_STAFF_REVIEW, or DEFERRED.",
      "- If affiliate_resolve_work_item returns a proposal requiring approval, stop there and make your final assistant response exactly NO_REPLY; do not try to bypass approval.",
      `- Write every operatorSummary and staff-facing explanation in ${this.shop.staffLanguage ?? "English"}.`,
      "- If the merchant explicitly approves, rejects, or asks to revise a pending proposal in this Codex thread, use affiliate_decide_proposal. For revision requests, set status REVISION_REQUESTED and put the merchant's requested changes in decision.note.",
      "- Do not rely on memory for creator history or policy. Ask tools for state when needed.",
      "- Never put a platform sample application ID into campaignId. For sample events, use platformApplicationId or sampleApplicationRecordId.",
      "",
      "## Workflow Discipline",
      "- Desktop resolves a small affiliate workspace snapshot before dispatch when possible. Use it as the initial fact set.",
      "- Call affiliate_get_workspace with creatorRelationshipId when a decision depends on dynamic facts not present in the injected snapshot, such as creator follower count, creator relation/tags, sample status, product context, approval policies, campaign setup, or pending proposals.",
      "- If you need a variable fact to apply a merchant rule or make a decision, for example follower count, GMV, prior performance, sample cost, inventory, or fulfillment state, fetch the narrow current CreatorRelationship workspace with affiliate_get_workspace before deciding.",
      "- Use affiliate_get_relationship_history when you need relationship-level audit events, previous proposal decisions, prior sample actions, creator communications, or past staff/agent outcomes before deciding. Query by creatorRelationshipId; do not use provider conversation routes as history keys. Use affiliate_get_workspace for current entity snapshots.",
      "- Use affiliate_predict_creator_product_fit when a creator message or card mentions a candidate product and you need creator/product fit evidence before deciding whether to proceed, decline, create a target collaboration, or reply. The tool returns product summary, decision thresholds, and model prediction without confirming or binding the product to the collaboration.",
      "- A product card in a creator message is candidate evidence only. Do not treat it as the confirmed collaboration product unless Backend Work Context already has a product context, sample application, or target collaboration for that product.",
      "- Treat creator messages as continuation work: understand the request, check relevant campaign/collaboration/sample state, then resolve the work item through affiliate_resolve_work_item.",
      "- Treat sample application events as triage work: inspect creator value, product/sample policy, stock/fulfillment facts exposed by tools, then resolve the work item through affiliate_resolve_work_item.",
      "- Treat collaboration events as lifecycle work: reconcile local state, decide whether follow-up is needed, and avoid duplicate outreach.",
      "- Treat attributed order events as evidence for relation health/ROI; do not message the creator unless there is a clear business reason.",
      "- Use operatorSummary for staff-facing summaries. Keep it short: current fact, recommended/attempted action, proposal id if approval is required.",
      `- operatorSummary language: ${this.shop.staffLanguage ?? "English"}. Creator-facing messages should use the creator's language instead.`,
      "",
      "## Current Affiliate Context",
      `- Shop ID: ${this.affiliateContext.shopId}`,
      `- Shop Name: ${this.shop.shopName}`,
      `- Trigger Kind: ${this.affiliateContext.triggerKind}`,
      ...(this.affiliateContext.creatorRelationshipId ? [`- Creator Relationship ID: ${this.affiliateContext.creatorRelationshipId}`] : []),
      ...(this.affiliateContext.productId ? [`- Product ID: ${this.affiliateContext.productId}`] : []),
      ...(this.affiliateContext.sampleApplicationId ? [`- Sample Application ID: ${this.affiliateContext.sampleApplicationId}`] : []),
      ...(this.affiliateContext.collaborationRecordId ? [`- Related Collaboration Record ID: ${this.affiliateContext.collaborationRecordId}`] : []),
      ...(this.affiliateContext.orderId ? [`- Order ID: ${this.affiliateContext.orderId}`] : []),
    ].join("\n");
  }

  async handleCreatorMessage(frame: AffiliateNewMessageFrame): Promise<AffiliateDispatchResult> {
    if (!this.affiliateContext.creatorRelationshipId) {
      log.warn(
        `Skipping affiliate creator message ${frame.messageId} because no creatorRelationshipId was provided; ` +
        "relationship-level backend signal/work item must materialize this message before agent dispatch",
      );
      return { runId: undefined };
    }

    const generation = this.beginCreatorMessageTakeover();
    const message = await this.buildRelationshipMessageUpdateWorkPackage({
      currentSignalId: frame.messageId,
      currentChannel: GQL.AffiliateMessageChannel.PlatformChat,
      messageType: frame.messageType,
      senderRole: frame.senderRole,
      fallbackContent: this.parseMessageContent(frame),
      eventTime: String(frame.createTime),
    });

    if (generation !== this.dispatchGeneration) return { runId: undefined };

    const result = await this.dispatch({
      message,
      idempotencyKey: `affiliate:${this.platform}:${frame.messageId}`,
      abortActive: false,
      runMode: AffiliateAgentRunMode.CREATOR_OUTREACH,
    });
    return result;
  }

  async handleRelationshipSignal(signal: AffiliateRelationshipSignalPayload): Promise<AffiliateDispatchResult> {
    const creatorRelationshipId = signalCreatorRelationshipId(signal);

    if (isAffiliateMessageSignal(signal.type) && signal.messageId && !creatorRelationshipId) {
      log.warn(
        `Skipping affiliate message signal ${signal.messageId} because no creatorRelationshipId was provided; ` +
        "message signals must be materialized to a CreatorRelationship before agent dispatch",
      );
      return { runId: undefined };
    }

    if (isAffiliateMessageSignal(signal.type) && creatorRelationshipId && signal.messageId) {
      const generation = this.beginCreatorMessageTakeover();
      const workspaceSnapshot = await this.buildWorkspaceSnapshot({
        includePolicies: true,
        limit: 20,
      });
      const message = await this.buildRelationshipMessageUpdateWorkPackage({
        currentSignalId: signal.messageId,
        currentChannel: signal.channel ?? GQL.AffiliateMessageChannel.PlatformChat,
        messageType: signal.messageType ?? undefined,
        senderRole: signal.senderRole ?? undefined,
        eventTime: String(signal.eventTime),
      });
      const relationshipHeader = [
        "[Creator Relationship Workspace]",
        `Creator Relationship ID: ${creatorRelationshipId}`,
        "This message history is relationship-level channel evidence. Do not treat any provider conversation route as the business subject.",
      ].join("\n");
      if (generation !== this.dispatchGeneration) return { runId: undefined };
      return this.dispatch({
        message: appendOptionalSection([relationshipHeader, "", message].join("\n"), workspaceSnapshot),
        idempotencyKey: buildSignalIdempotencyKey(this.platform, signal),
        abortActive: false,
        runMode: AffiliateAgentRunMode.CREATOR_OUTREACH,
        preferredChannel: directSignalPreferredChannel(signal),
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
      ...(signal.collaborationRecordId ? [`Related Collaboration Record ID: ${signal.collaborationRecordId}`] : []),
      ...(signal.processingStatus ? [`Processing Status: ${signal.processingStatus}`] : []),
      ...(signal.processReasons?.length ? [`Process Reasons: ${signal.processReasons.join(", ")}`] : []),
      ...(signal.messageType ? [`Message Type: ${signal.messageType}`] : []),
      ...(signal.messageDirection ? [`Message Direction: ${signal.messageDirection}`] : []),
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
      runMode: AffiliateAgentRunMode.OPERATOR_REASONING,
    });
  }

  async handleWorkItem(workItem: GQL.AffiliateWorkItem): Promise<AffiliateDispatchResult> {
    if (!workItem.agentDispatchRecommended) {
      log.info(`Affiliate work item ${workItem.id} does not recommend agent dispatch; skipping`);
      return { runId: undefined };
    }

    let relationshipMessageUpdate: string | undefined;
    let generation: number | undefined;
    if (isCreatorReplyWorkItem(workItem)) {
      generation = this.beginCreatorMessageTakeover();
      relationshipMessageUpdate = await this.buildRelationshipMessageUpdateWorkPackage({
        currentSignalId: workItemCurrentMessageId(workItem) ?? undefined,
        currentChannel: GQL.AffiliateMessageChannel.PlatformChat,
        eventTime: workItem.collaboration?.lastCreatorMessageAt ?? workItem.creatorRelationship?.lastInboundAt ?? undefined,
      });
      if (generation !== this.dispatchGeneration) return { runId: undefined };
    }

    const predictionContext = await this.resolvePredictionDispatchContext(workItem);
    const thresholdContext = await this.resolveDecisionThresholdDispatchContext(workItem);
    const request = buildAffiliateAgentRunRequest({
      workItem,
      platform: this.platform,
      relationshipMessageUpdate,
      proposalDeltaSection: await this.buildProposalDeltaSection(workItem),
      ...predictionContext,
      ...thresholdContext,
      businessPrompt: this.shop.businessPrompt,
      staffLanguage: this.shop.staffLanguage,
    });
    if (!request) return { runId: undefined };

    const result = await this.dispatch({
      ...request,
      runMode: AffiliateAgentRunMode.OPERATOR_REASONING,
      baseCheckpointId: normalizeCheckpointId(workItem.creatorRelationship?.committedCheckpointId),
    });
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
    const runtimeFailed = this.runtimeFailedRuns.delete(runId);
    if (options.errored || runtimeFailed) {
      this.runCheckpoints.delete(runId);
      this.creatorOutreachRuns.delete(runId);
      if (workItem != null) this.pendingRunCompletions.delete(runId);
      log.warn(
        `Affiliate agent run ended with gateway error; leaving work item unacked for retry: ` +
        `runId=${runId} subject=${workItem ? workItemSubjectLabel(workItem) : "(creator-outreach)"} ` +
        `runtimeFailed=${runtimeFailed}`,
      );
      return;
    }

    void this.finalizeSuccessfulRun(runId, workItem);
  }

  handleAgentEvent(payload: {
    runId?: string;
    stream?: string;
    data?: Record<string, unknown>;
  }): boolean {
    const runId = payload.runId;
    const { stream, data } = payload;
    if (!runId || !stream || !data) return false;

    if (this.pendingRunCompletions.has(runId) && this.isRuntimeFailureAgentEvent(stream, data)) {
      this.runtimeFailedRuns.add(runId);
    }

    if (!this.creatorOutreachRuns.has(runId)) return false;

    if (stream === "assistant") {
      const text = data.text;
      if (typeof text === "string") {
        const state = this.creatorOutreachRuns.get(runId);
        if (state) state.text = text;
      }
      return true;
    }

    if (stream === "tool" && data.phase === "start") {
      return true;
    }

    if (stream === "lifecycle" && (data.phase === "end" || data.phase === "error")) {
      return true;
    }

    return true;
  }

  private isRuntimeFailureAgentEvent(stream: string, data: Record<string, unknown>): boolean {
    if (stream === "lifecycle" && data.phase === "error") return true;
    const text = [
      data.text,
      data.message,
      data.error,
      data.reason,
      data.rawError,
    ].filter((value): value is string => typeof value === "string");
    return text.some((value) => AGENT_RUNTIME_FAILURE_PATTERNS.some((pattern) => pattern.test(value)));
  }

  private async flushCreatorOutreachText(runId: string): Promise<void> {
    const state = this.creatorOutreachRuns.get(runId);
    if (!state) return;
    const text = sanitizeCreatorOutreachText(state.text);
    state.text = "";
    if (!text) return;
    if (!this.affiliateContext.creatorRelationshipId) {
      log.warn(`Creator outreach run ${runId} has no creatorRelationshipId; dropping final text`);
      return;
    }
    const authSession = getAuthSession();
    if (!authSession) {
      log.warn(`No auth session available, cannot deliver affiliate creator text for run ${runId}`);
      return;
    }
    state.deliveryCount += 1;
    try {
      const checkpoint = this.runCheckpoints.get(runId);
      const result = await authSession.graphqlFetch<DeliverAffiliateCreatorTextMutationResult>(
        DELIVER_AFFILIATE_CREATOR_TEXT_MUTATION,
        {
          input: {
            shopId: this.affiliateContext.shopId,
            creatorRelationshipId: this.affiliateContext.creatorRelationshipId,
            text,
            idempotencyKey: `affiliate-delivery:${runId}:${state.deliveryCount}`,
            runId,
            sessionKey: this.scopeKey,
            baseCheckpointId: checkpoint?.baseCheckpointId ?? null,
            candidateCheckpointId: checkpoint?.candidateCheckpointId,
            source: "AGENT_AUTO_FORWARD",
            fallbackToPlatform: true,
            preferredChannel: state.preferredChannel,
          },
        },
      );
      const delivery = result.deliverAffiliateCreatorText;
      log.info(
        `Affiliate creator text delivered: runId=${runId} delivery=${delivery.id} ` +
        `status=${delivery.status} channel=${delivery.actualChannel ?? ""}`,
      );
    } catch (err) {
      log.error(`Failed to deliver affiliate creator text for run ${runId}:`, err);
    }
  }

  private async setup(): Promise<void> {
    if (this.gatewaySetupReady) return;

    const runProfileId = this.shop.runProfileId ?? DEFAULT_AFFILIATE_RUN_PROFILE_ID;
    rootStore.toolCapability.setSessionRunProfile(this.scopeKey, runProfileId);

    this.gatewaySetupReady = true;
  }

  private async applyCurrentSessionModel(): Promise<void> {
    await rootStore.llmManager.applyModelForSession(this.scopeKey, {
      type: ScopeType.AFFILIATE_SESSION,
      shopId: this.shop.objectId,
    });
  }

  private async dispatch(params: {
    message: string;
    idempotencyKey: string;
    abortActive?: boolean;
    runMode?: AffiliateAgentRunMode;
    preferredChannel?: GQL.AffiliateMessageChannel;
    baseCheckpointId?: string | null;
  }): Promise<AffiliateDispatchResult> {
    if (params.abortActive !== false) this.abortActiveRun();
    const runMode = params.runMode ?? AffiliateAgentRunMode.OPERATOR_REASONING;
    await this.setup();
    const checkpoint = await this.prepareRunCheckpoint(params.baseCheckpointId);
    await this.applyCurrentSessionModel();
    this.logDispatchPromptContext(params);
    const provisionalRunId = params.idempotencyKey;
    registerActiveAffiliateRunCheckpoint({
      creatorRelationshipId: this.affiliateContext.creatorRelationshipId,
      sessionKey: this.scopeKey,
      runId: provisionalRunId,
      baseCheckpointId: checkpoint.baseCheckpointId,
      candidateCheckpointId: checkpoint.candidateCheckpointId,
    });

    let response: AffiliateDispatchResult | undefined;
    try {
      response = await requestAgent<AffiliateDispatchResult>({
        sessionKey: this.scopeKey,
        message: params.message,
        extraSystemPrompt: this.buildExtraSystemPrompt(runMode),
        promptMode: "raw",
        idempotencyKey: params.idempotencyKey,
      });
    } catch (err) {
      unregisterActiveAffiliateRunCheckpoint({
        creatorRelationshipId: this.affiliateContext.creatorRelationshipId,
        runId: provisionalRunId,
      });
      throw err;
    }

    if (response?.runId) {
      this.activeRunId = response.runId;
      this.runCheckpoints.set(response.runId, checkpoint);
      registerActiveAffiliateRunCheckpoint({
        creatorRelationshipId: this.affiliateContext.creatorRelationshipId,
        sessionKey: this.scopeKey,
        runId: response.runId,
        baseCheckpointId: checkpoint.baseCheckpointId,
        candidateCheckpointId: checkpoint.candidateCheckpointId,
      });
      if (runMode === AffiliateAgentRunMode.CREATOR_OUTREACH) {
        this.creatorOutreachRuns.set(response.runId, {
          text: "",
          deliveryCount: 0,
          preferredChannel: params.preferredChannel,
        });
      }
      log.info(`Affiliate agent run dispatched: runId=${response.runId} scope=${this.scopeKey}`);
    } else {
      this.activeRunId = null;
      unregisterActiveAffiliateRunCheckpoint({
        creatorRelationshipId: this.affiliateContext.creatorRelationshipId,
        runId: provisionalRunId,
      });
    }
    return { runId: response?.runId, runMode };
  }

  private logDispatchPromptContext(params: {
    message: string;
    idempotencyKey: string;
    runMode?: AffiliateAgentRunMode;
  }): void {
    log.info(
      [
        "Affiliate dispatch prompt context",
        `scope=${this.scopeKey}`,
        `idempotencyKey=${params.idempotencyKey}`,
        `triggerKind=${this.affiliateContext.triggerKind}`,
        `triggerId=${this.affiliateContext.triggerId}`,
        `shopId=${this.affiliateContext.shopId}`,
        `collaborationRecordId=${this.affiliateContext.collaborationRecordId ?? ""}`,
        `runMode=${params.runMode ?? AffiliateAgentRunMode.OPERATOR_REASONING}`,
        `messageChars=${params.message.length}`,
        `systemPromptChars=${this.buildExtraSystemPrompt(params.runMode ?? AffiliateAgentRunMode.OPERATOR_REASONING).length}`,
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
      this.buildExtraSystemPrompt(params.runMode ?? AffiliateAgentRunMode.OPERATOR_REASONING),
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

  private async prepareRunCheckpoint(
    requestedBaseCheckpointId: string | null | undefined,
  ): Promise<AffiliateRunCheckpoint> {
    const baseCheckpointId = requestedBaseCheckpointId === undefined
      ? await this.resolveRelationshipCommittedCheckpointId()
      : normalizeCheckpointId(requestedBaseCheckpointId);
    const candidateCheckpointId = randomUUID();

    await openClawConnector.request("sessions.create", {
      key: this.scopeKey,
      label: `Affiliate ${this.affiliateContext.creatorRelationshipId}`,
    });

    if (baseCheckpointId) {
      await openClawConnector.request("sessions.compaction.restore", {
        key: this.scopeKey,
        checkpointId: baseCheckpointId,
      });
    } else {
      await openClawConnector.request("sessions.reset", {
        key: this.scopeKey,
        reason: "new",
      });
    }

    await openClawConnector.request("sessions.pluginPatch", {
      key: this.scopeKey,
      pluginId: AFFILIATE_CHECKPOINT_PLUGIN_ID,
      namespace: AFFILIATE_CHECKPOINT_EXTENSION_NAMESPACE,
      value: {
        baseCheckpointId,
        candidateCheckpointId,
      },
    });

    return { baseCheckpointId, candidateCheckpointId };
  }

  private async finalizeSuccessfulRun(
    runId: string,
    workItem: GQL.AffiliateWorkItem | undefined,
  ): Promise<void> {
    try {
      await this.createCandidateCheckpoint(runId);
      if (this.creatorOutreachRuns.has(runId)) {
        await this.flushCreatorOutreachText(runId);
      }
      if (workItem != null) {
        await this.completeWorkItemIfUnresolved(runId, workItem);
      }
    } catch (err) {
      log.error(`Failed to finalize affiliate checkpoint for run ${runId}:`, err);
    } finally {
      unregisterActiveAffiliateRunCheckpoint({
        creatorRelationshipId: this.affiliateContext.creatorRelationshipId,
        runId,
      });
      this.creatorOutreachRuns.delete(runId);
      this.pendingRunCompletions.delete(runId);
      this.runCheckpoints.delete(runId);
    }
  }

  private async createCandidateCheckpoint(runId: string): Promise<void> {
    const checkpoint = this.runCheckpoints.get(runId);
    if (!checkpoint) return;
    await openClawConnector.request("sessions.checkpoint.create", {
      key: this.scopeKey,
      checkpointId: checkpoint.candidateCheckpointId,
      summary: `Affiliate run ${runId} candidate checkpoint`,
    });
  }

  private async resolveRelationshipCommittedCheckpointId(): Promise<string | null> {
    const workspace = await this.fetchWorkspace({
      includePolicies: false,
      limit: 1,
    });
    const relationship = workspace?.creatorRelations?.find(
      item => item.id === this.affiliateContext.creatorRelationshipId,
    );
    return normalizeCheckpointId(relationship?.committedCheckpointId);
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
          `runId=${runId} subject=${workItemSubjectLabel(workItem)}`,
        );
        return;
      }

      const result = await authSession.graphqlFetch<ResolveAffiliateWorkItemMutationResult>(
        RESOLVE_AFFILIATE_WORK_ITEM_MUTATION,
        {
          input: {
            creatorRelationshipId: workItem.creatorRelationshipId,
            handledSignalAt: workItemBoundaryAt(workItem),
            decision: "FAILED_OR_INCOMPLETE",
            operatorSummary: `Agent run ${runId} completed without a structured affiliate_resolve_work_item decision.`,
          },
        },
      );
      const payload = result.resolveAffiliateWorkItem;
      log.info(
        `Affiliate work item completion callback: runId=${runId} ` +
        `subject=${workItemSubjectLabel(workItem)} decision=${payload.decision} ` +
        `stale=${payload.stale} status=${payload.collaborationRecord?.processingStatus ?? ""}`,
      );
    } catch (err) {
      log.error(`Failed to complete unresolved affiliate work item for run ${runId}:`, err);
    }
  }

  private async isWorkItemAlreadyHandled(workItem: GQL.AffiliateWorkItem): Promise<boolean> {
    const boundary = parseOptionalDate(workItemBoundaryAt(workItem));
    if (!boundary) return false;

    const authSession = getAuthSession();
    if (!authSession) return false;

    const result = await authSession.graphqlFetch<AffiliateWorkItemsQueryResult>(
      AFFILIATE_WORK_ITEMS_QUERY,
      {
        input: {
          shopId: this.affiliateContext.shopId,
          creatorRelationshipId: workItem.creatorRelationshipId,
          limit: 1,
        },
      },
    );
    const currentWorkItem = result.affiliateWorkItems[0];
    const handledUntil = parseOptionalDate(workItemHandledUntil(currentWorkItem));
    return handledUntil != null && handledUntil.getTime() >= boundary.getTime();
  }

  private beginCreatorMessageTakeover(): number {
    this.dispatchGeneration += 1;
    this.abortActiveRun();
    return this.dispatchGeneration;
  }

  private async buildRelationshipMessageUpdateWorkPackage(params: {
    currentSignalId?: string;
    currentChannel?: GQL.AffiliateMessageChannel;
    messageType?: string;
    senderRole?: string;
    fallbackContent?: string;
    eventTime?: string;
  }): Promise<string> {
    const history = await this.fetchRelationshipHistory({
      limit: 30,
    });
    if (!history) {
      return [
        "[Affiliate Creator Message Update]",
        `Creator Relationship ID: ${this.affiliateContext.creatorRelationshipId}`,
        ...(params.currentChannel ? [`Current Channel: ${params.currentChannel}`] : []),
        ...(params.currentSignalId ? [`Current Signal ID: ${params.currentSignalId}`] : []),
        ...(params.senderRole ? [`Current Sender Role: ${params.senderRole}`] : []),
        ...(params.messageType ? [`Current Message Type: ${params.messageType}`] : []),
        ...(params.eventTime ? [`Event Time: ${params.eventTime}`] : []),
        "",
        "Relationship history could not be fetched before dispatch. Use affiliate_get_workspace and affiliate_get_relationship_history with creatorRelationshipId before taking action.",
        "If this is a plain creator reply, write the creator-facing message as final assistant text so the affiliate bridge can deliver it through direct-channel routing.",
        "If the creator provides a WhatsApp number, use affiliate_set_creator_whatsapp before replying or answer NO_REPLY if no creator-facing response is needed.",
        "If the creator provides an email address, use affiliate_set_creator_email before replying or answer NO_REPLY if no creator-facing response is needed.",
        ...(params.fallbackContent ? ["", "[Webhook Fallback Content]", params.fallbackContent] : []),
      ].join("\n");
    }

    const timelineItems = relationshipHistoryMessages(history.items ?? [])
      .filter((message) => !params.currentChannel || message.channel === params.currentChannel)
      .sort((left, right) => historyItemTimestamp(left) - historyItemTimestamp(right));
    const timeline = timelineItems.map((message, index) => {
      const side = resolveRelationshipMessageSide(message);
      return [
        `${index + 1}. [${side}]`,
        `   channel: ${message.channelLabel ?? message.channel}`,
        ...(message.accountLabel ? [`   account: ${message.accountLabel}`] : []),
        ...(message.shopName ? [`   shop: ${message.shopName}`] : []),
        `   createdAt: ${message.createdAt ?? ""}`,
        `   type: ${message.messageType ?? ""}`,
        ...(message.subject ? [`   subject: ${message.subject}`] : []),
        `   text: ${relationshipMessageText(message)}`,
      ].join("\n");
    });
    const semanticHints = deriveRelationshipMessageSemanticHints(timelineItems);
    const cardHints = deriveRelationshipMessageCardHints(timelineItems);

    return [
      "[Affiliate Creator Message Update]",
      "",
      "This is merged relationship-level message history for the current CreatorRelationship workspace.",
      "Messages may come from TikTok Shop platform chat, WhatsApp, email, or delivery records. Channel labels are provenance, not workspace boundaries.",
      "Do not ask for or use provider conversation/thread ids. Use CreatorRelationship tools and business target refs.",
      "",
      "## Relationship Message Meta",
      `- Creator Relationship ID: ${this.affiliateContext.creatorRelationshipId}`,
      ...(params.currentChannel ? [`- Current Trigger Channel: ${params.currentChannel}`] : []),
      ...(params.currentSignalId ? [`- Current Signal ID: ${params.currentSignalId}`] : []),
      `- Returned Message Count: ${timelineItems.length}`,
      "",
      "## Ordered Relationship Timeline",
      ...(timeline.length ? timeline : ["(No relationship messages returned.)"]),
      "",
      ...(semanticHints.length ? ["## Derived Message Hints", ...semanticHints, ""] : []),
      ...(cardHints.length ? ["## Candidate Card Hints", ...cardHints, ""] : []),
      "## Task",
      "Handle the latest creator-side message in the relationship timeline, considering cross-channel context.",
      "If this is a plain creator reply, write the creator-facing message as final assistant text so the affiliate bridge can deliver it through direct-channel routing.",
      "If the creator provides a WhatsApp number, use affiliate_set_creator_whatsapp before replying or answer NO_REPLY if no creator-facing response is needed.",
      "If the creator provides an email address, use affiliate_set_creator_email before replying or answer NO_REPLY if no creator-facing response is needed.",
      "If the timeline is incomplete or includes seller-side/human messages that change the commitment context, be conservative: ask a concise clarification as final assistant text, or answer NO_REPLY when no safe creator-facing message should be sent.",
    ].join("\n");
  }

  private async fetchRelationshipHistory(params: {
    limit?: number;
  }): Promise<GQL.AffiliateRelationshipHistoryPayload | null> {
    const authSession = getAuthSession();
    if (!authSession) {
      log.warn("No auth session available, cannot fetch affiliate relationship history");
      return null;
    }

    try {
      const result = await authSession.graphqlFetch<AffiliateRelationshipHistoryQueryResult>(
        AFFILIATE_RELATIONSHIP_HISTORY_QUERY,
        {
          input: {
            shopId: this.affiliateContext.shopId,
            creatorRelationshipId: this.affiliateContext.creatorRelationshipId,
            types: [
              GQL.AffiliateRelationshipHistoryType.PlatformChatMessage,
              GQL.AffiliateRelationshipHistoryType.WhatsappMessage,
              GQL.AffiliateRelationshipHistoryType.EmailMessage,
              GQL.AffiliateRelationshipHistoryType.MessageDelivery,
              GQL.AffiliateRelationshipHistoryType.LifecycleEvent,
            ],
            limit: params.limit ?? 30,
          },
        },
      );
      return result.affiliateRelationshipHistory;
    } catch (err) {
      log.warn(
        `Failed to fetch affiliate relationship history for ${this.affiliateContext.creatorRelationshipId}: ${String(err)}`,
      );
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
      const since = workItemHandledUntil(workItem);
      if (since == null) {
        return [
          "## Proposal Events Since Last Work Boundary",
          "(none: this work item has no handled work boundary yet)",
        ].join("\n");
      }
      const result = await authSession.graphqlFetch<AffiliateActionProposalDeltaQueryResult>(
        AFFILIATE_ACTION_PROPOSAL_DELTA_QUERY,
        {
          input: {
            shopId: workItem.focusShopId,
            creatorRelationshipId: workItem.creatorRelationshipId,
            since,
            limit: 8,
          },
        },
      );
      return renderProposalDelta(result.affiliateActionProposalDelta ?? [], since);
    } catch (err) {
      log.warn(`Failed to fetch affiliate proposal delta for ${workItemSubjectLabel(workItem)}: ${String(err)}`);
      return "## Proposal Events Since Last Work Boundary\n(unavailable: backend query failed)";
    }
  }

  private async fetchWorkspace(params: {
    includePolicies?: boolean;
    campaignId?: string;
    platformApplicationId?: string;
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
            creatorRelationshipId: this.affiliateContext.creatorRelationshipId,
            includePolicies: params.includePolicies ?? true,
            campaignId: params.campaignId,
            platformApplicationId: params.platformApplicationId,
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

    const existingSnapshot = workItem.collaboration?.predictionSnapshots?.find(
      snapshot => snapshot.status === GQL.AffiliatePredictionStatus.Ok,
    );
    if (existingSnapshot) {
      const sourceCacheId =
        typeof existingSnapshot.sourceCacheId === "string" &&
        existingSnapshot.sourceCacheId.length > 0
          ? existingSnapshot.sourceCacheId
          : null;
      return {
        predictionSection: renderExpectedSalesPredictionSnapshotSection(existingSnapshot.scenario, existingSnapshot),
        predictionCacheIds: sourceCacheId ? [sourceCacheId] : [],
      };
    }

    return {
      predictionSection: [
        "## Affiliate Prediction",
        `- Scenario: ${scenario}`,
        "- Status: NOT_PREFETCHED",
        "- Cache IDs: (none)",
        "- Prediction is an agent tool, not a deterministic pre-dispatch rule. Call affiliate_predict_creator_product_fit with creatorRelationshipId if prediction evidence is needed before choosing an action, then include the returned cacheId in predictionCacheIds. For sample review, pass scenario SAMPLE_REVIEW and the sample application ids when available.",
      ].join("\n"),
      predictionCacheIds: [],
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
        `Product ID: ${frame.productId ?? ""}`,
        `Status: ${frame.status}`,
        `Event Time: ${frame.eventTime}`,
        "",
        "Use the injected workspace snapshot as the current backend fact set.",
        ...(this.shop.businessPrompt?.trim()
          ? ["", "## Merchant Affiliate Instructions", this.shop.businessPrompt.trim(), ""]
          : []),
        "If the matching sampleApplicationRecord is PENDING_REVIEW, resolve the work item through affiliate_resolve_work_item.",
        `Use operatorSummary for staff-facing reasoning in ${this.shop.staffLanguage ?? "English"}. Creator-facing text belongs only in action.messageText.`,
        "Do not pass this platform application ID as campaignId.",
      ].join("\n"), workspaceSnapshot),
      idempotencyKey: `affiliate:${this.platform}:sample:${frame.applicationId}:${frame.status}:${frame.eventTime}`,
    });
  }

  async handleTargetCollaborationUpdated(frame: AffiliateTargetCollaborationUpdatedFrame): Promise<AffiliateDispatchResult> {
    return this.dispatch({
      message: [
        "[Affiliate Target Collaboration Updated]",
        `Target Collaboration Platform ID: ${frame.collaborationId}`,
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

function buildSignalIdempotencyKey(platform: string, signal: AffiliateRelationshipSignalPayload): string {
  const stableId = signal.messageId
    ?? signal.platformApplicationId
    ?? signal.platformTargetCollaborationId
    ?? signal.platformFulfillmentId
    ?? signal.creatorRelationshipId
    ?? signal.collaborationRecordId
    ?? signal.orderId
    ?? signal.notificationId
    ?? "unknown";
  return `affiliate:${platform}:signal:${signal.type}:${stableId}:${signal.eventTime}`;
}

interface AffiliatePredictionDispatchContext {
  predictionSection?: string;
  predictionCacheIds?: readonly string[];
}

interface AffiliateDecisionThresholdDispatchContext {
  decisionThresholds?: GQL.AffiliateDecisionThresholds | null;
  decisionThresholdSource?: string | null;
}

function hasConfiguredDecisionThreshold(
  thresholds: GQL.AffiliateDecisionThresholds | null | undefined,
): thresholds is GQL.AffiliateDecisionThresholds {
  return typeof thresholds?.minExpectedSalesUnits === "number";
}

function selectExpectedSalesPredictionScenario(
  workItem: GQL.AffiliateWorkItem,
): GQL.AffiliateExpectedSalesPredictionScenario | null {
  if (isCreatorReplyWorkItem(workItem) || isCreatorFollowUpWorkItem(workItem)) {
    return GQL.AffiliateExpectedSalesPredictionScenario.TargetCollaborationPlanning;
  }
  if (isSampleReviewWorkItem(workItem)) return GQL.AffiliateExpectedSalesPredictionScenario.SampleReview;
  return null;
}

function isCreatorReplyWorkItem(workItem: GQL.AffiliateWorkItem): boolean {
  return (
    workItem.requiredAction === GQL.AffiliateRelationshipRequiredAction.ReplyToCreator ||
    workItem.workKind === GQL.AffiliateWorkKind.InboundMessageTriage
  );
}

function workItemCurrentMessageId(workItem: GQL.AffiliateWorkItem): string | null {
  return workItem.collaboration?.lastCreatorMessageId ?? null;
}

function workItemSubjectLabel(workItem: GQL.AffiliateWorkItem): string {
  const relationshipLabel = `relationship=${workItem.creatorRelationshipId ?? ""}`;
  return workItem.collaborationRecordId
    ? `${relationshipLabel} collaboration=${workItem.collaborationRecordId}`
    : relationshipLabel;
}

function workItemBoundaryAt(workItem: GQL.AffiliateWorkItem | null | undefined): string | null {
  if (!workItem) return null;
  return (
    workItem.versionAt ??
    workItem.collaboration?.lastSignalAt ??
    workItem.creatorRelationship?.stateUpdatedAt ??
    workItem.creatorRelationship?.lastInboundAt ??
    null
  );
}

function workItemHandledUntil(workItem: GQL.AffiliateWorkItem | null | undefined): string | null {
  if (!workItem) return null;
  if (workItem.creatorRelationship != null) {
    return workItem.creatorRelationship.lastAgentHandledAt ?? null;
  }
  return workItem.collaboration?.workHandledUntil ?? null;
}

function isSampleReviewWorkItem(workItem: GQL.AffiliateWorkItem): boolean {
  return (
    workItem.workKind === GQL.AffiliateWorkKind.SampleApplicationDecision ||
    (
      workItem.requiredAction === GQL.AffiliateRelationshipRequiredAction.CompleteCollaborationTask &&
      workItem.processReasons?.includes(GQL.AffiliateCollaborationRecordProcessReason.SamplePendingReview) === true
    )
  );
}

function isCreatorFollowUpWorkItem(workItem: GQL.AffiliateWorkItem): boolean {
  return (
    workItem.requiredAction === GQL.AffiliateRelationshipRequiredAction.FollowUpCreator ||
    workItem.requiredAction === GQL.AffiliateRelationshipRequiredAction.WaitCreatorResponse ||
    workItem.workKind === GQL.AffiliateWorkKind.ContentFollowUp ||
    workItem.workKind === GQL.AffiliateWorkKind.CreatorFollowUp
  );
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

function formatMaybeNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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

function isAffiliateMessageSignal(type: AffiliateRelationshipSignalPayload["type"]): boolean {
  return type === "AFFILIATE_RELATIONSHIP_MESSAGE_OBSERVED";
}

function signalCreatorRelationshipId(signal: AffiliateRelationshipSignalPayload): string | undefined {
  const value = signal.creatorRelationshipId;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function directSignalPreferredChannel(
  signal: AffiliateRelationshipSignalPayload,
): GQL.AffiliateMessageChannel | undefined {
  const channel = signal.channel;
  switch (channel) {
    case GQL.AffiliateMessageChannel.Email:
      return GQL.AffiliateMessageChannel.Email;
    case GQL.AffiliateMessageChannel.Whatsapp:
      return GQL.AffiliateMessageChannel.Whatsapp;
    case GQL.AffiliateMessageChannel.PlatformChat:
      return GQL.AffiliateMessageChannel.PlatformChat;
    default:
      return undefined;
  }
}

function sanitizeCreatorOutreachText(text: string): string {
  let cleaned = text.trim();
  if (!cleaned || cleaned === "NO_REPLY") return "";
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, " ");
  cleaned = cleaned.replace(/```[\s\S]*?```/g, " ");
  cleaned = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^\{[\s\S]*"(?:tool_uses|recipient_name|parameters|tool|arguments|name)"[\s\S]*\}$/.test(line)) {
        return false;
      }
      if (/^to=functions\.[\w.-]+/i.test(line)) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned === "NO_REPLY" ? "" : cleaned;
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

function normalizeCheckpointId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function renderWorkspaceSnapshot(workspace: GQL.AffiliateWorkspacePayload): string {
  const samples = workspace.sampleApplicationRecords ?? [];
  const collaborations = workspace.collaborationRecords ?? [];
  const proposals = workspace.actionProposals ?? [];
  const policies = workspace.approvalPolicies ?? [];
  const creatorRelations = workspace.creatorRelations ?? [];
  const creatorTags = workspace.creatorTags ?? [];

  const sampleLines = samples.length
    ? samples.map((sample, index) => [
      `${index + 1}. sampleApplicationRecordId: ${sample.id}`,
      `   platformApplicationId: ${sample.platformApplicationId}`,
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
      `   productId: ${collaboration.productId ?? ""}`,
      `   sampleApplicationRecordId: ${collaboration.sampleApplicationRecordId ?? ""}`,
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
    ].join("\n"))
    : ["(none)"];

  const policyLines = policies.length
    ? policies.map((policy, index) =>
      [
        `${index + 1}. ${policy.reason ?? policy.id} action=${policy.action} enabled=${policy.enabled}`,
        `   creatorTagIds: ${(policy.creatorTagIds ?? []).join(", ") || "(any)"}`,
        `   campaignIds: ${(policy.campaignIds ?? []).join(", ") || "(any)"}`,
        `   productIds: ${(policy.productIds ?? []).join(", ") || "(any)"}`,
      ].join("\n"),
    )
    : ["(none)"];

  const creatorTagLines = creatorTags.length
    ? creatorTags.map((tag, index) =>
      `${index + 1}. tagId: ${tag.id} name=${tag.name} type=${tag.type} systemKey=${tag.systemKey ?? ""} sensitive=${tag.sensitive}`,
    )
    : ["(none)"];

  const relationLines = creatorRelations.length
    ? creatorRelations.map((relation, index) => [
      `${index + 1}. creatorRelationshipId: ${relation.id}`,
      `   blocked: ${relation.blocked}`,
      `   blockedShopIds: ${(relation.blockedShopIds ?? []).join(", ") || "(none)"}`,
      `   shopStates: ${(relation.shopStates ?? []).length}`,
      ...(relation.shopStates ?? []).map((state) =>
        `     - shopId=${state.shopId} lifecycleStage=${state.lifecycleStage} tagIds=${state.tagIds.join(", ") || "(none)"}`,
      ),
    ].join("\n"))
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
    "## Creator Tags",
    ...creatorTagLines,
    "",
    "## Creator Relations",
    ...relationLines,
    "",
    "## Active Approval Policies",
    ...policyLines,
  ].join("\n");
}

type RelationshipHistoryMessageRow = {
  id: string;
  channel: GQL.AffiliateMessageChannel;
  direction?: GQL.AffiliateCreatorMessageDirection | null;
  text?: string | null;
  messageType?: string | null;
  deliveryStatus?: GQL.AffiliateDeliveryStatus | null;
  createdAt?: string | null;
  subject?: string | null;
  channelLabel?: string | null;
  shopId?: string | null;
  shopName?: string | null;
  accountLabel?: string | null;
};

function relationshipHistoryMessages(items: GQL.AffiliateRelationshipHistoryItem[]): RelationshipHistoryMessageRow[] {
  return items
    .filter((item) => item.message)
    .map((item) => ({
      id: item.id,
      channel: item.message!.channel,
      direction: item.message!.direction,
      text: item.message!.textPreview,
      messageType: item.message!.messageType,
      deliveryStatus: item.message!.deliveryStatus,
      createdAt: item.occurredAt,
      subject: item.message!.subject,
      channelLabel: item.message!.channelLabel,
      shopId: item.relatedIds.shopId,
      shopName: item.message!.shopName,
      accountLabel: item.message!.accountLabel,
    }));
}

function historyItemTimestamp(message: RelationshipHistoryMessageRow): number {
  const value = message.createdAt ? new Date(message.createdAt).getTime() : NaN;
  return Number.isFinite(value) ? value : 0;
}

function relationshipMessageText(message: Pick<RelationshipHistoryMessageRow, "text">): string {
  return message.text?.trim() ?? "";
}

function resolveRelationshipMessageSide(
  message: Pick<RelationshipHistoryMessageRow, "direction">,
): "CREATOR" | "SELLER_OR_SYSTEM" | "UNKNOWN" {
  if (message.direction === GQL.AffiliateCreatorMessageDirection.Creator) return "CREATOR";
  if (
    message.direction === GQL.AffiliateCreatorMessageDirection.Seller
    || message.direction === GQL.AffiliateCreatorMessageDirection.System
  ) {
    return "SELLER_OR_SYSTEM";
  }
  return "UNKNOWN";
}

function deriveRelationshipMessageSemanticHints(messages: RelationshipHistoryMessageRow[]): string[] {
  const latestCreatorMessage = [...messages]
    .reverse()
    .find((message) => resolveRelationshipMessageSide(message) === "CREATOR");
  if (!latestCreatorMessage) return [];

  const latestCreatorText = relationshipMessageText(latestCreatorMessage).trim();
  if (!looksLikeOpaqueAdCodeToken(latestCreatorText)) return [];

  const previousSellerAskedForAdCode = messages.some((message) => {
    if (message.id === latestCreatorMessage.id) return false;
    if (resolveRelationshipMessageSide(message) !== "SELLER_OR_SYSTEM") return false;
    return mentionsAdAuthorizationCode(relationshipMessageText(message));
  });

  if (!previousSellerAskedForAdCode) return [];

  return [
    "- The latest creator message is token-shaped and an earlier seller-side message asked for an ad code / ad authorization code.",
    "- Treat the latest creator message as a likely ad authorization code, not as unreadable text. Do not ask the creator to resend only because it is not natural language.",
    "- If there is no dedicated ad-code validation or ads handoff tool available, propose acknowledging receipt and routing it to the marketing/ads workflow.",
  ];
}

function deriveRelationshipMessageCardHints(messages: RelationshipHistoryMessageRow[]): string[] {
  const hints: string[] = [];
  const seen = new Set<string>();

  for (const message of messages) {
    if (resolveRelationshipMessageSide(message) !== "CREATOR") continue;

    const ids = extractAffiliateMessageReferenceIds(message.text ?? "");
    if (
      ids.productIds.length === 0
      && ids.sampleApplicationIds.length === 0
      && ids.collaborationIds.length === 0
    ) {
      continue;
    }

    const parts: string[] = [];
    if (ids.productIds.length > 0) {
      parts.push(`candidate productId(s): ${ids.productIds.join(", ")}`);
    }
    if (ids.sampleApplicationIds.length > 0) {
      parts.push(`sample/application id(s): ${ids.sampleApplicationIds.join(", ")}`);
    }
    if (ids.collaborationIds.length > 0) {
      parts.push(`target/platform collaboration id(s): ${ids.collaborationIds.join(", ")}`);
    }

    const key = `${message.createdAt ?? ""}:${relationshipMessageText(message)}:${parts.join("|")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hints.push(`- A creator-side message contains ${parts.join("; ")}.`);
  }

  if (hints.length === 0) return [];

  return [
    ...hints,
    "- Treat these IDs as candidate evidence extracted from creator-side message cards, not as confirmed collaboration product context.",
    "- If a candidate productId is relevant to the decision, call affiliate_predict_creator_product_fit with creatorRelationshipId, shopId, and productId before recommending cooperation, target collaboration creation, or a creator-facing reply about whether to proceed.",
    "- If a sample/application id is relevant, use affiliate_get_workspace with creatorRelationshipId plus the sample/application identity to verify the current sample state before replying about approval, rejection, or shipment.",
    "- If multiple candidate products appear and Backend Work Context has not confirmed one, compare the relevant candidates or ask the creator a clarifying question instead of silently choosing one.",
  ];
}

function extractAffiliateMessageReferenceIds(content: string): {
  productIds: string[];
  sampleApplicationIds: string[];
  collaborationIds: string[];
} {
  const result = {
    productIds: new Set<string>(),
    sampleApplicationIds: new Set<string>(),
    collaborationIds: new Set<string>(),
  };

  const parsed = parseMaybeJson(content);
  if (parsed != null) {
    collectAffiliateReferenceIds(parsed, result);
  }

  collectAffiliateReferenceIdsFromText(content, result);

  return {
    productIds: [...result.productIds],
    sampleApplicationIds: [...result.sampleApplicationIds],
    collaborationIds: [...result.collaborationIds],
  };
}

function parseMaybeJson(content: string): unknown | null {
  const trimmed = content.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function collectAffiliateReferenceIds(
  value: unknown,
  result: {
    productIds: Set<string>;
    sampleApplicationIds: Set<string>;
    collaborationIds: Set<string>;
  },
  parentKey = "",
  depth = 0,
): void {
  if (depth > 8 || value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) {
      collectAffiliateReferenceIds(item, result, parentKey, depth + 1);
    }
    return;
  }
  if (typeof value !== "object") {
    if (typeof value === "string") {
      addAffiliateReferenceId(parentKey, value, result);
    }
    return;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = normalizeReferenceKey(key);
    if (typeof nested === "string" || typeof nested === "number") {
      addAffiliateReferenceId(normalizedKey, String(nested), result);
    }
    collectAffiliateReferenceIds(nested, result, normalizedKey, depth + 1);
  }
}

function collectAffiliateReferenceIdsFromText(
  content: string,
  result: {
    productIds: Set<string>;
    sampleApplicationIds: Set<string>;
    collaborationIds: Set<string>;
  },
): void {
  const patterns: Array<[RegExp, keyof typeof result]> = [
    [/\b(?:product_id|productId|platform_product_id|platformProductId)["'\s:=]+([0-9]{8,24})\b/gi, "productIds"],
    [/\b(?:apply_id|applyId|application_id|applicationId|sample_application_id|sampleApplicationId|platform_application_id|platformApplicationId)["'\s:=]+([0-9]{8,24})\b/gi, "sampleApplicationIds"],
    [/\b(?:target_collaboration_id|targetCollaborationId|collaboration_id|collaborationId|platform_collaboration_id|platformCollaborationId)["'\s:=]+([0-9]{8,24})\b/gi, "collaborationIds"],
  ];

  for (const [pattern, bucket] of patterns) {
    for (const match of content.matchAll(pattern)) {
      addNumericPlatformId(result[bucket], match[1]);
    }
  }
}

function addAffiliateReferenceId(
  normalizedKey: string,
  rawValue: string,
  result: {
    productIds: Set<string>;
    sampleApplicationIds: Set<string>;
    collaborationIds: Set<string>;
  },
): void {
  const value = rawValue.trim();
  if (!/^[0-9]{8,24}$/.test(value)) return;

  if (isProductReferenceKey(normalizedKey)) {
    addNumericPlatformId(result.productIds, value);
    return;
  }
  if (isSampleApplicationReferenceKey(normalizedKey)) {
    addNumericPlatformId(result.sampleApplicationIds, value);
    return;
  }
  if (isCollaborationReferenceKey(normalizedKey)) {
    addNumericPlatformId(result.collaborationIds, value);
  }
}

function addNumericPlatformId(target: Set<string>, value: string | undefined): void {
  if (!value || !/^[0-9]{8,24}$/.test(value)) return;
  target.add(value);
}

function normalizeReferenceKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isProductReferenceKey(key: string): boolean {
  return key.includes("productid") || key === "product";
}

function isSampleApplicationReferenceKey(key: string): boolean {
  return (key.includes("applicationid") && !key.includes("collaboration"))
    || key.includes("sampleapplicationid")
    || key === "applyid";
}

function isCollaborationReferenceKey(key: string): boolean {
  return key.includes("collaborationid") || key.includes("targetcollaborationid");
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
