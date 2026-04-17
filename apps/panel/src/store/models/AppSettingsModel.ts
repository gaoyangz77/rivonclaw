import { flow } from "mobx-state-tree";
import { AppSettingsModel as AppSettingsModelBase } from "@rivonclaw/core/models";
import { fetchJson, invalidateCache } from "../../api/client.js";
import { API, clientPath } from "@rivonclaw/core/api-contract";

/**
 * Panel-side extension of AppSettingsModel with client-side save actions.
 *
 * Each action calls the Desktop REST API to persist the setting.
 * Local MST state is NOT updated here — Desktop writes to storage,
 * updates its own MST, and the SSE patch flows back automatically.
 */
export const AppSettingsModel = AppSettingsModelBase.actions(() => ({
  setTelemetryEnabled: flow(function* (enabled: boolean) {
    yield fetchJson(clientPath(API["settings.telemetry.set"]), {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    });
  }),

  setAutoLaunchEnabled: flow(function* (enabled: boolean) {
    yield fetchJson(clientPath(API["settings.autoLaunch.set"]), {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    });
  }),

  setChatShowAgentEvents: flow(function* (enabled: boolean) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ chat_show_agent_events: enabled ? "true" : "false" }),
    });
    invalidateCache("settings");
  }),

  setChatPreserveToolEvents: flow(function* (enabled: boolean) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ chat_preserve_tool_events: enabled ? "true" : "false" }),
    });
    invalidateCache("settings");
  }),

  setChatCollapseMessages: flow(function* (enabled: boolean) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ chat_collapse_messages: enabled ? "true" : "false" }),
    });
    invalidateCache("settings");
  }),

  setPrivacyMode: flow(function* (enabled: boolean) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ privacy_mode: enabled ? "true" : "false" }),
    });
    invalidateCache("settings");
  }),

  setBrowserMode: flow(function* (mode: string) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ "browser-mode": mode }),
    });
    invalidateCache("settings");
  }),

  setSessionStateCdpEnabled: flow(function* (enabled: boolean) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ "session-state-cdp-enabled": enabled ? "true" : "false" }),
    });
    invalidateCache("settings");
  }),

  setSttEnabled: flow(function* (enabled: boolean) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ "stt.enabled": enabled ? "true" : "false" }),
    });
    invalidateCache("settings");
  }),

  setSttProvider: flow(function* (provider: string) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ "stt.provider": provider }),
    });
    invalidateCache("settings");
  }),

  setWebSearchEnabled: flow(function* (enabled: boolean) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ "webSearch.enabled": enabled ? "true" : "false" }),
    });
    invalidateCache("settings");
  }),

  setWebSearchProvider: flow(function* (provider: string) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ "webSearch.provider": provider }),
    });
    invalidateCache("settings");
  }),

  setEmbeddingEnabled: flow(function* (enabled: boolean) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ "embedding.enabled": enabled ? "true" : "false" }),
    });
    invalidateCache("settings");
  }),

  setEmbeddingProvider: flow(function* (provider: string) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ "embedding.provider": provider }),
    });
    invalidateCache("settings");
  }),

  setFilePermissionsFullAccess: flow(function* (enabled: boolean) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ "file-permissions-full-access": enabled ? "true" : "false" }),
    });
    invalidateCache("settings");
  }),

  updateBulk: flow(function* (entries: Record<string, string>) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify(entries),
    });
    invalidateCache("settings");
  }),

  // ---------------------------------------------------------------------------
  // Panel UI preferences (previously localStorage-backed; migrated to MST+SSE
  // because Panel's dynamic-port origin makes localStorage non-durable).
  // ---------------------------------------------------------------------------

  setTelemetryConsentShown: flow(function* () {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ telemetry_consent_shown: "1" }),
    });
    invalidateCache("settings");
  }),

  setWhatsNewLastSeenVersion: flow(function* (version: string) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ whats_new_last_seen_version: version }),
    });
    invalidateCache("settings");
  }),

  setPanelTheme: flow(function* (theme: "system" | "light" | "dark") {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ panel_theme: theme }),
    });
    invalidateCache("settings");
  }),

  setPanelAccent: flow(function* (accent: string) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ panel_accent: accent }),
    });
    invalidateCache("settings");
  }),

  setShowAgentName: flow(function* (enabled: boolean) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ show_agent_name: enabled ? "true" : "false" }),
    });
    invalidateCache("settings");
  }),

  setTutorialEnabled: flow(function* (enabled: boolean) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ tutorial_enabled: enabled ? "true" : "false" }),
    });
    invalidateCache("settings");
  }),

  setChatExamplesCollapsed: flow(function* (collapsed: boolean) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ chat_examples_collapsed: collapsed ? "1" : "0" }),
    });
    invalidateCache("settings");
  }),

  /** Accepts a JSON-stringified array of session keys, or "" to clear. */
  setChatTabOrder: flow(function* (orderJson: string) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ chat_tab_order: orderJson }),
    });
    invalidateCache("settings");
  }),

  setSidebarCollapsed: flow(function* (collapsed: boolean) {
    yield fetchJson(clientPath(API["settings.update"]), {
      method: "PUT",
      body: JSON.stringify({ sidebar_collapsed: collapsed ? "true" : "false" }),
    });
    invalidateCache("settings");
  }),
}));
