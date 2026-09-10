import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { calculateBackoff, createLineReader, GatewayLauncher, isGatewayReadinessProbeClose } from "./launcher.js";
import type { GatewayLaunchOptions } from "./types.js";
import * as fs from "node:fs";
import { GATEWAY_STOP_GRACE_MS, GATEWAY_STOP_MESSAGE } from "./process-control.js";

// ─── calculateBackoff tests ────────────────────────────────────────────────

describe("calculateBackoff", () => {
  it("returns initialBackoffMs for the first attempt", () => {
    expect(calculateBackoff(1, 1000, 30_000)).toBe(1000);
  });

  it("doubles the delay for each subsequent attempt", () => {
    expect(calculateBackoff(2, 1000, 30_000)).toBe(2000);
    expect(calculateBackoff(3, 1000, 30_000)).toBe(4000);
    expect(calculateBackoff(4, 1000, 30_000)).toBe(8000);
  });

  it("caps the delay at maxBackoffMs", () => {
    expect(calculateBackoff(10, 1000, 30_000)).toBe(30_000);
    expect(calculateBackoff(100, 1000, 30_000)).toBe(30_000);
  });

  it("respects custom initial and max values", () => {
    expect(calculateBackoff(1, 500, 5000)).toBe(500);
    expect(calculateBackoff(2, 500, 5000)).toBe(1000);
    expect(calculateBackoff(3, 500, 5000)).toBe(2000);
    expect(calculateBackoff(4, 500, 5000)).toBe(4000);
    expect(calculateBackoff(5, 500, 5000)).toBe(5000);
  });
});

describe("createLineReader", () => {
  it("reassembles split UTF-8 and JSON lines", () => {
    const lines: string[] = [];
    const reader = createLineReader((line) => lines.push(line));
    const payload = Buffer.from('[desktop-perf-profile] {"name":"网关","value":1}\nnext');

    reader.push(payload.subarray(0, 30));
    reader.push(payload.subarray(30, 38));
    reader.push(payload.subarray(38));
    reader.end();

    expect(lines).toEqual(['[desktop-perf-profile] {"name":"网关","value":1}', "next"]);
  });
});

// ─── Mock child_process ────────────────────────────────────────────────────

describe("gateway readiness probe diagnostics", () => {
  const probe = "[ws] closed before connect conn=test remote=127.0.0.1 fwd=n/a origin=n/a host=127.0.0.1:53571 ua=n/a code=1005 reason=n/a phase=ws_upgrade_started";
  it("recognizes only the anonymous loopback readiness probe, including colored output", () => {
    expect(isGatewayReadinessProbeClose(probe)).toBe(true);
    expect(isGatewayReadinessProbeClose(`\u001b[33m${probe}\u001b[39m`)).toBe(true);
  });
  it.each([
    probe.replace("code=1005 reason=n/a", "code=1008 reason=invalid handshake: first request must be connect"),
    probe.replace("origin=n/a", "origin=http://localhost:5180"),
    probe.replace("ua=n/a", "ua=Electron"),
    probe.replace("remote=127.0.0.1", "remote=203.0.113.1"),
    "security warning: dangerous config flags enabled",
    'Plugin command "/dashboard" conflicts with an existing Telegram command.',
    "[DEP0040] DeprecationWarning: The punycode module is deprecated",
  ])("keeps actionable or unrelated diagnostics visible: %s", (line) => {
    expect(isGatewayReadinessProbeClose(line)).toBe(false);
  });
});

class MockChildProcess extends EventEmitter {
  pid = 12345;
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  connected = true;
  exitCode: number | null = null;
  signalCode: string | null = null;
  send = vi.fn((_message: unknown, callback?: (error: Error | null) => void) => {
    callback?.(null);
    return true;
  });
  killSignals: string[] = [];

  kill(signal?: string): boolean {
    this.killSignals.push(signal ?? "SIGTERM");
    this.killed = true;
    return true;
  }
}

let mockChild: MockChildProcess;
const mockExecSync = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    mockChild = new MockChildProcess();
    return mockChild;
  }),
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock("@rivonclaw/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../utils/cli-utils.js", () => ({
  normalizePathEnvironment: (env: NodeJS.ProcessEnv) => ({
    ...env,
    PATH: `${env.PATH ?? ""}:/mock/enriched/bin`,
  }),
}));

// ─── GatewayLauncher tests ─────────────────────────────────────────────────

function createLauncher(overrides?: Partial<GatewayLaunchOptions>): GatewayLauncher {
  return new GatewayLauncher({
    entryPath: "/fake/openclaw.mjs",
    initialBackoffMs: 10, // fast for tests
    maxBackoffMs: 100,
    healthyThresholdMs: 50,
    ...overrides,
  });
}

describe("GatewayLauncher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.mocked(fs.existsSync).mockImplementation(() => false);
    vi.clearAllMocks();
  });

  // ── State & Status ──

  describe("initial state", () => {
    it("starts in stopped state", () => {
      const launcher = createLauncher();
      const status = launcher.getStatus();
      expect(status.state).toBe("stopped");
      expect(status.pid).toBeNull();
      expect(status.restartCount).toBe(0);
      expect(status.lastStartedAt).toBeNull();
      expect(status.lastError).toBeNull();
    });
  });

  // ── Spawn ──

  describe("start()", () => {
    it("transitions to running state and emits started event", async () => {
      const launcher = createLauncher();
      const startedFn = vi.fn();
      launcher.on("started", startedFn);

      await launcher.start();

      const status = launcher.getStatus();
      expect(status.state).toBe("running");
      expect(status.pid).toBe(12345);
      expect(status.lastStartedAt).toBeInstanceOf(Date);
      expect(startedFn).toHaveBeenCalledWith(12345);
    });

    it("passes correct spawn arguments", async () => {
      const { spawn } = await import("node:child_process");

      const launcher = createLauncher({
        entryPath: "/path/to/openclaw.mjs",
        configPath: "/custom/config.json",
        stateDir: "/custom/state",
        env: { CUSTOM_VAR: "value" },
      });

      await launcher.start();

      expect(spawn).toHaveBeenCalledWith(
        "node",
        ["/path/to/openclaw.mjs", "gateway"],
        expect.objectContaining({
          stdio: ["ignore", "pipe", "pipe", "ipc"],
          env: expect.objectContaining({
            OPENCLAW_CONFIG_PATH: "/custom/config.json",
            OPENCLAW_STATE_DIR: "/custom/state",
            RIVONCLAW_OPENCLAW_DIST_DIR: "/path/to/dist",
            OPENCLAW_NO_RESPAWN: "1",
            OPENCLAW_SUPERVISOR_MODE: "external",
            CUSTOM_VAR: "value",
          }),
        }),
      );
    });

    it("keeps Desktop lifecycle ownership despite an inherited supervisor override", async () => {
      const { spawn } = await import("node:child_process");
      const launcher = createLauncher({
        env: { OPENCLAW_SUPERVISOR_MODE: "internal", OPENCLAW_NO_RESPAWN: "0" },
      });

      await launcher.start();

      expect(vi.mocked(spawn).mock.calls.at(-1)?.[2]?.env).toMatchObject({
        OPENCLAW_NO_RESPAWN: "1",
        OPENCLAW_SUPERVISOR_MODE: "external",
      });
    });

    it("disables source-checkout caching before Node can spawn another supervisor", async () => {
      const { spawn } = await import("node:child_process");
      vi.mocked(fs.existsSync).mockImplementation((p) => String(p) === "/fake/.git");
      await createLauncher({ stateDir: "/state" }).start();
      const env = vi.mocked(spawn).mock.calls.at(-1)?.[2]?.env;
      expect(env?.NODE_DISABLE_COMPILE_CACHE).toBe("1");
      expect(env?.NODE_COMPILE_CACHE).toBeUndefined();
      expect(env?.OPENCLAW_PACKAGED_COMPILE_CACHE_RESPAWNED).toBeUndefined();
    });

    it("keeps a prepared cache without a wrapper in packaged installs", async () => {
      const { spawn } = await import("node:child_process");
      await createLauncher({ stateDir: "/state" }).start();
      const env = vi.mocked(spawn).mock.calls.at(-1)?.[2]?.env;
      expect(env?.NODE_COMPILE_CACHE).toBe("/state/compile-cache");
      expect(env?.OPENCLAW_PACKAGED_COMPILE_CACHE_RESPAWNED).toBe("1");
      expect(env?.RIVONCLAW_GATEWAY_PARENT_PID).toBe(String(process.pid));
      expect(env?.NODE_OPTIONS).toContain("gateway-control.cjs");
    });

    it("respects an explicitly disabled compile cache", async () => {
      const { spawn } = await import("node:child_process");
      await createLauncher({
        stateDir: "/state",
        env: { NODE_DISABLE_COMPILE_CACHE: "1" },
      }).start();
      const env = vi.mocked(spawn).mock.calls.at(-1)?.[2]?.env;
      expect(env?.NODE_COMPILE_CACHE).toBeUndefined();
      expect(env?.OPENCLAW_PACKAGED_COMPILE_CACHE_RESPAWNED).toBeUndefined();
    });

    it("passes the runtime gateway port override to OpenClaw", async () => {
      const { spawn } = await import("node:child_process");

      const launcher = createLauncher({
        entryPath: "/path/to/openclaw.mjs",
        gatewayPort: 61471,
      });

      await launcher.start();

      expect(spawn).toHaveBeenCalledWith(
        "node",
        ["/path/to/openclaw.mjs", "gateway", "--port", "61471"],
        expect.objectContaining({
          env: expect.objectContaining({
            OPENCLAW_GATEWAY_PORT: "61471",
          }),
        }),
      );
    });

    it("uses the enriched PATH when launching the gateway", async () => {
      const { spawn } = await import("node:child_process");

      const launcher = createLauncher({
        entryPath: "/path/to/openclaw.mjs",
      });

      await launcher.start();

      expect(spawn).toHaveBeenCalledWith(
        "node",
        ["/path/to/openclaw.mjs", "gateway"],
        expect.objectContaining({
          env: expect.objectContaining({
            PATH: `${process.env.PATH ?? ""}:/mock/enriched/bin`,
          }),
        }),
      );
    });

    it("enriches an explicit PATH override when launching the gateway", async () => {
      const { spawn } = await import("node:child_process");

      const launcher = createLauncher({
        entryPath: "/path/to/openclaw.mjs",
        env: { PATH: "/custom/bin" },
      });

      await launcher.start();

      expect(spawn).toHaveBeenCalledWith(
        "node",
        ["/path/to/openclaw.mjs", "gateway"],
        expect.objectContaining({
          env: expect.objectContaining({
            PATH: "/custom/bin:/mock/enriched/bin",
          }),
        }),
      );
    });

    it("is a no-op when already running", async () => {
      const { spawn } = await import("node:child_process");

      const launcher = createLauncher();
      await launcher.start();
      await launcher.start(); // should not spawn again

      expect(spawn).toHaveBeenCalledTimes(1);
    });
  });

  // ── Stop ──

  describe("stop()", () => {
    it("requests orderly shutdown through IPC and transitions to stopped", async () => {
      const launcher = createLauncher({ stateDir: "/state" });
      await launcher.start();

      const stopPromise = launcher.stop();
      expect(launcher.getStatus().state).toBe("stopping");

      // Simulate process exit
      mockChild.emit("exit", 0, null);
      await stopPromise;

      expect(launcher.getStatus().state).toBe("stopped");
      expect(mockChild.send).toHaveBeenCalledWith(
        { type: GATEWAY_STOP_MESSAGE },
        expect.any(Function),
      );
      expect(mockExecSync).not.toHaveBeenCalled();
      expect(mockChild.killSignals).toEqual([]);
    });

    it("does not force-kill Windows on a normal or repeated stop", async () => {
      vi.stubGlobal(
        "process",
        new Proxy(process, {
          get: (target, key) => (key === "platform" ? "win32" : Reflect.get(target, key)),
        }),
      );
      const launcher = createLauncher({ stateDir: "/state" });
      await launcher.start();
      const first = launcher.stop();
      const second = launcher.stop();
      await vi.advanceTimersByTimeAsync(6_000);
      expect(mockExecSync).not.toHaveBeenCalled();
      expect(mockChild.send).toHaveBeenCalledTimes(1);
      mockChild.emit("exit", 0, null);
      await Promise.all([first, second]);
      await vi.advanceTimersByTimeAsync(GATEWAY_STOP_GRACE_MS);
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it("bounds a hung Windows shutdown with process-tree termination", async () => {
      vi.stubGlobal(
        "process",
        new Proxy(process, {
          get: (target, key) => (key === "platform" ? "win32" : Reflect.get(target, key)),
        }),
      );
      const launcher = createLauncher({ stateDir: "/state" });
      await launcher.start();
      const stop = launcher.stop();
      await vi.advanceTimersByTimeAsync(GATEWAY_STOP_GRACE_MS - 1);
      expect(mockExecSync).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(mockExecSync).toHaveBeenCalledWith(`taskkill /T /F /PID ${mockChild.pid}`, {
        stdio: "ignore",
      });
      mockChild.emit("exit", 1, null);
      await stop;
    });

    it("retains the shutdown deadline if the IPC channel rejects the request", async () => {
      vi.stubGlobal(
        "process",
        new Proxy(process, {
          get: (target, key) => (key === "platform" ? "win32" : Reflect.get(target, key)),
        }),
      );
      const launcher = createLauncher({ stateDir: "/state" });
      await launcher.start();
      mockChild.send.mockImplementation((_message, cb) => {
        cb?.(new Error("IPC closed"));
        return false;
      });
      const stop = launcher.stop();
      expect(mockExecSync).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(GATEWAY_STOP_GRACE_MS);
      expect(mockExecSync).toHaveBeenCalledTimes(1);
      mockChild.emit("exit", 1, null);
      await stop;
    });

    it("is safe to call when already stopped", async () => {
      const launcher = createLauncher();
      await launcher.stop(); // should not throw
      expect(launcher.getStatus().state).toBe("stopped");
    });
  });

  // ── Reload (SIGUSR1) ──

  describe("reload()", () => {
    it.skipIf(process.platform === "win32")(
      "sends SIGUSR1 when the gateway is running",
      async () => {
        const launcher = createLauncher();
        await launcher.start();

        // Advance past the startup grace period so reload is not skipped
        vi.advanceTimersByTime(15_000);

        await launcher.reload();

        expect(mockChild.killSignals).toContain("SIGUSR1");
        expect(launcher.getStatus().state).toBe("running");
      },
    );

    it("skips reload during startup grace period", async () => {
      const { spawn } = await import("node:child_process");
      const launcher = createLauncher();
      await launcher.start();

      // Immediately call reload — gateway just spawned (< 15s ago)
      await launcher.reload();

      // Should NOT have stopped+restarted — process still the same
      expect(spawn).toHaveBeenCalledTimes(1);
      expect(launcher.getStatus().state).toBe("running");
      // No SIGUSR1 or SIGTERM sent
      expect(mockChild.killSignals).toHaveLength(0);
    });

    it.skipIf(process.platform === "win32")(
      "sends SIGUSR1 after startup grace period",
      async () => {
        const launcher = createLauncher();
        await launcher.start();

        // Advance past the 15s startup grace period
        vi.advanceTimersByTime(15_000);

        await launcher.reload();

        expect(mockChild.killSignals).toContain("SIGUSR1");
        expect(launcher.getStatus().state).toBe("running");
      },
    );

    it("falls back to stop+start when the gateway is stopped", async () => {
      const { spawn } = await import("node:child_process");
      const launcher = createLauncher();

      // reload() on a stopped launcher should spawn a new process
      await launcher.reload();

      expect(launcher.getStatus().state).toBe("running");
      expect(spawn).toHaveBeenCalled();
    });
  });

  // ── Restart on crash ──

  describe("auto-restart on crash", () => {
    it("emits restarting event and restarts after crash", async () => {
      const launcher = createLauncher();
      const restartingFn = vi.fn();
      launcher.on("restarting", restartingFn);

      await launcher.start();

      // Simulate crash
      mockChild.emit("exit", 1, null);

      expect(restartingFn).toHaveBeenCalledWith(1, 10); // attempt 1, 10ms delay

      // Advance past the backoff delay
      vi.advanceTimersByTime(10);

      // Should have re-spawned
      expect(launcher.getStatus().state).toBe("running");
    });

    it("uses exponential backoff for repeated crashes", async () => {
      const launcher = createLauncher();
      const restartingFn = vi.fn();
      launcher.on("restarting", restartingFn);

      await launcher.start();

      // First crash
      mockChild.emit("exit", 1, null);
      expect(restartingFn).toHaveBeenLastCalledWith(1, 10);
      vi.advanceTimersByTime(10);

      // Second crash
      mockChild.emit("exit", 1, null);
      expect(restartingFn).toHaveBeenLastCalledWith(2, 20);
      vi.advanceTimersByTime(20);

      // Third crash
      mockChild.emit("exit", 1, null);
      expect(restartingFn).toHaveBeenLastCalledWith(3, 40);
    });

    it("does not restart when stop() was called", async () => {
      const launcher = createLauncher();
      const restartingFn = vi.fn();
      launcher.on("restarting", restartingFn);

      await launcher.start();
      const stopPromise = launcher.stop();
      mockChild.emit("exit", 0, null);
      await stopPromise;

      expect(restartingFn).not.toHaveBeenCalled();
      expect(launcher.getStatus().state).toBe("stopped");
    });

    it("stops after maxRestarts is exceeded", async () => {
      const launcher = createLauncher({ maxRestarts: 2 });
      const errorFn = vi.fn();
      launcher.on("error", errorFn);

      await launcher.start();

      // Crash 1
      mockChild.emit("exit", 1, null);
      vi.advanceTimersByTime(10);

      // Crash 2
      mockChild.emit("exit", 1, null);
      vi.advanceTimersByTime(20);

      // Crash 3 — exceeds maxRestarts (2)
      mockChild.emit("exit", 1, null);

      expect(launcher.getStatus().state).toBe("stopped");
      expect(errorFn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("max restarts"),
        }),
      );
    });

    it("resets backoff after healthy threshold", async () => {
      const launcher = createLauncher({
        healthyThresholdMs: 50,
      });
      const restartingFn = vi.fn();
      launcher.on("restarting", restartingFn);

      await launcher.start();

      // Multiple quick crashes to build up backoff
      mockChild.emit("exit", 1, null);
      vi.advanceTimersByTime(10);

      mockChild.emit("exit", 1, null);
      vi.advanceTimersByTime(20);

      // Now advance time so the process appears healthy (>= 50ms)
      vi.advanceTimersByTime(50);

      // Crash after healthy period
      mockChild.emit("exit", 1, null);

      // Backoff should be reset to initial (attempt 1 = 10ms)
      expect(restartingFn).toHaveBeenLastCalledWith(1, 10);
    });
  });

  // ── stdout/stderr logging ──

  describe("stdout/stderr capture", () => {
    it("emits stopped event with exit code and signal", async () => {
      const launcher = createLauncher();
      const stoppedFn = vi.fn();
      launcher.on("stopped", stoppedFn);

      await launcher.start();
      launcher["stopRequested"] = true; // prevent restart
      mockChild.emit("exit", 1, "SIGTERM");

      expect(stoppedFn).toHaveBeenCalledWith(1, "SIGTERM");
    });

    it("captures process error events", async () => {
      const launcher = createLauncher();
      const errorFn = vi.fn();
      launcher.on("error", errorFn);

      await launcher.start();

      const err = new Error("spawn failed");
      mockChild.emit("error", err);

      expect(errorFn).toHaveBeenCalledWith(err);
      expect(launcher.getStatus().lastError).toBe("spawn failed");
    });
  });

  describe("setEnv()", () => {
    it("updates env used for next spawn", async () => {
      const { spawn } = await import("node:child_process");

      const launcher = createLauncher({ env: { FOO: "bar" } });
      await launcher.start();

      // First spawn should have FOO=bar (merged with process.env)
      const firstCall = vi.mocked(spawn).mock.calls.at(-1);
      expect(firstCall?.[2]?.env).toHaveProperty("FOO", "bar");

      // Stop gracefully, then update env
      const stopPromise = launcher.stop();
      mockChild.emit("exit", 0, null);
      await stopPromise;

      launcher.setEnv({ BAZ: "qux" });
      await launcher.start();

      // Second spawn should have BAZ=qux but not FOO
      const secondCall = vi.mocked(spawn).mock.calls.at(-1);
      expect(secondCall?.[2]?.env).toHaveProperty("BAZ", "qux");
      expect(secondCall?.[2]?.env).not.toHaveProperty("FOO");
    });
  });
});
