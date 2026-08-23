import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0039-vendor-openclaw-give-the-cron-fence-a-Windows-proces.patch",
);
const PATCHED_VENDOR_ROOT = resolve(__dirname, "../../../../tmp/vendor-patched/openclaw");
const VENDOR_ROOT = existsSync(PATCHED_VENDOR_ROOT)
  ? PATCHED_VENDOR_ROOT
  : resolve(__dirname, "../../../../vendor/openclaw");

describe("vendor patch 0039: Windows cron durable fence", () => {
  const patch = readFileSync(PATCH_FILE, "utf8");
  const receiptStore = readFileSync(
    resolve(VENDOR_ROOT, "src/cron/store/run-receipt-store.ts"),
    "utf8",
  );
  const sharedPidAlive = readFileSync(resolve(VENDOR_ROOT, "src/shared/pid-alive.ts"), "utf8");
  const regression = readFileSync(
    resolve(VENDOR_ROOT, "src/cron/store/run-receipt-store.windows-start-time.test.ts"),
    "utf8",
  );

  it("keeps the upstream defect this patch works around visible", () => {
    // getFileLockProcessStartTime still has no Windows branch upstream: darwin
    // uses `ps`, and the else-branch bails out on any non-Linux platform. That
    // is why the cron fence needs its own reader. If upstream ever adds Windows
    // support here, this assertion fails and the patch can be retired.
    expect(sharedPidAlive).toContain('process.platform === "darwin"');
    expect(sharedPidAlive).toContain('process.platform !== "linux"');
    expect(sharedPidAlive).not.toContain("readWindowsProcessStartTimeSync");
  });

  it("reads the Windows process creation time when claiming the fence", () => {
    expect(receiptStore).toContain(
      'import { readWindowsProcessStartTimeSync } from "../../infra/windows-port-pids.js";',
    );
    expect(receiptStore).toContain('process.platform === "win32"');
    expect(receiptStore).toContain("readWindowsProcessStartTimeSync(pid)");
    expect(receiptStore).toContain("const ownerStartTime = readCurrentProcessStartTime();");
  });

  it("compares stored and observed owner identity through the same reader", () => {
    // The claim and the staleness check must share one reader, otherwise
    // Windows would persist a creation timestamp and then compare it against
    // null, silently disabling PID-reuse detection.
    expect(receiptStore).toContain(
      "const observedStartTime = readCronOwnerStartTime(owner.ownerPid);",
    );
    expect(receiptStore).not.toContain("getFileLockProcessStartTime(owner.ownerPid)");
    expect(receiptStore).not.toContain("getFileLockProcessStartTime(process.pid)");
  });

  it("caches our own immutable start time so a claim never respawns PowerShell", () => {
    expect(receiptStore).toContain("currentProcessStartTime ??= readCronOwnerStartTime(process.pid)");
  });

  it("carries the failing-first vendor regression for the Windows claim", () => {
    expect(regression).toContain(
      'it("acquires a durable fence from the Windows process creation time"',
    );
    expect(regression).toContain('value: "win32"');
    expect(regression).toContain("prepared.handle.ownerStartTime");
  });

  it("records the removal condition and the proving tests", () => {
    expect(patch).toContain("Removal:");
    expect(patch).toContain("getFileLockProcessStartTime");
    expect(patch).toContain("src/cron/store/run-receipt-store.windows-start-time.test.ts");
    expect(patch).toContain(
      "apps/desktop/src/gateway/vendor-windows-cron-fence.sentinel.test.ts",
    );
  });
});
