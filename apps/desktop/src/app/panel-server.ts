import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { basename, join, extname, resolve, normalize } from "node:path";
import { getSnapshot } from "mobx-state-tree";
import { formatError, IMAGE_EXT_TO_MIME, resolvePanelPort, getApiBaseUrl, getFirstPartyDomainRoute } from "@rivonclaw/core";
import { createLogger } from "@rivonclaw/logger";
import type { Storage } from "@rivonclaw/storage";
import type { SecretStore } from "@rivonclaw/secrets";
import { resolveOpenClawStateDir } from "@rivonclaw/gateway";
import { resolveMediaBase } from "../utils/media-paths.js";
import { createUsageRuntime } from "../usage/runtime.js";
import { initMobileManagerEnv } from "./store/desktop-store.js";
import { rootStore, subscribeToPatch } from "./store/desktop-store.js";
import { runtimeStatusStore, subscribeToRuntimeStatusPatch } from "./store/runtime-status-store.js";
import { openClawConnector } from "../openclaw/index.js";
import type { AuthSessionManager } from "../auth/session.js";
import { DesktopGoogleAuthCoordinator } from "../auth/google-oauth.js";
import { DesktopBrowserLoginCoordinator } from "../auth/browser-login.js";
import { clearStoredMarketingAttribution } from "../attribution/marketing-attribution.js";
import { CloudClient } from "../cloud/cloud-client.js";
import { startPairingNotifier } from "../channels/pairing-notifier.js";
import { getSystemLocale } from "../i18n/locale.js";
import type { ApiContext } from "./api-context.js";
import { sendJson } from "../infra/api/route-utils.js";
import { createPanelEventBus } from "./panel-event-bus.js";
import { RouteRegistry } from "../infra/api/route-registry.js";
import { registerAllHandlers } from "./register-all.js";

/** Broadcast an event to every Panel SSE client. */
export type BroadcastEvent = (event: string, data: unknown) => void;

// ─── Unified Desktop → Panel SSE bus ─────────────────────────────────────
// ONE EventSource (`/api/events`) multiplexes:
//   - `entity-snapshot` / `entity-patch`  (MST rootStore)
//   - `status-snapshot` / `status-patch`  (MST runtimeStatusStore)
//   - discrete notifications: `inbound`, `chat-mirror`, `session-reset`,
//     `recipient-added`, `oauth-complete`, `shop-updated`, `update-available`.
//
// Snapshots are written synchronously on connect. Patches are batched at
// microtask granularity inside the store modules before landing here.
//
// The bus is module-scoped so callers (main.ts, auth-runtime, gateway,
// pairing-notifier) can obtain a stable `broadcastEvent` reference BEFORE
// startPanelServer() finishes binding — matching the old pushChatSSE DI
// shape but routed through the unified bus.
const panelEventBus = createPanelEventBus({
  getEntitySnapshot: () => getSnapshot(rootStore),
  getRuntimeStatusSnapshot: () => getSnapshot(runtimeStatusStore),
});

subscribeToPatch((patches) => {
  panelEventBus.broadcast("entity-patch", patches);
});

subscribeToRuntimeStatusPatch((patches) => {
  panelEventBus.broadcast("status-patch", patches);
});

/**
 * Broadcast an event to every connected Panel. Safe to call with zero
 * clients attached. Used by:
 *   - main.ts               →  `update-available`
 *   - auth-runtime.ts       →  `oauth-complete`, `shop-updated`
 *   - event-dispatcher.ts   →  `inbound`, `chat-mirror`, `session-reset`, `recipient-added`
 *   - pairing-notifier.ts   →  `recipient-added`
 */
export const broadcastEvent: BroadcastEvent = (event, data) => {
  panelEventBus.broadcast(event, data);
};

const log = createLogger("panel-server");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const MANAGED_CHAT_MEDIA_PREFIX = "/api/chat/media/outgoing/";
const MANAGED_CHAT_MEDIA_ROUTE_RE =
  /^\/api\/chat\/media\/outgoing\/([^/]+)\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/full$/i;

// --- PanelServerOptions ---

export interface PanelServerOptions {
  port?: number;
  panelDistDir: string;
  storage: Storage;
  secretStore: SecretStore;
  proxyRouterPort: number;
  gatewayPort: number;
  onProviderChange?: (hint?: { configOnly?: boolean; keyOnly?: boolean }) => void;
  onOpenFileDialog?: () => Promise<string | null>;
  sttManager?: {
    transcribe(audio: Buffer, format: string): Promise<string | null>;
    isEnabled(): boolean;
    getProvider(): string | null;
    initialize(): Promise<void>;
  };
  onSttChange?: () => void;
  onExtrasChange?: () => void;
  onToolSelectionChange?: (effectiveToolIds: string[]) => void;
  onBrowserChange?: () => void;
  onAutoLaunchChange?: (enabled: boolean) => void;
  onAuthChange?: (action?: string) => Promise<void>;
  onCloudLlmEntitlementAvailable?: () => Promise<void>;
  onChannelConfigured?: (channelId: string) => void;
  onOAuthFlow?: (provider: string) => Promise<{ providerKeyId: string; email?: string; provider: string }>;
  onOAuthAcquire?: (provider: string) => Promise<{ email?: string; tokenPreview: string; manualMode?: boolean; authUrl?: string; flowId?: string }>;
  onOAuthSave?: (provider: string, options: { proxyUrl?: string; label?: string; model?: string }) => Promise<{ providerKeyId: string; email?: string; provider: string }>;
  /** Rotate stored OAuth credentials for an existing key in place (no new row).
   *  `idTokenCaptureFailed` propagates back to the Panel so the Reauth modal
   *  can warn the user about the narrow OAuth server-side rotation race. */
  onOAuthReauth?: (keyId: string) => Promise<{ ok: true; idTokenCaptureFailed: boolean }>;
  onOAuthManualComplete?: (provider: string, callbackUrl: string) => Promise<{ email?: string; tokenPreview: string }>;
  onOAuthPoll?: (flowId: string) => { status: "pending" | "completed" | "failed"; tokenPreview?: string; email?: string; error?: string };
  onTelemetryTrack?: (eventType: string, metadata?: Record<string, unknown>) => void;
  /** Emit a CS business-telemetry event (bypasses user opt-in). See `ApiContext.onCsTelemetryTrack`. */
  onCsTelemetryTrack?: (eventType: string, metadata?: Record<string, unknown>) => void;
  vendorDir: string;
  /** Node.js binary path for spawning OpenClaw CLI commands (e.g. doctor). */
  nodeBin: string;
  deviceId?: string;
  getUpdateResult?: () => {
    updateAvailable: boolean;
    currentVersion: string;
    latestVersion?: string;
    downloadUrl?: string | null;
  } | null;
  getGatewayInfo?: () => { wsUrl: string; token?: string };
  changelogPath?: string;
  onUpdateDownload?: () => Promise<void>;
  onUpdateCancel?: () => void;
  onUpdateInstall?: () => Promise<void>;
  getUpdateDownloadState?: () => { status: string;[key: string]: unknown };
  authSession?: AuthSessionManager;
  proxyFetch?: (url: string | URL, init?: RequestInit) => Promise<Response>;
  onOpenExternal?: (url: string) => Promise<unknown>;
  channelManager?: import("../channels/channel-manager.js").ChannelManagerInstance;
  desktopApiToken?: string;
}

// --- Route registry (all endpoints registered here) ---
const registry = new RouteRegistry();
registerAllHandlers(registry);

/**
 * Create and start a local HTTP server that serves the panel SPA
 * and provides REST API endpoints backed by real storage.
 *
 * Returns a promise that resolves once the server is bound, providing
 * the Server instance and the actual port (useful when port 0 is used
 * for OS-assigned dynamic allocation).
 */
export async function startPanelServer(options: PanelServerOptions): Promise<{ server: Server; port: number }> {
  const requestedPort = options.port ?? resolvePanelPort();
  const distDir = resolve(options.panelDistDir);
  const { storage, secretStore, proxyRouterPort, gatewayPort, onProviderChange, onOpenFileDialog, sttManager, onSttChange, onExtrasChange, onToolSelectionChange, onBrowserChange, onAutoLaunchChange, onAuthChange, onCloudLlmEntitlementAvailable, onChannelConfigured, onOAuthFlow, onOAuthAcquire, onOAuthSave, onOAuthReauth, onOAuthManualComplete, onOAuthPoll, onTelemetryTrack, onCsTelemetryTrack, vendorDir, nodeBin, deviceId, getUpdateResult, getGatewayInfo, changelogPath, onUpdateDownload, onUpdateCancel, onUpdateInstall, getUpdateDownloadState, authSession, channelManager, desktopApiToken } = options;

  // Read changelog.json once at startup (cached in closure)
  let changelogEntries: unknown[] = [];
  if (changelogPath && existsSync(changelogPath)) {
    try {
      changelogEntries = JSON.parse(readFileSync(changelogPath, "utf-8"));
    } catch (err) {
      log.warn("Failed to read changelog.json:", err);
    }
  }

  // Ensure vendor OpenClaw functions read from RivonClaw's state dir
  process.env.OPENCLAW_STATE_DIR = resolveOpenClawStateDir();

  // --- Per-Key/Model Usage Tracking ---
  const { snapshotEngine, queryService } = createUsageRuntime(storage);

  // Mobile Chat Pairing Manager (MST model on desktop store)
  initMobileManagerEnv({
    storage,
    controlPlaneUrl: getApiBaseUrl(getSystemLocale()),
    stateDir: resolveOpenClawStateDir(),
    getRpcClient: () => { try { return openClawConnector.ensureRpcReady(); } catch { return null; } },
  });

  // Hydrate runtime-status AppSettings from persisted storage
  runtimeStatusStore.loadAppSettings(storage.settings.getAll());

  // Publish device identity so Panel can derive CS bridge eligibility
  if (deviceId) runtimeStatusStore.setDeviceId(deviceId);

  // Reconcile usage snapshot for the active key on startup
  const activeKeyOnStartup = storage.providerKeys.getActive();
  if (activeKeyOnStartup) {
    snapshotEngine.reconcileOnStartup(activeKeyOnStartup.id, activeKeyOnStartup.provider, activeKeyOnStartup.model).catch((err) => {
      log.error(`Failed to reconcile usage for key ${activeKeyOnStartup.id}:`, err);
    });
  }

  // Start pairing notifier — uses the module-scoped broadcastEvent.
  const pairingNotifier = startPairingNotifier(proxyRouterPort, broadcastEvent);

  // Build the ApiContext object passed to all route handlers
  const ctx: ApiContext = {
    storage, secretStore, proxyRouterPort, gatewayPort,
    onProviderChange, onOpenFileDialog,
    sttManager, onSttChange, onExtrasChange, onToolSelectionChange, onBrowserChange, onAutoLaunchChange, onAuthChange, onCloudLlmEntitlementAvailable,
    onChannelConfigured, onOAuthFlow, onOAuthAcquire, onOAuthSave, onOAuthReauth, onOAuthManualComplete, onOAuthPoll,
    onTelemetryTrack, onCsTelemetryTrack, vendorDir, nodeBin, deviceId, getUpdateResult, getGatewayInfo,
    snapshotEngine, queryService, mobileManager: rootStore.mobileManager, authSession,
    openExternal: options.onOpenExternal,
    cloudClient: authSession ? new CloudClient(authSession, getSystemLocale(), options.proxyFetch) : undefined,
    channelManager,
    desktopApiToken,
  };
  if (authSession && options.proxyFetch && options.onOpenExternal) {
    ctx.googleAuthCoordinator = new DesktopGoogleAuthCoordinator({
      authSession,
      fetchFn: options.proxyFetch,
      openExternal: options.onOpenExternal,
      onSuccess: async () => {
        clearStoredMarketingAttribution(storage.settings);
        await onAuthChange?.("google-login");
      },
    });
    ctx.browserLoginCoordinator = new DesktopBrowserLoginCoordinator({
      authSession,
      openExternal: options.onOpenExternal,
      onSuccess: async () => {
        await onAuthChange?.("browser-login");
      },
    });
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${requestedPort}`);
    const pathname = url.pathname;

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-RivonClaw-Desktop-Token");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Unified Panel event stream — entity/status snapshots + patches +
    // discrete notification events all multiplex here. Replaces the three
    // legacy endpoints (chat/events, store/stream, status/stream) so Panel
    // opens exactly ONE EventSource per session.
    if (pathname === "/api/events" && req.method === "GET") {
      panelEventBus.addClient(req, res);
      return;
    }

    // Gateway-managed assistant images are emitted in chat.history as
    // /api/chat/media/outgoing/... URLs. The Panel is served by Desktop, so
    // Desktop must proxy those image bytes to the OpenClaw gateway with the
    // private gateway token instead of asking browser <img> tags to know it.
    if (pathname.startsWith(MANAGED_CHAT_MEDIA_PREFIX)) {
      await proxyManagedChatMedia(req, res, url, options.getGatewayInfo, gatewayPort);
      return;
    }

    if (pathname === "/api/chat/media/local" && req.method === "GET") {
      serveLocalChatMedia(res, url);
      return;
    }

    // Serve media files from ~/.rivonclaw/openclaw/media/
    if (pathname.startsWith("/api/media/") && req.method === "GET") {
      const mediaBase = resolveMediaBase();
      const relPath = decodeURIComponent(pathname.replace("/api/media/", ""));
      const absPath = resolve(mediaBase, relPath);
      if (!absPath.startsWith(mediaBase + "/")) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      try {
        const data = readFileSync(absPath);
        const ext = extname(absPath).toLowerCase();
        res.writeHead(200, {
          "Content-Type": IMAGE_EXT_TO_MIME[ext] ?? "application/octet-stream",
          "Cache-Control": "private, max-age=86400",
        });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
      return;
    }

    // API routes
    if (pathname.startsWith("/api/")) {
      // Changelog endpoint (uses closure variable changelogEntries)
      if (pathname === "/api/app/changelog" && req.method === "GET") {
        const result = getUpdateResult?.();
        sendJson(res, 200, {
          currentVersion: result?.currentVersion ?? null,
          entries: changelogEntries,
        });
        return;
      }

      // In-app update download/install endpoints (use closure callbacks)
      if (pathname === "/api/app/update/download" && req.method === "POST") {
        if (!onUpdateDownload) {
          sendJson(res, 501, { error: "Not supported" });
          return;
        }
        onUpdateDownload().catch(() => { });
        sendJson(res, 200, { ok: true });
        return;
      }

      if (pathname === "/api/app/update/cancel" && req.method === "POST") {
        onUpdateCancel?.();
        sendJson(res, 200, { ok: true });
        return;
      }

      if (pathname === "/api/app/update/download-status" && req.method === "GET") {
        const state = getUpdateDownloadState?.() ?? { status: "idle" };
        sendJson(res, 200, state);
        return;
      }

      if (pathname === "/api/app/update/install" && req.method === "POST") {
        if (!onUpdateInstall) {
          sendJson(res, 501, { error: "Not supported" });
          return;
        }
        onUpdateInstall()
          .then(() => sendJson(res, 200, { ok: true }))
          .catch((err: unknown) => {
            const msg = formatError(err);
            sendJson(res, 500, { error: msg });
          });
        return;
      }

      try {
        if (await registry.dispatch(req, res, url, pathname, ctx)) return;
        sendJson(res, 404, { error: "Not found" });
      } catch (err) {
        log.error("API error:", err);
        sendJson(res, 500, { error: "Internal server error" });
      }
      return;
    }

    // Static file serving for panel SPA
    serveStatic(res, distDir, pathname);
  });

  server.on("close", () => {
    ctx.googleAuthCoordinator?.dispose();
    ctx.browserLoginCoordinator?.dispose();
    pairingNotifier.stop();
    panelEventBus.shutdown();
  });

  const actualPort = await new Promise<number>((resolve, reject) => {
    server.listen(requestedPort, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      log.info(`Panel server listening on http://127.0.0.1:${addr.port}`);
      resolve(addr.port);
    });
    server.on("error", reject);
  });

  return { server, port: actualPort };
}

async function proxyManagedChatMedia(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  getGatewayInfo: PanelServerOptions["getGatewayInfo"],
  gatewayPort: number,
): Promise<void> {
  if (req.method !== "GET") {
    res.writeHead(405, {
      "Content-Type": "text/plain; charset=utf-8",
      Allow: "GET",
    });
    res.end("Method Not Allowed");
    return;
  }

  let gatewayUrl: URL;
  let token: string | undefined;
  try {
    const info = getGatewayInfo?.();
    token = info?.token;
    if (info?.wsUrl) {
      gatewayUrl = new URL(info.wsUrl);
      gatewayUrl.protocol = gatewayUrl.protocol === "wss:" ? "https:" : "http:";
      gatewayUrl.pathname = url.pathname;
      gatewayUrl.search = url.search;
    } else {
      gatewayUrl = new URL(`http://127.0.0.1:${gatewayPort}${url.pathname}${url.search}`);
    }
  } catch {
    gatewayUrl = new URL(`http://127.0.0.1:${gatewayPort}${url.pathname}${url.search}`);
  }

  try {
    const upstream = await fetch(gatewayUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (upstream.status === 404 && serveManagedChatMediaFromLocalStore(res, url)) {
      return;
    }
    const headers: Record<string, string> = {};
    for (const name of [
      "content-type",
      "content-length",
      "cache-control",
      "content-disposition",
    ]) {
      const value = upstream.headers.get(name);
      if (value) headers[name] = value;
    }
    res.writeHead(upstream.status, headers);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    if (serveManagedChatMediaFromLocalStore(res, url)) {
      return;
    }
    log.warn("Failed to proxy managed chat media:", err);
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad Gateway");
  }
}

function serveLocalChatMedia(res: ServerResponse, url: URL): boolean {
  const rawPath = url.searchParams.get("path");
  if (!rawPath) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("missing path");
    return true;
  }

  const absPath = resolve(rawPath);
  const stateBase = resolve(resolveOpenClawStateDir());
  const ext = extname(absPath).toLowerCase();
  if (!absPath.startsWith(stateBase + "/") || !IMAGE_EXT_TO_MIME[ext]) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("forbidden");
    return true;
  }

  try {
    const data = readFileSync(absPath);
    res.writeHead(200, {
      "Content-Type": IMAGE_EXT_TO_MIME[ext] || "application/octet-stream",
      "Content-Length": String(data.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="${sanitizeContentDispositionFilename(basename(absPath))}"`,
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("not found");
  }
  return true;
}

type ManagedChatMediaRecord = {
  attachmentId?: string;
  sessionKey?: string;
  messageId?: string;
  original?: {
    path?: string;
    contentType?: string;
    sizeBytes?: number | null;
    filename?: string | null;
  };
};

function serveManagedChatMediaFromLocalStore(res: ServerResponse, url: URL): boolean {
  if (res.writableEnded) {
    return true;
  }
  const match = url.pathname.match(MANAGED_CHAT_MEDIA_ROUTE_RE);
  if (!match) {
    return false;
  }

  let sessionKey: string;
  try {
    sessionKey = decodeURIComponent(match[1]);
  } catch {
    return false;
  }
  const attachmentId = match[2];
  const mediaBase = resolve(resolveOpenClawStateDir(), "media", "outgoing");
  const recordsBase = resolve(mediaBase, "records");
  const recordPath = resolve(recordsBase, `${attachmentId}.json`);
  if (!recordPath.startsWith(recordsBase + "/")) {
    return false;
  }

  let record: ManagedChatMediaRecord | null = null;
  if (existsSync(recordPath)) {
    try {
      record = JSON.parse(readFileSync(recordPath, "utf-8")) as ManagedChatMediaRecord;
    } catch {
      return false;
    }
    if (record.attachmentId !== attachmentId || record.sessionKey !== sessionKey) {
      return false;
    }
  }

  const mediaPath = record?.original?.path;
  const transcriptMediaPath = mediaPath && existsSync(mediaPath)
    ? null
    : (record ? findTranscriptMediaPathForRecord(record) : null)
      ?? findTranscriptMediaPathForAttachment(sessionKey, attachmentId);
  const sourcePath = mediaPath && existsSync(mediaPath) ? mediaPath : transcriptMediaPath;
  if (!sourcePath) {
    return false;
  }
  const absPath = resolve(sourcePath);
  const stateBase = resolve(resolveOpenClawStateDir());
  if (!absPath.startsWith(stateBase + "/")) {
    return false;
  }

  try {
    const data = readFileSync(absPath);
    const filename = sanitizeContentDispositionFilename(record?.original?.filename ?? basename(absPath));
    const recordContentType = sourcePath === mediaPath ? record?.original?.contentType : undefined;
    res.writeHead(200, {
      "Content-Type": recordContentType || IMAGE_EXT_TO_MIME[extname(absPath).toLowerCase()] || "application/octet-stream",
      "Content-Length": String(data.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="${filename}"`,
    });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

type TranscriptEvent = {
  id?: string;
  parentId?: string;
  message?: {
    role?: string;
    content?: unknown;
  };
};

function findTranscriptMediaPathForRecord(record: ManagedChatMediaRecord): string | null {
  if (!record.messageId || !record.sessionKey) {
    return null;
  }
  const eventsByTranscript = readTranscriptEventsForSessionKey(record.sessionKey);

  for (const events of eventsByTranscript) {
    const index = events.findIndex((event) => event.id === record.messageId);
    if (index < 0) {
      continue;
    }
    const mediaPath = findMediaPathNearTranscriptEvent(events, index);
    if (mediaPath) {
      return mediaPath;
    }
  }

  return null;
}

function findTranscriptMediaPathForAttachment(sessionKey: string, attachmentId: string): string | null {
  const encodedSessionKey = encodeURIComponent(sessionKey);
  const eventsByTranscript = readTranscriptEventsForSessionKey(sessionKey);

  for (const events of eventsByTranscript) {
    const index = events.findIndex((event) =>
      extractImageContentUrls(event.message?.content).some((value) =>
        value.includes(attachmentId) && (
          value.includes(encodedSessionKey)
          || value.includes(sessionKey)
          || value.includes(`/outgoing/${encodedSessionKey}/`)
        ),
      ),
    );
    if (index < 0) {
      continue;
    }
    const mediaPath = findMediaPathNearTranscriptEvent(events, index);
    if (mediaPath) {
      return mediaPath;
    }
  }

  return null;
}

function readTranscriptEventsForSessionKey(sessionKey: string): TranscriptEvent[][] {
  const agentId = getAgentIdFromSessionKey(sessionKey);
  const sessionsDir = resolve(resolveOpenClawStateDir(), "agents", agentId, "sessions");

  let entries: string[];
  try {
    entries = readdirSync(sessionsDir).filter((name) => name.endsWith(".jsonl"));
  } catch {
    return [];
  }

  const transcripts: TranscriptEvent[][] = [];
  for (const entry of entries) {
    const transcriptPath = resolve(sessionsDir, entry);
    if (!transcriptPath.startsWith(sessionsDir + "/")) {
      continue;
    }

    try {
      transcripts.push(
        readFileSync(transcriptPath, "utf-8")
          .split(/\n+/)
          .filter(Boolean)
          .map((line) => JSON.parse(line) as TranscriptEvent),
      );
    } catch {
      continue;
    }
  }
  return transcripts;
}

function getAgentIdFromSessionKey(sessionKey: string): string {
  const parts = sessionKey.split(":");
  return parts[0] === "agent" && parts[1] ? parts[1] : "main";
}

function findMediaPathNearTranscriptEvent(events: TranscriptEvent[], index: number): string | null {
  const byId = new Map(events.map((event) => [event.id, event]));
  const imageEvent = events[index];
  const parentEvent = imageEvent.parentId ? byId.get(imageEvent.parentId) : undefined;
  const parentMediaPath = extractFirstMediaDirectivePath(parentEvent?.message?.content);
  if (parentMediaPath) {
    return parentMediaPath;
  }

  for (let i = index - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event?.message?.role !== "assistant") {
      continue;
    }
    const mediaPath = extractFirstMediaDirectivePath(event.message.content);
    if (mediaPath) {
      return mediaPath;
    }
  }

  return null;
}

function extractImageContentUrls(content: unknown): string[] {
  if (!Array.isArray(content)) {
    return [];
  }
  return content.flatMap((block) => {
    if (!block || typeof block !== "object" || (block as { type?: unknown }).type !== "image") {
      return [];
    }
    const imageBlock = block as { url?: unknown; openUrl?: unknown };
    return [imageBlock.url, imageBlock.openUrl].filter((value): value is string => typeof value === "string");
  });
}

function extractFirstMediaDirectivePath(content: unknown): string | null {
  const text = extractTranscriptText(content);
  const match = text.match(
    /(?:^|\n)\s*MEDIA:\s*(?:"([^"\n]+\.(?:png|jpe?g|gif|webp)(?:\?[^"\n]*)?)"|`([^`\n]+\.(?:png|jpe?g|gif|webp)(?:\?[^`\n]*)?)`|([^\n]+?\.(?:png|jpe?g|gif|webp)(?:\?\S*)?))\s*(?=\n|$)/i,
  );
  const rawPath = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!rawPath) {
    return null;
  }
  return rawPath.replace(/\?.*$/, "").trim();
}

function extractTranscriptText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .filter((block): block is { type?: string; text?: string } =>
      Boolean(block) && typeof block === "object" && (block as { type?: unknown }).type === "text",
    )
    .map((block) => block.text ?? "")
    .join("");
}

function sanitizeContentDispositionFilename(value: string): string {
  const sanitized = value.replace(/[\r\n"\\]/g, "_").trim();
  return sanitized || "generated-image";
}

function serveStatic(
  res: ServerResponse,
  distDir: string,
  pathname: string,
): void {
  const safePath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = join(distDir, safePath);

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(distDir, "index.html");
  }

  if (!existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
    return;
  }

  const resolvedFile = resolve(filePath);
  const resolvedDist = resolve(distDir);
  if (!resolvedFile.startsWith(resolvedDist)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

  try {
    let content = readFileSync(filePath);
    if (ext === ".html") {
      const route = JSON.stringify(getFirstPartyDomainRoute());
      const bootstrap = `<script>globalThis.__RIVONCLAW_FIRST_PARTY_DOMAIN_ROUTE__=${route};</script>`;
      content = Buffer.from(content.toString("utf-8").replace("</head>", `${bootstrap}</head>`), "utf-8");
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
}
