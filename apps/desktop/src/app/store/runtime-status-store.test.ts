import { describe, expect, it } from "vitest";
import { createRuntimeStatusStore, getSnapshot } from "./runtime-status-store.js";

describe("Desktop runtime status store", () => {
  it("tracks cloud tools readiness and clears stale errors after recovery", () => {
    const store = createRuntimeStatusStore();

    expect(store.cloudTools.state).toBe("checking");

    store.setCloudToolsStatus("unavailable", "catalog mismatch");
    expect(getSnapshot(store.cloudTools)).toEqual({
      state: "unavailable",
      lastError: "catalog mismatch",
    });

    store.setCloudToolsStatus("ready");
    expect(getSnapshot(store.cloudTools)).toEqual({ state: "ready", lastError: "" });
  });
});
