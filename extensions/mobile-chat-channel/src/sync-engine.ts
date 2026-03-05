import { WebSocket } from 'ws';
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";
import fs from "node:fs/promises";

// Ensure the local media directory exists.
const MEDIA_DIR = join(homedir(), ".easyclaw", "openclaw", "media", "inbound", "mobile");

export class MobileSyncEngine {
    private ws: WebSocket | null = null;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private isRunning = false;
    private outbox: Map<string, any> = new Map();
    private runIdMap: Map<string, string> = new Map();

    constructor(
        private readonly api: any, // GatewayPluginApi
        private accessToken: string,
        private relayUrl: string,
        private desktopDeviceId: string
    ) {
        this.ensureMediaDir();
    }

    private async ensureMediaDir() {
        await fs.mkdir(MEDIA_DIR, { recursive: true });
    }

    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.connect();
    }

    public stop() {
        this.isRunning = false;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    public updateCredentials(accessToken: string, relayUrl: string, desktopDeviceId: string) {
        this.accessToken = accessToken;
        this.relayUrl = relayUrl;
        this.desktopDeviceId = desktopDeviceId;
        if (this.isRunning) {
            this.stop();
            this.start(); // Reconnect with new credentials
        }
    }

    private connect() {
        if (!this.isRunning) return;

        let routeUrl = this.relayUrl.endsWith('/')
            ? `${this.relayUrl}mobile-chat`
            : `${this.relayUrl}/mobile-chat`;

        const wsUrl = `${routeUrl}?token=${this.accessToken}&client=desktop`;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                console.log("[MobileSync] Connected to Relay server.");

                // On reconnect, flush outbox
                for (const [id, msg] of this.outbox.entries()) {
                    this.transmit(msg);
                }
            });

            this.ws.on('message', async (data: Buffer, isBinary: boolean) => {
                try {
                    // Mobile sends JSON for now. Future optimization could use BSON or MSGPack for binary
                    const msg = JSON.parse(data.toString('utf-8'));
                    await this.handleIncoming(msg);
                } catch (err: any) {
                    console.error("[MobileSync] Error parsing incoming message:", err.message);
                }
            });

            this.ws.on('close', () => {
                console.log("[MobileSync] Disconnected from Relay server.");
                this.ws = null;
                this.scheduleReconnect();
            });

            this.ws.on('error', (err) => {
                console.error("[MobileSync] WebSocket error:", err.message);
                this.ws?.close();
            });

        } catch (err: any) {
            console.error("[MobileSync] Failed to initialize WebSocket:", err.message);
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect() {
        if (!this.isRunning) return;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        // Exponential backoff or simple delay. We'll use 3 seconds for now.
        this.reconnectTimer = setTimeout(() => {
            console.log("[MobileSync] Attempting to reconnect...");
            this.connect();
        }, 3000);
    }

    private transmit(payload: any) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(payload));
        }
    }

    public queueOutbound(mobileDeviceId: string, content: any) {
        const id = randomUUID();
        const msg = {
            type: "msg",
            id,
            sender: "desktop",
            timestamp: Date.now(),
            payload: content
        };

        // Cache for ACK
        this.outbox.set(id, msg);

        // Send immediately if possible
        this.transmit(msg);
        return id;
    }

    private async handleIncoming(msg: any) {
        switch (msg.type) {
            case "ack":
                // Mobile acknowledged our message
                if (msg.id) {
                    this.outbox.delete(msg.id);
                }
                break;

            case "sync_req":
                // Mobile is requesting missing history
                // In a production SQL implementation, we would query the database for messages > msg.cursor
                // and return them as sync_res
                // For V0, we acknowledge the cursor. The agent history is held in OpenClaw's internal storage
                this.transmit({
                    type: "sync_res",
                    id: randomUUID(),
                    messages: [] // To be wired to local DB extraction if needed
                });
                break;

            case "msg":
                // Send an ACK immediately
                this.transmit({ type: "ack", id: msg.id });

                // Process the actual payload with the OpenClaw Gateway
                await this.processIncomingPayload(msg);
                break;
        }
    }

    private async processIncomingPayload(msg: any) {
        const { payload, sender } = msg;

        // Only process payloads originating from mobile
        if (sender !== "mobile" || !payload) return;

        try {
            let messageText = "";
            let attachments = [];

            if (payload.type === "text") {
                messageText = payload.text;
            } else if (payload.type === "image") {
                // If it's an image, we need to save the base64 data to disk for the agent 
                // to have a valid file path reference that won't exceed memory limits.
                const fileName = `mobile-img-${Date.now()}.jpg`;
                const filePath = join(MEDIA_DIR, fileName);

                // Strip the data:image/jpeg;base64, prefix if present
                const b64Data = payload.data.replace(/^data:image\/\w+;base64,/, "");
                await fs.writeFile(filePath, Buffer.from(b64Data, 'base64'));

                messageText = payload.text || `[Image sent via mobile. Saved locally to ${filePath}]`;

                attachments.push({
                    type: "image",
                    mimeType: payload.mimeType || "image/jpeg",
                    content: b64Data
                });
            } else if (payload.type === "voice") {
                // TODO: Wire up speech-to-text. For now, mark as unsupported.
                messageText = "[Voice feature logic not fully attached yet]";
            }

            if (!messageText && attachments.length === 0) return;

            // Send standard RPC request to the Gateway Agent
            // Using agent:main:main ensures the conversation appears in the unified Chat UI on Desktop
            const result = await this.api.gatewayRpc.request("agent", {
                sessionKey: "agent:main:main",
                channel: "mobile",
                message: messageText,
                attachments: attachments,
                idempotencyKey: msg.id
            });

            // Map the resulting generic agent Run ID back to the mobile client so
            // we know where to route the response when OpenClaw fires 'chat' events via the plugin outbox
            if (result && result.runId) {
                // Mobile pairing is 1-1 per gateway config
                this.runIdMap.set(result.runId, "mobile_device");
            }

        } catch (err: any) {
            console.error("[MobileSync] Failed to pass message to Gateway Agent:", err.message);
        }
    }
}
