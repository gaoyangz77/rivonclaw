import { powerMonitor } from "electron";
import { createLogger } from "@rivonclaw/logger";

const log = createLogger("idle-monitor");

/** How long the machine must be untouched before the office takes over. */
export const DEFAULT_IDLE_THRESHOLD_MS = 5 * 60_000;

/**
 * How often idleness is sampled.
 *
 * `powerMonitor.getSystemIdleTime()` is a cheap OS call, but it is still a
 * timer in the main process, so the interval is coarse. Exit latency does not
 * depend on it: the overlay closes on the viewer's own input, not on the next
 * poll saying the machine woke up.
 */
const POLL_INTERVAL_MS = 5_000;

export type IdleState = { idle: boolean; idleForMs: number };

export interface IdleMonitor {
  state(): IdleState;
  stop(): void;
}

export interface IdleMonitorDeps {
  /** Fired only on a transition, never on every poll. */
  onChange: (state: IdleState) => void;
  thresholdMs?: number;
  /** Overridable for tests; seconds, matching Electron's own signature. */
  readIdleSeconds?: () => number;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

/**
 * Watches whether the user has stepped away from the machine.
 *
 * System idle, not window idle: a user typing in another application is not
 * away, and showing them a screensaver because they stopped touching this
 * window would be wrong. The tradeoff is that a deliberately unattended demo
 * still needs the manual entry point, which the Panel provides.
 */
export function startIdleMonitor(deps: IdleMonitorDeps): IdleMonitor {
  const thresholdMs = deps.thresholdMs ?? DEFAULT_IDLE_THRESHOLD_MS;
  const readIdleSeconds = deps.readIdleSeconds ?? (() => powerMonitor.getSystemIdleTime());
  const setIntervalFn = deps.setIntervalFn ?? setInterval;
  const clearIntervalFn = deps.clearIntervalFn ?? clearInterval;

  let current: IdleState = { idle: false, idleForMs: 0 };

  const poll = (): void => {
    const idleForMs = readIdleSeconds() * 1_000;
    const idle = idleForMs >= thresholdMs;
    if (idle === current.idle) {
      current = { idle, idleForMs };
      return;
    }
    current = { idle, idleForMs };
    log.info(`System ${idle ? "idle" : "active"} after ${Math.round(idleForMs / 1000)}s`);
    deps.onChange(current);
  };

  const timer = setIntervalFn(poll, POLL_INTERVAL_MS);
  (timer as { unref?: () => void }).unref?.();

  return {
    state: () => current,
    stop: () => clearIntervalFn(timer),
  };
}
