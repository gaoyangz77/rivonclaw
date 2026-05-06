import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertOpenClawChannelRegistryValid,
  inspectOpenClawChannelRegistry,
  warnIfOpenClawChannelRegistryInvalid,
} from "./channel-registry-diagnostics.js";

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

function setRegistryState(params: {
  activeRegistry: TestRegistry;
  channelRegistry: TestRegistry;
  pinned?: boolean;
}): void {
  (globalThis as typeof globalThis & { [PLUGIN_REGISTRY_STATE]?: unknown })[
    PLUGIN_REGISTRY_STATE
  ] = {
    activeRegistry: params.activeRegistry,
    activeVersion: 1,
    channel: {
      registry: params.channelRegistry,
      pinned: params.pinned ?? true,
      version: 1,
    },
  };
}

describe("OpenClaw channel registry diagnostics", () => {
  afterEach(() => {
    delete (globalThis as typeof globalThis & { [PLUGIN_REGISTRY_STATE]?: unknown })[
      PLUGIN_REGISTRY_STATE
    ];
  });

  it("reports but does not restore a pinned channel shell that lost outbound", () => {
    const healthy = registry("telegram", true);
    const polluted = registry("telegram", false);
    const warn = vi.fn();

    setRegistryState({
      activeRegistry: healthy,
      channelRegistry: polluted,
    });

    const inspection = inspectOpenClawChannelRegistry(["telegram"]);
    expect(inspection.issues).toEqual([
      {
        channelId: "telegram",
        reason: "REQUIRED_CHANNEL_MISSING_OUTBOUND",
      },
    ]);
    expect(warnIfOpenClawChannelRegistryInvalid("unit test", { warn }, ["telegram"])).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("telegram"));

    expect(() => assertOpenClawChannelRegistryValid(["telegram"])).toThrow(
      /missing outbound adapters/,
    );
    expect(inspectOpenClawChannelRegistry(["telegram"]).outboundChannelIds).toEqual([]);
  });

  it("accepts a pinned channel registry that still has outbound", () => {
    const healthy = registry("openclaw-weixin", true);

    setRegistryState({
      activeRegistry: healthy,
      channelRegistry: healthy,
    });

    expect(inspectOpenClawChannelRegistry(["openclaw-weixin"]).issues).toEqual([]);
    expect(warnIfOpenClawChannelRegistryInvalid("unit test", { warn: vi.fn() }, [
      "openclaw-weixin",
    ])).toBe(false);
    expect(() => assertOpenClawChannelRegistryValid(["openclaw-weixin"])).not.toThrow();
  });
});
