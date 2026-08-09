import { join } from "node:path";
import {
  LOCAL_PROVIDER_IDS,
  getProviderMeta,
  getOllamaOpenAiBaseUrl,
  TEMPORARY_OPENAI_CODEX_MODELS,
} from "@rivonclaw/core";
import {
  AFFILIATE_AGENT_ID,
  AFFILIATE_WORKFLOW_SKILL_SLUG,
  CUSTOMER_SERVICE_AGENT_ID,
  DEFAULT_AGENT_ID,
  resolveAffiliateAgentWorkspaceDir,
  resolveUserSkillsDir,
} from "@rivonclaw/core/node";
import {
  readAuthProfileRuntimeState,
  writeGatewayConfig,
  type AuthProfileRuntimeState,
} from "@rivonclaw/gateway";
import { createLogger } from "@rivonclaw/logger";
import type { Storage } from "@rivonclaw/storage";
import { SecretStoreAccessError, type SecretStore } from "@rivonclaw/secrets";
import { buildOwnerAllowFrom } from "../auth/owner-sync.js";
import { OUR_PLUGIN_IDS } from "../generated/our-plugin-ids.js";

const log = createLogger("gateway:config-builder");

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
  channelConfigAccounts: () => Array<{
    channelId: string;
    accountId: string;
    config: Record<string, unknown>;
  }>;
  /** Returns merchant extension paths after any runtime staging. */
  merchantExtensionPaths?: () => string[];
  /**
   * Temporary loopback compatibility boundary for GPT-5.6 Codex requests.
   * Omit after the pinned OpenClaw runtime natively supports those models.
   */
  openAICodexCompatibilityBaseUrl?: string;
}

export const DEFAULT_GATEWAY_TOOL_ALLOWLIST = ["rivonclaw-cloud-tools"];

type GatewayInputModality = "text" | "image";
const RIVONCLAW_CLOUD_PROVIDER_ID = "rivonclaw-pro";
export const RIVONCLAW_CLOUD_PROVIDER_TIMEOUT_SECONDS = 300;
export const IMAGE_GENERATION_MODEL_REF = `${RIVONCLAW_CLOUD_PROVIDER_ID}/gpt-image-2`;
export const OPENAI_IMAGE_GENERATION_MODEL_REF = "openai/gpt-image-2";
export const IMAGE_GENERATION_TIMEOUT_MS = 300_000;
const OPENAI_PROVIDER_ID = "openai";
const OPENAI_API_BASE_URL = "https://api.openai.com/v1";
const OPENAI_API = "openai-responses";
const OPENAI_CODEX_RESPONSES_BASE_URL = "https://chatgpt.com/backend-api/codex";
const OPENAI_CODEX_RESPONSES_API = "openai-chatgpt-responses";
const TEXT_AND_IMAGE_INPUT: GatewayInputModality[] = ["text", "image"];
type RawCustomModel =
  | string
  | {
      id?: string;
      input?: unknown;
      input_modalities?: unknown;
      inputModalities?: unknown;
      context_length?: unknown;
      contextWindow?: unknown;
      context_tokens?: unknown;
      contextTokens?: unknown;
      max_completion_tokens?: unknown;
      maxTokens?: unknown;
      display_name?: unknown;
      name?: unknown;
    };
type ProviderKeyLike = {
  provider: string;
  authType?: string;
  baseUrl?: string | null;
  customProtocol?: string | null;
  customModelsJson?: string | null;
  inputModalities?: string[] | null;
};

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

function positiveInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : undefined;
}

type CustomProviderModel = {
  id: string;
  name: string;
  input?: GatewayInputModality[];
  contextWindow?: number;
  contextTokens?: number;
  maxTokens?: number;
};

type ManagedGatewayAgents = NonNullable<Parameters<typeof writeGatewayConfig>[0]["managedAgents"]>;
type ExtraProviderConfig = NonNullable<
  Parameters<typeof writeGatewayConfig>[0]["extraProviders"]
>[string];

const TEMPORARY_OPENAI_CODEX_PROVIDER_MODELS: ExtraProviderConfig["models"] =
  TEMPORARY_OPENAI_CODEX_MODELS.map((model) => ({
    id: model.modelId,
    name: model.displayName,
    reasoning: true,
    input: model.supportsVision ? TEXT_AND_IMAGE_INPUT : ["text"],
    ...(model.cost ? { cost: model.cost } : {}),
    ...(model.contextWindow ? { contextWindow: model.contextWindow } : {}),
    ...(model.contextTokens ? { contextTokens: model.contextTokens } : {}),
    ...(model.maxTokens ? { maxTokens: model.maxTokens } : {}),
  }));

/**
 * TEMPORARY: remove after the pinned OpenClaw OpenAI manifest contains all
 * four GPT-5.6 IDs.
 *
 * OpenClaw resolves transport at provider scope, so the provider endpoint and
 * API protocol must follow the active Vendor-owned OpenAI auth profile. Model
 * availability remains independent from the selected credential so historical
 * and session-scoped GPT-5.6 references remain resolvable.
 */
export function buildTemporaryOpenAICodexProviderOverride(
  codexBaseUrl = OPENAI_CODEX_RESPONSES_BASE_URL,
  codexOAuthActive = false,
): Record<string, ExtraProviderConfig> {
  const baseUrl = codexOAuthActive ? codexBaseUrl : OPENAI_API_BASE_URL;
  const api = codexOAuthActive ? OPENAI_CODEX_RESPONSES_API : OPENAI_API;
  return {
    openai: {
      baseUrl,
      api,
      models: TEMPORARY_OPENAI_CODEX_PROVIDER_MODELS.map((model) => ({
        ...model,
        api,
      })),
    },
  };
}

/**
 * Resolve the active OpenAI credential exclusively from Vendor runtime state.
 * The first ordered profile is authoritative; the profile list is a fallback
 * for stores created before Vendor persisted explicit order.
 */
export function isOpenAICodexOAuthActive(state: AuthProfileRuntimeState): boolean {
  const profilesById = new Map(state.profiles.map((profile) => [profile.id, profile]));
  const orderedProfile = (state.order[OPENAI_PROVIDER_ID] ?? [])
    .map((id) => profilesById.get(id))
    .find((profile) => profile?.provider === OPENAI_PROVIDER_ID);
  const activeProfile =
    orderedProfile ?? state.profiles.find((profile) => profile.provider === OPENAI_PROVIDER_ID);
  return activeProfile?.type === "oauth";
}

export function buildManagedGatewayAgents(stateDir: string): ManagedGatewayAgents {
  return [
    { id: DEFAULT_AGENT_ID, default: true },
    {
      id: CUSTOMER_SERVICE_AGENT_ID,
      workspace: join(stateDir, "workspace-customer-service"),
      contextTokens: null,
      thinkingDefault: "low",
      reasoningDefault: "off",
    },
    {
      id: AFFILIATE_AGENT_ID,
      workspace: resolveAffiliateAgentWorkspaceDir({
        ...process.env,
        OPENCLAW_STATE_DIR: stateDir,
      }),
      skills: [AFFILIATE_WORKFLOW_SKILL_SLUG],
      contextTokens: null,
      thinkingDefault: "low",
      reasoningDefault: "off",
      tools: {
        deny: ["write", "edit", "exec", "bash", "process", "apply_patch"],
        fs: { workspaceOnly: true },
      },
    },
  ];
}

const CLOUD_MODEL_RUNTIME_LIMITS = new Map<
  string,
  { contextWindow: number; contextTokens: number; maxTokens: number }
>([
  // Compatibility for cloud catalogs persisted before the three public model
  // names were unified as rivonclaw-flagship.
  [
    "gpt-5.6-terra",
    { contextWindow: 372_000, contextTokens: 244_000, maxTokens: 128_000 },
  ] as const,
  ["gpt-5.6-luna", { contextWindow: 372_000, contextTokens: 244_000, maxTokens: 128_000 }] as const,
  ["gpt-5.6-sol", { contextWindow: 372_000, contextTokens: 244_000, maxTokens: 128_000 }] as const,
  [
    "rivonclaw-flagship",
    { contextWindow: 372_000, contextTokens: 244_000, maxTokens: 128_000 },
  ] as const,
]);

export function buildCustomProviderOverridesFromKeys(
  allKeys: ProviderKeyLike[],
): Record<
  string,
  { baseUrl: string; api: string; timeoutSeconds?: number; models: CustomProviderModel[] }
> {
  const overrides: Record<
    string,
    { baseUrl: string; api: string; timeoutSeconds?: number; models: CustomProviderModel[] }
  > = {};
  const customKeys = allKeys.filter((k) => k.authType === "custom");

  for (const key of customKeys) {
    if (!key.baseUrl || !key.customModelsJson || !key.customProtocol) continue;
    let rawModels: RawCustomModel[];
    try {
      rawModels = JSON.parse(key.customModelsJson) as RawCustomModel[];
    } catch {
      continue;
    }
    if (!Array.isArray(rawModels)) continue;
    const api = key.customProtocol === "anthropic" ? "anthropic-messages" : "openai-completions";
    const forceImageInput = key.provider === RIVONCLAW_CLOUD_PROVIDER_ID;
    const keyLevelInput = forceImageInput
      ? TEXT_AND_IMAGE_INPUT
      : normalizeInputModalities(key.inputModalities, ["text"]);
    overrides[key.provider] = {
      baseUrl: key.baseUrl,
      api,
      ...(forceImageInput ? { timeoutSeconds: RIVONCLAW_CLOUD_PROVIDER_TIMEOUT_SECONDS } : {}),
      models: rawModels.flatMap((m) => {
        if (typeof m === "string") {
          const runtimeLimits = forceImageInput ? CLOUD_MODEL_RUNTIME_LIMITS.get(m) : undefined;
          return [{ id: m, name: m, input: keyLevelInput, ...runtimeLimits }];
        }
        const id = typeof m.id === "string" ? m.id.trim() : "";
        if (!id) return [];
        const displayName =
          typeof m.display_name === "string"
            ? m.display_name.trim()
            : typeof m.name === "string"
              ? m.name.trim()
              : id;
        const contextWindow = positiveInt(m.contextWindow) ?? positiveInt(m.context_length);
        const cloudRuntimeLimits = forceImageInput ? CLOUD_MODEL_RUNTIME_LIMITS.get(id) : undefined;
        const contextTokens =
          positiveInt(m.contextTokens) ??
          positiveInt(m.context_tokens) ??
          cloudRuntimeLimits?.contextTokens;
        const maxTokens = positiveInt(m.maxTokens) ?? positiveInt(m.max_completion_tokens);
        return [
          {
            id,
            name: displayName || id,
            input: forceImageInput ? keyLevelInput : rawModelInputModalities(m, keyLevelInput),
            ...(contextWindow || cloudRuntimeLimits?.contextWindow
              ? { contextWindow: contextWindow ?? cloudRuntimeLimits?.contextWindow }
              : {}),
            ...(contextTokens ? { contextTokens } : {}),
            ...(maxTokens || cloudRuntimeLimits?.maxTokens
              ? { maxTokens: maxTokens ?? cloudRuntimeLimits?.maxTokens }
              : {}),
          },
        ];
      }),
    };

    // TK Copilot owns its image route under its own provider namespace.
    // Protocol compatibility with OpenAI must never make us overwrite the
    // vendor-owned `models.providers.openai` definition.
    if (
      key.provider === RIVONCLAW_CLOUD_PROVIDER_ID &&
      !overrides[key.provider].models.some((model) => model.id === "gpt-image-2")
    ) {
      overrides[key.provider].models.push({
        id: "gpt-image-2",
        name: "GPT Image 2",
        input: TEXT_AND_IMAGE_INPUT,
      });
    }
  }
  return overrides;
}

/**
 * Create gateway config builder functions bound to the given dependencies.
 * Returns closures that can be called without passing deps each time.
 */
export function createGatewayConfigBuilder(deps: GatewayConfigDeps) {
  const { storage, secretStore, configPath, stateDir, extensionsDir, sttCliPath } = deps;

  async function hasSecret(key: string): Promise<boolean> {
    try {
      return !!(await secretStore.get(key));
    } catch (error) {
      if (!(error instanceof SecretStoreAccessError)) throw error;
      log.warn(`Secure storage is unavailable while checking ${key}; disabling dependent feature`);
      return false;
    }
  }

  function buildLocalProviderOverrides(): Record<
    string,
    { baseUrl: string; models: Array<{ id: string; name: string; inputModalities?: string[] }> }
  > {
    const overrides: Record<
      string,
      { baseUrl: string; models: Array<{ id: string; name: string; inputModalities?: string[] }> }
    > = {};
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
          models: [
            { id: modelId, name: modelId, inputModalities: activeKey.inputModalities ?? undefined },
          ],
        };
      }
    }
    return overrides;
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
    const curSttEnabled = storage.settings.get("stt.enabled") === "true";
    const curSttProvider = (storage.settings.get("stt.provider") || "groq") as
      | "groq"
      | "volcengine";

    const curWebSearchEnabled = storage.settings.get("webSearch.enabled") === "true";
    const curWebSearchProvider = (storage.settings.get("webSearch.provider") || "brave") as
      | "brave"
      | "perplexity"
      | "grok"
      | "gemini"
      | "kimi";

    const curEmbeddingEnabled = storage.settings.get("embedding.enabled") === "true";
    const curEmbeddingProvider = (storage.settings.get("embedding.provider") || "openai") as
      | "openai"
      | "gemini"
      | "voyage"
      | "mistral"
      | "ollama";

    const curBrowserMode = (storage.settings.get("browser-mode") || "standalone") as
      | "standalone"
      | "cdp";
    const curBrowserCdpPort = parseInt(storage.settings.get("browser-cdp-port") || "9222", 10);

    // Legacy releases wrote large, manually maintained third-party catalogs.
    // Keep their keys only for one-way cleanup; vendor OpenClaw now owns those
    // provider definitions and model lists. EasyClaw writes only its cloud
    // provider, explicit custom providers, and narrow compatibility overlays.
    // Only reference apiKey env var if key exists in keychain
    const wsKeyExists = curWebSearchEnabled
      ? await hasSecret(`websearch-${curWebSearchProvider}-apikey`)
      : false;
    const embKeyExists =
      curEmbeddingEnabled && curEmbeddingProvider !== "ollama"
        ? await hasSecret(`embedding-${curEmbeddingProvider}-apikey`)
        : false;

    const effectiveWebSearchEnabled = curWebSearchEnabled && wsKeyExists;
    const effectiveEmbeddingEnabled =
      curEmbeddingEnabled && (curEmbeddingProvider === "ollama" || embKeyExists);

    // Runtime provider definitions are persistent Vendor config, not a
    // projection of whichever SQLite metadata row happens to be active.
    // EasyClaw owns only its cloud provider and the narrow, versioned OpenAI
    // compatibility overlay. Vendor-owned and user-configured providers are
    // preserved by writeGatewayConfig's merge semantics.
    const customProviderOverrides = buildCustomProviderOverridesFromKeys(
      storage.providerKeys.getAll().filter((key) => key.provider === RIVONCLAW_CLOUD_PROVIDER_ID),
    );
    const openAIAuthState = readAuthProfileRuntimeState(stateDir);
    const temporaryOpenAICodexOverride = buildTemporaryOpenAICodexProviderOverride(
      deps.openAICodexCompatibilityBaseUrl,
      isOpenAICodexOAuthActive(openAIAuthState),
    );

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
            hooks: { allowConversationAccess: true },
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
      // OpenClaw config is authoritative for selections. Omitting these fields
      // preserves the vendor state across startup/full config regeneration.
      defaultModel: undefined,
      imageGenerationModel: undefined,
      stt: {
        enabled: curSttEnabled,
        provider: curSttProvider,
        nodeBin: process.execPath,
        sttCliPath,
      },
      webSearch: {
        enabled: effectiveWebSearchEnabled,
        provider: curWebSearchProvider,
        apiKeyEnvVar: wsKeyExists ? WS_ENV_MAP[curWebSearchProvider] : undefined,
      },
      embedding: {
        enabled: effectiveEmbeddingEnabled,
        provider: curEmbeddingProvider,
        apiKeyEnvVar: embKeyExists ? EMB_ENV_MAP[curEmbeddingProvider] : undefined,
      },
      extraProviders: {
        ...customProviderOverrides,
        ...temporaryOpenAICodexOverride,
      },
      overlayProviderKeys: [OPENAI_PROVIDER_ID],
      browserMode: curBrowserMode,
      browserCdpPort: curBrowserCdpPort,
      agentWorkspace: join(stateDir, "workspace"),
      managedAgents: buildManagedGatewayAgents(stateDir),
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

  return {
    buildLocalProviderOverrides,
    buildFullGatewayConfig,
  };
}
