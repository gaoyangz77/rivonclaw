import { applySnapshot, applyPatch, flow, getEnv, type Instance, type IJsonPatch } from "mobx-state-tree";
import { RootStoreModel } from "@rivonclaw/core/models";
import {
  CREATE_SURFACE_MUTATION,
  UPDATE_SURFACE_MUTATION,
  DELETE_SURFACE_MUTATION,
} from "../api/surfaces-queries.js";
import {
  CREATE_RUN_PROFILE_MUTATION,
  UPDATE_RUN_PROFILE_MUTATION,
  DELETE_RUN_PROFILE_MUTATION,
} from "../api/run-profiles-queries.js";
import {
  SHOPS_QUERY,
  PLATFORM_APPS_QUERY,
  MY_CREDITS_QUERY,
  CS_SESSION_STATS_QUERY,
  UPDATE_SHOP_MUTATION,
  DELETE_SHOP_MUTATION,
  INITIATE_TIKTOK_OAUTH_MUTATION,
  REDEEM_CREDIT_MUTATION,
} from "../api/shops-queries.js";
import { SURFACES_QUERY } from "../api/surfaces-queries.js";
import { RUN_PROFILES_QUERY } from "../api/run-profiles-queries.js";
import {
  ME_QUERY,
  ENROLL_MODULE_MUTATION,
  UNENROLL_MODULE_MUTATION,
  SUBSCRIPTION_STATUS_QUERY,
  LLM_QUOTA_STATUS_QUERY,
} from "../api/auth-queries.js";
import { fetchJson, invalidateCache } from "../api/client.js";
import { trackEvent } from "../api/settings.js";
import type { ProviderKeyEntry, ProviderKeyAuthType } from "@rivonclaw/core";
import type { ApolloClient } from "@apollo/client";
import { gql } from "@apollo/client/core";

/**
 * ToolSpecs query — fires through Desktop proxy which ingests the response
 * into the MST store. Panel receives updates via SSE patches.
 */
const TOOL_SPECS_SYNC_QUERY = gql`
  query ToolSpecsSync {
    toolSpecs {
      id name category displayName description surfaces runProfiles
      graphqlOperation operationType
      parameters { name type description graphqlVar required defaultValue enumValues }
      contextBindings { paramName contextField }
      restMethod restEndpoint restContentType supportedPlatforms
    }
  }
`;

interface PanelStoreEnv {
  apolloClient: ApolloClient;
}

/**
 * Panel-specific extension of RootStoreModel with CRUD mutation actions,
 * auth/session management, module enrollment, and entity sync.
 * Mutations fire GraphQL via `getEnv(self).apolloClient`. The response flows
 * through Desktop proxy -> ingestGraphQLResponse -> MST -> SSE -> Panel auto-updates,
 * so we do NOT manually update the store here.
 */
const PanelRootStoreModel = RootStoreModel.actions((self) => {
  const client = () => getEnv<PanelStoreEnv>(self).apolloClient;

  return {
    // ── Auth actions ──

    /** Initialize the session: check Desktop auth state, validate via ME query if needed, trigger entity sync. */
    initSession: flow(function* () {
      try {
        const session: { user: any; authenticated: boolean } = yield fetchJson("/auth/session");
        if (session.authenticated && session.user) {
          // User data already ingested into Desktop MST via auth-routes, arrives via SSE.
          // Trigger entity sync via Desktop proxy (toolSpecs + surfaces + runProfiles + subscription + quota)
          yield Promise.all([
              client().query({ query: TOOL_SPECS_SYNC_QUERY, fetchPolicy: "network-only" }),
              client().query({ query: SURFACES_QUERY, fetchPolicy: "network-only" }),
              client().query({ query: RUN_PROFILES_QUERY, fetchPolicy: "network-only" }),
              client().query({ query: SUBSCRIPTION_STATUS_QUERY, fetchPolicy: "network-only" }),
              client().query({ query: LLM_QUOTA_STATUS_QUERY, fetchPolicy: "network-only" }),
            ]).catch(() => {});
          // Trigger shops sync if ecommerce module enrolled
          const modules = (session.user.enrolledModules ?? []) as string[];
          if (modules.includes("GLOBAL_ECOMMERCE_SELLER")) {
            yield Promise.all([
              client().query({ query: SHOPS_QUERY, fetchPolicy: "network-only" }),
              client().query({ query: PLATFORM_APPS_QUERY, fetchPolicy: "network-only" }),
              client().query({ query: MY_CREDITS_QUERY, fetchPolicy: "network-only" }),
            ]).catch(() => {});
          }
          return;
        }
        if (session.authenticated && !session.user) {
          // Token exists but user not cached — validate via Desktop proxy ME query
          try {
            yield client().query({ query: ME_QUERY, fetchPolicy: "network-only" });
            // User data arrives via SSE after Desktop ingests ME_QUERY response.
            // Now trigger entity sync.
            yield Promise.all([
              client().query({ query: TOOL_SPECS_SYNC_QUERY, fetchPolicy: "network-only" }),
              client().query({ query: SURFACES_QUERY, fetchPolicy: "network-only" }),
              client().query({ query: RUN_PROFILES_QUERY, fetchPolicy: "network-only" }),
              client().query({ query: SUBSCRIPTION_STATUS_QUERY, fetchPolicy: "network-only" }),
              client().query({ query: LLM_QUOTA_STATUS_QUERY, fetchPolicy: "network-only" }),
            ]).catch(() => {});
            // Check enrolled modules from the now-populated user
            if ((self as any).currentUser?.enrolledModules?.includes("GLOBAL_ECOMMERCE_SELLER")) {
              yield Promise.all([
                client().query({ query: SHOPS_QUERY, fetchPolicy: "network-only" }),
                client().query({ query: PLATFORM_APPS_QUERY, fetchPolicy: "network-only" }),
                client().query({ query: MY_CREDITS_QUERY, fetchPolicy: "network-only" }),
              ]).catch(() => {});
            }
          } catch {
            // ME query failed — user is not authenticated
          }
          return;
        }
      } catch {
        // Desktop unreachable
      }
    }),

    login: flow(function* (input: { email: string; password: string; captchaToken?: string; captchaAnswer?: string }) {
      const { user }: { user: any } = yield fetchJson("/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
      // User data ingested by Desktop auth-routes -> MST -> SSE -> auto-update
      trackEvent("auth.login");
      // Trigger entity sync
      yield Promise.all([
        client().query({ query: TOOL_SPECS_SYNC_QUERY, fetchPolicy: "network-only" }),
        client().query({ query: SURFACES_QUERY, fetchPolicy: "network-only" }),
        client().query({ query: RUN_PROFILES_QUERY, fetchPolicy: "network-only" }),
        client().query({ query: SUBSCRIPTION_STATUS_QUERY, fetchPolicy: "network-only" }),
        client().query({ query: LLM_QUOTA_STATUS_QUERY, fetchPolicy: "network-only" }),
      ]).catch(() => {});
      const modules = (user.enrolledModules ?? []) as string[];
      if (modules.includes("GLOBAL_ECOMMERCE_SELLER")) {
        yield Promise.all([
          client().query({ query: SHOPS_QUERY, fetchPolicy: "network-only" }),
          client().query({ query: PLATFORM_APPS_QUERY, fetchPolicy: "network-only" }),
          client().query({ query: MY_CREDITS_QUERY, fetchPolicy: "network-only" }),
        ]).catch(() => {});
      }
    }),

    register: flow(function* (input: { email: string; password: string; name?: string | null; captchaToken?: string; captchaAnswer?: string }) {
      const { user }: { user: any } = yield fetchJson("/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      // User data ingested by Desktop auth-routes -> MST -> SSE -> auto-update
      trackEvent("auth.register");
      // Trigger entity sync
      yield Promise.all([
        client().query({ query: TOOL_SPECS_SYNC_QUERY, fetchPolicy: "network-only" }),
        client().query({ query: SURFACES_QUERY, fetchPolicy: "network-only" }),
        client().query({ query: RUN_PROFILES_QUERY, fetchPolicy: "network-only" }),
        client().query({ query: SUBSCRIPTION_STATUS_QUERY, fetchPolicy: "network-only" }),
        client().query({ query: LLM_QUOTA_STATUS_QUERY, fetchPolicy: "network-only" }),
      ]).catch(() => {});
      const modules = (user.enrolledModules ?? []) as string[];
      if (modules.includes("GLOBAL_ECOMMERCE_SELLER")) {
        yield Promise.all([
          client().query({ query: SHOPS_QUERY, fetchPolicy: "network-only" }),
          client().query({ query: PLATFORM_APPS_QUERY, fetchPolicy: "network-only" }),
          client().query({ query: MY_CREDITS_QUERY, fetchPolicy: "network-only" }),
        ]).catch(() => {});
      }
    }),

    logout: flow(function* () {
      yield fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      trackEvent("auth.logout");
      // Desktop clears user in MST -> SSE -> Panel auto-updates
    }),

    clearAuth() {
      // Called when auth-expired event fires (401 from API)
      // Desktop will have already cleared the user via SSE, but clear locally for safety
      (self as any).currentUser = null;
    },

    // ── Provider key mutations (REST to Desktop) ──

    createProviderKey: flow(function* (data: {
      provider: string;
      label: string;
      model: string;
      apiKey?: string;
      proxyUrl?: string;
      authType?: ProviderKeyAuthType;
      baseUrl?: string;
      customProtocol?: "openai" | "anthropic";
      customModelsJson?: string;
      inputModalities?: string[];
    }): Generator<Promise<ProviderKeyEntry>, ProviderKeyEntry, ProviderKeyEntry> {
      const result: ProviderKeyEntry = yield fetchJson<ProviderKeyEntry>("/provider-keys", {
        method: "POST",
        body: JSON.stringify(data),
      });
      invalidateCache("models");
      return result;
    }),

    updateProviderKey: flow(function* (
      id: string,
      fields: { label?: string; model?: string; proxyUrl?: string; baseUrl?: string; inputModalities?: string[]; customModelsJson?: string; apiKey?: string },
    ): Generator<Promise<ProviderKeyEntry>, ProviderKeyEntry, ProviderKeyEntry> {
      const result: ProviderKeyEntry = yield fetchJson<ProviderKeyEntry>("/provider-keys/" + id, {
        method: "PUT",
        body: JSON.stringify(fields),
      });
      invalidateCache("models");
      return result;
    }),

    activateProviderKey: flow(function* (id: string) {
      yield fetchJson("/provider-keys/" + id + "/activate", { method: "POST" });
      invalidateCache("models");
    }),

    deleteProviderKey: flow(function* (id: string) {
      yield fetchJson("/provider-keys/" + id, { method: "DELETE" });
      invalidateCache("models");
    }),

    refreshProviderModels: flow(function* (id: string): Generator<Promise<ProviderKeyEntry>, ProviderKeyEntry, ProviderKeyEntry> {
      const result: ProviderKeyEntry = yield fetchJson<ProviderKeyEntry>("/provider-keys/" + id + "/refresh-models", {
        method: "POST",
      });
      invalidateCache("models");
      return result;
    }),

    // ── OAuth flow mutations (REST to Desktop) ──

    startOAuthFlow: flow(function* (provider: string) {
      const result: { ok: boolean; email?: string; tokenPreview?: string; providerKeyId?: string; provider?: string; manualMode?: boolean; authUrl?: string; flowId?: string } =
        yield fetchJson<{ ok: boolean; email?: string; tokenPreview?: string; providerKeyId?: string; provider?: string; manualMode?: boolean; authUrl?: string; flowId?: string }>(
          "/oauth/start",
          { method: "POST", body: JSON.stringify({ provider }) },
        );
      return result;
    }),

    completeManualOAuth: flow(function* (provider: string, callbackUrl: string) {
      const result: { email?: string; tokenPreview?: string } =
        yield fetchJson<{ email?: string; tokenPreview?: string }>("/oauth/manual-complete", {
          method: "POST",
          body: JSON.stringify({ provider, callbackUrl }),
        });
      return result;
    }),

    pollOAuthStatus: flow(function* (flowId: string) {
      const result: { status: "pending" | "completed" | "failed"; tokenPreview?: string; email?: string; error?: string } =
        yield fetchJson<{ status: "pending" | "completed" | "failed"; tokenPreview?: string; email?: string; error?: string }>(
          `/oauth/status?flowId=${encodeURIComponent(flowId)}`,
          { method: "GET" },
        );
      return result;
    }),

    saveOAuthFlow: flow(function* (
      provider: string,
      options: { proxyUrl?: string; label?: string; model?: string },
    ) {
      const result: { providerKeyId: string; email?: string; provider: string } =
        yield fetchJson<{ ok: boolean; providerKeyId: string; email?: string; provider: string }>(
          "/oauth/save",
          { method: "POST", body: JSON.stringify({ provider, ...options }) },
        );
      invalidateCache("models");
      return result;
    }),

    // ── Module mutations ──

    enrollModule: flow(function* (moduleId: string) {
      yield client().mutate({
        mutation: ENROLL_MODULE_MUTATION,
        variables: { moduleId },
      });
      // Result ingested by Desktop via proxy -> MST -> SSE -> Panel auto-updates
      // Trigger shops sync if ecommerce module
      if (moduleId === "GLOBAL_ECOMMERCE_SELLER") {
        yield Promise.all([
          client().query({ query: SHOPS_QUERY, fetchPolicy: "network-only" }),
          client().query({ query: PLATFORM_APPS_QUERY, fetchPolicy: "network-only" }),
          client().query({ query: MY_CREDITS_QUERY, fetchPolicy: "network-only" }),
        ]).catch(() => {});
      }
    }),

    unenrollModule: flow(function* (moduleId: string) {
      yield client().mutate({
        mutation: UNENROLL_MODULE_MUTATION,
        variables: { moduleId },
      });
      // Result ingested by Desktop via proxy -> MST -> SSE -> Panel auto-updates
    }),

    // ── Shops / ecommerce mutations ──

    initiateTikTokOAuth: flow(function* (platformAppId: string) {
      const result = yield client().mutate({
        mutation: INITIATE_TIKTOK_OAUTH_MUTATION,
        variables: { platformAppId },
      });
      return result.data!.initiateTikTokOAuth as { authUrl: string; state: string };
    }),

    redeemCredit: flow(function* (creditId: string, shopId: string) {
      const result = yield client().mutate({
        mutation: REDEEM_CREDIT_MUTATION,
        variables: { creditId, shopId },
      });
      // Refresh credits after redemption
      yield client().query({ query: MY_CREDITS_QUERY, fetchPolicy: "network-only" }).catch(() => {});
      return result.data!.redeemCredit as boolean;
    }),

    /** Fire shops query to populate MST via Desktop proxy. */
    fetchShops: flow(function* () {
      yield client().query({ query: SHOPS_QUERY, fetchPolicy: "network-only" });
    }),

    /** Fire platform apps query to populate MST via Desktop proxy. */
    fetchPlatformApps: flow(function* () {
      yield client().query({ query: PLATFORM_APPS_QUERY, fetchPolicy: "network-only" });
    }),

    /** Fire credits query to populate MST via Desktop proxy. */
    fetchCredits: flow(function* () {
      yield client().query({ query: MY_CREDITS_QUERY, fetchPolicy: "network-only" });
    }),

    /** Fire session stats query for a specific shop. */
    fetchSessionStats: flow(function* (shopId: string) {
      yield client().query({
        query: CS_SESSION_STATS_QUERY,
        variables: { shopId },
        fetchPolicy: "network-only",
      });
    }),

    // ── Surface mutations ──

    createSurface: flow(function* (input: {
      name: string;
      description?: string;
      allowedToolIds: string[];
      allowedCategories: string[];
    }) {
      const result = yield client().mutate({
        mutation: CREATE_SURFACE_MUTATION,
        variables: { input },
      });
      return result.data!.createSurface;
    }),

    updateSurface: flow(function* (
      id: string,
      input: {
        name?: string;
        description?: string;
        allowedToolIds?: string[];
        allowedCategories?: string[];
      },
    ) {
      const result = yield client().mutate({
        mutation: UPDATE_SURFACE_MUTATION,
        variables: { id, input },
      });
      return result.data!.updateSurface;
    }),

    deleteSurface: flow(function* (id: string) {
      yield client().mutate({ mutation: DELETE_SURFACE_MUTATION, variables: { id } });
      const idx = self.surfaces.findIndex((s) => s.id === id);
      if (idx >= 0) self.surfaces.splice(idx, 1);
    }),

    // ── RunProfile mutations ──

    createRunProfile: flow(function* (input: {
      name: string;
      selectedToolIds: string[];
      surfaceId: string;
    }) {
      const result = yield client().mutate({
        mutation: CREATE_RUN_PROFILE_MUTATION,
        variables: { input },
      });
      return result.data!.createRunProfile;
    }),

    updateRunProfile: flow(function* (
      id: string,
      input: {
        name?: string;
        selectedToolIds?: string[];
        surfaceId?: string;
      },
    ) {
      const result = yield client().mutate({
        mutation: UPDATE_RUN_PROFILE_MUTATION,
        variables: { id, input },
      });
      return result.data!.updateRunProfile;
    }),

    deleteRunProfile: flow(function* (id: string) {
      yield client().mutate({ mutation: DELETE_RUN_PROFILE_MUTATION, variables: { id } });
      const idx = self.runProfiles.findIndex((p) => p.id === id);
      if (idx >= 0) self.runProfiles.splice(idx, 1);
    }),

    // ── Shop mutations ──

    updateShop: flow(function* (
      id: string,
      input: {
        shopName?: string;
        authStatus?: string;
        region?: string;
        services?: {
          customerService?: {
            enabled?: boolean;
            businessPrompt?: string;
            runProfileId?: string;
            csDeviceId?: string | null;
            csModelOverride?: string | null;
          };
        };
      },
    ) {
      const result = yield client().mutate({
        mutation: UPDATE_SHOP_MUTATION,
        variables: { id, input },
      });
      return result.data!.updateShop;
    }),

    deleteShop: flow(function* (id: string) {
      yield client().mutate({ mutation: DELETE_SHOP_MUTATION, variables: { id } });
      const idx = self.shops.findIndex((s) => s.id === id);
      if (idx >= 0) self.shops.splice(idx, 1);
    }),
  };
});

export type PanelRootStore = Instance<typeof PanelRootStoreModel>;

// Use a lazy getter so apolloClient is resolved at call time, not import time.
// getClient() throws if called before createApolloClient(), so we must defer.
import { getClient } from "../api/apollo-client.js";

export const entityStore = PanelRootStoreModel.create(
  {},
  {
    get apolloClient() {
      return getClient();
    },
  },
);

let eventSource: EventSource | null = null;

/**
 * Connect to Desktop's SSE endpoint and sync store state.
 * Safe to call multiple times -- reconnects if already connected.
 */
export function connectEntityStore(): void {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource("/api/store/stream");

  eventSource.addEventListener("snapshot", (e: MessageEvent) => {
    const snapshot = JSON.parse(e.data);
    applySnapshot(entityStore, snapshot);
  });

  eventSource.addEventListener("patch", (e: MessageEvent) => {
    const patches: IJsonPatch[] = JSON.parse(e.data);
    applyPatch(entityStore, patches);
  });

  // EventSource auto-reconnects on error. On reconnect, Desktop
  // re-sends a full snapshot, so the store self-heals.
  eventSource.onerror = (event: Event) => {
    console.error("[entity-store] SSE connection error -- browser will auto-reconnect", event);
  };
}

/**
 * Disconnect from the SSE stream. Call on logout or unmount.
 */
export function disconnectEntityStore(): void {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}
