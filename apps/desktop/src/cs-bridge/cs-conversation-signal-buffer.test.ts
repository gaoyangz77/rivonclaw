import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CsAgentDispatchRequest } from "./cs-agent-dispatch-resolver.js";
import {
  clearPendingCsDispatches,
  CS_REPLAY_START_SPACING_ENV,
  DEFAULT_CS_REPLAY_START_SPACING_MS,
  flushCsDispatchesAfterBridgeReady,
  getPendingCsDispatchCount,
  queueCsDispatchUntilBridgeReady,
  resolveCsReplayStartSpacingMs,
} from "./cs-conversation-signal-buffer.js";

function makeDispatch(
  conversationId: string,
  messageId: string,
): CsAgentDispatchRequest {
  return {
    type: "UNREAD_DETECTED",
    dispatchReason: "PENDING_BUYER_MESSAGE",
    useMessageDelta: true,
    source: "AIRFLOW",
    shopId: "shop-1",
    platformShopId: "platform-shop-1",
    conversationId,
    messageId,
    aiEnabled: true,
    eventTime: new Date().toISOString(),
  };
}

describe("CS conversation signal startup buffer", () => {
  beforeEach(() => {
    clearPendingCsDispatches();
  });

  it("replays dispatches after the bridge becomes ready", async () => {
    const handle = vi.fn().mockResolvedValue(undefined);
    queueCsDispatchUntilBridgeReady(makeDispatch("conv-1", "msg-1"));
    queueCsDispatchUntilBridgeReady(makeDispatch("conv-2", "msg-2"));

    const result = await flushCsDispatchesAfterBridgeReady(handle);

    expect(result.flushed).toBe(2);
    expect(handle).toHaveBeenCalledTimes(2);
    expect(handle.mock.calls.map(([dispatch]) => dispatch.conversationId)).toEqual([
      "conv-1",
      "conv-2",
    ]);
    expect(getPendingCsDispatchCount()).toBe(0);
  });

  // Every Gateway restart replays 40-90 entries through here. A serial loop
  // meant the bridge sat at active=1/4 with three CS slots idle for one to four
  // minutes after each restart, while the backlog it was replaying kept aging.
  it("replays with bounded concurrency instead of one at a time", async () => {
    for (let i = 0; i < 8; i += 1) {
      queueCsDispatchUntilBridgeReady(makeDispatch(`conv-${i}`, `msg-${i}`));
    }

    let inFlight = 0;
    let maxInFlight = 0;
    const handle = vi.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    });

    const result = await flushCsDispatchesAfterBridgeReady(handle, { concurrency: 4 });

    expect(result.flushed).toBe(8);
    expect(handle).toHaveBeenCalledTimes(8);
    expect(maxInFlight).toBe(4);
  });

  it("never exceeds the requested concurrency", async () => {
    for (let i = 0; i < 10; i += 1) {
      queueCsDispatchUntilBridgeReady(makeDispatch(`conv-${i}`, `msg-${i}`));
    }

    let inFlight = 0;
    let maxInFlight = 0;
    const handle = vi.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight -= 1;
    });

    await flushCsDispatchesAfterBridgeReady(handle, { concurrency: 3 });

    expect(maxInFlight).toBe(3);
  });

  // The buffer is drained before the replay starts, so a throw escaping a
  // worker would abandon every entry not yet reached and leave the other
  // workers running detached.
  it("finishes the batch when one dispatch throws, and reports it", async () => {
    for (let i = 0; i < 6; i += 1) {
      queueCsDispatchUntilBridgeReady(makeDispatch(`conv-${i}`, `msg-${i}`));
    }

    const seen: string[] = [];
    const onError = vi.fn();
    const handle = vi.fn(async (dispatch: CsAgentDispatchRequest) => {
      if (dispatch.conversationId === "conv-2") throw new Error("gateway gone");
      seen.push(dispatch.conversationId);
    });

    const result = await flushCsDispatchesAfterBridgeReady(handle, {
      concurrency: 2,
      onError,
    });

    expect(result.flushed).toBe(6);
    expect(result.failed).toBe(1);
    expect(seen).toHaveLength(5);
    expect(seen).not.toContain("conv-2");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0].conversationId).toBe("conv-2");
  });

  // After an OOM restart the buffer holds the whole cancelled admission queue.
  // Bounded concurrency alone still starts six entries in the first second of
  // a fresh Gateway's life; the spacing ramps them up instead. It is global
  // across workers and counted from each entry's start.
  describe("start spacing", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("starts consecutive entries at least the spacing apart, across workers", async () => {
      for (let i = 0; i < 5; i += 1) {
        queueCsDispatchUntilBridgeReady(makeDispatch(`conv-${i}`, `msg-${i}`));
      }
      const t0 = Date.now();
      const startedAt: number[] = [];
      const handle = vi.fn(async () => {
        startedAt.push(Date.now() - t0);
        // Longer than the spacing, so the concurrency bound (not the handler
        // duration) is what would let workers pile up without the spacing.
        await new Promise((resolve) => setTimeout(resolve, 60_000));
      });

      const flush = flushCsDispatchesAfterBridgeReady(handle, {
        concurrency: 3,
        startSpacingMs: 10_000,
      });
      await vi.advanceTimersByTimeAsync(200_000);
      const result = await flush;

      expect(result.flushed).toBe(5);
      // Three workers, five entries: 0/10/20 s for the first three; the fourth
      // and fifth wait for a worker (free at 60 s and 70 s) and then keep the
      // 10 s gap between each other.
      expect(startedAt).toEqual([0, 10_000, 20_000, 60_000, 70_000]);
    });

    it("preserves queue order under spacing", async () => {
      for (let i = 0; i < 4; i += 1) {
        queueCsDispatchUntilBridgeReady(makeDispatch(`conv-${i}`, `msg-${i}`));
      }
      const order: string[] = [];
      const handle = vi.fn(async (dispatch: CsAgentDispatchRequest) => {
        order.push(dispatch.conversationId);
      });

      const flush = flushCsDispatchesAfterBridgeReady(handle, {
        concurrency: 4,
        startSpacingMs: 5_000,
      });
      await vi.advanceTimersByTimeAsync(30_000);
      await flush;

      expect(order).toEqual(["conv-0", "conv-1", "conv-2", "conv-3"]);
    });

    it("starts entries back to back when spacing is zero", async () => {
      for (let i = 0; i < 3; i += 1) {
        queueCsDispatchUntilBridgeReady(makeDispatch(`conv-${i}`, `msg-${i}`));
      }
      const t0 = Date.now();
      const startedAt: number[] = [];
      const handle = vi.fn(async () => {
        startedAt.push(Date.now() - t0);
      });

      const flush = flushCsDispatchesAfterBridgeReady(handle, {
        concurrency: 3,
        startSpacingMs: 0,
      });
      await vi.advanceTimersByTimeAsync(0);
      await flush;

      expect(startedAt).toEqual([0, 0, 0]);
    });
  });

  describe("resolveCsReplayStartSpacingMs", () => {
    it("defaults when unset, accepts zero, and falls back on garbage", () => {
      expect(resolveCsReplayStartSpacingMs({})).toBe(DEFAULT_CS_REPLAY_START_SPACING_MS);
      expect(resolveCsReplayStartSpacingMs({ [CS_REPLAY_START_SPACING_ENV]: "0" })).toBe(0);
      expect(resolveCsReplayStartSpacingMs({ [CS_REPLAY_START_SPACING_ENV]: "2500" })).toBe(2_500);
      expect(resolveCsReplayStartSpacingMs({ [CS_REPLAY_START_SPACING_ENV]: "-1" })).toBe(
        DEFAULT_CS_REPLAY_START_SPACING_MS,
      );
      expect(resolveCsReplayStartSpacingMs({ [CS_REPLAY_START_SPACING_ENV]: "soon" })).toBe(
        DEFAULT_CS_REPLAY_START_SPACING_MS,
      );
    });
  });

  it("keeps only the newest pending dispatch for each conversation", async () => {
    const handle = vi.fn().mockResolvedValue(undefined);
    queueCsDispatchUntilBridgeReady(makeDispatch("conv-1", "msg-1"));
    const queued = queueCsDispatchUntilBridgeReady(makeDispatch("conv-1", "msg-2"));

    expect(queued).toEqual({ queued: 1, replaced: true });

    await flushCsDispatchesAfterBridgeReady(handle);

    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle).toHaveBeenCalledWith(expect.objectContaining({ messageId: "msg-2" }));
  });
});
