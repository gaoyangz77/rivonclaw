import { describe, it, expect, vi } from "vitest";
import type {
  AgentStartContext,
  OpenClawPluginAPI,
} from "@rivonclaw/policy";
import plugin from "./index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGuardContent(
  condition: string,
  action: string,
  reason: string,
): string {
  return JSON.stringify({ type: "guard", condition, action, reason });
}

/** Build a mock API with pluginConfig and capture the registered hook handler. */
function activateWithConfig(config?: Record<string, unknown>) {
  let agentStartHandler:
    | ((ctx: AgentStartContext) => { prependContext: string })
    | undefined;

  const mockAPI = {
    id: "test",
    logger: { info: vi.fn(), warn: vi.fn() },
    pluginConfig: config,
    on: vi.fn(),
    registerHook: vi.fn(
      (hookName: string, handler: (...args: unknown[]) => unknown) => {
        if (hookName === "before_agent_start") {
          agentStartHandler = handler as typeof agentStartHandler;
        }
      },
    ) as unknown as OpenClawPluginAPI["registerHook"],
  };

  plugin.activate(mockAPI);

  return { mockAPI, agentStartHandler: agentStartHandler! };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("rivonclaw-policy plugin", () => {
  it("has correct id and name", () => {
    expect(plugin.id).toBe("rivonclaw-policy");
    expect(plugin.name).toBe("RivonClaw Policy");
  });

  it("exposes both activate() and register() methods", () => {
    expect(typeof plugin.activate).toBe("function");
    expect(typeof plugin.register).toBe("function");
  });

  it("registers only before_agent_start hook", () => {
    const { mockAPI } = activateWithConfig();
    const calls = (mockAPI.registerHook as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe("before_agent_start");
  });

  it("injects policy fragment into prependContext", () => {
    const { agentStartHandler } = activateWithConfig({
      compiledPolicy: "Never modify system files.",
    });

    const result = agentStartHandler({ prependContext: "" });
    expect(result.prependContext).toContain("--- RivonClaw Policy ---");
    expect(result.prependContext).toContain("Never modify system files.");
    expect(result.prependContext).toContain("--- End Policy ---");
  });

  it("injects guard directives into prependContext", () => {
    const { agentStartHandler } = activateWithConfig({
      guards: [
        { id: "g1", ruleId: "r1", content: makeGuardContent("path:/etc/*", "block", "System directory protected") },
      ],
    });

    const result = agentStartHandler({ prependContext: "" });
    expect(result.prependContext).toContain("--- RivonClaw Guards (MUST enforce) ---");
    expect(result.prependContext).toContain("System directory protected");
  });

  it("full integration: policy + guard prompt injection", () => {
    const { agentStartHandler } = activateWithConfig({
      compiledPolicy: "Never modify system files.",
      guards: [
        { id: "g1", ruleId: "r2", content: makeGuardContent("path:/etc/*", "block", "System directory protected") },
      ],
    });

    const result = agentStartHandler({ prependContext: "" });

    expect(result.prependContext).toContain("--- RivonClaw Policy ---");
    expect(result.prependContext).toContain("Never modify system files.");
    expect(result.prependContext).toContain("--- RivonClaw Guards (MUST enforce) ---");
    expect(result.prependContext).toContain("System directory protected");

    // Policy comes before guards
    const policyIdx = result.prependContext.indexOf("--- RivonClaw Policy ---");
    const guardsIdx = result.prependContext.indexOf("--- RivonClaw Guards");
    expect(policyIdx).toBeLessThan(guardsIdx);
  });

  it("passes through when no config provided", () => {
    const { agentStartHandler } = activateWithConfig();

    const result = agentStartHandler({ prependContext: "existing context" });
    expect(result.prependContext).toBe("existing context");
  });

  it("passes through when config has empty policy and no guards", () => {
    const { agentStartHandler } = activateWithConfig({
      compiledPolicy: "",
      guards: [],
    });

    const result = agentStartHandler({ prependContext: "existing context" });
    expect(result.prependContext).toBe("existing context");
  });
});
