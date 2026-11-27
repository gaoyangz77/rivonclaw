import type { Instance } from "mobx-state-tree";
import type { AppSettingsModel } from "./RuntimeStatus.js";

type AppSettings = Instance<typeof AppSettingsModel>;

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
type Applier = (
  s: AppSettings,
  raw: string | undefined,
) => void;

/**
 * Absent-value semantics must match the old REST getter / main.ts logic:
 *
 * - isNotFalse: absent → true  (opt-out: enabled unless explicitly "false")
 *     Used by: telemetry_enabled, chat_collapse_messages, chat_show_agent_events
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
export const SETTING_APPLIERS: Record<string, Applier> = {
  locale: (s, v) => {
    s.locale = v ?? "";
  },
  chat_show_agent_events: (s, v) => {
    s.chatShowAgentEvents = isNotFalse(v);
  },
  chat_preserve_tool_events: (s, v) => {
    s.chatPreserveToolEvents = isTrue(v);
  },
  chat_collapse_messages: (s, v) => {
    s.chatCollapseMessages = isNotFalse(v);
  },
  privacy_mode: (s, v) => {
    s.privacyMode = isTrue(v);
  },
  telemetry_enabled: (s, v) => {
    s.telemetryEnabled = isNotFalse(v);
  },
  auto_launch_enabled: (s, v) => {
    s.autoLaunchEnabled = isTrue(v);
  },
  "browser-mode": (s, v) => {
    s.browserMode = v ?? "standalone";
  },
  "stt.enabled": (s, v) => {
    s.sttEnabled = isTrue(v);
  },
  "stt.provider": (s, v) => {
    s.sttProvider = v ?? "";
  },
  "webSearch.enabled": (s, v) => {
    s.webSearchEnabled = isTrue(v);
  },
  "webSearch.provider": (s, v) => {
    s.webSearchProvider = v ?? "";
  },
  "embedding.enabled": (s, v) => {
    s.embeddingEnabled = isTrue(v);
  },
  "embedding.provider": (s, v) => {
    s.embeddingProvider = v ?? "";
  },

  // Panel UI preferences (previously localStorage-only, see ADR/PROGRESS).
  telemetry_consent_shown: (s, v) => {
    s.telemetryConsentShown = v === "1";
  },
  whats_new_last_seen_version: (s, v) => {
    s.whatsNewLastSeenVersion = v ?? "";
  },
  panel_theme: (s, v) => {
    s.panelTheme = v === "light" || v === "dark" || v === "system" ? v : "system";
  },
  panel_accent: (s, v) => {
    s.panelAccent = v || "blue";
  },
  // Deprecated compatibility value. Absent defaults false; the Panel no longer
  // uses this preference to replace the product brand with an agent name.
  show_agent_name: (s, v) => {
    s.showAgentName = isTrue(v);
  },
  tutorial_enabled: (s, v) => {
    s.tutorialEnabled = isNotFalse(v);
  },
  chat_examples_collapsed: (s, v) => {
    s.chatExamplesCollapsed = v === "1";
  },
  chat_tab_order: (s, v) => {
    s.chatTabOrder = v ?? "";
  },
  sidebar_collapsed: (s, v) => {
    s.sidebarCollapsed = isTrue(v);
  },
};


/** Apply one storage key to the app settings; unknown keys are ignored. */
export function applyAppSetting(
  appSettings: AppSettings,
  key: string,
  value: string | undefined,
): void {
  SETTING_APPLIERS[key]?.(appSettings, value);
}

/** Apply every known key from a full settings map (absent keys take their absent-value semantics). */
export function loadAppSettings(appSettings: AppSettings, settings: Record<string, string>): void {
  for (const [storageKey, apply] of Object.entries(SETTING_APPLIERS)) {
    apply(appSettings, settings[storageKey]);
  }
}
