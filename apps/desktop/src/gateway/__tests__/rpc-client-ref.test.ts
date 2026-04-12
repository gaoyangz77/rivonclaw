import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRpcClient, setRpcClient, waitForGatewayReady } from "../rpc-client-ref.js";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockEnsureRpcReady = vi.fn<() => any>();

vi.mock("../../openclaw/index.js", () => ({
  openClawConnector: {
    ensureRpcReady: () => mockEnsureRpcReady(),
  },
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("rpc-client-ref", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when connector throws (not connected)", () => {
    mockEnsureRpcReady.mockImplementation(() => {
      throw new Error("RPC not connected");
    });
    expect(getRpcClient()).toBeNull();
  });

  it("returns the rpc client from the connector when connected", () => {
    const mockClient = { request: () => {}, isConnected: () => true };
    mockEnsureRpcReady.mockReturnValue(mockClient);
    expect(getRpcClient()).toBe(mockClient);
  });

  it("setRpcClient is a deprecated no-op", () => {
    // Should not throw
    setRpcClient(null);
    setRpcClient({ request: () => {} } as any);
  });

  it("waitForGatewayReady is a deprecated no-op", async () => {
    // Should resolve immediately
    await waitForGatewayReady();
  });
});
