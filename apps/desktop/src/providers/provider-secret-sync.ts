import { createLogger } from "@rivonclaw/logger";
import { providerSecretKey } from "@rivonclaw/core";
import type { LLMProvider } from "@rivonclaw/core";
import type { Storage } from "@rivonclaw/storage";
import type { SecretStore } from "@rivonclaw/secrets";

const log = createLogger("provider-secret-sync");

/**
 * Sync the active key for a provider to the canonical secret store slot.
 * The gateway reads `{provider}-api-key` — this keeps it in sync with the stored provider key.
 */
export async function syncActiveKey(
  provider: string,
  storage: Storage,
  secretStore: SecretStore,
): Promise<void> {
  const activeKey = storage.providerKeys.getByProvider(provider)[0];
  // Custom providers use their slug directly; built-in providers use providerSecretKey()
  const isCustom = activeKey?.authType === "custom";
  const canonicalKey = isCustom
    ? `${provider}-api-key`
    : providerSecretKey(provider as LLMProvider);
  if (activeKey) {
    const keyValue = await secretStore.get(`provider-key-${activeKey.id}`);
    if (keyValue) {
      await secretStore.set(canonicalKey, keyValue);
      log.info(`Synced active key for ${provider} (${activeKey.label}) to ${canonicalKey}`);
    }
  } else {
    await secretStore.delete(canonicalKey);
    log.info(`No active key for ${provider}, removed ${canonicalKey}`);
  }
}
