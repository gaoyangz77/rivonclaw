// Regression coverage for the CS pending-run sweeper: a run whose terminal
// event never arrives must be reconciled and its admission lease released,
// instead of leaking one of the four automatic-run slots forever.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());

vi.mock("../openclaw/index.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../openclaw/index.js")>()),
  openClawConnector: { request: requestMock } as never,
}));

vi.mock("../app/store/runtime-status-store.js", () => ({
  runtimeStatusStore: {
    setCsBridgeConnected: vi.fn(),
    setCsBridgeDisconnected: vi.fn(),
  },
}));

import { EcommerceRelayBridge } from "./ecommerce-relay-bridge.js";

type AnyBridge = {
  pendingRuns: Map<string, unknown>;
  gatewayGeneration: number;
  closed: boolean;
  sweepStalePendingRuns: () => Promise<void>;
};

function makeSessionStub() {
  return {
    scopeKey: "agent:customer-service:cs:tiktok:shop:conv",
    takeTurnText: vi.fn(() => ""),
    isRunAborted: vi.fn(() => false),
    clearTurnText: vi.fn(),
    hasRunForwardedText: vi.fn(() => false),
    noteTurnText: vi.fn(),
    markRunTerminalToolStarted: vi.fn(),
    emitError: vi.fn(),
    onRunCompleted: vi.fn(() => ({
      wasAborted: false,
      hadForwardedText: true,
      hadTerminalToolAction: false,
      hadOperationalFailure: false,
    })),
    acknowledgeHandledWithoutReply: vi.fn(async () => {}),
  };
}

function seedPendingRun(
  bridge: AnyBridge,
  runId: string,
  ageMs: number,
): { release: ReturnType<typeof vi.fn>; session: ReturnType<typeof makeSessionStub> } {
  const release = vi.fn();
  const session = makeSessionStub();
  bridge.pendingRuns.set(runId, {
    shopObjectId: "shop-1",
    conversationId: "conv-1",
    session,
    acceptedAt: Date.now() - ageMs,
    admissionLease: { release },
  });
  return { release, session };
}

describe("EcommerceRelayBridge pending-run sweep", () => {
  let bridge: AnyBridge;

  beforeEach(() => {
    requestMock.mockReset();
    bridge = new EcommerceRelayBridge({ gatewayId: "gw-test" }) as unknown as AnyBridge;
    bridge.closed = false;
  });

  afterEach(() => {
    (bridge as unknown as { stopPendingRunSweeper: () => void }).stopPendingRunSweeper();
  });

  it("reconciles a stale run whose terminal event was lost and releases its lease", async () => {
    const { release } = seedPendingRun(bridge, "run-stale", 10 * 60_000);
    requestMock.mockImplementation(async (method: string) => {
      if (method === "agent.wait") return { status: "error", error: "run died" };
      throw new Error(`unexpected request ${method}`);
    });

    await bridge.sweepStalePendingRuns();

    expect(requestMock).toHaveBeenCalledWith("agent.wait", { runId: "run-stale", timeoutMs: 0 });
    expect(bridge.pendingRuns.size).toBe(0);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("keeps a genuinely running stale run pending and leaves its lease held", async () => {
    const { release } = seedPendingRun(bridge, "run-alive", 10 * 60_000);
    requestMock.mockResolvedValue({ status: "pending" });

    await bridge.sweepStalePendingRuns();

    expect(bridge.pendingRuns.size).toBe(1);
    expect(release).not.toHaveBeenCalled();
  });

  it("does not touch runs younger than the reconcile threshold", async () => {
    seedPendingRun(bridge, "run-young", 30_000);

    await bridge.sweepStalePendingRuns();

    expect(requestMock).not.toHaveBeenCalled();
    expect(bridge.pendingRuns.size).toBe(1);
  });

  it("retries on the next sweep when reconciliation fails", async () => {
    const { release } = seedPendingRun(bridge, "run-flaky", 10 * 60_000);
    requestMock.mockRejectedValueOnce(new Error("socket down"));

    await bridge.sweepStalePendingRuns();
    expect(bridge.pendingRuns.size).toBe(1);
    expect(release).not.toHaveBeenCalled();

    requestMock.mockResolvedValueOnce({ status: "error", error: "run died" });
    await bridge.sweepStalePendingRuns();
    expect(bridge.pendingRuns.size).toBe(0);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("skips sweeping entirely while the bridge is suspended", async () => {
    seedPendingRun(bridge, "run-suspended", 10 * 60_000);
    bridge.closed = true;

    await bridge.sweepStalePendingRuns();

    expect(requestMock).not.toHaveBeenCalled();
    expect(bridge.pendingRuns.size).toBe(1);
  });
});
