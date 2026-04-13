import { types, type Instance } from "mobx-state-tree";
import { DEFAULTS } from "../defaults.js";
import { OpenClawConnectorModel } from "./OpenClawConnector.js";

export const CsBridgeStatusModel = types.model("CsBridgeStatus", {
  state: types.optional(
    types.enumeration("CsBridgeState", ["connected", "disconnected", "reconnecting"]),
    "disconnected",
  ),
  reconnectAttempt: types.optional(types.number, 0),
});

/**
 * Observable app settings — Desktop loads from storage on startup,
 * updates via MST actions on writes, and patches flow to Panel via SSE.
 *
 * Panel reads these reactively via observer() — no polling or window events needed.
 * Settings not included here (dmScope, openclawStateDir, etc.) remain REST-only.
 */
/**
 * MST defaults must match the absent-value semantics of SETTING_APPLIERS in
 * runtime-status-store.ts (Desktop). This is the value Panel sees before the
 * SSE snapshot arrives — it must agree with what loadAppSettings({}) produces.
 *
 * Rule: isNotFalse settings default to true, isTrue settings default to false.
 */
export const AppSettingsModel = types.model("AppSettings", {
  // Chat display (isNotFalse → absent = true)
  chatShowAgentEvents: types.optional(types.boolean, true),
  chatCollapseMessages: types.optional(types.boolean, true),
  // Chat display (isTrue → absent = false)
  chatPreserveToolEvents: types.optional(types.boolean, false),
  // Privacy (isTrue → absent = false)
  privacyMode: types.optional(types.boolean, false),
  // Telemetry (isNotFalse → absent = true; opt-out model)
  telemetryEnabled: types.optional(types.boolean, true),
  // Auto-launch (isTrue → absent = false)
  autoLaunchEnabled: types.optional(types.boolean, false),
  // Browser
  browserMode: types.optional(types.string, DEFAULTS.settings.browserMode),
  // Session state CDP (isNotFalse → absent = true)
  sessionStateCdpEnabled: types.optional(types.boolean, true),
  // STT (isTrue → absent = false)
  sttEnabled: types.optional(types.boolean, false),
  sttProvider: types.optional(types.string, ""),
  // Extras (isTrue → absent = false)
  webSearchEnabled: types.optional(types.boolean, false),
  webSearchProvider: types.optional(types.string, ""),
  embeddingEnabled: types.optional(types.boolean, false),
  embeddingProvider: types.optional(types.string, ""),
  // Permissions (isNotFalse → absent = true)
  filePermissionsFullAccess: types.optional(types.boolean, true),
});

export const RuntimeStatusStoreModel = types.model("RuntimeStatusStore", {
  csBridge: types.optional(CsBridgeStatusModel, {}),
  appSettings: types.optional(AppSettingsModel, {}),
  gatewayRpcConnected: types.optional(types.boolean, false),
  openClawConnector: types.optional(OpenClawConnectorModel, {}),
  /** Device identity — set by Desktop at startup, flows to Panel via SSE. */
  deviceId: types.optional(types.string, ""),
});

export interface AppSettings extends Instance<typeof AppSettingsModel> {}
export interface CsBridgeStatus extends Instance<typeof CsBridgeStatusModel> {}
export interface RuntimeStatusStore extends Instance<typeof RuntimeStatusStoreModel> {}
