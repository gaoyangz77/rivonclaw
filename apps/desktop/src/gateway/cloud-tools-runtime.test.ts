import { describe, expect, it, vi } from "vitest";
import {
  CLOUD_TOOLS_RELOAD_METHOD,
  reloadCloudToolsFromSpecs,
} from "./cloud-tools-runtime.js";

describe("cloud-tools-runtime", () => {
  it("pushes ToolSpecs snapshots to the cloud-tools plugin reload RPC", async () => {
    const request = vi.fn(async () => ({ ready: true, toolCount: 1 }));

    const result = await reloadCloudToolsFromSpecs({
      rpc: { request },
      toolSpecs: [{ name: "ecom_list_shops" }],
      revision: "rev-1",
      digest: "digest-1",
    });

    expect(result.ok).toBe(true);
    expect(request).toHaveBeenCalledWith(CLOUD_TOOLS_RELOAD_METHOD, {
      toolSpecs: [{ name: "ecom_list_shops" }],
      revision: "rev-1",
      digest: "digest-1",
    });
  });

  it("reports reload failures without throwing", async () => {
    const error = new Error("gateway unavailable");
    const request = vi.fn(async () => {
      throw error;
    });

    const result = await reloadCloudToolsFromSpecs({
      rpc: { request },
      toolSpecs: [{ name: "ecom_list_shops" }],
      digest: "digest-1",
    });

    expect(result).toEqual({ ok: false, error });
  });
});
