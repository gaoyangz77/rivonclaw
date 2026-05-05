import { afterEach, describe, expect, it } from "vitest";
import {
  getActivePluginChannelRegistry,
  pinActivePluginChannelRegistry,
  resetPluginRuntimeStateForTest,
  setActivePluginRegistry,
} from "../../../../vendor/openclaw/src/plugins/runtime.js";

function createRegistry(channelIds: string[]) {
  return {
    plugins: [],
    diagnostics: [],
    gatewayHandlers: {},
    gatewayMethods: [],
    httpRoutes: [],
    channels: channelIds.map((id) => ({
      pluginId: id,
      origin: "bundled",
      plugin: { id, meta: {} },
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
  });

  it("keeps a non-empty pinned channel registry when a later plugin load has no channels", () => {
    const startupRegistry = createRegistry(["telegram", "feishu"]);
    const deferredRegistry = createRegistry([]);
    const refreshedRegistry = createRegistry(["telegram", "feishu", "mobile"]);

    setActivePluginRegistry(startupRegistry as never, "startup");
    pinActivePluginChannelRegistry(startupRegistry as never);

    pinActivePluginChannelRegistry(deferredRegistry as never);
    expect(getActivePluginChannelRegistry()).toBe(startupRegistry);

    pinActivePluginChannelRegistry(refreshedRegistry as never);
    expect(getActivePluginChannelRegistry()).toBe(refreshedRegistry);
  });
});
