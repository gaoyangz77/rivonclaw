import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getActivePluginChannelRegistry,
  pinActivePluginChannelRegistry,
  resetPluginRuntimeStateForTest,
  setActivePluginRegistry,
} from "../../../../vendor/openclaw/src/plugins/runtime.js";
import { assertOpenClawChannelRegistryValid } from "../../../../extensions/rivonclaw-capability-manager/src/channel-registry-diagnostics.js";

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

  it("keeps standalone plugin tool discovery off the channel registry surface", () => {
    const toolsSource = fs.readFileSync(
      path.resolve(__dirname, "../../../../vendor/openclaw/src/plugins/tools.ts"),
      "utf8",
    );
    const start = toolsSource.indexOf("export function ensureStandalonePluginToolRegistryLoaded");
    const end = toolsSource.indexOf("export function resolvePluginTools", start);
    const ensureStandaloneBody =
      start >= 0 && end > start ? toolsSource.slice(start, end) : undefined;

    expect(ensureStandaloneBody).toBeTruthy();
    expect(ensureStandaloneBody).not.toContain('surface: "channel"');
    expect(ensureStandaloneBody).toContain('surface: "active"');
  });
});
