// Transport-level recovery tests that exercise the REAL graphql-ws client
// against a scripted fake WebSocket. The earlier unit tests mock graphql-ws
// away, which is exactly the blind spot that let the production stall escape:
// a close(1001) whose reconnect attempt hangs in CONNECTING forever produced
// no socket events, no retries, and no logs for an hour.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakeSocketMode = "connect" | "hang";

const harness = vi.hoisted(() => {
  class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    static instances: FakeWebSocket[] = [];
    /** Mode consumed per construction; defaults to "connect". */
    static nextModes: FakeSocketMode[] = [];

    static reset(): void {
      FakeWebSocket.instances = [];
      FakeWebSocket.nextModes = [];
    }

    readyState = FakeWebSocket.CONNECTING;
    url: string;
    mode: FakeSocketMode;
    sent: string[] = [];
    onopen: (() => void) | null = null;
    onclose: ((event: { code: number; reason: string; wasClean: boolean }) => void) | null = null;
    onerror: ((err: unknown) => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;

    constructor(url: string | URL) {
      this.url = String(url);
      this.mode = FakeWebSocket.nextModes.shift() ?? "connect";
      FakeWebSocket.instances.push(this);
      if (this.mode === "connect") {
        setTimeout(() => {
          if (this.readyState !== FakeWebSocket.CONNECTING) return;
          this.readyState = FakeWebSocket.OPEN;
          this.onopen?.();
        }, 0);
      }
      // "hang": stay in CONNECTING and never emit anything — models a proxy
      // CONNECT tunnel that black-holes the upgrade with no timeout anywhere.
    }

    send(data: string): void {
      this.sent.push(data);
      const message = JSON.parse(data) as { type: string };
      if (message.type === "connection_init") {
        setTimeout(() => {
          this.onmessage?.({ data: JSON.stringify({ type: "connection_ack" }) });
        }, 0);
      } else if (message.type === "ping") {
        setTimeout(() => {
          this.onmessage?.({ data: JSON.stringify({ type: "pong" }) });
        }, 0);
      }
    }

    close(code = 1000, reason = ""): void {
      if (this.readyState === FakeWebSocket.CLOSED) return;
      this.readyState = FakeWebSocket.CLOSED;
      setTimeout(() => {
        this.onclose?.({ code, reason, wasClean: code === 1000 });
      }, 0);
    }

    /** Server-initiated close delivered synchronously (e.g. backend deploy 1001). */
    serverClose(code: number, reason: string): void {
      this.readyState = FakeWebSocket.CLOSED;
      this.onclose?.({ code, reason, wasClean: false });
    }

    subscribeMessages(): Array<{ id: string; payload: { query: string } }> {
      return this.sent
        .map((raw) => JSON.parse(raw) as { type: string; id: string; payload: { query: string } })
        .filter((message) => message.type === "subscribe");
    }

    connectionInitPayload(): Record<string, string> | undefined {
      const init = this.sent
        .map((raw) => JSON.parse(raw) as { type: string; payload?: Record<string, string> })
        .find((message) => message.type === "connection_init");
      return init?.payload;
    }
  }

  return { FakeWebSocket };
});

vi.mock("@rivonclaw/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rivonclaw/core")>()),
  getApiBaseUrl: () => "https://api.example.test",
}));

vi.mock("../infra/proxy/proxy-aware-network.js", () => ({
  proxyNetwork: {
    createProxiedWebSocketClass: () => harness.FakeWebSocket,
  },
}));

const { FakeWebSocket } = harness;

const STALL_TIMEOUT_MS = 90_000;

async function importClient() {
  const { BackendSubscriptionClient } = await import("./backend-subscription-client.js");
  return BackendSubscriptionClient;
}

async function connectWithTwoLongLivedOps(token: () => string | null) {
  const BackendSubscriptionClient = await importClient();
  const client = new BackendSubscriptionClient("en-US");
  client.connect(token);
  client.subscribeToToolSpecsChanged(vi.fn());
  client.subscribeToPresetSkillsChanged(vi.fn());
  client.enableAuthenticatedSubscriptions();
  await vi.advanceTimersByTimeAsync(20);
  return client;
}

describe("BackendSubscriptionClient transport recovery (real graphql-ws)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reconnects after a server close(1001) and restores every long-lived operation exactly once", async () => {
    const client = await connectWithTwoLongLivedOps(() => "token-1");

    const first = FakeWebSocket.instances[0];
    expect(first.subscribeMessages()).toHaveLength(2);
    expect(client.isConnected()).toBe(true);

    first.serverClose(1001, "Going away");
    expect(client.isConnected()).toBe(false);

    // graphql-ws retryWait backoff (1s) + open/ack round-trips.
    await vi.advanceTimersByTimeAsync(2_000);

    expect(FakeWebSocket.instances).toHaveLength(2);
    const second = FakeWebSocket.instances[1];
    const resubscribed = second.subscribeMessages();
    expect(resubscribed).toHaveLength(2);
    const queries = resubscribed.map((message) => message.payload.query).sort();
    expect(queries[0]).toContain("PresetSkillsChanged");
    expect(queries[1]).toContain("ToolSpecsChanged");
    expect(client.isConnected()).toBe(true);

    client.disconnect();
  });

  it("still restores operations when the reconnect recovery hook throws", async () => {
    const BackendSubscriptionClient = await importClient();
    const client = new BackendSubscriptionClient("en-US");
    client.connect(() => "token-1", {
      onConnectedAfterRetry: () => {
        throw new Error("hook exploded");
      },
    });
    client.subscribeToToolSpecsChanged(vi.fn());
    client.subscribeToPresetSkillsChanged(vi.fn());
    client.enableAuthenticatedSubscriptions();
    await vi.advanceTimersByTimeAsync(20);

    FakeWebSocket.instances[0].serverClose(1001, "Going away");
    await vi.advanceTimersByTimeAsync(2_000);

    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(FakeWebSocket.instances[1].subscribeMessages()).toHaveLength(2);
    expect(client.isConnected()).toBe(true);

    client.disconnect();
  });

  it("terminates a stalled reconnect attempt via the stall watchdog and recovers", async () => {
    const client = await connectWithTwoLongLivedOps(() => "token-1");

    FakeWebSocket.nextModes.push("hang");
    FakeWebSocket.instances[0].serverClose(1001, "Going away");

    // Backoff elapses, the reconnect socket is constructed and hangs forever.
    await vi.advanceTimersByTimeAsync(1_500);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(FakeWebSocket.instances[1].readyState).toBe(FakeWebSocket.CONNECTING);
    expect(client.isConnected()).toBe(false);

    // Watchdog fires, terminate() settles the wedged connect, retry proceeds.
    await vi.advanceTimersByTimeAsync(STALL_TIMEOUT_MS);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(FakeWebSocket.instances.length).toBeGreaterThanOrEqual(3);
    const last = FakeWebSocket.instances.at(-1)!;
    expect(last.subscribeMessages()).toHaveLength(2);
    expect(client.isConnected()).toBe(true);

    client.disconnect();
  });

  it("recovers a credentials change that happens while the transport is down and stalled", async () => {
    let token = "token-1";
    const client = await connectWithTwoLongLivedOps(() => token);

    FakeWebSocket.nextModes.push("hang");
    FakeWebSocket.instances[0].serverClose(1001, "Going away");
    await vi.advanceTimersByTimeAsync(1_500);
    expect(client.isConnected()).toBe(false);

    // Credentials rotate while the reconnect attempt is wedged. restart() must
    // settle the pending connect instead of deferring to an `opened` event
    // that will never fire.
    token = "token-2";
    await client.handleCredentialsChanged();
    await vi.advanceTimersByTimeAsync(5_000);

    const last = FakeWebSocket.instances.at(-1)!;
    expect(last.connectionInitPayload()).toMatchObject({ authorization: "Bearer token-2" });
    expect(last.subscribeMessages()).toHaveLength(2);
    expect(client.isConnected()).toBe(true);

    client.disconnect();
  });

  it("does not reconnect after an explicit disconnect", async () => {
    const client = await connectWithTwoLongLivedOps(() => "token-1");
    expect(client.isConnected()).toBe(true);

    client.disconnect();
    await vi.advanceTimersByTimeAsync(5 * STALL_TIMEOUT_MS);

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(client.isConnected()).toBe(false);
  });

  it("escalates to a transport rebuild after repeated stalls and still recovers without duplicate subscriptions", async () => {
    const client = await connectWithTwoLongLivedOps(() => "token-1");

    // Two consecutive reconnect attempts hang — e.g. a proxy that black-holes
    // CONNECT tunnels for a while. Stage 1 terminates, stage 2 rebuilds.
    FakeWebSocket.nextModes.push("hang", "hang");
    FakeWebSocket.instances[0].serverClose(1001, "Going away");

    await vi.advanceTimersByTimeAsync(1_500); // hang #1 constructed
    await vi.advanceTimersByTimeAsync(STALL_TIMEOUT_MS); // stage 1: terminate
    await vi.advanceTimersByTimeAsync(3_000); // hang #2 constructed
    await vi.advanceTimersByTimeAsync(STALL_TIMEOUT_MS); // stage 2: rebuild
    await vi.advanceTimersByTimeAsync(5_000); // fresh client connects

    expect(client.isConnected()).toBe(true);
    const last = FakeWebSocket.instances.at(-1)!;
    const resubscribed = last.subscribeMessages();
    expect(resubscribed).toHaveLength(2);
    expect(new Set(resubscribed.map((message) => message.payload.query)).size).toBe(2);

    client.disconnect();
  });
});
