import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";

// We'll lazy-load or implement the Sync Engine directly here or in a separate file.
// For now, let's keep the plugin definition clean and put WS logic in a class we can manage.
import { MobileSyncEngine } from "./dist/index.mjs";

let syncEngineInstance = null;
let pluginApi = null;

const plugin = {
    id: "mobile-chat-channel",
    name: "Mobile Chat Channel",
    description: "Bridges local OpenClaw with your Mobile PWA via Relay",
    configSchema: {
        safeParse(value) {
            if (value === undefined) return { success: true, data: undefined };
            if (!value || typeof value !== "object" || Array.isArray(value))
                return { success: false, error: { issues: [{ path: [], message: "expected config object" }] } };
            return { success: true, data: value };
        },
        jsonSchema: { type: "object", additionalProperties: false, properties: {} },
    },

    register(api) {
        pluginApi = api;

        // Register the channel extension
        api.registerChannel({
            plugin: {
                id: "mobile",
                meta: {
                    id: "mobile",
                    label: "Mobile Client",
                    selectionLabel: "Mobile Device",
                    docsPath: "/channels/mobile",
                    blurb: "Chat with your agent exclusively from your paired mobile device.",
                    aliases: ["app"],
                },
                capabilities: {
                    chatTypes: ["direct"],
                    media: true,
                },
                config: {
                    listAccountIds: () => ["default"],
                    resolveAccount: () => ({ id: "default" }),
                },
                outbound: {
                    deliveryMode: "gateway",
                    textChunkLimit: 2048,
                    async sendText(ctx) {
                        // Put into the outbox queue
                        if (syncEngineInstance) {
                            syncEngineInstance.queueOutbound(ctx.to, { type: 'text', text: ctx.text });
                        }
                        return { channel: "mobile", messageId: randomUUID(), chatId: ctx.to ?? "mobile" };
                    },
                    async sendMedia(ctx) {
                        if (syncEngineInstance) {
                            syncEngineInstance.queueOutbound(ctx.to, { type: 'image', mediaUrl: ctx.mediaUrl, text: ctx.text });
                        }
                        return { channel: "mobile", messageId: randomUUID(), chatId: ctx.to ?? "mobile" };
                    },
                },
            },
        });

        // We allow the Desktop App (panel-server) to call into the Gateway plugin 
        // to start or stop the SyncEngine when a pairing becomes active.
        api.registerGatewayMethod("mobile_chat_start_sync", async ({ payload, respond }) => {
            const { accessToken, relayUrl, desktopDeviceId } = payload;
            if (!syncEngineInstance) {
                syncEngineInstance = new MobileSyncEngine(pluginApi, accessToken, relayUrl, desktopDeviceId);
                syncEngineInstance.start();
            } else {
                syncEngineInstance.updateCredentials(accessToken, relayUrl, desktopDeviceId);
            }
            respond(true, { success: true });
        });

        api.registerGatewayMethod("mobile_chat_stop_sync", async ({ respond }) => {
            if (syncEngineInstance) {
                syncEngineInstance.stop();
                syncEngineInstance = null;
            }
            respond(true, { success: true });
        });
    },
};

export default plugin;
