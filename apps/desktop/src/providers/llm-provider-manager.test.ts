import { describe, it, expect, afterEach, vi } from "vitest";
import type { ProviderKeyEntry } from "@rivonclaw/core";
import { initLLMProviderManagerEnv, rootStore } from "../app/store/desktop-store.js";
import { allKeysToMstSnapshots, toMstSnapshot } from "./provider-key-utils.js";

const secretMap = new Map<string, string>();
const mockSecretStore = {
  get: async (key: string) => secretMap.get(key) ?? null,
  set: async (key: string, value: string) => { secretMap.set(key, value); },
  delete: async (key: string) => { secretMap.delete(key); },
};

afterEach(() => {
  rootStore.loadProviderKeys([]);
  secretMap.clear();
  vi.restoreAllMocks();
});

describe("LLMProviderManager", () => {
  it("updates gateway default and resets default-following sessions when the active key model changes", async () => {
    const rpcRequest = vi.fn().mockResolvedValue(true);
    const writeDefaultModelToConfig = vi.fn();

    let entry: ProviderKeyEntry = {
      id: "key-default",
      provider: "rivonclaw-pro",
      label: "RivonClaw Pro",
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
      restartGateway: async () => {},
      proxyFetch: globalThis.fetch,
      stateDir: "/tmp/rivonclaw-llm-manager-test",
      getLastSystemProxy: () => null,
    });

    rootStore.llmManager.trackSessionActivity("chat-session-1");

    await rootStore.llmManager.updateKey("key-default", { model: "gpt-5.4" });

    expect(entry.model).toBe("gpt-5.4");
    expect(writeDefaultModelToConfig).toHaveBeenCalledWith("rivonclaw-pro", "gpt-5.4");
    expect(rpcRequest).toHaveBeenCalledWith("sessions.patch", {
      key: "chat-session-1",
      model: null,
    });
  });
});
