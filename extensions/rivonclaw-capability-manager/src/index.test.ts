import { describe, it, expect, beforeEach, vi } from "vitest";
import manifest from "../openclaw.plugin.json";
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
    registerSessionExtension: vi.fn(),
    registerTrustedToolPolicy: vi.fn(),
  };

  plugin.activate(api as any);
  return { api, handlers };
}

beforeEach(() => {
  mockFetch.mockReset();
});

// ── Tests ───────────────────────────────────────────────────────────

describe("trusted tool policy", () => {
  it("declares and registers the affiliate checkpoint policy contract", () => {
    const { api } = activatePlugin();

    expect(manifest.contracts.trustedToolPolicies).toContain(
      "affiliate-checkpoint-injection",
    );
    expect(api.registerTrustedToolPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "affiliate-checkpoint-injection",
        description: expect.any(String),
        evaluate: expect.any(Function),
      }),
    );
  });
  it("does not mutate or override channel session model selection", () => {
    const { handlers } = activatePlugin();

    expect(handlers).not.toHaveProperty("before_dispatch");
    expect(handlers).not.toHaveProperty("before_model_resolve");
  });
});

describe("before_tool_call enforcement", () => {
  it("blocks tool call when HTTP fetch fails (fail-closed)", async () => {
    const { handlers } = activatePlugin();
    const hook = handlers["before_tool_call"];

    mockFetchFailure();

    const result = await hook(
      { toolName: "ecom_get_conversations", params: {} },
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

    mockEffectiveToolsResponse(["ECOM_GET_CONVERSATIONS"]);

    const result = await hook(
      { toolName: "ecom_get_conversations", params: {} },
      { sessionKey: "session-1" },
    );

    expect(result).toBeUndefined();
  });

  it("blocks tool call when tool is NOT in effectiveTools", async () => {
    const { handlers } = activatePlugin();
    const hook = handlers["before_tool_call"];

    mockEffectiveToolsResponse(["SOME_OTHER_TOOL"]);

    const result = await hook(
      { toolName: "ecom_get_conversations", params: {} },
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
      { toolName: "ecom_get_conversations", params: {} },
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

    mockEffectiveToolsResponse(["ECOM_GET_CONVERSATIONS"]);
    mockEffectiveToolsResponse(["ECOM_GET_CONVERSATIONS"]);

    // First call
    await hook(
      { toolName: "ecom_get_conversations", params: {} },
      { sessionKey: "session-1" },
    );

    // Second call — should also fetch (no cache)
    await hook(
      { toolName: "ecom_get_conversations", params: {} },
      { sessionKey: "session-1" },
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
