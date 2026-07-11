import type { ProviderKeyEntry } from "@rivonclaw/core";
import { decodeJwtPayload } from "@rivonclaw/core";
import { reconstructProxyUrl } from "@rivonclaw/core";
import { SecretStoreAccessError, type SecretStore } from "@rivonclaw/secrets";

async function getOptionalSecret(secretStore: SecretStore, key: string): Promise<string | null> {
  try {
    return await secretStore.get(key);
  } catch (error) {
    if (error instanceof SecretStoreAccessError) return null;
    throw error;
  }
}

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
  oauthExpiresAt: number | null;
  createdAt: string;
  updatedAt: string;
}

function extractJwtExpiresAtMs(token: string | undefined): number | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= 0) {
    return null;
  }
  return exp * 1000;
}

async function resolveOAuthExpiresAt(entry: ProviderKeyEntry, secretStore: SecretStore): Promise<number | null> {
  if (entry.provider !== "openai-codex" || entry.authType !== "oauth") {
    return entry.oauthExpiresAt ?? null;
  }

  const credentialJson = await getOptionalSecret(secretStore, `oauth-cred-${entry.id}`);
  if (!credentialJson) {
    return entry.oauthExpiresAt ?? null;
  }

  try {
    const credential = JSON.parse(credentialJson) as { refresh?: unknown };
    const refreshExpiresAt = extractJwtExpiresAtMs(
      typeof credential.refresh === "string" ? credential.refresh : undefined,
    );
    return refreshExpiresAt ?? null;
  } catch {
    return extractJwtExpiresAtMs(credentialJson) ?? null;
  }
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
    const credentials = await getOptionalSecret(secretStore, `proxy-auth-${entry.id}`);
    proxyUrl = credentials
      ? reconstructProxyUrl(entry.proxyBaseUrl, credentials)
      : entry.proxyBaseUrl;
  }
  const oauthExpiresAt = await resolveOAuthExpiresAt(entry, secretStore);

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
    oauthExpiresAt,
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
