import { describe, it, expect, vi, beforeEach } from "vitest";

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

import { getCsBridge, tryStartCsBridge, stopCsBridge } from "../connection.js";

// ─── Tests ───────────────────────────────────────────────────────────────────

const flushCsBridgeStart = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("connection.ts CS Bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset module-level state by stopping any existing bridge
    stopCsBridge();

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
      mockEnsureAgentToolingReady.mockReturnValueOnce(new Promise<void>((resolve) => {
        resolveReady = resolve;
      }));

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
      mockEnsureAgentToolingReady.mockReturnValueOnce(new Promise<void>((resolve) => {
        resolveReady = resolve;
      }));

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
