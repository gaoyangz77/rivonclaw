import { describe, it, expect, beforeEach } from "vitest";
import { applySnapshot } from "mobx-state-tree";
import { ScopeType } from "@rivonclaw/core";
import type { CatalogTool } from "@rivonclaw/core";
import { parseScopeType } from "../api-routes/tool-registry-routes.js";
import { rootStore } from "../store/desktop-store.js";
import { OUR_PLUGIN_IDS } from "../generated/our-plugin-ids.js";

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

  it("returns CS_SESSION for CS session (gateway-prefixed key)", () => {
    expect(parseScopeType("agent:main:cs:tiktok:conv123")).toBe(ScopeType.CS_SESSION);
  });

  it("returns UNKNOWN for unrecognized format", () => {
    expect(parseScopeType("random:unknown:key")).toBe(ScopeType.UNKNOWN);
  });

  it("returns UNKNOWN for empty string", () => {
    expect(parseScopeType("")).toBe(ScopeType.UNKNOWN);
  });
});

// ---------------------------------------------------------------------------
// ToolCapabilityModel.getEffectiveToolsForScope
// ---------------------------------------------------------------------------

/**
 * Helper: seed MST store and initialize toolCapability with deterministic mock data.
 *
 * System tools (core):  read, write, exec
 * Extension tool:       custom_ext_tool   (source=plugin, pluginId NOT in OUR_PLUGIN_IDS)
 * Entitled tools:       entitled_tool_1, entitled_tool_2  (from MST store)
 */
function seedTestStore(): void {
  // Seed MST store with mock entitled tools
  rootStore.ingestGraphQLResponse({
    toolSpecs: [
      { id: "entitled_tool_1", name: "entitled_tool_1", displayName: "entitled_tool_1", description: "", category: "", operationType: "query", parameters: [] },
      { id: "entitled_tool_2", name: "entitled_tool_2", displayName: "entitled_tool_2", description: "", category: "", operationType: "query", parameters: [] },
    ],
  });

  const catalogTools: CatalogTool[] = [
    { id: "read", source: "core" },
    { id: "write", source: "core" },
    { id: "exec", source: "core" },
    // This plugin is in OUR_PLUGIN_IDS, so it should be excluded from customExtensionToolIds
    { id: "ecom_send_message", source: "plugin", pluginId: "rivonclaw-cloud-tools" },
    // This plugin is NOT in OUR_PLUGIN_IDS, so it becomes a custom extension tool
    { id: "custom_ext_tool", source: "plugin", pluginId: "my-custom-plugin" },
  ];

  rootStore.toolCapability.init(catalogTools, OUR_PLUGIN_IDS);
}

describe("ToolCapabilityModel.getEffectiveToolsForScope", () => {
  beforeEach(() => {
    rootStore.ingestGraphQLResponse({ toolSpecs: [], runProfiles: [], surfaces: [], shops: [] });
    seedTestStore();
    // Clear any session/default profiles
    rootStore.toolCapability.setDefaultRunProfile(null);
  });

  // ── Trusted scopes ──

  it("trusted scope + no RunProfile + no default → system tools only", () => {
    const result = rootStore.toolCapability.getEffectiveToolsForScope(ScopeType.CHAT_SESSION, "agent:main:main");
    expect(result).toEqual(expect.arrayContaining(["read", "write", "exec"]));
    // Should not include entitled or extension tools without a RunProfile
    expect(result).not.toContain("entitled_tool_1");
    expect(result).not.toContain("entitled_tool_2");
    expect(result).not.toContain("custom_ext_tool");
  });

  it("trusted scope + no RunProfile + has default → system + default's tools", () => {
    rootStore.toolCapability.setDefaultRunProfile({ selectedToolIds: ["entitled_tool_1"] });
    const result = rootStore.toolCapability.getEffectiveToolsForScope(ScopeType.CHAT_SESSION, "agent:main:main");
    expect(result).toEqual(expect.arrayContaining(["read", "write", "exec", "entitled_tool_1"]));
    expect(result).not.toContain("entitled_tool_2");
  });

  it("trusted scope + has RunProfile → system + profile's tools", () => {
    rootStore.toolCapability.setSessionRunProfile("agent:main:panel-abc", {
      selectedToolIds: ["custom_ext_tool"],
    });
    const result = rootStore.toolCapability.getEffectiveToolsForScope(ScopeType.CHAT_SESSION, "agent:main:panel-abc");
    expect(result).toEqual(expect.arrayContaining(["read", "write", "exec", "custom_ext_tool"]));
  });

  it("trusted scope + RunProfile overrides default", () => {
    rootStore.toolCapability.setDefaultRunProfile({ selectedToolIds: ["entitled_tool_1"] });
    rootStore.toolCapability.setSessionRunProfile("agent:main:panel-abc", {
      selectedToolIds: ["entitled_tool_2"],
    });
    const result = rootStore.toolCapability.getEffectiveToolsForScope(ScopeType.CHAT_SESSION, "agent:main:panel-abc");
    expect(result).toEqual(expect.arrayContaining(["read", "write", "exec", "entitled_tool_2"]));
    expect(result).not.toContain("entitled_tool_1");
  });

  // ── CS_SESSION (untrusted) ──

  it("CS_SESSION + has RunProfile → strictly profile tools, no system tools", () => {
    rootStore.toolCapability.setSessionRunProfile("cs:tiktok:conv1", {
      selectedToolIds: ["entitled_tool_1"],
    });
    const result = rootStore.toolCapability.getEffectiveToolsForScope(ScopeType.CS_SESSION, "cs:tiktok:conv1");
    expect(result).toEqual(["entitled_tool_1"]);
    expect(result).not.toContain("read");
    expect(result).not.toContain("write");
    expect(result).not.toContain("exec");
  });

  it("CS_SESSION + no RunProfile → empty (defense-in-depth)", () => {
    const result = rootStore.toolCapability.getEffectiveToolsForScope(ScopeType.CS_SESSION, "cs:tiktok:conv2");
    expect(result).toEqual([]);
  });

  it("CS_SESSION ignores default RunProfile", () => {
    rootStore.toolCapability.setDefaultRunProfile({ selectedToolIds: ["entitled_tool_1"] });
    const result = rootStore.toolCapability.getEffectiveToolsForScope(ScopeType.CS_SESSION, "cs:tiktok:conv3");
    expect(result).toEqual([]);
  });

  // ── UNKNOWN scope ──

  it("UNKNOWN scope + no RunProfile → empty", () => {
    const result = rootStore.toolCapability.getEffectiveToolsForScope(ScopeType.UNKNOWN, "random:key");
    expect(result).toEqual([]);
  });

  // ── CRON_JOB (trusted) ──

  it("CRON_JOB is trusted → same as CHAT_SESSION behavior", () => {
    rootStore.toolCapability.setDefaultRunProfile({ selectedToolIds: ["entitled_tool_1"] });
    const result = rootStore.toolCapability.getEffectiveToolsForScope(
      ScopeType.CRON_JOB,
      "agent:main:cron:job1:run:uuid",
    );
    expect(result).toEqual(expect.arrayContaining(["read", "write", "exec", "entitled_tool_1"]));
  });

  // ── Clear session RunProfile ──

  it("clear session RunProfile → falls back to default", () => {
    rootStore.toolCapability.setDefaultRunProfile({ selectedToolIds: ["entitled_tool_1"] });
    rootStore.toolCapability.setSessionRunProfile("agent:main:panel-abc", {
      selectedToolIds: ["entitled_tool_2"],
    });

    // With session profile: entitled_tool_2
    let result = rootStore.toolCapability.getEffectiveToolsForScope(ScopeType.CHAT_SESSION, "agent:main:panel-abc");
    expect(result).toEqual(expect.arrayContaining(["entitled_tool_2"]));
    expect(result).not.toContain("entitled_tool_1");

    // Clear session profile
    rootStore.toolCapability.setSessionRunProfile("agent:main:panel-abc", null);

    // Should fall back to default: entitled_tool_1
    result = rootStore.toolCapability.getEffectiveToolsForScope(ScopeType.CHAT_SESSION, "agent:main:panel-abc");
    expect(result).toEqual(expect.arrayContaining(["read", "write", "exec", "entitled_tool_1"]));
    expect(result).not.toContain("entitled_tool_2");
  });

  it("clear session RunProfile with no default → system tools only for trusted scope", () => {
    rootStore.toolCapability.setSessionRunProfile("agent:main:panel-abc", {
      selectedToolIds: ["entitled_tool_2"],
    });

    // Clear session profile, no default set
    rootStore.toolCapability.setSessionRunProfile("agent:main:panel-abc", null);

    const result = rootStore.toolCapability.getEffectiveToolsForScope(ScopeType.CHAT_SESSION, "agent:main:panel-abc");
    expect(result).toEqual(expect.arrayContaining(["read", "write", "exec"]));
    expect(result).not.toContain("entitled_tool_2");
  });
});

// ---------------------------------------------------------------------------
// ToolCapabilityModel.init — catalog classification
// ---------------------------------------------------------------------------

describe("ToolCapabilityModel.init", () => {
  beforeEach(() => {
    rootStore.ingestGraphQLResponse({ toolSpecs: [], runProfiles: [], surfaces: [], shops: [] });
    // Reset toolCapability to a clean state (no pre-seeded catalog, not initialized)
    applySnapshot(rootStore.toolCapability, {});
  });

  it("classifies core tools as system tools", () => {
    rootStore.toolCapability.init([
      { id: "read", source: "core" },
      { id: "write", source: "core" },
    ], OUR_PLUGIN_IDS);
    expect(rootStore.toolCapability.systemToolIds).toEqual(["read", "write"]);
  });

  it("excludes OUR_PLUGIN_IDS plugin tools from custom extensions", () => {
    rootStore.toolCapability.init([
      { id: "read", source: "core" },
      { id: "infra_tool", source: "plugin", pluginId: "rivonclaw-capability-manager" },
    ], OUR_PLUGIN_IDS);
    const all = rootStore.toolCapability.allAvailableToolIds;
    expect(all).toContain("read");
    expect(all).not.toContain("infra_tool");
  });

  it("includes non-OUR_PLUGIN_IDS plugin tools as custom extensions", () => {
    rootStore.toolCapability.init([
      { id: "read", source: "core" },
      { id: "my_tool", source: "plugin", pluginId: "my-custom-plugin" },
    ], OUR_PLUGIN_IDS);
    const all = rootStore.toolCapability.allAvailableToolIds;
    expect(all).toContain("my_tool");
  });

  it("sets initialized flag", () => {
    expect(rootStore.toolCapability.initialized).toBe(false);
    rootStore.toolCapability.init([], OUR_PLUGIN_IDS);
    expect(rootStore.toolCapability.initialized).toBe(true);
  });
});
