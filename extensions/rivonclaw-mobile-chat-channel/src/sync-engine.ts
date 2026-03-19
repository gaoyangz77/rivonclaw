import { randomUUID } from "node:crypto";
import { join, dirname, basename, extname } from "node:path";
import { homedir } from "node:os";
import { URL, fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { RelayTransport } from './relay-transport';

const HTTP_URL_RE = /^https?:\/\//i;

/**
 * Fetch a remote URL into a Buffer.  Throws on HTTP errors so callers can
 * fall back gracefully.
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
async function readMediaSource(source: string): Promise<{ buf: Buffer; fileName: string; ext: string }> {
    if (HTTP_URL_RE.test(source)) {
        const buf = await fetchToBuffer(source);
        let fileName: string | null;
        try {
            const pathname = new URL(source).pathname;
            fileName = basename(pathname);
            if (!fileName || fileName === "/") fileName = null;
        } catch { fileName = null; }
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
    const buf = await fs.readFile(localPath);
    const fileName = basename(localPath);
    const ext = extname(localPath).toLowerCase();
    return { buf, fileName, ext };
}

// Ensure the local media directory exists.
const MEDIA_DIR = join(homedir(), ".rivonclaw", "openclaw", "media", "inbound", "mobile");
const SYNC_STATE_DIR = join(homedir(), ".rivonclaw", "openclaw", "mobile-sync");

// Sync: must match DEFAULTS.mobileSync.* in packages/core/src/defaults.ts
const SENT_HISTORY_LIMIT = 200;
const OUTBOX_LIMIT = 500;
const ACK_TIMEOUT_MS = 30_000; // Retry unacked messages every 30s until ACKed.
const SAVE_DEBOUNCE_MS = 500;
const PROCESSED_IDS_LIMIT = 1000;

// Duplicated from index.ts to avoid circular imports (index re-exports this module).
// Sync: must match DEFAULTS.relay.maxClientBytes in packages/core/src/defaults.ts
const RELAY_MAX_CLIENT_BYTES = 14 * 1024 * 1024; // 14 MB
const RELAY_MAX_CLIENT_MB = Math.floor(RELAY_MAX_CLIENT_BYTES / (1024 * 1024));

const MIME_BY_EXT: Record<string, string> = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".txt": "text/plain", ".md": "text/markdown", ".csv": "text/csv",
    ".json": "application/json", ".xml": "application/xml",
    ".zip": "application/zip", ".gz": "application/gzip",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
    ".mp4": "video/mp4", ".webm": "video/webm",
};

export class MobileSyncEngine {
    private outbox: Map<string, any> = new Map();
    private sentHistory: Array<{ id: string; seq: number; timestamp: number; payload: any }> = [];
    private nextSeq: number = 1;
    private ackTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
    /** IDs of incoming messages already processed — prevents duplicate agent dispatch on retransmit. */
    private processedIds: Set<string> = new Set();
    private processedIdsOrder: string[] = [];
    private unsubTransport: (() => void) | null = null;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private saveChain: Promise<void> = Promise.resolve();
    private lastFlushTime: number = 0;
    private syncStatePath: string;

    public readonly mobileDeviceId: string;
    public pairingId: string;
    public mobileOnline: boolean = false;
    public onUnpaired: (() => void) | null = null;
    /** Session keys this engine has dispatched to — used by plugin hooks to route tool events. */
    public activeSessionKeys: Set<string> = new Set();
    /** Gateway broadcast function — set by the plugin to push events to connected clients. */
    public gatewayBroadcast: ((event: string, payload: unknown) => void) | null = null;

    constructor(
        private readonly api: any, // GatewayPluginApi
        private transport: RelayTransport,
        pairingId: string,
        private desktopDeviceId: string,
        mobileDeviceId: string,
    ) {
        this.pairingId = pairingId;
        this.mobileDeviceId = mobileDeviceId;
        this.syncStatePath = join(SYNC_STATE_DIR, `${pairingId}.json`);
        this.ensureDirs();
    }

    private async ensureDirs() {
        await fs.mkdir(MEDIA_DIR, { recursive: true });
        await fs.mkdir(SYNC_STATE_DIR, { recursive: true });
    }

    /** Load persisted outbox and sentHistory from disk. */
    private async loadSyncState() {
        try {
            const data = await fs.readFile(this.syncStatePath, 'utf-8');
            const state = JSON.parse(data);
            if (Array.isArray(state.outbox)) {
                this.outbox = new Map(state.outbox.map((m: any) => [m.id, m]));
            }
            if (Array.isArray(state.sentHistory)) {
                this.sentHistory = state.sentHistory;
                // Restore nextSeq from the highest seq in history
                for (const entry of this.sentHistory) {
                    if (typeof entry.seq === 'number' && entry.seq >= this.nextSeq) {
                        this.nextSeq = entry.seq + 1;
                    }
                }
            }
            // Start ACK timers for restored outbox entries
            for (const [id] of this.outbox) {
                this.startAckTimer(id);
            }
        } catch {
            // No state file or parse error — start fresh
        }
    }

    /** Persist outbox and sentHistory to disk. Debounced by default, immediate for critical writes. */
    private scheduleSave(immediate = false) {
        if (immediate) {
            if (this.saveTimer) {
                clearTimeout(this.saveTimer);
                this.saveTimer = null;
            }
            void this.saveSyncState();
            return;
        }
        if (this.saveTimer) return;
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            void this.saveSyncState();
        }, SAVE_DEBOUNCE_MS);
    }

    private async saveSyncState() {
        this.saveChain = this.saveChain.catch(() => undefined).then(async () => {
            try {
                const state = {
                    outbox: Array.from(this.outbox.values()),
                    sentHistory: this.sentHistory,
                };
                await fs.writeFile(this.syncStatePath, JSON.stringify(state), 'utf-8');
            } catch (err: any) {
                console.error(`[MobileSync:${this.pairingId.slice(0, 8)}] Failed to save sync state:`, err.message);
            }
        });
        await this.saveChain;
    }

    private startAckTimer(id: string) {
        const existing = this.ackTimers.get(id);
        if (existing) clearTimeout(existing);
        this.ackTimers.set(id, setTimeout(() => {
            this.ackTimers.delete(id);
            const pending = this.outbox.get(id);
            if (!pending) {
                return;
            }
            // Relay does not persist messages, so never drop an unacked outbound
            // message just because the peer was offline. Keep retrying until ACKed
            // or explicitly evicted by the bounded outbox policy.
            if (this.mobileOnline && this.transport.isConnected()) {
                this.transport.send(this.pairingId, pending);
            }
            this.startAckTimer(id);
        }, ACK_TIMEOUT_MS));
    }

    private clearAckTimer(id: string) {
        const timer = this.ackTimers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.ackTimers.delete(id);
        }
    }

    private markProcessed(id: string) {
        if (!id) return;
        this.processedIds.add(id);
        this.processedIdsOrder.push(id);
        while (this.processedIdsOrder.length > PROCESSED_IDS_LIMIT) {
            this.processedIds.delete(this.processedIdsOrder.shift()!);
        }
    }

    /** Flush outbox, deduplicating rapid successive calls (e.g. transport reconnect + peer_status). */
    private flushOutbox() {
        if (this.outbox.size === 0) return;
        const now = Date.now();
        if (now - this.lastFlushTime < 3000) return; // skip if flushed within 3s
        this.lastFlushTime = now;
        for (const [_id, msg] of this.outbox.entries()) {
            this.transport.send(this.pairingId, msg);
        }
    }

    public async start() {
        await this.loadSyncState();

        // Register handler for this pairing's messages
        this.transport.registerHandler(this.pairingId, (msg) => this.handleIncoming(msg));

        // Subscribe to transport connection status for reconnect outbox flush
        this.unsubTransport = this.transport.subscribeStatus((status) => {
            // Don't flush on 'online' — the transport gates 'online' until rejoin_ack,
            // and peer_status handler (below) flushes when mobile is confirmed reachable.
            if (status === 'offline') {
                this.mobileOnline = false;
            }
        });
    }

    public stop() {
        this.mobileOnline = false;
        this.transport.unregisterHandler(this.pairingId);
        if (this.unsubTransport) {
            this.unsubTransport();
            this.unsubTransport = null;
        }
        // Clear ACK timers
        for (const timer of this.ackTimers.values()) clearTimeout(timer);
        this.ackTimers.clear();
        // Flush pending save immediately
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        this.saveSyncState();
    }

    /** Notify the mobile peer that this pairing is being removed, then stop. */
    public sendUnpairAndStop() {
        this.transport.send(this.pairingId, { type: "unpair" });
        // Small delay to let the message flush before unregistering
        setTimeout(() => this.stop(), 200);
    }

    /** Send an ephemeral tool status event to the mobile peer (not queued in outbox). */
    public sendToolStatus(toolName: string, phase: "start" | "result") {
        this.transport.send(this.pairingId, {
            type: "tool_status",
            id: randomUUID(),
            toolName,
            phase,
            sender: "desktop",
            timestamp: Date.now(),
        });
    }

    public sendReaction(targetId: string, emoji: string) {
        this.transport.send(this.pairingId, {
            type: "reaction",
            id: randomUUID(),
            targetId,
            emoji,
            sender: "desktop",
            timestamp: Date.now(),
        });
    }

    /**
     * Read a local file or remote URL, convert to base64, and queue an image/file outbound message.
     * Supports both local file paths and HTTP(S) URLs (e.g. DALL-E image URLs).
     * Falls back to a text placeholder on read errors or if the file exceeds the relay size limit.
     */
    private async deliverMediaFile(source: string, caption: string) {
        try {
            const { buf, fileName, ext } = await readMediaSource(source);
            if (buf.length === 0) {
                this.queueOutbound(this.pairingId, {
                    type: "file",
                    data: "",
                    mimeType: MIME_BY_EXT[ext] || "application/octet-stream",
                    text: caption,
                    fileName,
                });
                return;
            }
            if (buf.length > RELAY_MAX_CLIENT_BYTES) {
                const sizeMB = (buf.length / (1024 * 1024)).toFixed(1);
                console.error(`[MobileSync] File too large (${sizeMB} MB), skipping send: ${source}`);
                this.queueOutbound(this.pairingId, {
                    type: "text",
                    text: `[File too large: ${sizeMB} MB, limit is ${RELAY_MAX_CLIENT_MB} MB]`,
                });
                return;
            }
            const mimeType = MIME_BY_EXT[ext] || "application/octet-stream";
            const isImage = mimeType.startsWith("image/");
            const b64 = buf.toString("base64");
            this.queueOutbound(this.pairingId, {
                type: isImage ? "image" : "file",
                data: b64,
                mimeType,
                text: caption,
                fileName,
            });
        } catch (err: any) {
            console.error("[MobileSync] Failed to read media source:", source, err.message);
            this.queueOutbound(this.pairingId, { type: "text", text: caption || "[File]" });
        }
    }

    /** Reset the agent session: update session store, archive transcripts, and clear engine state. */
    public async resetSession() {
        const core = this.api.runtime;
        const cfg = this.api.config;
        const route = core.channel.routing.resolveAgentRoute({
            cfg,
            channel: "mobile",
            accountId: this.pairingId,
            peer: { kind: "direct", id: this.mobileDeviceId },
        });
        const storePath = core.channel.session.resolveStorePath(
            (cfg.session as Record<string, unknown> | undefined)?.store as string | undefined,
            { agentId: route.agentId },
        );
        // storePath points to the sessions store file (e.g. sessions.json), so dirname gives the sessions directory
        const sessionDir = storePath ? dirname(storePath) : join(homedir(), ".openclaw", "sessions");

        // 1. Read the current sessionId from the store, then update the entry with a new sessionId.
        //    Transcript files are named by sessionId (UUID), not by sessionKey.
        let oldSessionId: string | undefined;
        if (storePath) {
            try {
                const raw = await fs.readFile(storePath, "utf-8");
                const store = JSON.parse(raw) as Record<string, any>;
                const entry = store[route.sessionKey];
                if (entry) {
                    oldSessionId = entry.sessionId;
                    entry.sessionId = randomUUID();
                    entry.updatedAt = Date.now();
                    entry.systemSent = false;
                    entry.abortedLastRun = false;
                    entry.inputTokens = 0;
                    entry.outputTokens = 0;
                    entry.totalTokens = 0;
                    entry.totalTokensFresh = true;
                    await fs.writeFile(storePath, JSON.stringify(store, null, 2) + "\n", "utf-8");
                }
            } catch (err: any) {
                console.error(`[MobileSync:${this.pairingId.slice(0,8)}] Failed to update session store:`, err.message);
            }
        }

        // 2. Archive the session transcript file by renaming it.
        //    The transcript filename is {sessionId}.jsonl (NOT sessionKey).
        if (oldSessionId) {
            const sessionFile = join(sessionDir, `${oldSessionId}.jsonl`);
            const archiveSuffix = `.reset.${new Date().toISOString().replace(/:/g, "-")}`;
            const archiveFile = sessionFile + archiveSuffix;
            try {
                await fs.rename(sessionFile, archiveFile);
            } catch (err: any) {
                if (err.code !== "ENOENT") throw err;
            }
        }

        // 3. Clear engine outbox and sent history
        this.outbox.clear();
        this.sentHistory.length = 0;
        this.processedIds.clear();
        this.processedIdsOrder.length = 0;
        this.activeSessionKeys.clear();
        this.scheduleSave();

        // 4. Broadcast session-reset event to connected gateway clients (Chat Page)
        if (this.gatewayBroadcast) {
            this.gatewayBroadcast("mobile.session-reset", { sessionKey: route.sessionKey });
        }

    }

    public get isRelayConnected(): boolean {
        return this.transport.isConnected();
    }

    public queueOutbound(_destination: string, content: any) {
        const id = randomUUID();
        const seq = this.nextSeq++;
        const msg = {
            type: "msg",
            id,
            seq,
            sender: "desktop",
            timestamp: Date.now(),
            payload: content
        };

        // Cache for ACK (with size limit — drop oldest if full)
        this.outbox.set(id, msg);
        if (this.outbox.size > OUTBOX_LIMIT) {
            const oldest = this.outbox.keys().next().value!;
            this.outbox.delete(oldest);
            this.clearAckTimer(oldest);
        }
        this.startAckTimer(id);
        this.sentHistory.push({ id, seq, timestamp: msg.timestamp, payload: content });
        if (this.sentHistory.length > SENT_HISTORY_LIMIT) {
            this.sentHistory.splice(0, this.sentHistory.length - SENT_HISTORY_LIMIT);
        }

        this.scheduleSave(true);

        // Send immediately if possible (transport.send adds pairingId)
        this.transport.send(this.pairingId, msg);
        return id;
    }

    private async handleIncoming(msg: any) {
        switch (msg.type) {
            case "ack":
                if (msg.id) {
                    this.outbox.delete(msg.id);
                    this.clearAckTimer(msg.id);
                    this.scheduleSave(true);
                }
                break;

            case "sync_req": {
                const lastSeq = typeof msg.lastSeq === "number" ? msg.lastSeq : 0;
                const missed = this.sentHistory
                    .filter((entry) => entry.seq > lastSeq && !this.outbox.has(entry.id))
                    .map((entry) => ({
                        type: "msg" as const,
                        id: entry.id,
                        seq: entry.seq,
                        sender: "desktop" as const,
                        timestamp: entry.timestamp,
                        payload: entry.payload,
                    }));
                this.transport.send(this.pairingId, {
                    type: "sync_res",
                    id: randomUUID(),
                    messages: missed,
                });
                break;
            }

            case "peer_status":
                this.mobileOnline = msg.status === "online";
                if (this.mobileOnline) {
                    this.flushOutbox();
                }
                break;

            case "unpair":
                console.log(`[MobileSync:${this.pairingId.slice(0,8)}] Received unpair from mobile`);
                this.onUnpaired?.();
                break;

            case "reaction":
                if (this.gatewayBroadcast && msg.targetId && msg.emoji) {
                    this.gatewayBroadcast("mobile.reaction", {
                        pairingId: this.pairingId,
                        targetId: msg.targetId,
                        emoji: msg.emoji,
                        sender: msg.sender || "mobile",
                        timestamp: msg.timestamp || Date.now(),
                    });
                }
                break;

            case "reset_req":
                try {
                    await this.resetSession();
                    this.transport.send(this.pairingId, {
                        type: "reset_ack",
                        id: randomUUID(),
                        success: true,
                        timestamp: Date.now(),
                    });
                } catch (err: any) {
                    console.error("[MobileSync] Reset failed:", err.message);
                    this.transport.send(this.pairingId, {
                        type: "reset_ack",
                        id: randomUUID(),
                        success: false,
                        error: err.message,
                        timestamp: Date.now(),
                    });
                }
                break;

            case "delivery_failed":
                // Relay could not deliver (peer offline or pairing not yet registered).
                // Keep the message in outbox — the ACK timer will retry automatically.
                if (msg.messageId) {
                    console.warn(`[MobileSync:${this.pairingId.slice(0, 8)}] delivery_failed for ${msg.messageId}: ${msg.reason}`);
                }
                break;

            case "msg":
                // Always ACK (so mobile UI shows delivered promptly)
                this.transport.send(this.pairingId, { type: "ack", id: msg.id });
                // Dedup: skip if already processed (retransmit from flushPending)
                if (msg.id && this.processedIds.has(msg.id)) break;
                this.markProcessed(msg.id);
                // Immediately react with 👀 so the user sees instant "seen" feedback
                this.sendReaction(msg.id, "👀");
                try {
                    const replied = await this.processIncomingPayload(msg);
                    if (!replied) {
                        // Agent produced no reply (empty response) — not an error, just nothing to send.
                    }
                } catch (err: any) {
                    console.error("[MobileSync] Failed to process message:", err.message, err.stack);
                    this.queueOutbound(this.pairingId, {
                        type: "text",
                        text: "[System] Failed to process your message. Please try again.",
                    });
                }
                break;
        }
    }

    /** Returns true if at least one agent reply was delivered to mobile. */
    private async processIncomingPayload(msg: any): Promise<boolean> {
        const { payload, sender } = msg;

        if (sender !== "mobile" || !payload) return false;

        const core = this.api.runtime;
        const cfg = this.api.config;

        let messageText = "";
        let mediaPaths: string[] = [];
        let mediaTypes: string[] = [];

            if (payload.type === "text") {
                messageText = payload.text;
            } else if (payload.type === "image") {
                const fileName = `mobile-img-${Date.now()}.jpg`;
                const filePath = join(MEDIA_DIR, fileName);

                const b64Data = payload.data.replace(/^data:image\/\w+;base64,/, "");
                await fs.writeFile(filePath, Buffer.from(b64Data, 'base64'));

                messageText = payload.text || "[Image from mobile]";
                mediaPaths.push(filePath);
                mediaTypes.push(payload.mimeType || "image/jpeg");
            } else if (payload.type === "voice") {
                const ext = (payload.mimeType || "audio/webm").includes("mp4") ? "m4a" : "webm";
                const fileName = `mobile-voice-${Date.now()}.${ext}`;
                const filePath = join(MEDIA_DIR, fileName);

                const b64Data = (payload.data || "").replace(/^data:audio\/\w+;base64,/, "");
                await fs.writeFile(filePath, Buffer.from(b64Data, "base64"));

                messageText = payload.text || "[Voice message]";
                mediaPaths.push(filePath);
                mediaTypes.push(payload.mimeType || "audio/webm");
            } else if (payload.type === "file") {
                const ext = (payload.mimeType || "application/octet-stream").split("/").pop() || "bin";
                const fileName = `mobile-file-${Date.now()}.${ext}`;
                const filePath = join(MEDIA_DIR, fileName);

                const b64Data = (payload.data || "").replace(/^data:[^;]+;base64,/, "");
                await fs.writeFile(filePath, Buffer.from(b64Data, "base64"));

                messageText = payload.text || "[File from mobile]";
                mediaPaths.push(filePath);
                mediaTypes.push(payload.mimeType || "application/octet-stream");
            }

            if (!messageText && mediaPaths.length === 0) return false;

            const route = core.channel.routing.resolveAgentRoute({
                cfg,
                channel: "mobile",
                accountId: this.pairingId,
                peer: { kind: "direct", id: this.mobileDeviceId },
            });
            this.activeSessionKeys.add(route.sessionKey);

            // Notify connected Chat Page clients that a mobile user message arrived,
            // so it appears in the conversation in real time (not only after sync).
            if (this.gatewayBroadcast) {
                this.gatewayBroadcast("mobile.inbound", {
                    sessionKey: route.sessionKey,
                    message: messageText,
                    timestamp: msg.timestamp || Date.now(),
                    channel: "mobile",
                    ...(mediaPaths.length > 0 ? { mediaPaths } : {}),
                });
            }

            const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(cfg);
            const storePath = core.channel.session.resolveStorePath(
                (cfg.session as Record<string, unknown> | undefined)?.store as string | undefined,
                { agentId: route.agentId },
            );
            const previousTimestamp = core.channel.session.readSessionUpdatedAt({
                storePath,
                sessionKey: route.sessionKey,
            });

            const body = core.channel.reply.formatAgentEnvelope({
                channel: "Mobile",
                from: this.mobileDeviceId,
                timestamp: msg.timestamp || Date.now(),
                previousTimestamp,
                envelope: envelopeOptions,
                body: messageText,
            });

            const ctxPayload = core.channel.reply.finalizeInboundContext({
                Body: body,
                BodyForAgent: messageText,
                RawBody: messageText,
                CommandBody: messageText,
                From: `mobile:${this.mobileDeviceId}`,
                To: `mobile:${this.pairingId}`,
                SessionKey: route.sessionKey,
                AccountId: route.accountId,
                ChatType: "direct",
                ConversationLabel: `Mobile ${this.mobileDeviceId.slice(0, 8)}`,
                Provider: "mobile",
                Surface: "mobile",
                MessageSid: msg.id,
                Timestamp: msg.timestamp || Date.now(),
                OriginatingChannel: "mobile",
                OriginatingTo: `mobile:${this.pairingId}`,
                CommandAuthorized: true,
                ...(mediaPaths.length > 0 ? { MediaPaths: mediaPaths, MediaTypes: mediaTypes } : {}),
            });

            await core.channel.session.recordInboundSession({
                storePath,
                sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
                ctx: ctxPayload,
                onRecordError: (err: any) => {
                    console.error("[MobileSync] session meta error:", err);
                },
            });

            // Track last block text to dedup block+final deliveries.
            // The buffered dispatcher calls deliver() for both streaming blocks
            // and the final reply, which often carry identical text.
            // Also track whether any reply was delivered so we suppress the error
            // notification when the agent already replied successfully.
            let lastBlockText: string | null = null;
            let repliesDelivered = false;
            try {
                await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
                    ctx: ctxPayload,
                    cfg,
                    replyOptions: { disableBlockStreaming: false },
                    dispatcherOptions: {
                        deliver: async (replyPayload: any, info: { kind: string }) => {
                            const text = (replyPayload.text ?? "").replace(/\bNO_REPLY\b/g, "").trim();

                            // Collect media URLs from the reply payload.
                            const mediaUrls: string[] = Array.isArray(replyPayload.mediaUrls)
                                ? replyPayload.mediaUrls.filter((u: unknown) => typeof u === "string" && u)
                                : [];
                            if (typeof replyPayload.mediaUrl === "string" && replyPayload.mediaUrl) {
                                mediaUrls.push(replyPayload.mediaUrl);
                            }

                            if (!text && mediaUrls.length === 0) return;

                            if (info.kind === "block") {
                                // Block streaming: deliver media immediately since the
                                // final payload may be suppressed when blocks succeed.
                                for (const filePath of mediaUrls) {
                                    await this.deliverMediaFile(filePath, "");
                                }
                                if (mediaUrls.length > 0) repliesDelivered = true;
                                if (text) {
                                    lastBlockText = text;
                                    repliesDelivered = true;
                                    this.queueOutbound(this.pairingId, { type: "text", text });
                                }
                                return;
                            }

                            // Final reply: send media files first, then text (if not already sent as block).
                            for (const filePath of mediaUrls) {
                                await this.deliverMediaFile(filePath, "");
                            }
                            if (mediaUrls.length > 0) {
                                repliesDelivered = true;
                            }

                            // Skip final text if it matches the last block (already delivered)
                            if (text && !(info.kind === "final" && text === lastBlockText)) {
                                repliesDelivered = true;
                                this.queueOutbound(this.pairingId, { type: "text", text });
                            }
                        },
                        onError: (err: any, info: any) => {
                            console.error(`[MobileSync] ${info.kind} reply failed:`, err);
                        },
                    },
                });
            } catch (dispatchErr: any) {
                // If agent replies were already delivered, this is a post-dispatch
                // cleanup error — log it but don't propagate (the user already got
                // the agent's response, sending "[System] Failed..." would be confusing).
                if (repliesDelivered) {
                    console.error("[MobileSync] Post-dispatch error (replies already sent, suppressed):", dispatchErr.message);
                } else {
                    throw dispatchErr;
                }
            }

            return repliesDelivered;
    }
}
