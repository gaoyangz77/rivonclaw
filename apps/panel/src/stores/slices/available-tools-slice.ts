import type { StateCreator } from "zustand";
import { fetchJson } from "../../api/client.js";
import type { PanelStore } from "../panel-store.js";

/** Tool metadata for Panel display. */
export interface AvailableTool {
  id: string;
  displayName: string;
  description: string;
  category: string;
  source?: "system" | "extension" | "entitled";
}

export interface AvailableToolsSlice {
  availableTools: AvailableTool[];

  fetchAvailableTools: () => Promise<void>;
  resetAvailableTools: () => void;
}

export const createAvailableToolsSlice: StateCreator<PanelStore, [], [], AvailableToolsSlice> = (set) => ({
  availableTools: [],

  fetchAvailableTools: async () => {
    try {
      const data = await fetchJson<{ tools: AvailableTool[] }>("/tools/available");
      set({ availableTools: data.tools ?? [] });
    } catch {
      // Silently fail — tools list is non-critical
    }
  },

  resetAvailableTools: () => {
    set({ availableTools: [] });
  },
});
