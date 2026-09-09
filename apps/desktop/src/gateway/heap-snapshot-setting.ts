import { join } from "node:path";
import { writeFileSync } from "node:fs";

/**
 * Opt-in switch that makes the Gateway write a V8 heap snapshot once its heap
 * crosses a threshold, so we can see what is holding memory on an install
 * that OOMs on a fixed cadence.
 *
 * Off by default, and deliberately not surfaced in the UI. The Gateway runs on
 * Electron's V8, which is built with pointer compression and therefore caps the
 * heap at 4 GB no matter how much RAM the machine has -- so a leaking install
 * simply dies every few minutes, and a snapshot is the only way to name the
 * retainer.
 *
 * Why a threshold preload and NOT `--heapsnapshot-near-heap-limit`: that flag
 * fires when V8 is already at the wall, and writing a snapshot allocates. On
 * this Electron it produced a 0-byte file and no "Wrote snapshot" line on
 * every `Reached heap limit` death we tested (argv and NODE_OPTIONS alike);
 * it only succeeded when the process happened to die the slow
 * `Ineffective mark-compacts` way. A preload that snapshots at ~2.5 GB still
 * has headroom to finish the write, and a mid-growth snapshot is also the
 * more useful one for diffing.
 *
 * The snapshot is written to the Gateway's cwd, which is the OpenClaw state
 * directory (the same place this preload is written). The write is
 * synchronous and freezes the Gateway for tens of seconds at that heap size;
 * it happens at most once per process. Intended use is one install at a time:
 * turn it on, wait for one file, turn it off.
 */
export const GATEWAY_HEAP_SNAPSHOT_SETTING_KEY = "gateway-diagnostics.heap-snapshot-on-oom";

/** Heap size (MB) at which the preload takes its one snapshot. Overridable per install via env. */
export const GATEWAY_HEAP_SNAPSHOT_THRESHOLD_ENV = "RIVONCLAW_HEAP_SNAPSHOT_THRESHOLD_MB";
export const GATEWAY_HEAP_SNAPSHOT_DEFAULT_THRESHOLD_MB = 2560;
/** Polling interval (ms) for the heap check. */
export const GATEWAY_HEAP_SNAPSHOT_INTERVAL_ENV = "RIVONCLAW_HEAP_SNAPSHOT_INTERVAL_MS";

export const HEAP_WATCH_PRELOAD_FILENAME = "heap-watch.cjs";

/**
 * Plain CJS, no dependencies, and every path wrapped so a diagnostic can never
 * take the Gateway down. "[heap-watch] armed" on stderr is the proof the
 * preload actually loaded inside the Gateway process; "[heap-watch] wrote"
 * carries the snapshot path. Both are piped into the Desktop log.
 */
export const HEAP_WATCH_PRELOAD_SOURCE = `\
"use strict";
try {
  var v8 = require("v8");
  var env = process.env;
  var thresholdMb = Number(env.${GATEWAY_HEAP_SNAPSHOT_THRESHOLD_ENV}) || ${GATEWAY_HEAP_SNAPSHOT_DEFAULT_THRESHOLD_MB};
  var intervalMs = Number(env.${GATEWAY_HEAP_SNAPSHOT_INTERVAL_ENV}) || 5000;
  var limit = thresholdMb * 1024 * 1024;
  var done = false;
  var timer = setInterval(function () {
    if (done) return;
    try {
      var used = v8.getHeapStatistics().used_heap_size;
      if (used < limit) return;
      done = true;
      clearInterval(timer);
      var file = v8.writeHeapSnapshot();
      process.stderr.write("[heap-watch] wrote " + file + " usedMB=" + Math.round(used / 1048576) + " thresholdMB=" + thresholdMb + "\\n");
    } catch (err) {
      done = true;
      clearInterval(timer);
      process.stderr.write("[heap-watch] snapshot failed: " + ((err && err.message) || err) + "\\n");
    }
  }, intervalMs);
  timer.unref();
  process.stderr.write("[heap-watch] armed thresholdMB=" + thresholdMb + " intervalMs=" + intervalMs + "\\n");
} catch (err) {
  try { process.stderr.write("[heap-watch] failed to arm: " + ((err && err.message) || err) + "\\n"); } catch (_) {}
}
`;

export function isGatewayHeapSnapshotEnabled(
  getSetting: (key: string) => string | undefined,
): boolean {
  return getSetting(GATEWAY_HEAP_SNAPSHOT_SETTING_KEY) === "true";
}

/** Writes the preload into the state dir and returns its path, mirroring writeProxySetupModule. */
export function writeHeapWatchModule(stateDir: string): string {
  const path = join(stateDir, HEAP_WATCH_PRELOAD_FILENAME);
  writeFileSync(path, HEAP_WATCH_PRELOAD_SOURCE, "utf-8");
  return path;
}
