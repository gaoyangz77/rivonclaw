import { fetchJson, cachedFetch } from "./client.js";

// --- Local Models ---

export interface LocalModelServer {
  type: "ollama" | "lmstudio" | "vllm" | "custom";
  baseUrl: string;
  version?: string;
  status: "detected" | "offline";
}

export async function detectLocalModels(): Promise<LocalModelServer[]> {
  const data = await fetchJson<{ servers: LocalModelServer[] }>("/local-models/detect");
  return data.servers;
}

export async function fetchLocalModels(baseUrl: string): Promise<Array<{ id: string; name: string }>> {
  const data = await fetchJson<{ models: Array<{ id: string; name: string }> }>(
    "/local-models/models?baseUrl=" + encodeURIComponent(baseUrl),
  );
  return data.models;
}

export async function checkLocalModelHealth(baseUrl: string): Promise<{ ok: boolean; version?: string; error?: string }> {
  return fetchJson<{ ok: boolean; version?: string; error?: string }>(
    "/local-models/health",
    { method: "POST", body: JSON.stringify({ baseUrl }) },
  );
}

// --- Custom Provider: Fetch Models ---

export async function fetchCustomProviderModels(
  baseUrl: string,
  apiKey: string,
  protocol: string,
  proxyUrl?: string,
): Promise<string[]> {
  const data = await fetchJson<{ models: string[] }>("/custom-provider/fetch-models", {
    method: "POST",
    body: JSON.stringify({ baseUrl, apiKey, protocol, proxyUrl }),
  });
  return data.models;
}

// --- Model Catalog ---

export interface CatalogModelEntry {
  id: string;
  name: string;
}

/**
 * Fetch the dynamic model catalog from the gateway's models.json.
 * Returns a map of provider → model list.
 * Empty object if models.json doesn't exist yet (gateway not started).
 */
export async function fetchModelCatalog(): Promise<Record<string, CatalogModelEntry[]>> {
  return cachedFetch("models", async () => {
    const data = await fetchJson<{ models: Record<string, CatalogModelEntry[]> }>("/models");
    return data.models;
  }, 30000);
}
