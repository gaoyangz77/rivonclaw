import {
  readAuthProfileRuntimeState,
  readExistingConfig,
  type AuthProfileRuntimeState,
} from "@rivonclaw/gateway";
import { resolveGatewayProvider, type LLMProvider, type ProviderKeyEntry } from "@rivonclaw/core";
import { mutateDesktopOpenClawConfig } from "../gateway/openclaw-config-mutation.js";
import { buildCustomProviderOverridesFromKeys } from "../gateway/config-builder.js";

export interface VendorDefaultModel {
  provider: string;
  modelId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readVendorDefaultModel(configPath: string): VendorDefaultModel | null {
  const config = readExistingConfig(configPath);
  const agents = isRecord(config.agents) ? config.agents : undefined;
  const defaults = agents && isRecord(agents.defaults) ? agents.defaults : undefined;
  const model = defaults && isRecord(defaults.model) ? defaults.model : undefined;
  const primary = typeof model?.primary === "string" ? model.primary.trim() : "";
  const separator = primary.indexOf("/");
  if (separator <= 0 || separator === primary.length - 1) return null;
  return {
    provider: primary.slice(0, separator),
    modelId: primary.slice(separator + 1),
  };
}

function runtimeProviderForKey(key: ProviderKeyEntry): string {
  return key.authType === "custom"
    ? key.provider
    : resolveGatewayProvider(key.provider as LLMProvider);
}

function firstRuntimeProfile(
  state: AuthProfileRuntimeState,
  runtimeProvider: string,
): AuthProfileRuntimeState["profiles"][number] | undefined {
  const orderedIds = state.order[runtimeProvider] ?? [];
  for (const id of orderedIds) {
    const profile = state.profiles.find((candidate) => candidate.id === id);
    if (profile?.provider === runtimeProvider) return profile;
  }
  return state.profiles.find((profile) => profile.provider === runtimeProvider);
}

function selectActiveMetadataEntry(
  entries: ProviderKeyEntry[],
  defaultModel: VendorDefaultModel,
  authState: AuthProfileRuntimeState,
): ProviderKeyEntry | undefined {
  const candidates = entries.filter(
    (entry) => runtimeProviderForKey(entry) === defaultModel.provider,
  );
  if (candidates.length <= 1) return candidates[0];

  const selectedProfile = firstRuntimeProfile(authState, defaultModel.provider);
  if (selectedProfile) {
    if (defaultModel.provider === "openai") {
      const productProvider = selectedProfile.type === "oauth" ? "openai-codex" : "openai";
      const exact = candidates.find((entry) => entry.provider === productProvider);
      if (exact) return exact;
    }

    const authMatch = candidates.find((entry) =>
      selectedProfile.type === "oauth" ? entry.authType === "oauth" : entry.authType !== "oauth",
    );
    if (authMatch) return authMatch;
  }

  // Legacy metadata may still carry the last projected default. It is only a
  // deterministic tie-breaker; the selected model and auth order above remain
  // the runtime authority.
  return candidates.find((entry) => entry.isDefault) ?? candidates[0];
}

/**
 * Join RivonClaw-only provider metadata with the OpenClaw runtime authority.
 *
 * SQLite values for `isDefault` and the active row's `model` are ignored.
 * They remain readable only as a migration fallback for non-active metadata
 * until the legacy columns can be physically removed.
 */
export function projectProviderMetadataFromVendor(params: {
  entries: ProviderKeyEntry[];
  configPath: string;
  stateDir: string;
}): ProviderKeyEntry[] {
  const defaultModel = readVendorDefaultModel(params.configPath);
  const config = readExistingConfig(params.configPath);
  const models = isRecord(config.models) ? config.models : undefined;
  const providers = models && isRecord(models.providers) ? models.providers : {};
  const authState = readAuthProfileRuntimeState(params.stateDir);
  const active = defaultModel
    ? selectActiveMetadataEntry(params.entries, defaultModel, authState)
    : undefined;
  return params.entries.map((entry) => ({
    ...projectProviderDefinition(entry, providers[runtimeProviderForKey(entry)]),
    isDefault: entry.id === active?.id,
    model: entry.id === active?.id && defaultModel ? defaultModel.modelId : entry.model,
  }));
}

function projectProviderDefinition(entry: ProviderKeyEntry, value: unknown): ProviderKeyEntry {
  if (entry.authType !== "custom" && entry.authType !== "local" && entry.source !== "cloud") {
    return entry;
  }
  if (!isRecord(value)) return entry;

  const rawModels = Array.isArray(value.models) ? value.models.filter(isRecord) : [];
  const api = typeof value.api === "string" ? value.api : "";
  const customProtocol =
    api === "anthropic-messages"
      ? "anthropic"
      : api.startsWith("openai-")
        ? "openai"
        : entry.customProtocol;
  const activeModel = rawModels.find((model) => model.id === entry.model) ?? rawModels[0];
  return {
    ...entry,
    baseUrl: typeof value.baseUrl === "string" ? value.baseUrl : entry.baseUrl,
    customProtocol,
    customModelsJson: rawModels.length > 0 ? JSON.stringify(rawModels) : entry.customModelsJson,
    inputModalities:
      activeModel && Array.isArray(activeModel.input)
        ? activeModel.input.filter((item): item is string => typeof item === "string")
        : entry.inputModalities,
  };
}

function ensureRecord(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = parent[key];
  if (isRecord(value)) return value;
  const next: Record<string, unknown> = {};
  parent[key] = next;
  return next;
}

function buildLocalProviderDefinition(entry: ProviderKeyEntry): Record<string, unknown> | null {
  if (!entry.baseUrl || !entry.model) return null;
  const baseUrl = /\/v\d\/?$/.test(entry.baseUrl)
    ? entry.baseUrl
    : `${entry.baseUrl.replace(/\/+$/, "")}/v1`;
  return {
    baseUrl,
    api: "openai-completions",
    models: [
      {
        id: entry.model,
        name: entry.model,
        reasoning: false,
        input: entry.inputModalities ?? ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128_000,
        maxTokens: 8_192,
      },
    ],
  };
}

/**
 * Persist a user/TK-owned provider definition directly in Vendor config.
 *
 * SQLite retains only the metadata/Keychain join row. Startup config rebuilds
 * preserve this definition and never recreate it from the legacy columns.
 */
export function writeVendorProviderDefinition(params: {
  configPath: string;
  entry: ProviderKeyEntry;
  remove?: boolean;
}): void {
  const isCustom = params.entry.authType === "custom";
  const isLocal = params.entry.authType === "local";
  if (!isCustom && !isLocal) return;

  mutateDesktopOpenClawConfig(
    params.configPath,
    params.remove ? "remove provider definition" : "upsert provider definition",
    (config) => {
      const models = ensureRecord(config, "models");
      const providers = ensureRecord(models, "providers");
      if (params.remove) {
        delete providers[params.entry.provider];
        return;
      }

      const customDefinition = isCustom
        ? buildCustomProviderOverridesFromKeys([params.entry])[params.entry.provider]
        : undefined;
      const definition = customDefinition ?? buildLocalProviderDefinition(params.entry);
      if (definition) providers[params.entry.provider] = definition;
      models.mode ??= "merge";
    },
    { strict: true },
  );
}
