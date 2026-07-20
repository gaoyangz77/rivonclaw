import { createLogger } from "@rivonclaw/logger";
import type {
  CsEscalationResponseHistoryEntry,
  CsEscalationResponseHistoryRepository,
} from "@rivonclaw/storage";
import { CS_GET_ESCALATION_RESULT_QUERY, CS_RESPOND_MUTATION } from "../cloud/cs-queries.js";
import { emitCsEscalationEvent } from "../telemetry/cs-telemetry-ref.js";

const log = createLogger("cs-escalation-response");
const MUTATION_TIMEOUT_MS = 30_000;
const MAX_INFLIGHT_RESPONSES = 256;
const MAX_VISIBLE_FEEDBACK = 5;

export interface CsEscalationResponseSubmission {
  schemaVersion: 1;
  callbackId: string;
  channelId: string;
  accountId: string;
  operatorId: string;
  chatId: string;
  messageId: string;
  escalationId: string;
  decision: string;
  resolved: boolean;
  submittedAt: number;
}

export interface CsEscalationFeedback {
  callbackId: string;
  decision: string;
  resolved: boolean;
  submittedAt: number;
  operatorId?: string;
  version?: number | null;
}

export interface CsEscalationResponseView {
  escalationId: string;
  shop: string;
  conversationId: string;
  buyer: string;
  orderId?: string | null;
  reason: string;
  context?: string | null;
  resolved: boolean;
  alreadyProcessed: boolean;
  feedback: CsEscalationFeedback[];
  feedbackTotal: number;
}

type EscalationRecord = {
  id: string;
  shopId?: string | null;
  conversationId?: string | null;
  buyerUserId?: string | null;
  buyerNickname?: string | null;
  orderId?: string | null;
  reason?: string | null;
  context?: string | null;
  status?: string | null;
  version?: number | null;
  result?: null | {
    decision?: string | null;
    resolved?: boolean | null;
    resolvedAt?: string | number | null;
  };
};

type EscalationLookup = { csGetEscalationResult: EscalationRecord | null };

type RespondMutation = {
  csRespond: {
    ok: boolean;
    escalationId?: string | null;
    status?: string | null;
    version?: number | null;
    error?: string | null;
  };
};

type AuthClient = {
  graphqlFetch<T>(query: string, variables: Record<string, unknown>): Promise<T>;
  getCachedUser?(): { userId?: string | null } | null;
};

export interface CsEscalationResponseChannelAdapter {
  readonly telemetrySource: string;
  updateMessage(
    submission: CsEscalationResponseSubmission,
    view: CsEscalationResponseView,
  ): Promise<void>;
  sendFailure(submission: CsEscalationResponseSubmission): Promise<void>;
  sendSuccessFallback(
    submission: CsEscalationResponseSubmission,
    options: { alreadyProcessed: boolean },
  ): Promise<void>;
}

export type CsEscalationResponseHistoryStore = Pick<
  CsEscalationResponseHistoryRepository,
  "append" | "hasCallback" | "listByEscalationId" | "countByEscalationId"
>;

export interface CsEscalationResponseProcessorDeps {
  getAuth: () => AuthClient | null;
  adapter: CsEscalationResponseChannelAdapter;
  history: CsEscalationResponseHistoryStore;
  resolveShopName: (shopId: string) => string | undefined;
  mutationTimeoutMs?: number;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timeout = setTimeout(() => reject(new Error("CS response mutation timed out")), timeoutMs);
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function isFinalStatus(status?: string | null): boolean {
  return status === "RESOLVED" || status === "CLOSED";
}

function isResolved(escalation: EscalationRecord): boolean {
  return escalation.result?.resolved === true || isFinalStatus(escalation.status);
}

function asTimestamp(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

export class CsEscalationResponseProcessor {
  private readonly inflight = new Set<string>();

  constructor(private readonly deps: CsEscalationResponseProcessorDeps) {}

  async handle(submission: CsEscalationResponseSubmission): Promise<void> {
    const key = `${submission.channelId}\u0000${submission.accountId}\u0000${submission.messageId}`;
    if (this.inflight.has(key)) {
      log.info(
        `Ignoring concurrent CS callback escalation=${submission.escalationId} ` +
          `channel=${submission.channelId} account=${submission.accountId} message=${submission.messageId}`,
      );
      return;
    }
    if (this.inflight.size >= MAX_INFLIGHT_RESPONSES) {
      log.warn(
        `Rejecting CS callback at inflight limit escalation=${submission.escalationId} ` +
          `channel=${submission.channelId} account=${submission.accountId} message=${submission.messageId}`,
      );
      await this.deps.adapter.sendFailure(submission);
      return;
    }
    this.inflight.add(key);
    try {
      await this.execute(submission);
    } finally {
      this.inflight.delete(key);
    }
  }

  private async execute(submission: CsEscalationResponseSubmission): Promise<void> {
    const auth = this.deps.getAuth();
    log.info(
      `Received CS callback callback=${submission.callbackId} escalation=${submission.escalationId} ` +
        `channel=${submission.channelId} account=${submission.accountId} chat=${submission.chatId} ` +
        `message=${submission.messageId} operator=${submission.operatorId}`,
    );

    if (!auth) {
      log.warn(`Rejecting CS callback without auth escalation=${submission.escalationId}`);
      await this.deps.adapter.sendFailure(submission);
      return;
    }

    let escalation: EscalationRecord;
    try {
      const preflight = await auth.graphqlFetch<EscalationLookup>(CS_GET_ESCALATION_RESULT_QUERY, {
        escalationId: submission.escalationId,
      });
      if (!preflight.csGetEscalationResult) {
        log.warn(`CS escalation not found escalation=${submission.escalationId}`);
        this.emitTelemetry(submission, "preflight_not_found");
        await this.deps.adapter.sendFailure(submission);
        return;
      }
      escalation = preflight.csGetEscalationResult;
    } catch (error) {
      log.warn(`CS preflight failed escalation=${submission.escalationId}`, error);
      this.emitTelemetry(submission, "preflight_failed", error);
      await this.deps.adapter.sendFailure(submission);
      return;
    }

    const ownerId = auth.getCachedUser?.()?.userId?.trim() || "unknown";
    this.ensureBackendFeedback(ownerId, submission, escalation);
    const locallyResolved =
      this.deps.history.listByEscalationId(ownerId, escalation.id, 1).at(-1)?.resolved === true;
    const duplicate = this.deps.history.hasCallback(
      ownerId,
      submission.channelId,
      submission.callbackId,
    );
    if (duplicate || locallyResolved || isResolved(escalation)) {
      this.emitTelemetry(
        submission,
        duplicate ? "duplicate_callback" : "already_resolved",
        undefined,
        escalation,
      );
      await this.renderResult(ownerId, submission, escalation, true);
      return;
    }

    const startedAt = Date.now();
    try {
      const mutation = await withTimeout(
        auth.graphqlFetch<RespondMutation>(CS_RESPOND_MUTATION, {
          escalationId: submission.escalationId,
          decision: submission.decision,
          instructions: "",
          resolved: submission.resolved,
        }),
        this.deps.mutationTimeoutMs ?? MUTATION_TIMEOUT_MS,
      );
      if (!mutation.csRespond.ok) {
        log.warn(
          `CS mutation rejected escalation=${submission.escalationId} ` +
            `status=${mutation.csRespond.status ?? "unknown"}`,
        );
        this.emitTelemetry(
          submission,
          "mutation_rejected",
          mutation.csRespond.error,
          mutation.csRespond,
          startedAt,
        );
        await this.deps.adapter.sendFailure(submission);
        return;
      }

      const resolved = isFinalStatus(mutation.csRespond.status) || submission.resolved;
      this.recordFeedback(ownerId, submission, resolved, mutation.csRespond.version);
      this.emitTelemetry(submission, "ok", undefined, mutation.csRespond, startedAt);
      await this.renderResult(
        ownerId,
        submission,
        {
          ...escalation,
          status: mutation.csRespond.status ?? escalation.status,
          version: mutation.csRespond.version ?? escalation.version,
          result: {
            decision: submission.decision,
            resolved,
            resolvedAt: submission.submittedAt,
          },
        },
        false,
      );
    } catch (error) {
      log.warn(`CS mutation uncertain escalation=${submission.escalationId}`, error);
      const recovered = await this.lookupAdvanced(
        auth,
        submission.escalationId,
        escalation.version,
      );
      if (recovered) {
        const resolved = isResolved(recovered);
        this.recordFeedback(ownerId, submission, resolved, recovered.version);
        this.emitTelemetry(submission, "ok_after_recheck", undefined, recovered, startedAt);
        await this.renderResult(ownerId, submission, recovered, false);
        return;
      }
      this.emitTelemetry(submission, "mutation_failed", error, undefined, startedAt);
      await this.deps.adapter.sendFailure(submission);
    }
  }

  private async lookupAdvanced(
    auth: AuthClient,
    escalationId: string,
    previousVersion?: number | null,
  ): Promise<EscalationRecord | null> {
    try {
      const result = await auth.graphqlFetch<EscalationLookup>(CS_GET_ESCALATION_RESULT_QUERY, {
        escalationId,
      });
      const escalation = result.csGetEscalationResult;
      if (!escalation?.result) return null;
      if (typeof previousVersion !== "number") return escalation;
      return typeof escalation.version === "number" && escalation.version > previousVersion
        ? escalation
        : null;
    } catch (error) {
      log.warn(`CS recheck failed escalation=${escalationId}`, error);
      return null;
    }
  }

  private recordFeedback(
    ownerId: string,
    submission: CsEscalationResponseSubmission,
    resolved: boolean,
    version?: number | null,
  ): void {
    try {
      this.deps.history.append({
        ownerId,
        channelId: submission.channelId,
        callbackId: submission.callbackId,
        escalationId: submission.escalationId,
        accountId: submission.accountId,
        messageId: submission.messageId,
        operatorId: submission.operatorId,
        decision: submission.decision,
        resolved,
        submittedAt: submission.submittedAt,
        version,
      });
    } catch (error) {
      // The cloud mutation is authoritative. A local history write must never turn a
      // successful response into a retry that could submit the same decision twice.
      log.warn(
        `Failed to persist CS response history escalation=${submission.escalationId}`,
        error,
      );
    }
  }

  private ensureBackendFeedback(
    ownerId: string,
    submission: CsEscalationResponseSubmission,
    escalation: EscalationRecord,
  ): void {
    const decision = escalation.result?.decision?.trim();
    if (!decision) return;
    try {
      const resolved = escalation.result?.resolved === true;
      const alreadyStored = this.deps.history
        .listByEscalationId(ownerId, escalation.id, MAX_VISIBLE_FEEDBACK)
        .some(
          (entry) =>
            entry.decision === decision &&
            entry.resolved === resolved &&
            (typeof escalation.version !== "number" || entry.version === escalation.version),
        );
      if (alreadyStored) return;
      this.deps.history.append({
        ownerId,
        channelId: "backend",
        callbackId: `escalation:${escalation.id}:version:${escalation.version ?? "unknown"}`,
        escalationId: escalation.id,
        accountId: submission.accountId,
        messageId: submission.messageId,
        operatorId: "",
        decision,
        resolved,
        submittedAt: asTimestamp(escalation.result?.resolvedAt),
        version: escalation.version,
      });
    } catch (error) {
      log.warn(`Failed to persist backend CS response history escalation=${escalation.id}`, error);
    }
  }

  private buildView(
    ownerId: string,
    escalation: EscalationRecord,
    alreadyProcessed: boolean,
  ): CsEscalationResponseView {
    const stored = this.deps.history.listByEscalationId(
      ownerId,
      escalation.id,
      MAX_VISIBLE_FEEDBACK,
    );
    let feedback = stored.map((entry) => this.toFeedback(entry));
    let feedbackTotal = this.deps.history.countByEscalationId(ownerId, escalation.id);
    const backendDecision = escalation.result?.decision?.trim();
    const latest = feedback.at(-1);
    if (
      backendDecision &&
      (!latest ||
        latest.decision !== backendDecision ||
        latest.resolved !== (escalation.result?.resolved === true))
    ) {
      feedback = [
        ...feedback,
        {
          callbackId: `backend:${escalation.version ?? "unknown"}`,
          decision: backendDecision,
          resolved: escalation.result?.resolved === true,
          submittedAt: asTimestamp(escalation.result?.resolvedAt),
          version: escalation.version,
        },
      ].slice(-MAX_VISIBLE_FEEDBACK);
      feedbackTotal += 1;
    }
    const shopId = escalation.shopId?.trim() ?? "";
    const resolved = isResolved(escalation) || feedback.at(-1)?.resolved === true;
    return {
      escalationId: escalation.id,
      shop: (shopId && this.deps.resolveShopName(shopId)) || shopId || "-",
      conversationId: escalation.conversationId?.trim() || "-",
      buyer: escalation.buyerNickname?.trim() || escalation.buyerUserId?.trim() || "-",
      orderId: escalation.orderId,
      reason: escalation.reason?.trim() || "-",
      context: escalation.context,
      resolved,
      alreadyProcessed,
      feedback,
      feedbackTotal: Math.max(feedbackTotal, feedback.length),
    };
  }

  private toFeedback(entry: CsEscalationResponseHistoryEntry): CsEscalationFeedback {
    return {
      callbackId: entry.callbackId,
      decision: entry.decision,
      resolved: entry.resolved,
      submittedAt: entry.submittedAt,
      operatorId: entry.operatorId,
      version: entry.version,
    };
  }

  private async renderResult(
    ownerId: string,
    submission: CsEscalationResponseSubmission,
    escalation: EscalationRecord,
    alreadyProcessed: boolean,
  ): Promise<void> {
    try {
      await this.deps.adapter.updateMessage(
        submission,
        this.buildView(ownerId, escalation, alreadyProcessed),
      );
      log.info(
        `CS response message updated escalation=${submission.escalationId} ` +
          `channel=${submission.channelId} message=${submission.messageId}`,
      );
    } catch (error) {
      log.warn(
        `CS mutation succeeded but response message update failed escalation=${submission.escalationId} ` +
          `channel=${submission.channelId} message=${submission.messageId}`,
        error,
      );
      await this.deps.adapter.sendSuccessFallback(submission, { alreadyProcessed });
    }
  }

  private emitTelemetry(
    submission: CsEscalationResponseSubmission,
    outcome: string,
    errorMessage?: unknown,
    result?: { status?: string | null; version?: number | null },
    startedAt?: number,
  ): void {
    emitCsEscalationEvent({
      escalationId: submission.escalationId,
      action: submission.resolved ? "respond_resolve" : "respond_update",
      source: this.deps.adapter.telemetrySource,
      outcome,
      status: result?.status,
      version: result?.version,
      resolved: submission.resolved,
      durationMs: startedAt ? Date.now() - startedAt : undefined,
      errorMessage,
    });
  }
}
