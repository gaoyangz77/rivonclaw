import { describe, expect, it, vi } from "vitest";
import { startIdleMonitor, type IdleState } from "./idle-monitor.js";

function harness(idleSeconds: () => number, thresholdMs = 60_000) {
  const changes: IdleState[] = [];
  let tick: (() => void) | null = null;
  const monitor = startIdleMonitor({
    onChange: (state) => changes.push({ ...state }),
    thresholdMs,
    readIdleSeconds: idleSeconds,
    setIntervalFn: ((fn: () => void) => {
      tick = fn;
      return 1 as unknown as NodeJS.Timeout;
    }) as unknown as typeof setInterval,
    clearIntervalFn: vi.fn() as unknown as typeof clearInterval,
  });
  return { changes, monitor, poll: () => tick?.() };
}

describe("startIdleMonitor", () => {
  it("stays quiet while the machine is in use", () => {
    const { changes, poll } = harness(() => 5);
    poll();
    poll();
    expect(changes).toEqual([]);
  });

  it("reports the moment the threshold is crossed", () => {
    let seconds = 10;
    const { changes, poll } = harness(() => seconds);
    poll();
    seconds = 61;
    poll();
    expect(changes).toEqual([{ idle: true, idleForMs: 61_000 }]);
  });

  // The overlay must not be re-triggered every five seconds for as long as the
  // user is away; only transitions are events.
  it("reports a transition once, not on every poll", () => {
    const { changes, poll } = harness(() => 120);
    poll();
    poll();
    poll();
    expect(changes).toHaveLength(1);
  });

  it("reports the return to activity", () => {
    let seconds = 120;
    const { changes, poll } = harness(() => seconds);
    poll();
    seconds = 0;
    poll();
    expect(changes.map((c) => c.idle)).toEqual([true, false]);
  });

  it("exposes the current state for a client that connects mid-idle", () => {
    const { monitor, poll } = harness(() => 300);
    poll();
    expect(monitor.state()).toMatchObject({ idle: true });
  });
});
