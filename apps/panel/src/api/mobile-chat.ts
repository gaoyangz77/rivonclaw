import { fetchJson } from "./client.js";

export async function generateMobilePairingCode(): Promise<{ code?: string; error?: string }> {
    return await fetchJson<{ code?: string; error?: string }>("/mobile/pairing-code/generate", {
        method: "POST"
    });
}

export async function getMobilePairingStatus(): Promise<{ pairing?: { mobileDeviceId: string }; activeCode?: any; desktopDeviceId?: string; error?: string }> {
    return await fetchJson<{ pairing?: { mobileDeviceId: string }; activeCode?: any; desktopDeviceId?: string; error?: string }>("/mobile/status", {
        method: "GET"
    });
}

export async function disconnectMobilePairing(): Promise<{ error?: string }> {
    return await fetchJson<{ error?: string }>("/mobile/disconnect", {
        method: "DELETE"
    });
}
