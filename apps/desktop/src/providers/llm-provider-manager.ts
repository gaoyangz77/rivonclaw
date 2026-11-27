import { types, flow, getRoot } from "mobx-state-tree";
import { resolveGatewayModelParts, getApiBaseUrl } from "@rivonclaw/core";
import type { GQL, ProviderKeyEntry } from "@rivonclaw/core";
import type { Storage } from "@rivonclaw/storage";
import type { SecretStore } from "@rivonclaw/secrets";
import type { GatewayRpcClient } from "@rivonclaw/gateway";
import { createLogger } from "@rivonclaw/logger";
import type { MstProviderKeySnapshot } from "./provider-key-utils.js";

const log = createLogger("llm-provider-manager");

// ---------------------------------------------------------------------------
// Environment interface — late-initialized infrastructure dependencies.
// ---------------------------------------------------------------------------

export interface LLMProviderManagerEnv {
  storage: Storage;
  secretStore: SecretStore;
  getRpcClient: () => GatewayRpcClient | null;
  toMstSnapshot: (
    entry: ProviderKeyEntry,
    secretStore: SecretStore,
  ) => Promise<MstProviderKeySnapshot>;
  allKeysToMstSnapshots: (
    entries: ProviderKeyEntry[],
    secretStore: SecretStore,
  ) => Promise<MstProviderKeySnapshot[]>;
  syncActiveKey: (provider: string, storage: Storage, secretStore: SecretStore) => Promise<void>;
  syncAllAuthProfiles: (
    stateDir: string,
    storage: Storage,
    secretStore: SecretStore,
  ) => Promise<void>;
  activateAuthProfile: (
    stateDir: string,
    productProvider: string,
    authType: string | undefined,
  ) => string;
  writeProxyRouterConfig: (
    storage: Storage,
    secretStore: SecretStore,
    lastSystemProxy: string | null,
  ) => Promise<void>;
  writeDefaultModelToConfig: (gwProvider: string, modelId: string, productProvider: string) => void;
  /** Rewrite the full gateway config (used when the cloud provider definition changes). */
  writeFullGatewayConfig: () => Promise<void>;
  /** Upsert/remove a Desktop-owned provider definition in authoritative Vendor config. */
  writeVendorProviderDefinition?: (
    entry: ProviderKeyEntry,
    remove?: boolean,
  ) => Promise<void> | void;
  /** Connector-owned full gateway restart (stop + start). */
  restartGateway: () => Promise<void>;
  /** Proxy-aware fetch (routes through proxy-router for users behind a proxy). */
  proxyFetch: (url: string | URL, init?: RequestInit) => Promise<Response>;
  /** Authenticated backend GraphQL fetch, used to provision user-scoped cloud API keys. */
  graphqlFetch?: <T = unknown>(query: string, variables?: Record<string, unknown>) => Promise<T>;
  stateDir: string;
  getLastSystemProxy: () => string | null;
}

const CLOUD_PROVIDER_ID = "rivonclaw-pro";
const CLOUD_KEY_LABEL = "TK Copilot AI";
const CLOUD_DEFAULT_MODEL_ID = "rivonclaw-flagship";
const NO_ACTIVE_LLM_PROVIDER_ERROR =
  "TK Copilot AI is not available. Sign in and make sure your subscription is active.";

/**
 * Settings flag recording that the one-time reset of per-session model
 * overrides (left behind by the retired model picker) has completed.
 */
const SESSION_MODEL_RESET_DONE_SETTING = "_internal.session-model-overrides-reset-done";

export interface CloudModel {
  id: string;
  name?: unknown;
  display_name?: unknown;
  input?: unknown;
  input_modalities?: unknown;
  inputModalities?: unknown;
  context_length?: unknown;
  contextWindow?: unknown;
  context_tokens?: unknown;
  contextTokens?: unknown;
  max_completion_tokens?: unknown;
  maxTokens?: unknown;
}

/** The provider/model pair a run is dispatched with. */
export interface DispatchModel {
  provider: string;
  model: string;
}

interface GatewaySessionListRow {
  key?: unknown;
  modelOverrideSource?: unknown;
}

interface GatewaySessionListPage {
  sessions?: GatewaySessionListRow[];
  hasMore?: boolean;
  nextOffset?: number | null;
}

/** Rows per `sessions.list` page; the gateway's own default is 100. */
const SESSION_LIST_PAGE_SIZE = 200;

function selectCloudDefaultModel(cloudModels: CloudModel[]): string {
  return (
    cloudModels.find((model) => model.id === CLOUD_DEFAULT_MODEL_ID)?.id ?? cloudModels[0]?.id ?? ""
  );
}

function parseStoredCloudModels(customModelsJson: string | null | undefined): CloudModel[] {
  if (!customModelsJson) return [];
  const parsed: unknown = JSON.parse(customModelsJson);
  return Array.isArray(parsed)
    ? parsed.flatMap((model) => (typeof model?.id === "string" ? [model as CloudModel] : []))
    : [];
}

interface ProvisionLlmApiKeyMutationResult {
  provisionLlmApiKey: GQL.LlmApiKey;
}

const PROVISION_LLM_API_KEY_MUTATION = `
  mutation ProvisionLlmApiKey {
    provisionLlmApiKey {
      id
      key
      keyPrefix
      status
      createdAt
      updatedAt
      lastUsedAt
    }
  }
`;

class CloudModelCatalogError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function isCloudLlmKeyUnavailableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /subscription|entitlement|payment required|requires active|not allowed|forbidden|inactive|no active/i.test(
    message,
  );
}

// ---------------------------------------------------------------------------
// Helper: resolve the gateway model reference (e.g., "rivonclaw-pro/rivonclaw-flagship")
// ---------------------------------------------------------------------------

function resolveModelRef(provider: string, model: string, authType?: string): string {
  const runtime = resolveGatewayModelParts({ provider, model, authType });
  if (!runtime) throw new Error(`Invalid provider model selection: ${provider}/${model}`);
  return `${runtime.provider}/${runtime.modelId}`;
}

function splitModelRef(modelRef: string): DispatchModel {
  const separator = modelRef.indexOf("/");
  if (separator <= 0 || separator === modelRef.length - 1) {
    throw new Error(`Invalid gateway model reference: ${modelRef}`);
  }
  return {
    provider: modelRef.slice(0, separator),
    model: modelRef.slice(separator + 1),
  };
}

// ---------------------------------------------------------------------------
// MST Model
// ---------------------------------------------------------------------------

/**
 * Owns the single LLM provider TK Copilot supports: the cloud provider, always
 * running on the backend's default model. There is no user-facing provider,
 * key or model selection.
 */
export const LLMProviderManagerModel = types
  .model("LLMProviderManager", {})
  .views((self) => ({
    get root(): any {
      return getRoot(self);
    },
  }))
  .actions((self) => {
    // ── Internal helpers ────────────────────────────────────────────────

    function getEnvDeps(): LLMProviderManagerEnv {
      // Access environment from root store
      return (self as any)._env;
    }

    function getActiveDefaultModel(): (DispatchModel & { modelRef: string }) | null {
      const { storage } = getEnvDeps();
      const active = storage.providerKeys.getActive();
      if (!active?.provider || !active.model) return null;
      const modelRef = resolveModelRef(active.provider, active.model, active.authType);
      return { ...splitModelRef(modelRef), modelRef };
    }

    /**
     * Write ONLY agents.defaults.model.primary to the config file.
     */
    function writeDefaultModel(provider: string, modelId: string, authType?: string): void {
      const { writeDefaultModelToConfig } = getEnvDeps();
      const runtime = resolveGatewayModelParts({ provider, model: modelId, authType });
      if (!runtime) throw new Error(`Invalid provider model selection: ${provider}/${modelId}`);
      writeDefaultModelToConfig(runtime.provider, runtime.modelId, provider);
      log.info(`Updated default model to ${runtime.provider}/${runtime.modelId}`);
    }

    async function applyDefaultModelRuntimeChange(reason: string): Promise<void> {
      const { restartGateway } = getEnvDeps();
      log.info(`Restarting gateway to apply default model change (${reason})`);
      await restartGateway();
      log.info(`Applied default model change (${reason})`);
    }

    /**
     * Sync auth profiles and proxy router config.
     */
    async function syncAuthAndProxy(): Promise<void> {
      const {
        syncAllAuthProfiles,
        writeProxyRouterConfig,
        stateDir,
        storage,
        secretStore,
        getLastSystemProxy,
      } = getEnvDeps();
      await Promise.all([
        syncAllAuthProfiles(stateDir, storage, secretStore),
        writeProxyRouterConfig(storage, secretStore, getLastSystemProxy()),
      ]);
    }

    function activateVendorAuth(entry: ProviderKeyEntry): void {
      const { activateAuthProfile, stateDir } = getEnvDeps();
      activateAuthProfile(stateDir, entry.provider, entry.authType);
    }

    async function persistVendorProviderDefinition(
      entry: ProviderKeyEntry,
      remove = false,
    ): Promise<void> {
      await getEnvDeps().writeVendorProviderDefinition?.(entry, remove);
    }

    /**
     * Sync auth + proxy + rewrite full gateway config.
     * Used when the cloud provider definition changes (added, endpoint or
     * model catalog refreshed) — not for simple model switches.
     */
    async function syncAuthProxyAndConfig(entry?: ProviderKeyEntry): Promise<void> {
      const { writeFullGatewayConfig, writeVendorProviderDefinition } = getEnvDeps();
      if (entry) {
        await writeVendorProviderDefinition?.(entry, false);
      }
      await syncAuthAndProxy();
      await writeFullGatewayConfig();
    }

    /**
     * Make the cloud provider the gateway default, on the given model. Returns
     * true when the default changed (callers decide whether a restart is due).
     */
    function pinCloudDefault(entry: ProviderKeyEntry, modelId: string): boolean {
      const { storage } = getEnvDeps();
      const active = storage.providerKeys.getActive();
      if (active?.id === entry.id && active.model === modelId) return false;
      activateVendorAuth(entry);
      writeDefaultModel(entry.provider, modelId, entry.authType);
      return true;
    }

    // ── Public actions ──────────────────────────────────────────────────

    return {
      /** Set the environment dependencies. Called once during startup. */
      setEnv(env: LLMProviderManagerEnv) {
        (self as any)._env = env;
      },

      /**
       * The provider/model every run is dispatched with: the gateway default,
       * which is always the cloud default model.
       */
      resolveModelForDispatch(): DispatchModel {
        const active = getActiveDefaultModel();
        if (!active) throw new Error(NO_ACTIVE_LLM_PROVIDER_ERROR);
        return { provider: active.provider, model: active.model };
      },

      /**
       * Startup reconciliation for installs created before model selection was
       * removed: provider keys other than the cloud provider (own API keys,
       * local models, custom endpoints, OAuth subscriptions) are no longer
       * supported, so they are removed together with their secrets, and the
       * cloud provider — when present — becomes the gateway default on its
       * default model.
       *
       * Runs before the gateway starts, so it only writes config; the gateway
       * reads it on launch.
       */
      reconcileCloudOnly: flow(function* () {
        const { storage, secretStore, syncActiveKey, allKeysToMstSnapshots } = getEnvDeps();

        const unsupported = storage.providerKeys
          .getAll()
          .filter((entry) => entry.provider !== CLOUD_PROVIDER_ID);
        for (const entry of unsupported) {
          yield persistVendorProviderDefinition(entry, true);
          storage.providerKeys.delete(entry.id);
          yield secretStore.delete(`provider-key-${entry.id}`);
          yield secretStore.delete(`proxy-auth-${entry.id}`);
          yield secretStore.delete(`oauth-cred-${entry.id}`);
        }
        for (const provider of new Set(unsupported.map((entry) => entry.provider))) {
          yield syncActiveKey(provider, storage, secretStore);
        }
        if (unsupported.length > 0) {
          yield syncAuthAndProxy();
          log.info(`Removed ${unsupported.length} unsupported provider key(s)`);
        }

        const cloud = storage.providerKeys
          .getAll()
          .find((entry) => entry.provider === CLOUD_PROVIDER_ID);
        if (cloud) {
          const modelId =
            selectCloudDefaultModel(parseStoredCloudModels(cloud.customModelsJson)) || cloud.model;
          if (modelId && pinCloudDefault(cloud, modelId)) {
            log.info("Pinned the cloud provider as the gateway default");
          }
        }

        const mstKeys: MstProviderKeySnapshot[] = yield allKeysToMstSnapshots(
          storage.providerKeys.getAll(),
          secretStore,
        );
        self.root.loadProviderKeys(mstKeys);
      }),

      /**
       * One-time reset of per-session model overrides that the retired model
       * picker left in the gateway session store, so existing conversations
       * follow the default model too. Marked done only after a full pass.
       */
      resetStaleSessionModelOverrides: flow(function* () {
        const { storage, getRpcClient } = getEnvDeps();
        if (storage.settings.get(SESSION_MODEL_RESET_DONE_SETTING) === "true") return;
        const rpc = getRpcClient();
        if (!rpc) throw new Error("RPC client not available");

        // Collect every key first, patch afterwards: patching bumps a session's
        // updatedAt, which would reorder the list under an offset cursor.
        // `archived: "all"` includes archived sessions; leaving out `agentId`
        // covers every agent (main, customer service, affiliate, utility).
        const overriddenKeys: string[] = [];
        let offset = 0;
        for (;;) {
          const page: GatewaySessionListPage = yield rpc.request("sessions.list", {
            archived: "all",
            limit: SESSION_LIST_PAGE_SIZE,
            offset,
          });
          const rows = page?.sessions ?? [];
          for (const row of rows) {
            if (row.modelOverrideSource === "user" && typeof row.key === "string") {
              overriddenKeys.push(row.key);
            }
          }
          if (!page?.hasMore) break;
          if (rows.length === 0) {
            throw new Error("sessions.list reported more sessions but returned an empty page");
          }
          offset = typeof page.nextOffset === "number" ? page.nextOffset : offset + rows.length;
        }
        for (const key of overriddenKeys) {
          yield rpc.request("sessions.patch", { key, model: null });
        }
        storage.settings.set(SESSION_MODEL_RESET_DONE_SETTING, "true");
        log.info(
          `Reset ${overriddenKeys.length} per-session model override(s) to the default model`,
        );
      }),

      /**
       * Sync cloud provider key from user auth state.
       *
       * Backend owns the RivonClaw LLM proxy key and the default model. Desktop
       * fetches the active original key on login so a new device can sync
       * without rotating it, and keeps the gateway on the backend's default
       * model.
       */
      syncCloud: flow(function* (user: GQL.MeResponse | null) {
        const { storage, secretStore, syncActiveKey, toMstSnapshot, allKeysToMstSnapshots } =
          getEnvDeps();
        const existing = storage.providerKeys
          .getAll()
          .find((k) => k.provider === CLOUD_PROVIDER_ID);

        function* removeExistingCloudProvider(reason: string) {
          if (!existing) return;
          yield persistVendorProviderDefinition(existing, true);
          storage.providerKeys.delete(existing.id);
          yield secretStore.delete(`provider-key-${existing.id}`);
          yield syncActiveKey(CLOUD_PROVIDER_ID, storage, secretStore);

          const mstKeys: MstProviderKeySnapshot[] = yield allKeysToMstSnapshots(
            storage.providerKeys.getAll(),
            secretStore,
          );
          self.root.loadProviderKeys(mstKeys);

          yield syncAuthProxyAndConfig();

          log.info(`Removed cloud provider key (${reason})`);
        }

        if (!user) {
          // Logged out — clean up the cloud provider key from this device.
          yield* removeExistingCloudProvider("user logged out");
          return;
        }

        async function provisionCloudApiKey(): Promise<string> {
          const { graphqlFetch } = getEnvDeps();
          if (!graphqlFetch) {
            throw new Error(
              "Authenticated GraphQL fetch is not available for cloud key provisioning",
            );
          }
          const data = await graphqlFetch<ProvisionLlmApiKeyMutationResult>(
            PROVISION_LLM_API_KEY_MUTATION,
          );
          const key = data.provisionLlmApiKey.key;
          if (!key) {
            throw new Error("Cloud LLM key provisioning returned an empty key");
          }
          return key;
        }

        async function fetchCloudModels(
          baseUrl: string,
          apiKeyValue: string,
        ): Promise<CloudModel[]> {
          const { proxyFetch } = getEnvDeps();
          const res = await proxyFetch(baseUrl + "/models", {
            headers: { Authorization: `Bearer ${apiKeyValue}` },
          });
          if (!res.ok) {
            throw new CloudModelCatalogError(
              `Cloud model catalog request failed (${res.status})`,
              res.status,
            );
          }
          const data = (await res.json()) as { data?: CloudModel[] };
          return data.data ?? [];
        }

        // User is logged in — upsert the local cloud provider entry.
        if (existing) {
          const currentBaseUrl = `${getApiBaseUrl("en")}/llm/v1`;
          const storedKey: string | null = yield secretStore.get(`provider-key-${existing.id}`);
          const previousCustomModelsJson = existing.customModelsJson ?? null;
          const previousInputModalities = JSON.stringify(existing.inputModalities ?? []);
          let currentKey: string;
          try {
            currentKey = yield provisionCloudApiKey();
          } catch (err) {
            if (!isCloudLlmKeyUnavailableError(err)) throw err;
            yield* removeExistingCloudProvider("cloud LLM entitlement unavailable");
            return;
          }
          let keyChanged = false;
          if (storedKey !== currentKey) {
            yield secretStore.set(`provider-key-${existing.id}`, currentKey);
            keyChanged = true;
            yield syncActiveKey(CLOUD_PROVIDER_ID, storage, secretStore);
          }
          const baseUrlChanged = existing.baseUrl !== currentBaseUrl;
          const labelChanged = existing.label !== CLOUD_KEY_LABEL;
          const providerChanges: Partial<ProviderKeyEntry> = {};
          if (baseUrlChanged) {
            providerChanges.baseUrl = currentBaseUrl;
            log.info(`Updated cloud provider baseUrl: ${existing.baseUrl} -> ${currentBaseUrl}`);
          }
          if (labelChanged) {
            providerChanges.label = CLOUD_KEY_LABEL;
          }

          // Always refresh model list (capabilities and the default model may
          // have changed on the backend). A failed refresh keeps the list and
          // the default model we already have; the next sync retries.
          let modelsChanged = false;
          let defaultModelId = existing.model;
          try {
            const effectiveBaseUrl = baseUrlChanged ? currentBaseUrl : existing.baseUrl!;
            let cloudModels: CloudModel[];
            try {
              cloudModels = yield fetchCloudModels(effectiveBaseUrl, currentKey);
            } catch (err) {
              if (
                !(err instanceof CloudModelCatalogError) ||
                (err.status !== 401 && err.status !== 403)
              ) {
                throw err;
              }
              const provisionedKey: string = yield provisionCloudApiKey();
              if (provisionedKey !== currentKey) {
                currentKey = provisionedKey;
                yield secretStore.set(`provider-key-${existing.id}`, currentKey);
                keyChanged = true;
                yield syncActiveKey(CLOUD_PROVIDER_ID, storage, secretStore);
              }
              cloudModels = yield fetchCloudModels(effectiveBaseUrl, currentKey);
              log.info("Rotated cloud provider key after authentication failure");
            }
            if (cloudModels.length > 0) {
              const nextCustomModelsJson = JSON.stringify(cloudModels);
              const nextInputModalities = JSON.stringify(["text", "image"]);
              defaultModelId = selectCloudDefaultModel(cloudModels);
              if (
                previousCustomModelsJson !== nextCustomModelsJson ||
                previousInputModalities !== nextInputModalities
              ) {
                providerChanges.customModelsJson = nextCustomModelsJson;
                providerChanges.inputModalities = ["text", "image"];
                modelsChanged = true;
              }
            }
          } catch {
            // Model refresh failed — keep existing list
          }

          // Sync auth profiles + config only when the local cloud provider
          // material actually changed. Billing overview polling can call this
          // path frequently; it must not rewrite config or restart the gateway
          // unless the underlying provider data changed.
          const providerChanged = baseUrlChanged || labelChanged || modelsChanged;
          const nextEntry = providerChanged
            ? storage.providerKeys.update(existing.id, providerChanges)
            : existing;
          if (!nextEntry) {
            throw new Error(`Cloud provider metadata disappeared during sync: ${existing.id}`);
          }

          if (keyChanged || providerChanged) {
            // Runtime provider fields are Vendor-owned. Persist the merged
            // definition before reading through the runtime projector again;
            // otherwise the projector returns the previous definition and
            // silently writes the stale endpoint back to config.
            yield syncAuthProxyAndConfig(nextEntry);
          }

          // Every install runs on the backend's default model, whatever it
          // ran on before.
          const defaultChanged =
            defaultModelId !== "" && pinCloudDefault(nextEntry, defaultModelId);
          if (defaultChanged) {
            yield applyDefaultModelRuntimeChange("cloud default model pinned");
          }

          // Re-project only after the authoritative config has been updated.
          const freshEntry = storage.providerKeys.getById(existing.id) ?? nextEntry;
          const mstEntry: MstProviderKeySnapshot = yield toMstSnapshot(freshEntry, secretStore);
          self.root.upsertProviderKey(mstEntry);

          log.info(
            keyChanged || providerChanged || defaultChanged
              ? "Synced cloud provider (key/baseUrl/models refreshed)"
              : "Cloud provider already up to date",
          );
          return;
        }

        // Create new entry
        const baseUrl = `${getApiBaseUrl("en")}/llm/v1`;
        let apiKeyValue: string;
        try {
          apiKeyValue = yield provisionCloudApiKey();
        } catch (err) {
          if (!isCloudLlmKeyUnavailableError(err)) throw err;
          log.info("Cloud provider key unavailable for current account; no local key created");
          return;
        }

        // Fetch available models from cloud endpoint (preserving per-model capabilities)
        let cloudModels: CloudModel[] = [];
        try {
          cloudModels = yield fetchCloudModels(baseUrl, apiKeyValue);
        } catch {
          // Model fetch failed — create entry with empty models
        }

        const entry = storage.providerKeys.create({
          id: `cloud-${CLOUD_PROVIDER_ID}`,
          provider: CLOUD_PROVIDER_ID,
          label: CLOUD_KEY_LABEL,
          model: selectCloudDefaultModel(cloudModels),
          isDefault: true,
          authType: "custom",
          baseUrl,
          customProtocol: "openai",
          customModelsJson: cloudModels.length > 0 ? JSON.stringify(cloudModels) : null,
          inputModalities: ["text", "image"],
          source: "cloud",
          createdAt: "",
          updatedAt: "",
        });

        yield secretStore.set(`provider-key-${entry.id}`, apiKeyValue);
        yield syncActiveKey(CLOUD_PROVIDER_ID, storage, secretStore);

        // MST state
        const mstEntry: MstProviderKeySnapshot = yield toMstSnapshot(entry, secretStore);
        self.root.upsertProviderKey(mstEntry);

        // Sync auth + proxy + full config (new cloud provider added)
        yield syncAuthProxyAndConfig(entry);
        if (entry.model && pinCloudDefault(entry, entry.model)) {
          yield applyDefaultModelRuntimeChange("cloud provider activated");
        }

        log.info("Created cloud provider key");
      }),
    };
  });
