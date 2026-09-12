import { EventEmitter } from "node:events";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GATEWAY_CONTROL_PRELOAD, GATEWAY_STOP_MESSAGE } from "./process-control.js";
import { GATEWAY_STOP_GRACE_MS } from "./process-control.js";
import { DEFAULTS } from "@rivonclaw/core";

function fixture(parentMatches = true) {
  const child = Object.assign(new EventEmitter(), {
    send: vi.fn(),
    connected: true,
    ppid: 42,
    env: { RIVONCLAW_GATEWAY_PARENT_PID: parentMatches ? "42" : "43" },
  });
  runInNewContext(GATEWAY_CONTROL_PRELOAD, { process: child, setTimeout });
  return child;
}

afterEach(() => vi.useRealTimers());

describe("Gateway private shutdown IPC", () => {
  it("finishes the Gateway watchdog before the Desktop shutdown deadline", () => {
    expect(DEFAULTS.desktop.shutdownTimeoutMs).toBeGreaterThan(GATEWAY_STOP_GRACE_MS);
  });
  it("delivers exactly one SIGTERM to the runtime, not an OS kill", () => {
    const child = fixture();
    const stop = vi.fn();
    child.on("SIGTERM", stop);
    child.emit("message", { type: "other" });
    child.emit("message", null);
    expect(stop).not.toHaveBeenCalled();
    child.emit("message", { type: GATEWAY_STOP_MESSAGE });
    child.emit("message", { type: GATEWAY_STOP_MESSAGE });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("waits for startup to register its shutdown handler", async () => {
    vi.useFakeTimers();
    const child = fixture();
    child.emit("message", { type: GATEWAY_STOP_MESSAGE });
    await vi.advanceTimersByTimeAsync(100);
    const stop = vi.fn();
    child.on("SIGTERM", stop);
    await vi.advanceTimersByTimeAsync(100);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not register in a descendant inheriting NODE_OPTIONS", () => {
    expect(fixture(false).listenerCount("message")).toBe(0);
  });
});
