import { applySnapshot, applyPatch, type Instance, type IJsonPatch } from "mobx-state-tree";
import { RuntimeStatusStoreModel } from "@rivonclaw/core/models";

export type PanelRuntimeStatusStore = Instance<typeof RuntimeStatusStoreModel>;

/** Singleton runtime status store for the Panel process. */
export const runtimeStatusStore = RuntimeStatusStoreModel.create({}) as PanelRuntimeStatusStore;

let eventSource: EventSource | null = null;

/**
 * Connect to Desktop's runtime status SSE endpoint and sync store state.
 * Safe to call multiple times -- reconnects if already connected.
 */
export function connectRuntimeStatusStore(): void {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource("/api/status/stream");

  eventSource.addEventListener("snapshot", (e: MessageEvent) => {
    const snapshot = JSON.parse(e.data);
    applySnapshot(runtimeStatusStore, snapshot);
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
