import { existsSync } from "node:fs";
import { join } from "node:path";
import { DEFAULTS } from "@rivonclaw/core";
import { API } from "@rivonclaw/core/api-contract";
import { deleteMaterialized } from "./materializer.js";
import type { RouteRegistry, EndpointHandler } from "../infra/api/route-registry.js";
import type { ApiContext } from "../app/api-context.js";
import { parseBody, sendJson } from "../infra/api/route-utils.js";

/** Find the default Chrome executable path for the current platform. */
function findDefaultChromePath(): string | null {
  if (process.platform === "darwin") {
    const candidates = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
    return candidates.find(p => existsSync(p)) ?? null;
  }
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA ?? "";
    const programFiles = process.env["ProgramFiles"] ?? "C:\\Program Files";
    const candidates = [
      join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
      join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    ];
    return candidates.find(p => existsSync(p)) ?? null;
  }
  // Linux
  const candidates = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"];
  return candidates.find(p => existsSync(p)) ?? null;
}

// ── GET /api/browser-profiles/managed ──

const managed: EndpointHandler = async (_req, res, _url, _params, ctx: ApiContext) => {
  const entries = ctx.managedBrowserService?.getAllEntries() ?? [];
  sendJson(res, 200, { entries });
};

// ── POST /api/browser-profiles/:id/managed/launch ──

const launch: EndpointHandler = async (req, res, _url, params, ctx: ApiContext) => {
  const profileId = params.id;
  if (!ctx.managedBrowserService) {
    sendJson(res, 503, { error: "Managed browser service not available" });
    return;
  }

  const body = await parseBody(req) as { chromePath?: string };
  const chromePath = body.chromePath || findDefaultChromePath();

  if (!chromePath) {
    sendJson(res, 400, { error: "Chrome path not found" });
    return;
  }

  try {
    const port = await ctx.managedBrowserService.launchBrowser(profileId, chromePath);
    sendJson(res, 200, { ok: true, port });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : "Failed to launch browser" });
  }
};

// ── POST /api/browser-profiles/:id/managed/connect ──

const connect: EndpointHandler = async (req, res, _url, params, ctx: ApiContext) => {
  const profileId = params.id;
  if (!ctx.managedBrowserService) {
    sendJson(res, 503, { error: "Managed browser service not available" });
    return;
  }

  const body = await parseBody(req) as { port: number };
  if (!body.port || typeof body.port !== "number") {
    sendJson(res, 400, { error: "Missing or invalid port" });
    return;
  }

  try {
    const connected = await ctx.managedBrowserService.connectBrowser(profileId, body.port);
    sendJson(res, 200, { ok: connected, port: body.port });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : "Failed to connect" });
  }
};

// ── POST /api/browser-profiles/:id/managed/stop ──

const stop: EndpointHandler = async (_req, res, _url, params, ctx: ApiContext) => {
  const profileId = params.id;
  if (!ctx.managedBrowserService) {
    sendJson(res, 503, { error: "Managed browser service not available" });
    return;
  }

  try {
    await ctx.managedBrowserService.stopTracking(profileId);
    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : "Failed to stop tracking" });
  }
};

// ── POST /api/browser-profiles/test-proxy ──

const testProxy: EndpointHandler = async (req, res, _url, _params, ctx: ApiContext) => {
  const body = await parseBody(req) as { id?: string };
  if (!body.id) {
    sendJson(res, 400, { error: "Missing id" });
    return;
  }

  // Fetch profile from cloud to get proxy config
  if (!ctx.authSession?.getAccessToken()) {
    sendJson(res, 401, { error: "Not authenticated" });
    return;
  }

  try {
    const data = await ctx.authSession.graphqlFetch<{
      browserProfile: { id: string; proxyPolicy?: { enabled: boolean; baseUrl?: string } } | null;
    }>(
      `query ($id: ID!) { browserProfile(id: $id) { id proxyPolicy { enabled baseUrl } } }`,
      { id: body.id },
    );

    const profile = data.browserProfile;
    if (!profile) {
      sendJson(res, 404, { error: "Profile not found" });
      return;
    }

    if (!profile.proxyPolicy?.enabled || !profile.proxyPolicy?.baseUrl) {
      sendJson(res, 200, { ok: false, message: "No proxy configured", checkedAt: new Date().toISOString() });
      return;
    }

    // Test proxy connectivity
    const proxyUrl = profile.proxyPolicy.baseUrl;
    try {
      const testRes = await fetch(proxyUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
      sendJson(res, 200, { ok: testRes.ok, message: `Proxy responded with ${testRes.status}`, checkedAt: new Date().toISOString() });
    } catch (proxyErr) {
      sendJson(res, 200, { ok: false, message: proxyErr instanceof Error ? proxyErr.message : "Proxy unreachable", checkedAt: new Date().toISOString() });
    }
  } catch (err) {
    sendJson(res, 502, { error: err instanceof Error ? err.message : "Failed to fetch profile" });
  }
};

// ── GET /api/browser-profiles/sessions ──

const sessions: EndpointHandler = async (_req, res, _url, _params, ctx: ApiContext) => {
  const mgr = ctx.sessionLifecycleManager;
  const activeProfiles = mgr?.getActiveProfileIds() ?? [];
  const sessionList = activeProfiles.map(id => ({
    profileId: id,
    target: mgr?.getSessionTarget(id) ?? null,
  }));
  sendJson(res, 200, { activeProfiles, sessions: sessionList });
};

// ── POST /api/browser-profiles/:id/session/start ──

const sessionStart: EndpointHandler = async (req, res, _url, params, ctx: ApiContext) => {
  const profileId = params.id;
  if (!ctx.sessionLifecycleManager) {
    sendJson(res, 503, { error: "Session lifecycle manager not available" });
    return;
  }

  const body = await parseBody(req) as { target?: string; cdpPort?: number };

  // Determine runtime target (default to managed_profile -- the primary path).
  const target = (body.target === "cdp" || body.target === "managed_profile")
    ? body.target
    : "managed_profile";

  // Resolve CDP port for targets that need it
  const cdpPort = body.cdpPort
    ?? (target === "cdp" ? parseInt(ctx.storage.settings.get("browser-cdp-port") || "", 10) : undefined);

  try {
    const { createAdapter } = await import("./adapter-factory.js");
    const adapter = createAdapter(target, {
      profileId,
      cdpPort: Number.isFinite(cdpPort) ? cdpPort : undefined,
    });
    await ctx.sessionLifecycleManager.startSession(profileId, adapter, target);
    sendJson(res, 200, { ok: true, target });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : "Failed to start session" });
  }
};

// ── POST /api/browser-profiles/:id/session/end ──

const sessionEnd: EndpointHandler = async (_req, res, _url, params, ctx: ApiContext) => {
  const profileId = params.id;
  if (!ctx.sessionLifecycleManager) {
    sendJson(res, 503, { error: "Session lifecycle manager not available" });
    return;
  }

  try {
    await ctx.sessionLifecycleManager.endSession(profileId);
    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : "Failed to end session" });
  }
};

// ── GET /api/browser-profiles/:id/session-policy ──

const sessionPolicyGet: EndpointHandler = async (_req, res, _url, params, ctx: ApiContext) => {
  const profileId = params.id;
  const defaultPolicy = { enabled: true, checkpointIntervalSec: DEFAULTS.browserProfiles.defaultCheckpointIntervalSec, mode: "cookies_only", storage: "local" };

  if (!ctx.authSession?.getAccessToken()) {
    sendJson(res, 200, defaultPolicy);
    return;
  }
  try {
    const data = await ctx.authSession.graphqlFetch<{
      browserProfile: { id: string; sessionStatePolicy: { enabled: boolean; checkpointIntervalSec: number; mode: string; storage: string } } | null;
    }>(
      `query ($id: ID!) { browserProfile(id: $id) { id sessionStatePolicy { enabled checkpointIntervalSec mode storage } } }`,
      { id: profileId },
    );
    sendJson(res, 200, data.browserProfile?.sessionStatePolicy ?? defaultPolicy);
  } catch {
    sendJson(res, 200, defaultPolicy);
  }
};

// ── PUT /api/browser-profiles/:id/session-policy ──

const sessionPolicySet: EndpointHandler = async (req, res, _url, params, ctx: ApiContext) => {
  const profileId = params.id;

  if (!ctx.authSession?.getAccessToken()) {
    sendJson(res, 401, { error: "Not authenticated" });
    return;
  }

  const body = await parseBody(req) as {
    enabled?: boolean;
    checkpointIntervalSec?: number;
    mode?: string;
    storage?: string;
  };

  try {
    const data = await ctx.authSession.graphqlFetch<{
      updateBrowserProfile: { id: string; sessionStatePolicy: { enabled: boolean; checkpointIntervalSec: number; mode: string; storage: string } };
    }>(
      `mutation ($id: ID!, $input: UpdateBrowserProfileInput!) { updateBrowserProfile(id: $id, input: $input) { id sessionStatePolicy { enabled checkpointIntervalSec mode storage } } }`,
      { id: profileId, input: { sessionStatePolicy: body } },
    );
    sendJson(res, 200, { ok: true, sessionStatePolicy: data.updateBrowserProfile.sessionStatePolicy });
  } catch (err) {
    sendJson(res, 502, { error: err instanceof Error ? err.message : "Failed to update session policy" });
  }
};

// ── DELETE /api/browser-profiles/:id/data ──

const deleteData: EndpointHandler = async (_req, res, _url, params, ctx: ApiContext) => {
  const profileId = params.id;

  // End any active session before deleting profile data
  if (ctx.sessionLifecycleManager?.hasActiveSession(profileId)) {
    await ctx.sessionLifecycleManager.endSession(profileId);
  }

  const basePath = process.env.RIVONCLAW_DATA_DIR ?? "/tmp/rivonclaw";
  try {
    await deleteMaterialized(profileId, basePath);

    // Best-effort cloud backup cleanup
    if (ctx.authSession?.getAccessToken()) {
      ctx.authSession.graphqlFetch(
        `mutation ($profileId: ID!) { deleteSessionStateBackup(profileId: $profileId) }`,
        { profileId },
      ).catch(() => {}); // best-effort
    }

    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 200, { ok: false, message: err instanceof Error ? err.message : "Failed to delete data" });
  }
};

// ── Registration ──

export function registerBrowserProfilesHandlers(registry: RouteRegistry): void {
  registry.register(API["browserProfiles.managed"], managed);
  registry.register(API["browserProfiles.launch"], launch);
  registry.register(API["browserProfiles.connect"], connect);
  registry.register(API["browserProfiles.stop"], stop);
  registry.register(API["browserProfiles.testProxy"], testProxy);
  registry.register(API["browserProfiles.sessions"], sessions);
  registry.register(API["browserProfiles.sessionStart"], sessionStart);
  registry.register(API["browserProfiles.sessionEnd"], sessionEnd);
  registry.register(API["browserProfiles.sessionPolicy.get"], sessionPolicyGet);
  registry.register(API["browserProfiles.sessionPolicy.set"], sessionPolicySet);
  registry.register(API["browserProfiles.deleteData"], deleteData);
}
