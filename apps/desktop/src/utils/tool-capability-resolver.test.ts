import { describe, it, expect, beforeEach } from "vitest";
import { ScopeType } from "@rivonclaw/core";
import type { CatalogTool } from "@rivonclaw/core";
import { parseScopeType } from "../api-routes/tool-registry-routes.js";
import { ToolCapabilityResolver } from "./tool-capability-resolver.js";

// ---------------------------------------------------------------------------
// parseScopeType — pure function: sessionKey → ScopeType
// ---------------------------------------------------------------------------

describe("parseScopeType", () => {
  it('returns CHAT_SESSION for "agent:main:main"', () => {
    expect(parseScopeType("agent:main:main")).toBe(ScopeType.CHAT_SESSION);
  });

  it('returns CHAT_SESSION for panel session "agent:main:panel-abc123"', () => {
    expect(parseScopeType("agent:main:panel-abc123")).toBe(ScopeType.CHAT_SESSION);
  });

  it("returns CHAT_SESSION for Telegram direct message", () => {
    expect(parseScopeType("agent:main:telegram:direct:user123")).toBe(ScopeType.CHAT_SESSION);
  });

  it("returns CHAT_SESSION for Telegram group", () => {
    expect(parseScopeType("agent:main:telegram:group:group123")).toBe(ScopeType.CHAT_SESSION);
  });

  it("returns CHAT_SESSION for mobile direct message", () => {
    expect(parseScopeType("agent:main:mobile:direct:device123")).toBe(ScopeType.CHAT_SESSION);
  });

  it("returns CRON_JOB for cron session key", () => {
    expect(parseScopeType("agent:main:cron:job1:run:uuid")).toBe(ScopeType.CRON_JOB);
  });

  it("returns CS_SESSION for customer service session", () => {
    expect(parseScopeType("cs:tiktok:conv123")).toBe(ScopeType.CS_SESSION);
  });

  it("returns UNKNOWN for unrecognized format", () => {
    expect(parseScopeType("random:unknown:key")).toBe(ScopeType.UNKNOWN);
  });

  it("returns UNKNOWN for empty string", () => {
    expect(parseScopeType("")).toBe(ScopeType.UNKNOWN);
  });
});

// ---------------------------------------------------------------------------
// ToolCapabilityResolver.getEffectiveToolsForScope
// ---------------------------------------------------------------------------

/**
 * Helper: create a fresh resolver initialized with deterministic mock data.
 *
 * System tools (core):  read, write, exec
 * Extension tool:       custom_ext_tool   (source=plugin, pluginId NOT in OUR_PLUGIN_IDS)
 * Entitled tools:       entitled_tool_1, entitled_tool_2
 *
 * We also include a tool from an OUR_PLUGIN_IDS plugin (tiktok-shop) to verify it
 * is filtered out as infrastructure during init().
 */
function createTestResolver(): ToolCapabilityResolver {
  const resolver = new ToolCapabilityResolver();

  const catalogTools: CatalogTool[] = [
    { id: "read", source: "core" },
    { id: "write", source: "core" },
    { id: "exec", source: "core" },
    // This plugin is in OUR_PLUGIN_IDS, so it should be excluded from customExtensionToolIds
    { id: "tiktok_send_message", source: "plugin", pluginId: "tiktok-shop" },
    // This plugin is NOT in OUR_PLUGIN_IDS, so it becomes a custom extension tool
    { id: "custom_ext_tool", source: "plugin", pluginId: "my-custom-plugin" },
  ];

  resolver.init(["entitled_tool_1", "entitled_tool_2"], catalogTools);
  return resolver;
}

describe("ToolCapabilityResolver.getEffectiveToolsForScope", () => {
  let resolver: ToolCapabilityResolver;

  beforeEach(() => {
    resolver = createTestResolver();
  });

  // ── Trusted scopes ──

  it("trusted scope + no RunProfile + no default → system tools only", () => {
    const result = resolver.getEffectiveToolsForScope(ScopeType.CHAT_SESSION, "agent:main:main");
    expect(result).toEqual(expect.arrayContaining(["read", "write", "exec"]));
    // Should not include entitled or extension tools without a RunProfile
    expect(result).not.toContain("entitled_tool_1");
    expect(result).not.toContain("entitled_tool_2");
    expect(result).not.toContain("custom_ext_tool");
  });

  it("trusted scope + no RunProfile + has default → system + default's tools", () => {
    resolver.setDefaultRunProfile({ selectedToolIds: ["entitled_tool_1"] });
    const result = resolver.getEffectiveToolsForScope(ScopeType.CHAT_SESSION, "agent:main:main");
    expect(result).toEqual(expect.arrayContaining(["read", "write", "exec", "entitled_tool_1"]));
    expect(result).not.toContain("entitled_tool_2");
  });

  it("trusted scope + has RunProfile → system + profile's tools", () => {
    resolver.setSessionRunProfile("agent:main:panel-abc", {
      selectedToolIds: ["custom_ext_tool"],
    });
    const result = resolver.getEffectiveToolsForScope(ScopeType.CHAT_SESSION, "agent:main:panel-abc");
    expect(result).toEqual(expect.arrayContaining(["read", "write", "exec", "custom_ext_tool"]));
    // tiktok_send_message is in OUR_PLUGIN_IDS → excluded from catalog → not selectable
    expect(result).not.toContain("tiktok_send_message");
  });

  it("trusted scope + RunProfile overrides default", () => {
    resolver.setDefaultRunProfile({ selectedToolIds: ["entitled_tool_1"] });
    resolver.setSessionRunProfile("agent:main:panel-abc", {
      selectedToolIds: ["entitled_tool_2"],
    });
    const result = resolver.getEffectiveToolsForScope(ScopeType.CHAT_SESSION, "agent:main:panel-abc");
    expect(result).toEqual(expect.arrayContaining(["read", "write", "exec", "entitled_tool_2"]));
    expect(result).not.toContain("entitled_tool_1");
  });

  // ── CS_SESSION (untrusted) ──

  it("CS_SESSION + has RunProfile → strictly profile tools, no system tools", () => {
    resolver.setSessionRunProfile("cs:tiktok:conv1", {
      selectedToolIds: ["entitled_tool_1"],
    });
    const result = resolver.getEffectiveToolsForScope(ScopeType.CS_SESSION, "cs:tiktok:conv1");
    expect(result).toEqual(["entitled_tool_1"]);
    expect(result).not.toContain("read");
    expect(result).not.toContain("write");
    expect(result).not.toContain("exec");
  });

  it("CS_SESSION + no RunProfile → empty (defense-in-depth)", () => {
    const result = resolver.getEffectiveToolsForScope(ScopeType.CS_SESSION, "cs:tiktok:conv2");
    expect(result).toEqual([]);
  });

  it("CS_SESSION ignores default RunProfile", () => {
    resolver.setDefaultRunProfile({ selectedToolIds: ["entitled_tool_1"] });
    const result = resolver.getEffectiveToolsForScope(ScopeType.CS_SESSION, "cs:tiktok:conv3");
    expect(result).toEqual([]);
  });

  // ── UNKNOWN scope ──

  it("UNKNOWN scope + no RunProfile → empty", () => {
    const result = resolver.getEffectiveToolsForScope(ScopeType.UNKNOWN, "random:key");
    expect(result).toEqual([]);
  });

  // ── CRON_JOB (trusted) ──

  it("CRON_JOB is trusted → same as CHAT_SESSION behavior", () => {
    resolver.setDefaultRunProfile({ selectedToolIds: ["entitled_tool_1"] });
    const result = resolver.getEffectiveToolsForScope(
      ScopeType.CRON_JOB,
      "agent:main:cron:job1:run:uuid",
    );
    expect(result).toEqual(expect.arrayContaining(["read", "write", "exec", "entitled_tool_1"]));
  });

  // ── Clear session RunProfile ──

  it("clear session RunProfile → falls back to default", () => {
    resolver.setDefaultRunProfile({ selectedToolIds: ["entitled_tool_1"] });
    resolver.setSessionRunProfile("agent:main:panel-abc", {
      selectedToolIds: ["entitled_tool_2"],
    });

    // With session profile: entitled_tool_2
    let result = resolver.getEffectiveToolsForScope(ScopeType.CHAT_SESSION, "agent:main:panel-abc");
    expect(result).toEqual(expect.arrayContaining(["entitled_tool_2"]));
    expect(result).not.toContain("entitled_tool_1");

    // Clear session profile
    resolver.setSessionRunProfile("agent:main:panel-abc", null);

    // Should fall back to default: entitled_tool_1
    result = resolver.getEffectiveToolsForScope(ScopeType.CHAT_SESSION, "agent:main:panel-abc");
    expect(result).toEqual(expect.arrayContaining(["read", "write", "exec", "entitled_tool_1"]));
    expect(result).not.toContain("entitled_tool_2");
  });

  it("clear session RunProfile with no default → system tools only for trusted scope", () => {
    resolver.setSessionRunProfile("agent:main:panel-abc", {
      selectedToolIds: ["entitled_tool_2"],
    });

    // Clear session profile, no default set
    resolver.setSessionRunProfile("agent:main:panel-abc", null);

    const result = resolver.getEffectiveToolsForScope(ScopeType.CHAT_SESSION, "agent:main:panel-abc");
    expect(result).toEqual(expect.arrayContaining(["read", "write", "exec"]));
    expect(result).not.toContain("entitled_tool_2");
  });
});

// ---------------------------------------------------------------------------
// ToolCapabilityResolver.init — catalog classification
// ---------------------------------------------------------------------------

describe("ToolCapabilityResolver.init", () => {
  it("classifies core tools as system tools", () => {
    const resolver = new ToolCapabilityResolver();
    resolver.init([], [
      { id: "read", source: "core" },
      { id: "write", source: "core" },
    ]);
    expect(resolver.getSystemToolIds()).toEqual(["read", "write"]);
  });

  it("excludes OUR_PLUGIN_IDS plugin tools from custom extensions", () => {
    const resolver = new ToolCapabilityResolver();
    resolver.init([], [
      { id: "read", source: "core" },
      { id: "infra_tool", source: "plugin", pluginId: "rivonclaw-capability-manager" },
    ]);
    // infra_tool is from an OUR_PLUGIN_IDS plugin, should not appear in available tools
    const all = resolver.getAllAvailableToolIds();
    expect(all).toContain("read");
    expect(all).not.toContain("infra_tool");
  });

  it("includes non-OUR_PLUGIN_IDS plugin tools as custom extensions", () => {
    const resolver = new ToolCapabilityResolver();
    resolver.init([], [
      { id: "read", source: "core" },
      { id: "my_tool", source: "plugin", pluginId: "my-custom-plugin" },
    ]);
    const all = resolver.getAllAvailableToolIds();
    expect(all).toContain("my_tool");
  });

  it("sets initialized flag", () => {
    const resolver = new ToolCapabilityResolver();
    expect(resolver.isInitialized()).toBe(false);
    resolver.init([], []);
    expect(resolver.isInitialized()).toBe(true);
  });
});
