import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@rivonclaw/logger", () => {
  const stubLogger = () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });
  return {
    createLogger: stubLogger,
    createQuietLogger: stubLogger,
    DEBUG_FLAGS: { PROXY: "DEBUG_PROXY", SECRETS: "DEBUG_SECRETS" },
    isDebugFlagEnabled: () => false,
  };
});

const mockRpcRequest = vi.fn();
vi.mock("../openclaw/index.js", () => ({
  openClawConnector: {
    request: (...args: unknown[]) => mockRpcRequest(...args),
    ensureRpcReady: () => ({ request: mockRpcRequest, isConnected: () => true }),
  },
}));

const mockGraphqlFetch = vi.fn();
const { mockGetAuthSession } = vi.hoisted(() => ({ mockGetAuthSession: vi.fn() }));
vi.mock("../auth/session-ref.js", () => ({
  getAuthSession: mockGetAuthSession,
}));

vi.mock("../app/storage-ref.js", () => ({
  getStorageRef: () => null,
}));

vi.mock("@rivonclaw/core/endpoints", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@rivonclaw/core/endpoints");
  return { ...actual, isStagingDevMode: () => false };
});

// `@rivonclaw/core/node` resolves the agent sessions directory at runtime.
// We don't care about the actual path in the test — `loadSessionCostSummary`
// is mocked, so the path is just an opaque string fed into the mock.
vi.mock("@rivonclaw/core/node", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@rivonclaw/core/node");
  return { ...actual, resolveAgentSessionsDir: () => "/tmp/agents/main/sessions" };
});

const mockLoadSessionCostSummary = vi.fn();
vi.mock("../usage/session-usage.js", () => ({
  loadSessionCostSummary: (...args: unknown[]) => mockLoadSessionCostSummary(...args),
}));

const mockEmitCsTelemetry = vi.fn();
const mockEmitCsError = vi.fn();
const mockEmitCsDeliveryRecovery = vi.fn();
const mockEmitCsDispatchEvent = vi.fn();
const mockEmitCsEscalationEvent = vi.fn();
const mockEmitCsSessionEvent = vi.fn();
vi.mock("../telemetry/cs-telemetry-ref.js", () => ({
  emitCsTelemetry: (...args: unknown[]) => mockEmitCsTelemetry(...args),
  emitCsError: (...args: unknown[]) => mockEmitCsError(...args),
  emitCsDeliveryRecovery: (...args: unknown[]) => mockEmitCsDeliveryRecovery(...args),
  emitCsDispatchEvent: (...args: unknown[]) => mockEmitCsDispatchEvent(...args),
  emitCsEscalationEvent: (...args: unknown[]) => mockEmitCsEscalationEvent(...args),
  emitCsSessionEvent: (...args: unknown[]) => mockEmitCsSessionEvent(...args),
  CS_ERROR_STAGE: {
    DELIVER: "deliver",
    SANITIZE: "sanitize",
    RUN_ERROR: "run_error",
    DISPATCH: "dispatch",
    BACKEND_SESSION: "backend_session",
    SETUP: "setup",
    CONTEXT_RESOLUTION: "context_resolution",
    IMAGE_INGEST: "image_ingest",
    ESCALATE: "escalate",
    RELAY_CONNECT: "relay_connect",
    SHOP_BIND_REJECTED: "shop_bind_rejected",
  },
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import { CustomerServiceSession, type CSShopContext, type CSContext } from "./customer-service-session.js";
import { rootStore } from "../app/store/desktop-store.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

const defaultShop: CSShopContext = {
  objectId: "shop-obj-1",
  platformShopId: "tiktok-shop-1",
  shopName: "Test Shop",
  systemPrompt: "You are CS.",
  platform: "tiktok",
};

function makeContext(overrides?: Partial<CSContext>): CSContext {
  return {
    shopId: "shop-obj-1",
    conversationId: "conv-xyz",
    buyerUserId: "buyer-1",
    ...overrides,
  };
}

function makeSession(): CustomerServiceSession {
  return new CustomerServiceSession(defaultShop, makeContext(), {
    defaultRunProfileId: "CUSTOMER_SERVICE",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAuthSession.mockReturnValue({
    getAccessToken: () => "test-token",
    graphqlFetch: mockGraphqlFetch,
  });
  // The simplified SEND_MESSAGE_MUTATION no longer carries a usage payload —
  // the only GraphQL call is the send itself.
  mockGraphqlFetch.mockResolvedValue({ ecommerceSendMessage: { messageId: "m-1" } });
  const activeProviderKey = {
    id: "key-default",
    provider: "rivonclaw-pro",
    label: "RivonClaw AI",
    model: "gpt-5.5",
    isDefault: true,
    authType: "custom",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  rootStore.llmManager.setEnv({
    storage: {
      providerKeys: {
        getAll: () => [activeProviderKey],
        getActive: () => activeProviderKey,
        getById: (id: string) => (id === activeProviderKey.id ? activeProviderKey : null),
      },
    } as any,
    secretStore: { get: async () => null, set: async () => {}, delete: async () => {} } as any,
    getRpcClient: () => ({ request: mockRpcRequest, isConnected: () => true }) as any,
    toMstSnapshot: async () => ({} as any),
    allKeysToMstSnapshots: async () => [],
    syncActiveKey: async () => {},
    syncAllAuthProfiles: async () => {},
    writeProxyRouterConfig: async () => {},
    writeFullGatewayConfig: async () => {},
    writeDefaultModelToConfig: () => {},
    restartGateway: async () => {},
    proxyFetch: globalThis.fetch,
    stateDir: "/tmp/test-state",
    getLastSystemProxy: () => null,
  });
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("CustomerServiceSession.forwardTextToBuyer — sends message and emits CS telemetry", () => {
  it("sends the GraphQL mutation with no usage piggyback (BI moved to telemetry stream)", async () => {
    const session = makeSession();

    await session.forwardTextToBuyer("hello");

    expect(mockGraphqlFetch).toHaveBeenCalledTimes(1);
    const [_query, variables] = mockGraphqlFetch.mock.calls[0];
    expect(variables).not.toHaveProperty("usage");
    expect(variables).toMatchObject({
      shopId: "shop-obj-1",
      conversationId: "conv-xyz",
      content: JSON.stringify({ content: "hello" }),
    });
  });

  it("emits an outbound cs.message event with contentLength after the send", async () => {
    const session = makeSession();

    await session.forwardTextToBuyer("hello world");

    const messageEvent = mockEmitCsTelemetry.mock.calls.find(
      ([type]) => type === "cs.message",
    );
    expect(messageEvent).toBeDefined();
    expect(messageEvent![1]).toMatchObject({
      shopId: "shop-obj-1",
      platformShopId: "tiktok-shop-1",
      conversationId: "conv-xyz",
      direction: "outbound",
      contentLength: "hello world".length,
    });
  });

  it("does not scan gateway session JSONL for token snapshots on the CS send hot path", async () => {
    const session = makeSession();

    await session.forwardTextToBuyer("hi");

    expect(mockRpcRequest).not.toHaveBeenCalled();
    expect(mockLoadSessionCostSummary).not.toHaveBeenCalled();
    expect(mockEmitCsTelemetry.mock.calls.some(([t]) => t === "cs.message")).toBe(true);
    expect(mockEmitCsTelemetry.mock.calls.some(([t]) => t === "cs.token_snapshot")).toBe(false);
    expect(mockGraphqlFetch).toHaveBeenCalledTimes(1);
  });

  it("emits cs.delivery_recovery telemetry when sensitive-content recovery dispatch succeeds", async () => {
    const session = makeSession();
    mockRpcRequest.mockImplementation(async (method: string) => {
      if (method === "agent") return { runId: "rewrite-run-1" };
      return { ok: true };
    });

    const result = await session.dispatchSensitiveContentRecovery({
      failedRunId: "run-1",
      rejectedText: "Blocked draft",
    });

    expect(result).toMatchObject({ runId: "rewrite-run-1" });
    expect(mockEmitCsDeliveryRecovery).toHaveBeenCalledWith(
      expect.objectContaining({
        failedRunId: "run-1",
        recoveryRunId: "rewrite-run-1",
        reason: "sensitive_content",
        status: "dispatched",
        attempt: 1,
        maxAttempts: 1,
        textLength: "Blocked draft".length,
      }),
    );
  });

  it("emits cs.delivery_recovery telemetry when sensitive-content recovery dispatch fails", async () => {
    const session = makeSession();
    mockRpcRequest.mockRejectedValueOnce(new Error("RPC down"));

    await expect(session.dispatchSensitiveContentRecovery({
      failedRunId: "run-2",
      rejectedText: "Blocked draft",
    })).rejects.toThrow("RPC down");

    expect(mockEmitCsDeliveryRecovery).toHaveBeenCalledWith(
      expect.objectContaining({
        failedRunId: "run-2",
        reason: "sensitive_content",
        status: "dispatch_failed",
        attempt: 1,
        maxAttempts: 1,
        textLength: "Blocked draft".length,
      }),
    );
  });

  it("emits cs.delivery_recovery telemetry when sensitive-content recovery is skipped by attempt limit", async () => {
    const session = makeSession();
    mockRpcRequest.mockImplementation(async (method: string) => {
      if (method === "agent") return { runId: "rewrite-run-1" };
      return { ok: true };
    });

    await session.dispatchSensitiveContentRecovery({
      failedRunId: "run-3",
      rejectedText: "Blocked draft",
    });
    const result = await session.dispatchSensitiveContentRecovery({
      failedRunId: "run-4",
      rejectedText: "Blocked draft again",
    });

    expect(result).toBeUndefined();
    expect(mockEmitCsDeliveryRecovery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        failedRunId: "run-4",
        reason: "sensitive_content",
        status: "skipped_limit_reached",
        attempt: 1,
        maxAttempts: 1,
        textLength: "Blocked draft again".length,
      }),
    );
  });
});
