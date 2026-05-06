import { afterEach, describe, expect, it } from "vitest";
import {
  getActivePluginChannelRegistry,
  pinActivePluginChannelRegistry,
  resetPluginRuntimeStateForTest,
  setActivePluginRegistry,
} from "../../../../vendor/openclaw/src/plugins/runtime.js";
import {
  installOpenClawChannelRegistryGuard,
  resetOpenClawChannelRegistryGuardForTest,
  restoreOpenClawChannelRegistryIfPolluted,
} from "../../../../extensions/rivonclaw-capability-manager/src/channel-registry-guard.js";

function createRegistry(channelIds: string[], withOutbound = false) {
  return {
    plugins: [],
    diagnostics: [],
    gatewayHandlers: {},
    gatewayMethods: [],
    httpRoutes: [],
    channels: channelIds.map((id) => ({
      pluginId: id,
      origin: "bundled",
      plugin: {
        id,
        meta: {},
        ...(withOutbound ? { outbound: { sendText: async () => ({ messageId: "sent" }) } } : {}),
      },
    })),
    sessionExtensions: [],
    runtimeLifecycles: [],
    agentEventSubscriptions: [],
    sessionSchedulerJobs: [],
  };
}

describe("OpenClaw channel registry pinning", () => {
  afterEach(() => {
    resetPluginRuntimeStateForTest();
    resetOpenClawChannelRegistryGuardForTest();
  });

  it("restores the outbound channel registry when tool discovery pins channel shells", () => {
    const startupRegistry = createRegistry(["telegram", "feishu"], true);
    const toolDiscoveryRegistry = createRegistry(["telegram", "feishu"], false);

    setActivePluginRegistry(startupRegistry as never, "startup");
    pinActivePluginChannelRegistry(startupRegistry as never);
    installOpenClawChannelRegistryGuard();

    pinActivePluginChannelRegistry(toolDiscoveryRegistry as never);
    expect(getActivePluginChannelRegistry()).toBe(toolDiscoveryRegistry);

    expect(restoreOpenClawChannelRegistryIfPolluted("sentinel test")).toBe(true);
    expect(getActivePluginChannelRegistry()).toBe(startupRegistry);
  });
});
