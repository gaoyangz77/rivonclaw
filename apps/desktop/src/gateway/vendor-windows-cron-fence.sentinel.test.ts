import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const VENDOR_ROOT = resolve(
  process.env.OPENCLAW_VENDOR_ROOT ?? resolve(import.meta.dirname, "../../../../vendor/openclaw"),
);

// Real win32-stubbed receipt transactions live in vendor-patches/openclaw/tests.
describe("upstream Windows cron durable fence", () => {
  const receiptStore = readFileSync(
    resolve(VENDOR_ROOT, "src/cron/store/run-receipt-store.ts"),
    "utf8",
  );
  const identity = readFileSync(resolve(VENDOR_ROOT, "src/shared/pid-alive.ts"), "utf8");
  const windows = readFileSync(resolve(VENDOR_ROOT, "src/infra/windows-process-start.ts"), "utf8");

  it("uses the canonical Windows reader through the shared identity helper", () => {
    expect(identity).toContain('process.platform === "win32"');
    expect(identity).toContain("readWindowsProcessStartTimeSync(pid, windowsTimeoutMs, env)");
    expect(identity).toContain("infra/windows-process-start.ts");
  });

  it("uses one identity reader for claims and foreign-owner comparisons", () => {
    expect(receiptStore).toContain(
      "const ownerStartTime = getFileLockProcessStartTime(process.pid)",
    );
    expect(receiptStore).toContain(
      "const observedStartTime = getFileLockProcessStartTime(owner.ownerPid)",
    );
    expect(receiptStore).toContain("owner.ownerStartTime !== observedStartTime");
    expect(receiptStore).toContain("without process start identity");
  });

  it("caches only successful self probes and keeps foreign probes fresh", () => {
    expect(identity).toContain("const isSelf = pid === process.pid");
    expect(identity).toContain("if (isSelf && selfStartTime !== null)");
    expect(identity).toContain("if (isSelf && startTime !== null)");
    expect(identity).toContain("selfStartTime = startTime");
  });

  it("bounds the canonical Windows probe and leaves time for WMIC fallback", () => {
    expect(windows).toContain("const DEFAULT_PROCESS_START_TIMEOUT_MS = 10_000");
    expect(windows).toContain("timeout: Math.min(timeoutMs, DEFAULT_TIMEOUT_MS)");
    expect(windows).toContain("const remainingMs = deadline - Date.now()");
    expect(windows).toContain("timeout: remainingMs");
  });
});
