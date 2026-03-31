import { WebSocket } from "ws";
import { createLogger } from "@rivonclaw/logger";
import type { GatewayEventFrame } from "@rivonclaw/gateway";
import {
  type CSHelloFrame,
  type CSBindShopsFrame,
  type CSBindShopsResultFrame,
  type CSShopTakenOverFrame,
  type CSNewMessageFrame,
  type CSNewConversationFrame,
  type CSWSFrame,
  type CSAdminDirectiveParams,
  type CSEscalateParams,
} from "@rivonclaw/core";
import { getRpcClient } from "../gateway/rpc-client-ref.js";
import { getAuthSession } from "../auth/auth-session-ref.js";
import { CustomerServiceSession } from "./customer-service-session.js";
import { getProviderKeysStore } from "../gateway/provider-keys-ref.js";
import { reaction, toJS } from "mobx";
import { rootStore } from "../store/desktop-store.js";
import { normalizePlatform } from "../utils/platform.js";

const log = createLogger("cs-bridge");

/**
 * GraphQL mutation for auto-forwarding agent text to buyer.
 * Must match EcommerceResolver.ecommerceSendMessage signature in the backend.
 */
const SEND_MESSAGE_MUTATION = `
  mutation($shopId: String!, $conversationId: String!, $type: String!, $content: String!) {
    ecommerceSendMessage(shopId: $shopId, conversationId: $conversationId, type: $type, content: $content) {
      code message data
    }
  }
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shop data needed by the CS bridge (resolved by desktop, not by bridge). */
export interface CSShopContext {
  /** MongoDB ObjectId -- used for backend API calls and prompt assembly. */
  objectId: string;
  /** Platform shop ID (TikTok's ID) -- matches webhook shop_id. */
  platformShopId: string;
  /** Normalized short platform name for session keys (e.g., "tiktok"). Defaults to "tiktok". */
  platform?: string;
  /** Assembled CS system prompt for this shop. */
  systemPrompt: string;
  /** Provider override for CS sessions (e.g., "zhipu"). Used with csModelOverride. Undefined = use global default provider. */
  csProviderOverride?: string;
  /** LLM model override for CS sessions (e.g., "glm-5"). Undefined = use global default. */
  csModelOverride?: string;
  /** RunProfile ID configured for this shop's CS sessions. When set, tool IDs are read from the cached profile. */
  runProfileId?: string;
}

interface CustomerServiceBridgeOptions {
  relayUrl: string;
  gatewayId: string;
  /** Default RunProfile ID for CS sessions (fallback when shop has no runProfileId). */
  defaultRunProfileId?: string;
}

// ---------------------------------------------------------------------------
// CustomerServiceBridge
// ---------------------------------------------------------------------------

/**
 * Desktop-side bridge that connects to the CS relay WebSocket,
 * receives buyer messages, and dispatches agent runs via the gateway RPC.
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
 * or change, it syncs shop contexts and manages the relay connection
 * accordingly. No explicit push of shop contexts is needed.
 */
export class CustomerServiceBridge {
  private ws: WebSocket | null = null;
  private closed = false;
  private authenticated = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;

  /** Shop context keyed by platformShopId (from webhook). */
  private shopContexts = new Map<string, CSShopContext>();

  /** Shops currently bound to other devices (from last cs_bind_shops_result). */
  private bindingConflicts: Array<{ shopId: string; gatewayId: string }> = [];

  /** Pending agent runs keyed by runId, used to auto-forward final text to buyer. */
  private pendingRuns = new Map<string, { shopObjectId: string; conversationId: string }>();

  /** Conversations with an active agent run -- prevents duplicate dispatches. */
  private activeConversations = new Set<string>();

  /** Entity cache subscription unsubscribe function. */
  private cacheUnsubscribe: (() => void) | null = null;

  constructor(private readonly opts: CustomerServiceBridgeOptions) {}

  // -- Public API ------------------------------------------------------------

  async start(): Promise<void> {
    this.closed = false;
    this.reconnectAttempt = 0;
    // Subscribe to entity cache for reactive shop sync
    this.subscribeToCacheChanges();
    // Perform initial sync in case shops are already in cache
    this.syncFromCache();
    // Only connect to relay if we have shop contexts
    if (this.shopContexts.size > 0) {
      await this.connect();
    } else {
      log.info("CS bridge started, waiting for shops to appear in entity cache");
    }
  }

  stop(): void {
    this.closed = true;
    // Unsubscribe from entity cache
    if (this.cacheUnsubscribe) {
      this.cacheUnsubscribe();
      this.cacheUnsubscribe = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempt = 0;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    log.info("CS bridge stopped");
  }

  /**
   * Register or update shop context. Called by desktop on startup (for all
   * CS-enabled shops) and when the user modifies businessPrompt in Panel.
   * Also sends a binding frame to the relay for the new/updated shop.
   */
  setShopContext(ctx: CSShopContext): void {
    this.shopContexts.set(ctx.platformShopId, ctx);
    log.info(`Shop context set: platform=${ctx.platformShopId} object=${ctx.objectId}`);
    // Send binding for the newly added/updated shop
    this.sendShopBindings([ctx.platformShopId]);
  }

  /** Remove shop context (shop disconnected/deleted). */
  removeShopContext(platformShopId: string): void {
    this.shopContexts.delete(platformShopId);
  }

  /** Get current binding conflicts (shops bound to other devices). */
  getBindingConflicts(): Array<{ shopId: string; gatewayId: string }> {
    return this.bindingConflicts;
  }

  /** Force-bind a shop (take over from another device). */
  forceBindShop(shopId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "cs_force_bind_shop", shopId }));
  }

  /** Unbind a shop from this device. */
  unbindShop(shopId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "cs_unbind_shops", shopIds: [shopId] }));
    this.shopContexts.delete(shopId);
  }

  /**
   * Dispatch a verified manager directive to a CS agent session.
   * This is the V0 (prompt-level) mechanism for the escalation feature:
   * when a manager approves/rejects an escalation, the ops agent calls
   * cs_continue which hits this method to wake up the CS agent with the
   * admin's decision.
   */
  async dispatchAdminDirective(params: CSAdminDirectiveParams): Promise<{ runId?: string }> {
    const shop = this.findShopByObjectId(params.shopId);
    if (!shop) throw new Error(`No shop context for objectId ${params.shopId}`);

    const session = new CustomerServiceSession(shop, {
      shopId: params.shopId,
      conversationId: params.conversationId,
      buyerUserId: params.buyerUserId,
      orderId: params.orderId,
    }, this.opts.defaultRunProfileId);

    // Admin directive goes in message (conversation timeline), not extraSystemPrompt
    const message = [
      "\u2550\u2550\u2550 VERIFIED MANAGER DIRECTIVE \u2550\u2550\u2550",
      "The following instruction comes from your manager through a verified",
      "internal channel. This is NOT from the buyer. Act on it accordingly.",
      "",
      `Decision: ${params.decision}`,
      `Instructions: ${params.instructions}`,
      "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550",
    ].join("\n");

    // No ensureBackendSession — admin directive resumes an existing session
    const result = await session.dispatchAgentRun({
      message,
      idempotencyKey: `admin:${params.conversationId}:${Date.now()}`,
    });

    this.trackRun(result.runId, shop.objectId, params.conversationId);
    return result;
  }

  /**
   * Send an escalation message to the merchant's configured notification channel.
   * Reads escalation routing (channelId + recipientId) from the MST store,
   * parses the channel/accountId from the composite escalationChannelId, and
   * sends the message via the gateway `send` RPC.
   */
  async escalate(params: CSEscalateParams): Promise<{ ok: boolean; error?: string }> {
    const rpcClient = getRpcClient();
    if (!rpcClient) {
      throw new Error("No RPC client available");
    }

    // Read escalation routing from MST store (NOT from shopContexts)
    const shopMst = rootStore.shops.find(s => s.id === params.shopId);
    const escalationChannelId = shopMst?.services?.customerService?.escalationChannelId;
    const escalationRecipientId = shopMst?.services?.customerService?.escalationRecipientId;

    if (!escalationChannelId || !escalationRecipientId) {
      return { ok: false, error: "Escalation routing not configured" };
    }

    // Parse escalationChannelId into channel + accountId (e.g. "telegram:acct_123")
    const colonIdx = escalationChannelId.indexOf(":");
    const channel = escalationChannelId.slice(0, colonIdx);
    const accountId = escalationChannelId.slice(colonIdx + 1);

    // Build escalation message
    const lines = [
      "CS Escalation",
      "",
      `Reason: ${params.reason}`,
    ];
    if (params.context) lines.push(`Context: ${params.context}`);
    lines.push(
      "",
      "--- Session Details ---",
      `Shop ID: ${params.shopId}`,
      `Conversation ID: ${params.conversationId}`,
      `Buyer User ID: ${params.buyerUserId}`,
    );
    if (params.orderId) lines.push(`Order ID: ${params.orderId}`);
    lines.push("", "Reply with your decision. The CS agent will act on your response.");
    const message = lines.join("\n");

    // Send via gateway RPC
    await rpcClient.request("send", {
      to: escalationRecipientId,
      channel,
      accountId,
      message,
      idempotencyKey: `cs-escalate:${params.conversationId}:${Date.now()}`,
    });

    log.info(`Escalation sent for conversation ${params.conversationId} via ${channel}`);
    return { ok: true };
  }

  /**
   * Manually start a CS session for a conversation (catch-up for missed webhooks).
   * Creates a CustomerServiceSession, checks backend balance, and dispatches
   * an agent run instructing the agent to review the conversation history.
   */
  async startSession(params: {
    shopId: string;
    conversationId: string;
    buyerUserId: string;
    orderId?: string;
  }): Promise<{ runId?: string }> {
    const shop = this.findShopByObjectId(params.shopId);
    if (!shop) throw new Error(`No shop context for objectId ${params.shopId}`);

    const session = new CustomerServiceSession(shop, {
      shopId: params.shopId,
      conversationId: params.conversationId,
      buyerUserId: params.buyerUserId,
      orderId: params.orderId,
    }, this.opts.defaultRunProfileId);

    if (!await session.ensureBackendSession()) {
      throw new Error("Failed to create backend CS session (insufficient balance?)");
    }
    this.activeConversations.add(params.conversationId);

    const result = await session.dispatchAgentRun({
      message: "A customer is waiting for a response in this conversation. Review the conversation history using your tools and respond to any unanswered messages.",
      idempotencyKey: `cs-start:${params.conversationId}:${Date.now()}`,
    });

    this.trackRun(result.runId, shop.objectId, params.conversationId);
    return result;
  }

  /**
   * Sync shop contexts from entity cache. Reads all cached shops, filters
   * for CS-enabled shops bound to this device, and updates the internal
   * shopContexts map. Also manages relay connection lifecycle:
   * - Connects if shops appeared and relay is not connected
   * - Disconnects if all shops were removed
   */
  syncFromCache(): void {
    const shops = rootStore.shops;
    const deviceId = this.opts.gatewayId;

    // Build the set of shops that should be active
    const activeShopIds = new Set<string>();

    for (const shop of shops) {
      const cs = shop.services?.customerService;
      if (!cs?.enabled) continue;
      if (cs.csDeviceId !== deviceId) continue;
      if (!cs.assembledPrompt) {
        log.info(`Shop ${shop.shopName} (${shop.id}) has no assembledPrompt yet, skipping`);
        continue;
      }

      const platformShopId = shop.platformShopId;
      activeShopIds.add(platformShopId);

      // Check if context needs updating
      const existing = this.shopContexts.get(platformShopId);
      const newCtx: CSShopContext = {
        objectId: shop.id,
        platformShopId,
        platform: normalizePlatform(shop.platform),
        systemPrompt: cs.assembledPrompt,
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
      if (!activeShopIds.has(platformShopId)) {
        log.info(`Shop ${platformShopId} no longer active in cache, removing context`);
        this.removeShopContext(platformShopId);
      }
    }
  }

  /**
   * Handle gateway events forwarded from the RPC client's onEvent callback.
   * Watches for `chat` events with `state: "final"` to auto-forward agent
   * text output to the buyer -- removing the need for a dedicated send_message tool.
   */
  onGatewayEvent(evt: GatewayEventFrame): void {
    if (evt.event !== "chat") return;

    const payload = evt.payload as {
      runId?: string;
      state?: string;
      message?: {
        role?: string;
        content?: Array<{ type?: string; text?: string }>;
      };
    } | undefined;
    if (!payload?.runId) return;

    const pending = this.pendingRuns.get(payload.runId);
    if (!pending) return;

    if (payload.state === "final") {
      this.activeConversations.delete(pending.conversationId);
      this.pendingRuns.delete(payload.runId);

      const agentText = payload.message?.content
        ?.filter((c) => c.type === "text" && c.text)
        .map((c) => c.text!.trim())
        .join("\n")
        .trim();

      if (agentText) {
        this.forwardTextToBuyer(pending.shopObjectId, pending.conversationId, agentText)
          .catch((err) => log.error("Failed to auto-forward agent text:", err));
      }
    } else if (payload.state === "error") {
      this.activeConversations.delete(pending.conversationId);
      this.pendingRuns.delete(payload.runId);
      log.warn(`Agent run ${payload.runId} ended with error, skipping auto-forward`);
    }
  }

  // -- Entity cache subscription ---------------------------------------------

  private subscribeToCacheChanges(): void {
    // Avoid double-subscribe
    if (this.cacheUnsubscribe) return;

    this.cacheUnsubscribe = reaction(
      () => toJS(rootStore.shops),
      () => this.onShopsChanged(),
    );
  }

  private onShopsChanged(): void {
    const hadShops = this.shopContexts.size > 0;
    this.syncFromCache();
    const hasShops = this.shopContexts.size > 0;

    // Connect to relay if shops appeared and we aren't connected
    if (!hadShops && hasShops && !this.ws && !this.closed) {
      log.info("Shops appeared in entity cache, connecting to CS relay");
      this.connect().catch((err) => {
        log.warn(`CS bridge connect on shop appearance failed: ${(err as Error).message ?? err}`);
      });
    }

    // Disconnect from relay if all shops removed
    if (hadShops && !hasShops && this.ws) {
      log.info("All shops removed from entity cache, disconnecting from CS relay");
      this.ws.close();
      this.ws = null;
      this.authenticated = false;
    }
  }

  // -- Connection management -------------------------------------------------

  private async connect(): Promise<void> {
    if (this.closed) return;

    const token = getAuthSession()?.getAccessToken() ?? null;
    if (!token) {
      log.warn("No auth token available, scheduling reconnect");
      this.scheduleReconnect();
      return;
    }

    return new Promise<void>((resolve) => {
      log.info(`Connecting to CS relay at ${this.opts.relayUrl}...`);

      const ws = new WebSocket(this.opts.relayUrl);
      this.ws = ws;

      ws.on("open", () => {
        log.info("CS relay WebSocket open, sending cs_hello");
        const hello: CSHelloFrame = {
          type: "cs_hello",
          gateway_id: this.opts.gatewayId,
          auth_token: token!,
        };
        ws.send(JSON.stringify(hello));
      });

      ws.on("message", (data) => {
        try {
          const frame = JSON.parse(data.toString()) as CSWSFrame;
          this.onFrame(frame);
        } catch (err) {
          log.warn("Failed to parse CS relay message:", err);
        }
      });

      ws.on("close", (code, reason) => {
        log.info(`CS relay WebSocket closed: ${code} ${reason.toString()}`);
        this.ws = null;
        this.authenticated = false;
        if (!this.closed) {
          this.scheduleReconnect();
        }
        resolve();
      });

      ws.on("error", (err) => {
        log.warn(`CS relay WebSocket error: ${err.message}`);
      });
    });
  }

  private scheduleReconnect(): void {
    if (this.closed) return;

    const baseDelay = 1000;
    const maxDelay = 30000;
    const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempt), maxDelay);
    this.reconnectAttempt++;

    log.info(`CS bridge reconnect in ${delay}ms (attempt ${this.reconnectAttempt})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((err) => {
        log.warn(`CS bridge reconnect failed: ${(err as Error).message ?? err}`);
      });
    }, delay);
  }

  // -- Frame dispatch --------------------------------------------------------

  private onFrame(frame: CSWSFrame): void {
    switch (frame.type) {
      // Wire-format identifiers from the relay server — not platform-specific restrictions.
      case "cs_tiktok_new_message":
        this.onNewMessage(frame as CSNewMessageFrame).catch((err) => {
          log.error("Error handling CS message:", err);
        });
        break;
      case "cs_tiktok_new_conversation":
        log.info(
          `New CS conversation: shop=${(frame as CSNewConversationFrame).shopId} ` +
          `conv=${(frame as CSNewConversationFrame).conversationId}`,
        );
        break;
      case "cs_ack":
        this.reconnectAttempt = 0;
        this.authenticated = true;
        log.info("CS relay connection confirmed (cs_ack)");
        // Bind all CS-enabled shops after relay confirms connection
        this.sendShopBindings();
        break;
      case "cs_bind_shops_result": {
        const result = frame as CSBindShopsResultFrame;
        if (result.bound.length > 0) {
          log.info(`Shops bound: ${result.bound.join(", ")}`);
        }
        if (result.conflicts.length > 0) {
          log.warn(`Shop binding conflicts: ${result.conflicts.map(c => c.shopId).join(", ")}`);
        }
        this.bindingConflicts = result.conflicts;
        break;
      }
      case "cs_shop_taken_over": {
        const taken = frame as CSShopTakenOverFrame;
        log.warn(`Shop ${taken.shopId} taken over by gateway ${taken.newGatewayId}`);
        // Remove from local shop contexts so we stop handling messages for this shop
        this.shopContexts.delete(taken.shopId);
        break;
      }
      case "cs_error":
        log.error(`CS relay error: ${(frame as { message?: string }).message}`);
        break;
      default:
        break;
    }
  }

  // -- Shop binding ----------------------------------------------------------

  /**
   * Send cs_bind_shops frame to the relay.
   * If shopIds is provided, only those shops are sent; otherwise all known shops.
   */
  private sendShopBindings(shopIds?: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.authenticated) return;

    const ids = shopIds ?? [...this.shopContexts.values()].map(ctx => ctx.platformShopId);
    if (ids.length === 0) return;

    const frame: CSBindShopsFrame = {
      type: "cs_bind_shops",
      shopIds: ids,
    };
    this.ws.send(JSON.stringify(frame));
    log.info(`Sent shop bindings: ${ids.length} shop(s)`);
  }

  // -- Inbound message handling -----------------------------------------------

  private async onNewMessage(frame: CSNewMessageFrame): Promise<void> {
    // 1. Look up shop context (pre-loaded by desktop, keyed by platform shop ID)
    const shop = this.shopContexts.get(frame.shopId);
    if (!shop) {
      log.error(`No shop context for platform shopId ${frame.shopId}, dropping message`);
      return;
    }

    // 2. Skip if conversation already has an active agent run
    if (this.activeConversations.has(frame.conversationId)) {
      log.info(`Conversation ${frame.conversationId} already has active run, queuing message`);
      return;
    }

    // 3. Parse text content
    const textContent = this.parseMessageContent(frame);

    // 3a. Extract image attachment for multimodal LLM input
    let attachments: Array<{ mimeType: string; content: string }> | undefined;
    if (frame.messageType.toUpperCase() === "IMAGE") {
      try {
        const parsed = JSON.parse(frame.content) as { url?: string };
        if (parsed.url) {
          const res = await fetch(parsed.url);
          if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer());
            const mimeType = res.headers.get("content-type") ?? "image/jpeg";
            attachments = [{ mimeType, content: buffer.toString("base64") }];
          }
        }
      } catch (err) {
        log.warn("Failed to fetch buyer image, agent will see URL only", { err });
      }
    }

    // 4. Create session and ensure backend session exists (balance check)
    const session = new CustomerServiceSession(shop, {
      shopId: shop.objectId,
      conversationId: frame.conversationId,
      buyerUserId: frame.buyerUserId,
      orderId: frame.orderId,
    }, this.opts.defaultRunProfileId);

    if (!this.activeConversations.has(frame.conversationId)) {
      if (!await session.ensureBackendSession()) return;
      this.activeConversations.add(frame.conversationId);
    }

    // 5. Dispatch agent run
    try {
      const result = await session.dispatchAgentRun({
        message: textContent,
        idempotencyKey: `${session.platform}:${frame.messageId}`,
        attachments,
      });
      this.trackRun(result.runId, shop.objectId, frame.conversationId);
    } catch (err) {
      log.error(`Failed to dispatch agent run for message ${frame.messageId}:`, err);
    }
  }

  /**
   * Parse buyer message content from a relay frame.
   *
   * Platform-specific parsers can be dispatched here by shop.platform.
   * For now, all supported platforms use the same message type schema
   * (TEXT, IMAGE, ORDER_CARD).  When a platform with different message
   * types is added, extract per-platform parsers and dispatch here.
   *
   * Note: ORDER_CARD is currently TikTok-specific. If another platform
   * sends a different card format, it will fall through to the default
   * "[{messageType} message received]" branch, which is safe.
   */
  private parseMessageContent(frame: CSNewMessageFrame): string {
    if (frame.messageType.toUpperCase() === "TEXT") {
      // TEXT content is {"content": "simple text"} — extract the plain string
      try {
        const parsed = JSON.parse(frame.content) as Record<string, unknown>;
        if (typeof parsed.content === "string") return parsed.content;
        if (typeof parsed.text === "string") return parsed.text;
      } catch {
        // Not JSON — use raw content
      }
      return frame.content;
    }

    // All other types (IMAGE, ORDER_CARD, PRODUCT_CARD, VIDEO, LOGISTICS_CARD,
    // COUPON_CARD, BUYER_ENTER_FROM_*, ALLOCATED_SERVICE, etc.)
    // — pass raw content JSON prefixed with type so the agent knows what it is.
    return `[${frame.messageType}] ${frame.content}`;
  }

  // -- Auto-forward agent text to buyer ----------------------------------------

  /**
   * Send agent text output to the buyer via the backend GraphQL proxy.
   * Uses the platform-agnostic `ecommerceSendMessage` mutation -- the backend
   * resolver routes by shop.platform, so no platform dispatch is needed here.
   */
  private async forwardTextToBuyer(
    shopId: string,
    conversationId: string,
    text: string,
  ): Promise<void> {
    const authSession = getAuthSession();
    if (!authSession) {
      log.warn("No auth session available, cannot forward text to buyer");
      return;
    }
    await authSession.graphqlFetch(SEND_MESSAGE_MUTATION, {
      shopId,
      conversationId,
      type: "TEXT",
      content: JSON.stringify({ content: text }),
    });
    log.info(`Auto-forwarded agent text to buyer (${text.length} chars)`);
  }

  // -- Internal helpers -------------------------------------------------------

  /** Find a shop context by its MongoDB objectId. */
  private findShopByObjectId(objectId: string): CSShopContext | undefined {
    for (const shop of this.shopContexts.values()) {
      if (shop.objectId === objectId) return shop;
    }
    return undefined;
  }

  /** Track a dispatched agent run for auto-forwarding. */
  private trackRun(runId: string | undefined, shopObjectId: string, conversationId: string): void {
    if (runId) {
      this.activeConversations.add(conversationId);
      this.pendingRuns.set(runId, { shopObjectId, conversationId });
    }
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
