import { describe, expect, it, vi } from "vitest";
import plugin from "../src/plugin.js";

function createApi() {
  let channelPlugin: any = null;
  return {
    api: {
      id: plugin.id,
      logger: { info: vi.fn(), warn: vi.fn() },
      registerChannel: vi.fn((entry: any) => {
        channelPlugin = entry.plugin;
      }),
      registerGatewayMethod: vi.fn(),
      on: vi.fn(),
    },
    getChannelPlugin() {
      return channelPlugin;
    },
  };
}

describe("mobile channel outbound failures", () => {
  it("throws a clear error when sendMedia is called without an active engine", async () => {
    const { api, getChannelPlugin } = createApi();
    plugin.activate(api as any);
    const channelPlugin = getChannelPlugin();

    await expect(
      channelPlugin.outbound.sendMedia({
        to: "mobile:missing-pairing",
        text: "caption",
        mediaUrl: "/tmp/demo.png",
      }),
    ).rejects.toThrow(/not connected/i);
  });
});
