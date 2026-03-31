/**
 * CustomerServiceSession — encapsulates a single CS agent session lifecycle.
 *
 * Responsibilities:
 * - Session key construction (scopeKey / dispatchKey)
 * - System prompt assembly
 * - Gateway session registration (cs_register_session + RunProfile + model override)
 * - Backend session creation (balance check)
 * - Agent run dispatch
 *
 * Does NOT own any global state (pendingRuns, activeConversations, relay connection).
 * The CS Bridge creates sessions and manages global tracking based on dispatch results.
 */

import { createLogger } from "@rivonclaw/logger";
import { ScopeType } from "@rivonclaw/core";
import { getRpcClient } from "../gateway/rpc-client-ref.js";
import { getAuthSession } from "../auth/auth-session-ref.js";
import { rootStore } from "../store/desktop-store.js";
import type { CSShopContext } from "./customer-service-bridge.js";

const log = createLogger("cs-session");

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

export interface CSContext {
  shopId: string;
  conversationId: string;
  buyerUserId: string;
  orderId?: string;
}

export interface DispatchParams {
  message: string;
  idempotencyKey: string;
  attachments?: Array<{ mimeType: string; content: string }>;
}

export interface DispatchResult {
  runId?: string;
}

// ---------------------------------------------------------------------------
// CustomerServiceSession
// ---------------------------------------------------------------------------

export class CustomerServiceSession {
  readonly platform: string;
  readonly scopeKey: string;
  readonly dispatchKey: string;

  constructor(
    private readonly shop: CSShopContext,
    private readonly csContext: CSContext,
    private readonly defaultRunProfileId?: string,
  ) {
    this.platform = shop.platform ?? "tiktok";
    this.scopeKey = `agent:main:cs:${this.platform}:${csContext.conversationId}`;
    this.dispatchKey = `cs:${this.platform}:${csContext.conversationId}`;
  }

  /** Assembled extraSystemPrompt for this session (shop prompt + session metadata). */
  get extraSystemPrompt(): string {
    return [
      this.shop.systemPrompt,
      "",
      "## Current Session",
      `- Shop ID: ${this.csContext.shopId}`,
      `- Conversation ID: ${this.csContext.conversationId}`,
      `- Buyer User ID: ${this.csContext.buyerUserId}`,
      ...(this.csContext.orderId ? [`- Order ID: ${this.csContext.orderId}`] : []),
      "",
      "Use the tools available to you to help this buyer.",
    ].join("\n");
  }

  /**
   * Ensure a backend CS session exists (balance check + session creation).
   * Returns true if session is ready, false if creation failed (e.g., insufficient balance).
   */
  async ensureBackendSession(): Promise<boolean> {
    const authSession = getAuthSession();
    if (!authSession) {
      log.warn("No auth session available, cannot create backend CS session");
      return false;
    }

    try {
      const result = await authSession.graphqlFetch<{
        csGetOrCreateSession: { sessionId: string; isNew: boolean; balance: number };
      }>(CS_GET_OR_CREATE_SESSION_MUTATION, {
        shopId: this.csContext.shopId,
        conversationId: this.csContext.conversationId,
        buyerUserId: this.csContext.buyerUserId,
      });

      const session = result.csGetOrCreateSession;
      log.info("CS backend session ready", {
        shopId: this.csContext.shopId,
        conversationId: this.csContext.conversationId,
        sessionId: session.sessionId,
        isNew: session.isNew,
        balance: session.balance,
      });
      return true;
    } catch (err) {
      log.warn(`CS backend session creation failed (insufficient balance?): ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  /**
   * Register session context with the gateway, set RunProfile, and apply model override.
   * Throws on failure (caller decides how to handle).
   */
  async setup(): Promise<void> {
    const rpcClient = getRpcClient();
    if (!rpcClient) throw new Error("No RPC client available");

    // Register CS session context with the gateway plugin
    await rpcClient.request("cs_register_session", {
      sessionKey: this.scopeKey,
      csContext: this.csContext,
    });

    // Set RunProfile
    const runProfileId = this.shop.runProfileId ?? this.defaultRunProfileId;
    if (!runProfileId) {
      throw new Error(`Shop ${this.shop.objectId} has no runProfileId configured for CS`);
    }
    rootStore.toolCapability.setSessionRunProfile(this.scopeKey, runProfileId);

    // Delegate model resolution to LLMProviderManager
    await rootStore.llmManager.applyModelForSession(this.scopeKey, {
      type: ScopeType.CS_SESSION,
      shopId: this.shop.objectId,
    });
  }

  /**
   * Dispatch an agent run for this session.
   * Calls setup() internally, then dispatches via gateway RPC.
   * Returns the full dispatch result for the bridge to handle tracking.
   */
  async dispatchAgentRun(params: DispatchParams): Promise<DispatchResult> {
    const rpcClient = getRpcClient();
    if (!rpcClient) throw new Error("No RPC client available");

    await this.setup();

    const response = await rpcClient.request<DispatchResult>("agent", {
      sessionKey: this.dispatchKey,
      message: params.message,
      extraSystemPrompt: this.extraSystemPrompt,
      idempotencyKey: params.idempotencyKey,
      ...(params.attachments ? { attachments: params.attachments } : {}),
    });

    const runId = response?.runId;
    if (runId) {
      log.info(`Agent run dispatched: runId=${runId} conv=${this.csContext.conversationId}`);
    }

    return { runId };
  }
}
