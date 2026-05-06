import { ScopeType } from "@rivonclaw/core";
import { API } from "@rivonclaw/core/api-contract";
import { createLogger } from "@rivonclaw/logger";
import type { RouteRegistry, EndpointHandler } from "../infra/api/route-registry.js";
import type { ApiContext } from "../app/api-context.js";
import { parseBody, sendJson } from "../infra/api/route-utils.js";
import { rootStore } from "../app/store/desktop-store.js";
import { openClawConnector } from "../openclaw/index.js";

const log = createLogger("tool-registry");

/** Track last known tool list per session to only log on first resolve or change. */
const lastToolSignature = new Map<string, string>();
const SLOW_EFFECTIVE_TOOLS_MS = 250;

// ── Session key parsing ─────────────────────────────────────────────────────
// Pure function: sessionKey → scopeType (string-based rules).

/**
 * Parse a sessionKey into its ScopeType.
 *
 * Rules (evaluated in order):
 * - Contains ":cron:" → CRON_JOB
 * - Contains ":cs:" → CS_SESSION
 * - Contains ":affiliate:" → AFFILIATE_SESSION
 * - Everything else → CHAT_SESSION (covers ChatPage, Channels, etc.)
 */
export function parseScopeType(sessionKey: string): ScopeType {
  if (sessionKey.includes(":cron:")) return ScopeType.CRON_JOB;
  if (sessionKey.includes(":cs:")) return ScopeType.CS_SESSION;
  if (sessionKey.includes(":affiliate:")) return ScopeType.AFFILIATE_SESSION;
  return ScopeType.CHAT_SESSION;
}

const getEffectiveTools: EndpointHandler = async (_req, res, url, _params, _ctx) => {
  const requestStartedAt = Date.now();
  const sessionKey = url.searchParams.get("sessionKey");
  if (!sessionKey) {
    sendJson(res, 400, { error: "Missing sessionKey" });
    return;
  }
  const scopeType = parseScopeType(sessionKey);
  const initializedAtStart = rootStore.toolCapability.initialized;
  const shouldTrace = scopeType === ScopeType.CS_SESSION || scopeType === ScopeType.AFFILIATE_SESSION;
  let rpcWaitMs = 0;
  let catalogWaitMs = 0;

  if (shouldTrace) {
    log.info(
      `effective-tools request: session=${sessionKey} scope=${scopeType} ` +
      `initialized=${initializedAtStart} sessionProfile=${rootStore.toolCapability.getSessionRunProfileId(sessionKey) ?? "null"} ` +
      `defaultProfile=${rootStore.toolCapability.defaultRunProfileId ?? "null"} ` +
      `entitled=${rootStore.entitledTools?.length ?? 0} runProfiles=${rootStore.runProfiles?.length ?? 0}`,
    );
  }

  if (!rootStore.toolCapability.initialized) {
    // Wait for gateway RPC to connect and tool catalog to load.
    // v2026.4.1 gateway startup is ~10s; without this wait the API
    // returns [] before tools are available.
    try {
      // Wait for gateway RPC to become ready (poll at 200ms intervals).
      const rpcDeadline = Date.now() + 15_000;
      const rpcWaitStartedAt = Date.now();
      while (Date.now() < rpcDeadline) {
        try { openClawConnector.ensureRpcReady(); break; } catch { /* not ready yet */ }
        await new Promise(r => setTimeout(r, 200));
      }
      rpcWaitMs = Date.now() - rpcWaitStartedAt;
      // After gateway is ready, tool catalog init runs asynchronously.
      // Poll briefly for it to complete.
      const deadline = Date.now() + 5_000;
      const catalogWaitStartedAt = Date.now();
      while (!rootStore.toolCapability.initialized && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 200));
      }
      catalogWaitMs = Date.now() - catalogWaitStartedAt;
    } catch { /* timeout — fall through to return [] */ }
    if (!rootStore.toolCapability.initialized) {
      const totalMs = Date.now() - requestStartedAt;
      log.warn(
        `effective-tools unresolved: session=${sessionKey} scope=${scopeType} totalMs=${totalMs} ` +
        `rpcWaitMs=${rpcWaitMs} catalogWaitMs=${catalogWaitMs}`,
      );
      sendJson(res, 200, { effectiveToolIds: [] });
      return;
    }
  }

  const computeStartedAt = Date.now();
  const effectiveToolIds = rootStore.toolCapability.getEffectiveToolsForScope(scopeType, sessionKey);
  const computeMs = Date.now() - computeStartedAt;

  // Log on first resolve or when tool list changes for a session
  const signatureStartedAt = Date.now();
  const sig = effectiveToolIds.join(",");
  const signatureMs = Date.now() - signatureStartedAt;
  const prev = lastToolSignature.get(sessionKey);
  const changed = prev !== sig;
  const totalMs = Date.now() - requestStartedAt;
  if (shouldTrace || totalMs >= SLOW_EFFECTIVE_TOOLS_MS || computeMs >= SLOW_EFFECTIVE_TOOLS_MS) {
    log.info(
      `effective-tools resolved: session=${sessionKey} scope=${scopeType} totalMs=${totalMs} ` +
      `rpcWaitMs=${rpcWaitMs} catalogWaitMs=${catalogWaitMs} computeMs=${computeMs} ` +
      `signatureMs=${signatureMs} initializedAtStart=${initializedAtStart} ` +
      `changed=${changed} result=${effectiveToolIds.length}`,
    );
  }
  if (changed) {
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
};

const setRunProfile: EndpointHandler = async (req, res, _url, _params, _ctx) => {
  const body = await parseBody(req) as { scopeKey?: string; runProfileId?: string | null };
  if (!body.scopeKey) {
    sendJson(res, 400, { error: "Missing scopeKey" });
    return;
  }
  rootStore.toolCapability.setSessionRunProfile(body.scopeKey, body.runProfileId ?? null);
  sendJson(res, 200, { ok: true });
};

const getRunProfile: EndpointHandler = async (_req, res, url, _params, _ctx) => {
  const scopeKey = url.searchParams.get("scopeKey");
  if (!scopeKey) {
    sendJson(res, 400, { error: "Missing scopeKey" });
    return;
  }
  sendJson(res, 200, { runProfileId: rootStore.toolCapability.getSessionRunProfileId(scopeKey) });
};

export function registerToolRegistryHandlers(registry: RouteRegistry): void {
  registry.register(API["tools.effectiveTools"], getEffectiveTools);
  registry.register(API["tools.runProfile.get"], getRunProfile);
  registry.register(API["tools.runProfile.set"], setRunProfile);
}
