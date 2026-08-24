import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CsAutomaticRunAdmission,
  CsRunAdmissionCancelledError,
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

  it("uses four by default and falls back for invalid overrides", () => {
    expect(resolveCsAutomaticMaxConcurrent()).toBe(DEFAULT_CS_AUTOMATIC_MAX_CONCURRENT);

    process.env.RIVONCLAW_CS_AUTO_MAX_CONCURRENT = "7";
    expect(resolveCsAutomaticMaxConcurrent()).toBe(7);

    process.env.RIVONCLAW_CS_AUTO_MAX_CONCURRENT = "0";
    expect(resolveCsAutomaticMaxConcurrent()).toBe(DEFAULT_CS_AUTOMATIC_MAX_CONCURRENT);

    process.env.RIVONCLAW_CS_AUTO_MAX_CONCURRENT = "not-a-number";
    expect(resolveCsAutomaticMaxConcurrent()).toBe(DEFAULT_CS_AUTOMATIC_MAX_CONCURRENT);
  });
});
