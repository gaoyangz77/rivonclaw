import type { ProviderKeyEntry } from "@rivonclaw/core";
import { reconstructProxyUrl } from "@rivonclaw/core";
import type { SecretStore } from "@rivonclaw/secrets";

/**
 * Shape of a provider key entry enriched with the reconstructed proxyUrl
 * for the MST store (which expects `proxyUrl` rather than `proxyBaseUrl`).
 */
export interface MstProviderKeySnapshot {
  id: string;
  provider: string;
  label: string;
  model: string;
  isDefault: boolean;
  proxyUrl: string | null;
  authType: string;
  baseUrl: string | null;
  customProtocol: string | null;
  customModelsJson: string | null;
  inputModalities: string[] | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Convert a single ProviderKeyEntry (from SQLite) into a snapshot suitable
 * for the MST ProviderKeyModel.  Reconstructs `proxyUrl` from proxyBaseUrl
 * + Keychain credentials.
 */
export async function toMstSnapshot(
  entry: ProviderKeyEntry,
  secretStore: SecretStore,
): Promise<MstProviderKeySnapshot> {
  let proxyUrl: string | null = null;
  if (entry.proxyBaseUrl) {
    const credentials = await secretStore.get(`proxy-auth-${entry.id}`);
    proxyUrl = credentials
      ? reconstructProxyUrl(entry.proxyBaseUrl, credentials)
      : entry.proxyBaseUrl;
  }

  return {
    id: entry.id,
    provider: entry.provider,
    label: entry.label,
    model: entry.model,
    isDefault: entry.isDefault,
    proxyUrl,
    authType: entry.authType ?? "api_key",
    baseUrl: entry.baseUrl ?? null,
    customProtocol: entry.customProtocol ?? null,
    customModelsJson: entry.customModelsJson ?? null,
    inputModalities: entry.inputModalities ?? null,
    source: entry.source ?? "local",
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

/**
 * Convert all provider key entries from storage into MST-ready snapshots.
 */
export async function allKeysToMstSnapshots(
  entries: ProviderKeyEntry[],
  secretStore: SecretStore,
): Promise<MstProviderKeySnapshot[]> {
  return Promise.all(entries.map((e) => toMstSnapshot(e, secretStore)));
}
