import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fork } from "node:child_process";
import { migrateVendorStateInChild } from "./vendor-state-migration.js";
import { convergeOrphanedRunningSessionsBeforeGateway } from "../../../../packages/gateway/src/vendor/state-migration.js";

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

  it.each([undefined, "0"])("passes the Desktop restart policy even when the parent has %s", async (inherited) => {
    vi.stubEnv("OPENCLAW_DISABLE_SESSION_RESTART_RECOVERY", inherited);
    vi.stubEnv("OPENCLAW_DISABLE_OUTBOUND_DELIVERY_RECOVERY", inherited);
    const promise = migrateVendorStateInChild(options);
    const env = vi.mocked(fork).mock.calls[0][2]?.env;
    child.emit("message", { ok: true });
    child.emit("close", 0, null);
    await promise;

    expect(env?.OPENCLAW_DISABLE_SESSION_RESTART_RECOVERY).toBe("1");
    expect(env?.OPENCLAW_DISABLE_OUTBOUND_DELIVERY_RECOVERY).toBe("1");
    expect(process.env.OPENCLAW_DISABLE_SESSION_RESTART_RECOVERY).toBe(inherited);
  });

  it("actually converges orphaned sessions with the fork environment, without losing history or model selection", async () => {
    vi.stubEnv("OPENCLAW_DISABLE_SESSION_RESTART_RECOVERY", undefined);
    const stateDir = mkdtempSync(join(tmpdir(), "desktop-orphaned-session-"));
    const agentDir = join(stateDir, "agents", "main", "agent");
    mkdirSync(agentDir, { recursive: true });
    const database = new DatabaseSync(join(agentDir, "openclaw-agent.sqlite"));
    const entry = {
      sessionId: "existing-session", status: "running", updatedAt: 123,
      abortedLastRun: true, restartRecoveryDeliveryRunId: "interrupted-run",
      restartRecoveryDeliveryReceiptState: "terminal-pending", modelOverride: "rivonclaw-flagship",
    };
    try {
      database.exec(`
        CREATE TABLE session_nodes (session_key TEXT PRIMARY KEY, current_session_id TEXT, entry_json TEXT, status TEXT);
        CREATE TABLE session_windows (session_id TEXT PRIMARY KEY, status TEXT);
        CREATE TABLE transcript_events (session_id TEXT, text TEXT);
        INSERT INTO session_windows VALUES ('existing-session', 'running'), ('finished-session', 'done');
        INSERT INTO transcript_events VALUES ('existing-session', 'previous conversation');
      `);
      const insert = database.prepare("INSERT INTO session_nodes VALUES (?, ?, ?, ?)");
      insert.run("agent:main:feishu:default:direct:ou_fixture", entry.sessionId, JSON.stringify(entry), "running");
      insert.run("agent:main:main", "finished-session", '{"status":"done"}', "done");
      // This is the old launcher's environment: the same database stays stuck.
      expect(convergeOrphanedRunningSessionsBeforeGateway(stateDir)).toBe(0);

      const promise = migrateVendorStateInChild({ ...options, stateDir });
      const env = vi.mocked(fork).mock.calls[0][2]?.env;
      child.emit("message", { ok: true });
      child.emit("close", 0, null);
      await promise;
      expect(convergeOrphanedRunningSessionsBeforeGateway(stateDir, env)).toBe(1);
      expect(convergeOrphanedRunningSessionsBeforeGateway(stateDir, env)).toBe(0);

      const row = database.prepare("SELECT entry_json FROM session_nodes WHERE current_session_id = ?")
        .get(entry.sessionId) as { entry_json: string };
      expect(JSON.parse(row.entry_json)).toEqual({ ...entry, status: "killed" });
      expect(database.prepare("SELECT * FROM session_windows ORDER BY session_id").all()).toEqual([
        { session_id: entry.sessionId, status: "killed" },
        { session_id: "finished-session", status: "done" },
      ]);
      expect(database.prepare("SELECT * FROM transcript_events").all()).toEqual([
        { session_id: entry.sessionId, text: "previous conversation" },
      ]);
    } finally {
      database.close();
      rmSync(stateDir, { recursive: true, force: true });
    }
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
