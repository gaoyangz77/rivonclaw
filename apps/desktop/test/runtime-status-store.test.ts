import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSnapshot, onPatch, type IJsonPatch } from "mobx-state-tree";
import { RuntimeStatusStoreModel } from "@rivonclaw/core/models";

/**
 * Create a Desktop-equivalent runtime status store with actions.
 * Mirrors the production DesktopRuntimeStatusModel from runtime-status-store.ts.
 */
function createTestStore() {
  const Model = RuntimeStatusStoreModel.actions((self) => ({
    setCsBridgeConnected() {
      self.csBridge.state = "connected";
      self.csBridge.reconnectAttempt = 0;
    },
    setCsBridgeDisconnected() {
      self.csBridge.state = "disconnected";
    },
    setCsBridgeReconnecting(attempt: number) {
      self.csBridge.state = "reconnecting";
      self.csBridge.reconnectAttempt = attempt;
    },
  }));
  return Model.create({});
}

describe("RuntimeStatusStore", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
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
    expect(getSnapshot(store)).toEqual({
      csBridge: { state: "connected", reconnectAttempt: 0 },
    });

    store.setCsBridgeReconnecting(2);
    expect(getSnapshot(store)).toEqual({
      csBridge: { state: "reconnecting", reconnectAttempt: 2 },
    });
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
