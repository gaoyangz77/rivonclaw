import upstreamPlugin from "@tencent-weixin/openclaw-weixin/index.ts";

// Module-level sessionKey bridge: OpenClaw's web.login.wait gateway handler
// only forwards { timeoutMs, accountId } to the plugin, dropping sessionKey.
// We capture it from loginWithQrStart and inject it into loginWithQrWait.
let lastSessionKey = "";

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

const plugin = {
  ...upstreamPlugin,
  register(api: Parameters<typeof upstreamPlugin.register>[0]) {
    const origRegisterChannel = api.registerChannel!.bind(api);
    api.registerChannel = (opts: { plugin: { gatewayMethods?: string[]; gateway?: Record<string, unknown>;[k: string]: unknown };[k: string]: unknown }) => {
      // Patch 1: declare gatewayMethods so resolveWebLoginProvider() can discover us.
      if (opts.plugin && !opts.plugin.gatewayMethods) {
        opts.plugin.gatewayMethods = ["web.login.start", "web.login.wait"];
      }

      // Patch 2: bridge sessionKey between loginWithQrStart and loginWithQrWait.
      const gw = opts.plugin.gateway as Record<string, (...args: unknown[]) => Promise<unknown>> | undefined;
      if (gw) {
        const origStart = gw.loginWithQrStart;
        const origWait = gw.loginWithQrWait;

        if (origStart) {
          gw.loginWithQrStart = async (params: unknown) => {
            const result = await origStart(params) as Record<string, unknown>;
            if (typeof result.sessionKey === "string") {
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
      }

      // Patch 3: keep outbound message-tool mirrors on the current tab.
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
