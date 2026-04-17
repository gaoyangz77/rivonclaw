import { describe, it, expect, beforeEach } from "vitest";
import { getSnapshot, onPatch, type IJsonPatch } from "mobx-state-tree";
import { createRuntimeStatusStore } from "../src/app/store/runtime-status-store.js";

type Store = ReturnType<typeof createRuntimeStatusStore>;

describe("RuntimeStatusStore — CsBridge", () => {
  let store: Store;

  beforeEach(() => {
    store = createRuntimeStatusStore();
  });

  it("should initialize with disconnected state", () => {
    expect(store.csBridge.state).toBe("disconnected");
    expect(store.csBridge.reconnectAttempt).toBe(0);
  });

  it("should transition to connected and reset reconnectAttempt", () => {
    store.setCsBridgeReconnecting(3);
    expect(store.csBridge.state).toBe("reconnecting");
    expect(store.csBridge.reconnectAttempt).toBe(3);

    store.setCsBridgeConnected();
    expect(store.csBridge.state).toBe("connected");
    expect(store.csBridge.reconnectAttempt).toBe(0);
  });

  it("should transition to disconnected", () => {
    store.setCsBridgeConnected();
    store.setCsBridgeDisconnected();
    expect(store.csBridge.state).toBe("disconnected");
  });

  it("should transition to reconnecting with attempt count", () => {
    store.setCsBridgeReconnecting(1);
    expect(store.csBridge.state).toBe("reconnecting");
    expect(store.csBridge.reconnectAttempt).toBe(1);

    store.setCsBridgeReconnecting(5);
    expect(store.csBridge.reconnectAttempt).toBe(5);
  });

  it("should produce correct snapshots", () => {
    store.setCsBridgeConnected();
    const snap1 = getSnapshot(store);
    expect(snap1.csBridge).toEqual({ state: "connected", reconnectAttempt: 0 });
    expect(snap1.appSettings).toBeDefined();

    store.setCsBridgeReconnecting(2);
    const snap2 = getSnapshot(store);
    expect(snap2.csBridge).toEqual({ state: "reconnecting", reconnectAttempt: 2 });
  });

  it("should emit MST patches on state changes", () => {
    const patches: IJsonPatch[] = [];
    onPatch(store, (patch) => patches.push(patch));

    store.setCsBridgeConnected();
    expect(patches).toContainEqual(
      expect.objectContaining({ op: "replace", path: "/csBridge/state", value: "connected" }),
    );

    patches.length = 0;
    store.setCsBridgeReconnecting(3);
    expect(patches).toContainEqual(
      expect.objectContaining({ op: "replace", path: "/csBridge/state", value: "reconnecting" }),
    );
    expect(patches).toContainEqual(
      expect.objectContaining({ op: "replace", path: "/csBridge/reconnectAttempt", value: 3 }),
    );
  });

  it("should handle full lifecycle: disconnected → reconnecting → connected → disconnected", () => {
    expect(store.csBridge.state).toBe("disconnected");

    store.setCsBridgeReconnecting(1);
    expect(store.csBridge.state).toBe("reconnecting");

    store.setCsBridgeReconnecting(2);
    expect(store.csBridge.state).toBe("reconnecting");
    expect(store.csBridge.reconnectAttempt).toBe(2);

    store.setCsBridgeConnected();
    expect(store.csBridge.state).toBe("connected");
    expect(store.csBridge.reconnectAttempt).toBe(0);

    store.setCsBridgeDisconnected();
    expect(store.csBridge.state).toBe("disconnected");
  });
});

// ---------------------------------------------------------------------------
// AppSettings default-value tests — each test gets a fresh store
// ---------------------------------------------------------------------------

describe("AppSettings defaults — loadAppSettings({})", () => {
  let store: Store;

  beforeEach(() => {
    store = createRuntimeStatusStore();
  });

  it("absent-value semantics match old REST getters and main.ts", () => {
    store.loadAppSettings({});

    const s = store.appSettings;

    // isNotFalse → absent = true (opt-out settings)
    expect(s.telemetryEnabled).toBe(true);
    expect(s.sessionStateCdpEnabled).toBe(true);
    expect(s.chatShowAgentEvents).toBe(true);
    expect(s.chatCollapseMessages).toBe(true);
    expect(s.filePermissionsFullAccess).toBe(true);

    // isTrue → absent = false (opt-in settings)
    expect(s.chatPreserveToolEvents).toBe(false);
    expect(s.privacyMode).toBe(false);
    expect(s.autoLaunchEnabled).toBe(false);
    expect(s.sttEnabled).toBe(false);
    expect(s.webSearchEnabled).toBe(false);
    expect(s.embeddingEnabled).toBe(false);
  });

  it("explicit 'false' disables isNotFalse settings", () => {
    store.loadAppSettings({
      telemetry_enabled: "false",
      "session-state-cdp-enabled": "false",
      chat_show_agent_events: "false",
    });

    expect(store.appSettings.telemetryEnabled).toBe(false);
    expect(store.appSettings.sessionStateCdpEnabled).toBe(false);
    expect(store.appSettings.chatShowAgentEvents).toBe(false);
  });

  it("explicit 'true' enables isTrue settings", () => {
    store.loadAppSettings({
      chat_preserve_tool_events: "true",
      privacy_mode: "true",
      auto_launch_enabled: "true",
    });

    expect(store.appSettings.chatPreserveToolEvents).toBe(true);
    expect(store.appSettings.privacyMode).toBe(true);
    expect(store.appSettings.autoLaunchEnabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Panel UI preference appliers (migrated from localStorage)
// ---------------------------------------------------------------------------

describe("AppSettings — Panel UI preferences", () => {
  let store: Store;

  beforeEach(() => {
    store = createRuntimeStatusStore();
  });

  it("defaults match Panel absent-value semantics", () => {
    store.loadAppSettings({});
    const s = store.appSettings;
    // Opt-in (absent = false)
    expect(s.telemetryConsentShown).toBe(false);
    expect(s.chatExamplesCollapsed).toBe(false);
    expect(s.sidebarCollapsed).toBe(false);
    // Opt-out (absent = true)
    expect(s.showAgentName).toBe(true);
    expect(s.tutorialEnabled).toBe(true);
    // String defaults
    expect(s.whatsNewLastSeenVersion).toBe("");
    expect(s.panelTheme).toBe("system");
    expect(s.panelAccent).toBe("blue");
    expect(s.chatTabOrder).toBe("");
  });

  it("telemetry_consent_shown is true only when value is \"1\"", () => {
    store.loadAppSettings({ telemetry_consent_shown: "1" });
    expect(store.appSettings.telemetryConsentShown).toBe(true);

    store.updateAppSetting("telemetry_consent_shown", "0");
    expect(store.appSettings.telemetryConsentShown).toBe(false);

    store.updateAppSetting("telemetry_consent_shown", "true"); // anything ≠ "1"
    expect(store.appSettings.telemetryConsentShown).toBe(false);
  });

  it("panel_theme coerces invalid values to \"system\"", () => {
    store.loadAppSettings({ panel_theme: "light" });
    expect(store.appSettings.panelTheme).toBe("light");

    store.updateAppSetting("panel_theme", "dark");
    expect(store.appSettings.panelTheme).toBe("dark");

    store.updateAppSetting("panel_theme", "garbage");
    expect(store.appSettings.panelTheme).toBe("system");
  });

  it("panel_accent falls back to \"blue\" for empty strings", () => {
    store.loadAppSettings({ panel_accent: "purple" });
    expect(store.appSettings.panelAccent).toBe("purple");

    store.updateAppSetting("panel_accent", "");
    expect(store.appSettings.panelAccent).toBe("blue");
  });

  it("show_agent_name and tutorial_enabled are isNotFalse (opt-out)", () => {
    store.loadAppSettings({ show_agent_name: "false", tutorial_enabled: "false" });
    expect(store.appSettings.showAgentName).toBe(false);
    expect(store.appSettings.tutorialEnabled).toBe(false);

    store.updateAppSetting("show_agent_name", "true");
    store.updateAppSetting("tutorial_enabled", "true");
    expect(store.appSettings.showAgentName).toBe(true);
    expect(store.appSettings.tutorialEnabled).toBe(true);
  });

  it("chat_examples_collapsed uses \"1\" encoding", () => {
    store.loadAppSettings({ chat_examples_collapsed: "1" });
    expect(store.appSettings.chatExamplesCollapsed).toBe(true);

    store.updateAppSetting("chat_examples_collapsed", "0");
    expect(store.appSettings.chatExamplesCollapsed).toBe(false);
  });

  it("chat_tab_order preserves the raw JSON string", () => {
    const orderJson = JSON.stringify(["agent:main:one", "agent:main:two"]);
    store.loadAppSettings({ chat_tab_order: orderJson });
    expect(store.appSettings.chatTabOrder).toBe(orderJson);

    store.updateAppSetting("chat_tab_order", "");
    expect(store.appSettings.chatTabOrder).toBe("");
  });

  it("sidebar_collapsed is isTrue (opt-in)", () => {
    store.loadAppSettings({ sidebar_collapsed: "true" });
    expect(store.appSettings.sidebarCollapsed).toBe(true);

    store.updateAppSetting("sidebar_collapsed", "false");
    expect(store.appSettings.sidebarCollapsed).toBe(false);
  });
});
