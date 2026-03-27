import type { IncomingMessage, ServerResponse } from "node:http";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { resolveOpenClawConfigPath } from "@rivonclaw/gateway";
import { resolveCredentialsDir } from "@rivonclaw/core/node";
import { syncOwnerAllowFrom } from "../auth/owner-sync.js";
import { PAIRING_CODE_TTL_MS } from "../mobile/mobile-manager.js";
import type { MobileGraphQLRequest } from "@rivonclaw/core";
import { executeMobileGraphQL } from "../mobile/mobile-graphql.js";
import { getRpcClient } from "../gateway/rpc-client-ref.js";
import type { ApiContext } from "./api-context.js";
import { parseBody, sendJson } from "./route-utils.js";

// --- Allowlist file helpers (same format as channel-routes.ts) ---

interface AllowFromStore {
    version: number;
    allowFrom: string[];
}

export async function readMobileAllowlist(): Promise<string[]> {
    try {
        const filePath = join(resolveCredentialsDir(), "mobile-allowFrom.json");
        const content = await fs.readFile(filePath, "utf-8");
        const data: AllowFromStore = JSON.parse(content);
        return Array.isArray(data.allowFrom) ? data.allowFrom : [];
    } catch (err: any) {
        if (err.code === "ENOENT") return [];
        throw err;
    }
}

export async function writeMobileAllowlist(allowFrom: string[]): Promise<void> {
    const credDir = resolveCredentialsDir();
    await fs.mkdir(credDir, { recursive: true });
    const filePath = join(credDir, "mobile-allowFrom.json");
    const data: AllowFromStore = { version: 1, allowFrom };
    await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// --- One-time migration: re-key allowlist entries from mobileDeviceId to pairingId ---
let allowlistMigrated = false;

async function migrateAllowlistToPairingId(ctx: ApiContext): Promise<void> {
    if (allowlistMigrated) return;
    allowlistMigrated = true;

    try {
        const allPairings = ctx.storage.mobilePairings.getAllPairings();
        if (allPairings.length === 0) return;

        const allowlist = await readMobileAllowlist();
        if (allowlist.length === 0) return;

        let changed = false;
        const newAllowlist = [...allowlist];

        for (let i = 0; i < newAllowlist.length; i++) {
            const entry = newAllowlist[i];
            // If entry matches a mobileDeviceId but is not a pairingId, re-key it
            const pairing = allPairings.find(p => p.mobileDeviceId === entry && p.pairingId && p.pairingId !== entry);
            if (pairing?.pairingId) {
                newAllowlist[i] = pairing.pairingId;
                // Re-key channel_recipients
                ctx.storage.channelRecipients.delete("mobile", entry);
                ctx.storage.channelRecipients.ensureExists("mobile", pairing.pairingId, false);
                changed = true;
                console.log(`[MobileChat] Migrated allowlist entry ${entry} -> ${pairing.pairingId}`);
            }
        }

        if (changed) {
            await writeMobileAllowlist(newAllowlist);
            const configPath = resolveOpenClawConfigPath();
            syncOwnerAllowFrom(ctx.storage, configPath);
        }
    } catch (err: any) {
        console.error("[MobileChat] Allowlist migration failed:", err);
    }
}

export async function handleMobileChatRoutes(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    pathname: string,
    ctx: ApiContext
): Promise<boolean> {
    // Mobile GraphQL endpoint (used by Panel's registerPairing)
    if (pathname === "/api/graphql/mobile" && req.method === "POST") {
        const body = await parseBody(req) as MobileGraphQLRequest;
        const result = await executeMobileGraphQL(body, ctx);
        sendJson(res, 200, result);
        return true;
    }

    if (!pathname.startsWith("/api/mobile/")) {
        return false; // Not handled here
    }

    // W16-A1: Generate Pairing Code
    if (pathname === "/api/mobile/pairing-code/generate" && req.method === "POST") {
        if (!ctx.mobileManager) {
            sendJson(res, 500, { error: "Mobile Manager not initialized" });
            return true;
        }

        try {
            const codeData = await ctx.mobileManager.requestPairingCode();
            sendJson(res, 200, { ...codeData, ttlMs: PAIRING_CODE_TTL_MS });
        } catch (err: any) {
            sendJson(res, 500, { error: err.message || "Failed to generate pairing code" });
        }
        return true;
    }

    // Two-step pairing: get PWA install URL (Step 1, no pairing code needed)
    if (pathname === "/api/mobile/install-url" && req.method === "GET") {
        if (!ctx.mobileManager) {
            sendJson(res, 500, { error: "Mobile Manager not initialized" });
            return true;
        }

        try {
            const result = await ctx.mobileManager.getInstallUrl();
            sendJson(res, 200, result);
        } catch (err: any) {
            sendJson(res, 500, { error: err.message || "Failed to get install URL" });
        }
        return true;
    }

    // W16-A1: Get Pairing Status (returns all pairings)
    if (pathname === "/api/mobile/status" && req.method === "GET") {
        if (!ctx.mobileManager) {
            sendJson(res, 500, { error: "Mobile Manager not initialized" });
            return true;
        }

        const activeCode = ctx.mobileManager.getActiveCode();
        const pairings = ctx.mobileManager.getAllPairings();

        // If a code generated by Desktop is awaiting mobile pairing, poll the Control Plane
        if (activeCode) {
            ctx.mobileManager.waitForControlPlaneToken(activeCode.code).then(async (status: { paired: boolean; accessToken?: string; relayUrl?: string; pairingId?: string; desktopDeviceId?: string; mobileDeviceId?: string } | null) => {
                if (status && status.paired && status.accessToken && status.relayUrl) {
                    const newPairing = ctx.storage.mobilePairings.setPairing({
                        pairingId: status.pairingId,
                        deviceId: status.desktopDeviceId || ctx.mobileManager!.getDesktopDeviceId(),
                        accessToken: status.accessToken,
                        relayUrl: status.relayUrl,
                        mobileDeviceId: status.mobileDeviceId,
                    });

                    ctx.mobileManager!.clearActiveCode();

                    // Add the pairing as a recipient in the mobile channel allowlist (keyed by pairingId)
                    const recipientId = newPairing.pairingId || newPairing.id;
                    try {
                        const allowlist = await readMobileAllowlist();
                        if (!allowlist.includes(recipientId)) {
                            allowlist.push(recipientId);
                            await writeMobileAllowlist(allowlist);
                        }
                        // Create channel_recipients record for label/owner management
                        const isFirstRecipient = !ctx.storage.channelRecipients.hasAnyOwner();
                        ctx.storage.channelRecipients.ensureExists("mobile", recipientId, isFirstRecipient);
                        if (isFirstRecipient) {
                            const configPath = resolveOpenClawConfigPath();
                            syncOwnerAllowFrom(ctx.storage, configPath);
                        }
                        console.log("[MobileChat] Added recipient to mobile allowlist:", recipientId);
                    } catch (err: any) {
                        console.error("[MobileChat] Failed to update mobile allowlist:", err);
                    }

                    const rpcClient = getRpcClient();
                    if (rpcClient?.isConnected()) {
                        console.log("[MobileChat] Sending mobile_chat_start_sync RPC. relayUrl:", status.relayUrl);
                        rpcClient.request("mobile_chat_start_sync", {
                            pairingId: newPairing.pairingId || newPairing.id,
                            accessToken: status.accessToken,
                            relayUrl: status.relayUrl,
                            desktopDeviceId: newPairing.deviceId,
                            mobileDeviceId: newPairing.mobileDeviceId || newPairing.id,
                        }).catch((err: any) => {
                            console.error("[MobileChat] Failed to start mobile sync via RPC:", err);
                        });
                    } else {
                        console.warn("[MobileChat] RPC client not connected — cannot start sync engine. It will start on next gateway reconnect.");
                    }
                }
            }).catch((e: unknown) => console.error("Pairing wait failed", e));
        }

        sendJson(res, 200, {
            pairings: pairings,
            activeCode: activeCode || null,
            desktopDeviceId: ctx.mobileManager.getDesktopDeviceId(),
        });
        return true;
    }

    // Device-level presence status (relay connected + mobile online per device)
    if (pathname === "/api/mobile/device-status" && req.method === "GET") {
        // Lazy migration: re-key old mobileDeviceId-based allowlist entries to pairingId
        await migrateAllowlistToPairingId(ctx);

        const rpcClient = getRpcClient();
        if (!rpcClient?.isConnected()) {
            sendJson(res, 200, { devices: {} });
            return true;
        }

        try {
            const result = await rpcClient.request("mobile_chat_device_status", {}) as { devices: Record<string, any> };

            // Auto-persist stale status from plugin to DB
            const allPairings = ctx.storage.mobilePairings.getAllPairings();
            for (const [pairingKey, status] of Object.entries(result.devices)) {
                if (status.stale) {
                    const pairing = allPairings.find(p => p.pairingId === pairingKey || p.id === pairingKey);
                    if (pairing && pairing.status !== 'stale') {
                        ctx.storage.mobilePairings.markPairingStale(pairing.id);
                    }
                }
            }

            // Merge DB stale records (survives gateway restart)
            for (const p of allPairings) {
                const key = p.pairingId || p.id;
                if (p.status === 'stale' && key && !result.devices[key]) {
                    result.devices[key] = {
                        relayConnected: false,
                        mobileOnline: false,
                        stale: true,
                    };
                }
            }

            sendJson(res, 200, result);
        } catch (err: any) {
            // Even on RPC failure, return DB stale records
            const devices: Record<string, any> = {};
            try {
                const allPairings = ctx.storage.mobilePairings.getAllPairings();
                for (const p of allPairings) {
                    const key = p.pairingId || p.id;
                    if (p.status === 'stale' && key) {
                        devices[key] = {
                            relayConnected: false,
                            mobileOnline: false,
                            stale: true,
                        };
                    }
                }
            } catch { /* ignore */ }
            sendJson(res, 200, { devices });
        }
        return true;
    }

    // W16-A1: Disconnect Pairing (specific or all)
    if (pathname === "/api/mobile/disconnect" && req.method === "DELETE") {
        if (!ctx.mobileManager) {
            sendJson(res, 500, { error: "Mobile Manager not initialized" });
            return true;
        }

        try {
            const pairingId = url.searchParams.get("pairingId") || undefined;

            // Look up the relay pairingId (allowlist key) before deleting
            let allowlistKey: string | undefined;
            let relayPairingId: string | undefined;
            if (pairingId) {
                const allPairings = ctx.mobileManager.getAllPairings();
                const target = allPairings.find(p => p.id === pairingId);
                allowlistKey = target?.pairingId || target?.id;
                relayPairingId = target?.pairingId || target?.id;
            }

            ctx.mobileManager.disconnectPairing(pairingId);

            // Also clean up the allowlist + channel_recipients
            try {
                const allowlist = await readMobileAllowlist();
                if (allowlistKey) {
                    // Remove specific pairing from allowlist
                    const filtered = allowlist.filter(e => e !== allowlistKey);
                    if (filtered.length !== allowlist.length) {
                        await writeMobileAllowlist(filtered);
                    }
                    ctx.storage.channelRecipients.delete("mobile", allowlistKey);
                } else {
                    // Disconnect all — clear entire allowlist
                    await writeMobileAllowlist([]);
                    // Remove all mobile recipients from channel_recipients
                    for (const entry of allowlist) {
                        ctx.storage.channelRecipients.delete("mobile", entry);
                    }
                }
                const configPath = resolveOpenClawConfigPath();
                syncOwnerAllowFrom(ctx.storage, configPath);
            } catch (err: any) {
                console.error("[MobileChat] Failed to cleanup allowlist:", err);
            }

            // Stop the Gateway plugin sync engine
            const rpcClient = getRpcClient();
            if (rpcClient?.isConnected()) {
                rpcClient.request("mobile_chat_stop_sync", {
                    pairingId: relayPairingId, // undefined = stop all engines
                }).catch((err: any) => {
                    console.error("Failed to stop mobile sync via RPC:", err);
                });
            }

            sendJson(res, 200, { success: true });
        } catch (err: any) {
            sendJson(res, 500, { error: err.message || "Failed to disconnect mobile pairing" });
        }
        return true;
    }

    return false;
}
