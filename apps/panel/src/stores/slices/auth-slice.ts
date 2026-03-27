import { GQL } from "@rivonclaw/core";
import type { StateCreator } from "zustand";
import { ME_QUERY } from "../../api/auth-queries.js";
import { getClient } from "../../api/apollo-client.js";
import { trackEvent } from "../../api/settings.js";
import { fetchJson, fetchVoid } from "../../api/client.js";
import { warmToolSpecs } from "../../api/presets.js";
import type { PanelStore } from "../panel-store.js";

export interface AuthSlice {
  user: GQL.MeResponse | null;
  authenticated: boolean;
  authLoading: boolean;

  initSession: () => Promise<void>;
  login: (input: GQL.LoginInput) => Promise<void>;
  register: (input: GQL.RegisterInput) => Promise<void>;
  logout: () => void;
  clearAuth: () => void;
}

export const createAuthSlice: StateCreator<PanelStore, [], [], AuthSlice> = (set, get) => ({
  user: null,
  authenticated: false,
  authLoading: true,

  initSession: async () => {
    try {
      const session = await fetchJson<{ user: GQL.MeResponse | null; authenticated: boolean }>("/auth/session");
      if (session.authenticated && session.user) {
        set({ user: session.user, authenticated: true, authLoading: false });
        const modules = (session.user.enrolledModules ?? []) as import("./modules-slice.js").ModuleId[];
        get().syncEnrolledModules(modules);
        get().fetchSubscription();
        get().fetchLlmQuota();
        // Warm entity-cache with toolSpecs, then fetch presets and available tools
        warmToolSpecs().catch(() => {}).then(() => {
          get().fetchSurfaces();
          get().fetchRunProfiles();
          get().fetchAvailableTools();
        });
        get().fetchProviderKeys();
        if (modules.includes("GLOBAL_ECOMMERCE_SELLER")) {
          get().fetchShops();
        }
        return;
      }
      if (session.authenticated && !session.user) {
        // Token exists but user not cached — validate via Desktop proxy ME query
        try {
          const { data } = await getClient().query<{ me: GQL.MeResponse }>({
            query: ME_QUERY,
            fetchPolicy: "network-only",
          });
          if (data?.me) {
            set({ user: data.me, authenticated: true, authLoading: false });
            const modules = (data.me.enrolledModules ?? []) as import("./modules-slice.js").ModuleId[];
            get().syncEnrolledModules(modules);
            get().fetchSubscription();
            get().fetchLlmQuota();
            // Warm entity-cache with toolSpecs, then fetch presets and available tools
            warmToolSpecs().catch(() => {}).then(() => {
              get().fetchSurfaces();
              get().fetchRunProfiles();
              get().fetchAvailableTools();
            });
            get().fetchProviderKeys();
            if (modules.includes("GLOBAL_ECOMMERCE_SELLER")) {
              get().fetchShops();
            }
            return;
          }
        } catch {
          set({ authenticated: false, authLoading: false });
          return;
        }
      }
    } catch {
      // Desktop unreachable
    }
    set({ authLoading: false });
    get().fetchProviderKeys();
  },

  login: async (input: GQL.LoginInput) => {
    const { user } = await fetchJson<{ user: GQL.MeResponse }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
    set({ user, authenticated: true });
    const modules = (user.enrolledModules ?? []) as import("./modules-slice.js").ModuleId[];
    get().syncEnrolledModules(modules);
    trackEvent("auth.login");
    get().fetchSubscription();
    get().fetchLlmQuota();
    // Warm entity-cache with toolSpecs, then fetch presets and available tools
    warmToolSpecs().catch(() => {}).then(() => {
      get().fetchSurfaces();
      get().fetchRunProfiles();
      get().fetchAvailableTools();
    });
    get().fetchProviderKeys();
    if (modules.includes("GLOBAL_ECOMMERCE_SELLER")) {
      get().fetchShops();
    }
  },

  register: async (input: GQL.RegisterInput) => {
    const { user } = await fetchJson<{ user: GQL.MeResponse }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
    set({ user, authenticated: true });
    const modules = (user.enrolledModules ?? []) as import("./modules-slice.js").ModuleId[];
    get().syncEnrolledModules(modules);
    trackEvent("auth.register");
    get().fetchSubscription();
    get().fetchLlmQuota();
    // Warm entity-cache with toolSpecs, then fetch presets and available tools
    warmToolSpecs().catch(() => {}).then(() => {
      get().fetchSurfaces();
      get().fetchRunProfiles();
      get().fetchAvailableTools();
    });
    get().fetchProviderKeys();
    if (modules.includes("GLOBAL_ECOMMERCE_SELLER")) {
      get().fetchShops();
    }
  },

  logout: () => {
    fetchVoid("/auth/logout", { method: "POST" });
    trackEvent("auth.logout");
    set({ user: null, authenticated: false });
    get().resetSubscription();
    get().resetSurfaces();
    get().resetRunProfiles();
    get().resetAvailableTools();
    get().fetchProviderKeys();
  },

  clearAuth: () => {
    set({ user: null, authenticated: false });
    get().resetSubscription();
    get().resetSurfaces();
    get().resetRunProfiles();
    get().resetAvailableTools();
    get().fetchProviderKeys();
  },
});
