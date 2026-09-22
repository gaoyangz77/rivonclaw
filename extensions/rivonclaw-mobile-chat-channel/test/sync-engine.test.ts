import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MobileSyncEngine } from "../src/sync-engine.js";
import fs from "node:fs/promises";

// Mock fs to avoid creating actual directories/files during tests
vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  },
}));

// Mock transport
function createMockTransport() {
  const handlers = new Map<string, Function>();
  const statusSubs = new Set<Function>();

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
    send: vi.fn(),
    isConnected: vi.fn(() => true),
    _handlers: handlers,
    _statusSubs: statusSubs,
  } as any;
}

describe("MobileSyncEngine", () => {
  let mockApi: any;
  let transport: ReturnType<typeof createMockTransport>;
  let engine: MobileSyncEngine;

  beforeEach(() => {
    mockApi = {
      runtime: {
        config: { loadConfig: () => ({}) },
      },
    };
    vi.clearAllMocks();
    transport = createMockTransport();
    engine = new MobileSyncEngine(
      mockApi,
      transport,
      "pairing-1",
      "desktop-dev-id",
      "mobile-dev-id",
    );
  });

  afterEach(() => {
    engine.stop();
  });

  it("should initialize directories", () => {
    expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining("mobile"), { recursive: true });
    expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining("mobile-sync"), {
      recursive: true,
    });
  });

  it("should register handler with transport on start", async () => {
    await engine.start();

    expect(transport.registerHandler).toHaveBeenCalledWith("pairing-1", expect.any(Function));
    expect(transport.subscribeStatus).toHaveBeenCalled();
  });

  it("should queue outgoing messages and send via transport", async () => {
    await engine.start();

    const msgId = engine.queueOutbound("mobile-dev-id", { type: "text", text: "Hello" });

    expect(msgId).toBeDefined();
    expect(transport.send).toHaveBeenCalledWith(
      "pairing-1",
      expect.objectContaining({
        type: "msg",
        sender: "desktop",
        payload: { type: "text", text: "Hello" },
      }),
    );
  });

  it("should send ACK when receiving a message from mobile", async () => {
    await engine.start();
    transport.send.mockClear();

    const handler = transport._handlers.get("pairing-1");
    await handler({
      type: "msg",
      id: "msg-1",
      sender: "mobile",
      payload: { type: "text", text: "Ping from mobile" },
    });

    // Should have sent ACK
    expect(transport.send).toHaveBeenCalledWith("pairing-1", { type: "ack", id: "msg-1" });
  });

  it("should save incoming images to disk", async () => {
    await engine.start();

    const handler = transport._handlers.get("pairing-1");
    await handler({
      type: "msg",
      id: "msg-2",
      sender: "mobile",
      payload: {
        type: "image",
        mimeType: "image/png",
        data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
      },
    });

    expect(fs.writeFile).toHaveBeenCalled();
  });
});
