import type { StateCreator } from "zustand";
import {
  fetchProviderKeys as apiFetchProviderKeys,
  createProviderKey as apiCreateProviderKey,
  updateProviderKey as apiUpdateProviderKey,
  activateProviderKey as apiActivateProviderKey,
  deleteProviderKey as apiDeleteProviderKey,
  refreshProviderModels as apiRefreshProviderModels,
} from "../../api/providers.js";
import type { ProviderKeyEntry } from "../../api/providers.js";
import type { PanelStore } from "../panel-store.js";

export type { ProviderKeyEntry };

export interface ProviderKeysSlice {
  providerKeys: ProviderKeyEntry[];
  providerKeysLoading: boolean;

  fetchProviderKeys: () => Promise<void>;
  createProviderKey: (data: Parameters<typeof apiCreateProviderKey>[0]) => Promise<ProviderKeyEntry>;
  updateProviderKey: (id: string, fields: Parameters<typeof apiUpdateProviderKey>[1]) => Promise<ProviderKeyEntry>;
  activateProviderKey: (id: string) => Promise<void>;
  deleteProviderKey: (id: string) => Promise<void>;
  refreshProviderModels: (id: string) => Promise<ProviderKeyEntry>;
  resetProviderKeys: () => void;
}

export const createProviderKeysSlice: StateCreator<PanelStore, [], [], ProviderKeysSlice> = (set, get) => ({
  providerKeys: [],
  providerKeysLoading: false,

  fetchProviderKeys: async () => {
    set({ providerKeysLoading: true });
    try {
      const keys = await apiFetchProviderKeys();
      set({ providerKeys: keys, providerKeysLoading: false });
    } catch {
      set({ providerKeysLoading: false });
    }
  },

  createProviderKey: async (data) => {
    const entry = await apiCreateProviderKey(data);
    await get().fetchProviderKeys();
    return entry;
  },

  updateProviderKey: async (id, fields) => {
    const entry = await apiUpdateProviderKey(id, fields);
    await get().fetchProviderKeys();
    return entry;
  },

  activateProviderKey: async (id) => {
    await apiActivateProviderKey(id);
    await get().fetchProviderKeys();
  },

  deleteProviderKey: async (id) => {
    await apiDeleteProviderKey(id);
    await get().fetchProviderKeys();
  },

  refreshProviderModels: async (id) => {
    const updated = await apiRefreshProviderModels(id);
    await get().fetchProviderKeys();
    return updated;
  },

  resetProviderKeys: () => {
    set({ providerKeys: [], providerKeysLoading: false });
  },
});
