import { createLogger } from "@rivonclaw/logger";
import type { GatewayEventFrame } from "@rivonclaw/gateway";
import { stripReasoningTagsFromText } from "@rivonclaw/core";
import {
  CustomerServiceSession,
  type CSShopContext,
  type Escalation,
} from "../cs-bridge/customer-service-session.js";
import { reaction } from "mobx";
import type {
  AffiliateWorkItemPayload,
  CsConversationSignalPayload,
  CsEscalationEventDeliveryPayload,
} from "../cloud/backend-subscription-client.js";
import {
  resolveCsSignalDispatch,
  type CsAgentDispatchRequest,
} from "../cs-bridge/cs-agent-dispatch-resolver.js";

// Re-export for consumers that imported CSShopContext from this file
export type { CSShopContext } from "../cs-bridge/customer-service-session.js";
import { rootStore } from "../app/store/desktop-store.js";
import { runtimeStatusStore } from "../app/store/runtime-status-store.js";
import { emitCsDispatchEvent, emitCsError, CS_ERROR_STAGE } from "../telemetry/cs-telemetry-ref.js";
import { AffiliateInbound } from "../affiliate/affiliate-inbound.js";
import { openClawConnector } from "../openclaw/index.js";
import {
  CsAutomaticRunAdmission,
  type CsRunAdmissionLease,
  type CsRunAdmissionMode,
} from "../cs-bridge/cs-run-admission.js";

const log = createLogger("ecommerce-relay");
const DEFAULT_AIRFLOW_PENDING_CATCH_UP_WINDOW_MS = 30_000;

function resolveAirflowPendingCatchUpWindowMs(): number {
  const raw = process.env.RIVONCLAW_CS_AIRFLOW_PENDING_CATCH_UP_WINDOW_MS;
  if (raw === undefined) return DEFAULT_AIRFLOW_PENDING_CATCH_UP_WINDOW_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : DEFAULT_AIRFLOW_PENDING_CATCH_UP_WINDOW_MS;
}

function csDispatchBatchKey(dispatch: CsAgentDispatchRequest): string {
  return `${dispatch.platformShopId}\u0000${dispatch.conversationId}`;
}

function csDispatchSortKey(dispatch: CsAgentDispatchRequest): [number, number, string, string] {
  const eventMs = dispatch.eventTime ? new Date(dispatch.eventTime).getTime() : 0;
  const timestamp = Number.isFinite(eventMs) ? eventMs : 0;
  const messageIndex = dispatch.messageIndex ?? "";
  return [timestamp, messageIndex.length, messageIndex, dispatch.messageId ?? ""];
}

function compareCsDispatchCursor(
  left: CsAgentDispatchRequest,
  right: CsAgentDispatchRequest,
): number {
  const leftKey = csDispatchSortKey(left);
  const rightKey = csDispatchSortKey(right);
  for (let index = 0; index < leftKey.length; index += 1) {
    const leftValue = leftKey[index];
    const rightValue = rightKey[index];
    if (leftValue < rightValue) return -1;
    if (leftValue > rightValue) return 1;
  }
  return 0;
}

function isAirflowPendingBuyerDispatch(dispatch: CsAgentDispatchRequest): boolean {
  return (
    String(dispatch.source ?? "").toUpperCase() === "AIRFLOW" &&
    dispatch.dispatchReason === "PENDING_BUYER_MESSAGE" &&
    Boolean(dispatch.messageId)
  );
}

function csSignalAdmissionMode(dispatch: CsAgentDispatchRequest): CsRunAdmissionMode {
  return dispatch.dispatchReason === "MANUAL_START" ? "bypass" : "automatic";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EcommerceRelayBridgeOptions {
  gatewayId: string;
  /** Desktop UI language. Used for staff-facing affiliate summaries. */
  locale?: string;
  /** Default RunProfile ID for CS sessions (fallback when shop has no runProfileId). */
  defaultRunProfileId?: string;
}

// ---------------------------------------------------------------------------
// EcommerceRelayBridge
// ---------------------------------------------------------------------------

/**
 * Desktop-side ecommerce signal actuator. Backend GraphQL subscriptions
 * deliver business-level signals; this bridge owns local shop/session context
 * and dispatches agent runs via the gateway RPC.
 *
 * Platform-agnostic: the bridge resolves the platform from the shop context
 * (looked up by platformShopId) and uses it to build session keys, so adding
 * a new e-commerce platform only requires registering its shop contexts.
 *
 * The bridge is intentionally thin -- it does NOT fetch data from the backend.
 * All shop context is derived reactively from the entity cache, which is
 * populated by Panel's GraphQL requests flowing through Desktop's proxy.
 *
 * On start(), the bridge subscribes to the entity cache. When shops appear
 * or change, it syncs shop contexts. No explicit push of shop contexts is
 * needed.
 */
export class EcommerceRelayBridge {
  private static readonly INTERNAL_PROTOCOL_LINE_PATTERNS = [
    /^\s*```(?:json)?\s*$/i,
    /^\s*`+\s*$/,
    /^\s*\{[\s\S]*"(?:tool_uses|recipient_name|parameters|product_id|tool|arguments|name)"[\s\S]*\}\s*`?\s*$/,
    /^\s*to=functions\.[\w.-]+.*$/i,
    /^\s*But the tool name is shown in the line above:.*$/i,
    /^\s*In this task, I should use:\s*$/i,
    /^\s*and specify the tool with .*$/i,
    /^\s*In the assistant interface, I can do:\s*$/i,
  ];

  private closed = false;

  private readonly automaticRunAdmission = new CsAutomaticRunAdmission();

  /** Shop context keyed by platformShopId (from webhook). */
  private shopContexts = new Map<string, CSShopContext>();

  /** Long-lived sessions keyed by conversationId. Reused across messages. */
  private sessions = new Map<string, CustomerServiceSession>();

  /** In-flight session initialization keyed by conversationId (single-flight). */
  private sessionCreations = new Map<string, Promise<CustomerServiceSession>>();

  /** Affiliate inbound frame handler. Owns affiliate shop contexts and sessions. */
  private affiliateInbound: AffiliateInbound;

  /** Pending agent runs keyed by runId, used to auto-forward final text to buyer. */
  private pendingRuns = new Map<
    string,
    {
      shopObjectId: string;
      conversationId: string;
      session: CustomerServiceSession;
      acceptedAt: number;
      admissionLease?: CsRunAdmissionLease;
    }
  >();

  private gatewayGeneration = 0;
  private reconnectRecovery: { generation: number; promise: Promise<void> } | null = null;

  /** Airflow backlog buyer-message dispatches keyed by platformShopId + conversationId. */
  private pendingAirflowBuyerCatchUps = new Map<
    string,
    {
      dispatch: CsAgentDispatchRequest;
      timer: ReturnType<typeof setTimeout> | null;
    }
  >();

  /** Entity cache subscription unsubscribe function. */
  private cacheUnsubscribe: (() => void) | null = null;

  constructor(private readonly opts: EcommerceRelayBridgeOptions) {
    this.affiliateInbound = new AffiliateInbound(opts.locale);
  }

  // -- Public API ------------------------------------------------------------

  async start(): Promise<void> {
    this.closed = false;
    this.automaticRunAdmission.resume();
    this.subscribeToCacheChanges();
    this.syncFromCache();
    runtimeStatusStore.setCsBridgeConnected();
    log.info("Ecommerce signal bridge started");
  }

  stop(): void {
    this.gatewayGeneration += 1;
    this.closed = true;
    this.automaticRunAdmission.reset("bridge_stopped");
    // Unsubscribe from entity cache
    if (this.cacheUnsubscribe) {
      this.cacheUnsubscribe();
      this.cacheUnsubscribe = null;
    }
    for (const pending of this.pendingAirflowBuyerCatchUps.values()) {
      if (pending.timer) clearTimeout(pending.timer);
    }
    this.pendingAirflowBuyerCatchUps.clear();
    runtimeStatusStore.setCsBridgeDisconnected();
    log.info("Ecommerce signal bridge stopped");
  }

  /**
   * Mark the local Gateway transport unavailable without discarding run
   * ownership. The Gateway process can keep executing accepted runs while its
   * Desktop RPC socket reconnects, so pendingRuns must survive this boundary.
   */
  suspendForGatewayDisconnect(): void {
    this.gatewayGeneration += 1;
    this.closed = true;
    this.automaticRunAdmission.pause();
    runtimeStatusStore.setCsBridgeDisconnected();
    log.warn(`Ecommerce signal bridge suspended with ${this.pendingRuns.size} pending run(s)`);
  }

  /** Restore event delivery and reconcile runs that may have ended off-socket. */
  async resumeAfterGatewayReconnect(): Promise<void> {
    const generation = this.gatewayGeneration;
    this.closed = false;
    this.subscribeToCacheChanges();
    this.syncFromCache();
    runtimeStatusStore.setCsBridgeConnected();

    if (this.reconnectRecovery?.generation === generation) {
      await this.reconnectRecovery.promise;
      return;
    }

    const recovery = this.restorePendingRunDelivery(generation);
    this.reconnectRecovery = { generation, promise: recovery };
    try {
      await recovery;
    } finally {
      if (this.reconnectRecovery?.promise === recovery) {
        this.reconnectRecovery = null;
      }
      if (this.isGatewayGenerationCurrent(generation)) {
        this.automaticRunAdmission.resume();
      }
    }
  }

  updateLocale(locale: string | undefined): void {
    this.opts.locale = locale;
    this.affiliateInbound.updateLocale(locale);
    this.syncFromCache();
  }

  /**
   * Register or update shop context from the entity cache.
   */
  setShopContext(ctx: CSShopContext): void {
    this.shopContexts.set(ctx.platformShopId, ctx);
    log.info(`Shop context set: platform=${ctx.platformShopId} object=${ctx.objectId}`);
  }

  /** Remove shop context (shop disconnected/deleted). */
  removeShopContext(platformShopId: string): void {
    this.shopContexts.delete(platformShopId);
  }

  removeAffiliateShopContext(platformShopId: string): void {
    this.affiliateInbound.removeShopContext(platformShopId);
  }

  /** Legacy panel API shape retained while relay binding UI is removed. */
  getBindingConflicts(): Array<{ shopId: string; gatewayId: string }> {
    return [];
  }

  /** Local-only legacy unbind hook retained for panel compatibility. */
  unbindShop(shopId: string): void {
    this.shopContexts.delete(shopId);
    this.affiliateInbound.removeShopContext(shopId);
  }

  /**
   * Sync shop contexts from entity cache. Reads all cached shops, filters
   * for CS-enabled shops bound to this device, and updates the internal
   * shopContexts map. Device gating happens here: only the shop whose
   * `csDeviceId` matches this desktop device can dispatch CS runs.
   */
  syncFromCache(): void {
    const deviceId = this.opts.gatewayId;
    const activeCsShops = rootStore.getCustomerServiceShopContextsForDevice(deviceId);
    const activeCsPlatformShopIds = new Set(activeCsShops.map((shop) => shop.platformShopId));

    for (const shop of activeCsShops) {
      const existing = this.shopContexts.get(shop.platformShopId);
      const newCtx: CSShopContext = {
        objectId: shop.objectId,
        platformShopId: shop.platformShopId,
        shopName: shop.shopName,
        platform: shop.platform,
        systemPrompt: shop.systemPrompt,
        csProviderOverride: shop.csProviderOverride ?? undefined,
        csModelOverride: shop.csModelOverride ?? undefined,
        runProfileId: shop.runProfileId ?? undefined,
      };

      if (!existing || !this.shopContextEqual(existing, newCtx)) {
        this.setShopContext(newCtx);
      }
    }

    if (rootStore.isKnownShopCacheReady()) {
      for (const [platformShopId] of this.shopContexts) {
        if (!activeCsPlatformShopIds.has(platformShopId)) {
          log.info(`Shop ${platformShopId} no longer CS-enabled for this device, removing context`);
          this.removeShopContext(platformShopId);
        }
      }
    }

    this.affiliateInbound.syncFromShops(rootStore.getAffiliateShopContextsForDevice(deviceId));
  }

  /**
   * Handle gateway events forwarded from the RPC client's onEvent callback.
   *
   * Processes two event types:
   * - `agent` events: per-turn text forwarding. On each turn boundary (tool-start
   *   or lifecycle-end), the accumulated-but-unsent text is forwarded to the buyer
   *   as a separate message. This gives the buyer incremental responses instead of
   *   one large blob at run completion.
   * - terminal `chat` events (`final`, `error`, or `aborted`): run lifecycle cleanup. Text
   *   forwarding is handled by agent events, so the chat handler no longer
   *   sends text.
   */
  onGatewayEvent(evt: GatewayEventFrame): void {
    if (evt.event === "agent") {
      this.onAgentEvent(evt);
      return;
    }

    if (evt.event !== "chat") return;

    const payload = evt.payload as
      | {
          runId?: string;
          state?: string;
          errorKind?: string;
          errorMessage?: string;
        }
      | undefined;
    if (!payload?.runId) return;

    const pending = this.pendingRuns.get(payload.runId);
    if (!pending) {
      this.affiliateInbound.handleGatewayEvent(evt);
      return;
    }

    if (payload.state === "final" || payload.state === "error" || payload.state === "aborted") {
      this.pendingRuns.delete(payload.runId);
      this.completePendingRun(payload.runId, pending, payload);
    }
  }

  private completePendingRun(
    runId: string,
    pending: { session: CustomerServiceSession; admissionLease?: CsRunAdmissionLease },
    payload: { state?: string; errorKind?: string; errorMessage?: string },
  ): void {
    try {
      const session = pending.session;
      // Lifecycle events normally flush the last assistant turn first. Keep
      // chat completion as a safety net so a missing lifecycle frame cannot
      // turn real buffered text into a handled-without-reply acknowledgement.
      this.flushTurnText(runId, session);
      const completion = session.onRunCompleted(runId);
      if (completion.wasAborted) {
        log.info(`Run ${runId} was aborted, skipping auto-forward`);
      } else if (payload.state === "error") {
        const errorMessage = payload.errorMessage?.trim() || "Gateway agent run failed";
        log.warn(`Agent run ${runId} failed: ${errorMessage}`);
        session.emitError(CS_ERROR_STAGE.RUN_ERROR, {
          reason: payload.errorKind?.trim() || "gateway_error",
          errorMessage,
          runId,
        });
      } else if (
        !completion.hadForwardedText &&
        !completion.hadTerminalToolAction &&
        !completion.hadOperationalFailure
      ) {
        void session.acknowledgeHandledWithoutReply({
          runId,
          messageId: completion.buyerMessageId,
          messageIndex: completion.buyerMessageIndex,
        });
      }
      session.clearTurnText(runId);
    } finally {
      pending.admissionLease?.release(`run_${payload.state ?? "terminal"}`);
    }
  }

  private async restorePendingRunDelivery(generation: number): Promise<void> {
    if (!this.isGatewayGenerationCurrent(generation)) return;
    const snapshot = [...this.pendingRuns.entries()];
    if (snapshot.length === 0) {
      log.info("Ecommerce signal bridge resumed with no pending runs");
      return;
    }

    const sessionKeys = new Set(snapshot.map(([, pending]) => pending.session.scopeKey));
    for (const sessionKey of sessionKeys) {
      if (!this.isGatewayGenerationCurrent(generation)) return;
      try {
        await openClawConnector.request("sessions.messages.subscribe", { key: sessionKey });
      } catch (error) {
        log.warn(
          `Failed to restore CS Gateway event subscription for ${sessionKey}: ${this.errorMessage(error)}`,
        );
      }
    }

    // Reconciliation is deliberately bounded. Live subscriptions above cover
    // runs that are still executing; these probes only recover terminals that
    // landed while no Desktop RPC socket existed.
    const workers = Array.from({ length: Math.min(2, snapshot.length) }, async (_, worker) => {
      for (let index = worker; index < snapshot.length; index += 2) {
        if (!this.isGatewayGenerationCurrent(generation)) return;
        const [runId, pending] = snapshot[index];
        await this.reconcilePendingRun(runId, pending, generation);
      }
    });
    await Promise.all(workers);
    if (!this.isGatewayGenerationCurrent(generation)) return;
    log.info(
      `Ecommerce signal bridge resumed: restored ${sessionKeys.size} session subscription(s), ` +
        `${this.pendingRuns.size} run(s) still pending`,
    );
  }

  private async reconcilePendingRun(
    runId: string,
    pending: {
      session: CustomerServiceSession;
      acceptedAt: number;
    },
    generation: number,
  ): Promise<void> {
    if (!this.isGatewayGenerationCurrent(generation) || this.pendingRuns.get(runId) !== pending) {
      return;
    }
    try {
      const wait = await openClawConnector.request<{
        status?: string;
        error?: unknown;
      }>("agent.wait", { runId, timeoutMs: 0 });
      if (!this.isGatewayGenerationCurrent(generation) || this.pendingRuns.get(runId) !== pending) {
        return;
      }
      if (!wait?.status || wait.status === "timeout" || wait.status === "pending") return;

      if (wait.status === "ok") {
        const history = await openClawConnector.request<{
          messages?: Array<Record<string, unknown>>;
        }>("chat.history", { sessionKey: pending.session.scopeKey, limit: 30, maxChars: 80_000 });
        if (
          !this.isGatewayGenerationCurrent(generation) ||
          this.pendingRuns.get(runId) !== pending
        ) {
          return;
        }
        const recovered = this.extractRecoveredRunOutput(
          history?.messages ?? [],
          runId,
          pending.acceptedAt,
        );
        for (const text of recovered.texts) {
          if (pending.session.hasRunForwardedText(runId, text)) continue;
          pending.session.noteTurnText(runId, text);
          this.flushTurnText(runId, pending.session);
        }
        if (recovered.terminalToolAction) {
          pending.session.markRunTerminalToolStarted(runId);
        }
        this.pendingRuns.delete(runId);
        log.info(`Recovered completed CS run after Gateway reconnect: ${runId}`);
        this.completePendingRun(runId, pending, { state: "final" });
        return;
      }

      this.pendingRuns.delete(runId);
      this.completePendingRun(runId, pending, {
        state: "error",
        errorKind: `recovered_${wait.status}`,
        errorMessage:
          this.errorMessage(wait.error) || `Gateway agent run ended with ${wait.status}`,
      });
    } catch (error) {
      log.warn(`Failed to reconcile pending CS run ${runId}: ${this.errorMessage(error)}`);
    }
  }

  private extractRecoveredRunOutput(
    messages: Array<Record<string, unknown>>,
    runId: string,
    acceptedAt: number,
  ): { texts: string[]; terminalToolAction: boolean } {
    let userIndex = -1;
    const runUserIdempotencyKey = `${runId}:user`;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (
        message.role === "user" &&
        typeof message.idempotencyKey === "string" &&
        message.idempotencyKey === runUserIdempotencyKey
      ) {
        userIndex = index;
        break;
      }
    }

    // Older transcripts may not expose the persisted idempotency key through
    // chat.history. In that case, use the accepted time only as a compatibility
    // fallback, never as the preferred run identity.
    if (userIndex < 0) {
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.role !== "user") continue;
        const timestamp = this.timestampToMs(message.timestamp);
        if (timestamp == null || timestamp >= acceptedAt - 10_000) {
          userIndex = index;
          break;
        }
      }
    }
    if (userIndex < 0) return { texts: [], terminalToolAction: false };

    const texts: string[] = [];
    let terminalToolAction = false;
    for (const message of messages.slice(userIndex + 1)) {
      if (message.role === "user") break;
      if (message.role !== "assistant") continue;
      const blocks = Array.isArray(message.content) ? message.content : [];
      const text = this.historyMessageText(message);
      if (text) texts.push(text);
      terminalToolAction ||= blocks.some((block) => {
        if (!block || typeof block !== "object") return false;
        const candidate = block as { type?: unknown; name?: unknown };
        return candidate.type === "toolCall" && this.isTerminalCsTool(candidate.name);
      });
    }
    return { texts, terminalToolAction };
  }

  private historyMessageText(message: Record<string, unknown>): string {
    if (typeof message.content === "string") return message.content.trim();
    if (Array.isArray(message.content)) {
      const contentText = message.content
        .map((block) =>
          block &&
          typeof block === "object" &&
          typeof (block as { text?: unknown }).text === "string"
            ? String((block as { text: string }).text)
            : "",
        )
        .filter((part) => part.trim())
        .join("\n")
        .trim();
      if (contentText) return contentText;
    }
    return typeof message.text === "string" ? message.text.trim() : "";
  }

  private timestampToMs(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value < 10_000_000_000 ? value * 1_000 : value;
    }
    if (typeof value !== "string") return undefined;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error ?? "");
  }

  private isGatewayGenerationCurrent(generation: number): boolean {
    return !this.closed && this.gatewayGeneration === generation;
  }

  // -- Per-turn agent event handling ------------------------------------------

  /**
   * Process agent-level events for per-turn text forwarding.
   *
   * Agent events carry streaming data: `stream` identifies the sub-stream,
   * and `data` contains stream-specific fields. We watch for:
   * - `assistant` stream: update the accumulated text buffer
   * - `tool` stream with `phase: "start"`: a turn boundary -- flush unsent text
   * - `lifecycle` stream with `phase: "end"`: run completed -- flush remaining text
   * - `lifecycle` stream with `phase: "error"`: run failed -- flush any buffered
   *   text (partial responses still reach the buyer), then clear the buffer
   */
  private onAgentEvent(evt: GatewayEventFrame): void {
    const payload = evt.payload as
      | {
          runId?: string;
          stream?: string;
          data?: Record<string, unknown>;
        }
      | undefined;
    if (!payload?.runId) return;

    const { runId, stream, data } = payload;
    if (!stream || !data) return;

    // Only process events for CS runs (those in pendingRuns)
    const pending = this.pendingRuns.get(runId);
    if (!pending) {
      this.affiliateInbound.handleAgentEvent(evt);
      return;
    }

    if (stream === "assistant") {
      const text = data.text;
      if (typeof text === "string") {
        pending.session.noteTurnText(runId, text);
      }
      return;
    }

    if (stream === "tool" && data.phase === "start") {
      if (this.isTerminalCsTool(data.toolName)) {
        pending.session.markRunTerminalToolStarted(runId);
      }
      this.flushTurnText(runId, pending.session);
      return;
    }

    if (stream === "lifecycle") {
      if (data.phase === "end" || data.phase === "error") {
        // Flush any buffered text before clearing — ensures partial
        // responses reach the buyer even when the run errors out.
        this.flushTurnText(runId, pending.session);
        pending.session.clearTurnText(runId);
      }
    }
  }

  private isTerminalCsTool(toolName: unknown): boolean {
    if (typeof toolName !== "string") return false;
    const normalized = toolName.trim().split(".").pop();
    return normalized === "ecom_cs_end_session";
  }

  /** Known runtime error/timeout patterns that should not be forwarded as-is. */
  private static readonly RUNTIME_ERROR_PATTERNS = [
    /increase [`']?agents\.defaults/i,
    /timed out before a response was generated/i,
    /LLM idle timeout/i,
  ];

  /**
   * Forward buffered text for a run to the buyer, then clear the buffer.
   * `data.text` is accumulated per-turn (resets after each tool call),
   * so we send the full buffer content each time.
   *
   * Before forwarding, sanitizes known runtime error/timeout patterns:
   * - If the entire text is a timeout/error message, replaces with a
   *   user-friendly fallback.
   * - If real content has a timeout suffix appended, strips the suffix.
   */
  private flushTurnText(runId: string, session: CustomerServiceSession): void {
    let text = session.takeTurnText(runId).trim();
    if (!text) return;

    // Don't forward for aborted runs
    if (session.isRunAborted(runId)) return;

    // Strip internal protocol/tool scaffolding that occasionally leaks into
    // assistant text streams before we evaluate whether anything meaningful
    // remains to send to the buyer.
    text = this.sanitizeForwardedText(text);
    if (!text) {
      session.markRunOperationalFailure(runId);
      session.emitError(CS_ERROR_STAGE.SANITIZE, {
        reason: "internal_protocol",
        runId,
      });
      return;
    }

    // Sanitize runtime error/timeout patterns. If nothing is left, the turn
    // is dropped silently — a real human CS wouldn't send "sorry, I couldn't
    // answer" either. Emit a `cs.error` so ops can see how often a shop's
    // agent times out entirely.
    const preSanitizeLength = text.length;
    text = this.sanitizeRuntimeErrors(text);
    if (!text) {
      session.markRunOperationalFailure(runId);
      session.emitError(CS_ERROR_STAGE.SANITIZE, {
        reason: "runtime_pattern",
        runId,
        textLength: preSanitizeLength,
      });
      return;
    }

    // Mark delivery initiated synchronously so the chat error handler (which
    // may fire before the network call resolves) defers to us instead of
    // sending a duplicate message. On delivery failure we intentionally do
    // NOT retry or send a boilerplate apology — keeps the "feels like a
    // human" experience. The periodic unread-message sweep is responsible
    // for catching the dropped turn and re-sending.
    session.markRunDeliveryStarted(runId, text);
    session.forwardTextToBuyer(text, runId).catch((err) => {
      if (session.isRunAborted(runId)) {
        log.info(`Run ${runId} was aborted during delivery, skipping`);
        return;
      }
      void session
        .handleRunDeliveryFailure({
          runId,
          text,
          error: err,
        })
        .catch((recoveryErr) => {
          log.warn(
            `Failed to handle delivery failure for run ${runId} ` +
              `(shop=${session.csContext.shopId}, conversation=${session.csContext.conversationId}): ` +
              (recoveryErr instanceof Error ? recoveryErr.message : String(recoveryErr)),
          );
        });
    });
  }

  /**
   * Sanitize known runtime error/timeout patterns from agent text.
   * Returns the cleaned text, or a fallback message if the entire text
   * was a runtime error message.
   */
  private sanitizeRuntimeErrors(text: string): string {
    const hasErrorPattern = EcommerceRelayBridge.RUNTIME_ERROR_PATTERNS.some((pattern) =>
      pattern.test(text),
    );
    if (!hasErrorPattern) return text;

    // Split into lines and find where the error message starts
    const lines = text.split("\n");
    const cleanLines: string[] = [];
    for (const line of lines) {
      const isErrorLine = EcommerceRelayBridge.RUNTIME_ERROR_PATTERNS.some((pattern) =>
        pattern.test(line),
      );
      if (isErrorLine) break;
      cleanLines.push(line);
    }

    const cleaned = cleanLines.join("\n").trim();
    if (cleaned) {
      log.info(
        `Stripped runtime error suffix from agent text (${text.length} → ${cleaned.length} chars)`,
      );
      return cleaned;
    }

    // Entire text was a runtime error message — drop silently. Forwarding a
    // canned apology breaks the human feel; the cron-driven unread-message
    // sweep will surface this conversation for recovery.
    log.info("Agent text was entirely a runtime error message, dropping");
    return "";
  }

  /**
   * Remove internal tool/protocol scaffolding that should never reach buyers.
   * This guards against models that accidentally surface tool-call JSON,
   * channel/tool invocation hints, or markdown-fenced argument examples in the
   * assistant text stream.
   */
  private sanitizeForwardedText(text: string): string {
    let cleaned = stripReasoningTagsFromText(text, {
      mode: "preserve",
      trim: "both",
    }) as string;

    // Drop fenced JSON/code examples entirely. Buyer-facing CS replies should
    // never contain tool-call payload examples, and those blocks are a common
    // way leaked protocol text shows up in the stream.
    cleaned = cleaned.replace(/```[\s\S]*?```/g, " ");

    const keptLines = cleaned
      .split("\n")
      .map((line) => line.trim())
      .map((line) => {
        if (!line) return "";
        if (
          EcommerceRelayBridge.INTERNAL_PROTOCOL_LINE_PATTERNS.some((pattern) => pattern.test(line))
        ) {
          return "";
        }
        return line;
      });

    cleaned = keptLines.join("\n").trim();
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

    // If protocol stripping removed everything, drop it. Otherwise any
    // non-whitespace buyer-facing output is valid, including emoji-only
    // acknowledgements.
    if (!cleaned) return "";
    return cleaned;
  }

  // -- Entity cache subscription ---------------------------------------------

  private subscribeToCacheChanges(): void {
    // Avoid double-subscribe
    if (this.cacheUnsubscribe) return;

    this.cacheUnsubscribe = reaction(
      () => ({
        generation: rootStore.shopLifecycle.generation,
        cs: rootStore.getCustomerServiceShopContextsForDevice(this.opts.gatewayId),
        affiliate: rootStore.getAffiliateShopContextsForDevice(this.opts.gatewayId),
      }),
      () => this.syncFromCache(),
    );
  }

  // -- Backend signal handling -----------------------------------------------

  async handleCsConversationSignal(
    signal: CsConversationSignalPayload | CsAgentDispatchRequest,
  ): Promise<void> {
    if (signal.aiEnabled === false) {
      log.info(
        `Ignoring CS signal for shop ${signal.platformShopId} conv=${signal.conversationId}: AI disabled`,
      );
      emitCsDispatchEvent({
        shopId: signal.shopId,
        platformShopId: signal.platformShopId,
        conversationId: signal.conversationId,
        buyerUserId: signal.buyerUserId ?? "",
        imUserId: signal.imUserId ?? "",
        orderId: signal.orderId ?? "",
        signalType: signal.type,
        source: signal.source,
        outcome: "skipped",
        reason: "ai_disabled",
        messageId: signal.messageId ?? undefined,
      });
      return;
    }
    const dispatch = resolveCsSignalDispatch(signal);
    if (!dispatch) {
      log.warn(
        `Ignoring CS signal with unknown type ${String(signal.type)} ` +
          `for shop=${signal.platformShopId} conv=${signal.conversationId}`,
      );
      emitCsDispatchEvent({
        shopId: signal.shopId,
        platformShopId: signal.platformShopId,
        conversationId: signal.conversationId,
        buyerUserId: signal.buyerUserId ?? "",
        imUserId: signal.imUserId ?? "",
        orderId: signal.orderId ?? "",
        signalType: signal.type,
        source: signal.source,
        outcome: "skipped",
        reason: "unknown_signal_type",
        messageId: signal.messageId ?? undefined,
      });
      return;
    }

    if (isAirflowPendingBuyerDispatch(dispatch)) {
      this.enqueueAirflowPendingBuyerCatchUp(dispatch);
      return;
    }

    await this.dispatchCsConversationSignalNow(dispatch);
  }

  private enqueueAirflowPendingBuyerCatchUp(dispatch: CsAgentDispatchRequest): void {
    const key = csDispatchBatchKey(dispatch);
    const existing = this.pendingAirflowBuyerCatchUps.get(key);
    const selected =
      existing && compareCsDispatchCursor(existing.dispatch, dispatch) > 0
        ? existing.dispatch
        : dispatch;
    if (existing?.timer) clearTimeout(existing.timer);

    const windowMs = resolveAirflowPendingCatchUpWindowMs();
    const pending = {
      dispatch: selected,
      timer: null as ReturnType<typeof setTimeout> | null,
    };
    const flush = () => {
      const current = this.pendingAirflowBuyerCatchUps.get(key);
      if (current !== pending) return;
      this.pendingAirflowBuyerCatchUps.delete(key);
      void this.dispatchCsConversationSignalNow(current.dispatch);
    };
    pending.timer = setTimeout(flush, windowMs);
    this.pendingAirflowBuyerCatchUps.set(key, pending);

    if (existing) {
      log.info(
        `Coalescing Airflow CS pending buyer catch-up for shop=${dispatch.platformShopId} ` +
          `conv=${dispatch.conversationId}; latest msg=${selected.messageId ?? ""}`,
      );
    }
  }

  private async dispatchCsConversationSignalNow(dispatch: CsAgentDispatchRequest): Promise<void> {
    this.syncFromCache();
    log.info(
      `CS signal: type=${dispatch.type} reason=${dispatch.dispatchReason} shop=${dispatch.platformShopId} ` +
        `conv=${dispatch.conversationId} msg=${dispatch.messageId ?? ""}`,
    );

    const shop = this.shopContexts.get(dispatch.platformShopId);
    if (!shop) {
      log.info(`Ignoring CS signal for inactive/non-owned-device shop ${dispatch.platformShopId}`);
      emitCsDispatchEvent({
        shopId: dispatch.shopId,
        platformShopId: dispatch.platformShopId,
        conversationId: dispatch.conversationId,
        buyerUserId: dispatch.buyerUserId ?? "",
        imUserId: dispatch.imUserId ?? "",
        orderId: dispatch.orderId ?? "",
        signalType: dispatch.type,
        source: dispatch.source,
        dispatchReason: dispatch.dispatchReason,
        outcome: "skipped",
        reason: "no_shop_context",
        messageId: dispatch.messageId ?? undefined,
        messageIndex: dispatch.messageIndex ?? undefined,
        messageType: dispatch.messageType ?? undefined,
        senderRole: dispatch.senderRole ?? undefined,
      });
      emitCsError(CS_ERROR_STAGE.DISPATCH, {
        platformShopId: dispatch.platformShopId,
        conversationId: dispatch.conversationId,
        reason: "no_shop_context",
      });
      return;
    }

    let session: CustomerServiceSession | undefined;
    try {
      session = await this.getOrCreateSession(shop.objectId, {
        conversationId: dispatch.conversationId,
        buyerUserId: dispatch.buyerUserId ?? dispatch.imUserId ?? undefined,
        imUserId: dispatch.imUserId ?? undefined,
        orderId: dispatch.orderId ?? undefined,
      });

      await session.dispatchCatchUp({
        dispatchReason: dispatch.dispatchReason,
        operatorInstruction: dispatch.operatorInstruction ?? undefined,
        currentMessageId: dispatch.messageId ?? undefined,
        currentMessageIndex: dispatch.messageIndex ?? undefined,
        signalType: dispatch.type,
        source: dispatch.source ?? "backend_subscription",
        dispatchEventTime: dispatch.dispatchEventTime,
        messageType: dispatch.messageType ?? undefined,
        senderRole: dispatch.senderRole ?? undefined,
        latestMessagePreview: dispatch.latestMessagePreview ?? undefined,
        useMessageDelta: dispatch.useMessageDelta,
        admissionMode: csSignalAdmissionMode(dispatch),
        currentMessageCursor:
          dispatch.messageId || dispatch.messageIndex || dispatch.eventTime
            ? {
                messageId: dispatch.messageId ?? undefined,
                messageIndex: dispatch.messageIndex ?? undefined,
                createTime: dispatch.eventTime
                  ? Math.floor(new Date(dispatch.eventTime).getTime() / 1000)
                  : undefined,
              }
            : undefined,
      });
    } catch (err) {
      log.error(
        `Failed to handle CS signal ${dispatch.messageId ?? dispatch.conversationId}:`,
        err,
      );
      session?.emitError(CS_ERROR_STAGE.DISPATCH, {
        reason: "unhandled_exception",
        errorMessage: err,
      });
    }
  }

  async handleAffiliateWorkItemChanged(workItem: AffiliateWorkItemPayload): Promise<void> {
    this.syncFromCache();
    log.info(
      `Affiliate work item: kind=${workItem.workKind} triggerShop=${workItem.triggerPlatformShopId} ` +
        `collaboration=${workItem.affiliateCollaborationId} status=${workItem.processingStatus}`,
    );

    await this.affiliateInbound.handleWorkItem(workItem);
  }

  // -- Internal helpers -------------------------------------------------------

  /** Find a shop context by its MongoDB objectId. */
  private findShopByObjectId(objectId: string): CSShopContext | undefined {
    for (const shop of this.shopContexts.values()) {
      if (shop.objectId === objectId) return shop;
    }
    return undefined;
  }

  /** Find session that owns a given escalation ID (searches all sessions). */
  findSessionByEscalationId(escalationId: string): CustomerServiceSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.escalations.has(escalationId)) return session;
    }
    return undefined;
  }

  /**
   * Find escalation data by ID, checking in-memory sessions first, then storage.
   * Returns the escalation plus its conversation/shop/buyer context.
   */
  findEscalationById(
    escalationId: string,
  ):
    | { escalation: Escalation; conversationId: string; shopId: string; buyerUserId: string }
    | undefined {
    // Check in-memory sessions first (fast path)
    for (const session of this.sessions.values()) {
      const esc = session.escalations.get(escalationId);
      if (esc) {
        return {
          escalation: esc,
          conversationId: session.csContext.conversationId,
          shopId: session.csContext.shopId,
          buyerUserId: session.csContext.buyerUserId,
        };
      }
    }
    return undefined;
  }

  /**
   * Execute the local side effect for a durable cloud CS escalation event.
   * The cloud owns persistence; desktop only sends manager notifications or
   * wakes the CS agent for a follow-up run.
   */
  async executeCsEscalationEvent(delivery: CsEscalationEventDeliveryPayload): Promise<void> {
    const { escalation, event } = delivery;
    const session = await this.getOrCreateSession(escalation.shopId, {
      conversationId: escalation.conversationId,
      buyerUserId: escalation.buyerUserId,
      orderId: escalation.orderId ?? undefined,
    });

    if (event.type === "ESCALATION_CREATED") {
      await session.sendEscalationNotification({
        escalationId: escalation.id,
        reason: escalation.reason,
        orderId: escalation.orderId,
        context: escalation.context,
      });
      return;
    }

    await session.dispatchCloudEscalationUpdate({
      escalationId: escalation.id,
      resolved: event.type === "ESCALATION_RESOLVED",
      version: escalation.version,
    });
  }

  async dispatchCatchUp(params: {
    shopObjectId: string;
    conversationId: string;
    buyerUserId?: string;
    orderId?: string;
    dispatchReason?: CsAgentDispatchRequest["dispatchReason"];
    operatorInstruction?: string;
    currentMessageId?: string;
    currentMessageIndex?: string;
    currentMessageCreateTime?: number;
    useMessageDelta?: boolean;
  }) {
    const session = await this.getOrCreateSession(params.shopObjectId, {
      conversationId: params.conversationId,
      buyerUserId: params.buyerUserId,
      orderId: params.orderId,
    });
    return session.dispatchCatchUp({
      dispatchReason: params.dispatchReason,
      operatorInstruction: params.operatorInstruction,
      currentMessageId: params.currentMessageId,
      currentMessageIndex: params.currentMessageIndex,
      source: "panel",
      admissionMode: "bypass",
      useMessageDelta: params.useMessageDelta,
      currentMessageCursor:
        params.currentMessageId ||
        params.currentMessageIndex ||
        params.currentMessageCreateTime != null
          ? {
              messageId: params.currentMessageId,
              messageIndex: params.currentMessageIndex,
              createTime: params.currentMessageCreateTime,
            }
          : undefined,
    });
  }

  /** Get existing session or create a new one. */
  async getOrCreateSession(
    shopObjectId: string,
    params: { conversationId: string; buyerUserId?: string; imUserId?: string; orderId?: string },
  ): Promise<CustomerServiceSession> {
    const existing = this.sessions.get(params.conversationId);
    if (existing) return existing;
    const inFlight = this.sessionCreations.get(params.conversationId);
    if (inFlight) return inFlight;

    const shop = this.findShopByObjectId(shopObjectId);
    if (!shop) throw new Error(`No shop context for objectId ${shopObjectId}`);

    const creation = this.createAndStoreSession(shop, shopObjectId, params);
    this.sessionCreations.set(params.conversationId, creation);
    try {
      return await creation;
    } finally {
      if (this.sessionCreations.get(params.conversationId) === creation) {
        this.sessionCreations.delete(params.conversationId);
      }
    }
  }

  private async createAndStoreSession(
    shop: CSShopContext,
    shopObjectId: string,
    params: { conversationId: string; buyerUserId?: string; imUserId?: string; orderId?: string },
  ): Promise<CustomerServiceSession> {
    const csContext = {
      shopId: shopObjectId,
      conversationId: params.conversationId,
      // Manual starts no longer need buyerUserId — resolve it from conversation
      // details before the session becomes visible to the gateway/tools.
      buyerUserId: params.buyerUserId ?? params.imUserId ?? "",
      imUserId: params.imUserId,
      orderId: params.orderId,
    };

    let session!: CustomerServiceSession;
    session = new CustomerServiceSession(shop, csContext, {
      defaultRunProfileId: this.opts.defaultRunProfileId,
      locale: () => this.opts.locale,
      acquireRunAdmission: (request) => this.automaticRunAdmission.acquire(request),
      onRunDispatched: (runId, admissionLease, options) => {
        const existing = this.pendingRuns.get(runId);
        if (existing) {
          admissionLease?.release("duplicate_run_id");
          log.warn(`Ignoring duplicate CS run registration for runId=${runId}`);
          return;
        }
        const pending = {
          shopObjectId,
          conversationId: params.conversationId,
          session,
          acceptedAt: Date.now(),
          admissionLease,
        };
        this.pendingRuns.set(runId, pending);
        if (options?.reconcileImmediately) {
          log.info(`Reconciling cached CS run immediately: runId=${runId}`);
          void this.reconcilePendingRun(runId, pending, this.gatewayGeneration);
        }
      },
    });

    // Resolve platform buyer ID and recent orders before session is usable
    await session.ensureContextResolved();

    this.sessions.set(params.conversationId, session);
    return session;
  }

  /** Shallow equality check for CSShopContext to avoid unnecessary updates. */
  private shopContextEqual(a: CSShopContext, b: CSShopContext): boolean {
    return (
      a.objectId === b.objectId &&
      a.platformShopId === b.platformShopId &&
      a.platform === b.platform &&
      a.systemPrompt === b.systemPrompt &&
      a.csProviderOverride === b.csProviderOverride &&
      a.csModelOverride === b.csModelOverride &&
      a.runProfileId === b.runProfileId
    );
  }
}
