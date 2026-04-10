import type { IncomingMessage, ServerResponse } from "node:http";
import { getSnapshot } from "mobx-state-tree";
import { runtimeStatusStore, subscribeToRuntimeStatusPatch } from "./store/runtime-status-store.js";

/**
 * SSE endpoint for streaming runtime status patches to Panel.
 *
 * Protocol (same as store-stream):
 * - On connect: sends `event: snapshot` with full runtime status state
 * - On change: sends `event: patch` with JSON Patch operations
 * - On reconnect: re-sends full snapshot (client should replace local state)
 */
export function handleRuntimeStatusStream(req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send full snapshot on connect
  const snapshot = getSnapshot(runtimeStatusStore);
  res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);

  // Subscribe to patches
  const unsubscribe = subscribeToRuntimeStatusPatch((patches) => {
    res.write(`event: patch\ndata: ${JSON.stringify(patches)}\n\n`);
  });

  // Clean up on disconnect
  req.on("close", () => {
    unsubscribe();
  });
}
