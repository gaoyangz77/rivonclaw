import { describe, it, expect, vi } from "vitest";
import { defineRivonClawPlugin } from "./define-plugin.js";
import type { PluginApi, ToolDefinition } from "./define-plugin.js";

function createMockApi(overrides?: Partial<PluginApi>): PluginApi & {
  registeredTools: Array<{ factory: () => unknown; opts?: { name?: string; names?: string[]; optional?: boolean } }>;
  hooks: string[];
} {
  const registeredTools: Array<{ factory: () => unknown; opts?: { name?: string; names?: string[]; optional?: boolean } }> = [];
  const hooks: string[] = [];
  return {
    id: "test-plugin",
    logger: { info: vi.fn(), warn: vi.fn() },
    on(event: string) {
      hooks.push(event);
    },
    registerTool(factory: () => unknown, opts?: { name?: string; names?: string[]; optional?: boolean }) {
      registeredTools.push({ factory, opts });
    },
    registeredTools,
    hooks,
    ...overrides,
  };
}

const sampleTools: ToolDefinition[] = [
  { name: "tool_a", description: "Tool A", parameters: { type: "object" } },
  { name: "tool_b", description: "Tool B", parameters: { type: "object" } },
];

describe("defineRivonClawPlugin", () => {
  it('default toolVisibility ("managed") registers tools with { optional: true }', () => {
    const plugin = defineRivonClawPlugin({
      id: "test-managed",
      name: "Test Managed",
      tools: sampleTools,
    });

    const api = createMockApi();
    plugin.activate(api);

    expect(api.registeredTools).toHaveLength(2);
    expect(api.registeredTools.map((entry) => entry.opts)).toEqual([
      { optional: true, name: "tool_a" },
      { optional: true, name: "tool_b" },
    ]);
  });

  it('toolVisibility "always" registers tools without optional flag', () => {
    const plugin = defineRivonClawPlugin({
      id: "test-always",
      name: "Test Always",
      tools: sampleTools,
      toolVisibility: "always",
    });

    const api = createMockApi();
    plugin.activate(api);

    expect(api.registeredTools).toHaveLength(2);
    expect(api.registeredTools.map((entry) => entry.opts)).toEqual([
      { name: "tool_a" },
      { name: "tool_b" },
    ]);
  });

  it("no tools provided → no tools registered", () => {
    const plugin = defineRivonClawPlugin({
      id: "test-no-tools",
      name: "Test No Tools",
    });

    const api = createMockApi();
    plugin.activate(api);

    expect(api.registeredTools).toHaveLength(0);
  });

  it("setup is called with the api object", () => {
    const setup = vi.fn();
    const plugin = defineRivonClawPlugin({
      id: "test-setup",
      name: "Test Setup",
      setup,
    });

    const api = createMockApi();
    plugin.activate(api);

    expect(setup).toHaveBeenCalledOnce();
    expect(setup).toHaveBeenCalledWith(api);
  });

  it("activate logs with the plugin name", () => {
    const plugin = defineRivonClawPlugin({
      id: "test-log",
      name: "My Plugin",
    });

    const api = createMockApi();
    plugin.activate(api);

    expect(api.logger.info).toHaveBeenCalledWith("My Plugin plugin activated");
  });

  it("returns correct id and name", () => {
    const plugin = defineRivonClawPlugin({
      id: "my-id",
      name: "My Name",
    });

    expect(plugin.id).toBe("my-id");
    expect(plugin.name).toBe("My Name");
    expect(typeof plugin.activate).toBe("function");
  });

  it("tool factories return the original tool definitions", () => {
    const plugin = defineRivonClawPlugin({
      id: "test-factories",
      name: "Test Factories",
      tools: sampleTools,
      toolVisibility: "always",
    });

    const api = createMockApi();
    plugin.activate(api);

    for (let i = 0; i < api.registeredTools.length; i++) {
      const result = api.registeredTools[i].factory();
      expect(result).toBe(sampleTools[i]);
    }
  });

  it("gracefully handles missing registerTool on api", () => {
    const plugin = defineRivonClawPlugin({
      id: "test-no-register",
      name: "Test No Register",
      tools: sampleTools,
    });

    const api = createMockApi();
    delete (api as any).registerTool;

    expect(() => plugin.activate(api)).not.toThrow();
  });
});
