import { onPatch, getSnapshot, type IJsonPatch } from "mobx-state-tree";
import { RuntimeStatusStoreModel, applyAppSetting, loadAppSettings } from "@rivonclaw/core/models";

// ---------------------------------------------------------------------------
// Desktop-specific RuntimeStatusStore: extends shared model with mutation actions
// ---------------------------------------------------------------------------

/** Desktop-specific model with mutation actions. Exported for test factory use. */
export const DesktopRuntimeStatusModel = RuntimeStatusStoreModel.actions((self) => ({
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
  setCloudToolsStatus(state: "checking" | "ready" | "unavailable", error?: string) {
    self.cloudTools.state = state;
    self.cloudTools.lastError = state === "unavailable" ? (error ?? "") : "";
  },
  setDeviceId(id: string) {
    self.deviceId = id;
  },

  setGatewayRpcConnected(connected: boolean) {
    self.gatewayRpcConnected = connected;
  },

  setConnectorProcessState(state: string) {
    self.openClawConnector.processState = state as typeof self.openClawConnector.processState;
  },
  setConnectorRpcConnected(connected: boolean) {
    self.openClawConnector.rpcConnected = connected;
    self.gatewayRpcConnected = connected; // backward compat
  },
  setConnectorSidecarState(state: string) {
    self.openClawConnector.sidecarState = state as typeof self.openClawConnector.sidecarState;
  },
  setConnectorRestartAttempt(attempt: number) {
    self.openClawConnector.restartAttempt = attempt;
  },
  setConnectorLastError(error: string) {
    self.openClawConnector.lastError = error;
  },
  setConnectorStartupFailure(reason: string) {
    self.openClawConnector.startupFailure = reason;
  },

  /** Bulk-load all app settings from storage on startup. */
  loadAppSettings(settings: Record<string, string>) {
    loadAppSettings(self.appSettings, settings);
  },

  /** Update a single app setting by storage key after a settings write. */
  updateAppSetting(key: string, value: string) {
    applyAppSetting(self.appSettings, key, value);
  },

  /** Bulk-update app settings by storage keys after a settings write. */
  updateAppSettings(entries: Record<string, string>) {
    for (const [key, value] of Object.entries(entries)) {
      applyAppSetting(self.appSettings, key, value);
    }
  },
}));

/** Create a fresh Desktop runtime status store. Used by tests to avoid singleton pollution. */
export function createRuntimeStatusStore() {
  return DesktopRuntimeStatusModel.create({});
}

/** Singleton runtime status store for the Desktop process. */
export const runtimeStatusStore = createRuntimeStatusStore();

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
