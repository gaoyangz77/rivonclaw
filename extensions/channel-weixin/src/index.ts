import upstreamPlugin from "@tencent-weixin/openclaw-weixin/index.ts";

// Upstream plugin defines gateway.loginWithQrStart/loginWithQrWait but does not
// declare gatewayMethods, which OpenClaw's resolveWebLoginProvider() requires to
// discover the web login provider. Patch it in at registration time.
const plugin = {
  ...upstreamPlugin,
  register(api: Parameters<typeof upstreamPlugin.register>[0]) {
    const origRegisterChannel = api.registerChannel!.bind(api);
    api.registerChannel = (opts: { plugin: { gatewayMethods?: string[];[k: string]: unknown };[k: string]: unknown }) => {
      if (opts.plugin && !opts.plugin.gatewayMethods) {
        opts.plugin.gatewayMethods = ["web.login.start", "web.login.wait"];
      }
      return origRegisterChannel(opts);
    };
    upstreamPlugin.register(api);
  },
};

export default plugin;
