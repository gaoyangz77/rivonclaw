import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted Mocks ──────────────────────────────────────────────────────────

const {
  mockCsBridgeInstance,
  MockCustomerServiceBridge,
  mockOpenClawConnector,
  mockRootStore,
  mockAuthSession,
  mockEnsureAgentToolingReady,
} = vi.hoisted(() => {
  const mockCsBridgeInstance = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    suspendForGatewayDisconnect: vi.fn(),
    resumeAfterGatewayReconnect: vi.fn().mockResolvedValue(undefined),
    handleCsConversationSignal: vi.fn().mockResolvedValue(undefined),
  };

  // Use function syntax so `new MockCustomerServiceBridge(...)` works as a constructor
  const MockCustomerServiceBridge = vi.fn(function (this: unknown) {
    return mockCsBridgeInstance;
  });

  const mockOpenClawConnector = {
    ensureRpcReady: vi.fn(),
  };

  const mockRootStore = {
    llmManager: { refreshModelCatalog: vi.fn().mockResolvedValue(undefined) },
  };

  const mockAuthSession = {
    getCachedUser: vi.fn().mockReturnValue(null),
    onUserChanged: vi.fn(),
  };

  const mockEnsureAgentToolingReady = vi.fn().mockResolvedValue(undefined);

  return {
    mockCsBridgeInstance,
    MockCustomerServiceBridge,
    mockOpenClawConnector,
    mockRootStore,
    mockAuthSession,
    mockEnsureAgentToolingReady,
  };
});

// ─── Module Mocks ────────────────────────────────────────────────────────────

vi.mock("@rivonclaw/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("../../openclaw/index.js", () => ({
  openClawConnector: mockOpenClawConnector,
}));

vi.mock("../../cs-bridge/customer-service-bridge.js", () => ({
  CustomerServiceBridge: MockCustomerServiceBridge,
}));

vi.mock("../../app/store/desktop-store.js", () => ({
  rootStore: mockRootStore,
}));

vi.mock("../../auth/session-ref.js", () => ({
  getAuthSession: () => mockAuthSession,
}));

vi.mock("../agent-tooling-readiness.js", () => ({
  ensureAgentToolingReady: mockEnsureAgentToolingReady,
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { getCsBridge, tryStartCsBridge, stopCsBridge, suspendCsBridge } from "../connection.js";
import {
  clearPendingCsDispatches,
  CS_REPLAY_START_SPACING_ENV,
  getPendingCsDispatchCount,
  queueCsDispatchUntilBridgeReady,
} from "../../cs-bridge/cs-conversation-signal-buffer.js";
import { CS_ADMISSION_CANCEL_REASON } from "../../cs-bridge/cs-run-admission.js";
import type { CsAgentDispatchRequest } from "../../cs-bridge/cs-agent-dispatch-resolver.js";

// ─── Tests ───────────────────────────────────────────────────────────────────

const flushCsBridgeStart = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

function makeDispatch(conversationId: string): CsAgentDispatchRequest {
  return {
    type: "UNREAD_DETECTED",
    dispatchReason: "PENDING_BUYER_MESSAGE",
    useMessageDelta: true,
    source: "AIRFLOW",
    shopId: "shop-1",
    platformShopId: "platform-shop-1",
    conversationId,
    messageId: `msg-${conversationId}`,
    aiEnabled: true,
    eventTime: new Date().toISOString(),
  };
}

describe("connection.ts CS Bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset module-level state by stopping any existing bridge. A crash-reason
    // stop keeps the replay buffer on purpose, so clear that separately.
    stopCsBridge();
    clearPendingCsDispatches();

    // Default: RPC connected + signed-in user.
    mockOpenClawConnector.ensureRpcReady.mockReturnValue({});
    mockAuthSession.getCachedUser.mockReturnValue({
      userId: "user-1",
    });
    mockEnsureAgentToolingReady.mockResolvedValue(undefined);
  });

  describe("stopCsBridge", () => {
    it("stops and nulls the bridge when one exists", async () => {
      // Create a bridge first
      tryStartCsBridge("device-1");
      await flushCsBridgeStart();
      expect(getCsBridge()).not.toBeNull();

      stopCsBridge();

      expect(mockCsBridgeInstance.stop).toHaveBeenCalled();
      expect(getCsBridge()).toBeNull();
    });

    it("is safe to call when no bridge exists", () => {
      expect(getCsBridge()).toBeNull();
      expect(() => stopCsBridge()).not.toThrow();
    });
  });

  // The replay buffer is Desktop memory and outlives the bridge. A Gateway
  // crash must not empty it: the crash is what fills it (cancelled admissions
  // re-queue there, and signals arriving during the outage land there). Only
  // a sign-out discards it, because that work belongs to the previous account.
  describe("replay buffer across teardown reasons", () => {
    afterEach(() => {
      delete process.env[CS_REPLAY_START_SPACING_ENV];
    });

    // The launcher's "stopped" event calls stopCsBridge() with the default
    // reason. A Gateway that dies again before the replacement bridge is up
    // fires it a second time; clearing on every call (1.9.5 - 1.9.10) wiped
    // the backlog the first death had just re-queued.
    it("keeps the buffered backlog across Gateway-crash teardowns, including a second one before restart", () => {
      queueCsDispatchUntilBridgeReady(makeDispatch("conv-1"));
      queueCsDispatchUntilBridgeReady(makeDispatch("conv-2"));

      stopCsBridge();
      stopCsBridge();

      expect(getPendingCsDispatchCount()).toBe(2);
    });

    it("discards the buffered backlog on sign-out", () => {
      queueCsDispatchUntilBridgeReady(makeDispatch("conv-1"));

      stopCsBridge(CS_ADMISSION_CANCEL_REASON.AUTH_CHANGE);

      expect(getPendingCsDispatchCount()).toBe(0);
    });

    it("replays the kept backlog through the replacement bridge once it starts", async () => {
      process.env[CS_REPLAY_START_SPACING_ENV] = "0";
      queueCsDispatchUntilBridgeReady(makeDispatch("conv-1"));
      queueCsDispatchUntilBridgeReady(makeDispatch("conv-2"));
      stopCsBridge();

      tryStartCsBridge("device-1");
      await vi.waitFor(() => {
        expect(mockCsBridgeInstance.handleCsConversationSignal).toHaveBeenCalledTimes(2);
      });

      expect(
        mockCsBridgeInstance.handleCsConversationSignal.mock.calls.map(
          (call: unknown[]) => (call[0] as CsAgentDispatchRequest).conversationId,
        ),
      ).toEqual(["conv-1", "conv-2"]);
      expect(getPendingCsDispatchCount()).toBe(0);
    });

    // A dispatch that was mid-setup at the crash reaches the retired admission
    // gate after the replacement bridge has already started replaying, and
    // re-queues itself into a buffer that was drained at the start of that
    // pass. It must not sit there until the next Gateway restart.
    it("replays entries that land in the buffer while a replay pass is running", async () => {
      process.env[CS_REPLAY_START_SPACING_ENV] = "0";
      queueCsDispatchUntilBridgeReady(makeDispatch("conv-1"));
      mockCsBridgeInstance.handleCsConversationSignal.mockImplementationOnce(async () => {
        queueCsDispatchUntilBridgeReady(makeDispatch("conv-late"));
      });
      stopCsBridge();

      tryStartCsBridge("device-1");
      await vi.waitFor(() => {
        expect(mockCsBridgeInstance.handleCsConversationSignal).toHaveBeenCalledTimes(2);
      });

      expect(
        mockCsBridgeInstance.handleCsConversationSignal.mock.calls.map(
          (call: unknown[]) => (call[0] as CsAgentDispatchRequest).conversationId,
        ),
      ).toEqual(["conv-1", "conv-late"]);
      expect(getPendingCsDispatchCount()).toBe(0);
    });
  });

  describe("tryStartCsBridge after stopCsBridge", () => {
    it("can recreate the bridge after stop", async () => {
      tryStartCsBridge("device-1");
      await flushCsBridgeStart();
      expect(getCsBridge()).not.toBeNull();

      stopCsBridge();
      expect(getCsBridge()).toBeNull();

      // Should be able to create a new one
      MockCustomerServiceBridge.mockClear();
      tryStartCsBridge("device-1");
      await flushCsBridgeStart();

      expect(MockCustomerServiceBridge).toHaveBeenCalledTimes(1);
      expect(getCsBridge()).not.toBeNull();
    });
  });

  describe("transient Gateway RPC disconnect", () => {
    it("preserves the bridge instance and resumes it after reconnect", async () => {
      tryStartCsBridge("device-1");
      await flushCsBridgeStart();
      const bridge = getCsBridge();
      mockCsBridgeInstance.stop.mockClear();

      suspendCsBridge();

      expect(mockCsBridgeInstance.suspendForGatewayDisconnect).toHaveBeenCalledTimes(1);
      expect(mockCsBridgeInstance.stop).not.toHaveBeenCalled();
      expect(getCsBridge()).toBe(bridge);

      MockCustomerServiceBridge.mockClear();
      tryStartCsBridge("device-1");
      await flushCsBridgeStart();

      expect(mockCsBridgeInstance.resumeAfterGatewayReconnect).toHaveBeenCalledTimes(1);
      expect(MockCustomerServiceBridge).not.toHaveBeenCalled();
      expect(getCsBridge()).toBe(bridge);
    });
  });

  describe("tryStartCsBridge", () => {
    it("does not create duplicate when bridge already exists", async () => {
      tryStartCsBridge("device-1");
      await flushCsBridgeStart();
      const firstBridge = getCsBridge();
      expect(firstBridge).not.toBeNull();

      MockCustomerServiceBridge.mockClear();
      tryStartCsBridge("device-1");
      await flushCsBridgeStart();

      // Constructor should NOT have been called again
      expect(MockCustomerServiceBridge).not.toHaveBeenCalled();
      expect(getCsBridge()).toBe(firstBridge);
    });

    it("does not subscribe to auth userChanged events", async () => {
      tryStartCsBridge("device-1");
      await flushCsBridgeStart();

      expect(mockAuthSession.onUserChanged).not.toHaveBeenCalled();
    });

    it("does not create bridge when RPC is not ready", async () => {
      mockOpenClawConnector.ensureRpcReady.mockImplementation(() => {
        throw new Error("not connected");
      });

      tryStartCsBridge("device-1");
      await flushCsBridgeStart();

      expect(getCsBridge()).toBeNull();
      expect(MockCustomerServiceBridge).not.toHaveBeenCalled();
    });

    it("does not create bridge when no user is signed in", async () => {
      mockAuthSession.getCachedUser.mockReturnValue(null);

      tryStartCsBridge("device-1");
      await flushCsBridgeStart();

      expect(getCsBridge()).toBeNull();
      expect(MockCustomerServiceBridge).not.toHaveBeenCalled();
    });

    it("waits for agent tooling readiness before creating bridge", async () => {
      let resolveReady!: () => void;
      mockEnsureAgentToolingReady.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveReady = resolve;
        }),
      );

      tryStartCsBridge("device-1");
      await Promise.resolve();

      expect(getCsBridge()).toBeNull();
      expect(MockCustomerServiceBridge).not.toHaveBeenCalled();

      resolveReady();
      await flushCsBridgeStart();

      expect(MockCustomerServiceBridge).toHaveBeenCalledTimes(1);
      expect(getCsBridge()).not.toBeNull();
    });

    it("does not create bridge when stopped while waiting for agent tooling readiness", async () => {
      let resolveReady!: () => void;
      mockEnsureAgentToolingReady.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveReady = resolve;
        }),
      );

      tryStartCsBridge("device-1");
      await Promise.resolve();

      stopCsBridge();
      resolveReady();
      await flushCsBridgeStart();

      expect(MockCustomerServiceBridge).not.toHaveBeenCalled();
      expect(getCsBridge()).toBeNull();
    });
  });
});
