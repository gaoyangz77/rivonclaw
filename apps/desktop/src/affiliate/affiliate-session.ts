import { randomUUID } from "node:crypto";
import { createLogger } from "@rivonclaw/logger";
import {
  GQL,
  ScopeType,
} from "@rivonclaw/core";
import { openClawConnector } from "../openclaw/index.js";
import { requestAgent } from "../gateway/agent-tooling-readiness.js";
import { rootStore } from "../app/store/desktop-store.js";
import { normalizePlatform } from "../utils/platform.js";
import { getAuthSession } from "../auth/session-ref.js";
import {
  AFFILIATE_CONTEXT_BUILDER_QUERY,
  AFFILIATE_CREATOR_MESSAGE_PREFLIGHT_QUERY,
  AFFILIATE_WORK_ITEMS_QUERY,
  RESOLVE_AFFILIATE_WORK_ITEM_MUTATION,
  type AffiliateContextBuilderQueryResult,
  type AffiliateCreatorMessagePreflightQueryResult,
  type AffiliateWorkItemsQueryResult,
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
const MISSING_SESSION_CHECKPOINT_PATTERN = /checkpoint not found/i;
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

  private buildExtraSystemPrompt(
    runMode: AffiliateAgentRunMode,
    businessDeveloperPrompt?: string | null,
  ): string {
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
      "- Domain Objects: CreatorRelationship is the seller-level creator relationship; product cards identify candidate shop products; target collaborations, sample applications, and collaboration records represent progressively more specific commercial commitments and fulfillment state.",
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
      "- Use affiliate_get_creator_contact_state to inspect current channel availability and affiliate_get_relationship_timeline for Provider-backed messages merged chronologically with immutable business and action events.",
      "- Treat provider route identifiers as transport provenance only. Do not use them as the CreatorRelationship boundary or as primary keys for affiliate tools.",
      "",
      "## Operating Model",
      "- Use backend affiliate tools as the source of truth for campaigns, creator lifecycle state, tags, approval policies, and action execution.",
      "- Every work-item run must end with exactly one affiliate_resolve_work_item call. A final text response alone never completes or sends a backend work item.",
      "- If a structured TikTok platform action is needed, such as reviewing a sample application or creating a target collaboration, use affiliate_resolve_work_item with decision REQUEST_ACTION and a typed platform action payload.",
      "- affiliate_resolve_work_item supports only three platform action types: SEND_MESSAGE, REVIEW_SAMPLE_APPLICATION, and CREATE_TARGET_COLLABORATION. Do not invent action types such as CHANGE_COMMISSION; use NEEDS_STAFF_REVIEW for unsupported seller operations.",
      "- Each REQUEST_ACTION action must populate the required payload matching its type: SEND_MESSAGE -> messageIntent.parts, REVIEW_SAMPLE_APPLICATION -> platformApplicationId + sampleReviewDecision, CREATE_TARGET_COLLABORATION -> targetCollaborationIntent.",
      "- For SEND_MESSAGE, action.messageIntent.parts must contain 1-10 ordered TEXT, staged ATTACHMENT, or platform-native card parts. Do not put creator-facing content only in operatorSummary.",
      "- Omit preferredChannel to reply on the trigger channel. Set it only for an intentional channel switch. For a proactive EMAIL without an existing thread, emailSubject is required.",
      "- Never pass provider message, conversation, thread, or account route identifiers; backend resolves exact routes from the work boundary and relationship.",
      "- After SEND_MESSAGE succeeds, enters approval, or returns a delivery failure, make the final assistant response exactly NO_REPLY.",
      "- For REVIEW_SAMPLE_APPLICATION, use action.platformApplicationId, action.sampleReviewDecision, and optional action.rejectReason. The backend re-reads TikTok before executing. Do not send sampleReviewIntent: {}.",
      "- Omit optional fields when unknown. Never send empty strings for Date, ID, or object fields. nextSellerActionAt is only for DEFERRED decisions and must be a valid ISO timestamp.",
      "- If no platform action is needed, use affiliate_resolve_work_item with decision NO_ACTION_NEEDED, NEEDS_STAFF_REVIEW, or DEFERRED.",
      "- If affiliate_resolve_work_item returns a proposal requiring approval, stop there and make your final assistant response exactly NO_REPLY; do not try to bypass approval.",
      `- Write every operatorSummary and staff-facing explanation in ${this.shop.staffLanguage ?? "English"}.`,
      "- If the merchant explicitly approves, rejects, or asks to revise a pending proposal in this Codex thread, use affiliate_decide_proposal. For revision requests, set status REVISION_REQUESTED and put the merchant's requested changes in decision.note.",
      "- Do not rely on memory for creator history or policy. Ask tools for state when needed.",
      "- Never put a platform sample application ID into campaignId. For sample events, use platformApplicationId.",
      "",
      "## Workflow Discipline",
      "- A dispatch carries only the current Agent Working Agenda. It is a wake-up reason, not a business-fact snapshot.",
      "- affiliate_get_creator_relationship reads current Relationship, Creator profile, and assigned BD state. It never returns proposals. A staff-requested proposal revision is included directly in the Agent Working Agenda that caused that run.",
      "- For every creator reply work item, first call affiliate_get_relationship_timeline with creatorRelationshipId to read the Provider-backed messages and nearby relationship events before drafting or sending. Do not rely on the content-free lifecycle projection or memory for message text.",
      "- Timeline attachmentRef values are short-lived and relationship-bound. affiliate_read_message_attachment reads supported content, affiliate_copy_message_attachment stages exact Provider bytes, and affiliate_upload_draft_attachment stages a locally generated file.",
      "- Never place URLs, provider ids, object keys, base64, or raw HTML in SEND_MESSAGE parts. Unsupported inbound attachment types are transferred to staff by desktop preflight before an Agent run.",
      "- Use affiliate_get_relationship_timeline for relationship-level messages, business transitions, and terminal staff/agent outcomes. Historical messages record what a participant expressed at occurredAt; mutable Provider state may have changed since then. TIME_PASSED makes elapsed time salient but does not declare evidence invalid. Decide whether a specific current-state read is useful for the task. affiliate_list_creator_collaborations and affiliate_list_creator_sample_applications are separate exhaustive Provider reads; complete=true with an empty items array is authoritative absence for that specific list operation.",
      "- ecom_get_product resolves a known product; ecom_search_products searches the current shop catalog. affiliate_predict_creator_product_fit returns optional decision evidence. None of these read tools creates a collaboration commitment.",
      "- Use operatorSummary for staff-facing summaries. Keep it short: current fact, recommended/attempted action, proposal id if approval is required.",
      `- operatorSummary language: ${this.shop.staffLanguage ?? "English"}. Creator-facing messages should use the creator's language instead.`,
      "",
      "## On-demand Affiliate Reads",
      "- The latest internal user turn contains only the current Agent Working Agenda: the reasons this run was dispatched.",
      "- Do not infer Creator history, collaboration history, product facts, sample state, performance, contact routes, or proposal state from the agenda. Query the relevant tools when those facts matter to your decision.",
      "- affiliate_get_relationship_timeline reads a single occurredAt-ordered timeline. It returns all item types by default; itemTypes can select MESSAGE, BUSINESS_EVENT, and ACTION_EVENT, including MESSAGE alone when only communication is relevant.",
      "- affiliate_list_creator_collaborations exhausts seller-visible TikTok target collaborations for the current Creator. affiliate_list_creator_sample_applications separately exhausts sample applications; request fulfillments only when content or fulfillment details matter.",
      "- affiliate_get_creator_relationship, affiliate_get_collaboration, and affiliate_get_sample_application read narrowly scoped current Mongo state. Pending proposals belong to the staff approval surface and are not Agent context. ecom_get_product/ecom_search_products read current product facts. ecom_get_bi_catalog/ecom_get_bi_data read warehouse-backed historical performance and affiliate orders.",
      "- Tool results, not the wake-up agenda, establish business facts. A timeline is historical evidence, not a current entity snapshot. Respect occurredAt, TIME_PASSED, source, observation time, pagination, and coverage indicators when deciding whether to query a specific current-state tool.",
      "",
      "## Merchant Affiliate Instructions",
      this.shop.businessPrompt?.trim() || "(none configured)",
      "",
      "## Assigned Business Developer Instructions",
      businessDeveloperPrompt?.trim() || "(none configured)",
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

    let generation: number | undefined;
    if (isCreatorReplyWorkItem(workItem) && !hasProposalRevisionAgenda(workItem)) {
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
      if (generation !== this.dispatchGeneration) return { runId: undefined };
    }

    const request = buildAffiliateAgentRunRequest({
      workItem,
      platform: this.platform,
    });
    if (!request) return { runId: undefined };

    const result = await this.dispatch({
      ...request,
      runMode: AffiliateAgentRunMode.OPERATOR_REASONING,
      baseCheckpointId,
      baseEventCursor,
      handledSignalAt: workItemBoundaryAt(workItem),
      targetEventCursor: dispatchContext.checkpoint.targetEventCursor,
      relationshipOperationalConfigRevision:
        dispatchContext.checkpoint.relationshipOperationalConfigRevision,
      businessDeveloperIdSnapshot: dispatchContext.checkpoint.businessDeveloperIdSnapshot ?? null,
      businessDeveloperConfigRevision:
        dispatchContext.checkpoint.businessDeveloperConfigRevision ?? null,
      businessDeveloperPrompt: dispatchContext.checkpoint.businessDeveloper?.businessPrompt ?? null,
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
    handledSignalAt?: string | null;
    targetEventCursor?: number | null;
    relationshipOperationalConfigRevision?: number;
    businessDeveloperIdSnapshot?: string | null;
    businessDeveloperConfigRevision?: number | null;
    businessDeveloperPrompt?: string | null;
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
      handledSignalAt: params.handledSignalAt ?? null,
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
        extraSystemPrompt: this.buildExtraSystemPrompt(runMode, params.businessDeveloperPrompt),
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
        handledSignalAt: params.handledSignalAt ?? null,
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
    businessDeveloperPrompt?: string | null;
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
        `systemPromptChars=${this.buildExtraSystemPrompt(params.runMode ?? AffiliateAgentRunMode.OPERATOR_REASONING, params.businessDeveloperPrompt).length}`,
        "promptContextVersion=affiliate-working-agenda-v1",
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
      this.buildExtraSystemPrompt(params.runMode ?? AffiliateAgentRunMode.OPERATOR_REASONING, params.businessDeveloperPrompt),
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
      try {
        await openClawConnector.request("sessions.compaction.restore", {
          key: this.scopeKey,
          checkpointId: baseCheckpointId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!MISSING_SESSION_CHECKPOINT_PATTERN.test(message)) throw error;
        log.warn(
          `Affiliate committed checkpoint is unavailable locally; resetting the session before dispatch: scope=${this.scopeKey} checkpointId=${baseCheckpointId}`,
        );
        await openClawConnector.request("sessions.reset", {
          key: this.scopeKey,
          reason: "new",
        });
      }
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
    const authSession = getAuthSession();
    if (!authSession) {
      return { checkpointId: null, eventCursor: 0 };
    }
    const result = await authSession.graphqlFetch<AffiliateWorkItemsQueryResult>(
      AFFILIATE_WORK_ITEMS_QUERY,
      {
        input: {
          shopId: this.affiliateContext.shopId,
          creatorRelationshipId: this.affiliateContext.creatorRelationshipId,
          limit: 1,
        },
      },
    );
    const relationship = result.affiliateWorkItems[0]?.creatorRelationship;
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
            limit: 1,
            includeWorkspace: false,
            includeEventDelta: false,
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
      };
    } catch (err) {
      log.error(
        `Failed to build checkpoint-bound affiliate context for ${workItemSubjectLabel(input.workItem)}:`,
        err,
      );
      return null;
    }
  }

}

function isCreatorReplyWorkItem(workItem: GQL.AffiliateWorkItem): boolean {
  return (
    workItem.requiredAction === GQL.AffiliateRelationshipRequiredAction.ReplyToCreator ||
    workItem.workKind === GQL.AffiliateWorkKind.InboundMessageTriage
  );
}

function hasProposalRevisionAgenda(workItem: GQL.AffiliateWorkItem): boolean {
  return (workItem.agentWorkingAgendaItems ?? []).some((item) => (
    item.revisionRequestedProposal?.status === GQL.ActionProposalStatus.RevisionRequested
  ));
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

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeCheckpointId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
