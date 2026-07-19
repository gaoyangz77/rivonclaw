import { randomUUID } from "node:crypto";
import { createLogger } from "@rivonclaw/logger";
import {
  GQL,
  ScopeType,
  type AffiliateOrderAttributedFrame,
  type AffiliateSampleApplicationUpdatedFrame,
  type AffiliateTargetCollaborationUpdatedFrame,
} from "@rivonclaw/core";
import { openClawConnector } from "../openclaw/index.js";
import { requestAgent } from "../gateway/agent-tooling-readiness.js";
import { rootStore } from "../app/store/desktop-store.js";
import { normalizePlatform } from "../utils/platform.js";
import { getAuthSession } from "../auth/session-ref.js";
import {
  AFFILIATE_ACTION_PROPOSAL_DELTA_QUERY,
  AFFILIATE_CONTEXT_BUILDER_QUERY,
  AFFILIATE_CREATOR_MESSAGE_PREFLIGHT_QUERY,
  AFFILIATE_WORK_ITEMS_QUERY,
  AFFILIATE_WORKSPACE_QUERY,
  RESOLVE_AFFILIATE_WORK_ITEM_MUTATION,
  type AffiliateActionProposalDeltaQueryResult,
  type AffiliateContextBuilderQueryResult,
  type AffiliateCreatorMessagePreflightQueryResult,
  type AffiliateWorkItemsQueryResult,
  type AffiliateWorkspaceQueryResult,
  type ResolveAffiliateWorkItemMutationResult,
} from "../cloud/affiliate-queries.js";
import type { StaffLanguage } from "../i18n/locale.js";
import {
  buildAffiliateAgentRunRequest,
  summarizeCreatorSnapshotForPrompt,
} from "./affiliate-agent-run-factory.js";
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
/** TikTok Provider history rejects values above 20. Keep the pre-run safety gate portable. */
const AFFILIATE_CREATOR_MESSAGE_PREFLIGHT_LIMIT = 20;

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
  baseEventCursor: number;
  candidateCheckpointId: string;
  targetEventCursor: number;
  relationshipOperationalConfigRevision: number;
  businessDeveloperIdSnapshot: string | null;
  businessDeveloperConfigRevision: number | null;
}

interface AffiliateResolvedDispatchContext {
  checkpoint: GQL.AffiliateContextBuilderPayload;
  contactState: GQL.AffiliateCreatorContactStatePayload;
}

interface AffiliateCreatorMessagePreflightResult {
  safeForAgentRun: boolean;
  operatorSummary: string;
}

export enum AffiliateAgentRunMode {
  OPERATOR_REASONING = "OPERATOR_REASONING",
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
    return [
      "## Affiliate / Creator Management Agent",
      "",
      "You are operating an affiliate creator-management workflow for a TikTok Shop seller.",
      "This is an internal reasoning run. Final assistant text is never sent to the creator.",
      "",
      "## Active Run Mode",
      `- ${runMode}`,
      "- OPERATOR_REASONING: assistant output is internal/operator-facing and must not be auto-sent to a creator.",
      "- Put staff-facing detail in operatorSummary, then make the final assistant response exactly NO_REPLY after the required tool call.",
      "",
      "## Affiliate Business Context",
      `- Commerce Platform: ${this.platform}`,
      "- Commerce Program: TikTok Shop Affiliate for the current seller account.",
      "- Commercial Relationship: the seller makes shop products available for creator promotion; creators may earn attributed commission, and some collaborations may include a product sample or a seller-created target collaboration.",
      "- Commerce Content Surfaces: TikTok shoppable video, TikTok LIVE, and the creator's TikTok Shop showcase.",
      "- Commercial Outcomes: attributed product content, orders, units sold, and GMV recorded through TikTok Shop Affiliate.",
      "- Communication Transports: TikTok Shop platform chat, WhatsApp, and Outlook email carry seller-creator messages; they are contact routes for the same TikTok Shop Affiliate relationship.",
      "- Workspace Objects: CreatorRelationship is the seller-level creator relationship; product cards identify candidate shop products; target collaborations, sample applications, and collaboration records represent progressively more specific commercial commitments and fulfillment state.",
      "- Identity Semantics: an inbound message is bound to a CreatorRelationship and its matched TikTok creator identity. That establishes who the sender is; the message content itself establishes the sender's current business intent.",
      "",
      "## Channel Model",
      "- WhatsApp and Outlook email are direct affiliate outreach channels for non-China TikTok Shop creator communication.",
      "- Reply on the latest inbound channel by default. preferredChannel requests an intentional channel override and remains subject to backend route validation.",
      "- Never send a second outbound Affiliate message before the creator has responded to the previous outbound turn. This safety boundary is cross-channel; do not switch channels to bypass it.",
      "- Proactive outreach with no inbound channel uses backend selection order WhatsApp, then Outlook email, then TikTok Shop platform chat.",
      "- A selected channel never falls back to another channel when unavailable or when sending fails.",
      "- Keep context at the seller-creator relationship level: WhatsApp, Outlook email, and platform chat are different channels for the same relationship, not separate memories.",
      "- affiliate_set_creator_whatsapp and affiliate_set_creator_email update Creator-owned contact records; affiliate_check_creator_whatsapp validates a Creator WhatsApp number when needed.",
      "- Use affiliate_get_creator_contact_state to inspect current channel availability and affiliate_get_relationship_history for immutable relationship-level events across platform chat, WhatsApp, email, delivery attempts, proposal decisions, sample milestones, and lifecycle events. Use affiliate_get_workspace for current collaboration/sample/proposal state.",
      "- Treat provider route identifiers as transport provenance only. Do not use them as the workspace boundary or as primary keys for affiliate tools.",
      "",
      "## Operating Model",
      "- Use backend affiliate tools as the source of truth for campaigns, creator lifecycle state, tags, approval policies, and action execution.",
      "- Every work-item run must end with exactly one affiliate_resolve_work_item call. A final text response alone never completes or sends a backend work item.",
      "- If a structured TikTok platform action is needed, such as reviewing a sample application or creating a target collaboration, use affiliate_resolve_work_item with decision REQUEST_ACTION and a typed platform action payload.",
      "- affiliate_resolve_work_item supports only three platform action types: SEND_MESSAGE, REVIEW_SAMPLE_APPLICATION, and CREATE_TARGET_COLLABORATION. Do not invent action types such as CHANGE_COMMISSION; use NEEDS_STAFF_REVIEW for unsupported seller operations.",
      "- Each REQUEST_ACTION action must populate the required payload matching its type: SEND_MESSAGE -> messageIntent.parts, REVIEW_SAMPLE_APPLICATION -> sampleApplicationRecordId + platformApplicationId + sampleReviewDecision, CREATE_TARGET_COLLABORATION -> targetCollaborationIntent.",
      "- For SEND_MESSAGE, action.messageIntent.parts must contain 1-10 ordered TEXT, staged ATTACHMENT, or platform-native card parts. Do not put creator-facing content only in operatorSummary.",
      "- Omit preferredChannel to reply on the trigger channel. Set it only for an intentional channel switch. For a proactive EMAIL without an existing thread, emailSubject is required.",
      "- Never pass provider message, conversation, thread, or account route identifiers; backend resolves exact routes from the work boundary and relationship.",
      "- After SEND_MESSAGE succeeds, enters approval, or returns a delivery failure, make the final assistant response exactly NO_REPLY.",
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
      "- affiliate_get_workspace provides current relationship, sample, product-reference, policy, and proposal state when you need more than the injected snapshot.",
      "- For every creator reply work item, first call affiliate_get_relationship_history with creatorRelationshipId to read the Provider-backed message history before drafting or sending. Do not rely on the content-free lifecycle projection or memory for message text.",
      "- History attachmentRef values are short-lived and relationship-bound. affiliate_read_message_attachment reads supported content, affiliate_copy_message_attachment stages exact Provider bytes, and affiliate_upload_draft_attachment stages a locally generated file.",
      "- Never place URLs, provider ids, object keys, base64, or raw HTML in SEND_MESSAGE parts. Unsupported inbound attachment types are transferred to staff by desktop preflight before an Agent run.",
      "- Use affiliate_get_relationship_history for relationship-level audit events, previous proposal decisions, prior sample actions, creator communications, or past staff/agent outcomes. Do not use provider conversation routes as history keys. Use affiliate_get_workspace for current entity snapshots.",
      "- ecom_get_product resolves product details for a known shop/product reference. affiliate_predict_creator_product_fit returns optional decision evidence; neither tool creates a collaboration commitment.",
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

  async handleWorkItem(workItem: GQL.AffiliateWorkItem): Promise<AffiliateDispatchResult> {
    if (!workItem.agentDispatchRecommended) {
      log.info(`Affiliate work item ${workItem.id} does not recommend agent dispatch; skipping`);
      return { runId: undefined };
    }

    const baseCheckpointId = normalizeCheckpointId(workItem.creatorRelationship?.committedCheckpointId);
    const baseEventCursor = workItem.creatorRelationship?.committedEventCursor ?? 0;
    const dispatchContext = await this.fetchDispatchContext({
      workItem,
      baseCheckpointId,
      baseEventCursor,
    });
    if (!dispatchContext) return { runId: undefined };

    let relationshipMessageUpdate = renderAffiliateDispatchContext(
      dispatchContext.checkpoint,
      dispatchContext.contactState,
    );
    let generation: number | undefined;
    if (isCreatorReplyWorkItem(workItem)) {
      generation = this.beginCreatorMessageTakeover();
      const preflight = await this.preflightCreatorMessage(workItem);
      if (!preflight.safeForAgentRun) {
        await this.transferCreatorMessageToStaffBeforeRun({
          workItem,
          dispatchContext,
          operatorSummary: preflight.operatorSummary,
        });
        return { runId: undefined };
      }
      const messageUpdate = this.buildRelationshipMessageUpdateWorkPackage({
        currentSignalId: workItem.triggerLifecycleEventId ?? workItemCurrentMessageId(workItem) ?? undefined,
        currentChannel: workItem.triggerChannel ?? undefined,
        eventTime: workItem.collaboration?.lastCreatorMessageAt ?? workItem.creatorRelationship?.lastInboundAt ?? undefined,
      });
      relationshipMessageUpdate = [relationshipMessageUpdate, messageUpdate].join("\n\n");
      if (generation !== this.dispatchGeneration) return { runId: undefined };
    }

    const predictionContext = await this.resolvePredictionDispatchContext(workItem);
    const thresholdContext = await this.resolveDecisionThresholdDispatchContext(workItem);
    const request = buildAffiliateAgentRunRequest({
      workItem,
      platform: this.platform,
      relationshipMessageUpdate,
      proposalDeltaSection: "## Proposal Delta\nIncluded in the checkpoint-bound operational event delta above.",
      ...predictionContext,
      ...thresholdContext,
      businessPrompt: this.shop.businessPrompt,
      staffLanguage: this.shop.staffLanguage,
    });
    if (!request) return { runId: undefined };

    const result = await this.dispatch({
      ...request,
      runMode: AffiliateAgentRunMode.OPERATOR_REASONING,
      baseCheckpointId,
      baseEventCursor,
      targetEventCursor: dispatchContext.checkpoint.targetEventCursor,
      relationshipOperationalConfigRevision:
        dispatchContext.checkpoint.relationshipOperationalConfigRevision,
      businessDeveloperIdSnapshot: dispatchContext.checkpoint.businessDeveloperIdSnapshot ?? null,
      businessDeveloperConfigRevision:
        dispatchContext.checkpoint.businessDeveloperConfigRevision ?? null,
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

    return false;
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

  private async setup(): Promise<void> {
    if (this.gatewaySetupReady) return;

    const runProfileId = this.shop.runProfileId ?? DEFAULT_AFFILIATE_RUN_PROFILE_ID;
    rootStore.toolCapability.setSessionRunProfile(this.scopeKey, runProfileId);
    await openClawConnector.request("tool_register_session", {
      sessionKey: this.scopeKey,
      toolContext: {
        kind: "AFFILIATE",
        shopId: this.shop.objectId,
        creatorRelationshipId: this.affiliateContext.creatorRelationshipId,
      },
    });

    this.gatewaySetupReady = true;
  }

  private resolveCurrentSessionModel(): { provider: string; model: string } {
    return rootStore.llmManager.resolveModelForDispatch(this.scopeKey, {
      type: ScopeType.AFFILIATE_SESSION,
      shopId: this.shop.objectId,
    });
  }

  private async dispatch(params: {
    message: string;
    idempotencyKey: string;
    abortActive?: boolean;
    runMode?: AffiliateAgentRunMode;
    baseCheckpointId?: string | null;
    baseEventCursor?: number | null;
    targetEventCursor?: number | null;
    relationshipOperationalConfigRevision?: number;
    businessDeveloperIdSnapshot?: string | null;
    businessDeveloperConfigRevision?: number | null;
  }): Promise<AffiliateDispatchResult> {
    if (params.abortActive !== false) this.abortActiveRun();
    const runMode = params.runMode ?? AffiliateAgentRunMode.OPERATOR_REASONING;
    await this.setup();
    const checkpoint = await this.prepareRunCheckpoint({
      baseCheckpointId: params.baseCheckpointId,
      baseEventCursor: params.baseEventCursor,
      targetEventCursor: params.targetEventCursor,
      relationshipOperationalConfigRevision: params.relationshipOperationalConfigRevision,
      businessDeveloperIdSnapshot: params.businessDeveloperIdSnapshot,
      businessDeveloperConfigRevision: params.businessDeveloperConfigRevision,
    });
    const resolvedModel = this.resolveCurrentSessionModel();
    this.logDispatchPromptContext(params);
    const provisionalRunId = params.idempotencyKey;
    registerActiveAffiliateRunCheckpoint({
      creatorRelationshipId: this.affiliateContext.creatorRelationshipId,
      sessionKey: this.scopeKey,
      runId: provisionalRunId,
      baseCheckpointId: checkpoint.baseCheckpointId,
      baseEventCursor: checkpoint.baseEventCursor,
      candidateCheckpointId: checkpoint.candidateCheckpointId,
      targetEventCursor: checkpoint.targetEventCursor,
      relationshipOperationalConfigRevision: checkpoint.relationshipOperationalConfigRevision,
      businessDeveloperIdSnapshot: checkpoint.businessDeveloperIdSnapshot,
      businessDeveloperConfigRevision: checkpoint.businessDeveloperConfigRevision,
    });

    let response: AffiliateDispatchResult | undefined;
    try {
      response = await requestAgent<AffiliateDispatchResult>({
        sessionKey: this.scopeKey,
        provider: resolvedModel.provider,
        model: resolvedModel.model,
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
        baseEventCursor: checkpoint.baseEventCursor,
        candidateCheckpointId: checkpoint.candidateCheckpointId,
        targetEventCursor: checkpoint.targetEventCursor,
        relationshipOperationalConfigRevision: checkpoint.relationshipOperationalConfigRevision,
        businessDeveloperIdSnapshot: checkpoint.businessDeveloperIdSnapshot,
        businessDeveloperConfigRevision: checkpoint.businessDeveloperConfigRevision,
      });
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
        "promptContextVersion=affiliate-provenance-v3",
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
    requested: {
      baseCheckpointId?: string | null;
      baseEventCursor?: number | null;
      targetEventCursor?: number | null;
      relationshipOperationalConfigRevision?: number;
      businessDeveloperIdSnapshot?: string | null;
      businessDeveloperConfigRevision?: number | null;
    },
  ): Promise<AffiliateRunCheckpoint> {
    const committed =
      requested.baseCheckpointId === undefined || requested.baseEventCursor === undefined
        ? await this.resolveRelationshipCommittedCheckpoint()
        : null;
    const baseCheckpointId = requested.baseCheckpointId === undefined
      ? committed?.checkpointId ?? null
      : normalizeCheckpointId(requested.baseCheckpointId);
    const baseEventCursor = requested.baseEventCursor ?? committed?.eventCursor ?? 0;
    const targetEventCursor = requested.targetEventCursor ?? baseEventCursor;
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
        baseEventCursor,
        candidateCheckpointId,
        targetEventCursor,
      },
    });

    return {
      baseCheckpointId,
      baseEventCursor,
      candidateCheckpointId,
      targetEventCursor,
      relationshipOperationalConfigRevision: requested.relationshipOperationalConfigRevision ?? 1,
      businessDeveloperIdSnapshot: requested.businessDeveloperIdSnapshot ?? null,
      businessDeveloperConfigRevision: requested.businessDeveloperConfigRevision ?? null,
    };
  }

  private async finalizeSuccessfulRun(
    runId: string,
    workItem: GQL.AffiliateWorkItem | undefined,
  ): Promise<void> {
    try {
      await this.createCandidateCheckpoint(runId);
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

  private async resolveRelationshipCommittedCheckpoint(): Promise<{
    checkpointId: string | null;
    eventCursor: number;
  }> {
    const workspace = await this.fetchWorkspace({
      includePolicies: false,
      limit: 1,
    });
    const relationship = workspace?.creatorRelations?.find(
      item => item.id === this.affiliateContext.creatorRelationshipId,
    );
    return {
      checkpointId: normalizeCheckpointId(relationship?.committedCheckpointId),
      eventCursor: relationship?.committedEventCursor ?? 0,
    };
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
            baseCheckpointId: this.runCheckpoints.get(runId)?.baseCheckpointId ?? null,
            baseEventCursor: this.runCheckpoints.get(runId)?.baseEventCursor ?? 0,
            candidateCheckpointId: this.runCheckpoints.get(runId)?.candidateCheckpointId,
            targetEventCursor: this.runCheckpoints.get(runId)?.targetEventCursor ?? 0,
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
    if (currentWorkItem == null) {
      return true;
    }
    const handledUntil = parseOptionalDate(workItemHandledUntil(currentWorkItem));
    return handledUntil != null && handledUntil.getTime() >= boundary.getTime();
  }

  private beginCreatorMessageTakeover(): number {
    this.dispatchGeneration += 1;
    this.abortActiveRun();
    return this.dispatchGeneration;
  }

  private async preflightCreatorMessage(
    workItem: GQL.AffiliateWorkItem,
  ): Promise<AffiliateCreatorMessagePreflightResult> {
    const authSession = getAuthSession();
    if (!authSession) {
      return {
        safeForAgentRun: false,
        operatorSummary: "Creator message was routed to staff before Agent run because no authenticated Provider-history session was available.",
      };
    }

    try {
      const result = await authSession.graphqlFetch<AffiliateCreatorMessagePreflightQueryResult>(
        AFFILIATE_CREATOR_MESSAGE_PREFLIGHT_QUERY,
        {
          input: {
            shopId: workItem.focusShopId,
            creatorRelationshipId: workItem.creatorRelationshipId,
            limit: AFFILIATE_CREATOR_MESSAGE_PREFLIGHT_LIMIT,
            ...(workItem.triggerChannel ? { channelFilter: [workItem.triggerChannel] } : {}),
          },
        },
      );
      const expectedInboundAt = parseOptionalDate(
        workItem.creatorRelationship?.lastInboundAt ?? workItem.collaboration?.lastCreatorMessageAt,
      );
      const currentMessage = result.affiliateCreatorMessageHistory.items.find((item) => {
        if (item.direction !== GQL.AffiliateCreatorMessageDirection.Creator) return false;
        const occurredAt = parseOptionalDate(item.createdAt);
        return expectedInboundAt == null || (
          occurredAt != null && occurredAt.getTime() >= expectedInboundAt.getTime() - 30_000
        );
      });
      if (!currentMessage || currentMessage.parts.length === 0) {
        return {
          safeForAgentRun: false,
          operatorSummary: "Creator message was routed to staff before Agent run because the current Provider-backed message could not be materialized safely.",
        };
      }

      const unsupported = currentMessage.parts.filter((part) => (
        part.kind === GQL.AffiliateHistoryPartKind.Unknown ||
        (part.kind === GQL.AffiliateHistoryPartKind.Attachment && part.agentReadable !== true)
      ));
      if (unsupported.length > 0) {
        const labels = unsupported.map((part) => (
          part.fileName ?? part.mimeType ?? part.providerType ?? part.summary ?? part.kind
        ));
        return {
          safeForAgentRun: false,
          operatorSummary: `Creator message was routed to staff before Agent run because it contains unsupported content: ${labels.join(", ")}.`,
        };
      }
      return {
        safeForAgentRun: true,
        operatorSummary: "Creator message parts passed the Agent-readable attachment preflight.",
      };
    } catch (error) {
      log.warn("Affiliate creator message preflight failed; routing work to staff before Agent run", error);
      return {
        safeForAgentRun: false,
        operatorSummary: "Creator message was routed to staff before Agent run because Provider-backed attachment preflight was unavailable.",
      };
    }
  }

  private async transferCreatorMessageToStaffBeforeRun(input: {
    workItem: GQL.AffiliateWorkItem;
    dispatchContext: AffiliateResolvedDispatchContext;
    operatorSummary: string;
  }): Promise<void> {
    const authSession = getAuthSession();
    if (!authSession) {
      throw new Error(`Cannot transfer unsupported Affiliate message to staff without an auth session: ${input.workItem.id}`);
    }
    try {
      const result = await authSession.graphqlFetch<ResolveAffiliateWorkItemMutationResult>(
        RESOLVE_AFFILIATE_WORK_ITEM_MUTATION,
        {
          input: {
            shopId: input.workItem.focusShopId,
            creatorRelationshipId: input.workItem.creatorRelationshipId,
            collaborationRecordId: input.workItem.collaborationRecordId ?? undefined,
            handledSignalAt: workItemBoundaryAt(input.workItem),
            baseCheckpointId: input.dispatchContext.checkpoint.baseCheckpointId,
            baseEventCursor: input.dispatchContext.checkpoint.baseEventCursor,
            targetEventCursor: input.dispatchContext.checkpoint.targetEventCursor,
            relationshipOperationalConfigRevision:
              input.dispatchContext.checkpoint.relationshipOperationalConfigRevision,
            businessDeveloperIdSnapshot:
              input.dispatchContext.checkpoint.businessDeveloperIdSnapshot,
            businessDeveloperConfigRevision:
              input.dispatchContext.checkpoint.businessDeveloperConfigRevision,
            decision: "NEEDS_STAFF_REVIEW",
            operatorSummary: input.operatorSummary,
          },
        },
      );
      log.info(
        `Affiliate creator message preflight resolved without Agent run: ` +
        `workItem=${input.workItem.id} stale=${result.resolveAffiliateWorkItem.stale}`,
      );
    } catch (error) {
      log.error(`Failed to transfer unsupported Affiliate message to staff: ${input.workItem.id}`, error);
      throw error;
    }
  }

  private buildRelationshipMessageUpdateWorkPackage(params: {
    currentSignalId?: string;
    currentChannel?: GQL.AffiliateMessageChannel;
    messageType?: string;
    senderRole?: string;
    eventTime?: string;
  }): string {
    return [
      "[Affiliate Creator Message Update]",
      `- Creator Relationship ID: ${this.affiliateContext.creatorRelationshipId}`,
      ...(params.currentChannel ? [`- Current Trigger Channel: ${params.currentChannel}`] : []),
      ...(params.currentSignalId ? [`- Current Signal ID: ${params.currentSignalId}`] : []),
      ...(params.senderRole ? [`- Current Sender Role: ${params.senderRole}`] : []),
      ...(params.messageType ? [`- Current Message Type: ${params.messageType}`] : []),
      ...(params.eventTime ? [`- Event Time: ${params.eventTime}`] : []),
      "",
      "## Task",
      "Message content is intentionally absent from this signal and is not mirrored in local storage.",
      "Call affiliate_get_relationship_history with this creatorRelationshipId before deciding or replying. Use the trigger channel as channel provenance, not as a workspace key.",
      "Read the provider-returned cross-channel context and handle the latest creator-side message. Do not use or request provider conversation/thread ids.",
      "If provider history is unavailable, do not guess from signal metadata and do not use a local-message fallback; call affiliate_resolve_work_item with NEEDS_STAFF_REVIEW, then output exactly NO_REPLY.",
      "If a reply is needed, call affiliate_resolve_work_item with REQUEST_ACTION, action.type SEND_MESSAGE, and ordered action.messageIntent.parts. A normal text reply uses [{kind: TEXT, text: <exact creator-facing reply>}].",
      "Omit preferredChannel to reply through the trigger channel. A supplied preferredChannel requests an intentional override and is validated by backend routing.",
      "After the structured action completes, is queued for approval, or fails delivery, output exactly NO_REPLY.",
    ].join("\n");
  }

  private async fetchDispatchContext(input: {
    workItem: GQL.AffiliateWorkItem;
    baseCheckpointId: string | null;
    baseEventCursor: number;
  }): Promise<AffiliateResolvedDispatchContext | null> {
    const authSession = getAuthSession();
    if (!authSession) {
      log.warn("No auth session available, cannot build affiliate dispatch context");
      return null;
    }
    try {
      const result = await authSession.graphqlFetch<AffiliateContextBuilderQueryResult>(
        AFFILIATE_CONTEXT_BUILDER_QUERY,
        {
          input: {
            shopId: input.workItem.focusShopId,
            creatorRelationshipId: input.workItem.creatorRelationshipId,
            baseCheckpointId: input.baseCheckpointId,
            baseEventCursor: input.baseEventCursor,
            limit: 1000,
          },
          contactInput: {
            shopId: input.workItem.focusShopId,
            creatorRelationshipId: input.workItem.creatorRelationshipId,
          },
        },
      );
      const context = result.affiliateContextBuilder;
      if (!context.baseMatchesCommitted) {
        log.warn(
          `Affiliate dispatch skipped because checkpoint/cursor base is stale: relationship=${input.workItem.creatorRelationshipId}`,
        );
        return null;
      }
      if (context.truncated) {
        log.error(
          `Affiliate dispatch skipped because event delta exceeds the safe context limit: relationship=${input.workItem.creatorRelationshipId}`,
        );
        return null;
      }
      return {
        checkpoint: context,
        contactState: result.affiliateCreatorContactState,
      };
    } catch (err) {
      log.error(
        `Failed to build checkpoint-bound affiliate context for ${workItemSubjectLabel(input.workItem)}:`,
        err,
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
        "- affiliate_predict_creator_product_fit is available as optional evidence. Its returned cacheId identifies the exact evidence snapshot used in a typed action; SAMPLE_REVIEW accepts the sample application ids when available.",
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
        `Use operatorSummary for staff-facing reasoning in ${this.shop.staffLanguage ?? "English"}. Creator-facing content belongs only in action.messageIntent.parts.`,
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

function renderAffiliateDispatchContext(
  context: GQL.AffiliateContextBuilderPayload,
  contactState: GQL.AffiliateCreatorContactStatePayload,
): string {
  const events = (context.events ?? []).map((event, index) => {
    const lifecycle = event.lifecycleEvent;
    const provenance = affiliateEventProvenance(event.actorRole ?? null);
    return [
      `${index + 1}. cursor=${lifecycle?.relationshipSequence ?? "?"} type=${lifecycle?.eventType ?? event.type}`,
      `   occurredAt=${event.occurredAt} actor=${event.actorRole ?? "UNKNOWN"} provenance=${provenance}`,
      `   summary=${event.summary}`,
      ...(lifecycle?.displayPayloadJson
        ? [`   payload=${lifecycle.displayPayloadJson}`]
        : []),
      `   refs=${JSON.stringify(event.relatedIds ?? {})}`,
    ].join("\n");
  });
  const workspace = context.workspace;
  const businessDeveloper = context.businessDeveloper;
  const currentSnapshot = {
    agendaItems: context.creatorRelationship.agendaItems ?? [],
    workSummary: context.creatorRelationship.workSummary ?? null,
    collaborations: workspace.collaborationRecords ?? [],
    sampleApplications: workspace.sampleApplicationRecords ?? [],
    pendingProposals: (workspace.actionProposals ?? []).filter(
      (proposal) => proposal.status === GQL.ActionProposalStatus.Pending,
    ),
    creatorProfiles: (workspace.creatorProfiles ?? []).map((creator) => ({
      id: creator.id,
      platform: creator.platform,
      creatorOpenId: creator.creatorOpenId ?? null,
      creatorImId: creator.creatorImId ?? null,
      username: creator.username ?? null,
      nickname: creator.nickname ?? null,
      followerCount: creator.followerCount ?? null,
      categoryIds: creator.categoryIds ?? [],
      marketplaceCommerceSummary: summarizeCreatorSnapshotForPrompt(
        creator.marketplaceSnapshotJson,
      ),
      aggregatedSignalsSummary: summarizeCreatorSnapshotForPrompt(
        creator.aggregatedSignalsSnapshotJson,
      ),
    })),
  };
  return [
    "[Affiliate Checkpoint-Bound Operational Context]",
    `Creator Relationship ID: ${context.creatorRelationship.id}`,
    `Base Checkpoint ID: ${context.baseCheckpointId ?? "(brand new session)"}`,
    `Base Event Cursor: ${context.baseEventCursor}`,
    `Target Event Cursor: ${context.targetEventCursor}`,
    `Relationship Operational Config Revision: ${context.relationshipOperationalConfigRevision}`,
    `Business Developer Snapshot: ${context.businessDeveloperIdSnapshot ?? "(no human BD assigned)"}`,
    `Business Developer Config Revision: ${context.businessDeveloperConfigRevision ?? "(none)"}`,
    "",
    "## Assigned Business Developer",
    ...(businessDeveloper
      ? [
          `- Name: ${businessDeveloper.displayName}`,
          `- Assistance Mode: ${businessDeveloper.agentAssistanceMode}`,
          `- Regions: ${(businessDeveloper.regions ?? []).join(", ") || "(all)"}`,
          `- Working Style: ${businessDeveloper.businessPrompt?.trim() || "(no additional instructions)"}`,
        ]
      : [
          "- Owner: no human BD assigned",
          "- Routing: apply merchant Affiliate instructions and AI routing rules to the current relationship facts.",
        ]),
    "",
    ...renderAssignedOutreachAccounts(context, contactState),
    "",
    "## Historical Operational Events Not Present In The Restored Checkpoint",
    "Provider observations are source events. AGENT and STAFF summaries are historical decisions or opinions, not current Provider/workspace facts.",
    ...(events.length ? events : ["(No new lifecycle events.)"]),
    "",
    "## Current Authoritative Workspace Snapshot",
    JSON.stringify(currentSnapshot, null, 2),
    "",
    "Use the event delta as the authoritative account of what changed after the restored checkpoint. Use the current snapshot for present facts. Resolve all simultaneously open agenda items that can be handled safely in one ordered action bundle.",
  ].join("\n");
}

function affiliateEventProvenance(
  actorRole: GQL.AffiliateLifecycleActorRole | null,
): "PROVIDER_OBSERVATION" | "HISTORICAL_AGENT_DECISION" | "HISTORICAL_STAFF_DECISION" | "SYSTEM_EVENT" {
  switch (actorRole) {
    case GQL.AffiliateLifecycleActorRole.Creator:
    case GQL.AffiliateLifecycleActorRole.Platform:
      return "PROVIDER_OBSERVATION";
    case GQL.AffiliateLifecycleActorRole.Agent:
      return "HISTORICAL_AGENT_DECISION";
    case GQL.AffiliateLifecycleActorRole.Staff:
      return "HISTORICAL_STAFF_DECISION";
    default:
      return "SYSTEM_EVENT";
  }
}

function renderAssignedOutreachAccounts(
  context: GQL.AffiliateContextBuilderPayload,
  contactState: GQL.AffiliateCreatorContactStatePayload,
): string[] {
  const businessDeveloperId = context.businessDeveloperIdSnapshot ?? null;
  if (!businessDeveloperId) {
    return [
      "## Direct Outreach Routing",
      "- No human BD is assigned to this Creator Relationship.",
      "- WhatsApp and Email are unavailable. Use TikTok Shop platform chat only.",
    ];
  }
  const whatsAppAccounts = (contactState.whatsAppAccounts ?? []).filter(
    (account) => account.businessDeveloperId === businessDeveloperId,
  );
  const emailAccounts = (contactState.emailAccounts ?? []).filter(
    (account) => account.businessDeveloperId === businessDeveloperId,
  );
  const preferredWhatsApp = contactState.preferredWhatsAppAccount?.businessDeveloperId === businessDeveloperId
    && whatsAppAccounts.some((account) => account.id === contactState.preferredWhatsAppAccount?.id)
    ? contactState.preferredWhatsAppAccount
    : null;
  const preferredEmail = contactState.preferredEmailAccount?.businessDeveloperId === businessDeveloperId
    && emailAccounts.some((account) => account.id === contactState.preferredEmailAccount?.id)
    ? contactState.preferredEmailAccount
    : null;
  const contacts = (contactState.channelContacts ?? []).filter(
    (contact) => contact.businessDeveloperId === businessDeveloperId,
  );
  const contactLines = contacts.map((contact) => {
    const address = contact.channel === GQL.AffiliateMessageChannel.Whatsapp
      ? contact.creatorPhone ?? "(Provider-only WhatsApp identity)"
      : contact.creatorEmail ?? "(unknown)";
    return `- Creator ${contact.channel}: ${contact.effectiveAlias?.trim() || address}; address=${address}; status=${contact.status}`;
  });

  return [
    "## Assigned BD Outreach Routing",
    "The preferred sender identities below are safe to disclose when following the BD's working instructions. Backend routing remains authoritative.",
    `- Default proactive channel: ${contactState.defaultOutboundChannel}`,
    `- Usable creator WhatsApp route: ${contactState.hasUsableWhatsAppContact ? "yes" : "no"}`,
    `- Usable creator email route: ${contactState.hasUsableEmailContact ? "yes" : "no"}`,
    preferredWhatsApp
      ? `- Preferred WhatsApp sender: ${preferredWhatsApp.displayName?.trim() || preferredWhatsApp.phoneNumber?.trim() || "(unnamed)"}; phone=${preferredWhatsApp.phoneNumber?.trim() || "(unknown)"}; status=${preferredWhatsApp.status}`
      : "- Preferred WhatsApp sender: (none)",
    `- Other assigned WhatsApp accounts: ${Math.max(whatsAppAccounts.length - (preferredWhatsApp ? 1 : 0), 0)}`,
    preferredEmail
      ? `- Preferred Email sender: ${preferredEmail.displayName?.trim() || preferredEmail.emailAddress}; address=${preferredEmail.sharedMailboxAddress?.trim() || preferredEmail.emailAddress}; mailboxType=${preferredEmail.mailboxType}; status=${preferredEmail.status}`
      : "- Preferred Email sender: (none)",
    `- Other assigned Email accounts: ${Math.max(emailAccounts.length - (preferredEmail ? 1 : 0), 0)}`,
    "### Effective Creator Contacts Under This BD",
    ...(contactLines.length ? contactLines : ["- (No direct-channel Creator contacts.)"]),
    "Do not choose or pass seller account IDs. Contact tools use the BD preferred account when it is usable, otherwise another usable account assigned to the same BD; SEND_MESSAGE uses the exact trigger contact for replies and the backend default resolver for proactive outreach.",
  ];
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
      `   messageParts=${renderProposalMessageParts(proposal.messageIntent)}`,
      proposal.sampleReviewIntent
        ? `   sampleReview=${proposal.sampleReviewIntent.decision} platformApplicationId=${proposal.sampleReviewIntent.platformApplicationId}`
        : "   sampleReview=(none)",
    ]),
    "",
    "Use this section only to understand draft actions that were already proposed, rejected, superseded, or executed after the last handled work boundary. Do not treat it as stable workspace state.",
  ].join("\n");
}

function renderProposalMessageParts(intent: GQL.ActionProposalMessageIntent | null | undefined): string {
  if (!intent?.parts?.length) return "(none or cleared)";
  return intent.parts.map((part, index) => {
    if (part.kind === "TEXT") return `${index}:TEXT:${part.text ?? `[cleared hash=${part.textHash ?? "n/a"}]`}`;
    if (part.kind === "ATTACHMENT") {
      return `${index}:ATTACHMENT:${part.fileName ?? "attachment"}:${part.mimeType ?? "unknown"}:${part.sizeBytes ?? "?"}`;
    }
    return `${index}:${part.kind}`;
  }).join(" | ");
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
        `     - shopId=${state.shopId} tagIds=${state.tagIds.join(", ") || "(none)"}`,
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
