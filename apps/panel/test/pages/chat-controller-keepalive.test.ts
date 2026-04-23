// @vitest-environment node

import { observable, runInAction } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("ChatGatewayController keepalive gating", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("waits for sidecar readiness before enabling webchat keepalive", async () => {
    const runtimeStatusStore = observable({
      appSettings: {
        chatTabOrder: "",
        setChatTabOrder: vi.fn().mockResolvedValue(undefined),
      },
      openClawConnector: {
        rpcConnected: true,
        sidecarState: "probing",
      },
    });

    const fetchGatewayInfo = vi.fn().mockResolvedValue({
      wsUrl: "ws://127.0.0.1:59457",
      token: "test-token",
    });
    const fetchChatSessions = vi.fn().mockResolvedValue([]);
    const updateChatSession = vi.fn().mockResolvedValue(undefined);
    const setRunProfileForScope = vi.fn().mockResolvedValue(undefined);
    const trackEvent = vi.fn();
    const saveImages = vi.fn().mockResolvedValue(undefined);
    const clearImages = vi.fn().mockResolvedValue(undefined);
    const restoreImages = vi.fn().mockImplementation(async (_sessionKey: string, messages: unknown) => messages);

    const setKeepaliveEnabled = vi.fn();
    const request = vi.fn().mockImplementation(async (method: string) => {
      if (method === "agent.identity.get") return { name: "Rivon" };
      if (method === "sessions.list") return { sessions: [] };
      if (method === "chat.history") return { messages: [] };
      return {};
    });
    const stop = vi.fn();
    const connectBridge = vi.fn();
    const disconnectBridge = vi.fn();
    const clientOptions: Array<Record<string, unknown>> = [];

    vi.doMock("../../src/api/index.js", () => ({
      fetchGatewayInfo,
      trackEvent,
    }));
    vi.doMock("../../src/api/chat-sessions.js", () => ({
      fetchChatSessions,
      updateChatSession,
    }));
    vi.doMock("../../src/api/tool-registry.js", () => ({
      setRunProfileForScope,
    }));
    vi.doMock("../../src/store/runtime-status-store.js", () => ({
      runtimeStatusStore,
    }));
    vi.doMock("../../src/pages/chat/chat-event-bridge.js", () => ({
      ChatEventBridge: class {
        connect(): void {
          connectBridge();
        }

        disconnect(): void {
          disconnectBridge();
        }
      },
    }));
    vi.doMock("../../src/pages/chat/image-cache.js", () => ({
      saveImages,
      clearImages,
      restoreImages,
    }));
    vi.doMock("../../src/lib/gateway-client.js", () => ({
      GatewayChatClient: class {
        constructor(private opts: Record<string, unknown>) {
          clientOptions.push(opts);
        }

        start(): void {
          const onConnected = this.opts.onConnected as ((hello: unknown) => void) | undefined;
          onConnected?.({
            type: "hello-ok",
            protocol: 3,
            snapshot: {
              sessionDefaults: {
                mainSessionKey: "agent:main",
              },
            },
          });
        }

        stop(): void {
          stop();
        }

        setKeepaliveEnabled(enabled: boolean): void {
          setKeepaliveEnabled(enabled);
        }

        request<T = unknown>(method: string): Promise<T> {
          return request(method) as Promise<T>;
        }
      },
    }));

    const [{ ChatGatewayController }, { createChatStore }] = await Promise.all([
      import("../../src/pages/chat/controllers/ChatGatewayController.js"),
      import("../../src/pages/chat/store/chat-store.js"),
    ]);

    const store = createChatStore();
    const controller = new ChatGatewayController(store);

    await controller.start();

    expect(clientOptions[0]?.autoStartKeepalive).toBe(false);
    expect(setKeepaliveEnabled).not.toHaveBeenCalledWith(true);

    runInAction(() => {
      runtimeStatusStore.openClawConnector.sidecarState = "ready";
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(setKeepaliveEnabled).toHaveBeenCalledWith(true);

    controller.stop();
    expect(disconnectBridge).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });
});
