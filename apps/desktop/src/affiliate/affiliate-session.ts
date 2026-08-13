import { randomUUID } from "node:crypto";
import { createLogger } from "@rivonclaw/logger";
import { GQL, ScopeType } from "@rivonclaw/core";
import { AFFILIATE_AGENT_ID } from "@rivonclaw/core/node";
import { openClawConnector } from "../openclaw/index.js";
import { requestAgent } from "../gateway/agent-tooling-readiness.js";
import { rootStore } from "../app/store/desktop-store.js";
import { normalizePlatform } from "../utils/platform.js";
import { getAuthSession } from "../auth/session-ref.js";
import {
  AFFILIATE_CONTEXT_BUILDER_QUERY,
  AFFILIATE_WORK_ITEMS_QUERY,
  type AffiliateContextBuilderQueryResult,
  type AffiliateWorkItemsQueryResult,
} from "../cloud/affiliate-queries.js";
import type { StaffLanguage } from "../i18n/locale.js";
import { buildAffiliateAgentRunRequest } from "./affiliate-agent-run-factory.js";
import {
  registerActiveAffiliateRunCheckpoint,
  unregisterActiveAffiliateRunCheckpoint,
} from "./affiliate-run-checkpoints.js";
import { buildAffiliateWorkflowSkillCatalog } from "./affiliate-workflow-skill.js";

const log = createLogger("affiliate-session");

export const DEFAULT_AFFILIATE_RUN_PROFILE_ID = "AFFILIATE_OPERATOR";
const DEBUG_AFFILIATE_PROMPT =
  process.env.DEBUG_AFFILIATE_PROMPT === "1" ||
  process.env.RIVONCLAW_DEBUG_AFFILIATE_PROMPT === "1";
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

function formatBusinessDeveloperContact(
  displayName: string | null | undefined,
  address: string,
): string {
  const label = displayName?.trim();
  return label ? `${label} — ${address}` : address;
}

export function buildBusinessDeveloperPromptSection(
  context: GQL.AffiliateBusinessDeveloperDispatchContext | null | undefined,
): string[] {
  if (!context) return [];
  return [
    "## Assigned Business Developer",
    `- Creator-facing name: ${context.creatorDisplayName}`,
    ...(context.whatsApp
      ? [
          `- WhatsApp: ${formatBusinessDeveloperContact(
            context.whatsApp.displayName,
            context.whatsApp.phoneNumber,
          )}`,
        ]
      : []),
    ...(context.email
      ? [
          `- Email: ${formatBusinessDeveloperContact(
            context.email.displayName,
            context.email.emailAddress,
          )}`,
        ]
      : []),
    "- The contact details above are the assigned Business Developer's Creator-shareable contact identities. Use them only when the conversation and Business Developer instructions call for moving or continuing the relationship on that channel.",
    "- Do not invent a WhatsApp number, email address, or unavailable channel.",
    ...(context.businessPrompt?.trim()
      ? ["", "### Business Developer Instructions", context.businessPrompt.trim()]
      : []),
    "",
    "## Business Instruction Precedence",
    "- The assigned Business Developer is the Relationship business owner. If its instructions conflict with the matching shop instructions, the Business Developer instructions override the shop instructions.",
    "- Business instructions never override system, platform, safety, authorization, or action-contract rules.",
  ];
}

export function redactBusinessDeveloperContactDetails(
  prompt: string,
  context: GQL.AffiliateBusinessDeveloperDispatchContext | null | undefined,
): string {
  let redacted = prompt;
  const values = [context?.whatsApp?.phoneNumber, context?.email?.emailAddress].filter(
    (value): value is string => Boolean(value),
  );
  for (const value of values) {
    redacted = redacted.replaceAll(value, "[REDACTED_BD_CONTACT]");
  }
  return redacted;
}

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
  /** Device/session routing only; never message business provenance. */
  routingShopId: string;
  platformShopId: string;
  triggerKind: AffiliateTriggerKind;
  triggerId: string;
  creatorImUserId?: string;
  creatorId?: string | null;
  creatorOpenId?: string | null;
  creatorRelationshipId: string;
  /** Exact product/shop pairs frozen in the canonical WorkItem Agenda. */
  frozenAgendaProductShopPairsJson?: string;
  sampleApplicationRecordId?: string;
  affiliateCollaborationId?: string;
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
  predictionCacheIds: string[];
}

interface AffiliateResolvedDispatchContext {
  checkpoint: GQL.AffiliateContextBuilderPayload;
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
    if (this.shop.objectId !== shop.objectId) {
      this.gatewaySetupReady = false;
    }
    this.shop = shop;
  }

  updateAffiliateContext(context: AffiliateContext): void {
    Object.assign(this.affiliateContext, context);
    this.gatewaySetupReady = false;
  }

  static buildScopeKey(_platform: string, context: AffiliateContext): string {
    if (!context.userId) {
      throw new Error("userId is required for affiliate agent sessions");
    }
    if (!context.creatorRelationshipId) {
      throw new Error("creatorRelationshipId is required for affiliate agent sessions");
    }
    return `agent:${AFFILIATE_AGENT_ID}:affiliate:${context.userId}:${context.creatorRelationshipId}`;
  }

  get extraSystemPrompt(): string {
    return this.buildExtraSystemPrompt(AffiliateAgentRunMode.OPERATOR_REASONING);
  }

  private buildExtraSystemPrompt(
    runMode: AffiliateAgentRunMode,
    businessDeveloperContext?: GQL.AffiliateBusinessDeveloperDispatchContext | null,
    involvedShopInstructions?: GQL.AffiliateInvolvedShopInstruction[],
    workflowSkillCatalog?: string,
  ): string {
    const effectiveShopInstructions = involvedShopInstructions?.length
      ? involvedShopInstructions
      : [
          {
            shopId: this.shop.objectId,
            shopName: this.shop.shopName,
            businessPrompt: this.shop.businessPrompt ?? null,
          },
        ];
    const renderedShopInstructions = effectiveShopInstructions.flatMap((shop) => [
      `### ${shop.shopName} (Shop ID: ${shop.shopId})`,
      shop.businessPrompt?.trim() || "(none configured)",
      "",
    ]);
    const businessDeveloperSection = buildBusinessDeveloperPromptSection(businessDeveloperContext);
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
      "- TikTok Shop platform chat, WhatsApp, and Outlook email are communication routes for one seller-creator Relationship.",
      "- Reply on the latest inbound channel by default. preferredChannel requests an intentional channel override and remains subject to backend route validation.",
      "- A prior outbound turn may prevent a follow-up-only wake before dispatch. Once this run is dispatched, reconcile every listed agenda item; do not omit a listed follow-up solely because the Creator has not replied to the prior outbound turn.",
      "- A selected channel never falls back to another channel when unavailable or when sending fails.",
      "",
      "## Static Resolution Contract",
      "- Every work-item run must end with exactly one affiliate_resolve_work_item call. A final text response alone never completes or sends a backend work item.",
      "- Reconcile the complete Agent Working Agenda as one Relationship plan; use input.actions when multiple compatible side effects are required.",
      "- affiliate_resolve_work_item supports only three platform action types: SEND_MESSAGE, REVIEW_SAMPLE_APPLICATION, and CREATE_TARGET_COLLABORATION. Do not invent unsupported action types.",
      "- Each REQUEST_ACTION action must populate the required payload matching its type: SEND_MESSAGE -> messageIntent.parts, REVIEW_SAMPLE_APPLICATION -> sampleApplicationRecordId + sampleReviewDecision, CREATE_TARGET_COLLABORATION -> targetCollaborationIntent.",
      "- You own ordinary Affiliate judgment. If a concrete supported action genuinely requires a human decision, keep decision=REQUEST_ACTION and include humanReviewRequest with one structured reason and one concise decision-ready question. This forces a pending proposal; it does not transfer or rewrite the working agenda.",
      "- Agent-facing resolution has only two valid decisions: REQUEST_ACTION or NO_ACTION_NEEDED. Never select FAILED_OR_INCOMPLETE. Retry a failed tool call; if the tool or runtime remains unavailable, let the run end unresolved so the same business facts remain retryable.",
      "- Never pass provider message, conversation, thread, or account route identifiers; backend resolves exact routes from the work boundary and relationship.",
      "- For REVIEW_SAMPLE_APPLICATION, use the local action.sampleApplicationRecordId returned by an Affiliate read tool and action.sampleReviewDecision. REJECT requires action.rejectReason; when rejectReason is OTHER, also provide a specific action.rejectReasonExplanation so the reason taxonomy can be improved later. The backend resolves the Provider ID and re-validates TikTok immediately before executing. Do not send sampleReviewIntent: {}.",
      "- Omit optional fields when unknown. Never send empty strings for Date, ID, or object fields.",
      "- If affiliate_resolve_work_item returns a proposal requiring approval, stop there and make your final assistant response exactly NO_REPLY; do not try to bypass approval.",
      `- Write every operatorSummary and staff-facing explanation in ${this.shop.staffLanguage ?? "English"}.`,
      "- After resolving, make the final assistant response exactly NO_REPLY.",
      "",
      workflowSkillCatalog?.trim() || "",
      "",
      "## Involved Shop Affiliate Instructions",
      "- Match each Agent Working Agenda item to its Shop ID and apply only that shop's instructions.",
      ...renderedShopInstructions,
      "",
      ...businessDeveloperSection,
    ].join("\n");
  }

  async handleWorkItem(workItem: GQL.AffiliateWorkItem): Promise<AffiliateDispatchResult> {
    if (!workItem.agentDispatchRecommended) {
      log.info(`Affiliate work item ${workItem.id} does not recommend agent dispatch; skipping`);
      return { runId: undefined };
    }

    const baseCheckpointId = normalizeCheckpointId(
      workItem.creatorRelationship?.committedCheckpointId,
    );
    const baseEventCursor = workItem.creatorRelationship?.committedEventCursor ?? 0;
    const targetEventCursor = frozenWorkItemTargetEventCursor(workItem, baseEventCursor);
    if (targetEventCursor == null) {
      log.error(
        `Affiliate dispatch skipped because its Agent Working Agenda has no valid frozen boundary: relationship=${workItem.creatorRelationshipId}`,
      );
      return { runId: undefined };
    }
    const dispatchContext = await this.fetchDispatchContext({
      workItem,
      baseCheckpointId,
      baseEventCursor,
      targetEventCursor,
    });
    if (!dispatchContext) return { runId: undefined };

    let generation: number | undefined;
    if (isCreatorReplyWorkItem(workItem) && !hasProposalRevisionAgenda(workItem)) {
      generation = this.beginCreatorMessageTakeover();
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
      targetEventCursor,
      relationshipOperationalConfigRevision:
        dispatchContext.checkpoint.relationshipOperationalConfigRevision,
      businessDeveloperIdSnapshot: dispatchContext.checkpoint.businessDeveloperIdSnapshot ?? null,
      businessDeveloperConfigRevision:
        dispatchContext.checkpoint.businessDeveloperConfigRevision ?? null,
      businessDeveloperContext: dispatchContext.checkpoint.businessDeveloperDispatchContext ?? null,
      involvedShopInstructions: dispatchContext.checkpoint.involvedShopInstructions,
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
    const text = [data.text, data.message, data.error, data.reason, data.rawError].filter(
      (value): value is string => typeof value === "string",
    );
    return text.some((value) =>
      AGENT_RUNTIME_FAILURE_PATTERNS.some((pattern) => pattern.test(value)),
    );
  }

  private async setup(): Promise<void> {
    if (this.gatewaySetupReady) return;

    const runProfileId = this.shop.runProfileId ?? DEFAULT_AFFILIATE_RUN_PROFILE_ID;
    rootStore.toolCapability.setSessionRunProfile(this.scopeKey, runProfileId);
    await openClawConnector.request("tool_register_session", {
      sessionKey: this.scopeKey,
      toolContext: {
        kind: "AFFILIATE",
        routingShopId: this.shop.objectId,
        creatorRelationshipId: this.affiliateContext.creatorRelationshipId,
        frozenAgendaProductShopPairsJson:
          this.affiliateContext.frozenAgendaProductShopPairsJson ?? "[]",
        ...(this.affiliateContext.creatorId ? { creatorId: this.affiliateContext.creatorId } : {}),
        ...(this.affiliateContext.creatorOpenId
          ? { creatorOpenId: this.affiliateContext.creatorOpenId }
          : {}),
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
    businessDeveloperContext?: GQL.AffiliateBusinessDeveloperDispatchContext | null;
    involvedShopInstructions?: GQL.AffiliateInvolvedShopInstruction[];
    predictionCacheIds?: string[];
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
      predictionCacheIds: params.predictionCacheIds,
    });
    const resolvedModel = this.resolveCurrentSessionModel();
    const workflowSkillCatalog = await buildAffiliateWorkflowSkillCatalog();
    const systemPrompt = this.buildExtraSystemPrompt(
      runMode,
      params.businessDeveloperContext,
      params.involvedShopInstructions,
      workflowSkillCatalog,
    );
    // The work-item key is a semantic version used by AffiliateInbound to suppress
    // duplicate delivery while a run is active. It cannot also be the transcript
    // admission key: a deliberate replay of the same work version (for example
    // after a rejected proposal or a missing local checkpoint) must create a new
    // user turn instead of colliding with the prior transcript identity.
    // candidateCheckpointId is generated once per intentional dispatch attempt,
    // so retries inside this request remain idempotent while later replays do not.
    const agentRequestIdempotencyKey = `${params.idempotencyKey}:attempt:${checkpoint.candidateCheckpointId}`;
    this.logDispatchPromptContext(params, systemPrompt, agentRequestIdempotencyKey);
    const provisionalRunId = agentRequestIdempotencyKey;
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
      predictionCacheIds: checkpoint.predictionCacheIds,
    });

    let response: AffiliateDispatchResult | undefined;
    try {
      response = await requestAgent<AffiliateDispatchResult>({
        sessionKey: this.scopeKey,
        provider: resolvedModel.provider,
        model: resolvedModel.model,
        message: params.message,
        extraSystemPrompt: systemPrompt,
        promptMode: "raw",
        idempotencyKey: agentRequestIdempotencyKey,
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
        predictionCacheIds: checkpoint.predictionCacheIds,
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

  private logDispatchPromptContext(
    params: {
      message: string;
      idempotencyKey: string;
      runMode?: AffiliateAgentRunMode;
      businessDeveloperContext?: GQL.AffiliateBusinessDeveloperDispatchContext | null;
    },
    systemPrompt: string,
    agentRequestIdempotencyKey: string,
  ): void {
    log.info(
      [
        "Affiliate dispatch prompt context",
        `scope=${this.scopeKey}`,
        `idempotencyKey=${params.idempotencyKey}`,
        `agentRequestIdempotencyKey=${agentRequestIdempotencyKey}`,
        `triggerKind=${this.affiliateContext.triggerKind}`,
        `triggerId=${this.affiliateContext.triggerId}`,
        `routingShopId=${this.affiliateContext.routingShopId}`,
        `affiliateCollaborationId=${this.affiliateContext.affiliateCollaborationId ?? ""}`,
        `runMode=${params.runMode ?? AffiliateAgentRunMode.OPERATOR_REASONING}`,
        `messageChars=${params.message.length}`,
        `systemPromptChars=${systemPrompt.length}`,
        `businessDeveloperContext=${params.businessDeveloperContext ? "present" : "absent"}`,
        `businessDeveloperWhatsApp=${params.businessDeveloperContext?.whatsApp ? "present" : "absent"}`,
        `businessDeveloperEmail=${params.businessDeveloperContext?.email ? "present" : "absent"}`,
        "promptContextVersion=affiliate-working-agenda-v1",
        `debugFullPrompt=${DEBUG_AFFILIATE_PROMPT}`,
      ].join(" "),
    );

    if (!DEBUG_AFFILIATE_PROMPT) return;
    log.info(
      [
        "[Affiliate Dispatch Full Prompt]",
        `scope=${this.scopeKey}`,
        `idempotencyKey=${params.idempotencyKey}`,
        `agentRequestIdempotencyKey=${agentRequestIdempotencyKey}`,
        "",
        "## extraSystemPrompt",
        redactBusinessDeveloperContactDetails(systemPrompt, params.businessDeveloperContext),
        "",
        "## userMessage",
        params.message,
        "[/Affiliate Dispatch Full Prompt]",
      ].join("\n"),
    );
  }

  private abortActiveRun(): void {
    const previousRunId = this.activeRunId;
    if (!previousRunId) return;
    void openClawConnector
      .request("chat.abort", { sessionKey: this.scopeKey })
      .catch((err: unknown) =>
        log.warn(`Failed to abort affiliate run ${previousRunId}: ${String(err)}`),
      );
  }

  private async prepareRunCheckpoint(requested: {
    baseCheckpointId?: string | null;
    baseEventCursor?: number | null;
    targetEventCursor?: number | null;
    relationshipOperationalConfigRevision?: number;
    businessDeveloperIdSnapshot?: string | null;
    businessDeveloperConfigRevision?: number | null;
    predictionCacheIds?: string[];
  }): Promise<AffiliateRunCheckpoint> {
    const committed =
      requested.baseCheckpointId === undefined || requested.baseEventCursor === undefined
        ? await this.resolveRelationshipCommittedCheckpoint()
        : null;
    const baseCheckpointId =
      requested.baseCheckpointId === undefined
        ? (committed?.checkpointId ?? null)
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
        predictionCacheIds: requested.predictionCacheIds ?? [],
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
      predictionCacheIds: [...new Set(requested.predictionCacheIds ?? [])],
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
          shopId: this.affiliateContext.routingShopId,
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

  private async completeWorkItemIfUnresolved(
    runId: string,
    workItem: GQL.AffiliateWorkItem,
  ): Promise<void> {
    const authSession = getAuthSession();
    if (!authSession) {
      log.warn(`No auth session available, cannot complete affiliate work item for run ${runId}`);
      return;
    }

    try {
      if (await this.isWorkItemResolvedOrNoLongerDispatchable(workItem)) {
        log.info(
          `Affiliate work item already resolved or gated after the agent tool call; skipping fallback completion: ` +
            `runId=${runId} subject=${workItemSubjectLabel(workItem)}`,
        );
        return;
      }

      log.warn(
        `Affiliate Agent run ended without a structured resolution; leaving the work boundary ` +
          `unacknowledged and retryable: runId=${runId} subject=${workItemSubjectLabel(workItem)}`,
      );
    } catch (err) {
      log.error(`Failed to verify unresolved affiliate work item for run ${runId}:`, err);
    }
  }

  private async isWorkItemResolvedOrNoLongerDispatchable(
    workItem: GQL.AffiliateWorkItem,
  ): Promise<boolean> {
    const authSession = getAuthSession();
    if (!authSession) return false;

    const result = await authSession.graphqlFetch<AffiliateWorkItemsQueryResult>(
      AFFILIATE_WORK_ITEMS_QUERY,
      {
        input: {
          shopId: this.affiliateContext.routingShopId,
          creatorRelationshipId: workItem.creatorRelationshipId,
          limit: 1,
        },
      },
    );
    const currentWorkItem = result.affiliateWorkItems[0];
    if (currentWorkItem == null) {
      return true;
    }
    return currentWorkItem.agentDispatchRecommended === false;
  }

  private beginCreatorMessageTakeover(): number {
    this.dispatchGeneration += 1;
    this.abortActiveRun();
    return this.dispatchGeneration;
  }

  private async fetchDispatchContext(input: {
    workItem: GQL.AffiliateWorkItem;
    baseCheckpointId: string | null;
    baseEventCursor: number;
    targetEventCursor: number;
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
            shopId: input.workItem.triggerShopId,
            creatorRelationshipId: input.workItem.creatorRelationshipId,
            baseCheckpointId: input.baseCheckpointId,
            baseEventCursor: input.baseEventCursor,
            targetEventCursor: input.targetEventCursor,
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
      if (context.targetEventCursor !== input.targetEventCursor) {
        log.error(
          `Affiliate dispatch skipped because Backend changed the frozen work boundary: relationship=${input.workItem.creatorRelationshipId} requested=${input.targetEventCursor} returned=${context.targetEventCursor}`,
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

function frozenWorkItemTargetEventCursor(
  workItem: GQL.AffiliateWorkItem,
  baseEventCursor: number,
): number | null {
  const agendaItems = workItem.agentWorkingAgendaItems ?? [];
  if (agendaItems.length === 0) return null;
  const boundaries = agendaItems.map((item) => item.boundaryEventCursor);
  if (
    boundaries.some(
      (boundary) => boundary == null || !Number.isInteger(boundary) || boundary < baseEventCursor,
    )
  ) {
    return null;
  }
  return Math.max(...(boundaries as number[]));
}

function isCreatorReplyWorkItem(workItem: GQL.AffiliateWorkItem): boolean {
  return (
    workItem.requiredAction === GQL.AffiliateRelationshipRequiredAction.HandleCreatorMessage ||
    workItem.workKind === GQL.AffiliateWorkKind.InboundMessageTriage
  );
}

function hasProposalRevisionAgenda(workItem: GQL.AffiliateWorkItem): boolean {
  return (workItem.agentWorkingAgendaItems ?? []).some(
    (item) => item.revisionRequestedProposal?.status === GQL.ActionProposalStatus.RevisionRequested,
  );
}

function workItemSubjectLabel(workItem: GQL.AffiliateWorkItem): string {
  const relationshipLabel = `relationship=${workItem.creatorRelationshipId ?? ""}`;
  return workItem.affiliateCollaborationId
    ? `${relationshipLabel} collaboration=${workItem.affiliateCollaborationId}`
    : relationshipLabel;
}

function workItemBoundaryAt(workItem: GQL.AffiliateWorkItem | null | undefined): string | null {
  if (!workItem) return null;
  return (
    workItem.versionAt ??
    workItem.creatorRelationship?.stateUpdatedAt ??
    workItem.creatorRelationship?.lastInboundAt ??
    null
  );
}

function normalizeCheckpointId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
