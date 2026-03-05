import { randomUUID } from "node:crypto";
import type { Storage } from "@easyclaw/storage";
import { createLogger } from "@easyclaw/logger";

const log = createLogger("mobile-manager");

export class MobileManager {
    private activeCode: { code: string; expiresAt: number } | null = null;
    private desktopDeviceId: string | null = null;

    constructor(
        private readonly storage: Storage,
        private readonly controlPlaneUrl: string = "https://api.easy-claw.com"
    ) { }

    public getDesktopDeviceId(): string {
        if (this.desktopDeviceId) {
            return this.desktopDeviceId;
        }

        // In a real implementation, this would ideally read from a persistent config
        // For now, we generate one and keep it in memory.
        this.desktopDeviceId = randomUUID();
        return this.desktopDeviceId;
    }

    public async requestPairingCode(): Promise<{ code: string }> {
        const deviceId = this.getDesktopDeviceId();

        try {
            const response = await fetch(`${this.controlPlaneUrl}/api/v1/pair/generate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ desktopDeviceId: deviceId }),
            });

            if (!response.ok) {
                throw new Error(`Failed to generate pairing code: ${response.statusText}`);
            }

            const data = await response.json() as { code: string };
            this.activeCode = {
                code: data.code,
                expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
            };

            return { code: data.code };
        } catch (error) {
            log.error("Error requesting pairing code:", error);
            throw error;
        }
    }

    public getActivePairing() {
        return this.storage.mobilePairings.getActivePairing();
    }

    public disconnectPairing(): void {
        this.storage.mobilePairings.clearPairing();
        this.activeCode = null;
        log.info("Mobile pairing disconnected");
    }

    public getActiveCode(): { code: string; expiresAt: number } | null {
        if (this.activeCode && this.activeCode.expiresAt > Date.now()) {
            return this.activeCode;
        }
        this.activeCode = null;
        return null;
    }

    public clearActiveCode(): void {
        this.activeCode = null;
    }

    public async waitForControlPlaneToken(code: string): Promise<{ paired: boolean; accessToken?: string; relayUrl?: string; desktopDeviceId?: string }> {
        try {
            const response = await fetch(`${this.controlPlaneUrl}/api/v1/pair/wait?code=${encodeURIComponent(code)}`);
            if (!response.ok) return { paired: false };
            const data = await response.json();
            return data as { paired: boolean; accessToken?: string; relayUrl?: string; desktopDeviceId?: string };
        } catch (error) {
            log.error("Error waiting for pairing status:", error);
            return { paired: false };
        }
    }
}
