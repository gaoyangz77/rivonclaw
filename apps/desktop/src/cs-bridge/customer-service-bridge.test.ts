import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CSNewMessageFrame } from "@rivonclaw/core";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("ws", () => ({ WebSocket: vi.fn() }));
vi.mock("@rivonclaw/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const mockRpcRequest = vi.fn();
const { mockGetRpcClient } = vi.hoisted(() => ({
  mockGetRpcClient: vi.fn(),
}));
vi.mock("../gateway/rpc-client-ref.js", () => ({
  getRpcClient: mockGetRpcClient,
}));

const mockGraphqlFetch = vi.fn();
const { mockGetAuthSession } = vi.hoisted(() => ({
  mockGetAuthSession: vi.fn(),
}));
vi.mock("../auth/auth-session-ref.js", () => ({
  getAuthSession: mockGetAuthSession,
}));

vi.mock("../gateway/provider-keys-ref.js", () => ({
  getProviderKeysStore: () => ({ getAll: () => [] }),
}));

vi.mock("../gateway/vendor-dir-ref.js", () => ({
  getVendorDir: () => "/fake/vendor",
}));

vi.mock("@rivonclaw/gateway", () => ({
  readFullModelCatalog: async () => ({}),
}));

const mockGetAllRunProfiles = vi.fn();
const mockSetSessionRunProfile = vi.fn();
vi.mock("../utils/tool-capability-resolver.js", () => ({
  toolCapabilityResolver: {
    getAllRunProfiles: (...args: unknown[]) => mockGetAllRunProfiles(...args),
    setSessionRunProfile: (...args: unknown[]) => mockSetSessionRunProfile(...args),
  },
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import { CustomerServiceBridge, type CSShopContext } from "./customer-service-bridge.js";
import { entityCache } from "../entity-cache.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createBridge(overrides?: Partial<{ defaultRunProfileId: string }>): CustomerServiceBridge {
  return new CustomerServiceBridge({
    relayUrl: "ws://localhost:3001",
    gatewayId: "test-gateway",
    defaultRunProfileId: overrides?.defaultRunProfileId ?? "TIKTOK_CUSTOMER_SERVICE",
  });
}

const defaultShop: CSShopContext = {
  objectId: "mongo-id-123",
  platformShopId: "tiktok-shop-456",
  systemPrompt: "You are a CS assistant.",
  runProfileId: "TIKTOK_CUSTOMER_SERVICE",
};

function createFrame(overrides?: Partial<CSNewMessageFrame>): CSNewMessageFrame {
  return {
    type: "cs_tiktok_new_message",
    shopId: "tiktok-shop-456",
    conversationId: "conv-789",
    buyerUserId: "buyer-001",
    messageId: "msg-001",
    messageType: "TEXT",
    content: JSON.stringify({ content: "Hello" }),
    senderRole: "BUYER",
    senderId: "buyer-001",
    createTime: 1234567890,
    isVisible: true,
    ...overrides,
  };
}

/** Invoke the private onNewMessage method. */
async function triggerMessage(
  bridge: CustomerServiceBridge,
  frame: CSNewMessageFrame,
): Promise<void> {
  await (bridge as any).onNewMessage(frame);
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRpcClient.mockReturnValue({ request: mockRpcRequest });
  mockRpcRequest.mockResolvedValue({ ok: true });
  mockGraphqlFetch.mockResolvedValue({ ecommerceSendMessage: { code: 0 } });
  mockGetAuthSession.mockReturnValue({
    getAccessToken: () => "test-token",
    graphqlFetch: mockGraphqlFetch,
  });
  // Default: RunProfile found in cache
  mockGetAllRunProfiles.mockReturnValue([
    { id: "TIKTOK_CUSTOMER_SERVICE", name: "TikTok CS", userId: "", surfaceId: "Default", selectedToolIds: ["TOOL_A", "TOOL_B"] },
    { id: "FALLBACK_CS", name: "Fallback CS", userId: "", surfaceId: "Default", selectedToolIds: ["TOOL_C"] },
  ]);
  // Reset entity cache
  entityCache.setState({ runProfiles: [], surfaces: [], toolSpecs: [], shops: [] });
});

// ─── 1. Shop context management ─────────────────────────────────────────────

describe("shop context management", () => {
  it("setShopContext stores context keyed by platformShopId", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    // Prove context is stored: onNewMessage should find it and proceed
    await triggerMessage(bridge, createFrame());
    expect(mockRpcRequest).toHaveBeenCalled();
  });

  it("removeShopContext removes the stored context", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    bridge.removeShopContext("tiktok-shop-456");

    await triggerMessage(bridge, createFrame());
    // Should drop: no RPC calls, no profile set
    expect(mockRpcRequest).not.toHaveBeenCalled();
    expect(mockSetSessionRunProfile).not.toHaveBeenCalled();
  });

  it("drops message when shop context not found", async () => {
    const bridge = createBridge();
    // No shop context set

    await triggerMessage(bridge, createFrame());
    expect(mockRpcRequest).not.toHaveBeenCalled();
    expect(mockSetSessionRunProfile).not.toHaveBeenCalled();
  });

  it("proceeds when shop context is found", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());
    // Session registration + agent dispatch = 2 RPC calls
    expect(mockRpcRequest).toHaveBeenCalledTimes(2);
  });
});

// ─── 2. Session key construction ────────────────────────────────────────────

describe("session key construction", () => {
  it("cs_register_session receives scopeKey (agent:main:cs:tiktok:{conversationId})", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ conversationId: "conv-ABC" }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "cs_register_session",
      expect.objectContaining({
        sessionKey: "agent:main:cs:tiktok:conv-ABC",
      }),
    );
  });

  it("agent RPC receives dispatchKey (cs:tiktok:{conversationId})", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ conversationId: "conv-ABC" }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({
        sessionKey: "cs:tiktok:conv-ABC",
      }),
    );
  });

  it("setSessionRunProfile receives scopeKey", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ conversationId: "conv-XYZ" }));

    expect(mockSetSessionRunProfile).toHaveBeenCalledWith(
      "agent:main:cs:tiktok:conv-XYZ",
      { selectedToolIds: ["TOOL_A", "TOOL_B"], surfaceId: "Default" },
      "TIKTOK_CUSTOMER_SERVICE",
    );
  });

  it("uses shop.platform for session keys when provided", async () => {
    const bridge = createBridge();
    bridge.setShopContext({ ...defaultShop, platform: "shopee" });

    await triggerMessage(bridge, createFrame({ conversationId: "conv-PLAT" }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "cs_register_session",
      expect.objectContaining({
        sessionKey: "agent:main:cs:shopee:conv-PLAT",
      }),
    );
    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({
        sessionKey: "cs:shopee:conv-PLAT",
        idempotencyKey: "shopee:msg-001",
      }),
    );
  });

  it("defaults platform to 'tiktok' when shop.platform is undefined", async () => {
    const bridge = createBridge();
    // defaultShop has no platform field
    bridge.setShopContext({ ...defaultShop, platform: undefined });

    await triggerMessage(bridge, createFrame({ conversationId: "conv-DEF" }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "cs_register_session",
      expect.objectContaining({
        sessionKey: "agent:main:cs:tiktok:conv-DEF",
      }),
    );
  });
});

// ─── 3. Message content parsing ─────────────────────────────────────────────

describe("message content parsing", () => {
  it("TEXT message: extracts JSON content field", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({
      messageType: "TEXT",
      content: JSON.stringify({ content: "你好" }),
    }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({ message: "你好" }),
    );
  });

  it("TEXT message: extracts JSON text field as fallback", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({
      messageType: "TEXT",
      content: JSON.stringify({ text: "Fallback text" }),
    }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({ message: "Fallback text" }),
    );
  });

  it("TEXT message: raw string fallback when content is not JSON", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({
      messageType: "TEXT",
      content: "plain text message",
    }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({ message: "plain text message" }),
    );
  });

  it("IMAGE message produces [Image received]", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({
      messageType: "IMAGE",
      content: "binary-data",
    }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({ message: "[Image received]" }),
    );
  });

  it("ORDER_CARD message with orderId", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({
      messageType: "ORDER_CARD",
      content: JSON.stringify({ orderId: "ORD-12345" }),
    }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({ message: "[Order card received] Order ID: ORD-12345" }),
    );
  });

  it("ORDER_CARD message with order_id (snake_case)", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({
      messageType: "ORDER_CARD",
      content: JSON.stringify({ order_id: "ORD-99999" }),
    }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({ message: "[Order card received] Order ID: ORD-99999" }),
    );
  });

  it("ORDER_CARD message without orderId falls back to generic text", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({
      messageType: "ORDER_CARD",
      content: JSON.stringify({ something: "else" }),
    }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({ message: "[Order card received]" }),
    );
  });

  it("unknown message type uses raw messageType name", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({
      messageType: "VIDEO",
      content: "video-data",
    }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({ message: "[VIDEO message received]" }),
    );
  });
});

// ─── 4. CS RunProfile setup ─────────────────────────────────────────────────

describe("CS RunProfile setup", () => {
  it("calls setSessionRunProfile with scopeKey, profile data, and runProfileId", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expect(mockSetSessionRunProfile).toHaveBeenCalledWith(
      "agent:main:cs:tiktok:conv-789",
      { selectedToolIds: ["TOOL_A", "TOOL_B"], surfaceId: "Default" },
      "TIKTOK_CUSTOMER_SERVICE",
    );
  });

  it("drops message when RunProfile not found in cache", async () => {
    mockGetAllRunProfiles.mockReturnValue([]); // no profiles
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "cs_register_session",
      expect.anything(),
    );
    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
  });

  it("falls back to defaultRunProfileId when shop has no runProfileId", async () => {
    const bridge = createBridge({ defaultRunProfileId: "FALLBACK_CS" });
    bridge.setShopContext({ ...defaultShop, runProfileId: undefined });

    await triggerMessage(bridge, createFrame());

    expect(mockSetSessionRunProfile).toHaveBeenCalledWith(
      expect.any(String),
      { selectedToolIds: ["TOOL_C"], surfaceId: "Default" },
      "FALLBACK_CS",
    );
  });

  it("drops message when no runProfileId and no defaultRunProfileId", async () => {
    const bridge = new CustomerServiceBridge({
      relayUrl: "ws://localhost:3001",
      gatewayId: "test-gateway",
      // no defaultRunProfileId
    });
    bridge.setShopContext({ ...defaultShop, runProfileId: undefined });

    await triggerMessage(bridge, createFrame());

    // cs_register_session is called (step 4), but RunProfile set and agent dispatch are not
    expect(mockRpcRequest).toHaveBeenCalledWith("cs_register_session", expect.anything());
    expect(mockSetSessionRunProfile).not.toHaveBeenCalled();
    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
  });
});

// ─── 5. Session registration ────────────────────────────────────────────────

describe("session registration", () => {
  it("cs_register_session called with correct scopeKey and csContext", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({
      conversationId: "conv-100",
      buyerUserId: "buyer-200",
    }));

    expect(mockRpcRequest).toHaveBeenCalledWith("cs_register_session", {
      sessionKey: "agent:main:cs:tiktok:conv-100",
      csContext: {
        shopId: "mongo-id-123",
        conversationId: "conv-100",
        buyerUserId: "buyer-200",
        orderId: undefined,
      },
    });
  });

  it("csContext contains shop.objectId, not platform ID", async () => {
    const bridge = createBridge();
    bridge.setShopContext({
      objectId: "actual-mongo-object-id",
      platformShopId: "platform-id-999",
      systemPrompt: "prompt",
    });

    await triggerMessage(bridge, createFrame({ shopId: "platform-id-999" }));

    const registerCall = mockRpcRequest.mock.calls.find(
      (c: any[]) => c[0] === "cs_register_session",
    );
    expect(registerCall).toBeDefined();
    expect(registerCall![1].csContext.shopId).toBe("actual-mongo-object-id");
  });

  it("csContext includes orderId when frame has one", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ orderId: "order-555" }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "cs_register_session",
      expect.objectContaining({
        csContext: expect.objectContaining({ orderId: "order-555" }),
      }),
    );
  });

  it("if registration fails, message is dropped (no RunProfile set, no agent dispatch)", async () => {
    mockRpcRequest.mockRejectedValueOnce(new Error("registration failed"));
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    // Only the failed register call; no agent call
    expect(mockRpcRequest).toHaveBeenCalledTimes(1);
    expect(mockRpcRequest).toHaveBeenCalledWith("cs_register_session", expect.anything());
    // No RunProfile set should have been called
    expect(mockSetSessionRunProfile).not.toHaveBeenCalled();
  });
});

// ─── 6. Agent dispatch ──────────────────────────────────────────────────────

describe("agent dispatch", () => {
  it("agent RPC called with dispatchKey as sessionKey", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ conversationId: "conv-dispatch" }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({
        sessionKey: "cs:tiktok:conv-dispatch",
      }),
    );
  });

  it("extraSystemPrompt includes shop.systemPrompt and session info", async () => {
    const bridge = createBridge();
    bridge.setShopContext({
      ...defaultShop,
      systemPrompt: "Custom shop prompt for testing.",
    });

    await triggerMessage(bridge, createFrame({
      conversationId: "conv-prompt",
      buyerUserId: "buyer-prompt",
    }));

    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall).toBeDefined();
    const prompt = agentCall![1].extraSystemPrompt as string;
    expect(prompt).toContain("Custom shop prompt for testing.");
    expect(prompt).toContain("conv-prompt");
    expect(prompt).toContain("buyer-prompt");
    expect(prompt).toContain("mongo-id-123");
  });

  it("extraSystemPrompt includes orderId when present", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ orderId: "order-in-prompt" }));

    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall![1].extraSystemPrompt).toContain("order-in-prompt");
  });

  it("extraSystemPrompt omits Order ID line when orderId is absent", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ orderId: undefined }));

    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall![1].extraSystemPrompt).not.toContain("Order ID");
  });

  it("idempotencyKey = {platform}:{messageId}", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ messageId: "msg-unique-42" }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({
        idempotencyKey: "tiktok:msg-unique-42",
      }),
    );
  });

  it("if dispatch fails, error is logged but bridge continues running", async () => {
    // First call (register) succeeds, second call (agent) fails
    mockRpcRequest
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error("agent dispatch failed"));

    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    // Should not throw
    await triggerMessage(bridge, createFrame({ messageId: "msg-fail" }));

    // Both calls were attempted
    expect(mockRpcRequest).toHaveBeenCalledTimes(2);
    expect(mockRpcRequest).toHaveBeenCalledWith("cs_register_session", expect.anything());
    expect(mockRpcRequest).toHaveBeenCalledWith("agent", expect.anything());
  });
});

// ─── 7. Error scenarios ─────────────────────────────────────────────────────

describe("error scenarios", () => {
  it("no RPC client → message dropped entirely", async () => {
    mockGetRpcClient.mockReturnValue(null);
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expect(mockRpcRequest).not.toHaveBeenCalled();
    expect(mockSetSessionRunProfile).not.toHaveBeenCalled();
  });

  it("shop context not found → message dropped with no further calls", async () => {
    const bridge = createBridge();
    // Do NOT set any shop context

    await triggerMessage(bridge, createFrame({ shopId: "nonexistent-shop" }));

    expect(mockRpcRequest).not.toHaveBeenCalled();
    expect(mockSetSessionRunProfile).not.toHaveBeenCalled();
  });

  it("session registration fails → RunProfile set and agent dispatch skipped", async () => {
    mockRpcRequest.mockRejectedValueOnce(new Error("session reg failed"));
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expect(mockRpcRequest).toHaveBeenCalledTimes(1);
    expect(mockSetSessionRunProfile).not.toHaveBeenCalled();
  });

  it("RunProfile not found → agent dispatch skipped", async () => {
    mockGetAllRunProfiles.mockReturnValue([]); // empty profiles
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    // register_session called, agent NOT called
    expect(mockRpcRequest).toHaveBeenCalledTimes(1);
    expect(mockRpcRequest).toHaveBeenCalledWith("cs_register_session", expect.anything());
  });

  it("agent dispatch fails → bridge does not throw (continues running)", async () => {
    mockRpcRequest
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error("dispatch failure"));
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    // Must not throw
    await expect(triggerMessage(bridge, createFrame())).resolves.toBeUndefined();
  });

  it("multiple shops: messages route to correct shop context", async () => {
    const bridge = createBridge();
    const shopA: CSShopContext = {
      objectId: "mongo-A",
      platformShopId: "platform-A",
      systemPrompt: "Prompt A",
    };
    const shopB: CSShopContext = {
      objectId: "mongo-B",
      platformShopId: "platform-B",
      systemPrompt: "Prompt B",
    };
    bridge.setShopContext(shopA);
    bridge.setShopContext(shopB);

    await triggerMessage(bridge, createFrame({ shopId: "platform-B" }));

    const registerCall = mockRpcRequest.mock.calls.find(
      (c: any[]) => c[0] === "cs_register_session",
    );
    expect(registerCall![1].csContext.shopId).toBe("mongo-B");

    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall![1].extraSystemPrompt).toContain("Prompt B");
  });
});

// ── 8. Reactive entity cache sync ──────────────────────────────────────────

describe("reactive entity cache sync", () => {
  it("syncFromCache picks up CS-enabled shops bound to this device", () => {
    const bridge = createBridge();

    entityCache.setState({
      ...entityCache.getState(),
      shops: [
        {
          id: "shop-1",
          platform: "TIKTOK_SHOP",
          platformShopId: "ps-1",
          shopName: "My Shop",
          services: {
            customerService: {
              enabled: true,
              csDeviceId: "test-gateway",
              assembledPrompt: "You are a CS agent.",
              csModelOverride: null,
              runProfileId: "rp-1",
            },
          },
        },
      ],
    });

    bridge.syncFromCache();

    // Verify the shop context is set by triggering a message
    const frame = createFrame({ shopId: "ps-1" });
    return triggerMessage(bridge, frame).then(() => {
      expect(mockRpcRequest).toHaveBeenCalledWith(
        "cs_register_session",
        expect.objectContaining({
          csContext: expect.objectContaining({ shopId: "shop-1" }),
        }),
      );
    });
  });

  it("syncFromCache skips shops not bound to this device", () => {
    const bridge = createBridge();

    entityCache.setState({
      ...entityCache.getState(),
      shops: [
        {
          id: "shop-1",
          platform: "TIKTOK_SHOP",
          platformShopId: "ps-1",
          shopName: "Other Device Shop",
          services: {
            customerService: {
              enabled: true,
              csDeviceId: "other-device",
              assembledPrompt: "prompt",
            },
          },
        },
      ],
    });

    bridge.syncFromCache();

    // Should not have context for this shop
    return triggerMessage(bridge, createFrame({ shopId: "ps-1" })).then(() => {
      expect(mockRpcRequest).not.toHaveBeenCalled();
    });
  });

  it("syncFromCache skips shops with CS disabled", () => {
    const bridge = createBridge();

    entityCache.setState({
      ...entityCache.getState(),
      shops: [
        {
          id: "shop-1",
          platform: "TIKTOK_SHOP",
          platformShopId: "ps-1",
          shopName: "Disabled Shop",
          services: {
            customerService: {
              enabled: false,
              csDeviceId: "test-gateway",
              assembledPrompt: "prompt",
            },
          },
        },
      ],
    });

    bridge.syncFromCache();

    return triggerMessage(bridge, createFrame({ shopId: "ps-1" })).then(() => {
      expect(mockRpcRequest).not.toHaveBeenCalled();
    });
  });

  it("syncFromCache skips shops without assembledPrompt", () => {
    const bridge = createBridge();

    entityCache.setState({
      ...entityCache.getState(),
      shops: [
        {
          id: "shop-1",
          platform: "TIKTOK_SHOP",
          platformShopId: "ps-1",
          shopName: "No Prompt Shop",
          services: {
            customerService: {
              enabled: true,
              csDeviceId: "test-gateway",
              assembledPrompt: null,
            },
          },
        },
      ],
    });

    bridge.syncFromCache();

    return triggerMessage(bridge, createFrame({ shopId: "ps-1" })).then(() => {
      expect(mockRpcRequest).not.toHaveBeenCalled();
    });
  });

  it("syncFromCache removes shops that are no longer in cache", () => {
    const bridge = createBridge();

    // First: add a shop context manually
    bridge.setShopContext({
      objectId: "shop-1",
      platformShopId: "ps-1",
      platform: "tiktok",
      systemPrompt: "Old prompt",
    });

    // Then: sync from empty cache (shop was removed)
    entityCache.setState({ ...entityCache.getState(), shops: [] });
    bridge.syncFromCache();

    // Should not have context anymore
    return triggerMessage(bridge, createFrame({ shopId: "ps-1" })).then(() => {
      expect(mockRpcRequest).not.toHaveBeenCalled();
    });
  });

  it("syncFromCache updates existing shop context when data changes", () => {
    const bridge = createBridge();

    // Initial sync
    entityCache.setState({
      ...entityCache.getState(),
      shops: [
        {
          id: "shop-1",
          platform: "TIKTOK_SHOP",
          platformShopId: "ps-1",
          shopName: "Shop",
          services: {
            customerService: {
              enabled: true,
              csDeviceId: "test-gateway",
              assembledPrompt: "Old prompt",
              runProfileId: null,
              csModelOverride: null,
            },
          },
        },
      ],
    });
    bridge.syncFromCache();

    // Update: change assembledPrompt
    entityCache.setState({
      ...entityCache.getState(),
      shops: [
        {
          id: "shop-1",
          platform: "TIKTOK_SHOP",
          platformShopId: "ps-1",
          shopName: "Shop",
          services: {
            customerService: {
              enabled: true,
              csDeviceId: "test-gateway",
              assembledPrompt: "Updated prompt",
              runProfileId: null,
              csModelOverride: null,
            },
          },
        },
      ],
    });
    bridge.syncFromCache();

    // Trigger message and verify the updated prompt is used
    return triggerMessage(bridge, createFrame({ shopId: "ps-1" })).then(() => {
      const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
      expect(agentCall![1].extraSystemPrompt).toContain("Updated prompt");
    });
  });

  it("syncFromCache normalizes platform name from enum", () => {
    const bridge = createBridge();

    entityCache.setState({
      ...entityCache.getState(),
      shops: [
        {
          id: "shop-1",
          platform: "TIKTOK_SHOP",
          platformShopId: "ps-1",
          shopName: "Shop",
          services: {
            customerService: {
              enabled: true,
              csDeviceId: "test-gateway",
              assembledPrompt: "prompt",
            },
          },
        },
      ],
    });
    bridge.syncFromCache();

    return triggerMessage(bridge, createFrame({ shopId: "ps-1" })).then(() => {
      expect(mockRpcRequest).toHaveBeenCalledWith(
        "cs_register_session",
        expect.objectContaining({
          sessionKey: "agent:main:cs:tiktok:conv-789",
        }),
      );
    });
  });

  it("syncFromCache handles multiple shops with mixed eligibility", () => {
    const bridge = createBridge();

    entityCache.setState({
      ...entityCache.getState(),
      shops: [
        {
          id: "shop-1", platform: "TIKTOK_SHOP", platformShopId: "ps-1", shopName: "Eligible",
          services: { customerService: { enabled: true, csDeviceId: "test-gateway", assembledPrompt: "prompt-1" } },
        },
        {
          id: "shop-2", platform: "TIKTOK_SHOP", platformShopId: "ps-2", shopName: "Disabled",
          services: { customerService: { enabled: false, csDeviceId: "test-gateway", assembledPrompt: "prompt-2" } },
        },
        {
          id: "shop-3", platform: "SHOPEE_STORE", platformShopId: "ps-3", shopName: "Other Device",
          services: { customerService: { enabled: true, csDeviceId: "other-device", assembledPrompt: "prompt-3" } },
        },
        {
          id: "shop-4", platform: "TIKTOK_SHOP", platformShopId: "ps-4", shopName: "Also Eligible",
          services: { customerService: { enabled: true, csDeviceId: "test-gateway", assembledPrompt: "prompt-4" } },
        },
      ],
    });
    bridge.syncFromCache();

    // Only shop-1 and shop-4 should be active. Verify shop-1 works:
    return triggerMessage(bridge, createFrame({ shopId: "ps-1" })).then(async () => {
      expect(mockRpcRequest).toHaveBeenCalledWith(
        "cs_register_session",
        expect.objectContaining({ csContext: expect.objectContaining({ shopId: "shop-1" }) }),
      );

      // Reset and verify shop-4 works:
      vi.clearAllMocks();
      mockGetRpcClient.mockReturnValue({ request: mockRpcRequest });
      mockRpcRequest.mockResolvedValue({ ok: true });
      mockGetAllRunProfiles.mockReturnValue([
        { id: "TIKTOK_CUSTOMER_SERVICE", name: "TikTok CS", userId: "", surfaceId: "Default", selectedToolIds: ["TOOL_A", "TOOL_B"] },
      ]);

      await triggerMessage(bridge, createFrame({ shopId: "ps-4" }));
      expect(mockRpcRequest).toHaveBeenCalledWith(
        "cs_register_session",
        expect.objectContaining({ csContext: expect.objectContaining({ shopId: "shop-4" }) }),
      );
    });
  });
});
