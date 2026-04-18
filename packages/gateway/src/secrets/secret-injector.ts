import type { SecretStore } from "@rivonclaw/secrets";
import type { Storage } from "@rivonclaw/storage";
import { createLogger } from "@rivonclaw/logger";

const log = createLogger("gateway:secret-injector");

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
    const value = await store.get(secretKey);
    if (value !== null) {
      env[envVar] = value;
      log.debug("Injecting secret: " + secretKey + " -> " + envVar);
    }
  }

  log.info("Resolved " + Object.keys(env).length + " secret(s) for gateway env");
  return env;
}

/**
 * File permissions object for environment injection.
 */
export interface FilePermissions {
  workspacePath: string;
  fullAccess: boolean;
  readPaths: string[];
  writePaths: string[];
}

/**
 * Build file permissions environment variable for the gateway.
 *
 * Reads permissions from storage and constructs the RIVONCLAW_FILE_PERMISSIONS
 * environment variable as a JSON string containing workspace path and access rules.
 *
 * @param storage - Storage instance to read permissions from
 * @param workspacePath - Path to the workspace directory (default cwd)
 * @returns JSON string to inject as RIVONCLAW_FILE_PERMISSIONS, or null if no storage
 */
export function buildFilePermissionsEnv(
  storage: Storage | null,
  workspacePath?: string,
): string | null {
  if (!storage) {
    return null;
  }

  const permissions = storage.permissions.get();
  const fullAccess = storage.settings.get("file-permissions-full-access") === "true";
  const filePermissions: FilePermissions = {
    workspacePath: workspacePath ?? process.cwd(),
    fullAccess,
    readPaths: permissions.readPaths,
    writePaths: permissions.writePaths,
  };

  const json = JSON.stringify(filePermissions);
  log.debug(`File permissions env built: ${json.length} chars, ${permissions.readPaths.length} read paths, ${permissions.writePaths.length} write paths`);
  return json;
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
 * @param storage - Optional storage instance for file permissions
 * @param workspacePath - Optional workspace path (defaults to process.cwd())
 */
export async function buildGatewayEnv(
  store: SecretStore,
  extraEnv?: Record<string, string>,
  storage?: Storage | null,
  workspacePath?: string,
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

  // File permissions injection
  if (storage) {
    const filePermissionsJson = buildFilePermissionsEnv(storage, workspacePath);
    if (filePermissionsJson) {
      merged.RIVONCLAW_FILE_PERMISSIONS = filePermissionsJson;
    }
  }

  return merged;
}
