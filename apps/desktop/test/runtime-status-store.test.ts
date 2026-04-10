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
