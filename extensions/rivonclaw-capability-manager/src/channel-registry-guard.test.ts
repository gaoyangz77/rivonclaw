import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installOpenClawChannelRegistryGuard,
  resetOpenClawChannelRegistryGuardForTest,
  restoreOpenClawChannelRegistryIfPolluted,
} from "./channel-registry-guard.js";

const PLUGIN_REGISTRY_STATE = Symbol.for("openclaw.pluginRegistryState");

type TestRegistry = {
  channels: Array<{
    pluginId: string;
    plugin: {
      id: string;
      outbound?: { sendText?: () => Promise<unknown> };
    };
  }>;
};

function registry(channelId: string, withOutbound: boolean): TestRegistry {
  return {
    channels: [
      {
        pluginId: channelId,
        plugin: {
          id: channelId,
          ...(withOutbound ? { outbound: { sendText: async () => ({ messageId: "ok" }) } } : {}),
        },
      },
    ],
  };
}

function setRegistryState(channelRegistry: TestRegistry): void {
  (globalThis as typeof globalThis & { [PLUGIN_REGISTRY_STATE]?: unknown })[
    PLUGIN_REGISTRY_STATE
  ] = {
    activeRegistry: channelRegistry,
    activeVersion: 1,
    channel: {
      registry: channelRegistry,
      version: 1,
    },
  };
}

function getRegistryState(): {
  channel: { registry: TestRegistry; version: number };
} {
  return (globalThis as typeof globalThis & {
    [PLUGIN_REGISTRY_STATE]: { channel: { registry: TestRegistry; version: number } };
  })[PLUGIN_REGISTRY_STATE];
}

describe("OpenClaw channel registry guard", () => {
  afterEach(() => {
    resetOpenClawChannelRegistryGuardForTest();
    delete (globalThis as typeof globalThis & { [PLUGIN_REGISTRY_STATE]?: unknown })[
      PLUGIN_REGISTRY_STATE
    ];
  });

  it("restores a healthy outbound registry when tool discovery pins a channel shell", () => {
    const healthy = registry("telegram", true);
    const polluted = registry("telegram", false);
    const warn = vi.fn();

    setRegistryState(healthy);
    installOpenClawChannelRegistryGuard({ warn });

    getRegistryState().channel.registry = polluted;
    getRegistryState().channel.version += 1;

    expect(restoreOpenClawChannelRegistryIfPolluted("unit test", { warn })).toBe(true);
    expect(getRegistryState().channel.registry).toBe(healthy);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("missing outbound adapters: telegram"),
    );
  });

  it("does not restore over a new healthy channel registry", () => {
    const healthy = registry("telegram", true);
    const refreshed = registry("openclaw-weixin", true);

    setRegistryState(healthy);
    installOpenClawChannelRegistryGuard();

    getRegistryState().channel.registry = refreshed;
    getRegistryState().channel.version += 1;

    expect(restoreOpenClawChannelRegistryIfPolluted("unit test")).toBe(false);
    expect(getRegistryState().channel.registry).toBe(refreshed);
  });
});
