import { fetchJson, fetchVoid, cachedFetch, invalidateCache } from "./client.js";
import { API, clientPath } from "@rivonclaw/core/api-contract";

// --- Settings ---

export async function fetchSettings(): Promise<Record<string, string>> {
  return cachedFetch("settings", async () => {
    const data = await fetchJson<{ settings: Record<string, string> }>(clientPath(API["settings.getAll"]));
    return data.settings;
  }, 5000);
}

export async function updateSettings(settings: Record<string, string>): Promise<void> {
  await fetchJson(clientPath(API["settings.update"]), {
    method: "PUT",
    body: JSON.stringify(settings),
  });
  invalidateCache("settings");
}

export async function validateApiKey(
  provider: string,
  apiKey: string,
  proxyUrl?: string,
  model?: string,
): Promise<{ valid: boolean; error?: string }> {
  return fetchJson(clientPath(API["settings.validateKey"]), {
    method: "POST",
    body: JSON.stringify({ provider, apiKey, proxyUrl, model }),
  });
}

export async function validateCustomApiKey(
  baseUrl: string,
  apiKey: string,
  protocol: string,
  model: string,
): Promise<{ valid: boolean; error?: string }> {
  return fetchJson(clientPath(API["settings.validateCustomKey"]), {
    method: "POST",
    body: JSON.stringify({ baseUrl, apiKey, protocol, model }),
  });
}

// --- Permissions ---

export interface Permissions {
  readPaths: string[];
  writePaths: string[];
}

export async function fetchPermissions(): Promise<Permissions> {
  const data = await fetchJson<{ permissions: Permissions }>(clientPath(API["permissions.get"]));
  return data.permissions;
}

export async function updatePermissions(permissions: Permissions): Promise<void> {
  await fetchJson(clientPath(API["permissions.update"]), {
    method: "PUT",
    body: JSON.stringify(permissions),
  });
}

export async function fetchWorkspacePath(): Promise<string> {
  const data = await fetchJson<{ workspacePath: string }>(clientPath(API["workspace.get"]));
  return data.workspacePath;
}

// --- File Dialog ---

export async function openFileDialog(): Promise<string | null> {
  const data = await fetchJson<{ path: string | null }>(clientPath(API["fileDialog.open"]), {
    method: "POST",
  });
  return data.path;
}

// --- Telemetry Settings ---

/**
 * @deprecated Prefer runtimeStatus.appSettings.setTelemetryEnabled() from the MST model.
 * Kept because TelemetryConsentModal uses it before the runtime status store is connected.
 */
export async function updateTelemetrySetting(enabled: boolean): Promise<void> {
  await fetchJson(clientPath(API["settings.telemetry.set"]), {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}

// --- Agent Settings (OpenClaw session-level config) ---

export interface AgentSettings {
  dmScope: string;
}

export async function fetchAgentSettings(): Promise<AgentSettings> {
  return fetchJson<AgentSettings>(clientPath(API["agentSettings.get"]));
}

export async function updateAgentSettings(data: Partial<AgentSettings>): Promise<void> {
  await fetchJson(clientPath(API["agentSettings.set"]), {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// --- OpenClaw State Dir Override ---

export interface OpenClawStateDirInfo {
  override: string | null;
  effective: string;
  default: string;
}

export async function fetchOpenClawStateDir(): Promise<OpenClawStateDirInfo> {
  return fetchJson<OpenClawStateDirInfo>(clientPath(API["settings.openclawStateDir.get"]));
}

export async function updateOpenClawStateDir(path: string): Promise<{ ok: boolean; restartRequired: boolean }> {
  return fetchJson(clientPath(API["settings.openclawStateDir.set"]), {
    method: "PUT",
    body: JSON.stringify({ path }),
  });
}

export async function resetOpenClawStateDir(): Promise<{ ok: boolean; restartRequired: boolean }> {
  return fetchJson(clientPath(API["settings.openclawStateDir.delete"]), {
    method: "DELETE",
  });
}

// --- System Dependencies ---

export async function provisionDeps(): Promise<void> {
  await fetchJson(clientPath(API["deps.provision"]), { method: "POST" });
}

// --- Telemetry Event Tracking ---

/** Fire-and-forget telemetry event relay to desktop main process. */
export function trackEvent(eventType: string, metadata?: Record<string, unknown>): void {
  fetchVoid(clientPath(API["telemetry.track"]), {
    method: "POST",
    body: JSON.stringify({ eventType, metadata }),
  });
}
