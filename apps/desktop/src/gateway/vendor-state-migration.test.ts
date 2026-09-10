import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fork } from "node:child_process";
import { migrateVendorStateInChild } from "./vendor-state-migration.js";

vi.mock("node:child_process", () => ({ fork: vi.fn() }));
vi.mock("@rivonclaw/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe("vendor state migration Node boundary", () => {
  const options = {
    stateDir: "C:\\Users\\Test User\\.rivonclaw\\openclaw",
    vendorDir: "D:\\Program Files\\TK Copilot\\resources\\vendor\\openclaw",
    configPath: "C:\\Users\\Test User\\.rivonclaw\\openclaw\\openclaw.json",
  };
  let child: EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: ReturnType<typeof vi.fn> };
  let exitListeners: number;

  beforeEach(() => {
    vi.useFakeTimers();
    exitListeners = process.listenerCount("exit");
    child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn(),
    });
    vi.mocked(fork).mockReset().mockReturnValue(child as unknown as ReturnType<typeof fork>);
  });
  afterEach(() => {
    expect(process.listenerCount("exit")).toBe(exitListeners);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("forces Node mode without changing Electron's environment or inheriting inspector args", async () => {
    vi.stubEnv("ELECTRON_RUN_AS_NODE", "");
    const promise = migrateVendorStateInChild(options);
    expect(fork).toHaveBeenCalledWith(
      expect.stringMatching(/vendor-state-migration-worker\.cjs$/),
      [JSON.stringify(options)],
      expect.objectContaining({
        execArgv: [], windowsHide: true,
        env: expect.objectContaining({ ELECTRON_RUN_AS_NODE: "1" }),
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      }),
    );
    expect(process.env.ELECTRON_RUN_AS_NODE).toBe("");
    child.emit("message", { ok: true });
    child.emit("close", 0, null);
    await promise;
  });

  it("waits for child close, leaving the parent event loop responsive during a long migration", async () => {
    const done = vi.fn();
    const promise = migrateVendorStateInChild(options).then(done);
    const heartbeat = vi.fn();
    setTimeout(heartbeat, 1000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(heartbeat).toHaveBeenCalledOnce();
    expect(child.kill).not.toHaveBeenCalled();
    child.emit("message", { ok: true });
    child.emit("exit", 0, null);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    child.emit("close", 0, null);
    await promise;
    expect(done).toHaveBeenCalledOnce();
  });

  it.each([
    { message: undefined, code: 0, signal: null, error: "completed=false" },
    { message: { ok: true }, code: 1, signal: null, error: "exit=1" },
    { message: { ok: false, error: "database migration failed" }, code: 1, signal: null, error: "database migration failed" },
    { message: undefined, code: null, signal: "SIGKILL", error: "signal=SIGKILL" },
  ])("rejects incomplete or failed children: $error", async ({ message, code, signal, error }) => {
    const promise = migrateVendorStateInChild(options);
    const assertion = expect(promise).rejects.toThrow(error);
    child.emit("message", null);
    child.emit("message", message);
    child.emit("close", code, signal);
    await assertion;
  });

  it("reports spawn errors and cleans up listeners", async () => {
    const promise = migrateVendorStateInChild(options);
    const assertion = expect(promise).rejects.toThrow("ENOENT");
    child.emit("error", new Error("ENOENT"));
    child.emit("close", -2, null);
    await assertion;
  });

  it("propagates synchronous fork failures without leaving timers", async () => {
    vi.mocked(fork).mockImplementation(() => { throw new Error("fork failed"); });
    await expect(migrateVendorStateInChild(options)).rejects.toThrow("fork failed");
  });

  it("stops its migration child when Desktop exits", async () => {
    const promise = migrateVendorStateInChild(options);
    const assertion = expect(promise).rejects.toThrow("SIGTERM");
    const onExit = process.listeners("exit").at(-1)!;
    onExit(0);
    expect(child.kill).toHaveBeenCalledOnce();
    child.emit("close", null, "SIGTERM");
    await assertion;
  });
});
