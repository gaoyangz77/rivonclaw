import { GQL } from "@rivonclaw/core";
import type { StateCreator } from "zustand";
import { ME_QUERY } from "../../api/auth-queries.js";
import { getClient } from "../../api/apollo-client.js";
import { trackEvent } from "../../api/settings.js";
import { fetchJson, fetchVoid } from "../../api/client.js";
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
        get().syncEnrolledModules((session.user.enrolledModules ?? []) as import("./modules-slice.js").ModuleId[]);
        get().fetchSubscription();
        get().fetchLlmQuota();
        get().fetchSurfaces();
        get().fetchRunProfiles();
        get().fetchAvailableTools();
        get().fetchProviderKeys();
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
            get().syncEnrolledModules((data.me.enrolledModules ?? []) as import("./modules-slice.js").ModuleId[]);
            get().fetchSubscription();
            get().fetchLlmQuota();
            get().fetchSurfaces();
            get().fetchRunProfiles();
            get().fetchAvailableTools();
            get().fetchProviderKeys();
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
    get().syncEnrolledModules((user.enrolledModules ?? []) as import("./modules-slice.js").ModuleId[]);
    trackEvent("auth.login");
    get().fetchSubscription();
    get().fetchLlmQuota();
    get().fetchSurfaces();
    get().fetchRunProfiles();
    get().fetchAvailableTools();
    get().fetchProviderKeys();
  },

  register: async (input: GQL.RegisterInput) => {
    const { user } = await fetchJson<{ user: GQL.MeResponse }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
    set({ user, authenticated: true });
    get().syncEnrolledModules((user.enrolledModules ?? []) as import("./modules-slice.js").ModuleId[]);
    trackEvent("auth.register");
    get().fetchSubscription();
    get().fetchLlmQuota();
    get().fetchSurfaces();
    get().fetchRunProfiles();
    get().fetchAvailableTools();
    get().fetchProviderKeys();
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
