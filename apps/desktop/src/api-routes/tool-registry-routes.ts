import type { GQL } from "@rivonclaw/core";
import type { RouteHandler } from "./api-context.js";
import { parseBody, sendJson } from "./route-utils.js";
import { toolCapabilityResolver } from "../utils/tool-capability-resolver.js";

/**
 * In-memory scope → RunProfile bindings.
 * Managed by Panel via PUT/GET/DELETE /api/tools/run-profile.
 * Used by capability-manager plugin via GET /api/tools/effective-tools.
 */
const scopeProfiles = new Map<string, GQL.RunProfile>();

function toScopeKey(scopeType: string, scopeKey: string): string {
  return `${scopeType}:${scopeKey}`;
}

/** Resolve sessionKey to scopeType + scopeKey (handles cron detection). */
function resolveScope(sessionKey: string, defaultScopeType: string): { scopeType: string; scopeKey: string } {
  const cronMatch = sessionKey.match(/:cron:([^:]+)/);
  if (cronMatch) {
    return { scopeType: "cron_job", scopeKey: cronMatch[1] };
  }
  return { scopeType: defaultScopeType, scopeKey: sessionKey };
}

/**
 * Thin HTTP adapter for ToolCapabilityResolver.
 * Routes handle: parameter parsing, scope→RunProfile state, session→scope resolution.
 * All tool computation is delegated to the resolver.
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

    const { scopeType, scopeKey } = resolveScope(sessionKey, url.searchParams.get("scopeType") ?? "chat_session");
    const runProfile = scopeProfiles.get(toScopeKey(scopeType, scopeKey)) ?? null;
    // ⚠️ SECURITY: surface=null means UNRESTRICTED — all tools pass Layer 2.
    // This is intentional for ChatPage/CronJob (admin scopes) and OpenClaw native sessions.
    // Future scope types that need Surface restriction must look up the Surface
    // from the RunProfile's surfaceId and pass it here instead of null.
    const result = toolCapabilityResolver.computeEffectiveTools(null, runProfile);
    sendJson(res, 200, { effectiveToolIds: result.effectiveToolIds });
    return true;
  }

  // GET /api/tools/available — full tool list for Panel UI
  // System tools are always available (pre-seeded from static catalog).
  // Extension tools appear after gateway connects. Entitled tools require login.
  if (pathname === "/api/tools/available" && req.method === "GET") {
    const entitledMeta = ctx.authSession?.getAccessToken()
      ? (ctx.authSession.getCachedAvailableTools()
        ?? await ctx.authSession.fetchAvailableTools().catch(() => []))
      : [];

    sendJson(res, 200, { tools: toolCapabilityResolver.getToolList(entitledMeta) });
    return true;
  }

  // PUT /api/tools/run-profile
  if (pathname === "/api/tools/run-profile" && req.method === "PUT") {
    const body = await parseBody(req) as {
      scopeType?: string;
      scopeKey?: string;
      runProfile?: Partial<GQL.RunProfile> | null;
    };
    if (!body.scopeType || !body.scopeKey) {
      sendJson(res, 400, { error: "Missing scopeType or scopeKey" });
      return true;
    }
    const sk = toScopeKey(body.scopeType, body.scopeKey);
    if (body.runProfile) {
      const now = new Date().toISOString();
      scopeProfiles.set(sk, {
        id: body.runProfile.id ?? "",
        name: body.runProfile.name ?? "",
        selectedToolIds: body.runProfile.selectedToolIds ?? [],
        surfaceId: body.runProfile.surfaceId ?? "",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      scopeProfiles.delete(sk);
    }
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /api/tools/run-profile
  if (pathname === "/api/tools/run-profile" && req.method === "GET") {
    const scopeType = url.searchParams.get("scopeType");
    const scopeKey = url.searchParams.get("scopeKey");
    if (!scopeType || !scopeKey) {
      sendJson(res, 400, { error: "Missing scopeType or scopeKey" });
      return true;
    }
    sendJson(res, 200, { runProfile: scopeProfiles.get(toScopeKey(scopeType, scopeKey)) ?? null });
    return true;
  }

  // DELETE /api/tools/run-profile
  if (pathname === "/api/tools/run-profile" && req.method === "DELETE") {
    const scopeType = url.searchParams.get("scopeType");
    const scopeKey = url.searchParams.get("scopeKey");
    if (!scopeType || !scopeKey) {
      sendJson(res, 400, { error: "Missing scopeType or scopeKey" });
      return true;
    }
    scopeProfiles.delete(toScopeKey(scopeType, scopeKey));
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
};
