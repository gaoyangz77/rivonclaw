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

  it("tells cs_respond not to guess a missing escalation ID", async () => {
    const authSession = {
      getAccessToken: vi.fn(() => "token"),
      graphqlFetch: vi.fn(async () => ({
        toolSpecs: [
          {
            id: "cs-respond",
            name: "cs_respond",
            description: "Respond to a CS escalation as the shop manager.",
          },
          { id: "other", name: "ecom_get_order", description: "Get an order." },
        ],
      })),
    };

    const snapshot = await syncDesktopToolSpecs({ authSession, source: "test" });
    const csRespond = snapshot.data.toolSpecs.find((spec) => spec.name === "cs_respond");
    const other = snapshot.data.toolSpecs.find((spec) => spec.name === "ecom_get_order");

    expect(csRespond?.description).toContain("Respond to a CS escalation as the shop manager.");
    expect(csRespond?.description).toContain(
      "If the escalation ID is missing or the quoted context is unavailable, ask the employee",
    );
    expect(csRespond?.description).toContain("Never guess, infer, try candidate IDs");
    expect(other?.description).toBe("Get an order.");
  });

  it("computes stable full and name digests", () => {
    const left = [{ name: "b", description: "B" }, { description: "A", name: "a" }];
    const right = [{ description: "B", name: "b" }, { name: "a", description: "A" }];

    expect(computeToolSpecsDigest(left)).toBe(computeToolSpecsDigest(right));
    expect(computeToolNameDigest(left)).toBe(computeToolNameDigest(right));
  });

  it("requests deeply nested parameter schemas used by structured Affiliate actions", () => {
    const childSelections = TOOL_SPECS_SYNC_QUERY.match(/children\s*\{/g) ?? [];
    const nullableSelections = TOOL_SPECS_SYNC_QUERY.match(/^\s+nullable\s*$/gm) ?? [];

    // input -> action -> messageIntent -> parts -> part fields requires four
    // child edges. Keep extra capacity for other typed tool inputs so a nested
    // object is never silently exposed to the model as an empty schema.
    expect(childSelections.length).toBeGreaterThanOrEqual(6);
    expect(nullableSelections).toHaveLength(childSelections.length + 1);
  });
});
