import { WebSocket } from "ws";
import { createLogger } from "@rivonclaw/logger";
import type { GatewayRpcClient } from "@rivonclaw/gateway";
import type {
  CSHelloFrame,
  CSBindShopsFrame,
  CSBindShopsResultFrame,
  CSShopTakenOverFrame,
  CSTikTokNewMessageFrame,
  CSTikTokNewConversationFrame,
  CSWSFrame,
} from "@rivonclaw/core";
import { TIKTOK_CS_TOOL_IDS, DEFAULT_PANEL_PORT } from "@rivonclaw/core";

const log = createLogger("cs-bridge");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shop data needed by the CS bridge (resolved by desktop, not by bridge). */
export interface CSShopContext {
  /** MongoDB ObjectId — used for backend API calls and prompt assembly. */
  objectId: string;
  /** Platform shop ID (TikTok's ID) — matches webhook shop_id. */
  platformShopId: string;
  /** Assembled CS system prompt for this shop. */
  systemPrompt: string;
}

interface CustomerServiceBridgeOptions {
  relayUrl: string;
  gatewayId: string;
  getAuthToken: () => string | null;
  getRpcClient: () => GatewayRpcClient | null;
  /** CS tool IDs for RunProfile restriction. Defaults to TIKTOK_CS_TOOL_IDS from core. */
  csToolIds?: readonly string[];
}

/** Base URL for the local panel HTTP server. */
const PANEL_BASE = `http://127.0.0.1:${DEFAULT_PANEL_PORT}`;

// ---------------------------------------------------------------------------
// CustomerServiceBridge
// ---------------------------------------------------------------------------

/**
 * Desktop-side bridge that connects to the TikTok CS relay WebSocket,
 * receives buyer messages, and dispatches agent runs via the gateway RPC.
 *
 * The bridge is intentionally thin — it does NOT fetch data from the backend.
 * All shop context (ObjectId, prompt) is provided by the desktop layer via
 * {@link setShopContext}. The agent replies directly using MCP tools.
 */
export class CustomerServiceBridge {
  private ws: WebSocket | null = null;
  private closed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;

  /** Shop context keyed by platformShopId (from webhook). */
  private shopContexts = new Map<string, CSShopContext>();

  /** Shops currently bound to other devices (from last cs_bind_shops_result). */
  private bindingConflicts: Array<{ shopId: string; gatewayId: string }> = [];

  constructor(private readonly opts: CustomerServiceBridgeOptions) {}

  // ── Public API ──────────────────────────────────────────────────────

  async start(): Promise<void> {
    this.closed = false;
    this.reconnectAttempt = 0;
    await this.connect();
  }

  stop(): void {
    this.closed = true;
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

  // ── Connection management ───────────────────────────────────────────

  private async connect(): Promise<void> {
    if (this.closed) return;

    const token = this.opts.getAuthToken();
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

  // ── Frame dispatch ──────────────────────────────────────────────────

  private onFrame(frame: CSWSFrame): void {
    switch (frame.type) {
      case "cs_tiktok_new_message":
        this.onTikTokMessage(frame).catch((err) => {
          log.error("Error handling TikTok message:", err);
        });
        break;
      case "cs_tiktok_new_conversation":
        log.info(
          `New TikTok conversation: shop=${(frame as CSTikTokNewConversationFrame).shopId} ` +
          `conv=${(frame as CSTikTokNewConversationFrame).conversationId}`,
        );
        break;
      case "cs_ack":
        this.reconnectAttempt = 0;
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

  // ── Shop binding ───────────────────────────────────────────────────

  /**
   * Send cs_bind_shops frame to the relay.
   * If shopIds is provided, only those shops are sent; otherwise all known shops.
   */
  private sendShopBindings(shopIds?: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const ids = shopIds ?? [...this.shopContexts.values()].map(ctx => ctx.platformShopId);
    if (ids.length === 0) return;

    const frame: CSBindShopsFrame = {
      type: "cs_bind_shops",
      shopIds: ids,
    };
    this.ws.send(JSON.stringify(frame));
    log.info(`Sent shop bindings: ${ids.length} shop(s)`);
  }

  // ── TikTok message handling ─────────────────────────────────────────

  private async onTikTokMessage(frame: CSTikTokNewMessageFrame): Promise<void> {
    const rpcClient = this.opts.getRpcClient();
    if (!rpcClient) {
      log.warn("No RPC client available, dropping TikTok message");
      return;
    }

    // 1. Look up shop context (pre-loaded by desktop, keyed by platform shop ID)
    const shop = this.shopContexts.get(frame.shopId);
    if (!shop) {
      log.error(`No shop context for platform shopId ${frame.shopId}, dropping message`);
      return;
    }

    // 2. Parse text content
    const textContent = this.parseMessageContent(frame);

    // 3. Build session keys
    // scopeKey: the full gateway-resolved key used for RunProfile storage and
    //           session registration (capability-manager queries with this key).
    // dispatchKey: the raw key passed to the agent RPC; gateway prepends
    //             "agent:main:" automatically, yielding the same scopeKey.
    const scopeKey = `agent:main:cs:tiktok:${frame.conversationId}`;
    const dispatchKey = `cs:tiktok:${frame.conversationId}`;

    // 4. Register CSSessionContext via gateway method
    try {
      await rpcClient.request("tiktok_cs_register_session", {
        sessionKey: scopeKey,
        csContext: {
          shopId: shop.objectId,
          conversationId: frame.conversationId,
          buyerUserId: frame.buyerUserId,
          orderId: frame.orderId,
        },
      });
    } catch (err) {
      log.error(`Failed to register CS session ${scopeKey}, dropping message:`, err);
      return;
    }

    // 5. Set CS RunProfile (restricts tools to CS-only set)
    const csToolIds = this.opts.csToolIds ?? TIKTOK_CS_TOOL_IDS;
    try {
      await fetch(`${PANEL_BASE}/api/tools/run-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeKey,
          runProfile: { selectedToolIds: [...csToolIds] },
        }),
      });
    } catch (err) {
      log.error(`Failed to set CS RunProfile for ${scopeKey}:`, err);
      return;
    }

    // 6. Build extra system prompt
    const extraSystemPrompt = [
      shop.systemPrompt,
      "",
      "## Current Session",
      `- Shop ID: ${shop.objectId}`,
      `- Conversation ID: ${frame.conversationId}`,
      `- Buyer User ID: ${frame.buyerUserId}`,
      ...(frame.orderId ? [`- Order ID: ${frame.orderId}`] : []),
      "",
      "Use the tools available to you to help this buyer. Always reply using tiktok_cs_send_message tool.",
    ].join("\n");

    // 7. Dispatch agent run (gateway prepends "agent:main:" to dispatchKey)
    try {
      await rpcClient.request("agent", {
        sessionKey: dispatchKey,
        message: textContent,
        extraSystemPrompt,
        idempotencyKey: `tiktok:${frame.messageId}`,
      });
    } catch (err) {
      log.error(`Failed to dispatch agent run for message ${frame.messageId}:`, err);
    }
  }

  private parseMessageContent(frame: CSTikTokNewMessageFrame): string {
    const msgType = frame.messageType.toUpperCase();

    if (msgType === "TEXT") {
      try {
        const parsed = JSON.parse(frame.content) as Record<string, unknown>;
        if (typeof parsed.content === "string") return parsed.content;
        if (typeof parsed.text === "string") return parsed.text;
      } catch {
        // Not JSON — use raw content
      }
      return frame.content;
    }

    if (msgType === "IMAGE") return "[Image received]";

    if (msgType === "ORDER_CARD") {
      try {
        const parsed = JSON.parse(frame.content) as Record<string, unknown>;
        const orderId = parsed.orderId ?? parsed.order_id;
        if (orderId) return `[Order card received] Order ID: ${orderId}`;
      } catch { /* ignore */ }
      return "[Order card received]";
    }

    return `[${frame.messageType} message received]`;
  }
}
