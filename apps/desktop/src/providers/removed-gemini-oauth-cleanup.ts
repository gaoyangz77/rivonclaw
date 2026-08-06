import type { SecretStore } from "@rivonclaw/secrets";
import type { Storage } from "@rivonclaw/storage";

export const REMOVED_GEMINI_OAUTH_KEY_IDS_SETTING = "_internal.removed-gemini-oauth-key-ids";

/** Remove secure-store material left behind by the Gemini OAuth provider migration. */
export async function cleanupRemovedGeminiOAuthSecrets(
  storage: Storage,
  secretStore: SecretStore,
): Promise<number> {
  const rawIds = storage.settings.get(REMOVED_GEMINI_OAUTH_KEY_IDS_SETTING);
  if (!rawIds) return 0;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawIds) as unknown;
  } catch {
    storage.settings.delete(REMOVED_GEMINI_OAUTH_KEY_IDS_SETTING);
    return 0;
  }
  if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) {
    storage.settings.delete(REMOVED_GEMINI_OAUTH_KEY_IDS_SETTING);
    return 0;
  }

  for (const id of parsed) {
    await secretStore.delete(`oauth-cred-${id}`);
    await secretStore.delete(`provider-key-${id}`);
    await secretStore.delete(`proxy-auth-${id}`);
  }
  storage.settings.delete(REMOVED_GEMINI_OAUTH_KEY_IDS_SETTING);
  return parsed.length;
}
