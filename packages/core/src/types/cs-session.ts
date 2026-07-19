/**
 * Tool Session Context (ADR-032)
 *
 * Session metadata injected by the owning bridge when an agent run is created.
 * Tools read locked parameters from here instead of accepting routing identity
 * from model input.
 *
 * Injection mechanism:
 * - CS bridge registers context via gateway method (keyed by sessionKey)
 * - before_tool_call hook returns { params: { ...params, __csSession } }
 *   to inject context into tool args (OpenClaw tool.execute does NOT
 *   receive a ctx object — only toolCallId, params, signal, onUpdate)
 * - Tools call resolveSessionContext(args) to read from args.__csSession
 */

export interface CSSessionContext {
  readonly kind?: "CUSTOMER_SERVICE";
  // ── Security context (tool-layer enforcement) ──
  shopId: string;
  conversationId: string;
  /** Platform buyer user ID (resolved from conversation details). Used by tools and order queries. */
  buyerUserId: string;
  /** IM user ID from the webhook. Preserved for CS messaging context. */
  imUserId?: string;
  // ── Informational context (prompt-layer hints, NOT tool locks) ──
  /** Most recent order ID for this buyer, if any. */
  orderId?: string | null;
  /** All recent orders for this buyer. undefined = not fetched, [] = no orders. */
  recentOrders?: Array<{ orderId: string; createTime: number }>;
}

export interface AffiliateSessionContext {
  readonly kind: "AFFILIATE";
  readonly shopId: string;
  readonly creatorRelationshipId: string;
  readonly runId?: string;
}

export type ToolSessionContext = CSSessionContext | AffiliateSessionContext;

// ── Session store ──────────────────────────────────────────────────

/** Sessions older than this are eligible for lazy eviction. */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Lazy cleanup triggers when the store exceeds this size. */
const SESSION_CLEANUP_THRESHOLD = 100;

interface StoredSession {
  context: ToolSessionContext;
  registeredAt: number;
}

const sessionStore = new Map<string, StoredSession>();

export function registerCSSession(sessionKey: string, context: CSSessionContext): void {
  registerToolSession(sessionKey, context);
}

export function registerToolSession(sessionKey: string, context: ToolSessionContext): void {
  sessionStore.set(sessionKey, { context, registeredAt: Date.now() });

  if (sessionStore.size > SESSION_CLEANUP_THRESHOLD) {
    const now = Date.now();
    for (const [key, entry] of sessionStore) {
      if (now - entry.registeredAt > SESSION_TTL_MS) sessionStore.delete(key);
    }
  }
}

export function unregisterCSSession(sessionKey: string): void {
  unregisterToolSession(sessionKey);
}

export function unregisterToolSession(sessionKey: string): void {
  sessionStore.delete(sessionKey);
}

/** Hidden key used to pass session context through tool params. */
const CS_SESSION_KEY = "__csSession";
const TOOL_SESSION_KEY = "__toolSession";

/**
 * Look up session context for a sessionKey and return modified params
 * with the context injected. Called by before_tool_call hook.
 *
 * Returns the modified params object, or null if no session context exists.
 */
export function getInjectedParams(
  sessionKey: string,
  originalParams: Record<string, unknown>,
): Record<string, unknown> | null {
  const entry = sessionStore.get(sessionKey);
  if (!entry) return null;
  return {
    ...originalParams,
    [TOOL_SESSION_KEY]: entry.context,
    ...(isCustomerServiceContext(entry.context) ? { [CS_SESSION_KEY]: entry.context } : {}),
  };
}

/**
 * Typed tool args that may contain injected CS session context.
 * Use as the type for CS tool execute's `args` parameter to avoid
 * unsafe `as Record<string, unknown>` casts.
 */
export type CSToolArgs<T = Record<string, never>> = T & {
  /** Injected by before_tool_call hook — hidden from agent. */
  readonly __csSession?: CSSessionContext;
  /** Generic session context used by non-CS run profiles. */
  readonly __toolSession?: ToolSessionContext;
  /** Direct injection path (used in tests). */
  readonly csSessionContext?: CSSessionContext;
};

export type ToolSessionArgs<T = Record<string, never>> = T & {
  readonly __toolSession?: ToolSessionContext;
  readonly __csSession?: CSSessionContext;
  readonly csSessionContext?: CSSessionContext;
};

export function resolveToolSessionContext(
  args: ToolSessionArgs<Record<string, unknown>> | undefined,
): ToolSessionContext | null {
  const context = args?.[TOOL_SESSION_KEY]
    ?? args?.[CS_SESSION_KEY]
    ?? args?.csSessionContext;
  if (isAffiliateContext(context) || isCustomerServiceContext(context)) return context;
  return null;
}

/**
 * Resolve session context from tool args.
 *
 * Resolution order:
 * 1. args.__csSession (injected by before_tool_call hook via params mutation)
 * 2. args.csSessionContext (direct injection in tests)
 * 3. null (not a CS session)
 */
export function resolveSessionContext(
  args: CSToolArgs<Record<string, unknown>> | undefined,
): CSSessionContext | null {
  const context = resolveToolSessionContext(args);
  return isCustomerServiceContext(context) ? context : null;
}

function isAffiliateContext(value: unknown): value is AffiliateSessionContext {
  if (value == null || typeof value !== "object") return false;
  const context = value as Partial<AffiliateSessionContext>;
  return context.kind === "AFFILIATE" && Boolean(context.shopId && context.creatorRelationshipId);
}

function isCustomerServiceContext(value: unknown): value is CSSessionContext {
  if (value == null || typeof value !== "object") return false;
  const context = value as Partial<CSSessionContext>;
  return Boolean(context.shopId && context.conversationId && context.buyerUserId);
}
