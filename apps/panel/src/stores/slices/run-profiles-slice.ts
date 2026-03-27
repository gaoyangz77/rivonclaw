import type { StateCreator } from "zustand";
import { fetchJson } from "../../api/client.js";
import {
  createRunProfile as apiCreateRunProfile,
  updateRunProfile as apiUpdateRunProfile,
  deleteRunProfile as apiDeleteRunProfile,
} from "../../api/run-profiles.js";
import type { PanelStore } from "../panel-store.js";

/** RunProfile as returned by CapabilityResolver. */
export interface RunProfile {
  id: string;
  name: string;
  userId: string;
  surfaceId: string;
  selectedToolIds: string[];
}

export interface RunProfilesSlice {
  runProfiles: RunProfile[];
  runProfilesLoading: boolean;

  fetchRunProfiles: () => Promise<void>;
  createRunProfile: (input: {
    name: string;
    selectedToolIds: string[];
    surfaceId: string;
  }) => Promise<void>;
  updateRunProfile: (
    id: string,
    input: {
      name?: string;
      selectedToolIds?: string[];
      surfaceId?: string;
    },
  ) => Promise<void>;
  deleteRunProfile: (id: string) => Promise<void>;
  resetRunProfiles: () => void;
}

export const createRunProfilesSlice: StateCreator<PanelStore, [], [], RunProfilesSlice> = (set, get) => ({
  runProfiles: [],
  runProfilesLoading: false,

  fetchRunProfiles: async () => {
    set({ runProfilesLoading: true });
    try {
      const data = await fetchJson<{ runProfiles: RunProfile[] }>("/tools/run-profiles");
      set({ runProfiles: data.runProfiles ?? [], runProfilesLoading: false });
    } catch {
      set({ runProfilesLoading: false });
    }
  },

  createRunProfile: async (input) => {
    await apiCreateRunProfile(input);
    await get().fetchRunProfiles();
  },

  updateRunProfile: async (id, input) => {
    await apiUpdateRunProfile(id, input);
    await get().fetchRunProfiles();
  },

  deleteRunProfile: async (id) => {
    await apiDeleteRunProfile(id);
    await get().fetchRunProfiles();
  },

  resetRunProfiles: () => {
    set({ runProfiles: [], runProfilesLoading: false });
  },
});
