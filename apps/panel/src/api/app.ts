import { fetchJson, cachedFetch } from "./client.js";
import { API, clientPath } from "@rivonclaw/core/api-contract";

// --- Status ---

export interface GatewayStatus {
  status: string;
  deviceId?: string | null;
}

export async function fetchStatus(): Promise<GatewayStatus> {
  return fetchJson<GatewayStatus>(clientPath(API["app.status"]));
}

// --- App Update ---

export interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  downloadUrl: string | null;
}

export async function fetchUpdateInfo(): Promise<UpdateInfo> {
  return fetchJson<UpdateInfo>(clientPath(API["app.update"]));
}

export interface UpdateDownloadStatus {
  status: "idle" | "downloading" | "verifying" | "ready" | "installing" | "error";
  percent?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  filePath?: string;
  message?: string;
}

export async function startUpdateDownload(): Promise<void> {
  await fetchJson(clientPath(API["app.updateDownload"]), { method: "POST" });
}

export async function cancelUpdateDownload(): Promise<void> {
  await fetchJson(clientPath(API["app.updateCancel"]), { method: "POST" });
}

export async function fetchUpdateDownloadStatus(): Promise<UpdateDownloadStatus> {
  return fetchJson<UpdateDownloadStatus>(clientPath(API["app.updateDownloadStatus"]));
}

export async function triggerUpdateInstall(): Promise<void> {
  await fetchJson(clientPath(API["app.updateInstall"]), { method: "POST" });
}

// --- Changelog ---

export interface ChangelogEntry {
  version: string;
  date: string;
  en: string[];
  zh: string[];
}

export async function fetchChangelog(): Promise<{
  currentVersion: string | null;
  entries: ChangelogEntry[];
}> {
  return cachedFetch("changelog", async () => {
    return fetchJson(clientPath(API["app.changelog"]));
  }, 86_400_000); // 24h — only changes on app update
}

// --- Gateway Info ---

export interface GatewayInfo {
  wsUrl: string;
  token?: string;
}

export async function fetchGatewayInfo(): Promise<GatewayInfo> {
  return fetchJson<GatewayInfo>(clientPath(API["app.gatewayInfo"]));
}
