import { buildExtraProviderConfigs, readExistingConfig } from "@rivonclaw/gateway";
import { mutateDesktopOpenClawConfig } from "./openclaw-config-mutation.js";

const LEGACY_PROVIDER_KEYS = Object.keys(buildExtraProviderConfigs());

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isLegacyTkOpenAIProjection(value: unknown): boolean {
  if (!isRecord(value) || typeof value.baseUrl !== "string") return false;
  try {
    const url = new URL(value.baseUrl);
    return url.hostname === "api.rivonclaw.com" && url.pathname.startsWith("/llm/");
  } catch {
    return false;
  }
}

/**
 * One-time cleanup paired with storage migration 33.
 *
 * Older Desktop builds generated third-party provider definitions from
 * product SQLite and reused `openai` for TK image generation. Delete those
 * legacy definitions once; future startup writes preserve Vendor/user
 * providers and only overlay the temporary OpenAI models per model ID.
 */
export function migrateLegacyDesktopProviderDefinitions(configPath: string): boolean {
  const config = readExistingConfig(configPath);
  const models =
    typeof config.models === "object" && config.models !== null
      ? (config.models as Record<string, unknown>)
      : undefined;
  const providers =
    models && typeof models.providers === "object" && models.providers !== null
      ? (models.providers as Record<string, unknown>)
      : undefined;
  if (!providers) return false;

  const keysToDelete = LEGACY_PROVIDER_KEYS.filter((key) =>
    Object.prototype.hasOwnProperty.call(providers, key),
  );
  // `openai` is also a legitimate Vendor/user provider namespace. Remove it
  // only when its endpoint proves it is the obsolete TK image-auth projection;
  // never infer ownership from the provider key alone.
  if (isLegacyTkOpenAIProjection(providers.openai)) {
    keysToDelete.push("openai");
  }
  if (keysToDelete.length === 0) return false;

  mutateDesktopOpenClawConfig(configPath, "legacy provider ownership migration", (candidate) => {
    const candidateModels = candidate.models as Record<string, unknown> | undefined;
    const candidateProviders = candidateModels?.providers as Record<string, unknown> | undefined;
    if (!candidateProviders) return;
    for (const key of keysToDelete) delete candidateProviders[key];
  });
  return true;
}
