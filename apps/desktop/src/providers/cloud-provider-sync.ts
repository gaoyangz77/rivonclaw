import type { GQL } from "@rivonclaw/core";
import type { Storage } from "@rivonclaw/storage";
import type { SecretStore } from "@rivonclaw/secrets";
import { rootStore } from "../store/desktop-store.js";

/**
 * Sync the cloud LLM provider key into SQLite + secretStore.
 *
 * Called via onUserChanged listener whenever the cached user changes.
 * Delegates to the MST providerKeySyncCloud action which encapsulates
 * the full transaction: SQLite + Keychain + syncActiveKey + MST state + gateway sync.
 *
 * The storage/secretStore parameters are kept for API compatibility but are
 * no longer used directly — the MST action reads them from its environment.
 */
let syncInFlight: Promise<void> | null = null;

export async function syncCloudProviderKey(
  user: GQL.MeResponse | null,
  _storage: Storage,
  _secretStore: SecretStore,
): Promise<void> {
  // Serialize concurrent calls to avoid SQLite write conflicts
  if (syncInFlight) await syncInFlight.catch(() => {});
  syncInFlight = rootStore.providerKeySyncCloud(user);
  try { await syncInFlight; } finally { syncInFlight = null; }
}
