import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MobileSyncEngine } from "./sync-engine";
import { RelayTransport } from "./relay-transport";
import fs from "node:fs/promises";

// Mock fs to avoid actual disk I/O
vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  },
}));

// Mock transport
function createMockTransport(): RelayTransport {
  const handlers = new Map<string, Function>();
  const statusSubs = new Set<Function>();
  const sent: any[] = [];

  return {
    registerHandler: vi.fn((pairingId: string, handler: Function) => {
      handlers.set(pairingId, handler);
    }),
    unregisterHandler: vi.fn((pairingId: string) => {
      handlers.delete(pairingId);
    }),
    subscribeStatus: vi.fn((cb: Function) => {
      statusSubs.add(cb);
      cb("offline");
      return () => statusSubs.delete(cb);
    }),
    send: vi.fn((pairingId: string, msg: any) => {
      sent.push({ pairingId, msg });
    }),
    isConnected: vi.fn(() => true),
    // Test helpers
    _handlers: handlers,
    _statusSubs: statusSubs,
    _sent: sent,
  } as any;
}

describe("MobileSyncEngine", () => {
  let api: any;
  let transport: ReturnType<typeof createMockTransport>;
  let engine: MobileSyncEngine;

  beforeEach(() => {
    api = {
      runtime: {
        config: { loadConfig: () => ({}) },
      },
    };
    vi.clearAllMocks();
    vi.useFakeTimers();
    transport = createMockTransport();
    engine = new MobileSyncEngine(api, transport as any, "pairing-1", "desktop-xyz", "mobile-123");
  });

  afterEach(() => {
    engine.stop();
    vi.useRealTimers();
  });

  it("should register handler with transport on start()", async () => {
    await engine.start();

    expect(transport.registerHandler).toHaveBeenCalledWith("pairing-1", expect.any(Function));
    expect(transport.subscribeStatus).toHaveBeenCalled();
  });

  it("should unregister handler on stop()", async () => {
    await engine.start();
    engine.stop();

    expect(transport.unregisterHandler).toHaveBeenCalledWith("pairing-1");
  });

  it("should queue outbound messages and send via transport", async () => {
    await engine.start();
    const id = engine.queueOutbound("mobile-123", { type: "text", text: "Hello" });

    expect(id).toBeDefined();
    expect(transport.send).toHaveBeenCalledWith(
      "pairing-1",
      expect.objectContaining({
        type: "msg",
        id,
        sender: "desktop",
        payload: { type: "text", text: "Hello" },
      }),
    );

    // Should be in outbox
    const cached = (engine as any).outbox.get(id);
    expect(cached).toBeDefined();
    expect(cached.payload.text).toBe("Hello");
  });

  it("should delete from outbox when receiving an ACK", async () => {
    await engine.start();
    const id = engine.queueOutbound("mobile-123", { type: "text", text: "Hello" });
    expect((engine as any).outbox.has(id)).toBe(true);

    // Simulate incoming ACK via handler
    const handler = (transport as any)._handlers.get("pairing-1");
    await handler({ type: "ack", id });

    expect((engine as any).outbox.has(id)).toBe(false);
  });

  it("should send ACK via transport when receiving a message", async () => {
    await engine.start();
    transport.send.mockClear();

    const handler = (transport as any)._handlers.get("pairing-1");
    await handler({
      type: "msg",
      id: "msg-1",
      sender: "mobile",
      payload: { type: "text", text: "Hi from phone" },
    });

    expect(transport.send).toHaveBeenCalledWith("pairing-1", { type: "ack", id: "msg-1" });
  });

  it("should deduplicate incoming messages by ID", async () => {
    await engine.start();
    transport.send.mockClear();

    const handler = (transport as any)._handlers.get("pairing-1");
    const msg = {
      type: "msg",
      id: "dup-1",
      sender: "mobile",
      payload: { type: "text", text: "hello" },
    };

    // First delivery — ACK sent
    await handler(msg);
    expect(transport.send).toHaveBeenCalledWith("pairing-1", { type: "ack", id: "dup-1" });
    const callCount = transport.send.mock.calls.length;

    // Second delivery (retransmit) — ACK sent again, but processIncomingPayload NOT called again
    transport.send.mockClear();
    await handler(msg);
    expect(transport.send).toHaveBeenCalledWith("pairing-1", { type: "ack", id: "dup-1" });
    // Only ACK, no error notification or additional processing
    expect(transport.send).toHaveBeenCalledTimes(1);
  });

  it("should send error notification to mobile when processing fails", async () => {
    // Set up an api that will throw
    (engine as any).api = {
      runtime: {
        config: { loadConfig: () => ({}) },
        channel: {
          routing: {
            resolveAgentRoute: () => {
              throw new Error("agent exploded");
            },
          },
        },
      },
    };
    await engine.start();
    transport.send.mockClear();

    const handler = (transport as any)._handlers.get("pairing-1");
    await handler({
      type: "msg",
      id: "fail-1",
      sender: "mobile",
      payload: { type: "text", text: "trigger error" },
    });

    // Should have sent ACK + error notification
    expect(transport.send).toHaveBeenCalledWith("pairing-1", { type: "ack", id: "fail-1" });
    const errorCall = transport.send.mock.calls.find(
      (c: any[]) => c[1].type === "msg" && c[1].payload?.text?.includes("[System]"),
    );
    expect(errorCall).toBeDefined();
    expect(errorCall![1].payload.text).toContain("Failed to process");
  });

  it("should update mobileOnline on peer_status", async () => {
    await engine.start();
    expect(engine.mobileOnline).toBe(false);

    const handler = (transport as any)._handlers.get("pairing-1");
    await handler({ type: "peer_status", pairingId: "pairing-1", status: "online" });
    expect(engine.mobileOnline).toBe(true);

    await handler({ type: "peer_status", pairingId: "pairing-1", status: "offline" });
    expect(engine.mobileOnline).toBe(false);
  });

  it("should call onUnpaired when receiving unpair message", async () => {
    await engine.start();
    const spy = vi.fn();
    engine.onUnpaired = spy;

    const handler = (transport as any)._handlers.get("pairing-1");
    await handler({ type: "unpair", pairingId: "pairing-1" });

    expect(spy).toHaveBeenCalled();
  });

  it("should send unpair message via transport on sendUnpairAndStop()", async () => {
    await engine.start();
    transport.send.mockClear();

    engine.sendUnpairAndStop();

    expect(transport.send).toHaveBeenCalledWith("pairing-1", { type: "unpair" });
  });

  describe("sentHistory", () => {
    it("should append to sentHistory with monotonic seq", async () => {
      await engine.start();
      engine.queueOutbound("mobile-123", { type: "text", text: "msg-1" });
      engine.queueOutbound("mobile-123", { type: "text", text: "msg-2" });

      const history = (engine as any).sentHistory;
      expect(history).toHaveLength(2);
      expect(history[0].payload).toEqual({ type: "text", text: "msg-1" });
      expect(history[1].payload).toEqual({ type: "text", text: "msg-2" });
      expect(history[0].seq).toBe(1);
      expect(history[1].seq).toBe(2);
    });

    it("should bound sentHistory to 200 entries", async () => {
      await engine.start();
      for (let i = 0; i < 210; i++) {
        engine.queueOutbound("mobile-123", { type: "text", text: `msg-${i}` });
      }

      const history = (engine as any).sentHistory;
      expect(history).toHaveLength(200);
      // First entries should have been dropped; oldest remaining is msg-10
      expect(history[0].payload.text).toBe("msg-10");
      expect(history[199].payload.text).toBe("msg-209");
    });

    it("should include seq in outbound messages", async () => {
      await engine.start();
      transport.send.mockClear();
      engine.queueOutbound("mobile-123", { type: "text", text: "hello" });

      const sentMsg = transport.send.mock.calls[0][1];
      expect(sentMsg.seq).toBe(1);
    });
  });

  describe("sync_req / sync_res", () => {
    // Helper: ACK a message to clear it from outbox (so sync_res includes it)
    async function ackMessage(handler: Function, id: string) {
      await handler({ type: "ack", id });
    }

    it("should respond with ACKed history when lastSeq is 0", async () => {
      await engine.start();
      const idA = engine.queueOutbound("mobile-123", { type: "text", text: "a" });
      const idB = engine.queueOutbound("mobile-123", { type: "text", text: "b" });

      const handler = (transport as any)._handlers.get("pairing-1");
      // ACK both so they leave outbox and are eligible for sync_res
      await ackMessage(handler, idA);
      await ackMessage(handler, idB);
      transport.send.mockClear();

      await handler({ type: "sync_req", lastSeq: 0 });

      expect(transport.send).toHaveBeenCalledTimes(1);
      const res = transport.send.mock.calls[0][1];
      expect(res.type).toBe("sync_res");
      expect(res.messages).toHaveLength(2);
      expect(res.messages[0].seq).toBe(1);
      expect(res.messages[0].payload).toEqual({ type: "text", text: "a" });
      expect(res.messages[1].seq).toBe(2);
      expect(res.messages[1].payload).toEqual({ type: "text", text: "b" });
    });

    it("should filter messages by lastSeq", async () => {
      await engine.start();
      const idOld = engine.queueOutbound("mobile-123", { type: "text", text: "old" });
      const idNew = engine.queueOutbound("mobile-123", { type: "text", text: "new" });

      const handler = (transport as any)._handlers.get("pairing-1");
      await ackMessage(handler, idOld);
      await ackMessage(handler, idNew);
      transport.send.mockClear();

      await handler({ type: "sync_req", lastSeq: 1 });

      const res = transport.send.mock.calls[0][1];
      expect(res.type).toBe("sync_res");
      expect(res.messages).toHaveLength(1);
      expect(res.messages[0].payload.text).toBe("new");
      expect(res.messages[0].seq).toBe(2);
    });

    it("should return empty messages when lastSeq is beyond all history", async () => {
      await engine.start();
      const id = engine.queueOutbound("mobile-123", { type: "text", text: "hello" });

      const handler = (transport as any)._handlers.get("pairing-1");
      await ackMessage(handler, id);
      transport.send.mockClear();

      await handler({ type: "sync_req", lastSeq: 999 });

      const res = transport.send.mock.calls[0][1];
      expect(res.type).toBe("sync_res");
      expect(res.messages).toHaveLength(0);
    });

    it("should treat missing lastSeq as 0 (return all)", async () => {
      await engine.start();
      const id = engine.queueOutbound("mobile-123", { type: "text", text: "x" });

      const handler = (transport as any)._handlers.get("pairing-1");
      await ackMessage(handler, id);
      transport.send.mockClear();

      await handler({ type: "sync_req" });

      const res = transport.send.mock.calls[0][1];
      expect(res.type).toBe("sync_res");
      expect(res.messages).toHaveLength(1);
    });

    it("should exclude messages still in outbox from sync_res (avoid redundancy with flush)", async () => {
      await engine.start();
      const idAcked = engine.queueOutbound("mobile-123", { type: "text", text: "acked" });
      engine.queueOutbound("mobile-123", { type: "text", text: "still-pending" }); // not ACKed

      const handler = (transport as any)._handlers.get("pairing-1");
      await ackMessage(handler, idAcked);
      transport.send.mockClear();

      await handler({ type: "sync_req", lastSeq: 0 });

      const res = transport.send.mock.calls[0][1];
      expect(res.type).toBe("sync_res");
      // Only the ACKed message should appear — the pending one will be flushed via outbox
      expect(res.messages).toHaveLength(1);
      expect(res.messages[0].payload.text).toBe("acked");
    });
  });

  describe("outbox flush on mobile peer_status online", () => {
    it("should flush outbox when mobile comes online", async () => {
      await engine.start();
      const id = engine.queueOutbound("mobile-123", { type: "text", text: "pending" });
      expect((engine as any).outbox.has(id)).toBe(true);

      transport.send.mockClear();
      // Reset flush dedup timer
      (engine as any).lastFlushTime = 0;

      const handler = (transport as any)._handlers.get("pairing-1");
      await handler({ type: "peer_status", pairingId: "pairing-1", status: "online" });

      expect(transport.send).toHaveBeenCalledWith(
        "pairing-1",
        expect.objectContaining({
          type: "msg",
          id,
          sender: "desktop",
          payload: { type: "text", text: "pending" },
        }),
      );
    });

    it("should not flush outbox when mobile goes offline", async () => {
      await engine.start();
      engine.queueOutbound("mobile-123", { type: "text", text: "pending" });
      transport.send.mockClear();

      const handler = (transport as any)._handlers.get("pairing-1");
      await handler({ type: "peer_status", pairingId: "pairing-1", status: "offline" });

      expect(transport.send).not.toHaveBeenCalled();
    });

    it("should not call send when outbox is empty and mobile comes online", async () => {
      await engine.start();
      transport.send.mockClear();
      (engine as any).lastFlushTime = 0;

      const handler = (transport as any)._handlers.get("pairing-1");
      await handler({ type: "peer_status", pairingId: "pairing-1", status: "online" });

      expect(transport.send).not.toHaveBeenCalled();
    });

    it("should deduplicate rapid flush calls within 3s window", async () => {
      await engine.start();
      engine.queueOutbound("mobile-123", { type: "text", text: "pending" });
      transport.send.mockClear();
      (engine as any).lastFlushTime = 0;

      const handler = (transport as any)._handlers.get("pairing-1");
      // First flush — should send
      await handler({ type: "peer_status", pairingId: "pairing-1", status: "online" });
      const callCount1 = transport.send.mock.calls.length;
      expect(callCount1).toBe(1);

      // Immediate second flush — should be skipped (within 3s)
      await handler({ type: "peer_status", pairingId: "pairing-1", status: "offline" });
      await handler({ type: "peer_status", pairingId: "pairing-1", status: "online" });
      expect(transport.send.mock.calls.length).toBe(callCount1);
    });
  });

  describe("outbox size limit", () => {
    it("should cap outbox at 500 entries", async () => {
      await engine.start();
      for (let i = 0; i < 510; i++) {
        engine.queueOutbound("mobile-123", { type: "text", text: `msg-${i}` });
      }
      expect((engine as any).outbox.size).toBe(500);
    });

    it("should drop oldest entry when outbox overflows", async () => {
      await engine.start();
      const firstId = engine.queueOutbound("mobile-123", { type: "text", text: "first" });
      for (let i = 0; i < 500; i++) {
        engine.queueOutbound("mobile-123", { type: "text", text: `filler-${i}` });
      }
      expect((engine as any).outbox.has(firstId)).toBe(false);
      expect((engine as any).outbox.size).toBe(500);
    });
  });

  describe("ACK timeout", () => {
    it("should retain message in outbox after ACK timeout", async () => {
      await engine.start();
      const id = engine.queueOutbound("mobile-123", { type: "text", text: "will-timeout" });
      expect((engine as any).outbox.has(id)).toBe(true);

      // Advance past ACK_TIMEOUT_MS
      vi.advanceTimersByTime(30_000 + 100);

      expect((engine as any).outbox.has(id)).toBe(true);
    });

    it("should not timeout if ACK received in time", async () => {
      await engine.start();
      const id = engine.queueOutbound("mobile-123", { type: "text", text: "will-ack" });

      const handler = (transport as any)._handlers.get("pairing-1");
      await handler({ type: "ack", id });
      expect((engine as any).outbox.has(id)).toBe(false);

      // Advance past timeout — should not cause errors
      vi.advanceTimersByTime(30_000 + 100);
      expect((engine as any).outbox.has(id)).toBe(false);
    });

    it("should retry an unacked message when timeout fires and peer is online", async () => {
      await engine.start();
      engine.mobileOnline = true;
      const id = engine.queueOutbound("mobile-123", { type: "text", text: "retry-me" });

      transport.send.mockClear();
      vi.advanceTimersByTime(30_000 + 100);

      expect((engine as any).outbox.has(id)).toBe(true);
      expect(transport.send).toHaveBeenCalledWith(
        "pairing-1",
        expect.objectContaining({
          type: "msg",
          id,
          sender: "desktop",
          payload: { type: "text", text: "retry-me" },
        }),
      );
    });
  });

  describe("persistence", () => {
    it("should start saving sync state to disk immediately on queueOutbound", async () => {
      await engine.start();
      (fs.writeFile as any).mockClear();

      engine.queueOutbound("mobile-123", { type: "text", text: "persisted" });
      await (engine as any).saveChain;

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("pairing-1.json"),
        expect.any(String),
        "utf-8",
      );

      // Verify saved content
      const savedCalls = (fs.writeFile as any).mock.calls.filter(
        (c: any[]) => typeof c[0] === "string" && c[0].includes("pairing-1.json"),
      );
      const matchingSave = savedCalls
        .map((c: any[]) => JSON.parse(c[1]))
        .find(
          (saved: any) =>
            Array.isArray(saved.outbox) &&
            saved.outbox.some((entry: any) => entry?.payload?.text === "persisted") &&
            Array.isArray(saved.sentHistory) &&
            saved.sentHistory.some((entry: any) => entry?.payload?.text === "persisted"),
        );
      expect(matchingSave).toBeDefined();
    });

    it("should load sync state from disk on start", async () => {
      const persistedState = JSON.stringify({
        outbox: [
          {
            type: "msg",
            id: "restored-1",
            seq: 5,
            sender: "desktop",
            timestamp: 1000,
            payload: { type: "text", text: "restored" },
          },
        ],
        sentHistory: [
          {
            id: "restored-1",
            seq: 5,
            timestamp: 1000,
            payload: { type: "text", text: "restored" },
          },
        ],
      });
      (fs.readFile as any).mockResolvedValueOnce(persistedState);

      await engine.start();

      expect((engine as any).outbox.size).toBe(1);
      expect((engine as any).outbox.has("restored-1")).toBe(true);
      expect((engine as any).sentHistory).toHaveLength(1);
      // nextSeq should resume from the highest persisted seq + 1
      expect((engine as any).nextSeq).toBe(6);
    });

    it("should save on stop (flush debounce)", async () => {
      await engine.start();
      (fs.writeFile as any).mockClear();

      engine.queueOutbound("mobile-123", { type: "text", text: "before-stop" });
      engine.stop();
      await (engine as any).saveChain;

      // saveSyncState called synchronously on stop
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("pairing-1.json"),
        expect.any(String),
        "utf-8",
      );
    });
  });
});
