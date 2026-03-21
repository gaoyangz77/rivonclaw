import { getApiBaseUrl } from "@rivonclaw/core";
import type { GQL } from "@rivonclaw/core";
import type { Storage } from "@rivonclaw/storage";
import type { SecretStore } from "@rivonclaw/secrets";
import { createLogger } from "@rivonclaw/logger";
import { syncActiveKey } from "./provider-validator.js";

const log = createLogger("cloud-provider-sync");

const CLOUD_PROVIDER_ID = "rivonclaw-pro";
const CLOUD_KEY_LABEL = "RivonClaw Pro";

/**
 * Sync the cloud LLM provider key into SQLite + secretStore.
 *
 * Called via onUserChanged listener whenever the cached user changes.
 * - If the user has an llmKey: upsert the provider key entry + secret.
 * - If not (logged out / no key): delete any existing cloud entry.
 */
export async function syncCloudProviderKey(
  user: GQL.MeResponse | null,
  storage: Storage,
  secretStore: SecretStore,
): Promise<void> {
  const llmKey = user?.llmKey?.key;
  const existing = storage.providerKeys.getAll().find((k) => k.provider === CLOUD_PROVIDER_ID);

  if (!llmKey) {
    // Logged out or no key — clean up if exists
    if (existing) {
      const wasDefault = existing.isDefault;
      storage.providerKeys.delete(existing.id);
      await secretStore.delete(`provider-key-${existing.id}`);

      if (wasDefault) {
        const remaining = storage.providerKeys.getAll();
        if (remaining.length > 0) {
          storage.providerKeys.setDefault(remaining[0].id);
          storage.settings.set("llm-provider", remaining[0].provider);
          await syncActiveKey(remaining[0].provider, storage, secretStore);
        } else {
          storage.settings.set("llm-provider", "");
        }
      }
      await syncActiveKey(CLOUD_PROVIDER_ID, storage, secretStore);
      log.info("Removed cloud provider key (user logged out or key absent)");
    }
    return;
  }

  // User has llmKey — upsert
  if (existing) {
    // Update the secret (handles key rotation)
    await secretStore.set(`provider-key-${existing.id}`, llmKey);
    if (existing.isDefault) {
      await syncActiveKey(CLOUD_PROVIDER_ID, storage, secretStore);
    }
    log.info("Updated cloud provider key secret");
    return;
  }

  // Create new entry
  const baseUrl = `${getApiBaseUrl("en")}/llm/v1`;
  const shouldActivate = !storage.providerKeys.getActive();

  // Fetch available models
  let modelIds: string[] = [];
  try {
    const res = await fetch(baseUrl + "/models", {
      headers: { Authorization: `Bearer ${llmKey}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      modelIds = data.data?.map((m) => m.id) ?? [];
    }
  } catch {
    // Model fetch failed — create entry with empty models
  }

  const entry = storage.providerKeys.create({
    id: `cloud-${CLOUD_PROVIDER_ID}`,
    provider: CLOUD_PROVIDER_ID,
    label: CLOUD_KEY_LABEL,
    model: modelIds[0] ?? "",
    isDefault: shouldActivate,
    authType: "custom",
    baseUrl,
    customProtocol: "openai",
    customModelsJson: modelIds.length > 0 ? JSON.stringify(modelIds) : null,
    inputModalities: undefined,
    createdAt: "",
    updatedAt: "",
  });

  await secretStore.set(`provider-key-${entry.id}`, llmKey);

  if (shouldActivate) {
    storage.settings.set("llm-provider", CLOUD_PROVIDER_ID);
  }
  await syncActiveKey(CLOUD_PROVIDER_ID, storage, secretStore);
  log.info(`Created cloud provider key (activated: ${shouldActivate})`);
}
