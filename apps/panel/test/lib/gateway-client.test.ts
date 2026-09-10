// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GatewayChatClient } from "../../src/lib/gateway-client.js";

const identityMocks = vi.hoisted(() => ({ load: vi.fn(), sign: vi.fn() }));
vi.mock("../../src/lib/gateway-device-identity.js", () => ({
  loadOrCreateGatewayDeviceIdentity: identityMocks.load,
  buildGatewayDeviceAuthPayload: (value: unknown) => JSON.stringify(value),
}));

class TestSocket {
  static OPEN = 1;
  static instances: TestSocket[] = [];
  readyState = 0;
  frames: Array<{ id: string; method: string; params: Record<string, unknown> }> = [];
  listeners = new Map<string, (event: { data?: string }) => void>();
  close = vi.fn(() => { this.readyState = 3; });

  constructor() { TestSocket.instances.push(this); }
  addEventListener(name: string, handler: (event: { data?: string }) => void) {
    this.listeners.set(name, handler);
  }
  send(raw: string) { this.frames.push(JSON.parse(raw)); }
  message(frame: unknown) { this.listeners.get("message")?.({ data: JSON.stringify(frame) }); }
  open(nonce = "nonce") {
    this.readyState = TestSocket.OPEN;
    this.message({ type: "event", event: "connect.challenge", payload: { nonce } });
  }
  disconnect() {
    this.readyState = 3;
    this.listeners.get("close")?.({});
  }
  accept() {
    const connect = this.frames.find((frame) => frame.method === "connect")!;
    this.message({ type: "res", id: connect.id, ok: true, payload: { type: "hello-ok", protocol: 4 } });
  }
}

describe("GatewayChatClient handshake lifecycle", () => {
  const clients: GatewayChatClient[] = [];
  function createClient(options: Partial<ConstructorParameters<typeof GatewayChatClient>[0]> = {}) {
    const client = new GatewayChatClient({ url: "ws://test.invalid", autoStartKeepalive: false, ...options });
    clients.push(client);
    client.start();
    return client;
  }
  beforeEach(() => {
    vi.useFakeTimers();
    TestSocket.instances = [];
    vi.stubGlobal("WebSocket", TestSocket);
    vi.stubGlobal("navigator", { platform: "test", language: "en", userAgent: "test" });
    identityMocks.load.mockReset().mockResolvedValue({ deviceId: "device", publicKey: "public", sign: identityMocks.sign });
    identityMocks.sign.mockReset().mockResolvedValue("signature");
  });
  afterEach(() => {
    for (const client of clients.splice(0)) client.stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rejects history before authentication and sends connect as the first frame", async () => {
    const onConnected = vi.fn();
    const client = createClient({ onConnected });
    const ws = TestSocket.instances[0];
    ws.open();
    expect(client.connected).toBe(false);
    await expect(client.request("chat.history", { sessionKey: "main" })).rejects.toThrow("gateway not connected");
    await vi.advanceTimersByTimeAsync(0);
    expect(ws.frames.map((frame) => frame.method)).toEqual(["connect"]);
    expect(client.connected).toBe(false);
    ws.accept();
    await vi.advanceTimersByTimeAsync(0);
    expect(client.connected).toBe(true);
    expect(onConnected).toHaveBeenCalledOnce();
    const history = client.request("chat.history", { sessionKey: "main" });
    ws.message({ type: "res", id: ws.frames[1].id, ok: true, payload: { messages: [] } });
    await expect(history).resolves.toEqual({ messages: [] });
  });

  it("does not deliver business events before authentication", async () => {
    const onEvent = vi.fn();
    createClient({ onEvent });
    const ws = TestSocket.instances[0];
    ws.open();
    ws.message({ type: "event", event: "chat" });
    expect(onEvent).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(0);
    ws.accept();
    await vi.advanceTimersByTimeAsync(0);
    ws.message({ type: "event", event: "chat" });
    expect(onEvent).toHaveBeenCalledOnce();
  });

  it("ignores a previous socket's delayed signature and late close after reconnect", async () => {
    let resolveSignature!: (value: string) => void;
    identityMocks.sign.mockImplementationOnce(() => new Promise<string>((resolve) => { resolveSignature = resolve; }));
    const client = createClient();
    const old = TestSocket.instances[0];
    old.open("old");
    await vi.advanceTimersByTimeAsync(0);
    old.disconnect();
    await vi.advanceTimersByTimeAsync(800);
    const current = TestSocket.instances[1];
    current.open("current");
    await vi.advanceTimersByTimeAsync(0);
    current.accept();
    await vi.advanceTimersByTimeAsync(0);
    resolveSignature("stale");
    old.disconnect();
    old.message({ type: "event", event: "connect.challenge", payload: { nonce: "stale" } });
    await vi.advanceTimersByTimeAsync(0);
    expect(client.connected).toBe(true);
    expect(current.close).not.toHaveBeenCalled();
    expect(current.frames).toHaveLength(1);
    expect(current.frames[0].params.device).toMatchObject({ nonce: "current" });
    expect(old.frames).toEqual([]);
  });

  it("does not close a new socket when an old handshake rejection settles", async () => {
    const client = createClient();
    const old = TestSocket.instances[0];
    old.open();
    await vi.advanceTimersByTimeAsync(0);
    client.stop();
    client.start();
    const current = TestSocket.instances[1];
    await vi.advanceTimersByTimeAsync(0);
    expect(current.close).not.toHaveBeenCalled();
    old.disconnect();
    current.open();
    await vi.advanceTimersByTimeAsync(0);
    current.accept();
    await vi.advanceTimersByTimeAsync(0);
    expect(client.connected).toBe(true);
  });

  it("cancels scheduled reconnect on stop and does not create duplicate sockets on start", async () => {
    const client = createClient();
    client.start();
    expect(TestSocket.instances).toHaveLength(1);
    TestSocket.instances[0].disconnect();
    client.stop();
    client.start();
    await vi.advanceTimersByTimeAsync(2000);
    expect(TestSocket.instances).toHaveLength(2);
    client.stop();
    expect(client.connected).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects pending requests on disconnect and waits for the next authentication", async () => {
    const client = createClient();
    const old = TestSocket.instances[0];
    old.open();
    await vi.advanceTimersByTimeAsync(0);
    old.accept();
    await vi.advanceTimersByTimeAsync(0);
    const result = expect(client.request("chat.history")).rejects.toThrow("gateway disconnected");
    old.disconnect();
    await result;
    await vi.advanceTimersByTimeAsync(800);
    TestSocket.instances[1].open();
    await expect(client.request("chat.history")).rejects.toThrow("gateway not connected");
  });
});

describe("GatewayChatClient keepalive control", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("only starts keepalive after it is explicitly enabled on an authenticated connection", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const client = new GatewayChatClient({
      url: "ws://127.0.0.1:59457",
      autoStartKeepalive: false,
    });

    client.setKeepaliveEnabled(true);
    expect(setIntervalSpy).not.toHaveBeenCalled();

    (client as { authenticated: boolean }).authenticated = true;
    client.setKeepaliveEnabled(true);
    expect(setIntervalSpy).toHaveBeenCalledOnce();

    client.setKeepaliveEnabled(false);
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
