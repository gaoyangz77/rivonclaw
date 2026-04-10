import { fetchJson } from "./client.js";
import { API, clientPath } from "@rivonclaw/core/api-contract";

// --- STT Credentials ---

export interface SttCredentialStatus {
  groq: boolean;
  volcengine: boolean;
}

export async function fetchSttCredentials(): Promise<SttCredentialStatus> {
  return fetchJson<SttCredentialStatus>(clientPath(API["stt.credentials.get"]));
}

export async function saveSttCredentials(body: Record<string, string>): Promise<void> {
  await fetchJson(clientPath(API["stt.credentials.set"]), {
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
  return fetchJson<ExtrasCredentialStatus>(clientPath(API["extras.credentials.get"]));
}

export async function saveExtrasCredentials(body: {
  type: string;
  provider: string;
  apiKey: string;
}): Promise<void> {
  await fetchJson(clientPath(API["extras.credentials.set"]), {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
