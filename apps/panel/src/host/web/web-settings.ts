import type { WorkspaceDescriptor } from "@rivonclaw/core/api-contract";
import type { HostSettings } from "../host-adapter.js";

const STORAGE_KEY = "tkc.panel.settings";
const WORKSPACE_KEY_PREFIX = "tkc.panel.workspace.";

/** Where the web host keeps preferences. localStorage is per-viewer, which is what these are. */
export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function read(storage: SettingsStorage): Record<string, string> {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") return {};
  return parsed as Record<string, string>;
}

/**
 * Preferences for the web host: persisted in the browser, then applied to the
 * runtime status store through `onChange` (Desktop gets the same effect from
 * its SSE patch).
 */
export function createWebSettings(options: {
  storage: SettingsStorage;
  onChange: (all: Record<string, string>) => void;
}): HostSettings & { load(): Record<string, string> } {
  return {
    load: () => read(options.storage),
    async getAll() {
      return read(options.storage);
    },
    async getWorkspace(userId) {
      const raw = options.storage.getItem(WORKSPACE_KEY_PREFIX + (userId ?? "guest"));
      return raw ? (JSON.parse(raw) as WorkspaceDescriptor) : null;
    },
    async saveWorkspace(userId, workspace) {
      options.storage.setItem(WORKSPACE_KEY_PREFIX + (userId ?? "guest"), JSON.stringify(workspace));
    },
    async update(entries) {
      const next = { ...read(options.storage), ...entries };
      options.storage.setItem(STORAGE_KEY, JSON.stringify(next));
      options.onChange(next);
    },
  };
}
