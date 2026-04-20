import type { IncomingMessage, ServerResponse } from "node:http";
import { createLogger } from "@rivonclaw/logger";

const log = createLogger("panel-event-bus");

/**
 * Unified SSE fan-out bus for the Desktop → Panel event stream.
 *
 * Consolidates what used to be three separate endpoints
 * (`/api/chat/events`, `/api/store/stream`, `/api/status/stream`) into
 * a single `/api/events` stream so each Panel session opens exactly ONE
 * EventSource — keeping well clear of Chrome's 6-connection per-origin
 * HTTP/1.1 limit.
 *
 * Protocol:
 *   - On connect: server immediately emits `entity-snapshot` then
 *     `status-snapshot` (both full MST snapshots), followed by a
 *     continuous stream of named events.
 *   - On change: server broadcasts JSON-Patch bundles via
 *     `entity-patch` / `status-patch`, plus discrete notification
 *     events (`inbound`, `oauth-complete`, `recipient-added`, etc.).
 */
export interface PanelEventBus {
  /** Attach an HTTP response as an SSE client. Immediately sends entity + status snapshots. */
  addClient(req: IncomingMessage, res: ServerResponse): void;
  /** Broadcast an event to all connected clients. Safe to call with zero clients. */
  broadcast(event: string, data: unknown): void;
  /** Clean shutdown — close all client streams. */
  shutdown(): void;
}

export interface PanelEventBusDeps {
  /** Synchronous read of the MST entity-store snapshot (full state). */
  getEntitySnapshot(): unknown;
  /** Synchronous read of the MST runtime-status-store snapshot (full state). */
  getRuntimeStatusSnapshot(): unknown;
}

/**
 * Create a new PanelEventBus instance. Wiring (patch subscriptions,
 * route registration) is handled by the caller.
 */
export function createPanelEventBus(deps: PanelEventBusDeps): PanelEventBus {
  const clients = new Set<ServerResponse>();

  function writeFrame(res: ServerResponse, event: string, data: unknown): boolean {
    // Returns true on success, false if the write throws synchronously.
    try {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      res.write(payload);
      return true;
    } catch (err) {
      log.warn(`SSE write failed (event=${event}):`, err instanceof Error ? err.message : err);
      return false;
    }
  }

  return {
    addClient(req, res) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(":ok\n\n");

      // Emit snapshots synchronously BEFORE adding the client to the set.
      // Any broadcast that races with the connection will therefore land
      // after both snapshots — Node's HTTP stream preserves per-response
      // write ordering, and adding to the fan-out set only after the
      // snapshots are queued eliminates interleave.
      //
      // If snapshot reads throw, fail fast — the caller should fix the
      // store injection, not paper over it here.
      const entitySnapshot = deps.getEntitySnapshot();
      writeFrame(res, "entity-snapshot", entitySnapshot);
      const statusSnapshot = deps.getRuntimeStatusSnapshot();
      writeFrame(res, "status-snapshot", statusSnapshot);

      clients.add(res);

      const cleanup = () => {
        clients.delete(res);
      };
      req.on("close", cleanup);
      res.on("error", (err) => {
        log.warn("SSE client response errored:", err instanceof Error ? err.message : err);
        clients.delete(res);
      });
    },

    broadcast(event, data) {
      if (clients.size === 0) return;
      const dead: ServerResponse[] = [];
      for (const res of clients) {
        if (!res.writable) {
          dead.push(res);
          continue;
        }
        if (!writeFrame(res, event, data)) {
          dead.push(res);
        }
      }
      for (const res of dead) clients.delete(res);
    },

    shutdown() {
      for (const res of clients) {
        try {
          res.end();
        } catch {
          // best-effort: socket may already be gone
        }
      }
      clients.clear();
    },
  };
}
