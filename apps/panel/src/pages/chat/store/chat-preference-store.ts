import { types, type Instance } from "mobx-state-tree";

/**
 * ChatPreferenceStore — chat feature-level preference state.
 *
 * NOT session-scoped. Holds:
 *   - Example prompt presets and per-preset user overrides
 *
 * Separate from ChatStore (which holds per-session state) because examples
 * are a feature-level UI/settings concern shared across all sessions.
 *
 * Note: `chatExamplesCollapsed` (examples panel expand/collapse) lives in
 * the global runtime-status store's appSettings, not here — it is a user
 * preference persisted to SQLite and synced across devices/sessions via
 * Desktop -> SSE. Consumers should read it from `runtimeStatus.appSettings`.
 */
export const ChatPreferenceStoreModel = types
  .model("ChatPreferenceStore", {
    activePresetId: "default",
    /** Per-preset user overrides. Key: presetId, Value: map of exampleKey -> custom text. */
    overridesByPreset: types.map(types.map(types.string)),
  })
  .views((self) => ({
    /** Get the user overrides map for the currently active preset as a plain object. */
    get activeOverrides(): Record<string, string> {
      const map = self.overridesByPreset.get(self.activePresetId);
      if (!map) return {};
      const result: Record<string, string> = {};
      for (const [k, v] of map) result[k] = v;
      return result;
    },
  }))
  .actions((self) => ({
    setActivePresetId(id: string) {
      self.activePresetId = id;
    },
    /** Set an override for a specific preset (used when editing targets a pinned preset). */
    setOverrideForPreset(presetId: string, key: string, text: string) {
      let presetMap = self.overridesByPreset.get(presetId);
      if (!presetMap) {
        self.overridesByPreset.set(presetId, {});
        presetMap = self.overridesByPreset.get(presetId)!;
      }
      presetMap.set(key, text);
    },
    /** Clear an override for a specific preset. */
    clearOverrideForPreset(presetId: string, key: string) {
      const presetMap = self.overridesByPreset.get(presetId);
      if (presetMap) presetMap.delete(key);
    },
    /** Bulk load per-preset overrides from settings (on init). */
    loadOverrides(data: Record<string, Record<string, string>>) {
      self.overridesByPreset.clear();
      for (const [presetId, overrides] of Object.entries(data)) {
        self.overridesByPreset.set(presetId, overrides);
      }
    },
  }));

export type IChatPreferenceStore = Instance<typeof ChatPreferenceStoreModel>;

export function createChatPreferenceStore(): IChatPreferenceStore {
  return ChatPreferenceStoreModel.create({});
}
