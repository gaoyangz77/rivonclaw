import { fetchJson } from "./client.js";

export interface MobilePairingInfo {
    id: string;
    pairingId?: string;
    deviceId: string;
    accessToken: string;
    relayUrl: string;
    createdAt: string;
    mobileDeviceId?: string;
    name?: string;
}

export interface MobilePairingStatusResponse {
    pairings?: MobilePairingInfo[];
    activeCode?: { code: string; expiresAt: number } | null;
    desktopDeviceId?: string;
    error?: string;
}

export interface RegisterPairingBody {
    pairingId?: string;
    desktopDeviceId: string;
    accessToken: string;
    relayUrl: string;
    mobileDeviceId?: string;
}

/** Get current pairing status (pairings list, desktopDeviceId) from the desktop. */
export async function getMobilePairingStatus(): Promise<MobilePairingStatusResponse> {
    return await fetchJson<MobilePairingStatusResponse>("/mobile/status", {
        method: "GET"
    });
}

export interface MobileDeviceStatusResponse {
    devices: Record<string, { relayConnected: boolean; mobileOnline: boolean; stale?: boolean }>;
}

export async function fetchMobileDeviceStatus(): Promise<MobileDeviceStatusResponse> {
    return await fetchJson<MobileDeviceStatusResponse>("/mobile/device-status", {
        method: "GET"
    });
}

export async function disconnectMobilePairing(pairingId?: string): Promise<{ error?: string }> {
    const query = pairingId ? `?pairingId=${encodeURIComponent(pairingId)}` : "";
    return await fetchJson<{ error?: string }>(`/mobile/disconnect${query}`, {
        method: "DELETE"
    });
}
