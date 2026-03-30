import type { IncomingMessage, ServerResponse } from "node:http";
import { getSnapshot } from "mobx-state-tree";
import { rootStore, subscribeToPatch } from "../store/desktop-store.js";
import type { RouteHandler } from "./api-context.js";
import { parseBody, sendJson } from "./route-utils.js";

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

/**
 * POST /api/store/remove — remove an entity from an MST collection by typename + id.
 * Called by Panel MST actions after a delete mutation succeeds.
 */
export const handleStoreRemove: RouteHandler = async (req, res, _url, pathname) => {
  if (pathname === "/api/store/remove" && req.method === "POST") {
    const body = await parseBody(req) as { typeName?: string; id?: string };
    if (!body.typeName || !body.id) {
      sendJson(res, 400, { error: "Missing typeName or id" });
      return true;
    }
    rootStore.removeFromCollection(body.typeName, body.id);
    sendJson(res, 200, { ok: true });
    return true;
  }
  return false;
};
