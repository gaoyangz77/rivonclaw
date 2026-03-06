import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";
import fs from "node:fs/promises";
import { RelayTransport } from './relay-transport';

// Ensure the local media directory exists.
const MEDIA_DIR = join(homedir(), ".easyclaw", "openclaw", "media", "inbound", "mobile");
const SYNC_STATE_DIR = join(homedir(), ".easyclaw", "openclaw", "mobile-sync");

const SENT_HISTORY_LIMIT = 200;
const OUTBOX_LIMIT = 500;
const ACK_TIMEOUT_MS = 5 * 60_000; // 5 minutes
const SAVE_DEBOUNCE_MS = 500;
const PROCESSED_IDS_LIMIT = 1000;

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
    private lastFlushTime: number = 0;
    private syncStatePath: string;

    public readonly mobileDeviceId: string;
    public pairingId: string;
    public mobileOnline: boolean = false;
    public onUnpaired: (() => void) | null = null;

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

    /** Persist outbox and sentHistory to disk (debounced). */
    private scheduleSave() {
        if (this.saveTimer) return;
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            this.saveSyncState();
        }, SAVE_DEBOUNCE_MS);
    }

    private async saveSyncState() {
        try {
            const state = {
                outbox: Array.from(this.outbox.values()),
                sentHistory: this.sentHistory,
            };
            await fs.writeFile(this.syncStatePath, JSON.stringify(state), 'utf-8');
        } catch (err: any) {
            console.error(`[MobileSync:${this.pairingId.slice(0, 8)}] Failed to save sync state:`, err.message);
        }
    }

    private startAckTimer(id: string) {
        const existing = this.ackTimers.get(id);
        if (existing) clearTimeout(existing);
        this.ackTimers.set(id, setTimeout(() => {
            this.ackTimers.delete(id);
            if (this.outbox.delete(id)) {
                console.log(`[MobileSync:${this.pairingId.slice(0, 8)}] ACK timeout for message ${id.slice(0, 8)}, dropping from outbox`);
                this.scheduleSave();
            }
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
        console.log(`[MobileSync:${this.pairingId.slice(0,8)}] Flushing ${this.outbox.size} outbox message(s)`);
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
            if (status === 'online') {
                this.flushOutbox();
            }
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

        this.scheduleSave();

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
                    this.scheduleSave();
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
                console.log(`[MobileSync:${this.pairingId.slice(0,8)}] Mobile peer is now ${msg.status}`);
                if (this.mobileOnline) {
                    this.flushOutbox();
                }
                break;

            case "unpair":
                console.log(`[MobileSync:${this.pairingId.slice(0,8)}] Received unpair from mobile`);
                this.onUnpaired?.();
                break;

            case "reaction":
                // Mobile user reacted to a message — log for now
                console.log(`[MobileSync:${this.pairingId.slice(0,8)}] Received reaction from mobile: ${msg.emoji} on ${msg.targetId?.slice(0,8)}`);
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
                            if (!text) return;
                            if (info.kind === "block") {
                                lastBlockText = text;
                                repliesDelivered = true;
                                this.queueOutbound(this.pairingId, { type: "text", text });
                                return;
                            }
                            // Skip final reply if it matches the last block (already delivered)
                            if (info.kind === "final" && text === lastBlockText) return;
                            repliesDelivered = true;
                            this.queueOutbound(this.pairingId, { type: "text", text });
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

            console.log("[MobileSync] Message dispatched to agent. sessionKey:", route.sessionKey);
            return repliesDelivered;
    }
}
