import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GATEWAY_HEAP_SNAPSHOT_SETTING_KEY,
  GATEWAY_HEAP_SNAPSHOT_THRESHOLD_ENV,
  HEAP_WATCH_PRELOAD_FILENAME,
  isGatewayHeapSnapshotEnabled,
  writeHeapWatchModule,
} from "./heap-snapshot-setting.js";

describe("gateway heap snapshot setting", () => {
  it("stays off unless the setting is exactly \"true\"", () => {
    const cases = [undefined, "", "false", "0", "1", "yes", "TRUE", " true"];
    for (const value of cases) {
      expect(isGatewayHeapSnapshotEnabled(() => value)).toBe(false);
    }
  });

  it("turns on for \"true\", and reads the documented key", () => {
    let askedFor: string | undefined;
    const enabled = isGatewayHeapSnapshotEnabled((key) => {
      askedFor = key;
      return "true";
    });

    expect(enabled).toBe(true);
    expect(askedFor).toBe(GATEWAY_HEAP_SNAPSHOT_SETTING_KEY);
  });

  // The whole reason this is a preload and not `--heapsnapshot-near-heap-limit`:
  // that flag wrote a 0-byte file on every `Reached heap limit` death we
  // tested. This drives the real preload under a real Node with a tiny
  // threshold and asserts a non-empty snapshot actually lands in cwd.
  it("writes one non-empty heap snapshot once the heap crosses the threshold", () => {
    const dir = mkdtempSync(join(tmpdir(), "heap-watch-"));
    const preload = writeHeapWatchModule(dir);
    expect(preload).toBe(join(dir, HEAP_WATCH_PRELOAD_FILENAME));

    // Grow the heap past 24 MB in small steps and keep the loop alive long
    // enough for the 50 ms poll to see it.
    const script = `
      const a = [];
      const t = setInterval(() => {
        for (let i = 0; i < 400; i += 1) a.push(Buffer.alloc(4096).toString("hex"));
        if (a.length > 12000) { clearInterval(t); setTimeout(() => process.exit(0), 300); }
      }, 5);
    `;
    const result = spawnSync(process.execPath, ["--require", preload, "-e", script], {
      cwd: dir,
      env: {
        ...process.env,
        [GATEWAY_HEAP_SNAPSHOT_THRESHOLD_ENV]: "24",
        RIVONCLAW_HEAP_SNAPSHOT_INTERVAL_MS: "50",
      },
      encoding: "utf-8",
      timeout: 30_000,
    });
    expect(result.status).toBe(0);
    const stderr = result.stderr;

    expect(stderr).toContain("[heap-watch] armed thresholdMB=24");
    expect(stderr).toMatch(/\[heap-watch\] wrote .*\.heapsnapshot usedMB=\d+/);

    const snapshots = readdirSync(dir).filter((f) => f.endsWith(".heapsnapshot"));
    expect(snapshots).toHaveLength(1);
    expect(statSync(join(dir, snapshots[0]!)).size).toBeGreaterThan(0);
  });

  it("stays quiet and never snapshots below the threshold", () => {
    const dir = mkdtempSync(join(tmpdir(), "heap-watch-"));
    const preload = writeHeapWatchModule(dir);
    const result = spawnSync(
      process.execPath,
      ["--require", preload, "-e", "setTimeout(() => process.exit(0), 300)"],
      {
        cwd: dir,
        env: { ...process.env, [GATEWAY_HEAP_SNAPSHOT_THRESHOLD_ENV]: "100000" },
        encoding: "utf-8",
        timeout: 30_000,
      },
    );
    expect(result.status).toBe(0);
    const stderr = result.stderr;

    expect(stderr).toContain("[heap-watch] armed");
    expect(stderr).not.toContain("[heap-watch] wrote");
    expect(readdirSync(dir).filter((f) => f.endsWith(".heapsnapshot"))).toHaveLength(0);
  });
});
