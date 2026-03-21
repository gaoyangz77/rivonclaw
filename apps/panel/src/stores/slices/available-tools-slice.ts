import type { StateCreator } from "zustand";
import { fetchAvailableTools as apiFetchAvailableTools } from "../../api/tool-registry.js";
import type { AvailableTool } from "../../api/tool-registry.js";
import type { PanelStore } from "../panel-store.js";

export interface AvailableToolsSlice {
  availableTools: AvailableTool[];

  fetchAvailableTools: () => Promise<void>;
  resetAvailableTools: () => void;
}

export const createAvailableToolsSlice: StateCreator<PanelStore, [], [], AvailableToolsSlice> = (set) => ({
  availableTools: [],

  fetchAvailableTools: async () => {
    try {
      const tools = await apiFetchAvailableTools();
      set({ availableTools: tools });
    } catch {
      // Silently fail — tools list is non-critical
    }
  },

  resetAvailableTools: () => {
    set({ availableTools: [] });
  },
});
