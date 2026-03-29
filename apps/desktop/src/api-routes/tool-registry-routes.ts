import { ScopeType } from "@rivonclaw/core";
import type { RouteHandler } from "./api-context.js";
import { parseBody, sendJson } from "./route-utils.js";
import { rootStore } from "../store/desktop-store.js";


// ── Session key parsing ─────────────────────────────────────────────────────
// Pure function: sessionKey → scopeType (string-based rules).

/**
 * Parse a sessionKey into its ScopeType.
 *
 * Rules (evaluated in order):
 * - Contains ":cron:" → CRON_JOB
 * - Contains ":cs:" → CS_SESSION
 * - Everything else → CHAT_SESSION (covers ChatPage, Channels, etc.)
 */
export function parseScopeType(sessionKey: string): ScopeType {
  if (sessionKey.includes(":cron:")) return ScopeType.CRON_JOB;
  if (sessionKey.includes(":cs:")) return ScopeType.CS_SESSION;
  if (sessionKey.startsWith("agent:")) return ScopeType.CHAT_SESSION;
  return ScopeType.UNKNOWN;
}

/** Look up a RunProfile by ID from the ToolCapability model. */
function resolveRunProfile(runProfileId: string): { selectedToolIds: string[]; surfaceId?: string } | null {
  return rootStore.toolCapability.allRunProfiles.find(p => p.id === runProfileId) ?? null;
}

/**
 * Thin HTTP adapter for ToolCapability model.
 *
 * Routes handle ONLY: HTTP parsing + delegation to model.
 * Business logic (scope trust, system tools enrichment, defaults) lives in the model.
 */
export const handleToolRegistryRoutes: RouteHandler = async (req, res, url, pathname, ctx) => {

  // GET /api/tools/effective-tools — called by capability-manager plugin
  if (pathname === "/api/tools/effective-tools" && req.method === "GET") {
    const sessionKey = url.searchParams.get("sessionKey");
    if (!sessionKey) {
      sendJson(res, 400, { error: "Missing sessionKey" });
      return true;
    }
    if (!rootStore.toolCapability.initialized) {
      sendJson(res, 200, { effectiveToolIds: [] });
      return true;
    }

    const scopeType = parseScopeType(sessionKey);
    const effectiveToolIds = rootStore.toolCapability.getEffectiveToolsForScope(scopeType, sessionKey);
    sendJson(res, 200, { effectiveToolIds });
    return true;
  }

  // PUT /api/tools/default-run-profile — set/clear the user's default RunProfile (by ID)
  if (pathname === "/api/tools/default-run-profile" && req.method === "PUT") {
    const body = await parseBody(req) as { runProfileId?: string | null };
    if (!body.runProfileId) {
      rootStore.toolCapability.setDefaultRunProfile(null);
      sendJson(res, 200, { ok: true });
      return true;
    }
    const profile = resolveRunProfile(body.runProfileId);
    if (!profile) {
      sendJson(res, 404, { error: `RunProfile "${body.runProfileId}" not found in cache` });
      return true;
    }
    rootStore.toolCapability.setDefaultRunProfile({
      selectedToolIds: profile.selectedToolIds,
      surfaceId: profile.surfaceId,
    });
    sendJson(res, 200, { ok: true });
    return true;
  }

  // PUT /api/tools/run-profile — set RunProfile for a specific session
  // Accepts either:
  //   { scopeKey, runProfileId }       — look up a cached profile by ID
  //   { scopeKey, runProfile: { ... } } — inline profile (ad-hoc tool selection)
  if (pathname === "/api/tools/run-profile" && req.method === "PUT") {
    const body = await parseBody(req) as {
      scopeKey?: string;
      runProfileId?: string | null;
      runProfile?: { id?: string; selectedToolIds: string[]; surfaceId?: string } | null;
    };
    if (!body.scopeKey) {
      sendJson(res, 400, { error: "Missing scopeKey" });
      return true;
    }

    // Inline runProfile takes precedence (backward-compatible path)
    if (body.runProfile && typeof body.runProfile === "object") {
      rootStore.toolCapability.setSessionRunProfile(body.scopeKey, {
        selectedToolIds: body.runProfile.selectedToolIds,
        surfaceId: body.runProfile.surfaceId,
      }, body.runProfile.id ?? null);
      sendJson(res, 200, { ok: true });
      return true;
    }

    // runProfileId path: look up from cached profiles
    if (!body.runProfileId) {
      rootStore.toolCapability.setSessionRunProfile(body.scopeKey, null);
      sendJson(res, 200, { ok: true });
      return true;
    }
    const profile = resolveRunProfile(body.runProfileId);
    if (!profile) {
      sendJson(res, 404, { error: `RunProfile "${body.runProfileId}" not found in cache` });
      return true;
    }
    rootStore.toolCapability.setSessionRunProfile(body.scopeKey, {
      selectedToolIds: profile.selectedToolIds,
      surfaceId: profile.surfaceId,
    }, body.runProfileId);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /api/tools/run-profile — get RunProfile ID for a session
  if (pathname === "/api/tools/run-profile" && req.method === "GET") {
    const scopeKey = url.searchParams.get("scopeKey");
    if (!scopeKey) {
      sendJson(res, 400, { error: "Missing scopeKey" });
      return true;
    }
    sendJson(res, 200, { runProfileId: rootStore.toolCapability.getSessionRunProfileId(scopeKey) });
    return true;
  }

  return false;
};
