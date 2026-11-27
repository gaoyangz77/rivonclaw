import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readExistingConfig, writeGatewayConfig } from "@rivonclaw/gateway";
import { createStorage } from "@rivonclaw/storage";
import { resetFirstPartyDomainRouteForTests, type ProviderKeyEntry } from "@rivonclaw/core";
import { initLLMProviderManagerEnv, rootStore } from "../app/store/desktop-store.js";
import { mutateDesktopOpenClawConfig } from "../gateway/openclaw-config-mutation.js";
import { allKeysToMstSnapshots, toMstSnapshot } from "./provider-key-utils.js";
import { syncActiveKey } from "./provider-secret-sync.js";
import {
  projectCloudOnlyProviderMetadata,
  readVendorDefaultModel,
  writeVendorProviderDefinition,
} from "./vendor-provider-runtime.js";

const secretMap = new Map<string, string>();
const mockSecretStore = {
  get: async (key: string) => secretMap.get(key) ?? null,
  set: async (key: string, value: string) => {
    secretMap.set(key, value);
  },
  delete: async (key: string) => {
    secretMap.delete(key);
  },
};

const CLOUD_MODELS = [{ id: "rivonclaw-flagship" }, { id: "gpt-5.6-luna" }];
const tempDirs: string[] = [];

function row(fields: Partial<ProviderKeyEntry> & Pick<ProviderKeyEntry, "id" | "provider">) {
  return {
    label: fields.provider,
    model: "m",
    isDefault: false,
    authType: "api_key",
    createdAt: "",
    updatedAt: "",
    ...fields,
  } as ProviderKeyEntry;
}

function cloudRow(model = "rivonclaw-flagship"): ProviderKeyEntry {
  return row({
    id: "cloud-rivonclaw-pro",
    provider: "rivonclaw-pro",
    model,
    authType: "custom",
    baseUrl: "https://example.test/llm/v1",
    customProtocol: "openai",
    customModelsJson: JSON.stringify(CLOUD_MODELS),
    inputModalities: ["text", "image"],
    source: "cloud",
    label: "TK Copilot AI",
  });
}

/**
 * Real storage and a real OpenClaw config file in a temp dir, with the same
 * runtime projector Desktop installs. The gateway process, the network and the
 * auth-profile store (a SQLite file that needs a newer Node than some dev
 * machines have) are faked: the fake `syncAllAuthProfiles` writes one profile
 * per key it is handed by `storage.providerKeys.getAll()`, exactly what the real
 * writer iterates.
 */
async function harness(options: {
  rows: ProviderKeyEntry[];
  primary: { provider: string; modelId: string } | null;
  /** Reproduce an older install: its non-cloud keys were already synced into auth profiles. */
  legacySync?: boolean;
}) {
  const root = mkdtempSync(join(tmpdir(), "llm-manager-"));
  tempDirs.push(root);
  const stateDir = join(root, "state");
  const configPath = join(stateDir, "openclaw.json");
  writeGatewayConfig({
    configPath,
    gatewayPort: 18789,
    ...(options.primary ? { defaultModel: options.primary } : {}),
  });

  const storage = createStorage(":memory:");
  for (const entry of options.rows) storage.providerKeys.create(entry);
  // runtime provider -> profile ids written for it
  const authProfiles = new Map<string, string>();
  const runtimeProviderOf = (entry: ProviderKeyEntry) => entry.provider;
  const syncAllAuthProfiles = vi.fn(async (_stateDir: string, store: typeof storage) => {
    for (const entry of store.providerKeys.getAll()) {
      authProfiles.set(`${runtimeProviderOf(entry)}:active`, runtimeProviderOf(entry));
    }
  });
  const removeAuthProfilesForRuntimeProvider = vi.fn((_stateDir: string, gwProvider: string) => {
    for (const [id, provider] of [...authProfiles]) {
      if (provider === gwProvider) authProfiles.delete(id);
    }
  });
  if (options.legacySync) {
    // What an older version did: every stored key was synced.
    for (const entry of options.rows) {
      writeVendorProviderDefinition({ configPath, entry });
      authProfiles.set(`${runtimeProviderOf(entry)}:active`, runtimeProviderOf(entry));
    }
  }
  storage.providerKeys.setRuntimeProjector((entries) =>
    projectCloudOnlyProviderMetadata({ entries, configPath, stateDir }),
  );

  const writeDefaultModelToConfig = vi.fn((gwProvider: string, modelId: string) => {
    mutateDesktopOpenClawConfig(
      configPath,
      "default model",
      (config) => {
        const agents = (config.agents ?? {}) as Record<string, any>;
        const defaults = (agents.defaults ?? {}) as Record<string, any>;
        defaults.model = { ...(defaults.model ?? {}), primary: `${gwProvider}/${modelId}` };
        agents.defaults = defaults;
        config.agents = agents;
      },
      { strict: true },
    );
  });
  const restartGateway = vi.fn(async () => {});
  const rpcRequest = vi.fn();
  initLLMProviderManagerEnv({
    storage,
    secretStore: mockSecretStore as any,
    getRpcClient: () => ({ request: rpcRequest }) as any,
    toMstSnapshot,
    allKeysToMstSnapshots,
    syncActiveKey,
    syncAllAuthProfiles,
    removeAuthProfilesForRuntimeProvider,
    activateAuthProfile: () => "test:active",
    writeProxyRouterConfig: async () => {},
    writeDefaultModelToConfig,
    writeFullGatewayConfig: async () => {},
    writeVendorProviderDefinition: (entry: ProviderKeyEntry, remove?: boolean) =>
      writeVendorProviderDefinition({ configPath, entry, remove }),
    restartGateway,
    proxyFetch: (async () =>
      new Response(JSON.stringify({ data: CLOUD_MODELS }), { status: 200 })) as any,
    graphqlFetch: (async () => ({ provisionLlmApiKey: { key: "cloud-key" } })) as any,
    stateDir,
    getLastSystemProxy: () => null,
  } as any);

  return {
    storage,
    stateDir,
    configPath,
    restartGateway,
    rpcRequest,
    defaultModel: () => readVendorDefaultModel(configPath),
    authProviders: () => [...authProfiles.values()],
    configProviders: () =>
      Object.keys(
        ((readExistingConfig(configPath).models as any)?.providers ?? {}) as Record<
          string,
          unknown
        >,
      ),
    snapshot: () => ({
      config: readFileSync(configPath, "utf8"),
      auth: JSON.stringify([...authProfiles.entries()].sort()),
      rows: JSON.stringify(storage.providerKeys.getAllUnprojected()),
      secrets: JSON.stringify([...secretMap.entries()].sort()),
    }),
  };
}

afterEach(() => {
  rootStore.loadProviderKeys([]);
  rootStore.clearCloudEntities();
  secretMap.clear();
  resetFirstPartyDomainRouteForTests();
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("LLMProviderManager (cloud default model only)", () => {
  it("fails fast when no provider is active", async () => {
    await harness({ rows: [], primary: null });
    expect(() => rootStore.llmManager.resolveModelForDispatch()).toThrow(
      "TK Copilot AI is not available",
    );
  });

  it("dispatches every run on the gateway default model", async () => {
    await harness({
      rows: [cloudRow()],
      primary: { provider: "rivonclaw-pro", modelId: "rivonclaw-flagship" },
    });
    expect(rootStore.llmManager.resolveModelForDispatch()).toEqual({
      provider: "rivonclaw-pro",
      model: "rivonclaw-flagship",
    });
  });

  describe("seller-owned provider keys (kept by product decision, ADR-123, but never used)", () => {
    const sellerRows = () => [
      row({ id: "own-anthropic", provider: "anthropic", model: "claude-x" }),
      row({
        id: "own-custom",
        provider: "my-endpoint",
        authType: "custom",
        baseUrl: "https://llm.example.test/v1",
        customProtocol: "openai",
        customModelsJson: JSON.stringify([{ id: "m1" }]),
        model: "m1",
      }),
      cloudRow("gpt-5.6-luna"),
    ];

    async function upgradedInstall() {
      secretMap.set("provider-key-own-anthropic", "sk-own");
      secretMap.set("proxy-auth-own-anthropic", "user:pass");
      secretMap.set("oauth-cred-own-anthropic", "{}");
      secretMap.set("provider-key-own-custom", "sk-custom");
      secretMap.set("provider-key-cloud-rivonclaw-pro", "cloud-key");
      return harness({
        rows: sellerRows(),
        // The seller had chosen their own provider as the default.
        primary: { provider: "anthropic", modelId: "claude-x" },
        legacySync: true,
      });
    }

    it("starts out written into auth profiles and config (the state an upgrade finds)", async () => {
      const h = await upgradedInstall();
      expect(h.authProviders()).toContain("anthropic");
      expect(h.configProviders()).toContain("my-endpoint");
    });

    it("keeps the rows and secrets, but nothing non-cloud is used afterwards", async () => {
      const h = await upgradedInstall();

      await rootStore.llmManager.reconcileCloudOnly();

      // Kept: rows and keychain secrets are untouched.
      expect(
        h.storage.providerKeys
          .getAllUnprojected()
          .map((e) => e.id)
          .sort(),
      ).toEqual(["cloud-rivonclaw-pro", "own-anthropic", "own-custom"]);
      expect(secretMap.get("provider-key-own-anthropic")).toBe("sk-own");
      expect(secretMap.get("proxy-auth-own-anthropic")).toBe("user:pass");
      expect(secretMap.get("oauth-cred-own-anthropic")).toBe("{}");
      expect(secretMap.get("provider-key-own-custom")).toBe("sk-custom");

      // Inert: not in the gateway's auth profiles or model config.
      expect(h.authProviders()).not.toContain("anthropic");
      expect(h.authProviders()).not.toContain("my-endpoint");
      expect(h.configProviders()).not.toContain("my-endpoint");

      // Never visible to a reader, so never active, default or dispatched with.
      expect(h.storage.providerKeys.getAll().map((e) => e.provider)).toEqual(["rivonclaw-pro"]);
      expect(h.storage.providerKeys.getById("own-anthropic")).toBeUndefined();
      expect(h.storage.providerKeys.getByProvider("anthropic")).toEqual([]);
      expect(h.storage.providerKeys.getActive()?.provider).toBe("rivonclaw-pro");
      expect(rootStore.providerKeys.map((k) => k.provider)).toEqual(["rivonclaw-pro"]);

      // The cloud provider is pinned on the backend default model.
      expect(h.defaultModel()).toEqual({
        provider: "rivonclaw-pro",
        modelId: "rivonclaw-flagship",
      });
      expect(rootStore.llmManager.resolveModelForDispatch()).toEqual({
        provider: "rivonclaw-pro",
        model: "rivonclaw-flagship",
      });
      // The gateway has not started yet at this point, so nothing restarts it.
      expect(h.restartGateway).not.toHaveBeenCalled();
    });

    it("is idempotent across restarts", async () => {
      const h = await upgradedInstall();
      await rootStore.llmManager.reconcileCloudOnly();
      const afterFirst = h.snapshot();

      await rootStore.llmManager.reconcileCloudOnly();

      expect(h.snapshot()).toEqual(afterFirst);
    });

    it("keeps non-cloud keys inert when the cloud provider syncs", async () => {
      const h = await upgradedInstall();
      await rootStore.llmManager.reconcileCloudOnly();

      await rootStore.llmManager.syncCloud({ userId: "u1" } as any);

      expect(h.authProviders()).not.toContain("anthropic");
      expect(h.authProviders()).toContain("rivonclaw-pro");
      expect(h.storage.providerKeys.getAllUnprojected()).toHaveLength(3);
    });
  });

  it("moves an existing cloud install off a non-default model and restarts once", async () => {
    secretMap.set("provider-key-cloud-rivonclaw-pro", "cloud-key");
    const h = await harness({
      rows: [cloudRow("gpt-5.6-luna")],
      primary: { provider: "rivonclaw-pro", modelId: "gpt-5.6-luna" },
    });

    await rootStore.llmManager.syncCloud({ userId: "u1" } as any);

    expect(h.defaultModel()).toEqual({ provider: "rivonclaw-pro", modelId: "rivonclaw-flagship" });
    expect(h.restartGateway).toHaveBeenCalledTimes(1);

    await rootStore.llmManager.syncCloud({ userId: "u1" } as any);
    expect(h.restartGateway).toHaveBeenCalledTimes(1);
  });

  it("creates the cloud provider on the default model for a first login", async () => {
    const h = await harness({ rows: [], primary: null });

    await rootStore.llmManager.syncCloud({ userId: "u1" } as any);

    expect(h.storage.providerKeys.getAll().map((e) => e.provider)).toEqual(["rivonclaw-pro"]);
    expect(h.defaultModel()).toEqual({ provider: "rivonclaw-pro", modelId: "rivonclaw-flagship" });
    expect(secretMap.get("provider-key-cloud-rivonclaw-pro")).toBe("cloud-key");
  });

  it("resets user-pinned session models across every page, archived and every agent, once", async () => {
    const h = await harness({
      rows: [cloudRow()],
      primary: { provider: "rivonclaw-pro", modelId: "rivonclaw-flagship" },
    });
    const pages = [
      {
        sessions: [{ key: "agent:main:a", modelOverrideSource: "user" }, { key: "agent:main:b" }],
        hasMore: true,
        nextOffset: 2,
      },
      {
        sessions: [
          { key: "agent:customer-service:cs:c", modelOverrideSource: "user" },
          { key: "agent:affiliate:d", modelOverrideSource: "auto" },
        ],
        hasMore: true,
        nextOffset: 4,
      },
      { sessions: [{ key: "agent:main:archived-e", modelOverrideSource: "user" }], hasMore: false },
    ];
    h.rpcRequest.mockImplementation(async (method: string, params: { offset?: number }) =>
      method === "sessions.list" ? pages[(params.offset ?? 0) / 2] : true,
    );

    await rootStore.llmManager.resetStaleSessionModelOverrides();

    const listCalls = h.rpcRequest.mock.calls.filter(([method]) => method === "sessions.list");
    expect(listCalls.map(([, params]) => params.offset)).toEqual([0, 2, 4]);
    expect(
      listCalls.every(([, params]) => params.archived === "all" && !("agentId" in params)),
    ).toBe(true);
    const patched = h.rpcRequest.mock.calls
      .filter(([method]) => method === "sessions.patch")
      .map(([, params]) => params);
    expect(patched).toEqual([
      { key: "agent:main:a", model: null },
      { key: "agent:customer-service:cs:c", model: null },
      { key: "agent:main:archived-e", model: null },
    ]);

    h.rpcRequest.mockClear();
    await rootStore.llmManager.resetStaleSessionModelOverrides();
    expect(h.rpcRequest).not.toHaveBeenCalled();
  });

  it("does not mark the reset done when a later page fails, and retries from the start", async () => {
    const h = await harness({
      rows: [cloudRow()],
      primary: { provider: "rivonclaw-pro", modelId: "rivonclaw-flagship" },
    });
    let failSecondPage = true;
    h.rpcRequest.mockImplementation(async (method: string, params: { offset?: number }) => {
      if (method !== "sessions.list") return true;
      if (!params.offset) {
        return {
          sessions: [{ key: "agent:main:a", modelOverrideSource: "user" }],
          hasMore: true,
          nextOffset: 1,
        };
      }
      if (failSecondPage) throw new Error("gateway restarting");
      return { sessions: [], hasMore: false };
    });

    await expect(rootStore.llmManager.resetStaleSessionModelOverrides()).rejects.toThrow(
      "gateway restarting",
    );
    expect(h.storage.settings.get("_internal.session-model-overrides-reset-done")).toBeUndefined();
    expect(h.rpcRequest).not.toHaveBeenCalledWith("sessions.patch", expect.anything());

    failSecondPage = false;
    await rootStore.llmManager.resetStaleSessionModelOverrides();
    expect(h.rpcRequest).toHaveBeenCalledWith("sessions.patch", {
      key: "agent:main:a",
      model: null,
    });
    expect(h.storage.settings.get("_internal.session-model-overrides-reset-done")).toBe("true");
  });
});
