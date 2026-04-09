import { onPatch, getSnapshot, type IJsonPatch } from "mobx-state-tree";
import { RuntimeStatusStoreModel } from "@rivonclaw/core/models";

// ---------------------------------------------------------------------------
// Desktop-specific RuntimeStatusStore: extends shared model with mutation actions
// ---------------------------------------------------------------------------

const DesktopRuntimeStatusModel = RuntimeStatusStoreModel.actions((self) => ({
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

/** Singleton runtime status store for the Desktop process. */
export const runtimeStatusStore = DesktopRuntimeStatusModel.create({});

// ---------------------------------------------------------------------------
// Patch listener registry (same pattern as desktop-store.ts)
// ---------------------------------------------------------------------------

type PatchListener = (patches: IJsonPatch[]) => void;
const patchListeners = new Set<PatchListener>();

export function subscribeToRuntimeStatusPatch(listener: PatchListener): () => void {
  patchListeners.add(listener);
  return () => patchListeners.delete(listener);
}

// Batch patches within the same microtask to avoid SSE message storms.
let patchBuffer: IJsonPatch[] = [];
let flushScheduled = false;

function flushPatches() {
  flushScheduled = false;
  if (patchBuffer.length === 0) return;
  const batch = patchBuffer;
  patchBuffer = [];
  for (const listener of patchListeners) {
    listener(batch);
  }
}

onPatch(runtimeStatusStore, (patch) => {
  patchBuffer.push(patch);
  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(flushPatches);
  }
});

export { getSnapshot };
