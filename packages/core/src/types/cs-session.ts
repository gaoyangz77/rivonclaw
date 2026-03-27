/**
 * CS Session Context (ADR-032)
 *
 * Platform-agnostic session metadata injected by the CS bridge when a webhook
 * creates an agent session. Tools read locked parameters from here, never
 * from agent input in CS mode.
 *
 * Injection mechanism:
 * - CS bridge registers context via gateway method (keyed by sessionKey)
 * - before_tool_call hook returns { params: { ...params, __csSession } }
 *   to inject context into tool args (OpenClaw tool.execute does NOT
 *   receive a ctx object — only toolCallId, params, signal, onUpdate)
 * - Tools call resolveSessionContext(args) to read from args.__csSession
 */

export interface CSSessionContext {
  // ── Security context (tool-layer enforcement) ──
  shopId: string;
  conversationId: string;
  buyerUserId: string;
  // ── Informational context (prompt-layer hints, NOT tool locks) ──
  /** The order that triggered this conversation, if any. Injected into the
   *  system prompt so the agent can proactively look it up — but does NOT
   *  restrict the agent from querying the buyer's other orders. */
  orderId?: string;
}

// ── Session store ──────────────────────────────────────────────────

/** Sessions older than this are eligible for lazy eviction. */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Lazy cleanup triggers when the store exceeds this size. */
const SESSION_CLEANUP_THRESHOLD = 100;

interface StoredSession {
  context: CSSessionContext;
  registeredAt: number;
}

const sessionStore = new Map<string, StoredSession>();

export function registerCSSession(sessionKey: string, context: CSSessionContext): void {
  sessionStore.set(sessionKey, { context, registeredAt: Date.now() });

  if (sessionStore.size > SESSION_CLEANUP_THRESHOLD) {
    const now = Date.now();
    for (const [key, entry] of sessionStore) {
      if (now - entry.registeredAt > SESSION_TTL_MS) sessionStore.delete(key);
    }
  }
}

export function unregisterCSSession(sessionKey: string): void {
  sessionStore.delete(sessionKey);
}

/** Hidden key used to pass session context through tool params. */
const CS_SESSION_KEY = "__csSession";

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
  return { ...originalParams, [CS_SESSION_KEY]: entry.context };
}

/**
 * Typed tool args that may contain injected CS session context.
 * Use as the type for CS tool execute's `args` parameter to avoid
 * unsafe `as Record<string, unknown>` casts.
 */
export type CSToolArgs<T = Record<string, never>> = T & {
  /** Injected by before_tool_call hook — hidden from agent. */
  readonly __csSession?: CSSessionContext;
  /** Direct injection path (used in tests). */
  readonly csSessionContext?: CSSessionContext;
};

/**
 * Resolve session context from tool args.
 *
 * Resolution order:
 * 1. args.__csSession (injected by before_tool_call hook via params mutation)
 * 2. args.csSessionContext (direct injection in tests)
 * 3. null (not a CS session)
 */
export function resolveSessionContext(
  args: CSToolArgs | undefined,
): CSSessionContext | null {
  const csSession = (args?.[CS_SESSION_KEY] ?? args?.csSessionContext) as CSSessionContext | undefined;
  if (!csSession?.shopId || !csSession?.conversationId || !csSession?.buyerUserId) {
    return null;
  }
  return csSession;
}
