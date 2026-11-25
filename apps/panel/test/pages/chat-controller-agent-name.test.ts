// @vitest-environment node

import { observable } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The status bar reads `store.agentName`. With no configured name the gateway
 * answers `agent.identity.get` with its built-in English placeholder
 * ("Assistant", nameSource "default"), which must not reach a localized UI.
 */
async function agentNameAfterStart(identity: Record<string, unknown>): Promise<string | null> {
  const runtimeStatusStore = observable({
    appSettings: { chatTabOrder: "", setChatTabOrder: vi.fn().mockResolvedValue(undefined) },
    openClawConnector: { rpcConnected: true, sidecarState: "ready" },
  });
  vi.doMock("../../src/api/index.js", () => ({
    fetchGatewayInfo: vi.fn().mockResolvedValue({ wsUrl: "ws://127.0.0.1:59457", token: "test-token" }),
    trackEvent: vi.fn(),
  }));
  vi.doMock("../../src/api/chat-sessions.js", () => ({
    fetchChatSessions: vi.fn().mockResolvedValue([]),
    updateChatSession: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock("../../src/api/tool-registry.js", () => ({
    setRunProfileForScope: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock("../../src/store/runtime-status-store.js", () => ({ runtimeStatusStore }));
  vi.doMock("../../src/pages/chat/chat-event-bridge.js", () => ({
    ChatEventBridge: class {
      connect(): void {}
      disconnect(): void {}
    },
  }));
  vi.doMock("../../src/pages/chat/image-cache.js", () => ({
    saveImages: vi.fn().mockResolvedValue(undefined),
    clearImages: vi.fn().mockResolvedValue(undefined),
    restoreImages: vi.fn().mockImplementation(async (_key: string, messages: unknown) => messages),
  }));
  vi.doMock("../../src/lib/gateway-client.js", () => ({
    GatewayChatClient: class {
      constructor(private opts: Record<string, unknown>) {}
      start(): void {
        const onConnected = this.opts.onConnected as ((hello: unknown) => void) | undefined;
        onConnected?.({
          type: "hello-ok",
          protocol: 3,
          snapshot: { sessionDefaults: { mainSessionKey: "agent:main" } },
        });
      }
      stop(): void {}
      setKeepaliveEnabled(): void {}
      request<T = unknown>(method: string): Promise<T> {
        if (method === "agent.identity.get") return Promise.resolve(identity as T);
        if (method === "chat.history") return Promise.resolve({ messages: [] } as T);
        return Promise.resolve({} as T);
      }
    },
  }));

  const [{ ChatGatewayController }, { createChatStore }] = await Promise.all([
    import("../../src/pages/chat/controllers/ChatGatewayController.js"),
    import("../../src/pages/chat/store/chat-store.js"),
  ]);
  const store = createChatStore();
  store.setAgentName("stale name from another session");
  const controller = new ChatGatewayController(store);
  await controller.start();
  await vi.waitFor(() => expect(store.agentName).not.toBe("stale name from another session"));
  controller.stop();
  return store.agentName;
}

describe("ChatGatewayController agent name", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows no name when the gateway answers its default placeholder", async () => {
    expect(await agentNameAfterStart({ name: "Assistant", nameSource: "default" })).toBeNull();
  });

  it("shows a configured agent name", async () => {
    expect(await agentNameAfterStart({ name: "Rivon", nameSource: "agent" })).toBe("Rivon");
  });
});
