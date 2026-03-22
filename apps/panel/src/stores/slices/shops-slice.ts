import type { StateCreator } from "zustand";
import {
  fetchShops as apiFetchShops,
  fetchPlatformApps as apiFetchPlatformApps,
  updateShop as apiUpdateShop,
  deleteShop as apiDeleteShop,
  initiateTikTokOAuth as apiInitiateTikTokOAuth,
} from "../../api/shops.js";
import type { Shop, PlatformAppInfo } from "../../api/shops.js";
import type { PanelStore } from "../panel-store.js";

export type { Shop, PlatformAppInfo };

export interface ShopsSlice {
  shops: Shop[];
  shopsLoading: boolean;
  platformApps: PlatformAppInfo[];
  platformAppsLoading: boolean;

  fetchShops: () => Promise<void>;
  fetchPlatformApps: () => Promise<void>;
  updateShop: (
    id: string,
    input: {
      shopName?: string;
      authStatus?: string;
      region?: string;
      grantedScopes?: string[];
      services?: { customerService?: boolean };
    },
  ) => Promise<Shop>;
  deleteShop: (id: string) => Promise<void>;
  initiateTikTokOAuth: (platformAppId: string) => Promise<{ authUrl: string; state: string }>;
  resetShops: () => void;
}

export const createShopsSlice: StateCreator<PanelStore, [], [], ShopsSlice> = (set) => ({
  shops: [],
  shopsLoading: false,
  platformApps: [],
  platformAppsLoading: false,

  fetchShops: async () => {
    set({ shopsLoading: true });
    try {
      const list = await apiFetchShops();
      set({ shops: list, shopsLoading: false });
    } catch {
      set({ shopsLoading: false });
    }
  },

  fetchPlatformApps: async () => {
    set({ platformAppsLoading: true });
    try {
      const list = await apiFetchPlatformApps();
      set({ platformApps: list, platformAppsLoading: false });
    } catch {
      set({ platformAppsLoading: false });
    }
  },

  updateShop: async (id, input) => {
    const updated = await apiUpdateShop(id, input);
    set((state) => ({
      shops: state.shops.map((s) => (s.id === id ? updated : s)),
    }));
    return updated;
  },

  deleteShop: async (id) => {
    await apiDeleteShop(id);
    set((state) => ({
      shops: state.shops.filter((s) => s.id !== id),
    }));
  },

  initiateTikTokOAuth: async (platformAppId) => {
    return apiInitiateTikTokOAuth(platformAppId);
  },

  resetShops: () => {
    set({ shops: [], shopsLoading: false, platformApps: [], platformAppsLoading: false });
  },
});
