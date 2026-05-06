import upstreamPlugin from "@tencent-weixin/openclaw-weixin/index.ts";

const WEIXIN_CHANNEL_ID = "openclaw-weixin";
const RIVONCLAW_WEIXIN_LOGIN_START = "rivonclaw.weixin.login.start";
const RIVONCLAW_WEIXIN_LOGIN_WAIT = "rivonclaw.weixin.login.wait";

// Module-level sessionKey bridge: OpenClaw's web.login.wait gateway handler
// only forwards { timeoutMs, accountId } to the plugin, dropping sessionKey.
// We capture it from loginWithQrStart and inject it into loginWithQrWait.
let lastSessionKey = "";
let latestQrStartSeq = 0;

function normalizeWeixinTarget(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("openclaw-weixin:")) {
    return trimmed.slice("openclaw-weixin:".length).trim();
  }
  if (trimmed.startsWith("user:")) {
    return trimmed.slice("user:".length).trim();
  }
  return trimmed;
}

function isSessionExpiredMessage(message: string): boolean {
  return message.includes("session expired") && message.includes("errcode -14");
}

function markWeixinSessionExpired(ctx: unknown, message: string): void {
  const c = ctx as {
    account?: { accountId?: string };
    setStatus?: (next: Record<string, unknown>) => void;
  };
  const accountId = c.account?.accountId;
  if (!accountId || typeof c.setStatus !== "function") return;

  c.setStatus({
    accountId,
    running: false,
    lastError: message,
    lastEventAt: Date.now(),
  });
}

function resolveAccountId(params: unknown): string | undefined {
  const value = (params as { accountId?: unknown })?.accountId;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function wasChannelRunning(params: {
  context: unknown;
  accountId?: string;
}): boolean {
  const context = params.context as {
    getRuntimeSnapshot?: () => {
      channels?: Record<string, { running?: boolean; accountId?: string } | undefined>;
      channelAccounts?: Record<string, Record<string, { running?: boolean } | undefined> | undefined>;
    };
  };
  const runtime = context.getRuntimeSnapshot?.();
  if (!runtime) return false;
  if (params.accountId) {
    const accountRuntime = runtime.channelAccounts?.[WEIXIN_CHANNEL_ID]?.[params.accountId];
    if (accountRuntime) return accountRuntime.running === true;
  }
  if (!params.accountId) {
    return runtime.channels?.[WEIXIN_CHANNEL_ID]?.running === true;
  }
  const defaultRuntime = runtime.channels?.[WEIXIN_CHANNEL_ID];
  return defaultRuntime?.accountId === params.accountId && defaultRuntime.running === true;
}

function registerRivonClawQrLoginMethods(params: {
  api: Parameters<typeof upstreamPlugin.register>[0];
  gateway: Record<string, (...args: unknown[]) => Promise<unknown>>;
}) {
  if (typeof params.api.registerGatewayMethod !== "function") return;

  // OpenClaw core currently fails to discover openclaw-weixin as the provider
  // for web.login.start/web.login.wait in RivonClaw's embedded UI path. Keep
  // these RivonClaw-owned RPC names until the upstream discovery path is fixed.
  // Upstream tracking:
  // - https://github.com/openclaw/openclaw/issues/62120
  // - https://github.com/Tencent/openclaw-weixin/pull/73
  // - https://github.com/netease-youdao/LobsterAI/pull/1592
  params.api.registerGatewayMethod(RIVONCLAW_WEIXIN_LOGIN_START, async ({ params: requestParams, respond, context }) => {
    const loginWithQrStart = params.gateway.loginWithQrStart;
    if (!loginWithQrStart) {
      respond(false, { error: "WeChat QR login start is not available" });
      return;
    }

    try {
      const accountId = resolveAccountId(requestParams);
      const wasRunning = wasChannelRunning({ context, accountId });
      const c = context as {
        startChannel?: (channelId: string, accountId?: string) => Promise<void>;
        stopChannel?: (channelId: string, accountId?: string) => Promise<void>;
      };
      if (accountId) {
        await c.stopChannel?.(WEIXIN_CHANNEL_ID, accountId);
      }

      const request = requestParams as { force?: unknown; timeoutMs?: unknown; verbose?: unknown };
      const result = await loginWithQrStart({
        force: Boolean(request.force),
        timeoutMs: typeof request.timeoutMs === "number" ? request.timeoutMs : undefined,
        verbose: Boolean(request.verbose),
        accountId,
      }) as { connected?: boolean; qrDataUrl?: string };

      if (accountId && result.connected) {
        await c.startChannel?.(WEIXIN_CHANNEL_ID, accountId);
      } else if (accountId && wasRunning && !result.qrDataUrl) {
        await c.startChannel?.(WEIXIN_CHANNEL_ID, accountId);
      }
      respond(true, result);
    } catch (err) {
      respond(false, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  params.api.registerGatewayMethod(RIVONCLAW_WEIXIN_LOGIN_WAIT, async ({ params: requestParams, respond, context }) => {
    const loginWithQrWait = params.gateway.loginWithQrWait;
    if (!loginWithQrWait) {
      respond(false, { error: "WeChat QR login wait is not available" });
      return;
    }

    try {
      const accountId = resolveAccountId(requestParams);
      const request = requestParams as { timeoutMs?: unknown; currentQrDataUrl?: unknown };
      const result = await loginWithQrWait({
        timeoutMs: typeof request.timeoutMs === "number" ? request.timeoutMs : undefined,
        accountId,
        currentQrDataUrl: typeof request.currentQrDataUrl === "string" ? request.currentQrDataUrl : undefined,
      }) as { connected?: boolean; accountId?: string };

      if (accountId && result.connected) {
        const c = context as { startChannel?: (channelId: string, accountId?: string) => Promise<void> };
        await c.startChannel?.(WEIXIN_CHANNEL_ID, accountId);
      }
      respond(true, result);
    } catch (err) {
      respond(false, { error: err instanceof Error ? err.message : String(err) });
    }
  });
}

const plugin = {
  ...upstreamPlugin,
  register(api: Parameters<typeof upstreamPlugin.register>[0]) {
    const origRegisterChannel = api.registerChannel!.bind(api);
    let rivonClawQrMethodsRegistered = false;
    api.registerChannel = (opts: { plugin: { gatewayMethods?: string[]; gateway?: Record<string, unknown>;[k: string]: unknown };[k: string]: unknown }) => {
      // Compatibility shim: declare gatewayMethods so resolveWebLoginProvider() can discover us.
      // Upstream tracking:
      // - https://github.com/openclaw/openclaw/issues/62120
      // - https://github.com/Tencent/openclaw-weixin/pull/73
      // - https://github.com/netease-youdao/LobsterAI/pull/1592
      // Remove this wrapper once @tencent-weixin/openclaw-weixin ships these
      // declarations and our supported version range requires that release.
      if (opts.plugin) {
        opts.plugin.gatewayMethods = Array.from(new Set([
          ...(opts.plugin.gatewayMethods ?? []),
          "web.login.start",
          "web.login.wait",
        ]));

        // Compatibility shim: declare WeChat account config changes as
        // channel-hot-reloadable.
        //
        // Without this, OpenClaw treats changes under channels.openclaw-weixin
        // as unknown config changes and escalates them to a gateway restart. In
        // RivonClaw Desktop the gateway is launched with OPENCLAW_NO_RESPAWN=1,
        // so that restart happens in-process; Telegram keeps a process-global
        // polling lease and then refuses to start after the in-process restart.
        //
        // Upstream tracking:
        // - https://github.com/openclaw/openclaw/issues/62120
        // - https://github.com/Tencent/openclaw-weixin/pull/73
        // - https://github.com/netease-youdao/LobsterAI/pull/1592
        // Remove this wrapper once @tencent-weixin/openclaw-weixin declares its
        // gateway methods and reload prefixes itself.
        opts.plugin.reload = {
          ...(typeof opts.plugin.reload === "object" && opts.plugin.reload !== null
            ? opts.plugin.reload
            : {}),
          configPrefixes: Array.from(new Set([
            ...((opts.plugin.reload as { configPrefixes?: string[] } | undefined)?.configPrefixes ?? []),
            `channels.${WEIXIN_CHANNEL_ID}`,
          ])),
        };
      }

      // Compatibility shim: bridge sessionKey between loginWithQrStart and loginWithQrWait.
      const gw = opts.plugin.gateway as Record<string, (...args: unknown[]) => Promise<unknown>> | undefined;
      if (gw) {
        const origStartAccount = gw.startAccount;
        const origStart = gw.loginWithQrStart;
        const origWait = gw.loginWithQrWait;

        if (origStartAccount) {
          gw.startAccount = async (ctx: unknown) => {
            const c = ctx as {
              runtime?: {
                error?: (message: string) => void;
                [key: string]: unknown;
              };
              [key: string]: unknown;
            };
            const originalRuntime = c.runtime;
            c.runtime = {
              ...originalRuntime,
              error: (message: string) => {
                originalRuntime?.error?.(message);
                if (isSessionExpiredMessage(message)) {
                  markWeixinSessionExpired(ctx, message);
                }
              },
            };

            try {
              return await origStartAccount(ctx);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              if (isSessionExpiredMessage(message)) {
                markWeixinSessionExpired(ctx, message);
              }
              throw err;
            }
          };
        }

        if (origStart) {
          gw.loginWithQrStart = async (params: unknown) => {
            const seq = ++latestQrStartSeq;
            const result = await origStart(params) as Record<string, unknown>;
            if (seq === latestQrStartSeq && typeof result.sessionKey === "string") {
              lastSessionKey = result.sessionKey;
            }
            return result;
          };
        }

        if (origWait) {
          gw.loginWithQrWait = async (params: unknown) => {
            const p = params as Record<string, unknown>;
            if (!p.sessionKey && lastSessionKey) {
              p.sessionKey = lastSessionKey;
            }
            return origWait(p);
          };
        }

        if (!rivonClawQrMethodsRegistered) {
          rivonClawQrMethodsRegistered = true;
          registerRivonClawQrLoginMethods({ api, gateway: gw });
        }
      }

      // Compatibility shim: keep outbound message-tool mirrors on the current tab.
      //
      // For Weixin, media/file sends often go through the message tool's
      // outbound route resolution instead of the inbound reply pipeline.
      // When accountId is omitted, the upstream fallback route can materialize
      // a different session key from the active inbound session, which makes
      // the Chat Page open a second tab for the same conversation.
      //
      // Reusing the current sessionKey keeps tool-based file sends attached to
      // the conversation the user is already viewing. Explicit accountId sends
      // keep the upstream behavior.
      const messaging = opts.plugin.messaging as {
        resolveOutboundSessionRoute?: (params: {
          target: string;
          accountId?: string | null;
          currentSessionKey?: string;
        }) => unknown | Promise<unknown>;
      } | undefined;

      if (messaging) {
        const origResolveOutboundSessionRoute = messaging.resolveOutboundSessionRoute;
        messaging.resolveOutboundSessionRoute = async (params) => {
          if (!params.accountId && typeof params.currentSessionKey === "string" && params.currentSessionKey.trim()) {
            const peerId = normalizeWeixinTarget(params.target);
            if (peerId) {
              return {
                sessionKey: params.currentSessionKey,
                baseSessionKey: params.currentSessionKey,
                peer: { kind: "direct", id: peerId },
                chatType: "direct",
                from: `openclaw-weixin:${peerId}`,
                to: `user:${peerId}`,
              };
            }
          }
          return origResolveOutboundSessionRoute?.(params) ?? null;
        };
      }

      return origRegisterChannel(opts);
    };
    upstreamPlugin.register(api);
  },
};

export default plugin;
