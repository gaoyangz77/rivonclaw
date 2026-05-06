import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiContext } from "../app/api-context.js";
import { RouteRegistry } from "../infra/api/route-registry.js";

const mockOpenClawConnector = vi.hoisted(() => ({
  ensureRpcReady: vi.fn(),
}));

vi.mock("../openclaw/index.js", () => ({
  openClawConnector: mockOpenClawConnector,
}));

const { registerChannelsHandlers } = await import("./api.js");

let registry: RouteRegistry;
const rpcClient = { request: vi.fn() };

beforeEach(() => {
  registry = new RouteRegistry();
  registerChannelsHandlers(registry);
  mockOpenClawConnector.ensureRpcReady.mockReset();
  mockOpenClawConnector.ensureRpcReady.mockReturnValue(rpcClient);
  rpcClient.request.mockReset();
});

async function dispatch(method: string, path: string, ctx: ApiContext, body?: unknown) {
  const req = makeReq(method, body);
  const res = makeRes();
  const url = new URL(`http://localhost${path}`);
  const handled = await registry.dispatch(req, res, url, path, ctx);
  return { handled, res };
}

async function waitForAssertion(assertion: () => void): Promise<void> {
  let lastError: unknown;
  for (let i = 0; i < 20; i++) {
    try {
      assertion();
      return;
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  throw lastError;
}

function makeReq(method: string, body?: unknown): IncomingMessage {
  const readable = new Readable({ read() {} });
  if (body !== undefined) {
    readable.push(JSON.stringify(body));
  }
  readable.push(null);
  (readable as any).method = method;
  (readable as any).headers = {};
  return readable as unknown as IncomingMessage;
}

function makeRes(): ServerResponse & { _status: number; _body: unknown } {
  const res = {
    _status: 0,
    _body: null as unknown,
    writeHead(status: number) {
      res._status = status;
      return res;
    },
    end(data?: string) {
      if (data) res._body = JSON.parse(data);
    },
  } as unknown as ServerResponse & { _status: number; _body: unknown };
  return res;
}

describe("channels QR login routes", () => {
  it("coalesces concurrent Weixin QR start calls for the same account", async () => {
    let resolveStart!: (value: {
      message: string;
      qrDataUrl: string;
      sessionKey: string;
    }) => void;
    const startPromise = new Promise<{
      message: string;
      qrDataUrl: string;
      sessionKey: string;
    }>((resolve) => {
      resolveStart = resolve;
    });
    const channelManager = {
      startQrLogin: vi.fn(() => startPromise),
      waitQrLogin: vi.fn().mockResolvedValue({
        connected: false,
        message: "timeout",
      }),
    };
    const ctx = { channelManager } as unknown as ApiContext;

    const firstPromise = dispatch("POST", "/api/channels/qr-login/start", ctx, { accountId: "acct-concurrent" });
    const secondPromise = dispatch("POST", "/api/channels/qr-login/start", ctx, { accountId: "acct-concurrent" });

    await waitForAssertion(() => {
      expect(channelManager.startQrLogin).toHaveBeenCalledTimes(1);
    });
    resolveStart({
      message: "scan",
      qrDataUrl: "https://qr.example/concurrent",
      sessionKey: "session-concurrent",
    });

    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(first.res._status).toBe(200);
    expect(second.res._status).toBe(200);
    expect(first.res._body).toEqual(second.res._body);
    expect(channelManager.startQrLogin).toHaveBeenCalledWith(rpcClient, "acct-concurrent");

    await dispatch("POST", "/api/channels/qr-login/wait", ctx, {
      accountId: "acct-concurrent",
      sessionKey: "session-concurrent",
    });
  });

  it("reuses an active Weixin QR start session and clears it after wait", async () => {
    const channelManager = {
      startQrLogin: vi.fn()
        .mockResolvedValueOnce({
          message: "scan",
          qrDataUrl: "https://qr.example/one",
          sessionKey: "session-one",
        })
        .mockResolvedValueOnce({
          message: "scan",
          qrDataUrl: "https://qr.example/two",
          sessionKey: "session-two",
        }),
      waitQrLogin: vi.fn().mockResolvedValue({
        connected: true,
        message: "ok",
        accountId: "acct-1",
      }),
    };
    const onChannelConfigured = vi.fn();
    const ctx = { channelManager, onChannelConfigured } as unknown as ApiContext;

    const first = await dispatch("POST", "/api/channels/qr-login/start", ctx, {});
    const second = await dispatch("POST", "/api/channels/qr-login/start", ctx, {});

    expect(first.handled).toBe(true);
    expect(first.res._status).toBe(200);
    expect(second.res._status).toBe(200);
    expect(first.res._body).toEqual(second.res._body);
    expect(channelManager.startQrLogin).toHaveBeenCalledTimes(1);

    const wait = await dispatch("POST", "/api/channels/qr-login/wait", ctx, {
      sessionKey: "session-one",
      timeoutMs: 30_000,
    });

    expect(wait.res._status).toBe(200);
    expect(channelManager.waitQrLogin).toHaveBeenCalledWith(rpcClient, undefined, 30_000, "session-one");
    expect(onChannelConfigured).toHaveBeenCalledWith("openclaw-weixin");

    const third = await dispatch("POST", "/api/channels/qr-login/start", ctx, {});

    expect(third.res._status).toBe(200);
    expect(third.res._body).toMatchObject({ sessionKey: "session-two" });
    expect(channelManager.startQrLogin).toHaveBeenCalledTimes(2);
  });
});
