import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const probes = vi.hoisted(() => ({ windows: vi.fn() }));
vi.mock("@vendor/infra/windows-process-start.ts", async (original) => ({
  ...(await original<typeof import("@vendor/infra/windows-process-start.ts")>()),
  readWindowsProcessStartTimeSync: probes.windows,
}));
const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
const WINDOWS_START = 1_787_000_000_123;
let root: string | undefined;
let closeState: (() => void) | undefined;
afterEach(() => {
  Object.defineProperty(process, "platform", platform);
  closeState?.();
  closeState = undefined;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  if (root) rmSync(root, { recursive: true, force: true });
});

async function fixture() {
  vi.resetModules();
  probes.windows.mockReset().mockReturnValue(WINDOWS_START);
  root = mkdtempSync(join(tmpdir(), "retirement-0039-"));
  vi.stubEnv("OPENCLAW_STATE_DIR", root);
  const state = await import("@vendor/state/openclaw-state-db.js");
  const receipts = await import("@vendor/cron/store/run-receipt-store.js");
  const codec = await import("@vendor/cron/store/row-codec.js");
  const { cronStoreKey } = await import("@vendor/cron/store/key.js");
  const pid = await import("@vendor/shared/pid-alive.js");
  closeState = state.closeOpenClawStateDatabaseForTest;
  Object.defineProperty(process, "platform", { value: "win32", configurable: true });
  const job = {
    id: "win32-fence",
    agentId: "main",
    name: "win32 fence",
    enabled: true,
    createdAtMs: 1,
    updatedAtMs: 1,
    schedule: { kind: "every" as const, everyMs: 60_000 },
    sessionTarget: "isolated" as const,
    wakeMode: "next-heartbeat" as const,
    payload: { kind: "agentTurn" as const, message: "audit" },
    state: {},
  };
  const storePath = join(root, "cron", "jobs.json");
  const prepare = (startedAtMs = Date.now()) =>
    receipts.prepareCronRunReceiptClaim({
      storePath,
      job,
      agentId: "main",
      startedAtMs,
    });
  const seed = () =>
    state.runOpenClawStateWriteTransaction(({ db }) => {
      codec.upsertCronJobRow(db, cronStoreKey(storePath), job, 0);
    });
  const claim = (prepared: ReturnType<typeof prepare>) =>
    state.runOpenClawStateWriteTransaction(({ db }) =>
      receipts.claimCronRunReceiptInDatabase({
        database: db,
        prepared,
        resolveAgentId: () => "main",
      }),
    );
  return { state, receipts, pid, storePath, prepare, seed, claim };
}

describe("0039 pristine Windows cron receipt identity", () => {
  it("retries an unavailable self probe, persists a fence, and caches success", async () => {
    const f = await fixture();
    probes.windows.mockReturnValueOnce(null);
    expect(() => f.prepare()).toThrow("without process start identity");
    f.seed();
    const handle = f.claim(f.prepare());
    expect(handle).toMatchObject({ ownerPid: process.pid, ownerStartTime: WINDOWS_START });
    expect(
      f.state
        .openOpenClawStateDatabase()
        .db.prepare(
          "SELECT owner_start_time, owner_pid FROM cron_run_receipts WHERE receipt_id = ?",
        )
        .get(handle.receiptId),
    ).toEqual({ owner_start_time: WINDOWS_START, owner_pid: process.pid });
    f.prepare();
    f.prepare();
    expect(probes.windows.mock.calls.filter(([pid]) => pid === process.pid)).toHaveLength(2);
    f.receipts.releaseLocalCronRunReceiptOwnership(handle);
  });

  it("protects a live owner then reacquires a fence when its Windows PID is reused", async () => {
    const f = await fixture();
    f.seed();
    const handle = f.claim(f.prepare());
    const foreignPid = process.pid + 10_000;
    f.state
      .openOpenClawStateDatabase()
      .db.prepare("UPDATE cron_run_receipts SET owner_pid = ? WHERE receipt_id = ?")
      .run(foreignPid, handle.receiptId);
    f.receipts.releaseLocalCronRunReceiptOwnership(handle);
    vi.spyOn(f.pid, "isPidDefinitelyDead").mockReturnValue(false);
    const live = f.prepare();
    expect(live.observedStale).toBe(false);
    expect(() => f.claim(live)).toThrow(f.receipts.CronRunReceiptConflictError);
    probes.windows.mockImplementation((pid) =>
      pid === foreignPid ? WINDOWS_START + 1 : WINDOWS_START,
    );
    const reused = f.prepare();
    expect(reused.observedStale).toBe(true);
    const replacement = f.claim(reused);
    expect(replacement.ownerStartTime).toBe(WINDOWS_START);
    expect(
      f.state
        .openOpenClawStateDatabase()
        .db.prepare("SELECT status FROM cron_run_receipts WHERE receipt_id = ?")
        .get(handle.receiptId),
    ).toEqual({ status: "interrupted" });
    expect(probes.windows.mock.calls.filter(([pid]) => pid === foreignPid)).toHaveLength(2);
    f.receipts.releaseLocalCronRunReceiptOwnership(replacement);
  });
});
