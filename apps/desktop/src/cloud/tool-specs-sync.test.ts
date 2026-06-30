import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeToolNameDigest,
  computeToolSpecsDigest,
  getCachedToolSpecsSnapshot,
  invalidateToolSpecsCache,
  syncDesktopToolSpecs,
} from "./tool-specs-sync.js";
import { TOOL_SPECS_SYNC_QUERY } from "./init-queries.js";

describe("tool-specs-sync", () => {
  beforeEach(() => {
    invalidateToolSpecsCache();
    vi.clearAllMocks();
  });

  it("syncs ToolSpecs through Desktop, ingests into MST, and caches briefly", async () => {
    const authSession = {
      getAccessToken: vi.fn(() => "token"),
      graphqlFetch: vi.fn(async () => ({
        toolSpecs: [{ id: "tool-1", name: "ecom_list_shops" }],
      })),
    };
    const rootStore = {
      ingestGraphQLResponse: vi.fn(),
    };

    const first = await syncDesktopToolSpecs({ authSession, rootStore, source: "test" });
    const second = await syncDesktopToolSpecs({ authSession, rootStore, source: "test" });

    expect(authSession.graphqlFetch).toHaveBeenCalledTimes(1);
    expect(authSession.graphqlFetch).toHaveBeenCalledWith(TOOL_SPECS_SYNC_QUERY);
    expect(rootStore.ingestGraphQLResponse).toHaveBeenCalledTimes(2);
    expect(rootStore.ingestGraphQLResponse).toHaveBeenCalledWith({
      toolSpecs: [{ id: "tool-1", name: "ecom_list_shops" }],
    });
    expect(first.digest).toBe(second.digest);
    expect(getCachedToolSpecsSnapshot()?.digest).toBe(first.digest);
  });

  it("coalesces concurrent syncs into one backend request", async () => {
    let resolveFetch!: (value: { toolSpecs: Array<Record<string, unknown>> }) => void;
    const authSession = {
      getAccessToken: vi.fn(() => "token"),
      graphqlFetch: vi.fn(() => new Promise<{ toolSpecs: Array<Record<string, unknown>> }>((resolve) => {
        resolveFetch = resolve;
      })),
    };

    const first = syncDesktopToolSpecs({ authSession, source: "a" });
    const second = syncDesktopToolSpecs({ authSession, source: "b" });
    resolveFetch({ toolSpecs: [{ name: "tool_a" }] });

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(authSession.graphqlFetch).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed ToolSpecs without caching them", async () => {
    const authSession = {
      getAccessToken: vi.fn(() => "token"),
      graphqlFetch: vi.fn(async () => ({ toolSpecs: [{ id: "bad" }] })),
    };

    await expect(syncDesktopToolSpecs({ authSession, source: "bad" })).rejects.toThrow(/valid name/);
    expect(getCachedToolSpecsSnapshot()).toBeNull();
  });

  it("computes stable full and name digests", () => {
    const left = [{ name: "b", description: "B" }, { description: "A", name: "a" }];
    const right = [{ description: "B", name: "b" }, { name: "a", description: "A" }];

    expect(computeToolSpecsDigest(left)).toBe(computeToolSpecsDigest(right));
    expect(computeToolNameDigest(left)).toBe(computeToolNameDigest(right));
  });
});
