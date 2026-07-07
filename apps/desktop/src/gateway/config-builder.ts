import { join } from "node:path";
import type { LLMProvider } from "@rivonclaw/core";
import { resolveModelConfig, LOCAL_PROVIDER_IDS, getProviderMeta, getOllamaOpenAiBaseUrl } from "@rivonclaw/core";
import { resolveUserSkillsDir } from "@rivonclaw/core/node";
import { buildExtraProviderConfigs, writeGatewayConfig } from "@rivonclaw/gateway";
import type { Storage } from "@rivonclaw/storage";
import type { SecretStore } from "@rivonclaw/secrets";
import { buildOwnerAllowFrom } from "../auth/owner-sync.js";
import { OUR_PLUGIN_IDS } from "../generated/our-plugin-ids.js";

export interface GatewayConfigDeps {
  storage: Storage;
  secretStore: SecretStore;
  locale: string;
  configPath: string;
  stateDir: string;
  extensionsDir: string;
  sttCliPath: string;
  /** Absolute path to the vendored OpenClaw directory (e.g. vendor/openclaw). */
  vendorDir?: string;
  /** Returns plugin entries for channels with at least one account (from ChannelManager). */
  channelPluginEntries: () => Record<string, { enabled: boolean }>;
  /** Returns channel account configs for gateway config write-back (from ChannelManager). */
  channelConfigAccounts: () => Array<{ channelId: string; accountId: string; config: Record<string, unknown> }>;
  /** Returns merchant extension paths after any runtime staging. */
  merchantExtensionPaths?: () => string[];
}

export const DEFAULT_GATEWAY_TOOL_ALLOWLIST = [
  "rivonclaw-cloud-tools",
  "rivonclaw-local-tools",
];

type GatewayInputModality = "text" | "image";
const RIVONCLAW_CLOUD_PROVIDER_ID = "rivonclaw-pro";
const TEXT_AND_IMAGE_INPUT: GatewayInputModality[] = ["text", "image"];
const GEMINI_OAUTH_GATEWAY_PROVIDER_ID = "google-gemini-cli";
type RawCustomModel =
  | string
  | {
      id?: string;
      input?: unknown;
      input_modalities?: unknown;
      inputModalities?: unknown;
    };
type ProviderKeyLike = {
  provider: string;
  authType?: string;
  baseUrl?: string | null;
  customProtocol?: string | null;
  customModelsJson?: string | null;
  inputModalities?: string[] | null;
};

export function normalizeGeminiOAuthModelId(modelId: string): string {
  let normalized = modelId.trim();
  for (;;) {
    const next = normalized
      .replace(/^google-gemini-cli\//, "")
      .replace(/^google\//, "");
    if (next === normalized) return normalized;
    normalized = next;
  }
}

function normalizeInputModalities(
  value: unknown,
  fallback: GatewayInputModality[] = ["text"],
): GatewayInputModality[] {
  if (!Array.isArray(value)) return fallback;
  const result: GatewayInputModality[] = [];
  for (const raw of value) {
    if (raw === "text" || raw === "image") {
      result.push(raw);
    }
  }
  return result.length > 0 ? Array.from(new Set(result)) : fallback;
}

function rawModelInputModalities(
  model: Exclude<RawCustomModel, string>,
  fallback: GatewayInputModality[],
): GatewayInputModality[] {
  return normalizeInputModalities(
    model.input_modalities ?? model.inputModalities ?? model.input,
    fallback,
  );
}

export function buildCustomProviderOverridesFromKeys(
  allKeys: ProviderKeyLike[],
): Record<string, { baseUrl: string; api: string; models: Array<{ id: string; name: string; input?: GatewayInputModality[] }> }> {
  const overrides: Record<string, { baseUrl: string; api: string; models: Array<{ id: string; name: string; input?: GatewayInputModality[] }> }> = {};
  const customKeys = allKeys.filter((k) => k.authType === "custom");

  for (const key of customKeys) {
    if (!key.baseUrl || !key.customModelsJson || !key.customProtocol) continue;
    let rawModels: RawCustomModel[];
    try { rawModels = JSON.parse(key.customModelsJson) as RawCustomModel[]; } catch { continue; }
    if (!Array.isArray(rawModels)) continue;
    const api = key.customProtocol === "anthropic" ? "anthropic-messages" : "openai-completions";
    const forceImageInput = key.provider === RIVONCLAW_CLOUD_PROVIDER_ID;
    const keyLevelInput = forceImageInput
      ? TEXT_AND_IMAGE_INPUT
      : normalizeInputModalities(key.inputModalities, ["text"]);
    overrides[key.provider] = {
      baseUrl: key.baseUrl,
      api,
      models: rawModels.flatMap((m) => {
        if (typeof m === "string") return [{ id: m, name: m, input: keyLevelInput }];
        const id = typeof m.id === "string" ? m.id.trim() : "";
        if (!id) return [];
        return [{
          id,
          name: id,
          input: forceImageInput ? keyLevelInput : rawModelInputModalities(m, keyLevelInput),
        }];
      }),
    };
  }
  return overrides;
}

/**
 * Create gateway config builder functions bound to the given dependencies.
 * Returns closures that can be called without passing deps each time.
 */
export function createGatewayConfigBuilder(deps: GatewayConfigDeps) {
  const { storage, secretStore, locale, configPath, stateDir, extensionsDir, sttCliPath } = deps;

  function isGeminiOAuthActive(): boolean {
    return storage.providerKeys.getAll()
      .some((k) => k.provider === "gemini" && k.authType === "oauth" && k.isDefault);
  }

  function resolveGeminiOAuthModel(provider: string, modelId: string): { provider: string; modelId: string } {
    if (!isGeminiOAuthActive() || provider !== "gemini") {
      return { provider, modelId };
    }
    return { provider: GEMINI_OAUTH_GATEWAY_PROVIDER_ID, modelId: normalizeGeminiOAuthModelId(modelId) };
  }

  /** Only include extra providers that the user has configured (has a provider key in DB).
   *  Unconfigured providers have no API key, causing Pi SDK's validateConfig to reject
   *  the entire models.json — which silently drops ALL custom models from the catalog. */
  function filterConfiguredExtraProviders<T>(providers: Record<string, T>): Record<string, T> {
    const configuredProviders = new Set(storage.providerKeys.getAll().map((k) => k.provider));
    const filtered: Record<string, T> = {};
    for (const [provider, config] of Object.entries(providers)) {
      if (configuredProviders.has(provider)) {
        filtered[provider] = config;
      }
    }
    return filtered;
  }

  function buildLocalProviderOverrides(): Record<string, { baseUrl: string; models: Array<{ id: string; name: string; inputModalities?: string[] }> }> {
    const overrides: Record<string, { baseUrl: string; models: Array<{ id: string; name: string; inputModalities?: string[] }> }> = {};
    for (const localProvider of LOCAL_PROVIDER_IDS) {
      const activeKey = storage.providerKeys.getByProvider(localProvider)[0];
      if (!activeKey) continue;
      const meta = getProviderMeta(localProvider);
      let baseUrl = activeKey.baseUrl || meta?.baseUrl || getOllamaOpenAiBaseUrl();
      if (!baseUrl.match(/\/v\d\/?$/)) {
        baseUrl = baseUrl.replace(/\/+$/, "") + "/v1";
      }
      const modelId = activeKey.model;
      if (modelId) {
        overrides[localProvider] = {
          baseUrl,
          models: [{ id: modelId, name: modelId, inputModalities: activeKey.inputModalities ?? undefined }],
        };
      }
    }
    return overrides;
  }

  function buildCustomProviderOverrides(): Record<string, { baseUrl: string; api: string; models: Array<{ id: string; name: string; input?: Array<"text" | "image"> }> }> {
    return buildCustomProviderOverridesFromKeys(storage.providerKeys.getAll());
  }

  const WS_ENV_MAP: Record<string, string> = {
    brave: "RIVONCLAW_WS_BRAVE_APIKEY",
    perplexity: "RIVONCLAW_WS_PERPLEXITY_APIKEY",
    grok: "RIVONCLAW_WS_GROK_APIKEY",
    gemini: "RIVONCLAW_WS_GEMINI_APIKEY",
    kimi: "RIVONCLAW_WS_KIMI_APIKEY",
  };
  const EMB_ENV_MAP: Record<string, string> = {
    openai: "RIVONCLAW_EMB_OPENAI_APIKEY",
    gemini: "RIVONCLAW_EMB_GEMINI_APIKEY",
    voyage: "RIVONCLAW_EMB_VOYAGE_APIKEY",
    mistral: "RIVONCLAW_EMB_MISTRAL_APIKEY",
  };

  async function buildFullGatewayConfig(
    gatewayPort: number,
    overrides?: { toolAllowlist?: string[]; toolAlsoAllowlist?: string[] },
  ): Promise<Parameters<typeof writeGatewayConfig>[0]> {
    const activeKey = storage.providerKeys.getActive();
    const curRegion = storage.settings.get("region") ?? (locale === "zh" ? "cn" : "us");
    const curModel = activeKey
      ? resolveModelConfig({
        region: curRegion,
        userProvider: activeKey.provider as LLMProvider,
        userModelId: activeKey.model,
      })
      : null;

    const curSttEnabled = storage.settings.get("stt.enabled") === "true";
    const curSttProvider = (storage.settings.get("stt.provider") || "groq") as "groq" | "volcengine";

    const curWebSearchEnabled = storage.settings.get("webSearch.enabled") === "true";
    const curWebSearchProvider = (storage.settings.get("webSearch.provider") || "brave") as "brave" | "perplexity" | "grok" | "gemini" | "kimi";

    const curEmbeddingEnabled = storage.settings.get("embedding.enabled") === "true";
    const curEmbeddingProvider = (storage.settings.get("embedding.provider") || "openai") as "openai" | "gemini" | "voyage" | "mistral" | "ollama";

    const curBrowserMode = (storage.settings.get("browser-mode") || "standalone") as "standalone" | "cdp";
    const curBrowserCdpPort = parseInt(storage.settings.get("browser-cdp-port") || "9222", 10);

    // Build the full set of extra providers (all built-in non-OpenClaw providers).
    // filterConfiguredExtraProviders narrows to those with API keys;
    // managedProviderKeys tells config-writer which stale entries to clean from old configs.
    const allExtraProviders = buildExtraProviderConfigs();

    // Only reference apiKey env var if key exists in keychain
    const wsKeyExists = curWebSearchEnabled
      ? !!(await secretStore.get(`websearch-${curWebSearchProvider}-apikey`))
      : false;
    const embKeyExists = curEmbeddingEnabled && curEmbeddingProvider !== "ollama"
      ? !!(await secretStore.get(`embedding-${curEmbeddingProvider}-apikey`))
      : false;

    return {
      configPath,
      gatewayPort,
      enableChatCompletions: true,
      commandsRestart: true,
      ownerAllowFrom: buildOwnerAllowFrom(storage),
      extensionsDir,
      merchantExtensionPaths: deps.merchantExtensionPaths?.(),
      plugins: {
        allow: [
          ...OUR_PLUGIN_IDS,
          // Vendor-bundled plugins that are not in extensions/ but need to be allowed
          "memory-core",
          // Groq audio transcription provider — moved from core to bundled plugin
          // in vendor v2026.3.28 (commit 3dcc802fe5). Without allow, the gateway's
          // plugin loader blocks it ("not in allowlist") and STT stops working.
          "groq",
        ],
        entries: {
          // Groq audio transcription — must be explicitly enabled because bundled
          // plugins without enabledByDefault in their manifest are disabled.
          // Vendor moved groq from core to plugin in v2026.3.28 (3dcc802fe5).
          ...(curSttEnabled && curSttProvider === "groq" ? { groq: { enabled: true } } : {}),
          "rivonclaw-event-bridge": {
            enabled: true,
            hooks: { allowConversationAccess: true },
          },
          "rivonclaw-capability-manager": {
            enabled: true,
            hooks: { allowConversationAccess: true },
          },
          "rivonclaw-search-browser-fallback": {
            enabled: true,
            hooks: { allowConversationAccess: true },
          },
          "rivonclaw-cloud-tools": {
            enabled: true,
          },
          "rivonclaw-local-tools": {
            enabled: true,
          },
          "rivonclaw-cs": {
            enabled: true,
            hooks: { allowConversationAccess: true },
          },
          "rivonclaw-ecom": {
            enabled: true,
            hooks: { allowConversationAccess: true },
          },
          // Channel plugin entries from ChannelManager -- each channel with at
          // least one account gets enabled so the vendor's two-phase plugin
          // loader includes it. ChannelManager is the single owner.
          ...deps.channelPluginEntries(),
        },
      },
      // Channel accounts from ChannelManager for config write-back.
      // ChannelManager owns the SQLite source of truth and handles migration.
      channelAccounts: deps.channelConfigAccounts(),
      // Disable mDNS/Bonjour discovery — desktop app manages its own device
      // pairing. Bonjour's mDNS probing blocks the event loop for 14-16s on
      // Windows (name conflict resolution + re-advertise watchdog), delaying
      // RPC handshake and chat.history responses.
      discovery: { mdns: { mode: "off" as const } },
      skipBootstrap: false,
      defaultModel: curModel ? resolveGeminiOAuthModel(curModel.provider, curModel.modelId) : null,
      stt: {
        enabled: curSttEnabled,
        provider: curSttProvider,
        nodeBin: process.execPath,
        sttCliPath,
      },
      webSearch: {
        enabled: curWebSearchEnabled,
        provider: curWebSearchProvider,
        apiKeyEnvVar: wsKeyExists ? WS_ENV_MAP[curWebSearchProvider] : undefined,
      },
      embedding: {
        enabled: curEmbeddingEnabled,
        provider: curEmbeddingProvider,
        apiKeyEnvVar: embKeyExists ? EMB_ENV_MAP[curEmbeddingProvider] : undefined,
      },
      extraProviders: { ...filterConfiguredExtraProviders(allExtraProviders), ...buildCustomProviderOverrides() },
      managedProviderKeys: Object.keys(allExtraProviders),
      localProviderOverrides: buildLocalProviderOverrides(),
      browserMode: curBrowserMode,
      browserCdpPort: curBrowserCdpPort,
      agentWorkspace: join(stateDir, "workspace"),
      extraSkillDirs: [resolveUserSkillsDir()],
      // Keep the default OpenClaw profile unrestricted, and use alsoAllow only
      // as an optional plugin discovery hint. `tools.allow` is a hard runtime
      // allowlist; using plugin ids there can filter out dynamically staged
      // client tools before the session-scoped effective tool patch is applied.
      ...(overrides?.toolAllowlist
        ? { toolAllowlist: overrides.toolAllowlist }
        : {
            toolAlsoAllowlist: overrides?.toolAlsoAllowlist ?? DEFAULT_GATEWAY_TOOL_ALLOWLIST,
          }),
    };
  }

  return { isGeminiOAuthActive, resolveGeminiOAuthModel, buildLocalProviderOverrides, buildFullGatewayConfig };
}
