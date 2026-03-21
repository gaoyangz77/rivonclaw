import type { StateCreator } from "zustand";
import {
  fetchRunProfiles as apiFetchRunProfiles,
  createRunProfile as apiCreateRunProfile,
  updateRunProfile as apiUpdateRunProfile,
  deleteRunProfile as apiDeleteRunProfile,
} from "../../api/run-profiles.js";
import type { RunProfile } from "../../api/run-profiles.js";
import type { PanelStore } from "../panel-store.js";

export type { RunProfile };

export interface RunProfilesSlice {
  runProfiles: RunProfile[];
  runProfilesLoading: boolean;

  fetchRunProfiles: () => Promise<void>;
  createRunProfile: (input: {
    name: string;
    selectedToolIds: string[];
    surfaceId: string;
  }) => Promise<RunProfile>;
  updateRunProfile: (
    id: string,
    input: {
      name?: string;
      selectedToolIds?: string[];
      surfaceId?: string;
    },
  ) => Promise<RunProfile>;
  deleteRunProfile: (id: string) => Promise<void>;
  resetRunProfiles: () => void;
}

export const createRunProfilesSlice: StateCreator<PanelStore, [], [], RunProfilesSlice> = (set) => ({
  runProfiles: [],
  runProfilesLoading: false,

  fetchRunProfiles: async () => {
    set({ runProfilesLoading: true });
    try {
      const list = await apiFetchRunProfiles();
      set({ runProfiles: list, runProfilesLoading: false });
    } catch {
      set({ runProfilesLoading: false });
    }
  },

  createRunProfile: async (input) => {
    const created = await apiCreateRunProfile(input);
    set((state) => ({ runProfiles: [...state.runProfiles, created] }));
    return created;
  },

  updateRunProfile: async (id, input) => {
    const updated = await apiUpdateRunProfile(id, input);
    set((state) => ({
      runProfiles: state.runProfiles.map((p) => (p.id === id ? updated : p)),
    }));
    return updated;
  },

  deleteRunProfile: async (id) => {
    await apiDeleteRunProfile(id);
    set((state) => ({
      runProfiles: state.runProfiles.filter((p) => p.id !== id),
    }));
  },

  resetRunProfiles: () => {
    set({ runProfiles: [], runProfilesLoading: false });
  },
});
