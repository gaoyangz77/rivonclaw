import { afterEach, describe, expect, it, vi } from "vitest";
import { getHost, installHost, type HostAdapter } from "../host/index.js";
import { connectEntityStore, disconnectEntityStore, entityStore } from "./entity-store.js";
import {
  connectRuntimeStatusStore,
  disconnectRuntimeStatusStore,
  runtimeStatusStore,
} from "./runtime-status-store.js";

const desktop = getHost();
afterEach(() => {
  disconnectEntityStore();
  disconnectRuntimeStatusStore();
  installHost(desktop);
});

describe("state feed", () => {
  it("a local-feed host is ready without a status snapshot and never has a stream snapshot applied", () => {
    const subscribe = vi.fn(() => () => {});
    installHost({ ...desktop, stateFeed: "local", events: { subscribe } } as HostAdapter);

    connectRuntimeStatusStore();
    connectEntityStore();

    expect(runtimeStatusStore.snapshotReceived).toBe(true);
    expect(subscribe).not.toHaveBeenCalled();
    expect(entityStore.shops.length).toBe(0);
  });

  it("a stream host subscribes to the entity and status streams", () => {
    const subscribe = vi.fn(() => () => {});
    installHost({ ...desktop, stateFeed: "stream", events: { subscribe } } as HostAdapter);
    connectEntityStore();
    connectRuntimeStatusStore();
    expect(subscribe.mock.calls.map((c) => (c as unknown[])[0]).sort()).toEqual([
      "entity-patch",
      "entity-snapshot",
      "status-patch",
      "status-snapshot",
    ]);
  });
});
