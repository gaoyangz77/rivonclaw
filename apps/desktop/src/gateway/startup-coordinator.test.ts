import { describe, expect, it, vi } from "vitest";
import { CLOUD_TOOLS_PLUGIN_ID, CLOUD_TOOLS_STATUS_METHOD } from "./tool-catalog-loader.js";
import { runGatewayStartupCoordinator } from "./startup-coordinator.js";

type RpcClientLike = Parameters<typeof runGatewayStartupCoordinator>[0]["rpc"];

describe("runGatewayStartupCoordinator", () => {
  it("waits for cloud tools once before running startup tasks", async () => {
    const catalog = {
      groups: [
        {
          tools: [
            { id: "read", source: "core" },
            { id: "ecom_find_orders", source: "plugin", pluginId: CLOUD_TOOLS_PLUGIN_ID },
          ],
        },
      ],
    };
    const statuses = [
      { ready: false, toolCount: 0 },
      { ready: true, toolCount: 1 },
    ];
    const request = vi.fn(async (method: string) => {
      if (method === CLOUD_TOOLS_STATUS_METHOD) return statuses.shift();
      return catalog;
    });
    const rpc: RpcClientLike = {
      request: request as RpcClientLike["request"],
    };
    const calls: string[] = [];

    await runGatewayStartupCoordinator({
      rpc,
      retryDelayMs: 0,
      sleep: vi.fn(async () => undefined),
      initializeToolCapability: (tools) => {
        calls.push(`capability:${tools.length}`);
      },
      tasks: [
        {
          name: "cs-bridge",
          run: () => {
            calls.push("cs-bridge");
          },
        },
        {
          name: "other",
          run: () => {
            calls.push("other");
          },
        },
      ],
    });

    expect(request).toHaveBeenCalledWith(CLOUD_TOOLS_STATUS_METHOD);
    expect(calls).toEqual(["capability:2", "cs-bridge", "other"]);
  });

  it("always waits for cloud tools before running any startup task", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === CLOUD_TOOLS_STATUS_METHOD) return { ready: true, toolCount: 0 };
      return { groups: [{ tools: [{ id: "read", source: "core" }] }] };
    });
    const rpc: RpcClientLike = {
      request: request as RpcClientLike["request"],
    };
    const task = vi.fn();

    await runGatewayStartupCoordinator({
      rpc,
      initializeToolCapability: vi.fn(),
      tasks: [{ name: "plain-task", run: task }],
    });

    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledWith("tools.catalog", { includePlugins: true });
    expect(request).toHaveBeenCalledWith(CLOUD_TOOLS_STATUS_METHOD);
    expect(task).toHaveBeenCalledOnce();
  });

  it("does not run startup tasks when cloud tools are unavailable", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === CLOUD_TOOLS_STATUS_METHOD) return { ready: false, toolCount: 0 };
      return { groups: [{ tools: [{ id: "read", source: "core" }] }] };
    });
    const rpc: RpcClientLike = { request: request as RpcClientLike["request"] };
    const task = vi.fn();

    await expect(runGatewayStartupCoordinator({
      rpc,
      initializeToolCapability: vi.fn(),
      maxAttempts: 1,
      retryDelayMs: 0,
      sleep: vi.fn(async () => undefined),
      tasks: [{ name: "plain-task", run: task }],
    })).rejects.toThrow("was not ready");

    expect(task).not.toHaveBeenCalled();
  });
});
