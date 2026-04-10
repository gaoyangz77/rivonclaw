import { onPatch, getSnapshot, type IJsonPatch } from "mobx-state-tree";
import { RuntimeStatusStoreModel } from "@rivonclaw/core/models";

// ---------------------------------------------------------------------------
// Desktop-specific RuntimeStatusStore: extends shared model with mutation actions
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Storage key → MST property applier for AppSettings
// ---------------------------------------------------------------------------

/** Parse a boolean setting where "true" means true, anything else (including absent) is false. */
const isTrue = (v: string | undefined): boolean => v === "true";
/** Parse a boolean setting where "false" means false, anything else (including absent) is true. */
const isNotFalse = (v: string | undefined): boolean => v !== "false";

/**
 * Each entry maps a storage key to a function that applies the raw string value
 * (or undefined when absent) to `self.appSettings`.  Using per-key functions
 * avoids casting the MST node to `Record` and keeps full type safety.
 */
type Applier = (s: typeof RuntimeStatusStoreModel.Type.appSettings, raw: string | undefined) => void;

/**
 * Absent-value semantics must match the old REST getter / main.ts logic:
 *
 * - isNotFalse: absent → true  (opt-out: enabled unless explicitly "false")
 *     Used by: telemetry_enabled, session-state-cdp-enabled, chat_collapse_messages,
 *              chat_show_agent_events, file-permissions-full-access
 * - isTrue:    absent → false  (opt-in: disabled unless explicitly "true")
 *     Used by: chat_preserve_tool_events, privacy_mode, auto_launch_enabled,
 *              stt.enabled, webSearch.enabled, embedding.enabled
 *
 * DEFAULTS.settings.showAgentEvents is false (off for fresh installs), but the
 * storage-level absent semantic is isNotFalse (true). This is correct: DEFAULTS
 * describes the UX intent for *new installs* — the onboarding flow writes
 * "false" into storage explicitly. An absent key at runtime means the user
 * has never toggled it, which the old getter treated as enabled.
 */
const SETTING_APPLIERS: Record<string, Applier> = {
  "chat_show_agent_events":       (s, v) => { s.chatShowAgentEvents      = isNotFalse(v); },
  "chat_preserve_tool_events":    (s, v) => { s.chatPreserveToolEvents   = isTrue(v); },
  "chat_collapse_messages":       (s, v) => { s.chatCollapseMessages     = isNotFalse(v); },
  "privacy_mode":                 (s, v) => { s.privacyMode              = isTrue(v); },
  "telemetry_enabled":            (s, v) => { s.telemetryEnabled         = isNotFalse(v); },
  "auto_launch_enabled":          (s, v) => { s.autoLaunchEnabled        = isTrue(v); },
  "browser-mode":                 (s, v) => { s.browserMode              = v ?? "standalone"; },
  "session-state-cdp-enabled":    (s, v) => { s.sessionStateCdpEnabled   = isNotFalse(v); },
  "stt.enabled":                  (s, v) => { s.sttEnabled               = isTrue(v); },
  "stt.provider":                 (s, v) => { s.sttProvider              = v ?? ""; },
  "webSearch.enabled":            (s, v) => { s.webSearchEnabled         = isTrue(v); },
  "webSearch.provider":           (s, v) => { s.webSearchProvider        = v ?? ""; },
  "embedding.enabled":            (s, v) => { s.embeddingEnabled         = isTrue(v); },
  "embedding.provider":           (s, v) => { s.embeddingProvider        = v ?? ""; },
  "file-permissions-full-access": (s, v) => { s.filePermissionsFullAccess = isNotFalse(v); },
};

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

  /** Bulk-load all app settings from storage on startup. */
  loadAppSettings(settings: Record<string, string>) {
    for (const [storageKey, apply] of Object.entries(SETTING_APPLIERS)) {
      apply(self.appSettings, settings[storageKey]);
    }
  },

  /** Update a single app setting by storage key after a settings write. */
  updateAppSetting(key: string, value: string) {
    const apply = SETTING_APPLIERS[key];
    if (apply) apply(self.appSettings, value);
  },

  /** Bulk-update app settings by storage keys after a settings write. */
  updateAppSettings(entries: Record<string, string>) {
    for (const [key, value] of Object.entries(entries)) {
      const apply = SETTING_APPLIERS[key];
      if (apply) apply(self.appSettings, value);
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
