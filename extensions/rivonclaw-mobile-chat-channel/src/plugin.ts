/**
 * ChatClaw Mobile Chat Channel Plugin
 *
 * Infrastructure/channel plugin that bridges the local OpenClaw gateway
 * with the ChatClaw mobile app via a WebSocket relay.
 *
 * - Registers a "mobile" channel with OpenClaw
 * - Manages MobileSyncEngine instances (one per paired phone)
 * - Exposes gateway methods for Desktop to start/stop sync, query status
 * - Forwards tool-call events to paired mobile devices (disabled pending load testing)
 */

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, extname } from "node:path";
import { URL, fileURLToPath } from "node:url";

import { defineRivonClawPlugin } from "@rivonclaw/plugin-sdk";
import type { PluginApi } from "@rivonclaw/plugin-sdk";

import { MobileSyncEngine } from "./sync-engine.js";
import { RelayTransport } from "./relay-transport.js";
import { RELAY_MAX_CLIENT_BYTES, RELAY_MAX_CLIENT_MB } from "./index.js";

const HTTP_URL_RE = /^https?:\/\//i;

/**
 * Fetch a remote URL into a Buffer.  Throws on failure so callers can
 * surface a clear error message.
 */
async function fetchToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Read media from a local path or remote URL.
 * Returns { buf, fileName, ext } or throws on failure.
 */
async function readMediaSource(
  source: string,
): Promise<{ buf: Buffer; fileName: string; ext: string }> {
  if (HTTP_URL_RE.test(source)) {
    const buf = await fetchToBuffer(source);
    // Derive a filename from the URL path; fall back to a timestamp-based name.
    let fileName: string | null;
    try {
      const pathname = new URL(source).pathname;
      fileName = basename(pathname);
      if (!fileName || fileName === "/") fileName = null;
    } catch {
      fileName = null;
    }
    if (!fileName) fileName = `media-${Date.now()}`;
    const ext = extname(fileName).toLowerCase();
    return { buf, fileName, ext };
  }
  // Convert file:// URLs to local paths.
  let localPath = source;
  if (/^file:\/\//i.test(localPath)) {
    localPath = fileURLToPath(localPath);
  }
  // Expand leading ~ to home directory (Node fs doesn't do this automatically).
  // Handle both Unix ~/path and Windows ~\path.
  if (localPath.startsWith("~/") || localPath.startsWith("~\\")) {
    localPath = homedir() + localPath.slice(1);
  } else if (localPath === "~") {
    localPath = homedir();
  }
  const buf = await readFile(localPath);
  const fileName = basename(localPath);
  const ext = extname(localPath).toLowerCase();
  return { buf, fileName, ext };
}

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".xml": "application/xml",
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

// ── Module-level state (shared across setup lifecycle) ──────────────

// Shared relay transport — one WebSocket for all paired phones
let relayTransport: RelayTransport | null = null;

// Map of pairingId -> MobileSyncEngine (supports multiple paired phones)
const syncEngines = new Map<string, MobileSyncEngine>();
// Map of pairingId -> { mobileDeviceId, staleSince } (pairings where mobile has unpaired)
const stalePairings = new Map<string, { mobileDeviceId: string; staleSince: number }>();
let pluginApi: PluginApi | null = null;

/** Find the sync engine that owns a given `to` address (e.g. "mobile:{pairingId}"). */
function resolveEngine(to: string | undefined): MobileSyncEngine | null {
  if (!to) {
    // Fallback: return first engine if only one exists
    if (syncEngines.size === 1) return syncEngines.values().next().value!;
    return null;
  }
  // `to` is "mobile:{pairingId}" — extract the pairingId and look up directly
  const id = to.startsWith("mobile:") ? to.slice(7) : to;
  return syncEngines.get(id) || null;
}

function maybeStopTransport(): void {
  if (syncEngines.size === 0 && relayTransport) {
    relayTransport.disconnect();
    relayTransport = null;
  }
}

// ── Channel API extension (not yet in plugin-sdk PluginApi type) ────
type ChannelAwareApi = PluginApi & {
  registerChannel(entry: unknown): void;
};

export default defineRivonClawPlugin({
  id: "rivonclaw-mobile-chat-channel",
  name: "ChatClaw Channel",

  setup(api) {
    pluginApi = api;

    // Cast to access registerChannel which is channel-specific and not
    // yet part of the generic PluginApi type in the SDK.
    const channelApi = api as ChannelAwareApi;

    // ── Register the mobile channel with OpenClaw ────────────
    channelApi.registerChannel({
      plugin: {
        id: "mobile",
        meta: {
          id: "mobile",
          label: "ChatClaw",
          selectionLabel: "ChatClaw",
          docsPath: "/channels/mobile",
          blurb: "Chat with your agent on the go from your phone via ChatClaw.",
          aliases: ["app"],
        },
        capabilities: {
          chatTypes: ["direct"],
          media: true,
          blockStreaming: true,
        },
        config: {
          listAccountIds: () => (syncEngines.size > 0 || stalePairings.size > 0 ? ["default"] : []),
          resolveAccount: (_cfg: unknown, accountId: string) => {
            if (accountId === "default" && (syncEngines.size > 0 || stalePairings.size > 0)) {
              return { id: "default", name: "ChatClaw" };
            }
            return null;
          },
          describeAccount: (account: { id?: string } | undefined) => {
            const hasEngines = syncEngines.size > 0;
            const transportConnected = relayTransport ? relayTransport.isConnected() : false;
            return {
              accountId: account?.id ?? "default",
              name: "ChatClaw",
              configured: hasEngines || stalePairings.size > 0,
              running: hasEngines && transportConnected,
            };
          },
        },
        status: {
          buildAccountSnapshot: ({ account }: { account?: { id?: string } }) => {
            const hasEngines = syncEngines.size > 0;
            const transportConnected = relayTransport ? relayTransport.isConnected() : false;
            return {
              accountId: account?.id ?? "default",
              name: "ChatClaw",
              configured: hasEngines || stalePairings.size > 0,
              running: hasEngines && transportConnected,
              dmPolicy: "pairing",
            };
          },
        },
        messaging: {
          targetResolver: {
            looksLikeId: (raw: string) => {
              const trimmed = (raw || "").trim();
              if (!trimmed) return false;
              // Accept "mobile:<uuid>" or bare UUID
              if (/^mobile:/i.test(trimmed)) return true;
              if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed))
                return true;
              return false;
            },
            hint: "mobile:<pairingId>",
          },
        },
        outbound: {
          deliveryMode: "gateway",
          textChunkLimit: 2048,
          async sendText(ctx: { to?: string; text: string }) {
            const engine = resolveEngine(ctx.to);
            if (!engine) {
              throw new Error(`Mobile channel is not connected for target: ${ctx.to ?? "unknown"}`);
            }
            engine.queueOutbound(ctx.to, { type: "text", text: ctx.text });
            return { channel: "mobile", messageId: randomUUID(), chatId: ctx.to ?? "mobile" };
          },
          async sendMedia(ctx: { to?: string; text?: string; mediaUrl?: string }) {
            const engine = resolveEngine(ctx.to);
            if (!engine) {
              throw new Error(`Mobile channel is not connected for target: ${ctx.to ?? "unknown"}`);
            }
            if (!ctx.mediaUrl?.trim()) {
              throw new Error("Mobile channel sendMedia requires mediaUrl.");
            }
            try {
              const source = ctx.mediaUrl;
              const { buf, fileName, ext } = await readMediaSource(source);
              if (buf.length === 0) {
                engine.queueOutbound(ctx.to, {
                  type: "file",
                  data: "",
                  mimeType: MIME_BY_EXT[ext] || "application/octet-stream",
                  text: ctx.text || "",
                  fileName,
                });
                return { channel: "mobile", messageId: randomUUID(), chatId: ctx.to ?? "mobile" };
              }
              if (buf.length > RELAY_MAX_CLIENT_BYTES) {
                const sizeMB = (buf.length / (1024 * 1024)).toFixed(1);
                throw new Error(
                  `Mobile channel file too large (${sizeMB} MB). Limit is ${RELAY_MAX_CLIENT_MB} MB.`,
                );
              }
              const mimeType = MIME_BY_EXT[ext] || "application/octet-stream";
              const isImage = mimeType.startsWith("image/");
              const b64 = buf.toString("base64");
              engine.queueOutbound(ctx.to, {
                type: isImage ? "image" : "file",
                data: b64,
                mimeType,
                text: ctx.text || "",
                fileName,
              });
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              console.error("[MobileChat Plugin] Failed to send media file:", ctx.mediaUrl, err);
              throw new Error(`Mobile channel media send failed: ${message}`);
            }
            return { channel: "mobile", messageId: randomUUID(), chatId: ctx.to ?? "mobile" };
          },
        },
      },
    });

    // ── Tool event forwarding ────────────────────────────────
    // Forward tool events to paired mobile devices via plugin hooks.
    // Hooks are global — filter by sessionKey to only push to mobile sessions.
    // Disabled: relay server bandwidth impact unknown — enable after load testing.
    const ENABLE_TOOL_STATUS_FORWARDING = false;
    api.on(
      "before_tool_call",
      (_event: unknown, ctx: { sessionKey?: string; toolName: string }) => {
        if (!ENABLE_TOOL_STATUS_FORWARDING) return;
        const sk = ctx.sessionKey;
        if (!sk) return;
        for (const engine of syncEngines.values()) {
          if (engine.activeSessionKeys.has(sk)) {
            engine.sendToolStatus(ctx.toolName, "start");
          }
        }
      },
    );
    api.on("after_tool_call", (_event: unknown, ctx: { sessionKey?: string; toolName: string }) => {
      if (!ENABLE_TOOL_STATUS_FORWARDING) return;
      const sk = ctx.sessionKey;
      if (!sk) return;
      for (const engine of syncEngines.values()) {
        if (engine.activeSessionKeys.has(sk)) {
          engine.sendToolStatus(ctx.toolName, "result");
        }
      }
    });

    // ── Gateway methods ──────────────────────────────────────

    if (typeof api.registerGatewayMethod === "function") {
      // Start or update a sync engine for a specific paired phone
      api.registerGatewayMethod("mobile_chat_start_sync", async ({ params, respond, context }) => {
        const { pairingId, accessToken, relayUrl, desktopDeviceId, mobileDeviceId } =
          params as Record<string, string>;
        const engineKey = pairingId || "default";
        console.log(
          `[MobileChat Plugin] mobile_chat_start_sync. pairingId=${engineKey}, relayUrl=${relayUrl}`,
        );

        try {
          // Ensure shared transport exists
          if (!relayTransport) {
            relayTransport = new RelayTransport();
            relayTransport.start(relayUrl, accessToken, engineKey);
          } else {
            // Join this pairing on the existing transport
            relayTransport.joinPairing(engineKey, accessToken).catch((err: unknown) => {
              console.error(`[MobileChat Plugin] Failed to join pairing ${engineKey}:`, err);
            });
          }

          const existing = syncEngines.get(engineKey);
          if (existing) {
            // Engine already running for this pairing — no-op.
          } else {
            const engine = new MobileSyncEngine(
              pluginApi,
              relayTransport,
              engineKey,
              desktopDeviceId,
              mobileDeviceId || "default",
            );
            engine.gatewayBroadcast = context?.broadcast ?? null;
            engine.onUnpaired = () => {
              console.log(
                `[MobileChat Plugin] Mobile unpaired pairingId=${engineKey}. Marking stale.`,
              );
              engine.stop();
              syncEngines.delete(engineKey);
              stalePairings.set(engineKey, {
                mobileDeviceId: engine.mobileDeviceId,
                staleSince: Date.now(),
              });
              relayTransport?.leavePairing(engineKey);
              maybeStopTransport();
            };
            await engine.start();
            syncEngines.set(engineKey, engine);
            console.log(
              `[MobileChat Plugin] SyncEngine created for ${engineKey}. Total engines: ${syncEngines.size}`,
            );
          }
          respond(true, { success: true });
        } catch (err) {
          console.error("[MobileChat Plugin] Failed to start SyncEngine:", err);
          respond(false, { error: String(err) });
        }
      });

      // Query device-level presence status for all paired phones
      api.registerGatewayMethod(
        "mobile_chat_device_status",
        async ({ params: _params, respond }) => {
          const devices: Record<string, unknown> = {};
          for (const [pairingId, engine] of syncEngines) {
            devices[pairingId] = {
              relayConnected: engine.isRelayConnected,
              mobileOnline: engine.mobileOnline,
            };
          }
          // Include stale pairings (mobile has unpaired)
          for (const [pairingId, info] of stalePairings) {
            devices[pairingId] = {
              relayConnected: false,
              mobileOnline: false,
              stale: true,
              staleSince: info.staleSince,
            };
          }
          respond(true, { devices });
        },
      );

      // Register DB-persisted stale pairings so the channel stays visible after restart
      api.registerGatewayMethod("mobile_chat_register_stale", async ({ params, respond }) => {
        const { pairings } = (params || {}) as {
          pairings?: Array<{ pairingId: string; mobileDeviceId?: string; staleSince?: number }>;
        };
        if (Array.isArray(pairings)) {
          for (const p of pairings) {
            if (p.pairingId && !syncEngines.has(p.pairingId) && !stalePairings.has(p.pairingId)) {
              stalePairings.set(p.pairingId, {
                mobileDeviceId: p.mobileDeviceId || "unknown",
                staleSince: p.staleSince || Date.now(),
              });
            }
          }
        }
        respond(true, { success: true });
      });

      // Stop sync engine(s). If pairingId given, stop that one; otherwise stop all.
      api.registerGatewayMethod("mobile_chat_stop_sync", async ({ params, respond }) => {
        const { pairingId } = (params || {}) as { pairingId?: string };

        if (pairingId) {
          const engine = syncEngines.get(pairingId);
          if (engine) {
            engine.sendUnpairAndStop();
            syncEngines.delete(pairingId);
            relayTransport?.leavePairing(pairingId);
            console.log(
              `[MobileChat Plugin] SyncEngine unpaired+stopped for ${pairingId}. Remaining: ${syncEngines.size}`,
            );
            maybeStopTransport();
          }
          // Also clean up stale tracking if this was a stale cleanup
          stalePairings.delete(pairingId);
        } else {
          // Unpair and stop all engines
          for (const [_key, engine] of syncEngines) {
            engine.sendUnpairAndStop();
          }
          syncEngines.clear();
          stalePairings.clear();
          if (relayTransport) {
            relayTransport.disconnect();
            relayTransport = null;
          }
          console.log("[MobileChat Plugin] All SyncEngines unpaired+stopped.");
        }
        respond(true, { success: true });
      });
    }
  },
});
