import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CsAutomaticRunAdmission,
  CsRunAdmissionCancelledError,
  csRunAdmissionPriorityForBatch,
  DEFAULT_CS_AUTOMATIC_MAX_CONCURRENT,
  DEFAULT_CS_LEASE_MAX_AGE_MS,
  resolveCsAutomaticMaxConcurrent,
} from "./cs-run-admission.js";

describe("CsAutomaticRunAdmission", () => {
  afterEach(() => {
    delete process.env.RIVONCLAW_CS_AUTO_MAX_CONCURRENT;
  });

  it("holds a slot until its lease is released and drains in FIFO order", async () => {
    const admission = new CsAutomaticRunAdmission(1);
    const first = await admission.acquire({ conversationId: "conv-1" });
    const order: string[] = [];
    const secondPromise = admission.acquire({ conversationId: "conv-2" }).then((lease) => {
      order.push("conv-2");
      return lease;
    });
    const thirdPromise = admission.acquire({ conversationId: "conv-3" }).then((lease) => {
      order.push("conv-3");
      return lease;
    });

    expect(admission.getDebugState()).toEqual({
      active: 1,
      queued: 2,
      queuedLow: 0,
      maxConcurrent: 1,
      paused: false,
    });

    first.release("run_final");
    const second = await secondPromise;
    expect(order).toEqual(["conv-2"]);
    expect(admission.getDebugState()).toMatchObject({ active: 1, queued: 1 });

    second.release("run_error");
    const third = await thirdPromise;
    expect(order).toEqual(["conv-2", "conv-3"]);
    third.release();
    expect(admission.getDebugState()).toMatchObject({ active: 0, queued: 0 });
  });

  it("keeps queued work paused across a transport disconnect", async () => {
    const admission = new CsAutomaticRunAdmission(1);
    const first = await admission.acquire({ conversationId: "conv-active" });
    admission.pause();
    const queued = admission.acquire({ conversationId: "conv-queued" });

    first.release("run_final");
    expect(admission.getDebugState()).toMatchObject({ active: 0, queued: 1, paused: true });

    admission.resume();
    const next = await queued;
    expect(admission.getDebugState()).toMatchObject({ active: 1, queued: 0, paused: false });
    next.release();
  });

  it("resets active leases and rejects queued work without double releasing", async () => {
    const admission = new CsAutomaticRunAdmission(1);
    const active = await admission.acquire({ conversationId: "conv-active" });
    const queued = admission.acquire({ conversationId: "conv-queued" });

    admission.reset("bridge_stopped");
    await expect(queued).rejects.toBeInstanceOf(CsRunAdmissionCancelledError);
    active.release("late_terminal");
    expect(admission.getDebugState()).toMatchObject({ active: 0, queued: 0, paused: true });

    admission.resume();
    const afterRestart = await admission.acquire({ conversationId: "conv-after-restart" });
    expect(admission.getDebugState()).toMatchObject({ active: 1, queued: 0, paused: false });
    afterRestart.release();
  });

  it("force-releases a lease that outlives the watchdog ceiling so slots cannot leak", async () => {
    vi.useFakeTimers();
    try {
      const admission = new CsAutomaticRunAdmission(1);
      // Acquire the only slot and never release it — models a lost terminal event.
      await admission.acquire({ conversationId: "conv-leaked" });
      const queued = admission.acquire({ conversationId: "conv-waiting" });
      expect(admission.getDebugState()).toMatchObject({ active: 1, queued: 1 });

      await vi.advanceTimersByTimeAsync(DEFAULT_CS_LEASE_MAX_AGE_MS + 61_000);

      // The wedged lease was reclaimed and the queued request got the slot.
      const lease = await queued;
      expect(admission.getDebugState()).toMatchObject({ active: 1, queued: 0 });
      lease.release();
      expect(admission.getDebugState()).toMatchObject({ active: 0, queued: 0 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("never double-releases a lease that was released normally before the ceiling", async () => {
    vi.useFakeTimers();
    try {
      const admission = new CsAutomaticRunAdmission(1);
      const first = await admission.acquire({ conversationId: "conv-normal" });
      first.release("run_final");
      expect(admission.getDebugState()).toMatchObject({ active: 0, queued: 0 });

      const second = await admission.acquire({ conversationId: "conv-next" });
      // Advancing past the ceiling must not disturb the newer lease's slot
      // accounting via the older, already-released lease.
      await vi.advanceTimersByTimeAsync(DEFAULT_CS_LEASE_MAX_AGE_MS - 60_000);
      expect(admission.getDebugState()).toMatchObject({ active: 1, queued: 0 });
      second.release();
      expect(admission.getDebugState()).toMatchObject({ active: 0, queued: 0 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not let watchdog reclamation of a pre-reset lease corrupt the new generation", async () => {
    vi.useFakeTimers();
    try {
      const admission = new CsAutomaticRunAdmission(1);
      await admission.acquire({ conversationId: "conv-old-gen" });
      admission.reset("bridge_stopped");
      admission.resume();

      const fresh = await admission.acquire({ conversationId: "conv-new-gen" });
      await vi.advanceTimersByTimeAsync(DEFAULT_CS_LEASE_MAX_AGE_MS + 61_000);

      // The stale-generation lease is gone from the registry (reset cleared it)
      // and the current generation's accounting reflects only the fresh lease's
      // own lifecycle: the watchdog reclaimed it at the ceiling.
      expect(admission.getDebugState()).toMatchObject({ queued: 0 });
      fresh.release();
      expect(admission.getDebugState()).toMatchObject({ active: 0, queued: 0 });
    } finally {
      vi.useRealTimers();
    }
  });

  // `reset()` leaves the controller paused on purpose, and the bridge that
  // owns it is being replaced. Anything that reaches `acquire()` in that window
  // -- a dispatch that entered before the teardown and spent seconds in async
  // setup -- used to park in a queue nothing would ever drain, so its promise
  // never settled and the caller waited forever. Six conversations were
  // stranded exactly this way in the 2026-09-04 Gateway OOM restart, with no
  // error logged anywhere.
  it("rejects an acquire that lands after reset instead of stranding it", async () => {
    const admission = new CsAutomaticRunAdmission(1);
    await admission.acquire({ conversationId: "conv-active" });
    admission.reset("bridge_stopped");

    const late = admission.acquire({ conversationId: "conv-late" });
    await expect(late).rejects.toBeInstanceOf(CsRunAdmissionCancelledError);
    await expect(late).rejects.toThrow("bridge_stopped");
    expect(admission.getDebugState()).toMatchObject({ queued: 0 });
  });

  it("accepts work again once the bridge resumes after a reset", async () => {
    const admission = new CsAutomaticRunAdmission(1);
    admission.reset("bridge_stopped");
    await expect(admission.acquire({ conversationId: "conv-retired" })).rejects.toBeInstanceOf(
      CsRunAdmissionCancelledError,
    );

    admission.resume();
    const lease = await admission.acquire({ conversationId: "conv-after-resume" });
    expect(admission.getDebugState()).toMatchObject({ active: 1, queued: 0, paused: false });
    lease.release();
  });

  // A Gateway RPC blip pauses admission but keeps the bridge alive, so queued
  // work must survive to be drained on resume. Retirement must not leak into
  // that path: rejecting here would turn every transient reconnect into lost
  // conversations.
  it("does not treat a transient pause as retirement", async () => {
    const admission = new CsAutomaticRunAdmission(1);
    admission.pause();
    const queued = admission.acquire({ conversationId: "conv-blip" });
    expect(admission.getDebugState()).toMatchObject({ queued: 1, paused: true });

    admission.resume();
    const lease = await queued;
    expect(admission.getDebugState()).toMatchObject({ active: 1, queued: 0 });
    lease.release();
  });

  it("uses four by default and falls back for invalid overrides", () => {
    expect(resolveCsAutomaticMaxConcurrent()).toBe(DEFAULT_CS_AUTOMATIC_MAX_CONCURRENT);

    process.env.RIVONCLAW_CS_AUTO_MAX_CONCURRENT = "7";
    expect(resolveCsAutomaticMaxConcurrent()).toBe(7);

    process.env.RIVONCLAW_CS_AUTO_MAX_CONCURRENT = "0";
    expect(resolveCsAutomaticMaxConcurrent()).toBe(DEFAULT_CS_AUTOMATIC_MAX_CONCURRENT);

    process.env.RIVONCLAW_CS_AUTO_MAX_CONCURRENT = "not-a-number";
    expect(resolveCsAutomaticMaxConcurrent()).toBe(DEFAULT_CS_AUTOMATIC_MAX_CONCURRENT);
  });

  describe("priority lanes", () => {
    it("admits a queued normal request before earlier queued low requests, FIFO within each lane", async () => {
      const admission = new CsAutomaticRunAdmission(1);
      const running = await admission.acquire({ conversationId: "running" });
      const order: string[] = [];
      const track = (conversationId: string, priority?: "normal" | "low") =>
        admission.acquire({ conversationId, priority }).then((lease) => {
          order.push(conversationId);
          return lease;
        });

      const low1 = track("low-1", "low");
      const low2 = track("low-2", "low");
      const normal1 = track("normal-1");
      const normal2 = track("normal-2", "normal");
      expect(admission.getDebugState()).toMatchObject({ queued: 4, queuedLow: 2 });

      running.release();
      (await normal1).release();
      (await normal2).release();
      (await low1).release();
      (await low2).release();

      expect(order).toEqual(["normal-1", "normal-2", "low-1", "low-2"]);
    });

    it("admits a low request immediately when nothing normal is waiting", async () => {
      const admission = new CsAutomaticRunAdmission(2);
      const low = await admission.acquire({ conversationId: "low", priority: "low" });
      expect(admission.getDebugState()).toMatchObject({ active: 1, queued: 0 });
      low.release();
    });

    it("never preempts a running low lease for a newly queued normal request", async () => {
      const admission = new CsAutomaticRunAdmission(1);
      const low = await admission.acquire({ conversationId: "low", priority: "low" });
      let normalAdmitted = false;
      const normal = admission.acquire({ conversationId: "normal" }).then((lease) => {
        normalAdmitted = true;
        return lease;
      });
      await Promise.resolve();
      expect(normalAdmitted).toBe(false);
      expect(admission.getDebugState()).toMatchObject({ active: 1, queued: 1 });

      low.release();
      (await normal).release();
      expect(normalAdmitted).toBe(true);
    });

    it("keeps pause and resume ordering with mixed priorities", async () => {
      const admission = new CsAutomaticRunAdmission(1);
      admission.pause();
      const order: string[] = [];
      const low = admission
        .acquire({ conversationId: "low", priority: "low" })
        .then((lease) => (order.push("low"), lease));
      const normal = admission
        .acquire({ conversationId: "normal" })
        .then((lease) => (order.push("normal"), lease));
      expect(admission.getDebugState()).toMatchObject({ active: 0, queued: 2, queuedLow: 1 });

      admission.resume();
      (await normal).release();
      (await low).release();
      expect(order).toEqual(["normal", "low"]);
    });

    it("rejects queued requests of every priority on reset", async () => {
      const admission = new CsAutomaticRunAdmission(1);
      await admission.acquire({ conversationId: "running" });
      const low = admission.acquire({ conversationId: "low", priority: "low" });
      const normal = admission.acquire({ conversationId: "normal" });

      admission.reset("auth_change");

      await expect(low).rejects.toBeInstanceOf(CsRunAdmissionCancelledError);
      await expect(normal).rejects.toBeInstanceOf(CsRunAdmissionCancelledError);
      expect(admission.getDebugState()).toMatchObject({ queued: 0, queuedLow: 0 });
    });

    it("maps a batch id to the low lane and no batch to normal", () => {
      expect(csRunAdmissionPriorityForBatch("batch-1")).toBe("low");
      expect(csRunAdmissionPriorityForBatch(undefined)).toBe("normal");
      expect(csRunAdmissionPriorityForBatch(null)).toBe("normal");
      expect(csRunAdmissionPriorityForBatch("")).toBe("normal");
    });
  });
});
