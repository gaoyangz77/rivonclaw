import { fetchJson } from "./client.js";

// --- STT Credentials ---

export interface SttCredentialStatus {
  groq: boolean;
  volcengine: boolean;
}

export async function fetchSttCredentials(): Promise<SttCredentialStatus> {
  return fetchJson<SttCredentialStatus>("/stt/credentials");
}

export async function saveSttCredentials(body: Record<string, string>): Promise<void> {
  await fetchJson("/stt/credentials", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// --- Extras Credentials (Web Search, Embedding) ---

export interface ExtrasCredentialStatus {
  webSearch: Record<string, boolean>;
  embedding: Record<string, boolean>;
}

export async function fetchExtrasCredentials(): Promise<ExtrasCredentialStatus> {
  return fetchJson<ExtrasCredentialStatus>("/extras/credentials");
}

export async function saveExtrasCredentials(body: {
  type: string;
  provider: string;
  apiKey: string;
}): Promise<void> {
  await fetchJson("/extras/credentials", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
