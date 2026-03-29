import { fetchJson } from "./client.js";
import type { ChannelAccountSnapshot, ChannelsStatusSnapshot } from "@rivonclaw/core";
export type { ChannelAccountSnapshot, ChannelsStatusSnapshot };

/** Legacy channel interface (SQLite-backed, not in GQL) */
interface Channel {
  id: string;
  channelType: string;
  enabled: boolean;
  accountId: string;
  settings: Record<string, unknown>;
}

/**
 * Fetch real-time channel status from OpenClaw gateway via RPC.
 * @param probe - If true, trigger health checks for all channels
 */
export async function fetchChannelStatus(probe = false): Promise<ChannelsStatusSnapshot | null> {
  const data = await fetchJson<{ snapshot: ChannelsStatusSnapshot | null; error?: string }>(
    `/channels/status?probe=${probe}`
  );
  if (data.error) {
    console.warn("Failed to fetch channel status:", data.error);
  }
  return data.snapshot;
}

/**
 * @deprecated Legacy SQLite-backed channels (Phase 0). Use fetchChannelStatus instead.
 */
export async function fetchChannels(): Promise<Channel[]> {
  const data = await fetchJson<{ channels: Channel[] }>("/channels");
  return data.channels;
}

/**
 * @deprecated Legacy SQLite-backed channels (Phase 0). Use OpenClaw config instead.
 */
export async function createChannel(channel: Omit<Channel, "id">): Promise<Channel> {
  return fetchJson<Channel>("/channels", {
    method: "POST",
    body: JSON.stringify(channel),
  });
}

/**
 * @deprecated Legacy SQLite-backed channels (Phase 0). Use OpenClaw config instead.
 */
export async function deleteChannel(id: string): Promise<void> {
  await fetchJson("/channels/" + id, { method: "DELETE" });
}

/**
 * Create a new channel account in OpenClaw config.
 */
export async function createChannelAccount(data: {
  channelId: string;
  accountId: string;
  name?: string;
  config: Record<string, unknown>;
  secrets?: Record<string, string>;
}): Promise<{ ok: boolean; channelId: string; accountId: string }> {
  return fetchJson("/channels/accounts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing channel account in OpenClaw config.
 */
export async function updateChannelAccount(
  channelId: string,
  accountId: string,
  data: {
    name?: string;
    config: Record<string, unknown>;
    secrets?: Record<string, string>;
  }
): Promise<{ ok: boolean; channelId: string; accountId: string }> {
  return fetchJson(`/channels/accounts/${channelId}/${accountId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Delete a channel account from OpenClaw config.
 */
export async function deleteChannelAccount(
  channelId: string,
  accountId: string
): Promise<{ ok: boolean; channelId: string; accountId: string }> {
  return fetchJson(`/channels/accounts/${channelId}/${accountId}`, {
    method: "DELETE",
  });
}

/**
 * Fetch a channel account's full config from SQLite (excludes secrets).
 */
export async function getChannelAccountConfig(
  channelId: string,
  accountId: string,
): Promise<{ channelId: string; accountId: string; name: string | null; config: Record<string, unknown> }> {
  return fetchJson(`/channels/accounts/${encodeURIComponent(channelId)}/${encodeURIComponent(accountId)}`);
}

// --- Pairing ---

export interface PairingRequest {
  id: string;
  code: string;
  createdAt: string;
  lastSeenAt: string;
  meta?: Record<string, string>;
}

export async function fetchPairingRequests(channelId: string): Promise<PairingRequest[]> {
  const data = await fetchJson<{ requests: PairingRequest[] }>(`/pairing/requests/${channelId}`);
  return data.requests;
}

export interface AllowlistResult {
  allowlist: string[];
  labels: Record<string, string>;
  owners: Record<string, boolean>;
}

export async function fetchAllowlist(channelId: string): Promise<AllowlistResult> {
  return fetchJson<AllowlistResult>(`/pairing/allowlist/${channelId}`);
}

export async function setRecipientLabel(channelId: string, recipientId: string, label: string): Promise<void> {
  await fetchJson(`/pairing/allowlist/${channelId}/${encodeURIComponent(recipientId)}/label`, {
    method: "PUT",
    body: JSON.stringify({ label }),
  });
}

export async function setRecipientOwner(channelId: string, recipientId: string, isOwner: boolean): Promise<void> {
  await fetchJson(`/pairing/allowlist/${channelId}/${encodeURIComponent(recipientId)}/owner`, {
    method: "PUT",
    body: JSON.stringify({ isOwner }),
  });
}

export async function approvePairing(channelId: string, code: string, locale?: string): Promise<{ id: string }> {
  const data = await fetchJson<{ id: string }>("/pairing/approve", {
    method: "POST",
    body: JSON.stringify({ channelId, code, locale }),
  });
  return data;
}

export async function removeFromAllowlist(channelId: string, entry: string): Promise<void> {
  await fetchJson(`/pairing/allowlist/${channelId}/${encodeURIComponent(entry)}`, {
    method: "DELETE",
  });
}

// --- QR Login (WeChat) ---

export async function startQrLogin(accountId?: string): Promise<{ qrDataUrl?: string; message: string }> {
  return fetchJson<{ qrDataUrl?: string; message: string }>("/channels/qr-login/start", {
    method: "POST",
    body: JSON.stringify({ accountId }),
  });
}

export async function waitQrLogin(accountId?: string, timeoutMs?: number): Promise<{ connected: boolean; message: string; accountId?: string }> {
  return fetchJson<{ connected: boolean; message: string; accountId?: string }>("/channels/qr-login/wait", {
    method: "POST",
    body: JSON.stringify({ accountId, timeoutMs }),
  });
}

