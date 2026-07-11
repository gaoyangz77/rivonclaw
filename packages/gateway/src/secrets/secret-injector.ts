import { SecretStoreAccessError, type SecretStore } from "@rivonclaw/secrets";
import { createQuietLogger, DEBUG_FLAGS } from "@rivonclaw/logger";

const log = createQuietLogger("gateway:secret-injector", DEBUG_FLAGS.SECRETS);

/**
 * Static mapping for non-LLM secrets (channel tokens, STT keys, etc.).
 */
const STATIC_SECRET_ENV_MAP: Record<string, string> = {
  "stt-api-key": "STT_API_KEY", // Legacy
  "stt-groq-apikey": "GROQ_API_KEY",
  "stt-volcengine-appkey": "VOLCENGINE_APP_KEY",
  "stt-volcengine-accesskey": "VOLCENGINE_ACCESS_KEY",
  // Web search — unique env vars to avoid conflict with LLM provider keys
  "websearch-brave-apikey": "RIVONCLAW_WS_BRAVE_APIKEY",
  "websearch-perplexity-apikey": "RIVONCLAW_WS_PERPLEXITY_APIKEY",
  "websearch-grok-apikey": "RIVONCLAW_WS_GROK_APIKEY",
  "websearch-gemini-apikey": "RIVONCLAW_WS_GEMINI_APIKEY",
  "websearch-kimi-apikey": "RIVONCLAW_WS_KIMI_APIKEY",
  // Embedding — unique env vars to avoid conflict with LLM provider keys
  "embedding-openai-apikey": "RIVONCLAW_EMB_OPENAI_APIKEY",
  "embedding-gemini-apikey": "RIVONCLAW_EMB_GEMINI_APIKEY",
  "embedding-voyage-apikey": "RIVONCLAW_EMB_VOYAGE_APIKEY",
  "embedding-mistral-apikey": "RIVONCLAW_EMB_MISTRAL_APIKEY",
};

/**
 * Resolve all known secrets into an env-var record suitable for passing
 * to the gateway child process.
 *
 * For LLM providers, each provider has its own secret key
 * (e.g. "openai-api-key" -> OPENAI_API_KEY, "anthropic-api-key" -> ANTHROPIC_API_KEY).
 * All configured provider keys are injected simultaneously so the gateway
 * can use any of them.
 *
 * Secrets that are not set (null) are silently skipped -- the gateway
 * will function with whatever subset of keys is available.
 *
 * Secret values are NEVER logged.
 */
export async function resolveSecretEnv(
  store: SecretStore,
): Promise<Record<string, string>> {
  const env: Record<string, string> = {};

  // LLM provider API keys are NO LONGER injected as environment variables.
  // All LLM authentication goes through auth-profiles.json (managed by
  // syncAllAuthProfiles in LLMProviderManager). This ensures a single
  // authentication path and avoids env vars masking auth-profile issues.

  // Inject non-LLM secrets only (STT, web search, embedding)
  for (const [secretKey, envVar] of Object.entries(STATIC_SECRET_ENV_MAP)) {
    let value: string | null;
    try {
      value = await store.get(secretKey);
    } catch (error) {
      if (!(error instanceof SecretStoreAccessError)) throw error;
      log.warn("Secure storage is unavailable; starting gateway without optional secret env");
      break;
    }
    if (value !== null) {
      env[envVar] = value;
      log.debug("Injecting secret: " + secretKey + " -> " + envVar);
    }
  }

  log.info("Resolved " + Object.keys(env).length + " secret(s) for gateway env");
  return env;
}

/**
 * Build the complete environment for the gateway process.
 *
 * Merges the current process.env, any user-provided env overrides, and
 * resolved secrets. Secrets take highest precedence so they cannot be
 * accidentally overridden by config files.
 *
 * @param store - Secret store for API keys and credentials
 * @param extraEnv - Additional environment variables to merge
 */
export async function buildGatewayEnv(
  store: SecretStore,
  extraEnv?: Record<string, string>,
): Promise<Record<string, string>> {
  const secretEnv = await resolveSecretEnv(store);

  const merged: Record<string, string> = {};

  // Base environment (process.env minus undefined values)
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) {
      merged[k] = v;
    }
  }

  // User-provided overrides
  if (extraEnv) {
    Object.assign(merged, extraEnv);
  }

  // Secrets take highest priority
  Object.assign(merged, secretEnv);

  return merged;
}
