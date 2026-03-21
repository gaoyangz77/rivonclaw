import type { StateCreator } from "zustand";
import {
  fetchSurfaces as apiFetchSurfaces,
  createSurface as apiCreateSurface,
  updateSurface as apiUpdateSurface,
  deleteSurface as apiDeleteSurface,
} from "../../api/surfaces.js";
// Note: apiFetchSurfaces is only used for initial load (fetchSurfaces action).
// CRUD actions use optimistic updates — they mutate store directly from the API response.
import type { Surface } from "../../api/surfaces.js";
import type { PanelStore } from "../panel-store.js";

export type { Surface };

export interface SurfacesSlice {
  surfaces: Surface[];
  surfacesLoading: boolean;

  fetchSurfaces: () => Promise<void>;
  createSurface: (input: {
    name: string;
    description?: string;
    allowedToolIds: string[];
    allowedCategories: string[];
  }) => Promise<Surface>;
  updateSurface: (
    id: string,
    input: {
      name?: string;
      description?: string;
      allowedToolIds?: string[];
      allowedCategories?: string[];
    },
  ) => Promise<Surface>;
  deleteSurface: (id: string) => Promise<void>;
  resetSurfaces: () => void;
}

export const createSurfacesSlice: StateCreator<PanelStore, [], [], SurfacesSlice> = (set) => ({
  surfaces: [],
  surfacesLoading: false,

  fetchSurfaces: async () => {
    set({ surfacesLoading: true });
    try {
      const list = await apiFetchSurfaces();
      set({ surfaces: list, surfacesLoading: false });
    } catch {
      set({ surfacesLoading: false });
    }
  },

  createSurface: async (input) => {
    const created = await apiCreateSurface(input);
    set((state) => ({ surfaces: [...state.surfaces, created] }));
    return created;
  },

  updateSurface: async (id, input) => {
    const updated = await apiUpdateSurface(id, input);
    set((state) => ({
      surfaces: state.surfaces.map((s) => (s.id === id ? updated : s)),
    }));
    return updated;
  },

  deleteSurface: async (id) => {
    await apiDeleteSurface(id);
    set((state) => ({
      surfaces: state.surfaces.filter((s) => s.id !== id),
    }));
  },

  resetSurfaces: () => {
    set({ surfaces: [], surfacesLoading: false });
  },
});
