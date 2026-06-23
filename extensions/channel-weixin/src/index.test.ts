import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("channel-weixin QR session bridge", () => {
  it("declares channel config metadata for startup config validation", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../openclaw.plugin.json", import.meta.url), "utf-8"),
    ) as {
      channels?: unknown;
      channelConfigs?: Record<string, { schema?: unknown }>;
    };

    // OpenClaw validates `channels.openclaw-weixin` before the runtime plugin
    // registers its outbound-capable channel. The manifest must make the
    // channel id known, while runtime registration remains the send authority.
    expect(manifest.channels).toEqual(["openclaw-weixin"]);
    expect(manifest.channelConfigs?.["openclaw-weixin"]?.schema).toEqual({
      type: "object",
      additionalProperties: true,
    });
  });

  it("passes a fully outbound-capable Weixin channel plugin into OpenClaw registration", async () => {
    vi.resetModules();

    vi.doMock("@tencent-weixin/openclaw-weixin/index.ts", () => ({
      default: {
        register(api: { registerChannel: (opts: unknown) => void }) {
          api.registerChannel({
            plugin: {
              id: "openclaw-weixin",
              outbound: {
                sendText: vi.fn(),
                sendMedia: vi.fn(),
              },
              gateway: {},
            },
          });
        },
      },
    }));

    const { default: plugin } = await import("./index.js");
    let registered!: {
      plugin: {
        id?: string;
        outbound?: {
          sendText?: unknown;
          sendMedia?: unknown;
        };
      };
    };

    plugin.register({
      registerChannel(opts: unknown) {
        registered = opts as typeof registered;
      },
    } as Parameters<typeof plugin.register>[0]);

    expect(registered.plugin.id).toBe("openclaw-weixin");
    expect(registered.plugin.outbound?.sendText).toEqual(expect.any(Function));
    expect(registered.plugin.outbound?.sendMedia).toEqual(expect.any(Function));
  });

  it("rejects sendmessage HTTP 200 responses with WeChat business errors", async () => {
    vi.resetModules();

    const mockFetch = vi.fn(async () =>
      new Response(JSON.stringify({ errcode: -14, errmsg: "context token expired" }), { status: 200 })
    );
    globalThis.fetch = mockFetch as typeof fetch;

    vi.doMock("@tencent-weixin/openclaw-weixin/index.ts", () => ({
      default: {
        register(api: { registerChannel: (opts: unknown) => void }) {
          api.registerChannel({
            plugin: {
              id: "openclaw-weixin",
              outbound: {
                sendText: async (ctx: { accountId?: string; to: string }) => {
                  await fetch("https://mock.weixin.test/ilink/bot/sendmessage", {
                    method: "POST",
                    body: JSON.stringify({
                      msg: {
                        to_user_id: ctx.to,
                        client_id: "client-123",
                        context_token: "redacted-by-test",
                      },
                    }),
                  });
                  return { channel: "openclaw-weixin", messageId: "client-123" };
                },
              },
              gateway: {},
            },
          });
        },
      },
    }));

    const { default: plugin } = await import("./index.js");
    let registered!: {
      plugin: {
        outbound?: {
          sendText?: (ctx: { accountId?: string; to: string; text: string }) => Promise<unknown>;
        };
      };
    };

    plugin.register({
      registerChannel(opts: unknown) {
        registered = opts as typeof registered;
      },
    } as Parameters<typeof plugin.register>[0]);

    await expect(registered.plugin.outbound?.sendText?.({
      accountId: "acct-1",
      to: "manager@im.wechat",
      text: "CS Escalation",
    })).rejects.toThrow(/WeChat sendmessage business failure: .*errcode=-14.*clientId=client-123.*accountId=acct-1.*to=manager@im\.wechat/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("marks the Weixin account unhealthy when sendmessage returns a business failure", async () => {
    vi.resetModules();

    const mockFetch = vi.fn(async () =>
      new Response(JSON.stringify({ ret: -2, errmsg: "" }), { status: 200 })
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const origStartAccount = vi.fn(async () => undefined);
    vi.doMock("@tencent-weixin/openclaw-weixin/index.ts", () => ({
      default: {
        register(api: { registerChannel: (opts: unknown) => void }) {
          api.registerChannel({
            plugin: {
              id: "openclaw-weixin",
              outbound: {
                sendText: async (ctx: { accountId?: string; to: string }) => {
                  await fetch("https://mock.weixin.test/ilink/bot/sendmessage", {
                    method: "POST",
                    body: JSON.stringify({
                      msg: {
                        to_user_id: ctx.to,
                        client_id: "client-456",
                      },
                    }),
                  });
                  return { channel: "openclaw-weixin", messageId: "client-456" };
                },
              },
              gateway: {
                startAccount: origStartAccount,
              },
            },
          });
        },
      },
    }));

    const { default: plugin } = await import("./index.js");
    let registered!: {
      plugin: {
        outbound?: {
          sendText?: (ctx: { accountId?: string; to: string; text: string }) => Promise<unknown>;
        };
        gateway?: {
          startAccount?: (ctx: unknown) => Promise<unknown>;
        };
      };
    };

    plugin.register({
      registerChannel(opts: unknown) {
        registered = opts as typeof registered;
      },
    } as Parameters<typeof plugin.register>[0]);

    const setStatus = vi.fn();
    await registered.plugin.gateway?.startAccount?.({
      account: { accountId: "acct-1" },
      runtime: { error: vi.fn() },
      setStatus,
    });

    await expect(registered.plugin.outbound?.sendText?.({
      accountId: "acct-1",
      to: "manager@im.wechat",
      text: "CS Escalation",
    })).rejects.toThrow(/ret=-2.*accountId=acct-1.*to=manager@im\.wechat/);

    expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({
      accountId: "acct-1",
      running: false,
      connected: false,
      healthy: false,
      healthState: "send-unavailable",
      outboundHealthy: false,
      lastError: expect.stringContaining("ret=-2"),
      lastHealthCheckAt: expect.any(Number),
      lastOutboundError: expect.stringContaining("ret=-2"),
      lastOutboundHealthAt: expect.any(Number),
      lastOutboundRecipientId: "manager@im.wechat",
    }));
  });

  it("does not block later Weixin sends after marking health unavailable", async () => {
    vi.resetModules();

    const mockFetch = vi.fn(async () =>
      new Response(JSON.stringify({ ret: -2, errmsg: "" }), { status: 200 })
    );
    globalThis.fetch = mockFetch as typeof fetch;

    vi.doMock("@tencent-weixin/openclaw-weixin/index.ts", () => ({
      default: {
        register(api: { registerChannel: (opts: unknown) => void }) {
          api.registerChannel({
            plugin: {
              id: "openclaw-weixin",
              outbound: {
                sendText: async (ctx: { accountId?: string; to: string }) => {
                  await fetch("https://mock.weixin.test/ilink/bot/sendmessage", {
                    method: "POST",
                    body: JSON.stringify({
                      msg: {
                        to_user_id: ctx.to,
                        client_id: `client-${mockFetch.mock.calls.length}`,
                      },
                    }),
                  });
                  return { channel: "openclaw-weixin" };
                },
              },
              gateway: {
                startAccount: vi.fn(async () => undefined),
              },
            },
          });
        },
      },
    }));

    const { default: plugin } = await import("./index.js");
    let registered!: {
      plugin: {
        outbound?: {
          sendText?: (ctx: { accountId?: string; to: string; text: string }) => Promise<unknown>;
        };
        gateway?: {
          startAccount?: (ctx: unknown) => Promise<unknown>;
        };
      };
    };

    plugin.register({
      registerChannel(opts: unknown) {
        registered = opts as typeof registered;
      },
    } as Parameters<typeof plugin.register>[0]);

    const setStatus = vi.fn();
    await registered.plugin.gateway?.startAccount?.({
      account: { accountId: "acct-1" },
      runtime: { error: vi.fn() },
      setStatus,
    });

    for (let idx = 0; idx < 2; idx += 1) {
      await expect(registered.plugin.outbound?.sendText?.({
        accountId: "acct-1",
        to: "manager@im.wechat",
        text: "CS Escalation",
      })).rejects.toThrow(/ret=-2/);
    }

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(setStatus).toHaveBeenCalledTimes(2);
  });

  it("marks the Weixin account reauth-required when getUpdates reports session expired", async () => {
    vi.resetModules();

    vi.doMock("@tencent-weixin/openclaw-weixin/index.ts", () => ({
      default: {
        register(api: { registerChannel: (opts: unknown) => void }) {
          api.registerChannel({
            plugin: {
              id: "openclaw-weixin",
              gateway: {
                startAccount: async (ctx: { runtime?: { error?: (message: string) => void } }) => {
                  ctx.runtime?.error?.("weixin getUpdates: session expired (errcode -14)");
                },
              },
            },
          });
        },
      },
    }));

    const { default: plugin } = await import("./index.js");
    let registered!: {
      plugin: {
        gateway?: {
          startAccount?: (ctx: unknown) => Promise<unknown>;
        };
      };
    };

    plugin.register({
      registerChannel(opts: unknown) {
        registered = opts as typeof registered;
      },
    } as Parameters<typeof plugin.register>[0]);

    const setStatus = vi.fn();
    await registered.plugin.gateway?.startAccount?.({
      account: { accountId: "acct-1" },
      runtime: { error: vi.fn() },
      setStatus,
    });

    expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({
      accountId: "acct-1",
      running: false,
      connected: false,
      healthy: false,
      healthState: "reauth-required",
      outboundHealthy: null,
      lastError: expect.stringContaining("session expired"),
      lastHealthCheckAt: expect.any(Number),
    }));
  });

  it("registers RivonClaw QR login gateway methods that call the upstream gateway directly", async () => {
    vi.resetModules();

    const origStart = vi.fn(async () => ({
      qrDataUrl: "data:image/png;base64,abc",
      message: "scan",
      sessionKey: "session-1",
    }));
    const origWait = vi.fn(async () => ({ connected: true, accountId: "acct-1", message: "connected" }));

    vi.doMock("@tencent-weixin/openclaw-weixin/index.ts", () => ({
      default: {
        register(api: { registerChannel: (opts: unknown) => void }) {
          api.registerChannel({
            plugin: {
              gateway: {
                loginWithQrStart: origStart,
                loginWithQrWait: origWait,
              },
            },
          });
        },
      },
    }));

    const { default: plugin } = await import("./index.js");
    const handlers = new Map<string, (args: {
      params: unknown;
      respond: (ok: boolean, payload?: unknown) => void;
      context: unknown;
    }) => Promise<void> | void>();

    plugin.register({
      registerChannel() {},
      registerGatewayMethod(method: string, handler: unknown) {
        handlers.set(method, handler as (args: {
          params: unknown;
          respond: (ok: boolean, payload?: unknown) => void;
          context: unknown;
        }) => Promise<void> | void);
      },
    } as Parameters<typeof plugin.register>[0]);

    const responses: Array<{ ok: boolean; payload?: unknown }> = [];
    const context = {
      getRuntimeSnapshot: () => ({ channels: {}, channelAccounts: {} }),
      startChannel: vi.fn(async () => undefined),
      stopChannel: vi.fn(async () => undefined),
    };

    await handlers.get("rivonclaw.weixin.login.start")?.({
      params: { accountId: "acct-1" },
      respond: (ok, payload) => responses.push({ ok, payload }),
      context,
    });
    await handlers.get("rivonclaw.weixin.login.wait")?.({
      params: { accountId: "acct-1", timeoutMs: 123 },
      respond: (ok, payload) => responses.push({ ok, payload }),
      context,
    });

    expect(origStart).toHaveBeenCalledWith({
      force: false,
      timeoutMs: undefined,
      verbose: false,
      accountId: "acct-1",
    });
    expect(origWait).toHaveBeenCalledWith({
      timeoutMs: 123,
      accountId: "acct-1",
      currentQrDataUrl: undefined,
      sessionKey: expect.any(String),
    });
    expect(context.stopChannel).toHaveBeenCalledWith("openclaw-weixin", "acct-1");
    expect(context.startChannel).toHaveBeenCalledWith("openclaw-weixin", "acct-1");
    expect(responses).toEqual([
      {
        ok: true,
        payload: {
          qrDataUrl: "data:image/png;base64,abc",
          message: "scan",
          sessionKey: "session-1",
        },
      },
      { ok: true, payload: { connected: true, accountId: "acct-1", message: "connected" } },
    ]);
  });

  it("declares web login gateway methods even when upstream provides an incomplete list", async () => {
    vi.resetModules();

    vi.doMock("@tencent-weixin/openclaw-weixin/index.ts", () => ({
      default: {
        register(api: { registerChannel: (opts: unknown) => void }) {
          api.registerChannel({
            plugin: {
              gatewayMethods: ["some.other.method", "web.login.start"],
              gateway: {},
            },
          });
        },
      },
    }));

    const { default: plugin } = await import("./index.js");
    let registered!: { plugin: { gatewayMethods?: string[] } };

    plugin.register({
      registerChannel(opts: unknown) {
        registered = opts as typeof registered;
      },
    } as Parameters<typeof plugin.register>[0]);

    expect(registered.plugin.gatewayMethods).toEqual([
      "some.other.method",
      "web.login.start",
      "web.login.wait",
    ]);
  });

  it("does not claim WeChat account config changes are channel-hot-reloadable", async () => {
    vi.resetModules();

    vi.doMock("@tencent-weixin/openclaw-weixin/index.ts", () => ({
      default: {
        register(api: { registerChannel: (opts: unknown) => void }) {
          api.registerChannel({
            plugin: {
              reload: { configPrefixes: ["channels.openclaw-weixin.extra"] },
              gateway: {},
            },
          });
        },
      },
    }));

    const { default: plugin } = await import("./index.js");
    let registered!: { plugin: { reload?: { configPrefixes?: string[] } } };

    plugin.register({
      registerChannel(opts: unknown) {
        registered = opts as typeof registered;
      },
    } as Parameters<typeof plugin.register>[0]);

    expect(registered.plugin.reload?.configPrefixes).toEqual([
      "channels.openclaw-weixin.extra",
    ]);
  });

  it("does not start a newly scanned account before desktop has persisted it to config", async () => {
    vi.resetModules();

    const origWait = vi.fn(async () => ({ connected: true, accountId: "new-acct", message: "connected" }));

    vi.doMock("@tencent-weixin/openclaw-weixin/index.ts", () => ({
      default: {
        register(api: { registerChannel: (opts: unknown) => void }) {
          api.registerChannel({
            plugin: {
              gateway: {
                loginWithQrWait: origWait,
              },
            },
          });
        },
      },
    }));

    const { default: plugin } = await import("./index.js");
    const handlers = new Map<string, (args: {
      params: unknown;
      respond: (ok: boolean, payload?: unknown) => void;
      context: unknown;
    }) => Promise<void> | void>();

    plugin.register({
      registerChannel() {},
      registerGatewayMethod(method: string, handler: unknown) {
        handlers.set(method, handler as (args: {
          params: unknown;
          respond: (ok: boolean, payload?: unknown) => void;
          context: unknown;
        }) => Promise<void> | void);
      },
    } as Parameters<typeof plugin.register>[0]);

    const context = {
      startChannel: vi.fn(async () => undefined),
    };
    const responses: Array<{ ok: boolean; payload?: unknown }> = [];

    await handlers.get("rivonclaw.weixin.login.wait")?.({
      params: { timeoutMs: 123 },
      respond: (ok, payload) => responses.push({ ok, payload }),
      context,
    });

    expect(context.startChannel).not.toHaveBeenCalled();
    expect(responses).toEqual([
      { ok: true, payload: { connected: true, accountId: "new-acct", message: "connected" } },
    ]);
  });

  it("keeps wait bound to the newest QR start when an older start resolves later", async () => {
    vi.resetModules();

    let resolveFirst!: (value: Record<string, unknown>) => void;
    let resolveSecond!: (value: Record<string, unknown>) => void;
    const startCalls: Array<Promise<Record<string, unknown>>> = [
      new Promise((resolve) => { resolveFirst = resolve; }),
      new Promise((resolve) => { resolveSecond = resolve; }),
    ];
    const origStart = vi.fn(() => startCalls.shift()!);
    const origWait = vi.fn(async (params: unknown) => ({
      connected: false,
      message: JSON.stringify(params),
    }));

    vi.doMock("@tencent-weixin/openclaw-weixin/index.ts", () => ({
      default: {
        register(api: { registerChannel: (opts: unknown) => void }) {
          api.registerChannel({
            plugin: {
              gateway: {
                loginWithQrStart: origStart,
                loginWithQrWait: origWait,
              },
            },
          });
        },
      },
    }));

    const { default: plugin } = await import("./index.js");
    let wrappedGateway!: {
      loginWithQrStart: (params: unknown) => Promise<unknown>;
      loginWithQrWait: (params: Record<string, unknown>) => Promise<unknown>;
    };

    plugin.register({
      registerChannel(opts: unknown) {
        wrappedGateway = (opts as { plugin: { gateway: typeof wrappedGateway } }).plugin.gateway;
      },
    } as Parameters<typeof plugin.register>[0]);

    const first = wrappedGateway.loginWithQrStart({});
    const second = wrappedGateway.loginWithQrStart({});

    resolveSecond({ sessionKey: "session-new" });
    await second;
    resolveFirst({ sessionKey: "session-old" });
    await first;

    await wrappedGateway.loginWithQrWait({});

    expect(origWait).toHaveBeenCalledWith({ sessionKey: "session-new" });
  });
});
