import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { assertOpenClawChannelRegistryValid } from "../../../../extensions/rivonclaw-capability-manager/src/channel-registry-diagnostics.js";

const vendorDist = resolve(__dirname, "../../../../vendor/openclaw/dist");
const runtimeEntry = readdirSync(vendorDist)
  .filter((name) => /^runtime-.*\.js$/.test(name))
  .find((name) =>
    readFileSync(resolve(vendorDist, name), "utf8").includes(
      "export { collectLivePluginRegistries, getActivePluginChannelRegistry",
    ),
  );
if (!runtimeEntry) throw new Error("Unable to locate built OpenClaw plugin runtime entry");
const {
  getActivePluginChannelRegistry,
  pinActivePluginChannelRegistry,
  resetPluginRuntimeStateForTest,
  setActivePluginRegistry,
} = await import(pathToFileURL(resolve(vendorDist, runtimeEntry)).href);

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
  });

  it("keeps outbound channel adapters pinned across later non-channel registry loads", async () => {
    const startupRegistry = createRegistry(["telegram", "feishu"], true);
    const toolDiscoveryRegistry = createRegistry(["telegram", "feishu"], false);

    setActivePluginRegistry(startupRegistry as never, "startup");
    pinActivePluginChannelRegistry(startupRegistry as never);

    setActivePluginRegistry(toolDiscoveryRegistry as never, "tool-discovery");

    expect(getActivePluginChannelRegistry()).toBe(startupRegistry);
    expect(() => assertOpenClawChannelRegistryValid(["telegram"])).not.toThrow();
  });

  it("fails loudly if a channel shell is incorrectly pinned over the outbound registry", async () => {
    const startupRegistry = createRegistry(["telegram", "feishu"], true);
    const toolDiscoveryRegistry = createRegistry(["telegram", "feishu"], false);

    setActivePluginRegistry(startupRegistry as never, "startup");
    pinActivePluginChannelRegistry(startupRegistry as never);
    pinActivePluginChannelRegistry(toolDiscoveryRegistry as never);

    expect(getActivePluginChannelRegistry()).toBe(toolDiscoveryRegistry);
    expect(() => assertOpenClawChannelRegistryValid(["telegram"])).toThrow(
      /telegram:REQUIRED_CHANNEL_MISSING_OUTBOUND/,
    );
  });
});
