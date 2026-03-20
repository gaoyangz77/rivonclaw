import { getApiBaseUrl } from "@rivonclaw/core";
import {
  fetchProviderKeys,
  createProviderKey,
  updateProviderKey,
  deleteProviderKey,
} from "../api/providers.js";

const PROVIDER_ID = "rivonclaw-pro";
const LABEL = "RivonClaw Pro";

/**
 * Manages the lifecycle of the auto-provisioned "RivonClaw Pro" LLM provider.
 *
 * - provision(): called on login / app open when user has an llmKey
 * - teardown():  called on logout to remove the provider key from local storage
 */
class CloudLlmProvider {
  private provisioned = false;

  private get baseUrl(): string {
    return `${getApiBaseUrl("en")}/llm/v1`;
  }

  /** Create or update the RivonClaw Pro provider key. Best-effort, never throws. */
  async provision(llmKey: string): Promise<void> {
    if (this.provisioned) return;
    this.provisioned = true;

    try {
      const keys = await fetchProviderKeys();
      const existing = keys.find((k) => k.provider === PROVIDER_ID);

      if (existing) {
        await updateProviderKey(existing.id, { apiKey: llmKey });
        return;
      }

      const modelIds = await this.fetchModels(llmKey);

      await createProviderKey({
        provider: PROVIDER_ID,
        label: LABEL,
        model: modelIds[0] ?? "",
        apiKey: llmKey,
        authType: "custom",
        baseUrl: this.baseUrl,
        customProtocol: "openai",
        customModelsJson: JSON.stringify(modelIds),
      });
    } catch (err) {
      console.warn("[CloudLlmProvider] provision failed:", err);
    }
  }

  /** Remove the RivonClaw Pro provider key from local storage. Best-effort, never throws. */
  async teardown(): Promise<void> {
    this.provisioned = false;

    try {
      const keys = await fetchProviderKeys();
      const existing = keys.find((k) => k.provider === PROVIDER_ID);
      if (existing) {
        await deleteProviderKey(existing.id);
      }
    } catch (err) {
      console.warn("[CloudLlmProvider] teardown failed:", err);
    }
  }

  /** Fetch available model IDs from the OpenAI-compatible models endpoint. */
  private async fetchModels(llmKey: string): Promise<string[]> {
    try {
      const res = await fetch(this.baseUrl + "/models", {
        headers: { Authorization: `Bearer ${llmKey}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ id: string }> };
        return data.data?.map((m) => m.id) ?? [];
      }
    } catch {
      // Model fetch failed — caller creates entry with empty models
    }
    return [];
  }
}

export const cloudLlmProvider = new CloudLlmProvider();
