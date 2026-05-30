import { afterEach, describe, expect, it, vi } from "vitest";
import { CLOUD_TOOLS_PLUGIN_ID, CLOUD_TOOLS_STATUS_METHOD } from "./tool-catalog-loader.js";
import type { loadGatewayToolCatalogTools } from "./tool-catalog-loader.js";
import {
  configureAgentToolingReadiness,
  __clearAgentToolingReadinessForTests,
  ensureAgentToolingReady,
  resetAgentToolingReadiness,
} from "./agent-tooling-readiness.js";

type RpcClientLike = Parameters<typeof loadGatewayToolCatalogTools>[0];

describe("agent tooling readiness", () => {
  afterEach(() => {
    __clearAgentToolingReadinessForTests();
  });

  it("caches readiness for the current generation", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === CLOUD_TOOLS_STATUS_METHOD) return { ready: true, toolCount: 1 };
      return {
        groups: [
          {
            tools: [
              { id: "read", source: "core" },
              { id: "ecom_find_orders", source: "plugin", pluginId: CLOUD_TOOLS_PLUGIN_ID },
            ],
          },
        ],
      };
    });
    const rpc: RpcClientLike = {
      request: request as RpcClientLike["request"],
    };
    const initializeToolCapability = vi.fn();

    configureAgentToolingReadiness({
      getRpc: () => rpc,
      isAuthenticated: () => true,
      initializeToolCapability,
      retryDelayMs: 0,
      sleep: vi.fn(async () => undefined),
    });
    resetAgentToolingReadiness("test");

    await ensureAgentToolingReady();
    await ensureAgentToolingReady();

    expect(initializeToolCapability).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("rechecks readiness after generation reset", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === CLOUD_TOOLS_STATUS_METHOD) return { ready: true, toolCount: 1 };
      return {
        groups: [
          {
            tools: [
              { id: "read", source: "core" },
              { id: "ecom_find_orders", source: "plugin", pluginId: CLOUD_TOOLS_PLUGIN_ID },
            ],
          },
        ],
      };
    });
    const rpc: RpcClientLike = {
      request: request as RpcClientLike["request"],
    };
    const initializeToolCapability = vi.fn();

    configureAgentToolingReadiness({
      getRpc: () => rpc,
      isAuthenticated: () => true,
      initializeToolCapability,
      retryDelayMs: 0,
      sleep: vi.fn(async () => undefined),
    });
    resetAgentToolingReadiness("initial");
    await ensureAgentToolingReady();

    resetAgentToolingReadiness("auth change");
    await ensureAgentToolingReady();

    expect(initializeToolCapability).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledTimes(4);
  });
});
