import { applySnapshot, applyPatch, types, type Instance, type IJsonPatch } from "mobx-state-tree";
import { RuntimeStatusStoreModel } from "@rivonclaw/core/models";
import { AppSettingsModel } from "./models/AppSettingsModel.js";
import { panelEventBus } from "../lib/event-bus.js";

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

let unsubscribeSnapshot: (() => void) | null = null;
let unsubscribePatch: (() => void) | null = null;

/**
 * Subscribe to Desktop's unified event stream for runtime-status sync.
 * Safe to call multiple times -- re-subscribes if already connected.
 *
 * On every (re)connect of the underlying shared EventSource, Desktop
 * re-emits `status-snapshot` so the store self-heals without client logic.
 */
export function connectRuntimeStatusStore(): void {
  disconnectRuntimeStatusStore();

  unsubscribeSnapshot = panelEventBus.subscribe("status-snapshot", (data) => {
    applySnapshot(runtimeStatusStore, data as Parameters<typeof applySnapshot>[1]);
    if (!runtimeStatusStore.snapshotReceived) {
      runtimeStatusStore.markSnapshotReceived();
    }
  });

  unsubscribePatch = panelEventBus.subscribe("status-patch", (data) => {
    applyPatch(runtimeStatusStore, data as IJsonPatch[]);
  });
}

/**
 * Unsubscribe from the shared event stream. Call on logout or unmount.
 * Does NOT close the underlying EventSource — other subscribers may
 * still need it.
 */
export function disconnectRuntimeStatusStore(): void {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }
  if (unsubscribePatch) {
    unsubscribePatch();
    unsubscribePatch = null;
  }
}
