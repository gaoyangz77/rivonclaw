import type { IncomingMessage, ServerResponse } from "node:http";
import { getSnapshot } from "mobx-state-tree";
import { rootStore, subscribeToPatch } from "../store/desktop-store.js";

/**
 * SSE endpoint for streaming MST store patches to Panel.
 *
 * Protocol:
 * - On connect: sends `event: snapshot` with full store state
 * - On change: sends `event: patch` with JSON Patch operations
 * - On reconnect: re-sends full snapshot (client should replace local state)
 */
export function handleStoreStream(req: IncomingMessage, res: ServerResponse): void {
  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send full snapshot on connect
  const snapshot = getSnapshot(rootStore);
  res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);

  // Subscribe to patches — sent as a batched array per flush
  const unsubscribe = subscribeToPatch((patches) => {
    res.write(`event: patch\ndata: ${JSON.stringify(patches)}\n\n`);
  });

  // Clean up on disconnect
  req.on("close", () => {
    unsubscribe();
  });
}
