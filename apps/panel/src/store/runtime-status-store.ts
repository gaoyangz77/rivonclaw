import { applySnapshot, applyPatch, types, type Instance, type IJsonPatch } from "mobx-state-tree";
import { RuntimeStatusStoreModel } from "@rivonclaw/core/models";
import { AppSettingsModel } from "./models/AppSettingsModel.js";
import { SSE } from "@rivonclaw/core/api-contract";

/**
 * Panel-specific RuntimeStatusStore that overrides `appSettings` with the
 * Panel AppSettingsModel (which adds client-side save actions).
 * Follows the same override pattern as PanelRootStoreModel in entity-store.ts.
 */
const PanelRuntimeStatusStoreModel = RuntimeStatusStoreModel
  .props({
    appSettings: types.optional(AppSettingsModel, {}),
  })
  .volatile(() => ({
    /** True after the first SSE snapshot from Desktop has been applied.
     *  Pages that maintain local draft state should wait for this before
     *  seeding their form values — otherwise they lock in MST defaults. */
    snapshotReceived: false,
  }))
  .actions((self) => ({
    markSnapshotReceived() {
      self.snapshotReceived = true;
    },
  }));

export type PanelRuntimeStatusStore = Omit<Instance<typeof PanelRuntimeStatusStoreModel>, "appSettings"> & {
  readonly appSettings: Instance<typeof AppSettingsModel>;
  readonly snapshotReceived: boolean;
  markSnapshotReceived(): void;
};

/** Singleton runtime status store for the Panel process. */
export const runtimeStatusStore = PanelRuntimeStatusStoreModel.create({}) as PanelRuntimeStatusStore;

let eventSource: EventSource | null = null;

/**
 * Connect to Desktop's runtime status SSE endpoint and sync store state.
 * Safe to call multiple times -- reconnects if already connected.
 */
export function connectRuntimeStatusStore(): void {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource(SSE["status.stream"].path);

  eventSource.addEventListener("snapshot", (e: MessageEvent) => {
    const snapshot = JSON.parse(e.data);
    applySnapshot(runtimeStatusStore, snapshot);
    if (!runtimeStatusStore.snapshotReceived) {
      runtimeStatusStore.markSnapshotReceived();
    }
  });

  eventSource.addEventListener("patch", (e: MessageEvent) => {
    const patches: IJsonPatch[] = JSON.parse(e.data);
    applyPatch(runtimeStatusStore, patches);
  });

  // EventSource auto-reconnects on error. On reconnect, Desktop
  // re-sends a full snapshot, so the store self-heals.
  eventSource.onerror = (event: Event) => {
    console.error("[runtime-status-store] SSE connection error -- browser will auto-reconnect", event);
  };
}

/**
 * Disconnect from the SSE stream. Call on logout or unmount.
 */
export function disconnectRuntimeStatusStore(): void {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}
