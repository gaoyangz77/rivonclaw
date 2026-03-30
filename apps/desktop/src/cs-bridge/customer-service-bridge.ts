import { WebSocket } from "ws";
import { createLogger } from "@rivonclaw/logger";
import type { GatewayEventFrame } from "@rivonclaw/gateway";
import { readFullModelCatalog } from "@rivonclaw/gateway";
import type {
  CSHelloFrame,
  CSBindShopsFrame,
  CSBindShopsResultFrame,
  CSShopTakenOverFrame,
  CSNewMessageFrame,
  CSNewConversationFrame,
  CSWSFrame,
} from "@rivonclaw/core";
import { getRpcClient } from "../gateway/rpc-client-ref.js";
import { getAuthSession } from "../auth/auth-session-ref.js";
import { getProviderKeysStore } from "../gateway/provider-keys-ref.js";
import { getVendorDir } from "../gateway/vendor-dir-ref.js";
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

const CS_GET_OR_CREATE_SESSION_MUTATION = `
  mutation CsGetOrCreateSession($shopId: ID!, $conversationId: String!, $buyerUserId: String!) {
    csGetOrCreateSession(shopId: $shopId, conversationId: $conversationId, buyerUserId: $buyerUserId) {
      sessionId
      isNew
      balance
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
  /** LLM model override for CS sessions (provider/modelId format). Undefined = use global default. */
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

  /** Cached set of model IDs available under the active provider. Refreshed on provider change. */
  private activeProviderModelIds = new Set<string>();

  /** Entity cache subscription unsubscribe function. */
  private cacheUnsubscribe: (() => void) | null = null;

  constructor(private readonly opts: CustomerServiceBridgeOptions) {}

  /** Refresh the cached model list for the active provider. */
  async refreshModelCatalog(): Promise<void> {
    try {
      const keys = getProviderKeysStore()?.getAll() ?? [];
      const activeProvider = keys.find((k) => k.isDefault)?.provider;
      if (!activeProvider) { this.activeProviderModelIds = new Set(); return; }

      const vendorDir = getVendorDir() ?? undefined;
      const catalog = await readFullModelCatalog(undefined, vendorDir);
      const ids = new Set<string>();
      for (const m of catalog[activeProvider] ?? []) ids.add(m.id);
      this.activeProviderModelIds = ids;
    } catch {
      // Keep existing cache on failure
    }
  }

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
    const rpcClient = getRpcClient();
    if (!rpcClient) {
      log.warn("No RPC client available, dropping CS message");
      return;
    }

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

    // 3. Build session keys
    // scopeKey: the full gateway-resolved key used for RunProfile storage and
    //           session registration (capability-manager queries with this key).
    // dispatchKey: the raw key passed to the agent RPC; gateway prepends
    //             "agent:main:" automatically, yielding the same scopeKey.
    const platform = shop.platform ?? "tiktok";
    const scopeKey = `agent:main:cs:${platform}:${frame.conversationId}`;
    const dispatchKey = `cs:${platform}:${frame.conversationId}`;

    // 4. Register CSSessionContext via gateway method
    try {
      await rpcClient.request("cs_register_session", {
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

    // 5. Set CS RunProfile — delegate tool resolution to ToolCapability model
    const runProfileId = shop.runProfileId ?? this.opts.defaultRunProfileId;
    if (!runProfileId) {
      log.error(`Shop ${shop.objectId} has no runProfileId configured for CS, dropping message`);
      return;
    }
    try {
      const profile = rootStore.toolCapability.allRunProfiles.find((p: { id: string }) => p.id === runProfileId);
      if (!profile) {
        log.error(`RunProfile "${runProfileId}" not found in cache, dropping message`);
        return;
      }
      rootStore.toolCapability.setSessionRunProfile(scopeKey, {
        selectedToolIds: profile.selectedToolIds,
        surfaceId: profile.surfaceId,
      }, runProfileId);
    } catch (err) {
      log.error(`Failed to set CS RunProfile for ${scopeKey}:`, err);
      return;
    }

    // 6. Apply per-shop CS model override (validated against active provider's model catalog)
    //    CRITICAL: if a stale modelOverride points to an unavailable model, we MUST
    //    clear it via sessions.patch { model: null } before dispatching. Otherwise
    //    the gateway will attempt the unavailable model and fail with FailoverError.
    if (shop.csModelOverride) {
      if (this.activeProviderModelIds.has(shop.csModelOverride)) {
        try {
          await rpcClient.request("sessions.patch", {
            key: scopeKey,
            model: shop.csModelOverride,
          });
        } catch (err) {
          log.warn(`CS model override patch failed for ${scopeKey}: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        log.warn(`CS model override "${shop.csModelOverride}" not available in active provider, clearing session override`);
        try {
          await rpcClient.request("sessions.patch", { key: scopeKey, model: null });
        } catch (err) {
          log.error(`Failed to clear stale model override on session ${scopeKey}, dropping message: ${err instanceof Error ? err.message : String(err)}`);
          return;
        }
      }
    }

    // 7. Build extra system prompt
    const extraSystemPrompt = [
      shop.systemPrompt,
      "",
      "## Current Session",
      `- Shop ID: ${shop.objectId}`,
      `- Conversation ID: ${frame.conversationId}`,
      `- Buyer User ID: ${frame.buyerUserId}`,
      ...(frame.orderId ? [`- Order ID: ${frame.orderId}`] : []),
      "",
      "Use the tools available to you to help this buyer.",
    ].join("\n");

    // 8. Ensure CS session exists (balance check — only on first message per conversation)
    if (!this.activeConversations.has(frame.conversationId)) {
      const authSession = getAuthSession();
      if (!authSession) {
        log.warn("No auth session available, skipping agent dispatch");
        return;
      }

      try {
        const result = await authSession.graphqlFetch<{
          csGetOrCreateSession: { sessionId: string; isNew: boolean; balance: number };
        }>(CS_GET_OR_CREATE_SESSION_MUTATION, {
          shopId: shop.objectId,
          conversationId: frame.conversationId,
          buyerUserId: frame.buyerUserId,
        });
        const session = result.csGetOrCreateSession;
        this.activeConversations.add(frame.conversationId);
        log.info("CS session ready", {
          shopId: shop.objectId,
          conversationId: frame.conversationId,
          sessionId: session.sessionId,
          isNew: session.isNew,
          balance: session.balance,
        });
      } catch (err) {
        log.warn(`CS session creation failed (insufficient balance?), skipping agent dispatch: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
    }

    // 9. Dispatch agent run (gateway prepends "agent:main:" to dispatchKey)
    // Session stays ACTIVE across messages — it's per-conversation, not per-message.
    // Session ending is handled separately (idle timeout, conversation close, etc.)
    try {
      const response = await rpcClient.request<{ runId?: string }>("agent", {
        sessionKey: dispatchKey,
        message: textContent,
        extraSystemPrompt,
        idempotencyKey: `${platform}:${frame.messageId}`,
      });
      // Track the run so onGatewayEvent can auto-forward the agent's text output
      if (response?.runId) {
        this.activeConversations.add(frame.conversationId);
        this.pendingRuns.set(response.runId, {
          shopObjectId: shop.objectId,
          conversationId: frame.conversationId,
        });
        log.info(`Agent run dispatched: runId=${response.runId}`);
      }
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

  /** Shallow equality check for CSShopContext to avoid unnecessary updates. */
  private shopContextEqual(a: CSShopContext, b: CSShopContext): boolean {
    return (
      a.objectId === b.objectId &&
      a.platformShopId === b.platformShopId &&
      a.platform === b.platform &&
      a.systemPrompt === b.systemPrompt &&
      a.csModelOverride === b.csModelOverride &&
      a.runProfileId === b.runProfileId
    );
  }
}
