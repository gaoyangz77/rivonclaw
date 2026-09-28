import { EventEmitter } from "node:events";
import type { App, BrowserWindow } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startResponsivenessMonitor } from "./responsiveness-monitor.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("startResponsivenessMonitor", () => {
  it("records renderer and child process failures and removes its listeners", () => {
    const app = new EventEmitter();
    const powerMonitor = new EventEmitter();
    const window = new EventEmitter() as EventEmitter & {
      webContents: EventEmitter & { id: number };
    };
    window.webContents = Object.assign(new EventEmitter(), { id: 42 });
    const log = { warn: vi.fn(), error: vi.fn() };

    const stop = startResponsivenessMonitor({
      app: app as unknown as App,
      window: window as unknown as BrowserWindow,
      powerMonitor,
      log,
    });

    window.emit("unresponsive");
    window.emit("responsive");
    window.webContents.emit("render-process-gone", {}, { reason: "crashed", exitCode: 9 });
    app.emit("child-process-gone", {}, {
      type: "GPU",
      reason: "crashed",
      exitCode: 10,
      serviceName: "",
      name: "GPU Process",
    });

    expect(log.warn).toHaveBeenCalledTimes(2);
    expect(log.error).toHaveBeenCalledTimes(2);

    stop();
    window.emit("unresponsive");
    expect(log.warn).toHaveBeenCalledTimes(2);
    expect(powerMonitor.listenerCount("suspend")).toBe(0);
    expect(powerMonitor.listenerCount("resume")).toBe(0);
  });

  it("reports a delayed main event loop after it resumes", () => {
    vi.useFakeTimers();
    const app = new EventEmitter();
    const window = new EventEmitter() as EventEmitter & {
      webContents: EventEmitter & { id: number };
    };
    window.webContents = Object.assign(new EventEmitter(), { id: 7 });
    const log = { warn: vi.fn(), error: vi.fn() };
    let now = 0;

    const stop = startResponsivenessMonitor({
      app: app as unknown as App,
      window: window as unknown as BrowserWindow,
      log,
      sampleIntervalMs: 1_000,
      warnLagMs: 2_000,
      now: () => now,
    });

    now = 3_500;
    vi.advanceTimersByTime(1_000);

    expect(log.warn).toHaveBeenCalledWith("Electron main event loop was delayed", {
      lagMs: 2_500,
      sampleIntervalMs: 1_000,
    });
    stop();
  });

  it("does not classify system sleep as main-loop lag", () => {
    vi.useFakeTimers();
    const app = new EventEmitter();
    const powerMonitor = new EventEmitter();
    const window = new EventEmitter() as EventEmitter & {
      webContents: EventEmitter & { id: number };
    };
    window.webContents = Object.assign(new EventEmitter(), { id: 8 });
    const log = { warn: vi.fn(), error: vi.fn() };
    let now = 0;

    const stop = startResponsivenessMonitor({
      app: app as unknown as App,
      window: window as unknown as BrowserWindow,
      powerMonitor,
      log,
      sampleIntervalMs: 1_000,
      warnLagMs: 2_000,
      now: () => now,
    });

    powerMonitor.emit("suspend");
    now = 60 * 60 * 1_000;
    vi.advanceTimersByTime(1_000);
    powerMonitor.emit("resume");
    now += 1_000;
    vi.advanceTimersByTime(1_000);

    expect(log.warn).not.toHaveBeenCalled();
    stop();
  });

  it("can clean up after the BrowserWindow has been destroyed", () => {
    const app = new EventEmitter();
    const webContents = Object.assign(new EventEmitter(), { id: 9 });
    const window = new EventEmitter() as EventEmitter & { webContents: typeof webContents };
    let destroyed = false;
    Object.defineProperty(window, "webContents", {
      get() {
        if (destroyed) throw new Error("Object has been destroyed");
        return webContents;
      },
    });

    const stop = startResponsivenessMonitor({
      app: app as unknown as App,
      window: window as unknown as BrowserWindow,
      log: { warn: vi.fn(), error: vi.fn() },
    });
    destroyed = true;

    expect(stop).not.toThrow();
  });
});
