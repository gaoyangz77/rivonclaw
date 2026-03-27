import type { StateCreator } from "zustand";
import { fetchJson } from "../../api/client.js";
import {
  createSurface as apiCreateSurface,
  updateSurface as apiUpdateSurface,
  deleteSurface as apiDeleteSurface,
} from "../../api/surfaces.js";
import type { PanelStore } from "../panel-store.js";

/** Surface as returned by CapabilityResolver (resolved tool list, not raw allowedToolIds). */
export interface Surface {
  id: string;
  name: string;
  userId: string;
  /** Resolved tool IDs available in this surface (from CapabilityResolver). */
  resolvedToolIds: string[];
}

export interface SurfacesSlice {
  surfaces: Surface[];
  surfacesLoading: boolean;

  fetchSurfaces: () => Promise<void>;
  createSurface: (input: {
    name: string;
    description?: string;
    allowedToolIds: string[];
    allowedCategories: string[];
  }) => Promise<void>;
  updateSurface: (
    id: string,
    input: {
      name?: string;
      description?: string;
      allowedToolIds?: string[];
      allowedCategories?: string[];
    },
  ) => Promise<void>;
  deleteSurface: (id: string) => Promise<void>;
  resetSurfaces: () => void;
}

export const createSurfacesSlice: StateCreator<PanelStore, [], [], SurfacesSlice> = (set, get) => ({
  surfaces: [],
  surfacesLoading: false,

  fetchSurfaces: async () => {
    set({ surfacesLoading: true });
    try {
      const data = await fetchJson<{ surfaces: Surface[] }>("/tools/surfaces");
      set({ surfaces: data.surfaces ?? [], surfacesLoading: false });
    } catch {
      set({ surfacesLoading: false });
    }
  },

  createSurface: async (input) => {
    await apiCreateSurface(input);
    // Re-fetch from CapabilityResolver to get resolved tool lists
    await get().fetchSurfaces();
  },

  updateSurface: async (id, input) => {
    await apiUpdateSurface(id, input);
    await get().fetchSurfaces();
  },

  deleteSurface: async (id) => {
    await apiDeleteSurface(id);
    await get().fetchSurfaces();
  },

  resetSurfaces: () => {
    set({ surfaces: [], surfacesLoading: false });
  },
});
