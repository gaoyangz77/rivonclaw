import { WebSocket } from "ws";
import { createLogger } from "@rivonclaw/logger";
import { getGraphqlUrl, ScopeType } from "@rivonclaw/core";
import type { GatewayRpcClient } from "@rivonclaw/gateway";
import type {
  CSHelloFrame,
  CSTikTokNewMessageFrame,
  CSTikTokNewConversationFrame,
  CSWSFrame,
} from "@rivonclaw/core";

const log = createLogger("cs-bridge");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomerServiceBridgeOptions {
  relayUrl: string;
  gatewayId: string;
  locale: string;
  getAuthToken: () => string | null;
  getRpcClient: () => GatewayRpcClient | null;
}

interface AssembledPromptResult {
  systemPrompt: string;
  version: number;
}

// ---------------------------------------------------------------------------
// CustomerServiceBridge
// ---------------------------------------------------------------------------

/**
 * Desktop-side bridge that connects to the TikTok CS relay WebSocket,
 * receives buyer messages, and dispatches agent runs via the gateway RPC.
 *
 * The agent replies directly using MCP tools (tiktok_send_message etc.) —
 * there is no relay reply path.
 */
export class CustomerServiceBridge {
  private ws: WebSocket | null = null;
  private closed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private static readonly PROMPT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
  private promptCache = new Map<string, { prompt: string; fetchedAt: number }>();

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

  /** Clear cached prompt for a shop so the next message fetches a fresh copy. */
  invalidatePromptCache(shopId: string): void {
    this.promptCache.delete(shopId);
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
        // The close event will fire after this, triggering reconnect.
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
        break;
      case "cs_error":
        log.error(`CS relay error: ${(frame as { message?: string }).message}`);
        break;
      default:
        // Ignore unhandled frame types (cs_inbound, cs_binding_resolved, etc.)
        break;
    }
  }

  // ── TikTok message handling ─────────────────────────────────────────

  private async onTikTokMessage(frame: CSTikTokNewMessageFrame): Promise<void> {
    const rpcClient = this.opts.getRpcClient();
    if (!rpcClient) {
      log.warn("No RPC client available, dropping TikTok message");
      return;
    }

    // 1. Parse text content
    const textContent = this.parseMessageContent(frame);

    // 2. Fetch assembled CS prompt (cached per shopId)
    const assembledPrompt = await this.fetchPrompt(frame.shopId);

    // 3. Build session key
    const sessionKey = `cs:tiktok:${frame.conversationId}`;

    // 4. Register CSSessionContext via gateway method
    try {
      await rpcClient.request("tiktok_cs_register_session", {
        sessionKey,
        csContext: {
          shopId: frame.shopId,
          conversationId: frame.conversationId,
          buyerUserId: frame.buyerUserId,
          orderId: frame.orderId,
        },
      });
    } catch (err) {
      log.error(`Failed to register CS session ${sessionKey}, dropping message:`, err);
      return;
    }

    // 5. Set CS RunProfile for this session scope (restricts tools to CS-only set)
    const csToolIds = [
      "tiktok_cs_send_message",
      "tiktok_cs_get_conversations",
      "tiktok_cs_get_conversation_messages",
      "tiktok_cs_get_conversation_details",
      "tiktok_cs_read_message",
      "tiktok_cs_read_messages",
      "tiktok_cs_get_order",
      "tiktok_cs_list_orders",
      "tiktok_cs_get_logistics_tracking",
      "tiktok_cs_get_product",
      "tiktok_cs_create_conversation",
    ];

    try {
      await fetch("http://127.0.0.1:3210/api/tools/run-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeType: ScopeType.CS_SESSION,
          scopeKey: sessionKey,
          runProfile: {
            id: "__cs_default__",
            name: "CS Default",
            selectedToolIds: csToolIds,
            surfaceId: null,
          },
        }),
      });
    } catch (err) {
      log.error(`Failed to set CS RunProfile for ${sessionKey}:`, err);
      return; // Don't dispatch agent without tool restriction
    }

    // 6. Build extra system prompt
    const extraSystemPrompt = [
      assembledPrompt,
      "",
      "## Current Session",
      `- Shop ID: ${frame.shopId}`,
      `- Conversation ID: ${frame.conversationId}`,
      `- Buyer User ID: ${frame.buyerUserId}`,
      ...(frame.orderId ? [`- Order ID: ${frame.orderId}`] : []),
      "",
      "Use the tools available to you to help this buyer. Always reply using tiktok_send_message tool.",
    ].join("\n");

    // 7. Dispatch agent run
    try {
      await rpcClient.request("agent", {
        sessionKey,
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
      // TikTok sometimes wraps text in JSON; try to extract
      try {
        const parsed = JSON.parse(frame.content) as Record<string, unknown>;
        if (typeof parsed.content === "string") return parsed.content;
        if (typeof parsed.text === "string") return parsed.text;
      } catch {
        // Not JSON — use raw content
      }
      return frame.content;
    }

    if (msgType === "IMAGE") {
      return "[Image received]";
    }

    if (msgType === "ORDER_CARD") {
      try {
        const parsed = JSON.parse(frame.content) as Record<string, unknown>;
        const orderId = parsed.orderId ?? parsed.order_id;
        if (orderId) return `[Order card received] Order ID: ${orderId}`;
      } catch {
        // Ignore parse errors
      }
      return "[Order card received]";
    }

    return `[${frame.messageType} message received]`;
  }

  // ── Prompt cache ────────────────────────────────────────────────────

  private async fetchPrompt(shopId: string): Promise<string> {
    const cached = this.promptCache.get(shopId);
    if (cached && Date.now() - cached.fetchedAt < CustomerServiceBridge.PROMPT_CACHE_TTL_MS) {
      return cached.prompt;
    }

    const fallback = "You are a customer service assistant. Reply helpfully.";

    try {
      const token = this.opts.getAuthToken();
      if (!token) {
        log.warn("No auth token for prompt fetch, using fallback");
        return fallback;
      }

      const url = getGraphqlUrl(this.opts.locale);
      const query = `query CsAssemblePrompt($shopId: String!) { csAssemblePrompt(shopId: $shopId) { systemPrompt version } }`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables: { shopId } }),
      });

      if (!res.ok) {
        log.warn(`Prompt fetch failed (HTTP ${res.status}), using fallback`);
        return fallback;
      }

      const json = (await res.json()) as { data?: { csAssemblePrompt?: AssembledPromptResult }; errors?: unknown[] };

      if (json.errors) {
        log.warn("GraphQL errors in prompt fetch:", json.errors);
        return fallback;
      }

      const prompt = json.data?.csAssemblePrompt?.systemPrompt;
      if (!prompt) {
        log.warn("Empty prompt from backend, using fallback");
        return fallback;
      }

      this.promptCache.set(shopId, { prompt, fetchedAt: Date.now() });
      return prompt;
    } catch (err) {
      log.warn("Failed to fetch CS prompt:", err);
      return fallback;
    }
  }
}
