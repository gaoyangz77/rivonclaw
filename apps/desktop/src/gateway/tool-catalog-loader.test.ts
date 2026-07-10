import { describe, expect, it, vi } from "vitest";
import {
  CloudToolsNotReadyError,
  CLOUD_TOOLS_PLUGIN_ID,
  CLOUD_TOOLS_STATUS_METHOD,
  loadGatewayToolCatalogTools,
} from "./tool-catalog-loader.js";

type RpcClientLike = Parameters<typeof loadGatewayToolCatalogTools>[0];

describe("loadGatewayToolCatalogTools", () => {
  it("waits until cloud tools appear before returning the catalog", async () => {
    const catalogResponses = [
      {
        groups: [{ tools: [{ id: "read", source: "core" }] }],
      },
      {
        groups: [
          {
            tools: [
              { id: "read", source: "core" },
              { id: "ecom_find_orders", source: "plugin", pluginId: CLOUD_TOOLS_PLUGIN_ID },
            ],
          },
        ],
      },
    ];
    const request = vi.fn(async (method: string) => {
      if (method === CLOUD_TOOLS_STATUS_METHOD) return { ready: true, toolCount: 1 };
      return catalogResponses.shift();
    });
    const rpc: RpcClientLike = {
      request: request as RpcClientLike["request"],
    };
    const logger = { info: vi.fn(), warn: vi.fn() };
    const sleep = vi.fn(async () => undefined);

    const tools = await loadGatewayToolCatalogTools(rpc, {
      logger,
      maxAttempts: 3,
      retryDelayMs: 0,
      sleep,
    });

    expect(request).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(tools).toEqual([
      { id: "read", source: "core" },
      { id: "ecom_find_orders", source: "plugin", pluginId: CLOUD_TOOLS_PLUGIN_ID },
    ]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("waits until cloud tool specs are ready even after cloud tools appear in the catalog", async () => {
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
    const statusResponses = [
      { ready: false, toolCount: 0 },
      { ready: false, toolCount: 0 },
      { ready: true, toolCount: 1 },
    ];
    const request = vi.fn(async (method: string) => {
      if (method === CLOUD_TOOLS_STATUS_METHOD) return statusResponses.shift();
      return catalog;
    });
    const rpc: RpcClientLike = {
      request: request as RpcClientLike["request"],
    };
    const sleep = vi.fn(async () => undefined);

    const tools = await loadGatewayToolCatalogTools(rpc, {
      maxAttempts: 3,
      retryDelayMs: 0,
      sleep,
    });

    expect(request).toHaveBeenCalledTimes(6);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(tools).toContainEqual({
      id: "ecom_find_orders",
      source: "plugin",
      pluginId: CLOUD_TOOLS_PLUGIN_ID,
    });
  });

  it("rejects instead of returning an incomplete catalog", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === CLOUD_TOOLS_STATUS_METHOD) return { ready: false, toolCount: 0 };
      return {
        groups: [{ tools: [{ id: "read", source: "core" }] }],
      };
    });
    const rpc: RpcClientLike = {
      request: request as RpcClientLike["request"],
    };
    const logger = { info: vi.fn(), warn: vi.fn() };

    await expect(
      loadGatewayToolCatalogTools(rpc, {
        logger,
        maxAttempts: 2,
        retryDelayMs: 0,
        sleep: vi.fn(async () => undefined),
      }),
    ).rejects.toBeInstanceOf(CloudToolsNotReadyError);

    expect(request).toHaveBeenCalledTimes(4);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("refusing to initialize ToolCapability"),
      expect.any(CloudToolsNotReadyError),
    );
  });

  it("accepts a ready empty ToolSpecs snapshot while signed out", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === CLOUD_TOOLS_STATUS_METHOD) return { ready: true, toolCount: 0 };
      return {
        groups: [{ tools: [{ id: "read", source: "core" }] }],
      };
    });
    const rpc: RpcClientLike = {
      request: request as RpcClientLike["request"],
    };

    const tools = await loadGatewayToolCatalogTools(rpc, {
      maxAttempts: 3,
      sleep: vi.fn(async () => undefined),
    });

    expect(request).toHaveBeenCalledTimes(2);
    expect(tools).toEqual([{ id: "read", source: "core" }]);
  });

  it("waits until the plugin and catalog tool counts match", async () => {
    const catalogResponses = [
      { groups: [{ tools: [{ id: "read", source: "core" }] }] },
      {
        groups: [{
          tools: [
            { id: "read", source: "core" },
            { id: "ecom_find_orders", source: "plugin", pluginId: CLOUD_TOOLS_PLUGIN_ID },
          ],
        }],
      },
    ];
    const request = vi.fn(async (method: string) => {
      if (method === CLOUD_TOOLS_STATUS_METHOD) return { ready: true, toolCount: 1 };
      return catalogResponses.shift();
    });
    const rpc: RpcClientLike = { request: request as RpcClientLike["request"] };
    const sleep = vi.fn(async () => undefined);

    const tools = await loadGatewayToolCatalogTools(rpc, {
      maxAttempts: 2,
      retryDelayMs: 0,
      sleep,
    });

    expect(sleep).toHaveBeenCalledOnce();
    expect(tools).toHaveLength(2);
  });
});
