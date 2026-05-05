import { describe, expect, it, vi } from "vitest";

describe("channel-weixin QR session bridge", () => {
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
