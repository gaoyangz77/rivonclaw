import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ScopeType, type ProviderKeyEntry } from "@rivonclaw/core";
import { initLLMProviderManagerEnv, rootStore } from "../app/store/desktop-store.js";
import { allKeysToMstSnapshots, toMstSnapshot } from "./provider-key-utils.js";

const secretMap = new Map<string, string>();
const mockSecretStore = {
  get: async (key: string) => secretMap.get(key) ?? null,
  set: async (key: string, value: string) => { secretMap.set(key, value); },
  delete: async (key: string) => { secretMap.delete(key); },
};

afterEach(() => {
  rootStore.llmManager.clearVolatileSessionState();
  rootStore.loadProviderKeys([]);
  rootStore.clearCloudEntities();
  secretMap.clear();
  vi.restoreAllMocks();
});

describe("LLMProviderManager", () => {
  it("fails fast instead of patching to OpenClaw global default when no active provider key exists", async () => {
    const rpcRequest = vi.fn().mockResolvedValue(true);

    initLLMProviderManagerEnv({
      storage: {
        providerKeys: {
          getActive: () => null,
          getById: () => undefined,
          getAll: () => [],
        },
      } as any,
      secretStore: mockSecretStore as any,
      getRpcClient: () => ({ request: rpcRequest }) as any,
      toMstSnapshot,
      allKeysToMstSnapshots,
      syncActiveKey: async () => {},
      syncAllAuthProfiles: async () => {},
      writeProxyRouterConfig: async () => {},
      writeDefaultModelToConfig: vi.fn(),
      writeFullGatewayConfig: async () => {},
      restartGateway: async () => {},
      proxyFetch: globalThis.fetch,
      stateDir: "/tmp/rivonclaw-llm-manager-test",
      getLastSystemProxy: () => null,
    });

    await expect(rootStore.llmManager.applyModelForSession("agent:main:cs:tiktok:conv-no-key"))
      .rejects
      .toThrow("No active LLM provider is configured");
    expect(rpcRequest).not.toHaveBeenCalledWith("sessions.patch", expect.objectContaining({ model: null }));
  });

  it("updates gateway default without eagerly resetting default-following sessions when the active key model changes", async () => {
    const rpcRequest = vi.fn().mockResolvedValue(true);
    const writeDefaultModelToConfig = vi.fn();
    const restartGateway = vi.fn();

    let entry: ProviderKeyEntry = {
      id: "key-default",
      provider: "rivonclaw-pro",
      label: "RivonClaw AI",
      model: "gpt-5.1",
      isDefault: true,
      authType: "custom",
      baseUrl: "https://example.test/llm/v1",
      customProtocol: "openai",
      customModelsJson: JSON.stringify([{ id: "gpt-5.1" }, { id: "gpt-5.4" }]),
      createdAt: "",
      updatedAt: "",
    };
    const storage = {
      providerKeys: {
        getActive: () => entry,
        getById: (id: string) => (id === entry.id ? entry : undefined),
        getAll: () => [entry],
        update: (id: string, fields: Partial<ProviderKeyEntry>) => {
          if (id !== entry.id) return undefined;
          const definedFields = Object.fromEntries(
            Object.entries(fields).filter(([, value]) => value !== undefined),
          ) as Partial<ProviderKeyEntry>;
          entry = { ...entry, ...definedFields, updatedAt: "updated" };
          return entry;
        },
      },
      settings: {
        set: vi.fn(),
        get: vi.fn(),
      },
    };
    rootStore.loadProviderKeys([await toMstSnapshot(entry, mockSecretStore as any)]);

    initLLMProviderManagerEnv({
      storage: storage as any,
      secretStore: mockSecretStore as any,
      getRpcClient: () => ({ request: rpcRequest }) as any,
      toMstSnapshot,
      allKeysToMstSnapshots,
      syncActiveKey: async () => {},
      syncAllAuthProfiles: async () => {},
      writeProxyRouterConfig: async () => {},
      writeDefaultModelToConfig,
      writeFullGatewayConfig: async () => {},
      restartGateway,
      proxyFetch: globalThis.fetch,
      stateDir: "/tmp/rivonclaw-llm-manager-test",
      getLastSystemProxy: () => null,
    });

    rootStore.llmManager.trackSessionActivity("chat-session-1");

    await rootStore.llmManager.updateKey("key-default", { model: "gpt-5.4" });

    expect(entry.model).toBe("gpt-5.4");
    expect(writeDefaultModelToConfig).toHaveBeenCalledWith("rivonclaw-pro", "gpt-5.4");
    expect(rpcRequest).not.toHaveBeenCalledWith("sessions.patch", expect.anything());
    expect(rootStore.llmManager.getSessionModel("chat-session-1")).toBeNull();
    expect(rootStore.llmManager.getSessionModelFact("chat-session-1")).toMatchObject({
      mode: "default",
      provider: null,
      model: null,
    });

    await rootStore.llmManager.applyModelForSession("chat-session-1");
    expect(rpcRequest).toHaveBeenCalledWith("sessions.patch", {
      key: "chat-session-1",
      model: "rivonclaw-pro/gpt-5.4",
    });
    expect(restartGateway).not.toHaveBeenCalled();
  });

  it("skips redundant lazy default patches but reapplies after the active model changes", async () => {
    const rpcRequest = vi.fn().mockResolvedValue(true);
    let entry: ProviderKeyEntry = {
      id: "key-default",
      provider: "rivonclaw-pro",
      label: "RivonClaw AI",
      model: "gpt-5.4",
      isDefault: true,
      authType: "custom",
      baseUrl: "https://example.test/llm/v1",
      customProtocol: "openai",
      customModelsJson: JSON.stringify([{ id: "gpt-5.4" }, { id: "gpt-5.5" }]),
      createdAt: "",
      updatedAt: "",
    };

    initLLMProviderManagerEnv({
      storage: {
        providerKeys: {
          getActive: () => entry,
          getById: (id: string) => (id === entry.id ? entry : undefined),
          getAll: () => [entry],
        },
      } as any,
      secretStore: mockSecretStore as any,
      getRpcClient: () => ({ request: rpcRequest }) as any,
      toMstSnapshot,
      allKeysToMstSnapshots,
      syncActiveKey: async () => {},
      syncAllAuthProfiles: async () => {},
      writeProxyRouterConfig: async () => {},
      writeDefaultModelToConfig: vi.fn(),
      writeFullGatewayConfig: async () => {},
      restartGateway: async () => {},
      proxyFetch: globalThis.fetch,
      stateDir: "/tmp/rivonclaw-llm-manager-test",
      getLastSystemProxy: () => null,
    });

    await rootStore.llmManager.applyModelForSession("chat-session-1");
    await rootStore.llmManager.applyModelForSession("chat-session-1");

    expect(rpcRequest).toHaveBeenCalledTimes(1);
    expect(rpcRequest).toHaveBeenLastCalledWith("sessions.patch", {
      key: "chat-session-1",
      model: "rivonclaw-pro/gpt-5.4",
    });

    entry = { ...entry, model: "gpt-5.5" };
    await rootStore.llmManager.applyModelForSession("chat-session-1");

    expect(rpcRequest).toHaveBeenCalledTimes(2);
    expect(rpcRequest).toHaveBeenLastCalledWith("sessions.patch", {
      key: "chat-session-1",
      model: "rivonclaw-pro/gpt-5.5",
    });
  });

  it("clears stale OpenClaw auth profile overrides when applying the global default", async () => {
    const rpcRequest = vi.fn().mockResolvedValue(true);
    const stateDir = await mkdtemp(path.join(tmpdir(), "rivonclaw-llm-manager-"));
    const sessionKey = "agent:main:feishu:default:direct:ou_1";
    const sessionsDir = path.join(stateDir, "openclaw", "agents", "main", "sessions");
    const sessionsPath = path.join(sessionsDir, "sessions.json");

    try {
      await mkdir(sessionsDir, { recursive: true });
      await writeFile(
        sessionsPath,
        `${JSON.stringify({
          [sessionKey]: {
            sessionId: "s1",
            updatedAt: 1,
            authProfileOverride: "google-gemini-cli:user@example.com",
            authProfileOverrideSource: "auto",
            authProfileOverrideCompactionCount: 0,
          },
        }, null, 2)}\n`,
        "utf8",
      );

      const entry: ProviderKeyEntry = {
        id: "key-default",
        provider: "rivonclaw-pro",
        label: "RivonClaw AI",
        model: "gpt-5.5",
        isDefault: true,
        authType: "custom",
        baseUrl: "https://example.test/llm/v1",
        customProtocol: "openai",
        customModelsJson: JSON.stringify([{ id: "gpt-5.5" }]),
        createdAt: "",
        updatedAt: "",
      };

      initLLMProviderManagerEnv({
        storage: {
          providerKeys: {
            getActive: () => entry,
            getById: () => entry,
            getAll: () => [entry],
          },
        } as any,
        secretStore: mockSecretStore as any,
        getRpcClient: () => ({ request: rpcRequest }) as any,
        toMstSnapshot,
        allKeysToMstSnapshots,
        syncActiveKey: async () => {},
        syncAllAuthProfiles: async () => {},
        writeProxyRouterConfig: async () => {},
        writeDefaultModelToConfig: vi.fn(),
        writeFullGatewayConfig: async () => {},
        restartGateway: async () => {},
        proxyFetch: globalThis.fetch,
        stateDir,
        getLastSystemProxy: () => null,
      });

      await rootStore.llmManager.applyModelForSession(sessionKey);

      expect(rpcRequest).toHaveBeenCalledWith("sessions.patch", {
        key: sessionKey,
        model: "rivonclaw-pro/gpt-5.5",
      });
      const store = JSON.parse(await readFile(sessionsPath, "utf8"));
      expect(store[sessionKey].authProfileOverride).toBeUndefined();
      expect(store[sessionKey].authProfileOverrideSource).toBeUndefined();
      expect(store[sessionKey].authProfileOverrideCompactionCount).toBeUndefined();
      expect(store[sessionKey].updatedAt).toBeGreaterThan(1);
    } finally {
      await rm(stateDir, { recursive: true, force: true });
    }
  });

  it("updates gateway default without eagerly resetting sessions on default provider activation", async () => {
    const rpcRequest = vi.fn().mockResolvedValue(true);
    const writeDefaultModelToConfig = vi.fn();
    const restartGateway = vi.fn();

    let keys: ProviderKeyEntry[] = [
      {
        id: "key-kimi",
        provider: "kimi",
        label: "Kimi",
        model: "moonshot-v1-8k",
        isDefault: true,
        authType: "api_key",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "key-pro",
        provider: "rivonclaw-pro",
        label: "RivonClaw AI",
        model: "gpt-5.4",
        isDefault: false,
        authType: "custom",
        baseUrl: "https://example.test/llm/v1",
        customProtocol: "openai",
        customModelsJson: JSON.stringify([{ id: "gpt-5.4" }]),
        createdAt: "",
        updatedAt: "",
      },
    ];
    const storage = {
      providerKeys: {
        getActive: () => keys.find((k) => k.isDefault),
        getById: (id: string) => keys.find((k) => k.id === id),
        getAll: () => keys,
        setDefault: (id: string) => {
          keys = keys.map((k) => ({ ...k, isDefault: k.id === id }));
        },
      },
      settings: {
        set: vi.fn(),
        get: vi.fn(),
      },
      chatSessions: {
        list: () => [
          { key: "historical-session-default" },
          { key: "chat-session-explicit" },
        ],
      },
    };
    rootStore.loadProviderKeys(await allKeysToMstSnapshots(keys, mockSecretStore as any));

    initLLMProviderManagerEnv({
      storage: storage as any,
      secretStore: mockSecretStore as any,
      getRpcClient: () => ({ request: rpcRequest }) as any,
      toMstSnapshot,
      allKeysToMstSnapshots,
      syncActiveKey: async () => {},
      syncAllAuthProfiles: async () => {},
      writeProxyRouterConfig: async () => {},
      writeDefaultModelToConfig,
      writeFullGatewayConfig: async () => {},
      restartGateway,
      proxyFetch: globalThis.fetch,
      stateDir: "/tmp/rivonclaw-llm-manager-test",
      getLastSystemProxy: () => null,
    });

    await rootStore.llmManager.switchModelForSession("chat-session-explicit", "kimi", "moonshot-v1-8k");
    rootStore.llmManager.trackSessionActivity("telegram-session-default");
    rpcRequest.mockClear();

    await rootStore.llmManager.activateProvider("key-pro");

    expect(writeDefaultModelToConfig).toHaveBeenCalledWith("rivonclaw-pro", "gpt-5.4");
    expect(rpcRequest).not.toHaveBeenCalledWith("sessions.patch", expect.anything());
    expect(rootStore.llmManager.getSessionModel("telegram-session-default")).toBeNull();
    expect(rootStore.llmManager.getSessionModelFact("telegram-session-default")).toMatchObject({
      mode: "default",
      provider: null,
      model: null,
    });
    expect(rootStore.llmManager.getSessionModelInfo("telegram-session-default")).toMatchObject({
      provider: "rivonclaw-pro",
      model: "gpt-5.4",
      gatewayProvider: "rivonclaw-pro",
      gatewayModel: "gpt-5.4",
      mode: "default",
      isOverridden: false,
    });

    await rootStore.llmManager.applyModelForSession("telegram-session-default");
    expect(rpcRequest).toHaveBeenCalledWith("sessions.patch", {
      key: "telegram-session-default",
      model: "rivonclaw-pro/gpt-5.4",
    });
    expect(rpcRequest).not.toHaveBeenCalledWith("sessions.list", expect.anything());
    expect(rpcRequest).not.toHaveBeenCalledWith("sessions.patch", {
      key: "chat-session-explicit",
      model: null,
    });
    expect(rpcRequest).not.toHaveBeenCalledWith("sessions.patch", {
      key: "historical-session-default",
      model: null,
    });
    expect(restartGateway).not.toHaveBeenCalled();
  });

  it("creates a default cloud provider without eagerly resetting active channel sessions", async () => {
    const rpcRequest = vi.fn().mockResolvedValue(true);
    const writeDefaultModelToConfig = vi.fn();
    const writeFullGatewayConfig = vi.fn();
    const restartGateway = vi.fn();

    let keys: ProviderKeyEntry[] = [];
    const storage = {
      providerKeys: {
        getActive: () => keys.find((k) => k.isDefault),
        getById: (id: string) => keys.find((k) => k.id === id),
        getAll: () => keys,
        create: (entry: ProviderKeyEntry) => {
          keys = [...keys, entry];
          return entry;
        },
      },
      settings: {
        set: vi.fn(),
        get: vi.fn(),
      },
      chatSessions: {
        list: () => [],
      },
    };
    rootStore.loadProviderKeys([]);

    initLLMProviderManagerEnv({
      storage: storage as any,
      secretStore: mockSecretStore as any,
      getRpcClient: () => ({ request: rpcRequest }) as any,
      toMstSnapshot,
      allKeysToMstSnapshots,
      syncActiveKey: async () => {},
      syncAllAuthProfiles: async () => {},
      writeProxyRouterConfig: async () => {},
      writeDefaultModelToConfig,
      writeFullGatewayConfig,
      restartGateway,
      graphqlFetch: vi.fn().mockResolvedValue({
        provisionLlmApiKey: {
          id: "llm-key-1",
          key: "cloud-token",
          keyPrefix: "cloud-token".slice(0, 14),
          status: "ACTIVE",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          lastUsedAt: null,
        },
      }),
      proxyFetch: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: "gpt-5.4" }, { id: "gpt-5.5" }] }),
      }) as any,
      stateDir: "/tmp/rivonclaw-llm-manager-test",
      getLastSystemProxy: () => null,
    });

    rootStore.llmManager.trackSessionActivity("agent:main:telegram:default:direct:42");
    await rootStore.llmManager.syncCloud({
      userId: "u1",
      email: "test@example.com",
      name: "Test",
      createdAt: "2026-01-01T00:00:00Z",
      enrolledModules: [],
      entitlementKeys: [],
      defaultRunProfileId: null,
    });

    expect(keys[0]).toMatchObject({
      provider: "rivonclaw-pro",
      label: "RivonClaw AI",
      model: "gpt-5.5",
      isDefault: true,
      inputModalities: ["text", "image"],
    });
    expect(writeFullGatewayConfig).toHaveBeenCalled();
    expect(writeDefaultModelToConfig).toHaveBeenCalledWith("rivonclaw-pro", "gpt-5.5");
    expect(rpcRequest).not.toHaveBeenCalledWith("sessions.patch", expect.anything());
    expect(rootStore.llmManager.getSessionModelFact("agent:main:telegram:default:direct:42")).toMatchObject({
      mode: "default",
      provider: null,
      model: null,
    });

    await rootStore.llmManager.applyModelForSession("agent:main:telegram:default:direct:42");
    expect(rpcRequest).toHaveBeenCalledWith("sessions.patch", {
      key: "agent:main:telegram:default:direct:42",
      model: "rivonclaw-pro/gpt-5.5",
    });
    expect(restartGateway).not.toHaveBeenCalled();
  });

  it("rotates an existing cloud provider key when the cloud model catalog returns auth failure", async () => {
    const rpcRequest = vi.fn().mockResolvedValue(true);
    const writeDefaultModelToConfig = vi.fn();
    const writeFullGatewayConfig = vi.fn();
    const restartGateway = vi.fn();

    let entry: ProviderKeyEntry = {
      id: "cloud-rivonclaw-pro",
      provider: "rivonclaw-pro",
      label: ["RivonClaw", "Pro"].join(" "),
      model: "gpt-5.1",
      isDefault: true,
      authType: "custom",
      baseUrl: "https://api.rivonclaw.com/llm/v1",
      customProtocol: "openai",
      customModelsJson: JSON.stringify([{ id: "gpt-5.1" }]),
      inputModalities: ["text"],
      source: "cloud",
      createdAt: "",
      updatedAt: "",
    };
    const storage = {
      providerKeys: {
        getActive: () => entry,
        getById: (id: string) => (id === entry.id ? entry : undefined),
        getAll: () => [entry],
        update: (id: string, fields: Partial<ProviderKeyEntry>) => {
          if (id !== entry.id) return undefined;
          entry = { ...entry, ...fields, updatedAt: "updated" };
          return entry;
        },
      },
      settings: {
        set: vi.fn(),
        get: vi.fn(),
      },
      chatSessions: {
        list: () => [],
      },
    };
    await mockSecretStore.set(`provider-key-${entry.id}`, "stale-cloud-token");
    rootStore.loadProviderKeys([await toMstSnapshot(entry, mockSecretStore as any)]);

    const graphqlFetch = vi.fn()
      .mockResolvedValueOnce({
        provisionLlmApiKey: {
          id: "llm-key-1",
          key: "rcllm_test_fresh_cloud_token_1",
          keyPrefix: "rcllm_test_fre",
          status: "ACTIVE",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          lastUsedAt: null,
        },
      })
      .mockResolvedValueOnce({
        provisionLlmApiKey: {
          id: "llm-key-1",
          key: "rcllm_test_fresh_cloud_token_2",
          keyPrefix: "rcllm_test_fre",
          status: "ACTIVE",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          lastUsedAt: null,
        },
      });
    const proxyFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: "gpt-5.4", input_modalities: ["text", "image"] }] }),
      });

    initLLMProviderManagerEnv({
      storage: storage as any,
      secretStore: mockSecretStore as any,
      getRpcClient: () => ({ request: rpcRequest }) as any,
      toMstSnapshot,
      allKeysToMstSnapshots,
      syncActiveKey: async () => {},
      syncAllAuthProfiles: async () => {},
      writeProxyRouterConfig: async () => {},
      writeDefaultModelToConfig,
      writeFullGatewayConfig,
      restartGateway,
      graphqlFetch,
      proxyFetch: proxyFetch as any,
      stateDir: "/tmp/rivonclaw-llm-manager-test",
      getLastSystemProxy: () => null,
    });

    await rootStore.llmManager.syncCloud({
      userId: "u1",
      email: "test@example.com",
      name: "Test",
      createdAt: "2026-01-01T00:00:00Z",
      enrolledModules: [],
      entitlementKeys: [],
      defaultRunProfileId: null,
    });

    expect(await mockSecretStore.get(`provider-key-${entry.id}`)).toBe("rcllm_test_fresh_cloud_token_2");
    expect(graphqlFetch).toHaveBeenCalledTimes(2);
    expect(proxyFetch).toHaveBeenCalledTimes(2);
    expect(proxyFetch.mock.calls[0]?.[1]?.headers).toEqual({ Authorization: "Bearer rcllm_test_fresh_cloud_token_1" });
    expect(proxyFetch.mock.calls[1]?.[1]?.headers).toEqual({ Authorization: "Bearer rcllm_test_fresh_cloud_token_2" });
    expect(entry.label).toBe("RivonClaw AI");
    expect(entry.customModelsJson).toBe(JSON.stringify([{ id: "gpt-5.4", input_modalities: ["text", "image"] }]));
    expect(entry.inputModalities).toEqual(["text", "image"]);
    expect(writeFullGatewayConfig).toHaveBeenCalled();
    expect(writeDefaultModelToConfig).not.toHaveBeenCalled();
    expect(rpcRequest).not.toHaveBeenCalledWith("sessions.patch", expect.anything());
    expect(restartGateway).not.toHaveBeenCalled();
  });

  it("does not reset sessions when cloud provider sync finds no material changes", async () => {
    const rpcRequest = vi.fn().mockResolvedValue(true);
    const writeDefaultModelToConfig = vi.fn();
    const writeFullGatewayConfig = vi.fn();
    const restartGateway = vi.fn();

    let entry: ProviderKeyEntry = {
      id: "cloud-rivonclaw-pro",
      provider: "rivonclaw-pro",
      label: "RivonClaw AI",
      model: "gpt-5.5",
      isDefault: true,
      authType: "custom",
      baseUrl: "https://api.rivonclaw.com/llm/v1",
      customProtocol: "openai",
      customModelsJson: JSON.stringify([{ id: "gpt-5.5", input_modalities: ["text", "image"] }]),
      inputModalities: ["text", "image"],
      source: "cloud",
      createdAt: "",
      updatedAt: "",
    };
    const storage = {
      providerKeys: {
        getActive: () => entry,
        getById: (id: string) => (id === entry.id ? entry : undefined),
        getAll: () => [entry],
        update: (id: string, fields: Partial<ProviderKeyEntry>) => {
          if (id !== entry.id) return undefined;
          entry = { ...entry, ...fields, updatedAt: "updated" };
          return entry;
        },
      },
      settings: {
        set: vi.fn(),
        get: vi.fn(),
      },
      chatSessions: {
        list: () => [],
      },
    };
    await mockSecretStore.set(`provider-key-${entry.id}`, "rcllm_test_existing_cloud_token");
    rootStore.loadProviderKeys([await toMstSnapshot(entry, mockSecretStore as any)]);

    initLLMProviderManagerEnv({
      storage: storage as any,
      secretStore: mockSecretStore as any,
      getRpcClient: () => ({ request: rpcRequest }) as any,
      toMstSnapshot,
      allKeysToMstSnapshots,
      syncActiveKey: async () => {},
      syncAllAuthProfiles: async () => {},
      writeProxyRouterConfig: async () => {},
      writeDefaultModelToConfig,
      writeFullGatewayConfig,
      restartGateway,
      graphqlFetch: vi.fn().mockResolvedValue({
        provisionLlmApiKey: {
          id: "llm-key-1",
          key: "rcllm_test_existing_cloud_token",
          keyPrefix: "rcllm_test_exi",
          status: "ACTIVE",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          lastUsedAt: null,
        },
      }),
      proxyFetch: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: "gpt-5.5", input_modalities: ["text", "image"] }] }),
      }) as any,
      stateDir: "/tmp/rivonclaw-llm-manager-test",
      getLastSystemProxy: () => null,
    });

    rootStore.llmManager.trackSessionActivity("agent:main:cs:tiktok:no-material-change");
    await rootStore.llmManager.syncCloud({
      userId: "u1",
      email: "test@example.com",
      name: "Test",
      createdAt: "2026-01-01T00:00:00Z",
      enrolledModules: [],
      entitlementKeys: [],
      defaultRunProfileId: null,
    });

    expect(writeFullGatewayConfig).not.toHaveBeenCalled();
    expect(writeDefaultModelToConfig).not.toHaveBeenCalled();
    expect(rpcRequest).not.toHaveBeenCalledWith("sessions.patch", expect.anything());
    expect(restartGateway).not.toHaveBeenCalled();
  });

  it("removes the local cloud provider key when the signed-in account lacks LLM entitlement", async () => {
    const writeDefaultModelToConfig = vi.fn();
    const writeFullGatewayConfig = vi.fn();
    const syncActiveKeyMock = vi.fn().mockResolvedValue(undefined);

    let keys: ProviderKeyEntry[] = [
      {
        id: "cloud-rivonclaw-pro",
        provider: "rivonclaw-pro",
        label: "RivonClaw AI",
        model: "gpt-5.1",
        isDefault: true,
        authType: "custom",
        baseUrl: "https://api.rivonclaw.com/llm/v1",
        customProtocol: "openai",
        customModelsJson: JSON.stringify([{ id: "gpt-5.1" }]),
        source: "cloud",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "key-kimi",
        provider: "kimi",
        label: "Kimi",
        model: "moonshot-v1-8k",
        isDefault: false,
        authType: "api_key",
        createdAt: "",
        updatedAt: "",
      },
    ];
    const storage = {
      providerKeys: {
        getActive: () => keys.find((k) => k.isDefault),
        getById: (id: string) => keys.find((k) => k.id === id),
        getAll: () => keys,
        delete: (id: string) => {
          keys = keys.filter((k) => k.id !== id);
        },
        setDefault: (id: string) => {
          keys = keys.map((k) => ({ ...k, isDefault: k.id === id }));
        },
      },
      settings: {
        set: vi.fn(),
        get: vi.fn(),
      },
      chatSessions: {
        list: () => [],
      },
    };
    await mockSecretStore.set("provider-key-cloud-rivonclaw-pro", "stale-cloud-token");
    await mockSecretStore.set("provider-key-key-kimi", "kimi-token");
    rootStore.loadProviderKeys(await allKeysToMstSnapshots(keys, mockSecretStore as any));

    initLLMProviderManagerEnv({
      storage: storage as any,
      secretStore: mockSecretStore as any,
      getRpcClient: () => null,
      toMstSnapshot,
      allKeysToMstSnapshots,
      syncActiveKey: syncActiveKeyMock,
      syncAllAuthProfiles: async () => {},
      writeProxyRouterConfig: async () => {},
      writeDefaultModelToConfig,
      writeFullGatewayConfig,
      restartGateway: async () => {},
      graphqlFetch: vi.fn().mockRejectedValue(new Error("Requires active RivonClaw AI subscription")),
      proxyFetch: vi.fn() as any,
      stateDir: "/tmp/rivonclaw-llm-manager-test",
      getLastSystemProxy: () => null,
    });

    await rootStore.llmManager.syncCloud({
      userId: "u1",
      email: "test@example.com",
      name: "Test",
      createdAt: "2026-01-01T00:00:00Z",
      enrolledModules: [],
      entitlementKeys: [],
      defaultRunProfileId: null,
    });

    expect(keys.map((k) => k.id)).toEqual(["key-kimi"]);
    expect(keys[0].isDefault).toBe(true);
    expect(await mockSecretStore.get("provider-key-cloud-rivonclaw-pro")).toBeNull();
    expect(storage.settings.set).toHaveBeenCalledWith("llm-provider", "kimi");
    expect(syncActiveKeyMock).toHaveBeenCalledWith("kimi", storage, mockSecretStore);
    expect(syncActiveKeyMock).toHaveBeenCalledWith("rivonclaw-pro", storage, mockSecretStore);
    expect(writeDefaultModelToConfig).toHaveBeenCalledWith("kimi", "moonshot-v1-8k");
    expect(writeFullGatewayConfig).toHaveBeenCalled();
  });

  it("does not overwrite customer-service scope model overrides on global default activation", async () => {
    const rpcRequest = vi.fn().mockResolvedValue(true);
    const writeDefaultModelToConfig = vi.fn();

    let keys: ProviderKeyEntry[] = [
      {
        id: "key-kimi",
        provider: "kimi",
        label: "Kimi",
        model: "moonshot-v1-8k",
        isDefault: true,
        authType: "api_key",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "key-pro",
        provider: "rivonclaw-pro",
        label: "RivonClaw AI",
        model: "gpt-5.4",
        isDefault: false,
        authType: "custom",
        baseUrl: "https://example.test/llm/v1",
        customProtocol: "openai",
        customModelsJson: JSON.stringify([{ id: "gpt-5.4" }]),
        createdAt: "",
        updatedAt: "",
      },
    ];
    const storage = {
      providerKeys: {
        getActive: () => keys.find((k) => k.isDefault),
        getById: (id: string) => keys.find((k) => k.id === id),
        getAll: () => keys,
        setDefault: (id: string) => {
          keys = keys.map((k) => ({ ...k, isDefault: k.id === id }));
        },
      },
      settings: {
        set: vi.fn(),
        get: vi.fn(),
      },
    };
    rootStore.loadProviderKeys(await allKeysToMstSnapshots(keys, mockSecretStore as any));
    rootStore.ingestGraphQLResponse({
      shops: [{
        id: "shop-cs-override",
        platform: "TIKTOK_SHOP",
        platformShopId: "platform-shop-cs-override",
        shopName: "CS Override Shop",
        services: {
          customerService: {
            enabled: true,
            csProviderOverride: "zhipu",
            csModelOverride: "glm-5",
          },
        },
      }],
    });

    initLLMProviderManagerEnv({
      storage: storage as any,
      secretStore: mockSecretStore as any,
      getRpcClient: () => ({ request: rpcRequest }) as any,
      toMstSnapshot,
      allKeysToMstSnapshots,
      syncActiveKey: async () => {},
      syncAllAuthProfiles: async () => {},
      writeProxyRouterConfig: async () => {},
      writeDefaultModelToConfig,
      writeFullGatewayConfig: async () => {},
      restartGateway: async () => {},
      proxyFetch: globalThis.fetch,
      stateDir: "/tmp/rivonclaw-llm-manager-test",
      getLastSystemProxy: () => null,
    });

    await rootStore.llmManager.applyModelForSession("agent:main:cs:tiktok:conv-1", {
      type: ScopeType.CS_SESSION,
      shopId: "shop-cs-override",
    });
    expect(rpcRequest).toHaveBeenCalledWith("sessions.patch", {
      key: "agent:main:cs:tiktok:conv-1",
      model: "zhipu/glm-5",
    });
    expect(rootStore.llmManager.getSessionModelFact("agent:main:cs:tiktok:conv-1")).toMatchObject({
      mode: "scope",
      provider: "zhipu",
      model: "glm-5",
    });

    rpcRequest.mockClear();

    await rootStore.llmManager.activateProvider("key-pro");

    expect(writeDefaultModelToConfig).toHaveBeenCalledWith("rivonclaw-pro", "gpt-5.4");
    expect(rpcRequest).not.toHaveBeenCalledWith("sessions.patch", {
      key: "agent:main:cs:tiktok:conv-1",
      model: "rivonclaw-pro/gpt-5.4",
    });
  });
});
