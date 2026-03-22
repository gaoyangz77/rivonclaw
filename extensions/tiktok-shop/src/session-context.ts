/**
 * CS Session Context (ADR-032)
 *
 * Immutable session metadata injected by the CS bridge when a TikTok webhook
 * creates an agent session. Tools read locked parameters from here, never
 * from agent input in CS mode.
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

/**
 * Resolve session context from the plugin context object.
 * Returns null when not in a CS session (management/admin context).
 */
export function resolveSessionContext(
  ctx: Record<string, unknown> | undefined,
): CSSessionContext | null {
  if (!ctx) return null;

  const csSession = ctx.csSessionContext as CSSessionContext | undefined;
  if (!csSession?.shopId || !csSession?.conversationId || !csSession?.buyerUserId) {
    return null;
  }

  return csSession;
}
