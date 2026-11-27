import { describe, it, expect, afterEach, vi } from "vitest";
import { resetFirstPartyDomainRouteForTests, type ProviderKeyEntry } from "@rivonclaw/core";
import { initLLMProviderManagerEnv, rootStore } from "../app/store/desktop-store.js";
import { allKeysToMstSnapshots, toMstSnapshot } from "./provider-key-utils.js";

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

function entry(fields: Partial<ProviderKeyEntry> & Pick<ProviderKeyEntry, "id" | "provider">) {
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

function cloudEntry(model: string): ProviderKeyEntry {
  return entry({
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

/** In-memory storage whose active entry follows the gateway default written through the env. */
function harness(initial: ProviderKeyEntry[], primary: string | null) {
  let entries = [...initial];
  let defaultRef = primary;
  const settings = new Map<string, string>();
  const writeDefaultModelToConfig = vi.fn((gwProvider: string, modelId: string) => {
    defaultRef = `${gwProvider}/${modelId}`;
  });
  const restartGateway = vi.fn(async () => {});
  const rpcRequest = vi.fn();
  const project = (e: ProviderKeyEntry): ProviderKeyEntry => {
    const active = defaultRef?.startsWith(`${e.provider}/`) ?? false;
    return {
      ...e,
      isDefault: active,
      model: active ? defaultRef!.slice(e.provider.length + 1) : e.model,
    };
  };
  const storage = {
    providerKeys: {
      getAll: () => entries.map(project),
      getActive: () => entries.map(project).find((e) => e.isDefault),
      getById: (id: string) => entries.map(project).find((e) => e.id === id),
      getByProvider: (provider: string) =>
        entries.filter((e) => e.provider === provider).map(project),
      create: (e: ProviderKeyEntry) => {
        entries.push(e);
        return project(e);
      },
      update: (id: string, fields: Partial<ProviderKeyEntry>) => {
        const defined = Object.fromEntries(
          Object.entries(fields).filter(([, v]) => v !== undefined),
        );
        entries = entries.map((e) => (e.id === id ? { ...e, ...defined } : e));
        return entries.map(project).find((e) => e.id === id);
      },
      delete: (id: string) => {
        entries = entries.filter((e) => e.id !== id);
        return true;
      },
    },
    settings: {
      get: (key: string) => settings.get(key),
      set: (key: string, value: string) => void settings.set(key, value),
    },
  };
  const syncActiveKey = vi.fn(async () => {});
  initLLMProviderManagerEnv({
    storage: storage as any,
    secretStore: mockSecretStore as any,
    getRpcClient: () => ({ request: rpcRequest }) as any,
    toMstSnapshot,
    allKeysToMstSnapshots,
    syncActiveKey,
    syncAllAuthProfiles: async () => {},
    activateAuthProfile: () => "test:active",
    writeProxyRouterConfig: async () => {},
    writeDefaultModelToConfig,
    writeFullGatewayConfig: async () => {},
    restartGateway,
    proxyFetch: (async () =>
      new Response(JSON.stringify({ data: CLOUD_MODELS }), { status: 200 })) as any,
    graphqlFetch: (async () => ({ provisionLlmApiKey: { key: "cloud-key" } })) as any,
    stateDir: "/tmp/rivonclaw-llm-manager-test",
    getLastSystemProxy: () => null,
  });
  return {
    storage,
    settings,
    writeDefaultModelToConfig,
    restartGateway,
    rpcRequest,
    syncActiveKey,
    defaultRef: () => defaultRef,
  };
}

afterEach(() => {
  rootStore.loadProviderKeys([]);
  rootStore.clearCloudEntities();
  secretMap.clear();
  resetFirstPartyDomainRouteForTests();
  vi.restoreAllMocks();
});

describe("LLMProviderManager (cloud default model only)", () => {
  it("fails fast when no provider is active", () => {
    harness([], null);
    expect(() => rootStore.llmManager.resolveModelForDispatch()).toThrow(
      "TK Copilot AI is not available",
    );
  });

  it("dispatches every run on the gateway default model", () => {
    harness([cloudEntry("m")], "rivonclaw-pro/rivonclaw-flagship");
    expect(rootStore.llmManager.resolveModelForDispatch()).toEqual({
      provider: "rivonclaw-pro",
      model: "rivonclaw-flagship",
    });
  });

  it("removes unsupported provider keys and pins the cloud default model on startup", async () => {
    const h = harness(
      [
        entry({ id: "own-anthropic", provider: "anthropic", model: "claude-x" }),
        entry({ id: "local-ollama", provider: "ollama", authType: "local", model: "llama" }),
        cloudEntry("m"),
      ],
      "anthropic/claude-x",
    );
    secretMap.set("provider-key-own-anthropic", "sk-own");
    secretMap.set("provider-key-local-ollama", "x");
    secretMap.set("oauth-cred-own-anthropic", "{}");

    await rootStore.llmManager.reconcileCloudOnly();

    expect(h.storage.providerKeys.getAll().map((e) => e.id)).toEqual(["cloud-rivonclaw-pro"]);
    expect([...secretMap.keys()]).toEqual([]);
    expect(h.syncActiveKey).toHaveBeenCalledWith("anthropic", expect.anything(), expect.anything());
    expect(h.defaultRef()).toBe("rivonclaw-pro/rivonclaw-flagship");
    expect(rootStore.providerKeys.map((k) => k.id)).toEqual(["cloud-rivonclaw-pro"]);
    // The gateway has not started yet at this point, so nothing restarts it.
    expect(h.restartGateway).not.toHaveBeenCalled();
  });

  it("moves an existing cloud install off a non-default model and restarts once", async () => {
    const h = harness([cloudEntry("gpt-5.6-luna")], "rivonclaw-pro/gpt-5.6-luna");
    secretMap.set("provider-key-cloud-rivonclaw-pro", "cloud-key");

    await rootStore.llmManager.syncCloud({ userId: "u1" } as any);

    expect(h.defaultRef()).toBe("rivonclaw-pro/rivonclaw-flagship");
    expect(h.restartGateway).toHaveBeenCalledTimes(1);

    await rootStore.llmManager.syncCloud({ userId: "u1" } as any);
    expect(h.restartGateway).toHaveBeenCalledTimes(1);
  });

  it("creates the cloud provider on the default model for a first login", async () => {
    const h = harness([], null);

    await rootStore.llmManager.syncCloud({ userId: "u1" } as any);

    expect(h.storage.providerKeys.getAll().map((e) => e.provider)).toEqual(["rivonclaw-pro"]);
    expect(h.defaultRef()).toBe("rivonclaw-pro/rivonclaw-flagship");
    expect(secretMap.get("provider-key-cloud-rivonclaw-pro")).toBe("cloud-key");
  });

  it("resets user-pinned session models across every page, archived and every agent, once", async () => {
    const h = harness([cloudEntry("m")], "rivonclaw-pro/rivonclaw-flagship");
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
    const h = harness([cloudEntry("m")], "rivonclaw-pro/rivonclaw-flagship");
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
    expect(h.settings.size).toBe(0);
    expect(h.rpcRequest).not.toHaveBeenCalledWith("sessions.patch", expect.anything());

    failSecondPage = false;
    await rootStore.llmManager.resetStaleSessionModelOverrides();
    expect(h.rpcRequest).toHaveBeenCalledWith("sessions.patch", {
      key: "agent:main:a",
      model: null,
    });
    expect(h.settings.get("_internal.session-model-overrides-reset-done")).toBe("true");
  });
});
