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

const mockReadFullModelCatalog = vi.fn().mockResolvedValue({});
vi.mock("@rivonclaw/gateway", () => ({
  readFullModelCatalog: (...args: unknown[]) => mockReadFullModelCatalog(...args),
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import { CustomerServiceBridge, type CSShopContext } from "./customer-service-bridge.js";
import { rootStore } from "../store/desktop-store.js";
import { onAction } from "mobx-state-tree";

// Track setSessionRunProfile calls via MST's onAction middleware (no spy mutation needed)
const setSessionRunProfileCalls: Array<{ sessionKey: string; runProfileId: string | null }> = [];
onAction(rootStore, (call) => {
  if (call.name === "setSessionRunProfile") {
    setSessionRunProfileCalls.push({
      sessionKey: call.args?.[0] as string,
      runProfileId: call.args?.[1] as string | null ?? null,
    });
  }
}, true); // true = attach to subtree (captures actions on child models)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createBridge(overrides?: Partial<{ defaultRunProfileId: string }>): CustomerServiceBridge {
  return new CustomerServiceBridge({
    relayUrl: "ws://localhost:3001",
    gatewayId: "test-gateway",
    defaultRunProfileId: overrides?.defaultRunProfileId ?? "CUSTOMER_SERVICE",
  });
}

const defaultShop: CSShopContext = {
  objectId: "mongo-id-123",
  platformShopId: "tiktok-shop-456",
  systemPrompt: "You are a CS assistant.",
  runProfileId: "CUSTOMER_SERVICE",
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
  setSessionRunProfileCalls.length = 0;
  mockGetRpcClient.mockReturnValue({ request: mockRpcRequest });
  mockRpcRequest.mockResolvedValue({ ok: true });
  mockReadFullModelCatalog.mockResolvedValue({});
  mockGraphqlFetch.mockResolvedValue({
    csGetOrCreateSession: { sessionId: "sess-001", isNew: true, balance: 100 },
    ecommerceSendMessage: { code: 0 },
  });
  mockGetAuthSession.mockReturnValue({
    getAccessToken: () => "test-token",
    graphqlFetch: mockGraphqlFetch,
  });
  // Initialize LLMProviderManager env so applyModelForSession can call sessions.patch
  rootStore.llmManager.setEnv({
    storage: { providerKeys: { getAll: () => [], getActive: () => null, getById: () => null } } as any,
    secretStore: { get: async () => null, set: async () => {}, delete: async () => {} } as any,
    getRpcClient: () => mockGetRpcClient() as any,
    toMstSnapshot: async () => ({} as any),
    allKeysToMstSnapshots: async () => [],
    syncActiveKey: async () => {},
    syncAllAuthProfiles: async () => {},
    writeProxyRouterConfig: async () => {},
    writeFullGatewayConfig: async () => {},
    writeDefaultModelToConfig: () => {},
    stateDir: "/tmp/test-state",
    getLastSystemProxy: () => null,
  });
  // Reset MST store, then seed RunProfiles so toolCapability.allRunProfiles returns test data
  rootStore.ingestGraphQLResponse({
    runProfiles: [
      { id: "CUSTOMER_SERVICE", name: "TikTok CS", userId: "", surfaceId: "Default", selectedToolIds: ["TOOL_A", "TOOL_B"] },
      { id: "FALLBACK_CS", name: "Fallback CS", userId: "", surfaceId: "Default", selectedToolIds: ["TOOL_C"] },
    ],
    surfaces: [],
    toolSpecs: [],
    shops: [],
  });
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
    expect(setSessionRunProfileCalls).toHaveLength(0);
  });

  it("drops message when shop context not found", async () => {
    const bridge = createBridge();
    // No shop context set

    await triggerMessage(bridge, createFrame());
    expect(mockRpcRequest).not.toHaveBeenCalled();
    expect(setSessionRunProfileCalls).toHaveLength(0);
  });

  it("proceeds when shop context is found", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());
    // Session registration + sessions.patch (model) + agent dispatch = 3 RPC calls
    expect(mockRpcRequest).toHaveBeenCalledTimes(3);
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

    expect(setSessionRunProfileCalls).toContainEqual({
      sessionKey: "agent:main:cs:tiktok:conv-XYZ",
      runProfileId: "CUSTOMER_SERVICE",
    });
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

  it("IMAGE message passes raw content with type prefix", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    const content = JSON.stringify({ url: "https://example.com/img.jpg", width: 304, height: 290 });

    await triggerMessage(bridge, createFrame({
      messageType: "IMAGE",
      content,
    }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({ message: `[IMAGE] ${content}` }),
    );
  });

  it("ORDER_CARD message passes raw content with type prefix", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    const content = JSON.stringify({ order_id: "ORD-12345" });

    await triggerMessage(bridge, createFrame({
      messageType: "ORDER_CARD",
      content,
    }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({ message: `[ORDER_CARD] ${content}` }),
    );
  });

  it("VIDEO message passes raw content with type prefix", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    const content = JSON.stringify({ url: "https://example.com/video.mp4", duration: "20.5" });

    await triggerMessage(bridge, createFrame({
      messageType: "VIDEO",
      content,
    }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({ message: `[VIDEO] ${content}` }),
    );
  });
});

// ─── 3a. Image attachment extraction ─────────────────────────────────────────

describe("image attachment extraction", () => {
  it("IMAGE message: fetches image and passes base64 attachment to agent RPC", async () => {
    const fakeImageBuffer = Buffer.from("fake-png-data");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: () => Promise.resolve(fakeImageBuffer.buffer.slice(
        fakeImageBuffer.byteOffset,
        fakeImageBuffer.byteOffset + fakeImageBuffer.byteLength,
      )),
    });
    vi.stubGlobal("fetch", mockFetch);

    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    const imageUrl = "https://tosv.boei18n.byted.org/obj/test-image.png";
    const content = JSON.stringify({ url: imageUrl, width: 304, height: 290 });

    await triggerMessage(bridge, createFrame({
      messageType: "IMAGE",
      content,
    }));

    // fetch was called with the image URL
    expect(mockFetch).toHaveBeenCalledWith(imageUrl);

    // agent RPC includes attachments
    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall).toBeDefined();
    expect(agentCall![1].attachments).toEqual([
      { mimeType: "image/png", content: fakeImageBuffer.toString("base64") },
    ]);

    vi.unstubAllGlobals();
  });

  it("IMAGE message: fetch failure does not block agent dispatch (graceful degradation)", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("network error"));
    vi.stubGlobal("fetch", mockFetch);

    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    const content = JSON.stringify({ url: "https://example.com/broken.jpg", width: 100, height: 100 });

    await triggerMessage(bridge, createFrame({
      messageType: "IMAGE",
      content,
    }));

    // Agent RPC was still called (dispatch not blocked)
    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall).toBeDefined();

    // No attachments passed (fetch failed)
    expect(agentCall![1].attachments).toBeUndefined();

    // Text content still includes the IMAGE prefix
    expect(agentCall![1].message).toContain("[IMAGE]");

    vi.unstubAllGlobals();
  });

  it("IMAGE message: non-ok response does not produce attachments", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
    });
    vi.stubGlobal("fetch", mockFetch);

    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    const content = JSON.stringify({ url: "https://example.com/missing.jpg" });

    await triggerMessage(bridge, createFrame({
      messageType: "IMAGE",
      content,
    }));

    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall).toBeDefined();
    expect(agentCall![1].attachments).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it("TEXT message: no attachments passed to agent RPC", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({
      messageType: "TEXT",
      content: JSON.stringify({ content: "Hello" }),
    }));

    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall).toBeDefined();
    expect(agentCall![1].attachments).toBeUndefined();
  });

  it("IMAGE message: defaults mimeType to image/jpeg when content-type header is missing", async () => {
    const fakeImageBuffer = Buffer.from("fake-jpeg-data");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(), // no content-type
      arrayBuffer: () => Promise.resolve(fakeImageBuffer.buffer.slice(
        fakeImageBuffer.byteOffset,
        fakeImageBuffer.byteOffset + fakeImageBuffer.byteLength,
      )),
    });
    vi.stubGlobal("fetch", mockFetch);

    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({
      messageType: "IMAGE",
      content: JSON.stringify({ url: "https://example.com/no-ct.jpg" }),
    }));

    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall![1].attachments).toEqual([
      { mimeType: "image/jpeg", content: fakeImageBuffer.toString("base64") },
    ]);

    vi.unstubAllGlobals();
  });
});

// ─── 4. CS RunProfile setup ─────────────────────────────────────────────────

describe("CS RunProfile setup", () => {
  it("calls setSessionRunProfile with scopeKey, profile data, and runProfileId", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expect(setSessionRunProfileCalls).toContainEqual({
      sessionKey: "agent:main:cs:tiktok:conv-789",
      runProfileId: "CUSTOMER_SERVICE",
    });
  });

  it("proceeds with agent dispatch even when RunProfile not in cache (model resolves at query time)", async () => {
    rootStore.ingestGraphQLResponse({ runProfiles: [] }); // no profiles
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    // Bridge no longer validates profile existence — it stores the ID and lets the model
    // resolve at effective-tools query time (returning empty tools if not found).
    expect(mockRpcRequest).toHaveBeenCalledWith(
      "cs_register_session",
      expect.anything(),
    );
    expect(mockRpcRequest).toHaveBeenCalledWith("agent", expect.anything());
    expect(setSessionRunProfileCalls).toContainEqual({
      sessionKey: "agent:main:cs:tiktok:conv-789",
      runProfileId: "CUSTOMER_SERVICE",
    });
  });

  it("falls back to defaultRunProfileId when shop has no runProfileId", async () => {
    const bridge = createBridge({ defaultRunProfileId: "FALLBACK_CS" });
    bridge.setShopContext({ ...defaultShop, runProfileId: undefined });

    await triggerMessage(bridge, createFrame());

    expect(setSessionRunProfileCalls).toContainEqual(
      expect.objectContaining({
        runProfileId: "FALLBACK_CS",
      }),
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
    expect(setSessionRunProfileCalls).toHaveLength(0);
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
    expect(setSessionRunProfileCalls).toHaveLength(0);
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
    // First call (register) succeeds, second (sessions.patch) succeeds, third (agent) fails
    mockRpcRequest
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error("agent dispatch failed"));

    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    // Should not throw
    await triggerMessage(bridge, createFrame({ messageId: "msg-fail" }));

    // All three calls were attempted
    expect(mockRpcRequest).toHaveBeenCalledTimes(3);
    expect(mockRpcRequest).toHaveBeenCalledWith("cs_register_session", expect.anything());
    expect(mockRpcRequest).toHaveBeenCalledWith("sessions.patch", expect.anything());
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
    expect(setSessionRunProfileCalls).toHaveLength(0);
  });

  it("shop context not found → message dropped with no further calls", async () => {
    const bridge = createBridge();
    // Do NOT set any shop context

    await triggerMessage(bridge, createFrame({ shopId: "nonexistent-shop" }));

    expect(mockRpcRequest).not.toHaveBeenCalled();
    expect(setSessionRunProfileCalls).toHaveLength(0);
  });

  it("session registration fails → RunProfile set and agent dispatch skipped", async () => {
    mockRpcRequest.mockRejectedValueOnce(new Error("session reg failed"));
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expect(mockRpcRequest).toHaveBeenCalledTimes(1);
    expect(setSessionRunProfileCalls).toHaveLength(0);
  });

  it("RunProfile not in cache → bridge still proceeds (model resolves at query time)", async () => {
    rootStore.ingestGraphQLResponse({ runProfiles: [] }); // empty profiles
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    // Bridge no longer validates profile existence — it stores the ID.
    // cs_register_session + sessions.patch (model) + agent dispatch = 3 RPC calls.
    expect(mockRpcRequest).toHaveBeenCalledTimes(3);
    expect(mockRpcRequest).toHaveBeenCalledWith("cs_register_session", expect.anything());
    expect(mockRpcRequest).toHaveBeenCalledWith("sessions.patch", expect.anything());
    expect(mockRpcRequest).toHaveBeenCalledWith("agent", expect.anything());
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

    rootStore.ingestGraphQLResponse({
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

    rootStore.ingestGraphQLResponse({
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

    rootStore.ingestGraphQLResponse({
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

    rootStore.ingestGraphQLResponse({
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
    rootStore.ingestGraphQLResponse({ shops: [] });
    bridge.syncFromCache();

    // Should not have context anymore
    return triggerMessage(bridge, createFrame({ shopId: "ps-1" })).then(() => {
      expect(mockRpcRequest).not.toHaveBeenCalled();
    });
  });

  it("syncFromCache updates existing shop context when data changes", () => {
    const bridge = createBridge();

    // Initial sync
    rootStore.ingestGraphQLResponse({
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
    rootStore.ingestGraphQLResponse({
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

    rootStore.ingestGraphQLResponse({
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

    rootStore.ingestGraphQLResponse({
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
      setSessionRunProfileCalls.length = 0;
      mockGetRpcClient.mockReturnValue({ request: mockRpcRequest });
      mockRpcRequest.mockResolvedValue({ ok: true });
      mockGetAuthSession.mockReturnValue({
        getAccessToken: () => "test-token",
        graphqlFetch: mockGraphqlFetch,
      });
      mockGraphqlFetch.mockResolvedValue({
        csGetOrCreateSession: { sessionId: "sess-001", isNew: true, balance: 100 },
      });
      // RunProfiles are already in the MST store from beforeEach

      await triggerMessage(bridge, createFrame({ shopId: "ps-4", conversationId: "conv-shop4" }));
      expect(mockRpcRequest).toHaveBeenCalledWith(
        "cs_register_session",
        expect.objectContaining({ csContext: expect.objectContaining({ shopId: "shop-4" }) }),
      );
    });
  });
});

// ─── 9. CS session lifecycle ────────────────────────────────────────────────

describe("CS session lifecycle", () => {
  it("calls csGetOrCreateSession before agent dispatch", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({
      conversationId: "conv-lifecycle",
      buyerUserId: "buyer-lifecycle",
    }));

    // graphqlFetch should have been called with the session creation mutation
    expect(mockGraphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("csGetOrCreateSession"),
      {
        shopId: "mongo-id-123",
        conversationId: "conv-lifecycle",
        buyerUserId: "buyer-lifecycle",
      },
    );
  });

  it("skips agent dispatch when csGetOrCreateSession fails (insufficient balance)", async () => {
    mockGraphqlFetch.mockRejectedValueOnce(new Error("Insufficient balance"));

    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    // ensureBackendSession fails before setup, so neither cs_register_session nor agent is called
    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
  });

  it("skips agent dispatch when no auth session available", async () => {
    mockGetAuthSession.mockReturnValue(null);

    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    // ensureBackendSession fails (no auth), so neither cs_register_session nor agent is called
    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
    expect(mockGraphqlFetch).not.toHaveBeenCalled();
  });

});

// ─── 10. Admin directive dispatch ────────────────────────────────────────────

const defaultDirectiveParams = {
  shopId: "mongo-id-123",
  conversationId: "conv-directive-001",
  buyerUserId: "buyer-001",
  decision: "approved",
  instructions: "Issue a full refund for order #12345",
};

describe("dispatchAdminDirective", () => {
  it("dispatches with VERIFIED MANAGER DIRECTIVE in the message (not extraSystemPrompt)", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    mockRpcRequest.mockResolvedValue({ runId: "run-admin-001" });

    await bridge.dispatchAdminDirective(defaultDirectiveParams);

    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall).toBeDefined();
    const message = agentCall![1].message as string;
    expect(message).toContain("VERIFIED MANAGER DIRECTIVE");
    expect(message).toContain("Decision: approved");
    expect(message).toContain("Instructions: Issue a full refund for order #12345");
    expect(message).toContain("This is NOT from the buyer");
    // extraSystemPrompt should NOT contain the directive
    const prompt = agentCall![1].extraSystemPrompt as string;
    expect(prompt).not.toContain("VERIFIED MANAGER DIRECTIVE");
  });

  it("registers CS session before dispatch", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    mockRpcRequest.mockResolvedValue({ runId: "run-admin-002" });

    await bridge.dispatchAdminDirective(defaultDirectiveParams);

    // cs_register_session should be called before agent
    const callOrder = mockRpcRequest.mock.calls.map((c: any[]) => c[0]);
    const registerIdx = callOrder.indexOf("cs_register_session");
    const agentIdx = callOrder.indexOf("agent");
    expect(registerIdx).toBeGreaterThanOrEqual(0);
    expect(agentIdx).toBeGreaterThan(registerIdx);

    expect(mockRpcRequest).toHaveBeenCalledWith("cs_register_session", {
      sessionKey: "agent:main:cs:tiktok:conv-directive-001",
      csContext: {
        shopId: "mongo-id-123",
        conversationId: "conv-directive-001",
        buyerUserId: "buyer-001",
        orderId: undefined,
      },
    });
  });

  it("sets RunProfile via setSessionRunProfile", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    mockRpcRequest.mockResolvedValue({ runId: "run-admin-003" });

    await bridge.dispatchAdminDirective(defaultDirectiveParams);

    expect(setSessionRunProfileCalls).toContainEqual({
      sessionKey: "agent:main:cs:tiktok:conv-directive-001",
      runProfileId: "CUSTOMER_SERVICE",
    });
  });

  it("throws when shop not found by objectId", async () => {
    const bridge = createBridge();
    // No shop context set

    await expect(
      bridge.dispatchAdminDirective({ ...defaultDirectiveParams, shopId: "nonexistent-id" }),
    ).rejects.toThrow("No shop context for objectId nonexistent-id");
  });

  it("finds shop by objectId (not platformShopId)", async () => {
    const bridge = createBridge();
    bridge.setShopContext({
      objectId: "specific-mongo-id",
      platformShopId: "platform-id-different",
      systemPrompt: "Shop prompt",
      runProfileId: "CUSTOMER_SERVICE",
    });
    mockRpcRequest.mockResolvedValue({ runId: "run-admin-004" });

    await bridge.dispatchAdminDirective({
      ...defaultDirectiveParams,
      shopId: "specific-mongo-id",
    });

    // Should succeed — looked up by objectId, not platformShopId
    expect(mockRpcRequest).toHaveBeenCalledWith("agent", expect.anything());
  });

  it("tracks run in pendingRuns for auto-forward", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    mockRpcRequest.mockResolvedValue({ runId: "run-admin-005" });

    await bridge.dispatchAdminDirective(defaultDirectiveParams);

    // Simulate a gateway event for this runId to verify pendingRuns tracking
    bridge.onGatewayEvent({
      event: "chat",
      payload: {
        runId: "run-admin-005",
        state: "final",
        message: { role: "assistant", content: [{ type: "text", text: "Refund issued." }] },
      },
    } as any);

    // The auto-forward should trigger graphqlFetch (ecommerceSendMessage)
    expect(mockGraphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("ecommerceSendMessage"),
      expect.objectContaining({
        shopId: "mongo-id-123",
        conversationId: "conv-directive-001",
      }),
    );
  });

  it("includes decision and instructions in the message", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    mockRpcRequest.mockResolvedValue({ runId: "run-admin-006" });

    await bridge.dispatchAdminDirective({
      ...defaultDirectiveParams,
      decision: "rejected",
      instructions: "Offer store credit instead",
    });

    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    const message = agentCall![1].message as string;
    expect(message).toContain("Decision: rejected");
    expect(message).toContain("Instructions: Offer store credit instead");
  });

  it("uses dispatchKey (cs:platform:conversationId) as sessionKey for agent RPC", async () => {
    const bridge = createBridge();
    bridge.setShopContext({ ...defaultShop, platform: "shopee" });
    mockRpcRequest.mockResolvedValue({ runId: "run-admin-007" });

    await bridge.dispatchAdminDirective(defaultDirectiveParams);

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({
        sessionKey: "cs:shopee:conv-directive-001",
      }),
    );
  });

  it("throws when no RPC client available", async () => {
    mockGetRpcClient.mockReturnValue(null);
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await expect(
      bridge.dispatchAdminDirective(defaultDirectiveParams),
    ).rejects.toThrow("No RPC client available");
  });

  it("includes orderId in prompt when provided", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    mockRpcRequest.mockResolvedValue({ runId: "run-admin-008" });

    await bridge.dispatchAdminDirective({
      ...defaultDirectiveParams,
      orderId: "order-999",
    });

    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall![1].extraSystemPrompt).toContain("Order ID: order-999");
  });

  it("omits Order ID line from prompt when orderId not provided", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    mockRpcRequest.mockResolvedValue({ runId: "run-admin-009" });

    await bridge.dispatchAdminDirective(defaultDirectiveParams);

    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall![1].extraSystemPrompt).not.toContain("Order ID");
  });

  it("idempotencyKey starts with 'admin:' prefix", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    mockRpcRequest.mockResolvedValue({ runId: "run-admin-010" });

    await bridge.dispatchAdminDirective(defaultDirectiveParams);

    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall![1].idempotencyKey).toMatch(/^admin:conv-directive-001:\d+$/);
  });

  it("returns runId from agent dispatch", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    mockRpcRequest.mockResolvedValue({ runId: "run-admin-011" });

    const result = await bridge.dispatchAdminDirective(defaultDirectiveParams);

    expect(result).toEqual({ runId: "run-admin-011" });
  });
});

// ─── 11. Multi-provider model override (via LLMProviderManager) ──────────────
//
// Model resolution is now delegated to rootStore.llmManager.applyModelForSession.
// The LLM manager reads csProviderOverride/csModelOverride from the MST shop entity
// (not from bridge's CSShopContext), so we seed shops in the MST store.

describe("multi-provider model override", () => {
  /** Helper: seed the model catalog on the LLM manager and seed a shop into MST store. */
  async function seedCatalogAndShop(overrides?: {
    csProviderOverride?: string | null;
    csModelOverride?: string | null;
  }): Promise<void> {
    // Seed model catalog on LLM manager
    mockReadFullModelCatalog.mockResolvedValue({
      zhipu: [{ id: "glm-5" }, { id: "glm-4" }],
      openai: [{ id: "gpt-4o" }, { id: "gpt-4o-mini" }],
      anthropic: [{ id: "claude-sonnet-4-20250514" }],
    });
    await rootStore.llmManager.refreshModelCatalog();

    // Seed shop in MST store with CS overrides (LLM manager reads from here)
    rootStore.ingestGraphQLResponse({
      shops: [{
        id: "mongo-id-123",
        platform: "TIKTOK_SHOP",
        platformShopId: "tiktok-shop-456",
        shopName: "Test Shop",
        services: {
          customerService: {
            enabled: true,
            csDeviceId: "test-gateway",
            assembledPrompt: "You are a CS assistant.",
            csProviderOverride: overrides?.csProviderOverride ?? null,
            csModelOverride: overrides?.csModelOverride ?? null,
            runProfileId: "CUSTOMER_SERVICE",
          },
        },
      }],
    });
  }

  it("two-field override: sends provider/model to sessions.patch when in catalog", async () => {
    const bridge = createBridge();
    await seedCatalogAndShop({ csProviderOverride: "zhipu", csModelOverride: "glm-5" });
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expect(mockRpcRequest).toHaveBeenCalledWith("sessions.patch", {
      key: "agent:main:cs:tiktok:conv-789",
      model: "zhipu/glm-5",
    });
  });

  it("two-field override: falls back to null when provider/model not in catalog", async () => {
    const bridge = createBridge();
    await seedCatalogAndShop({ csProviderOverride: "zhipu", csModelOverride: "nonexistent-model" });
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expect(mockRpcRequest).toHaveBeenCalledWith("sessions.patch", {
      key: "agent:main:cs:tiktok:conv-789",
      model: null,
    });
  });

  it("no override: neither provider nor model set, sessions.patch called with null (global default)", async () => {
    const bridge = createBridge();
    await seedCatalogAndShop({ csProviderOverride: null, csModelOverride: null });
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    // With no override, applyModelForSession falls through to global default (model: null)
    expect(mockRpcRequest).toHaveBeenCalledWith("sessions.patch", {
      key: "agent:main:cs:tiktok:conv-789",
      model: null,
    });
  });

  it("refreshModelCatalog caches all providers, not just active provider", async () => {
    const bridge = createBridge();
    // Seed with OpenAI model override
    await seedCatalogAndShop({ csProviderOverride: "openai", csModelOverride: "gpt-4o" });
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expect(mockRpcRequest).toHaveBeenCalledWith("sessions.patch", {
      key: "agent:main:cs:tiktok:conv-789",
      model: "openai/gpt-4o",
    });
  });

  it("provider set without model: sessions.patch called with null (treated as no override)", async () => {
    const bridge = createBridge();
    await seedCatalogAndShop({ csProviderOverride: "zhipu", csModelOverride: null });
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    // LLM manager requires both provider AND model for scope override; falls through to global default
    expect(mockRpcRequest).toHaveBeenCalledWith("sessions.patch", {
      key: "agent:main:cs:tiktok:conv-789",
      model: null,
    });
  });
});

// ── 12. Escalation ───────────────────────────────────────────────────────────

const defaultEscalateParams = {
  shopId: "shop-esc-001",
  conversationId: "conv-esc-001",
  buyerUserId: "buyer-esc-001",
  reason: "Buyer requesting refund beyond policy",
};

/** Seed a shop into the MST store with escalation routing configured. */
function seedShopWithEscalation(overrides?: {
  shopId?: string;
  escalationChannelId?: string | null;
  escalationRecipientId?: string | null;
}): void {
  const shopId = overrides?.shopId ?? "shop-esc-001";
  rootStore.ingestGraphQLResponse({
    shops: [
      {
        __typename: "Shop",
        id: shopId,
        platform: "tiktok",
        platformAppId: "",
        platformShopId: "plat-esc-001",
        shopName: "Escalation Test Shop",
        authStatus: "active",
        region: "US",
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        services: {
          customerService: {
            enabled: true,
            businessPrompt: "",
            csDeviceId: null,
            csProviderOverride: null,
            csModelOverride: null,
            escalationChannelId: overrides?.escalationChannelId !== undefined
              ? overrides.escalationChannelId
              : "telegram:acct_test123",
            escalationRecipientId: overrides?.escalationRecipientId !== undefined
              ? overrides.escalationRecipientId
              : "987654321",
            runProfileId: null,
            assembledPrompt: null,
          },
          customerServiceBilling: null,
        },
      },
    ],
  });
}

describe("escalate", () => {
  it("sends to correct channel + accountId + recipient parsed from escalationChannelId", async () => {
    seedShopWithEscalation();
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    const result = await bridge.escalate(defaultEscalateParams);

    expect(result).toEqual({ ok: true });
    expect(mockRpcRequest).toHaveBeenCalledWith(
      "send",
      expect.objectContaining({
        to: "987654321",
        channel: "telegram",
        accountId: "acct_test123",
      }),
    );
  });

  it("escalation message contains reason and session details", async () => {
    seedShopWithEscalation();
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await bridge.escalate(defaultEscalateParams);

    const sendCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "send");
    expect(sendCall).toBeDefined();
    const message = sendCall![1].message as string;
    expect(message).toContain("CS Escalation");
    expect(message).toContain("Reason: Buyer requesting refund beyond policy");
    expect(message).toContain("Shop ID: shop-esc-001");
    expect(message).toContain("Conversation: conv-esc-001");
    expect(message).toContain("Buyer: buyer-esc-001");
    expect(message).toContain("Please reply with your decision");
  });

  it("escalation message contains orderId when provided", async () => {
    seedShopWithEscalation();
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await bridge.escalate({ ...defaultEscalateParams, orderId: "order-esc-999" });

    const sendCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "send");
    expect(sendCall).toBeDefined();
    const message = sendCall![1].message as string;
    expect(message).toContain("Order: order-esc-999");
  });

  it("escalation message contains context when provided", async () => {
    seedShopWithEscalation();
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await bridge.escalate({ ...defaultEscalateParams, context: "Buyer has been waiting 3 days" });

    const sendCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "send");
    expect(sendCall).toBeDefined();
    const message = sendCall![1].message as string;
    expect(message).toContain("Context: Buyer has been waiting 3 days");
  });

  it("returns error when escalation routing not configured (missing escalationChannelId)", async () => {
    seedShopWithEscalation({ escalationChannelId: null });
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    const result = await bridge.escalate(defaultEscalateParams);

    expect(result).toEqual({ ok: false, error: "Escalation routing not configured" });
    expect(mockRpcRequest).not.toHaveBeenCalledWith("send", expect.anything());
  });

  it("returns error when escalation routing not configured (missing escalationRecipientId)", async () => {
    seedShopWithEscalation({ escalationRecipientId: null });
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    const result = await bridge.escalate(defaultEscalateParams);

    expect(result).toEqual({ ok: false, error: "Escalation routing not configured" });
    expect(mockRpcRequest).not.toHaveBeenCalledWith("send", expect.anything());
  });

  it("returns error when shop not found in MST store", async () => {
    // Don't seed any shop — rootStore.shops is empty (reset in beforeEach)
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    const result = await bridge.escalate(defaultEscalateParams);

    expect(result).toEqual({ ok: false, error: "Escalation routing not configured" });
    expect(mockRpcRequest).not.toHaveBeenCalledWith("send", expect.anything());
  });

  it("throws when no RPC client available", async () => {
    mockGetRpcClient.mockReturnValue(null);
    seedShopWithEscalation();
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await expect(bridge.escalate(defaultEscalateParams)).rejects.toThrow("No RPC client available");
  });

  it("send RPC is called with correct idempotencyKey format", async () => {
    seedShopWithEscalation();
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await bridge.escalate(defaultEscalateParams);

    const sendCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "send");
    expect(sendCall).toBeDefined();
    expect(sendCall![1].idempotencyKey).toMatch(/^cs-escalate:conv-esc-001:\d+$/);
  });

  it("parses channel with multiple colons correctly (accountId may contain colons)", async () => {
    seedShopWithEscalation({ escalationChannelId: "slack:workspace:channel_id" });
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await bridge.escalate(defaultEscalateParams);

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "send",
      expect.objectContaining({
        channel: "slack",
        accountId: "workspace:channel_id",
      }),
    );
  });
});
