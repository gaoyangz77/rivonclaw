export type ProviderKeyAuthType = "api_key" | "oauth" | "local" | "custom";

export interface ProviderKeyEntry {
  id: string;
  provider: string;
  label: string;
  model: string;
  isDefault: boolean;
  proxyBaseUrl?: string | null;
  authType?: ProviderKeyAuthType;
  /** Per-key endpoint URL. Used by local providers (e.g. Ollama) where the
   *  base URL is user-configurable rather than fixed per provider. */
  baseUrl?: string | null;
  /** Protocol for custom providers: "openai" or "anthropic". NULL for built-in providers. */
  customProtocol?: string | null;
  /** JSON-encoded array of model IDs for custom providers. NULL for built-in providers. */
  customModelsJson?: string | null;
  /** Supported input modalities for the model (e.g. ["text"] or ["text", "image"]).
   *  NULL/undefined defaults to ["text"]. Primarily used by local providers. */
  inputModalities?: string[] | null;
  /** Origin of this key: "local" for user-managed, "cloud" for Pro subscription keys. */
  source?: "local" | "cloud";
  /** OAuth credential expiry (ms since epoch) where the provider exposes it.
   *  For OpenAI Codex this is the refresh token's JWT `exp` claim. Undefined
   *  for opaque providers (e.g. Gemini) or non-OAuth keys. Null when the row
   *  was created before this column existed. */
  oauthExpiresAt?: number | null;
  createdAt: string;
  updatedAt: string;
}
