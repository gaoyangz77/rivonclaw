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

  it("keeps tooling unavailable after a failed gate and recovers on a later attempt", async () => {
    let ready = false;
    const request = vi.fn(async (method: string) => {
      if (method === CLOUD_TOOLS_STATUS_METHOD) {
        return ready ? { ready: true, toolCount: 1 } : { ready: false, toolCount: 0 };
      }
      return {
        groups: [{
          tools: ready
            ? [
                { id: "read", source: "core" },
                { id: "ecom_find_orders", source: "plugin", pluginId: CLOUD_TOOLS_PLUGIN_ID },
              ]
            : [{ id: "read", source: "core" }],
        }],
      };
    });
    const rpc: RpcClientLike = { request: request as RpcClientLike["request"] };
    const initializeToolCapability = vi.fn();
    const setCloudToolsStatus = vi.fn();

    configureAgentToolingReadiness({
      getRpc: () => rpc,
      initializeToolCapability,
      setCloudToolsStatus,
      maxAttempts: 1,
      retryDelayMs: 0,
      sleep: vi.fn(async () => undefined),
    });

    await expect(ensureAgentToolingReady()).rejects.toThrow("was not ready");
    expect(initializeToolCapability).not.toHaveBeenCalled();
    expect(setCloudToolsStatus).toHaveBeenLastCalledWith(
      "unavailable",
      expect.stringContaining("was not ready"),
    );

    ready = true;
    await ensureAgentToolingReady();

    expect(initializeToolCapability).toHaveBeenCalledOnce();
    expect(setCloudToolsStatus).toHaveBeenLastCalledWith("ready");
  });
});
