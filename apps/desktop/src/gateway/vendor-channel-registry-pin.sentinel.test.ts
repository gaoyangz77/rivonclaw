import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { assertOpenClawChannelRegistryValid } from "../../../../extensions/rivonclaw-capability-manager/src/channel-registry-diagnostics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RUNTIME_CHANNEL_STATE_FILE = resolve(
  __dirname,
  "../../../../vendor/openclaw/src/plugins/runtime-channel-state.ts",
);
const PLUGIN_REGISTRY_STATE = Symbol.for("openclaw.pluginRegistryState");

function createRegistry(channelIds: string[], withOutbound = false) {
  return {
    channels: channelIds.map((id) => ({
      pluginId: id,
      plugin: {
        id,
        ...(withOutbound ? { outbound: { sendText: async () => ({ messageId: "sent" }) } } : {}),
      },
    })),
  };
}

function setActiveRegistry(registry: ReturnType<typeof createRegistry>): void {
  Object.assign(globalThis, {
    [PLUGIN_REGISTRY_STATE]: {
      activeRegistry: registry,
      activeVersion: 1,
    },
  });
}

describe("OpenClaw channel registry ownership", () => {
  afterEach(() => {
    delete (globalThis as Record<symbol, unknown>)[PLUGIN_REGISTRY_STATE];
  });

  it("uses the process-root active registry without the retired pinning scaffold", () => {
    const source = readFileSync(RUNTIME_CHANNEL_STATE_FILE, "utf8");

    expect(source).toContain("state?.activeRegistry ?? null");
    expect(source).not.toContain("state?.channel?.registry");
    expect(source).not.toContain("pinActivePluginChannelRegistry");
  });

  it("keeps RivonClaw outbound diagnostics compatible with the active registry", () => {
    setActiveRegistry(createRegistry(["telegram", "feishu"], true));

    expect(() => assertOpenClawChannelRegistryValid(["telegram"])).not.toThrow();
  });

  it("fails loudly when the active registry loses a required outbound adapter", () => {
    setActiveRegistry(createRegistry(["telegram", "feishu"], false));

    expect(() => assertOpenClawChannelRegistryValid(["telegram"])).toThrow(
      /telegram:REQUIRED_CHANNEL_MISSING_OUTBOUND/,
    );
  });
});
