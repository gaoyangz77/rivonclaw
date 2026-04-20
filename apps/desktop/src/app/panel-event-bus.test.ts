import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createPanelEventBus } from "./panel-event-bus.js";

/**
 * Minimal fake req/res pair that captures SSE frames and lets tests
 * simulate client disconnects (`req.emit("close")`) and write errors.
 */
function makeClientPair(options: { failOnWrite?: boolean } = {}) {
  const frames: string[] = [];
  const req = new EventEmitter() as IncomingMessage;
  // Cast through `unknown` so we can overwrite method-typed properties
  // without TypeScript complaining about the narrower signatures.
  const res = new EventEmitter() as unknown as ServerResponse & { writable: boolean };

  res.writable = true;
  res.writeHead = vi.fn() as unknown as ServerResponse["writeHead"];
  res.end = vi.fn(() => {
    // mark closed so later writes are skipped
    res.writable = false;
    return res;
  }) as unknown as ServerResponse["end"];
  res.write = vi.fn((chunk: string) => {
    if (options.failOnWrite) throw new Error("simulated write failure");
    frames.push(chunk);
    return true;
  }) as unknown as ServerResponse["write"];

  return { req, res, frames };
}

function makeDeps(overrides?: Partial<{ entity: unknown; status: unknown }>) {
  return {
    getEntitySnapshot: () => overrides?.entity ?? { kind: "entity", n: 1 },
    getRuntimeStatusSnapshot: () => overrides?.status ?? { kind: "status", n: 2 },
  };
}

describe("createPanelEventBus", () => {
  it("emits entity-snapshot then status-snapshot immediately on addClient", () => {
    const bus = createPanelEventBus(makeDeps());
    const { req, res, frames } = makeClientPair();

    bus.addClient(req, res);

    // Frames: 0 = ":ok\n\n" heartbeat, 1 = entity-snapshot, 2 = status-snapshot
    expect(frames[0]).toBe(":ok\n\n");
    expect(frames[1]).toContain("event: entity-snapshot");
    expect(frames[1]).toContain(`data: ${JSON.stringify({ kind: "entity", n: 1 })}`);
    expect(frames[2]).toContain("event: status-snapshot");
    expect(frames[2]).toContain(`data: ${JSON.stringify({ kind: "status", n: 2 })}`);
  });

  it("snapshots land before any concurrent broadcast reaches the client", () => {
    const bus = createPanelEventBus(makeDeps());
    const { req, res, frames } = makeClientPair();

    // Broadcast BEFORE adding — client should not see it (zero clients)
    bus.broadcast("inbound", { early: true });
    expect(frames.length).toBe(0);

    bus.addClient(req, res);
    const snapshotFramesBeforeBroadcast = frames.length;

    bus.broadcast("inbound", { late: true });

    // Both snapshots are in `frames` before the broadcast frame
    const entityIdx = frames.findIndex((f) => f.includes("entity-snapshot"));
    const statusIdx = frames.findIndex((f) => f.includes("status-snapshot"));
    const inboundIdx = frames.findIndex((f) => f.includes("event: inbound"));
    expect(entityIdx).toBeLessThan(statusIdx);
    expect(statusIdx).toBeLessThan(inboundIdx);
    expect(inboundIdx).toBe(snapshotFramesBeforeBroadcast);
  });

  it("fans out a broadcast to every connected client", () => {
    const bus = createPanelEventBus(makeDeps());
    const a = makeClientPair();
    const b = makeClientPair();

    bus.addClient(a.req, a.res);
    bus.addClient(b.req, b.res);

    bus.broadcast("ping", { n: 42 });

    for (const frames of [a.frames, b.frames]) {
      const found = frames.find((f) => f.startsWith("event: ping\n"));
      expect(found).toBeDefined();
      expect(found).toContain(`data: ${JSON.stringify({ n: 42 })}`);
    }
  });

  it("removes a dead client whose write throws, without breaking the fan-out", () => {
    const bus = createPanelEventBus(makeDeps());
    const live = makeClientPair();
    const dead = makeClientPair();

    bus.addClient(live.req, live.res);
    bus.addClient(dead.req, dead.res);

    // Flip the dead client's write to throw on subsequent calls
    dead.res.write = vi.fn(() => {
      throw new Error("broken pipe");
    }) as unknown as ServerResponse["write"];

    bus.broadcast("tick", { t: 1 });

    // Live still receives
    const liveFrame = live.frames.find((f) => f.startsWith("event: tick\n"));
    expect(liveFrame).toBeDefined();

    // Dead is now gone — a second broadcast must not touch it
    dead.res.write = vi.fn() as unknown as ServerResponse["write"];
    bus.broadcast("tick", { t: 2 });
    expect(dead.res.write).not.toHaveBeenCalled();
  });

  it("cleans up on req close", () => {
    const bus = createPanelEventBus(makeDeps());
    const a = makeClientPair();
    const b = makeClientPair();

    bus.addClient(a.req, a.res);
    bus.addClient(b.req, b.res);

    a.req.emit("close");

    // Reset write spy to check who actually gets a post-close broadcast
    a.res.write = vi.fn() as unknown as ServerResponse["write"];
    bus.broadcast("post-close", {});
    expect(a.res.write).not.toHaveBeenCalled();

    const bFrame = b.frames.find((f) => f.startsWith("event: post-close\n"));
    expect(bFrame).toBeDefined();
  });

  it("no-ops broadcast with zero clients", () => {
    const bus = createPanelEventBus(makeDeps());
    expect(() => bus.broadcast("anything", { ok: true })).not.toThrow();
  });

  it("shutdown ends every client response", () => {
    const bus = createPanelEventBus(makeDeps());
    const a = makeClientPair();
    const b = makeClientPair();

    bus.addClient(a.req, a.res);
    bus.addClient(b.req, b.res);

    bus.shutdown();

    expect(a.res.end).toHaveBeenCalledTimes(1);
    expect(b.res.end).toHaveBeenCalledTimes(1);

    // Subsequent broadcasts reach nobody
    a.res.write = vi.fn() as unknown as ServerResponse["write"];
    b.res.write = vi.fn() as unknown as ServerResponse["write"];
    bus.broadcast("after-shutdown", {});
    expect(a.res.write).not.toHaveBeenCalled();
    expect(b.res.write).not.toHaveBeenCalled();
  });
});
