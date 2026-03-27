import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CSTikTokNewMessageFrame } from "@rivonclaw/core";

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

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Import after mocks ─────────────────────────────────────────────────────

import { CustomerServiceBridge, type CSShopContext } from "./customer-service-bridge.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createBridge(): CustomerServiceBridge {
  return new CustomerServiceBridge({
    relayUrl: "ws://localhost:3001",
    gatewayId: "test-gateway",
    getAuthToken: () => "test-token",
  });
}

const defaultShop: CSShopContext = {
  objectId: "mongo-id-123",
  platformShopId: "tiktok-shop-456",
  systemPrompt: "You are a CS assistant.",
};

function createFrame(overrides?: Partial<CSTikTokNewMessageFrame>): CSTikTokNewMessageFrame {
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

/** Invoke the private onTikTokMessage method. */
async function triggerMessage(
  bridge: CustomerServiceBridge,
  frame: CSTikTokNewMessageFrame,
): Promise<void> {
  await (bridge as any).onTikTokMessage(frame);
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRpcClient.mockReturnValue({ request: mockRpcRequest });
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  mockRpcRequest.mockResolvedValue({ ok: true });
});

// ─── 1. Shop context management ─────────────────────────────────────────────

describe("shop context management", () => {
  it("setShopContext stores context keyed by platformShopId", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    // Prove context is stored: onTikTokMessage should find it and proceed
    await triggerMessage(bridge, createFrame());
    expect(mockRpcRequest).toHaveBeenCalled();
  });

  it("removeShopContext removes the stored context", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    bridge.removeShopContext("tiktok-shop-456");

    await triggerMessage(bridge, createFrame());
    // Should drop: no RPC calls, no fetch
    expect(mockRpcRequest).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("drops message when shop context not found", async () => {
    const bridge = createBridge();
    // No shop context set

    await triggerMessage(bridge, createFrame());
    expect(mockRpcRequest).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
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
  it("tiktok_cs_register_session receives scopeKey (agent:main:cs:tiktok:{conversationId})", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ conversationId: "conv-ABC" }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "tiktok_cs_register_session",
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

  it("RunProfile PUT receives scopeKey in the body", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ conversationId: "conv-XYZ" }));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/tools/run-profile"),
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining("agent:main:cs:tiktok:conv-XYZ"),
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
  it("PUT is called with scopeKey and tool IDs", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/tools/run-profile"),
      expect.objectContaining({ method: "PUT" }),
    );

    // Parse the body to verify structure
    const fetchCall = mockFetch.mock.calls[0]!;
    const body = JSON.parse(fetchCall[1].body);
    expect(body.scopeKey).toBe("agent:main:cs:tiktok:conv-789");
    expect(body.runProfile).toBeDefined();
    expect(body.runProfile.selectedToolIds).toEqual(expect.any(Array));
    expect(body.runProfile.selectedToolIds.length).toBeGreaterThan(0);
  });

  it("uses PANEL_BASE URL (port 3210)", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/127\.0\.0\.1:3210\/api\/tools\/run-profile$/),
      expect.anything(),
    );
  });

  it("if PUT fails, message is dropped (agent not dispatched)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    // register_session is called (before fetch), but agent dispatch is not
    expect(mockRpcRequest).toHaveBeenCalledWith(
      "tiktok_cs_register_session",
      expect.anything(),
    );
    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
  });

  it("accepts custom csToolIds override", async () => {
    const customToolIds = ["custom_tool_a", "custom_tool_b"];
    const bridge = new CustomerServiceBridge({
      relayUrl: "ws://localhost:3001",
      gatewayId: "test-gateway",
      getAuthToken: () => "test-token",
      csToolIds: customToolIds,
    });
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    const fetchCall = mockFetch.mock.calls[0]!;
    const body = JSON.parse(fetchCall[1].body);
    expect(body.runProfile.selectedToolIds).toEqual(customToolIds);
  });
});

// ─── 5. Session registration ────────────────────────────────────────────────

describe("session registration", () => {
  it("tiktok_cs_register_session called with correct scopeKey and csContext", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({
      conversationId: "conv-100",
      buyerUserId: "buyer-200",
    }));

    expect(mockRpcRequest).toHaveBeenCalledWith("tiktok_cs_register_session", {
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
      (c: any[]) => c[0] === "tiktok_cs_register_session",
    );
    expect(registerCall).toBeDefined();
    expect(registerCall![1].csContext.shopId).toBe("actual-mongo-object-id");
  });

  it("csContext includes orderId when frame has one", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ orderId: "order-555" }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "tiktok_cs_register_session",
      expect.objectContaining({
        csContext: expect.objectContaining({ orderId: "order-555" }),
      }),
    );
  });

  it("if registration fails, message is dropped (no RunProfile PUT, no agent dispatch)", async () => {
    mockRpcRequest.mockRejectedValueOnce(new Error("registration failed"));
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    // Only the failed register call; no agent call
    expect(mockRpcRequest).toHaveBeenCalledTimes(1);
    expect(mockRpcRequest).toHaveBeenCalledWith("tiktok_cs_register_session", expect.anything());
    // No fetch (RunProfile PUT) should have been called
    expect(mockFetch).not.toHaveBeenCalled();
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

  it("idempotencyKey = tiktok:{messageId}", async () => {
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
    expect(mockRpcRequest).toHaveBeenCalledWith("tiktok_cs_register_session", expect.anything());
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
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shop context not found → message dropped with no further calls", async () => {
    const bridge = createBridge();
    // Do NOT set any shop context

    await triggerMessage(bridge, createFrame({ shopId: "nonexistent-shop" }));

    expect(mockRpcRequest).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("session registration fails → RunProfile PUT and agent dispatch skipped", async () => {
    mockRpcRequest.mockRejectedValueOnce(new Error("session reg failed"));
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expect(mockRpcRequest).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("RunProfile PUT fails → agent dispatch skipped", async () => {
    mockFetch.mockRejectedValueOnce(new Error("fetch failed"));
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    // register_session called, agent NOT called
    expect(mockRpcRequest).toHaveBeenCalledTimes(1);
    expect(mockRpcRequest).toHaveBeenCalledWith("tiktok_cs_register_session", expect.anything());
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
      (c: any[]) => c[0] === "tiktok_cs_register_session",
    );
    expect(registerCall![1].csContext.shopId).toBe("mongo-B");

    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall![1].extraSystemPrompt).toContain("Prompt B");
  });
});
