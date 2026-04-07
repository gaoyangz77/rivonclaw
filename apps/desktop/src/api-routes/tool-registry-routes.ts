import { ScopeType } from "@rivonclaw/core";
import { createLogger } from "@rivonclaw/logger";
import type { RouteHandler } from "./api-context.js";
import { parseBody, sendJson } from "./route-utils.js";
import { rootStore } from "../store/desktop-store.js";
import { waitForGatewayReady } from "../gateway/rpc-client-ref.js";

const log = createLogger("tool-registry");

/** Track last known tool list per session to only log on first resolve or change. */
const lastToolSignature = new Map<string, string>();


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
      // Wait for gateway RPC to connect and tool catalog to load.
      // v2026.4.1 gateway startup is ~10s; without this wait the API
      // returns [] before tools are available.
      try {
        await waitForGatewayReady(15_000);
        // After gateway is ready, tool catalog init runs asynchronously.
        // Poll briefly for it to complete.
        const deadline = Date.now() + 5_000;
        while (!rootStore.toolCapability.initialized && Date.now() < deadline) {
          await new Promise(r => setTimeout(r, 200));
        }
      } catch { /* timeout — fall through to return [] */ }
      if (!rootStore.toolCapability.initialized) {
        sendJson(res, 200, { effectiveToolIds: [] });
        return true;
      }
    }

    const scopeType = parseScopeType(sessionKey);
    const effectiveToolIds = rootStore.toolCapability.getEffectiveToolsForScope(scopeType, sessionKey);

    // Log on first resolve or when tool list changes for a session
    const sig = effectiveToolIds.join(",");
    const prev = lastToolSignature.get(sessionKey);
    if (prev !== sig) {
      lastToolSignature.set(sessionKey, sig);
      const sessionProfile = rootStore.toolCapability.getSessionRunProfileId(sessionKey);
      const defaultProfile = rootStore.toolCapability.defaultRunProfileId;
      log.info(
        `effective-tools ${prev === undefined ? "(first)" : "(changed)"}: ` +
        `session=${sessionKey} scope=${scopeType} ` +
        `sessionProfile=${sessionProfile ?? "null"} defaultProfile=${defaultProfile ?? "null"} ` +
        `entitled=${rootStore.entitledTools?.length ?? 0} runProfiles=${rootStore.runProfiles?.length ?? 0} ` +
        `result=${effectiveToolIds.length} tools=[${effectiveToolIds.join(", ")}]`,
      );
    }

    sendJson(res, 200, { effectiveToolIds });
    return true;
  }

  // defaultRunProfileId is read from currentUser (persisted via backend GraphQL,
  // synced to Desktop MST via SSE). No separate REST endpoint needed.

  // PUT /api/tools/run-profile — set RunProfile for a specific session (by ID)
  if (pathname === "/api/tools/run-profile" && req.method === "PUT") {
    const body = await parseBody(req) as { scopeKey?: string; runProfileId?: string | null };
    if (!body.scopeKey) {
      sendJson(res, 400, { error: "Missing scopeKey" });
      return true;
    }
    rootStore.toolCapability.setSessionRunProfile(body.scopeKey, body.runProfileId ?? null);
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
