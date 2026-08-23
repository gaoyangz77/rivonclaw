import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";

// ─── ws stub ───────────────────────────────────────────────────────────────
//
// The reconnect timeline is the thing under test, so the socket is faked down
// to the three behaviours that decide it: whether a `connect.challenge` ever
// arrives, whether the `connect` response arrives, and whether the socket
// emits "close" on its own.

const OPEN = 1;

class FakeWebSocket extends EventEmitter {
  static instances: FakeWebSocket[] = [];
  // The client compares readyState against these statics before sending.
  static readonly OPEN = OPEN;
  static readonly CLOSED = 3;

  readyState = OPEN;
  sent: string[] = [];
  terminated = false;
  closedWith: number | null = null;

  constructor(public url: string) {
    super();
    FakeWebSocket.instances.push(this);
  }

  send(raw: string): void {
    this.sent.push(raw);
  }

  close(code?: number): void {
    this.closedWith = code ?? 1000;
    this.emitClose(code ?? 1000);
  }

  terminate(): void {
    this.terminated = true;
    this.emitClose(1006);
  }

  /** Deliver the gateway's opening challenge frame. */
  sendChallenge(nonce = "nonce-1"): void {
    this.emit("message", Buffer.from(JSON.stringify({ type: "event", event: "connect.challenge", payload: { nonce } })));
  }

  /** Answer the pending `connect` request so the handshake completes. */
  ackConnect(): void {
    const frame = this.sent.map((raw) => JSON.parse(raw) as { id: string; method: string }).find((f) => f.method === "connect");
    if (!frame) throw new Error("no connect request was sent");
    this.emit("message", Buffer.from(JSON.stringify({ type: "res", id: frame.id, ok: true, payload: { type: "hello-ok", protocol: 4 } })));
  }

  private emitClose(code: number): void {
    if (this.readyState !== OPEN) return;
    this.readyState = 3;
    this.emit("close", code, Buffer.from(""));
  }
}

vi.mock("ws", () => ({ WebSocket: FakeWebSocket }));
vi.mock("@rivonclaw/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const { GatewayRpcClient } = await import("./rpc-client.js");

// ─── helpers ───────────────────────────────────────────────────────────────

/** Let queued microtasks run without advancing fake timers. */
const flush = () => vi.advanceTimersByTimeAsync(0);

const latest = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1]!;

function makeClient(overrides: Record<string, unknown> = {}) {
  return new GatewayRpcClient({
    url: "ws://127.0.0.1:1234",
    reconnectDelay: 1000,
    maxReconnectDelay: 30000,
    connectTimeoutMs: 20000,
    ...overrides,
  });
}

describe("GatewayRpcClient reconnect timeline", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps retrying after a handshake whose connect response never arrives", async () => {
    // The 2026-08-23 outage: the socket opened and the challenge arrived, but
    // the stalled gateway never answered `connect`. The request timed out with
    // the socket still open, so no "close" fired and the old code stopped
    // reconnecting for good.
    const client = makeClient();
    void client.start();
    await flush();

    latest().sendChallenge();
    await flush();
    expect(latest().sent.some((raw) => raw.includes('"connect"'))).toBe(true);

    // sendConnect()'s own 10s request timeout.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(latest().terminated).toBe(true);
    expect(client.isConnected()).toBe(false);

    const attemptsBefore = FakeWebSocket.instances.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeWebSocket.instances.length).toBe(attemptsBefore + 1);

    // And it keeps going, rather than dying after one retry.
    latest().sendChallenge();
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(FakeWebSocket.instances.length).toBe(attemptsBefore + 2);

    client.stop();
  });

  it("gives up on a socket that never sends a challenge and retries", async () => {
    // A gateway can accept the upgrade and then go quiet. Without a deadline
    // the connect promise never settles and the timeline stops with it.
    const client = makeClient({ connectTimeoutMs: 5000 });
    void client.start();
    await flush();

    expect(FakeWebSocket.instances.length).toBe(1);

    await vi.advanceTimersByTimeAsync(4999);
    expect(latest().terminated).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(latest().terminated).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeWebSocket.instances.length).toBe(2);

    client.stop();
  });

  it("schedules exactly one retry when a failed attempt both closes and rejects", async () => {
    // The close event and the connect() rejection describe the same failure.
    // Two timers here would double the attempt counter and defeat the backoff.
    const client = makeClient();
    void client.start();
    await flush();

    latest().close(1006);
    await flush();

    expect(FakeWebSocket.instances.length).toBe(1);

    // Backoff for attempt 1 is 1000ms — a second timeline would have opened a
    // socket before this point and another right after.
    await vi.advanceTimersByTimeAsync(999);
    expect(FakeWebSocket.instances.length).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(FakeWebSocket.instances.length).toBe(2);

    // Attempt 2 backs off to 2000ms, proving the counter advanced once.
    latest().close(1006);
    await vi.advanceTimersByTimeAsync(1999);
    expect(FakeWebSocket.instances.length).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeWebSocket.instances.length).toBe(3);

    client.stop();
  });

  it("connects, and reconnects after the connection later drops", async () => {
    const onConnect = vi.fn();
    const onClose = vi.fn();
    const client = makeClient({ onConnect, onClose });

    void client.start();
    await flush();
    latest().sendChallenge();
    await flush();
    latest().ackConnect();
    await flush();

    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(client.isConnected()).toBe(true);

    latest().close(1006);
    await flush();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(client.isConnected()).toBe(false);

    // A successful connection resets the backoff, so the retry is one delay in.
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeWebSocket.instances.length).toBe(2);

    latest().sendChallenge();
    await flush();
    latest().ackConnect();
    await flush();
    expect(onConnect).toHaveBeenCalledTimes(2);
    expect(client.isConnected()).toBe(true);

    client.stop();
  });

  it("stops retrying once the client is stopped", async () => {
    const client = makeClient();
    void client.start();
    await flush();

    latest().close(1006);
    await flush();
    client.stop();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeWebSocket.instances.length).toBe(1);
  });

  it("caps the backoff at maxReconnectDelay", async () => {
    const client = makeClient({ reconnectDelay: 1000, maxReconnectDelay: 4000 });
    void client.start();
    await flush();

    // Fail repeatedly: 1000, 2000, 4000, then capped at 4000.
    for (const delay of [1000, 2000, 4000, 4000]) {
      const before = FakeWebSocket.instances.length;
      latest().close(1006);
      await flush();
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(FakeWebSocket.instances.length).toBe(before);
      await vi.advanceTimersByTimeAsync(1);
      expect(FakeWebSocket.instances.length).toBe(before + 1);
    }

    client.stop();
  });
});
