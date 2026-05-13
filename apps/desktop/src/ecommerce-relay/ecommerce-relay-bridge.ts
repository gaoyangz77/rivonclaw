import { createLogger } from "@rivonclaw/logger";
import type { GatewayEventFrame } from "@rivonclaw/gateway";
import {
  type CSNewMessageFrame,
  stripReasoningTagsFromText,
} from "@rivonclaw/core";
import { CustomerServiceSession, type CSShopContext, type Escalation } from "../cs-bridge/customer-service-session.js";
import { reaction, toJS } from "mobx";
import type {
  AffiliateConversationSignalPayload,
  AffiliateWorkItemPayload,
  CsConversationSignalPayload,
  CsEscalationEventDeliveryPayload,
} from "../cloud/backend-subscription-client.js";

// Re-export for consumers that imported CSShopContext from this file
export type { CSShopContext } from "../cs-bridge/customer-service-session.js";
import { rootStore } from "../app/store/desktop-store.js";
import { runtimeStatusStore } from "../app/store/runtime-status-store.js";
import { normalizePlatform } from "../utils/platform.js";
import { emitCsError, CS_ERROR_STAGE } from "../telemetry/cs-telemetry-ref.js";
import { AffiliateInbound } from "../affiliate/affiliate-inbound.js";

const log = createLogger("ecommerce-relay");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EcommerceRelayBridgeOptions {
  gatewayId: string;
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

  /** Shop context keyed by platformShopId (from webhook). */
  private shopContexts = new Map<string, CSShopContext>();

  /** Long-lived sessions keyed by conversationId. Reused across messages. */
  private sessions = new Map<string, CustomerServiceSession>();

  /** Affiliate inbound frame handler. Owns affiliate shop contexts and sessions. */
  private affiliateInbound = new AffiliateInbound();

  /** Pending agent runs keyed by runId, used to auto-forward final text to buyer. */
  private pendingRuns = new Map<string, { shopObjectId: string; conversationId: string }>();

  /** Entity cache subscription unsubscribe function. */
  private cacheUnsubscribe: (() => void) | null = null;

  constructor(private readonly opts: EcommerceRelayBridgeOptions) {}

  // -- Public API ------------------------------------------------------------

  async start(): Promise<void> {
    this.closed = false;
    this.subscribeToCacheChanges();
    this.syncFromCache();
    runtimeStatusStore.setCsBridgeConnected();
    log.info("Ecommerce signal bridge started");
  }

  stop(): void {
    this.closed = true;
    // Unsubscribe from entity cache
    if (this.cacheUnsubscribe) {
      this.cacheUnsubscribe();
      this.cacheUnsubscribe = null;
    }
    runtimeStatusStore.setCsBridgeDisconnected();
    log.info("Ecommerce signal bridge stopped");
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
    const shops = rootStore.shops;
    const deviceId = this.opts.gatewayId;

    // Build the set of shops that should be active for each service.
    const activeCsShopIds = new Set<string>();
    const activeAffiliateShops: Array<{
      id: string;
      platform?: string | null;
      platformShopId?: string | null;
      shopName?: string | null;
      runProfileId?: string | null;
      businessPrompt?: string | null;
    }> = [];

    for (const shop of shops) {
      const platformShopId = shop.platformShopId;
      if (!platformShopId) continue;

      const affiliateService = shop.services?.affiliateService;
      if (affiliateService?.enabled && affiliateService.csDeviceId === deviceId) {
        activeAffiliateShops.push({
          id: shop.id,
          platform: shop.platform,
          platformShopId,
          shopName: shop.shopName,
          runProfileId: affiliateService.runProfileId,
          businessPrompt: affiliateService.businessPrompt,
        });
      }

      const cs = shop.services?.customerService;
      if (!cs?.enabled || !shop.handlesCustomerServiceOnDevice(deviceId)) continue;
      // The shop MST composes the final prompt locally from its own
      // `platformSystemPrompt` (embedded by the backend on each shop
      // response) and the user-owned `businessPrompt`. A null result means
      // CS is disabled or the shop payload has not arrived yet — skip
      // until it's ready.
      const assembledPrompt = cs.assembledPrompt;
      if (!assembledPrompt) {
        log.info(`Shop ${shop.shopName} (${shop.id}) has no assembledPrompt yet, skipping`);
        continue;
      }

      activeCsShopIds.add(platformShopId);

      // Check if context needs updating
      const existing = this.shopContexts.get(platformShopId);
      const newCtx: CSShopContext = {
        objectId: shop.id,
        platformShopId,
        shopName: shop.shopName ?? platformShopId,
        platform: normalizePlatform(shop.platform),
        systemPrompt: assembledPrompt,
        csProviderOverride: cs.csProviderOverride ?? undefined,
        csModelOverride: cs.csModelOverride ?? undefined,
        runProfileId: cs.runProfileId ?? undefined,
      };

      if (!existing || !this.shopContextEqual(existing, newCtx)) {
        this.setShopContext(newCtx);
      }
    }

    // Remove shops that are no longer active
    for (const [platformShopId] of this.shopContexts) {
      if (!activeCsShopIds.has(platformShopId)) {
        log.info(`Shop ${platformShopId} no longer active in cache, removing context`);
        this.removeShopContext(platformShopId);
      }
    }

    this.affiliateInbound.syncFromShops(activeAffiliateShops);
  }

  /**
   * Handle gateway events forwarded from the RPC client's onEvent callback.
   *
   * Processes two event types:
   * - `agent` events: per-turn text forwarding. On each turn boundary (tool-start
   *   or lifecycle-end), the accumulated-but-unsent text is forwarded to the buyer
   *   as a separate message. This gives the buyer incremental responses instead of
   *   one large blob at run completion.
   * - `chat` events with `state: "final"`: run lifecycle cleanup. Text
   *   forwarding is handled by agent events, so the chat handler no longer
   *   sends text.
   */
  onGatewayEvent(evt: GatewayEventFrame): void {
    if (evt.event === "agent") {
      this.onAgentEvent(evt);
      return;
    }

    if (evt.event !== "chat") return;

    const payload = evt.payload as {
      runId?: string;
      state?: string;
    } | undefined;
    if (!payload?.runId) return;

    const pending = this.pendingRuns.get(payload.runId);
    if (!pending) {
      this.affiliateInbound.handleGatewayEvent(evt);
      return;
    }

    if (payload.state === "final" || payload.state === "error") {
      this.pendingRuns.delete(payload.runId);

      const session = this.sessions.get(pending.conversationId);

      const completion = session?.onRunCompleted(payload.runId);
      const wasAborted = completion?.wasAborted ?? false;
      if (wasAborted) {
        log.info(`Run ${payload.runId} was aborted, skipping auto-forward`);
      } else if (payload.state === "error") {
        // Non-aborted error: log only, no fallback — fail fast so issues surface immediately.
        // Emit cs.error only for runs that produced zero output — the buyer
        // is left hanging and ops needs to see it. If text was already
        // forwarded, the run was at least partially useful.
        if (!completion?.hadForwardedText) {
          log.warn(`Agent run ${payload.runId} ended with error and no text was forwarded`);
          session?.emitError(CS_ERROR_STAGE.RUN_ERROR, {
            reason: "no_text",
            runId: payload.runId,
          });
        } else {
          log.warn(`Agent run ${payload.runId} ended with error (text was previously forwarded)`);
        }
      }

      // Safety-net cleanup of turn buffer (normally already flushed by agent events)
      session?.clearTurnText(payload.runId);
    }
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
    const payload = evt.payload as {
      runId?: string;
      stream?: string;
      data?: Record<string, unknown>;
    } | undefined;
    if (!payload?.runId) return;

    const { runId, stream, data } = payload;
    if (!stream || !data) return;

    // Only process events for CS runs (those in pendingRuns)
    const pending = this.pendingRuns.get(runId);
    if (!pending) return;

    if (stream === "assistant") {
      const text = data.text;
      if (typeof text === "string") {
        this.sessions.get(pending.conversationId)?.noteTurnText(runId, text);
      }
      return;
    }

    if (stream === "tool" && data.phase === "start") {
      this.flushTurnText(runId, pending.conversationId);
      return;
    }

    if (stream === "lifecycle") {
      if (data.phase === "end" || data.phase === "error") {
        // Flush any buffered text before clearing — ensures partial
        // responses reach the buyer even when the run errors out.
        this.flushTurnText(runId, pending.conversationId);
        this.sessions.get(pending.conversationId)?.clearTurnText(runId);
      }
    }
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
  private flushTurnText(runId: string, conversationId: string): void {
    const session = this.sessions.get(conversationId);
    if (!session) return;
    let text = session.takeTurnText(runId).trim();
    if (!text) return;

    // Don't forward for aborted runs
    if (session.isRunAborted(runId)) return;

    // Strip internal protocol/tool scaffolding that occasionally leaks into
    // assistant text streams before we evaluate whether anything meaningful
    // remains to send to the buyer.
    text = this.sanitizeForwardedText(text);
    if (!text) {
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
    session.markRunDeliveryStarted(runId);
    session.forwardTextToBuyer(text, runId)
      .catch((err) => {
        if (session.isRunAborted(runId)) {
          log.info(`Run ${runId} was aborted during delivery, skipping`);
          return;
        }
        void session.handleRunDeliveryFailure({
          runId,
          text,
          error: err,
        }).catch((recoveryErr) => {
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
    const hasErrorPattern = EcommerceRelayBridge.RUNTIME_ERROR_PATTERNS.some(
      (pattern) => pattern.test(text),
    );
    if (!hasErrorPattern) return text;

    // Split into lines and find where the error message starts
    const lines = text.split("\n");
    const cleanLines: string[] = [];
    for (const line of lines) {
      const isErrorLine = EcommerceRelayBridge.RUNTIME_ERROR_PATTERNS.some(
        (pattern) => pattern.test(line),
      );
      if (isErrorLine) break;
      cleanLines.push(line);
    }

    const cleaned = cleanLines.join("\n").trim();
    if (cleaned) {
      log.info(`Stripped runtime error suffix from agent text (${text.length} → ${cleaned.length} chars)`);
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
    let cleaned = stripReasoningTagsFromText(text, { mode: "preserve", trim: "both" });

    // Drop fenced JSON/code examples entirely. Buyer-facing CS replies should
    // never contain tool-call payload examples, and those blocks are a common
    // way leaked protocol text shows up in the stream.
    cleaned = cleaned.replace(/```[\s\S]*?```/g, " ");

    const keptLines = cleaned
      .split("\n")
      .map((line) => line.trim())
      .map((line) => {
        if (!line) return "";
        if (EcommerceRelayBridge.INTERNAL_PROTOCOL_LINE_PATTERNS.some((pattern) => pattern.test(line))) {
          return "";
        }
        return line;
      });

    cleaned = keptLines.join("\n").trim();
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

    // If the remaining text is still overwhelmingly machine/protocol-like,
    // drop it instead of risking an invalid or embarrassing buyer message.
    if (!cleaned) return "";
    if (!/[\p{L}\p{N}]/u.test(cleaned)) return "";
    return cleaned;
  }

  // -- Entity cache subscription ---------------------------------------------

  private subscribeToCacheChanges(): void {
    // Avoid double-subscribe
    if (this.cacheUnsubscribe) return;

    this.cacheUnsubscribe = reaction(
      () => toJS(rootStore.shops),
      () => this.syncFromCache(),
    );
  }

  // -- Backend signal handling -----------------------------------------------

  async handleCsConversationSignal(signal: CsConversationSignalPayload): Promise<void> {
    this.syncFromCache();
    log.info(
      `CS signal: type=${signal.type} shop=${signal.platformShopId} ` +
      `conv=${signal.conversationId} msg=${signal.messageId ?? ""}`,
    );

    const shop = this.shopContexts.get(signal.platformShopId);
    if (!shop) {
      log.info(`Ignoring CS signal for inactive/non-owned-device shop ${signal.platformShopId}`);
      emitCsError(CS_ERROR_STAGE.DISPATCH, {
        platformShopId: signal.platformShopId,
        conversationId: signal.conversationId,
        reason: "no_shop_context",
      });
      return;
    }

    const session = await this.getOrCreateSession(shop.objectId, {
      conversationId: signal.conversationId,
      buyerUserId: signal.buyerUserId ?? signal.imUserId ?? undefined,
      imUserId: signal.imUserId ?? undefined,
      orderId: signal.orderId ?? undefined,
    });

    try {
      await session.dispatchCatchUp({
        operatorInstruction: signal.operatorInstruction ?? undefined,
        currentMessageId: signal.messageId ?? undefined,
      });
    } catch (err) {
      log.error(`Failed to handle CS signal ${signal.messageId ?? signal.conversationId}:`, err);
      session.emitError(CS_ERROR_STAGE.DISPATCH, {
        reason: "unhandled_exception",
        errorMessage: err,
      });
    }
  }

  async handleAffiliateConversationSignal(signal: AffiliateConversationSignalPayload): Promise<void> {
    this.syncFromCache();
    log.info(
      `Affiliate signal: type=${signal.type} shop=${signal.platformShopId} ` +
      `conv=${signal.conversationId ?? ""} msg=${signal.messageId ?? ""}`,
    );

    await this.affiliateInbound.handleSignal(signal);
  }

  async handleAffiliateWorkItemChanged(workItem: AffiliateWorkItemPayload): Promise<void> {
    this.syncFromCache();
    log.info(
      `Affiliate work item: kind=${workItem.workKind} shop=${workItem.platformShopId} ` +
      `collaboration=${workItem.collaborationRecordId} status=${workItem.processingStatus}`,
    );

    await this.affiliateInbound.handleWorkItem(workItem);
  }

  /**
   * Test/compatibility helper for the old relay frame path. Production webhook
   * delivery now arrives through `handleCsConversationSignal`, whose payload is
   * intentionally business-level and content-free.
   */
  private async onNewMessage(frame: CSNewMessageFrame): Promise<void> {
    const shop = this.shopContexts.get(frame.shopId);
    if (!shop) {
      log.error(`No shop context for platform shopId ${frame.shopId}, dropping message`);
      emitCsError(CS_ERROR_STAGE.DISPATCH, {
        platformShopId: frame.shopId,
        conversationId: frame.conversationId,
        reason: "no_shop_context",
      });
      return;
    }

    const session = await this.getOrCreateSession(shop.objectId, {
      conversationId: frame.conversationId,
      buyerUserId: frame.imUserId,
      imUserId: frame.imUserId,
      orderId: frame.orderId,
    });

    try {
      await session.handleBuyerMessage(frame);
    } catch (err) {
      log.error(`Failed to handle buyer message ${frame.messageId}:`, err);
      session.emitError(CS_ERROR_STAGE.DISPATCH, {
        reason: "unhandled_exception",
        errorMessage: err,
      });
    }
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
  findEscalationById(escalationId: string): { escalation: Escalation; conversationId: string; shopId: string; buyerUserId: string } | undefined {
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
    operatorInstruction?: string;
    currentMessageId?: string;
  }) {
    const session = await this.getOrCreateSession(params.shopObjectId, {
      conversationId: params.conversationId,
      buyerUserId: params.buyerUserId,
      orderId: params.orderId,
    });
    return session.dispatchCatchUp({
      operatorInstruction: params.operatorInstruction,
      currentMessageId: params.currentMessageId,
    });
  }

  /** Get existing session or create a new one. */
  async getOrCreateSession(
    shopObjectId: string,
    params: { conversationId: string; buyerUserId?: string; imUserId?: string; orderId?: string },
  ): Promise<CustomerServiceSession> {
    const existing = this.sessions.get(params.conversationId);
    if (existing) return existing;

    const shop = this.findShopByObjectId(shopObjectId);
    if (!shop) throw new Error(`No shop context for objectId ${shopObjectId}`);

    return this.createAndStoreSession(shop, shopObjectId, params);
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

    const session = new CustomerServiceSession(shop, csContext, {
      defaultRunProfileId: this.opts.defaultRunProfileId,
      onRunDispatched: (runId) => {
        this.pendingRuns.set(runId, { shopObjectId, conversationId: params.conversationId });
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
