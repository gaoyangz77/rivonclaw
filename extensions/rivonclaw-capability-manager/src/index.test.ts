import { describe, it, expect, beforeEach, vi } from "vitest";
import plugin from "./index.js";

// ── Helpers ─────────────────────────────────────────────────────────

type Handler = (...args: any[]) => any;

/** Mock fetch to simulate Desktop HTTP responses */
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockEffectiveToolsResponse(tools: string[]) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ effectiveToolIds: tools }),
  });
}

function mockFetchFailure() {
  mockFetch.mockRejectedValueOnce(new Error("Network error"));
}

function activatePlugin() {
  const handlers: Record<string, Handler> = {};

  const api = {
    id: "capability-manager",
    logger: { info: vi.fn(), warn: vi.fn() },
    on: vi.fn((event: string, handler: Handler) => {
      handlers[event] = handler;
    }),
    registerGatewayMethod: vi.fn(),
  };

  plugin.activate(api as any);
  return { api, handlers };
}

beforeEach(() => {
  mockFetch.mockReset();
});

// ── Tests ───────────────────────────────────────────────────────────

describe("before_tool_call enforcement", () => {
  it("blocks tool call when HTTP fetch fails (fail-closed)", async () => {
    const { handlers } = activatePlugin();
    const hook = handlers["before_tool_call"];

    mockFetchFailure();

    const result = await hook(
      { toolName: "browser_profiles_list", params: {} },
      { sessionKey: "session-1" },
    );

    expect(result).toEqual({
      block: true,
      blockReason: expect.stringContaining("Could not resolve capability context"),
    });
  });

  it("allows tool call when tool is in effectiveTools", async () => {
    const { handlers } = activatePlugin();
    const hook = handlers["before_tool_call"];

    mockEffectiveToolsResponse(["BROWSER_PROFILES_LIST"]);

    const result = await hook(
      { toolName: "browser_profiles_list", params: {} },
      { sessionKey: "session-1" },
    );

    expect(result).toBeUndefined();
  });

  it("blocks tool call when tool is NOT in effectiveTools", async () => {
    const { handlers } = activatePlugin();
    const hook = handlers["before_tool_call"];

    mockEffectiveToolsResponse(["SOME_OTHER_TOOL"]);

    const result = await hook(
      { toolName: "browser_profiles_list", params: {} },
      { sessionKey: "session-1" },
    );

    expect(result).toEqual({
      block: true,
      blockReason: expect.stringContaining("not permitted in this run"),
    });
  });

  it("allows tool call when no sessionKey is present (cannot enforce)", async () => {
    const { handlers } = activatePlugin();
    const hook = handlers["before_tool_call"];

    const result = await hook(
      { toolName: "browser_profiles_list", params: {} },
      {},
    );

    expect(result).toBeUndefined();
  });
});

describe("before_tool_resolve", () => {
  it("filters tools to only those in effectiveTools", async () => {
    const { handlers } = activatePlugin();
    const hook = handlers["before_tool_resolve"];

    mockEffectiveToolsResponse(["TOOL_A", "TOOL_B"]);

    const result = await hook(
      { tools: ["tool_a", "tool_b", "tool_c"] },
      { sessionKey: "session-1" },
    );

    expect(result).toEqual({ tools: ["tool_a", "tool_b"] });
  });

  it("returns empty tools when HTTP fails (fail-closed)", async () => {
    const { handlers } = activatePlugin();
    const hook = handlers["before_tool_resolve"];

    mockFetchFailure();

    const result = await hook(
      { tools: ["tool_a"] },
      { sessionKey: "session-1" },
    );

    expect(result).toEqual({ tools: [] });
  });

  it("returns empty object when no sessionKey", async () => {
    const { handlers } = activatePlugin();
    const hook = handlers["before_tool_resolve"];

    const result = await hook({ tools: ["tool_a"] }, {});

    expect(result).toEqual({});
  });
});

describe("no caching — always fetches fresh", () => {
  it("makes a new HTTP call for every tool check (supports mid-session RunProfile changes)", async () => {
    const { handlers } = activatePlugin();
    const hook = handlers["before_tool_call"];

    mockEffectiveToolsResponse(["BROWSER_PROFILES_LIST"]);
    mockEffectiveToolsResponse(["BROWSER_PROFILES_LIST"]);

    // First call
    await hook(
      { toolName: "browser_profiles_list", params: {} },
      { sessionKey: "session-1" },
    );

    // Second call — should also fetch (no cache)
    await hook(
      { toolName: "browser_profiles_list", params: {} },
      { sessionKey: "session-1" },
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
