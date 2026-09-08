/**
 * Opt-in switch for V8's `--heapsnapshot-near-heap-limit`, which makes the
 * Gateway write a heap snapshot immediately before it dies of OOM.
 *
 * Off by default, and deliberately not surfaced in the UI. The Gateway runs on
 * Electron's V8, which is built with pointer compression and therefore caps the
 * heap at 4 GB no matter how much RAM the machine has -- so an install that
 * leaks simply OOMs on a fixed cadence, and a snapshot is the only way to see
 * what is holding the heap. The cost is that every crash writes another file
 * into the OpenClaw state directory (the Gateway's cwd) and the process is
 * already thrashing while it writes.
 *
 * Intended use is one install at a time: turn it on, wait for a single crash,
 * turn it off, collect the file. Leaving it on accumulates one file per OOM.
 */
export const GATEWAY_HEAP_SNAPSHOT_SETTING_KEY = "gateway-diagnostics.heap-snapshot-on-oom";

/** V8 flag appended to the Gateway's NODE_OPTIONS when the setting is on. */
export const GATEWAY_HEAP_SNAPSHOT_NODE_FLAG = "--heapsnapshot-near-heap-limit=1";

export function isGatewayHeapSnapshotEnabled(
  getSetting: (key: string) => string | undefined,
): boolean {
  return getSetting(GATEWAY_HEAP_SNAPSHOT_SETTING_KEY) === "true";
}
