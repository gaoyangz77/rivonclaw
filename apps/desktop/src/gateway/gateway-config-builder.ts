import { existsSync } from "node:fs";
import { join } from "node:path";
import type { LLMProvider } from "@rivonclaw/core";
import { resolveModelConfig, LOCAL_PROVIDER_IDS, getProviderMeta, getOllamaOpenAiBaseUrl } from "@rivonclaw/core";
import { resolveUserSkillsDir } from "@rivonclaw/core/node";
import { buildExtraProviderConfigs, writeGatewayConfig, readExistingConfig } from "@rivonclaw/gateway";
import type { Storage } from "@rivonclaw/storage";
import type { SecretStore } from "@rivonclaw/secrets";
import { buildOwnerAllowFrom } from "../auth/owner-sync.js";
import { OUR_PLUGIN_IDS } from "../generated/our-plugin-ids.js";

/**
 * Build plugin entries for channels that have at least one account in SQLite.
 * This makes SQLite the source of truth for which channel plugins should be
 * enabled, instead of relying on config file state that can be overwritten.
 */
function buildChannelPluginEntries(storage: Storage): Record<string, { enabled: boolean }> {
  const accounts = storage.channelAccounts.list();
  const channelIds = new Set(accounts.map(a => a.channelId));
  const entries: Record<string, { enabled: boolean }> = {};
  for (const channelId of channelIds) {
    entries[channelId] = { enabled: true };
  }
  return entries;
}

/**
 * Bidirectional sync between SQLite and config for channel accounts.
 *
 * SQLite is the source of truth. This function ensures:
 *  1. Accounts in config but not SQLite → imported into SQLite (first-run upgrade)
 *  2. Accounts in SQLite missing fields that config has → enriched (secret backfill
 *     from older versions that stored secrets only in config/keychain)
 *
 * Returns the merged account list for writeGatewayConfig to write back to config.
 */
function syncChannelAccounts(
  storage: Storage,
  configPath: string,
): Array<{ channelId: string; accountId: string; config: Record<string, unknown> }> {
  let existingConfig: Record<string, unknown>;
  try {
    existingConfig = readExistingConfig(configPath);
  } catch {
    // No config file — just return SQLite contents
    return storage.channelAccounts.list().map(a => ({
      channelId: a.channelId, accountId: a.accountId, config: a.config,
    }));
  }

  const channels = existingConfig.channels;
  const sqliteAccounts = storage.channelAccounts.list();
  const sqliteMap = new Map(sqliteAccounts.map(a => [`${a.channelId}:${a.accountId}`, a]));

  // Channels managed outside of channel_accounts (e.g. mobile uses mobile_pairings).
  // These should not be synced to/from SQLite channel_accounts.
  const EXCLUDED_CHANNELS = new Set(["mobile"]);

  if (channels && typeof channels === "object") {
    for (const [channelId, channelData] of Object.entries(channels as Record<string, unknown>)) {
      if (EXCLUDED_CHANNELS.has(channelId)) continue;
      if (!channelData || typeof channelData !== "object") continue;
      const accounts = (channelData as Record<string, unknown>).accounts;
      if (!accounts || typeof accounts !== "object") continue;

      for (const [accountId, accountData] of Object.entries(accounts as Record<string, unknown>)) {
        const configObj = typeof accountData === "object" && accountData !== null
          ? (accountData as Record<string, unknown>)
          : {};
        const key = `${channelId}:${accountId}`;
        const sqliteRecord = sqliteMap.get(key);

        if (!sqliteRecord) {
          // Config has account that SQLite doesn't → import
          storage.channelAccounts.upsert(
            channelId, accountId,
            typeof configObj.name === "string" ? configObj.name : null,
            configObj,
          );
          sqliteMap.set(key, { channelId, accountId, name: null, config: configObj, createdAt: 0, updatedAt: 0 });
        } else {
          // Both have it — merge any fields config has that SQLite lacks
          let needsUpdate = false;
          const merged = { ...sqliteRecord.config };
          for (const [k, v] of Object.entries(configObj)) {
            if (v !== undefined && v !== null && !(k in merged)) {
              merged[k] = v;
              needsUpdate = true;
            }
          }
          if (needsUpdate) {
            storage.channelAccounts.upsert(channelId, accountId, sqliteRecord.name, merged);
            sqliteMap.set(key, { ...sqliteRecord, config: merged });
          }
        }
      }
    }
  }

  // Return all SQLite accounts (now enriched) for config write-back
  return [...sqliteMap.values()].map(a => ({
    channelId: a.channelId, accountId: a.accountId, config: a.config,
  }));
}

export interface GatewayConfigDeps {
  storage: Storage;
  secretStore: SecretStore;
  locale: string;
  configPath: string;
  stateDir: string;
  extensionsDir: string;
  sttCliPath: string;
  filePermissionsPluginPath?: string;
  /** Absolute path to the vendored OpenClaw directory (e.g. vendor/openclaw).
   *  Used to resolve the Control UI assets path for gateway.controlUi.root. */
  vendorDir?: string;
}

/**
 * Create gateway config builder functions bound to the given dependencies.
 * Returns closures that can be called without passing deps each time.
 */
export function createGatewayConfigBuilder(deps: GatewayConfigDeps) {
  const { storage, secretStore, locale, configPath, stateDir, extensionsDir, sttCliPath, filePermissionsPluginPath, vendorDir } = deps;

  function isGeminiOAuthActive(): boolean {
    return storage.providerKeys.getAll()
      .some((k) => k.provider === "gemini" && k.authType === "oauth" && k.isDefault);
  }

  function resolveGeminiOAuthModel(provider: string, modelId: string): { provider: string; modelId: string } {
    if (!isGeminiOAuthActive() || provider !== "gemini") {
      return { provider, modelId };
    }
    return { provider: "google-gemini-cli", modelId };
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
    const overrides: Record<string, { baseUrl: string; api: string; models: Array<{ id: string; name: string; input?: Array<"text" | "image"> }> }> = {};
    const allKeys = storage.providerKeys.getAll();
    const customKeys = allKeys.filter((k) => k.authType === "custom");

    for (const key of customKeys) {
      if (!key.baseUrl || !key.customModelsJson || !key.customProtocol) continue;
      let models: string[];
      try { models = JSON.parse(key.customModelsJson); } catch { continue; }
      const api = key.customProtocol === "anthropic" ? "anthropic-messages" : "openai-completions";
      const input = (key.inputModalities ?? ["text"]) as Array<"text" | "image">;
      overrides[key.provider] = {
        baseUrl: key.baseUrl,
        api,
        models: models.map((m) => ({ id: m, name: m, input })),
      };
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

  /** Build plugin config for rivonclaw-policy from compiled artifacts in storage. */
  function buildPolicyPluginConfig(): { compiledPolicy: string; guards: Array<{ id: string; ruleId: string; content: string }> } {
    const allArtifacts = storage.artifacts.getAll();
    const policyFragments = allArtifacts
      .filter((a) => a.type === "policy-fragment" && a.status === "ok")
      .map((a) => a.content);
    const guards = allArtifacts
      .filter((a) => a.type === "guard" && a.status === "ok")
      .map((a) => ({ id: a.id, ruleId: a.ruleId, content: a.content }));
    return { compiledPolicy: policyFragments.join("\n"), guards };
  }

  async function buildFullGatewayConfig(gatewayPort: number, overrides?: { toolAllowlist?: string[] }): Promise<Parameters<typeof writeGatewayConfig>[0]> {
    const activeKey = storage.providerKeys.getActive();
    const curProvider = activeKey?.provider as LLMProvider | undefined;
    const curRegion = storage.settings.get("region") ?? (locale === "zh" ? "cn" : "us");
    const curModelId = activeKey?.model;
    const curModel = resolveModelConfig({
      region: curRegion,
      userProvider: curProvider,
      userModelId: curModelId,
    });

    const curSttEnabled = storage.settings.get("stt.enabled") === "true";
    const curSttProvider = (storage.settings.get("stt.provider") || "groq") as "groq" | "volcengine";

    const curWebSearchEnabled = storage.settings.get("webSearch.enabled") === "true";
    const curWebSearchProvider = (storage.settings.get("webSearch.provider") || "brave") as "brave" | "perplexity" | "grok" | "gemini" | "kimi";

    const curEmbeddingEnabled = storage.settings.get("embedding.enabled") === "true";
    const curEmbeddingProvider = (storage.settings.get("embedding.provider") || "openai") as "openai" | "gemini" | "voyage" | "mistral" | "ollama";

    const curBrowserMode = (storage.settings.get("browser-mode") || "standalone") as "standalone" | "cdp";
    const curBrowserCdpPort = parseInt(storage.settings.get("browser-cdp-port") || "9222", 10);

    // Only reference apiKey env var if key exists in keychain
    const wsKeyExists = curWebSearchEnabled
      ? !!(await secretStore.get(`websearch-${curWebSearchProvider}-apikey`))
      : false;
    const embKeyExists = curEmbeddingEnabled && curEmbeddingProvider !== "ollama"
      ? !!(await secretStore.get(`embedding-${curEmbeddingProvider}-apikey`))
      : false;

    // Resolve Control UI assets from vendor dist. When the index.html exists,
    // pass the directory as controlUiRoot so the gateway skips its expensive
    // auto-resolution + potential auto-build check during startup.
    let controlUiRoot: string | undefined;
    if (vendorDir) {
      const controlUiDir = join(vendorDir, "dist", "control-ui");
      if (existsSync(join(controlUiDir, "index.html"))) {
        controlUiRoot = controlUiDir;
      }
    }

    return {
      configPath,
      gatewayPort,
      enableChatCompletions: true,
      commandsRestart: true,
      enableFilePermissions: true,
      ownerAllowFrom: buildOwnerAllowFrom(storage),
      controlUiRoot,
      extensionsDir,
      plugins: {
        allow: [
          ...OUR_PLUGIN_IDS,
          // Vendor-bundled plugins that are not in extensions/ but need to be allowed
          "memory-core",
        ],
        entries: {
          "rivonclaw-tools": {
            config: {
              browserMode: curBrowserMode,
            },
          },
          "rivonclaw-policy": {
            config: buildPolicyPluginConfig(),
          },
          // Derive channel plugin entries from SQLite — each channel with at
          // least one account gets enabled so the vendor's two-phase plugin
          // loader includes it. SQLite is the source of truth for channel setup.
          ...buildChannelPluginEntries(storage),
        },
      },
      // Bidirectional sync: config ↔ SQLite. Imports missing accounts from
      // config into SQLite (upgrade), enriches SQLite with secrets from config
      // (older versions), and returns the merged list for config write-back.
      channelAccounts: syncChannelAccounts(storage, configPath),
      skipBootstrap: false,
      filePermissionsPluginPath,
      defaultModel: resolveGeminiOAuthModel(curModel.provider, curModel.modelId),
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
      extraProviders: { ...buildExtraProviderConfigs(), ...buildCustomProviderOverrides() },
      localProviderOverrides: buildLocalProviderOverrides(),
      browserMode: curBrowserMode,
      browserCdpPort: curBrowserCdpPort,
      agentWorkspace: join(stateDir, "workspace"),
      extraSkillDirs: [resolveUserSkillsDir()],
      // ADR-031: allow all plugin tools by default (visibility controlled at runtime by capability-manager).
      // "group:plugins" is an OpenClaw allowlist keyword that permits all optional plugin tools.
      toolAllowlist: overrides?.toolAllowlist ?? ["group:plugins"],
    };
  }

  return { isGeminiOAuthActive, resolveGeminiOAuthModel, buildLocalProviderOverrides, buildFullGatewayConfig };
}
