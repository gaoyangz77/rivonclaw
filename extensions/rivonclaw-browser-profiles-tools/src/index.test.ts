import { describe, it, expect } from "vitest";
import plugin from "./index.js";

describe("rivonclaw-browser-profiles-tools plugin", () => {
  it("exports a valid plugin definition", () => {
    expect(plugin.id).toBe("rivonclaw-browser-profiles-tools");
    expect(plugin.name).toBe("Browser Profiles Tools");
    expect(typeof plugin.activate).toBe("function");
  });

  it("registers cookie gateway methods and no tools (tools moved to client registry)", () => {
    const hooks: string[] = [];
    const tools: Array<{ factory: unknown; opts: unknown }> = [];
    const gatewayMethods: string[] = [];

    const mockApi = {
      logger: { info: () => {} },
      on(event: string) {
        hooks.push(event);
      },
      registerTool(factory: unknown, opts?: unknown) {
        tools.push({ factory, opts });
      },
      registerGatewayMethod(name: string) {
        gatewayMethods.push(name);
      },
    };

    plugin.activate(mockApi);

    // Only cookie and lifecycle hooks — no before_tool_call or before_prompt_build
    expect(hooks).not.toContain("before_tool_call");
    expect(hooks).not.toContain("before_prompt_build");
    expect(hooks).toContain("browser_session_start");
    expect(hooks).toContain("browser_session_end");
    expect(hooks).toContain("gateway_stop");

    // Cookie gateway methods only — no run context
    expect(gatewayMethods).toContain("browser_profiles_push_cookies");
    expect(gatewayMethods).toContain("browser_profiles_pull_cookies");
    expect(gatewayMethods).not.toContain("browser_profiles_set_run_context");

    // No tools registered here — tools are now in the client tool registry
    // and collected by rivonclaw-local-tools via getClientTools()
    expect(tools).toHaveLength(0);
  });
});
