import { ScopeType } from "@rivonclaw/core";
import type { RouteHandler } from "./api-context.js";
import { parseBody, sendJson } from "./route-utils.js";
import { toolCapabilityResolver } from "../utils/tool-capability-resolver.js";

// ── Session key parsing ─────────────────────────────────────────────────────
// Pure function: sessionKey → scopeType.
// Phase 1: string-based rules. Phase 2: SQLite lookup for Channel persistence.

/**
 * Parse a sessionKey into its ScopeType.
 *
 * Rules (evaluated in order):
 * - Contains ":cron:" → CRON_JOB
 * - Starts with "cs:" → CS_SESSION
 * - Everything else → CHAT_SESSION (covers ChatPage, Channels, etc.)
 */
export function parseScopeType(sessionKey: string): ScopeType {
  if (sessionKey.includes(":cron:")) return ScopeType.CRON_JOB;
  if (sessionKey.startsWith("cs:")) return ScopeType.CS_SESSION;
  if (sessionKey.startsWith("agent:")) return ScopeType.CHAT_SESSION;
  return ScopeType.UNKNOWN;
}

/**
 * Thin HTTP adapter for ToolCapabilityResolver.
 *
 * Routes handle ONLY: HTTP parsing + delegation to resolver.
 * Business logic (scope trust, system tools enrichment, defaults) lives in the resolver.
 */
export const handleToolRegistryRoutes: RouteHandler = async (req, res, url, pathname, ctx) => {

  // GET /api/tools/effective-tools — called by capability-manager plugin
  if (pathname === "/api/tools/effective-tools" && req.method === "GET") {
    const sessionKey = url.searchParams.get("sessionKey");
    if (!sessionKey) {
      sendJson(res, 400, { error: "Missing sessionKey" });
      return true;
    }
    if (!toolCapabilityResolver.isInitialized()) {
      sendJson(res, 200, { effectiveToolIds: [] });
      return true;
    }

    const scopeType = parseScopeType(sessionKey);
    const effectiveToolIds = toolCapabilityResolver.getEffectiveToolsForScope(scopeType, sessionKey);
    sendJson(res, 200, { effectiveToolIds });
    return true;
  }

  // GET /api/tools/available — full tool list for Panel UI
  if (pathname === "/api/tools/available" && req.method === "GET") {
    const entitledMeta = ctx.authSession?.getAccessToken()
      ? (ctx.authSession.getCachedAvailableTools()
        ?? await ctx.authSession.fetchAvailableTools().catch(() => []))
      : [];

    sendJson(res, 200, { tools: toolCapabilityResolver.getToolList(entitledMeta) });
    return true;
  }

  // PUT /api/tools/default-run-profile — set/clear the user's default RunProfile
  if (pathname === "/api/tools/default-run-profile" && req.method === "PUT") {
    const body = await parseBody(req) as { runProfile?: { selectedToolIds: string[]; surfaceId?: string } | null };
    toolCapabilityResolver.setDefaultRunProfile(body.runProfile ?? null);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // PUT /api/tools/run-profile — set RunProfile for a specific session
  if (pathname === "/api/tools/run-profile" && req.method === "PUT") {
    const body = await parseBody(req) as {
      scopeKey?: string;
      runProfile?: { selectedToolIds: string[]; surfaceId?: string } | null;
    };
    if (!body.scopeKey) {
      sendJson(res, 400, { error: "Missing scopeKey" });
      return true;
    }
    toolCapabilityResolver.setSessionRunProfile(body.scopeKey, body.runProfile ?? null);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /api/tools/run-profile — get RunProfile for a session
  if (pathname === "/api/tools/run-profile" && req.method === "GET") {
    const scopeKey = url.searchParams.get("scopeKey");
    if (!scopeKey) {
      sendJson(res, 400, { error: "Missing scopeKey" });
      return true;
    }
    sendJson(res, 200, { runProfile: toolCapabilityResolver.getSessionRunProfile(scopeKey) });
    return true;
  }

  // DELETE /api/tools/run-profile — clear RunProfile for a session
  if (pathname === "/api/tools/run-profile" && req.method === "DELETE") {
    const scopeKey = url.searchParams.get("scopeKey");
    if (!scopeKey) {
      sendJson(res, 400, { error: "Missing scopeKey" });
      return true;
    }
    toolCapabilityResolver.setSessionRunProfile(scopeKey, null);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
};
