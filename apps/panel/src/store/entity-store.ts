import { applySnapshot, applyPatch, flow, getEnv, types, type IAnyModelType, type Instance, type IJsonPatch, type IStateTreeNode } from "mobx-state-tree";
import { RootStoreModel } from "@rivonclaw/core/models";
import {
  UserModel,
  SurfaceModel,
  RunProfileModel,
  ShopModel,
  AdsAdvertiserModel,
  AdsStoreBindingModel,
  WmsAccountModel,
  WarehouseModel,
  ShopWarehouseModel,
  InventoryGoodModel,
  ProviderKeyModel,
  LLMProviderModel,
  ChannelAccountModel,
  ChannelManagerModel,
  MobilePairingModel,
  MobileManagerModel,
} from "./models/index.js";
import { PaymentModel } from "@rivonclaw/core/models";
import { EcommerceInventoryModel } from "./models/EcommerceInventoryModel.js";
import { CustomerServiceWorkspaceModel } from "./models/CustomerServiceWorkspaceModel.js";
import { CREATE_SURFACE_MUTATION } from "../api/surfaces-queries.js";
import { CREATE_RUN_PROFILE_MUTATION } from "../api/run-profiles-queries.js";
import {
  AFFILIATE_ML_INSIGHT_SUMMARIES_QUERY,
  SHOPS_QUERY,
  SHOP_QUERY,
  PLATFORM_APPS_QUERY,
  INITIATE_TIKTOK_OAUTH_MUTATION,
  PRESET_SKILLS_QUERY,
} from "../api/shops-queries.js";
import {
  ADS_ADVERTISERS_QUERY,
  ADS_STORE_ACCESSES_QUERY,
  INITIATE_TIKTOK_ADS_OAUTH_MUTATION,
} from "../api/ads-queries.js";
import {
  READ_WMS_ACCOUNTS_QUERY,
  READ_WAREHOUSES_QUERY,
  READ_INVENTORY_GOODS_QUERY,
} from "../api/inventory-queries.js";
import { GENERATE_PAIRING_CODE, WAIT_FOR_PAIRING, GET_INSTALL_URL } from "../api/pairing-queries.js";
import {
  BILLING_OVERVIEW_QUERY,
  BILLING_PLAN_DEFINITIONS_QUERY,
  CANCEL_BILLING_SUBSCRIPTION_MUTATION,
  CREATE_STRIPE_BILLING_PORTAL_SESSION_MUTATION,
  READ_PAYMENTS_QUERY,
  REFRESH_PAYMENT_MUTATION,
  START_BILLING_SUBSCRIPTION_MUTATION,
} from "../api/billing-queries.js";
import { fetchJson, invalidateCache } from "../api/client.js";
import { syncOfficialPresetSkills } from "../api/official-preset-skills.js";
import { trackEvent } from "../api/settings.js";
import type { ProviderKeyEntry, ProviderKeyAuthType } from "@rivonclaw/core";
import { API, clientPath } from "@rivonclaw/core/api-contract";
import { panelEventBus } from "../lib/event-bus.js";
import { gql } from "@apollo/client/core";
import type { PanelStoreEnv } from "./types.js";

/**
 * ToolSpecs query — fires through Desktop proxy which ingests the response
 * into the MST store. Panel receives updates via SSE patches.
 */
const TOOL_SPECS_SYNC_QUERY = gql`
  query ToolSpecsSync {
    toolSpecs {
      id name category displayName description supportsPersistResult resultSchema surfaces runProfiles
      graphqlOperation operationType
      parameters { name type description graphqlVar required defaultValue enumValues isList children { name type description graphqlVar required defaultValue enumValues isList children { name type description graphqlVar required defaultValue enumValues isList } } }
      contextBindings { paramName contextField }
      restMethod restEndpoint restContentType supportedPlatforms prune
    }
  }
`;

function stripTypename<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripTypename) as T;
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (key !== "__typename") result[key] = stripTypename(item);
    }
    return result as T;
  }
  return value;
}

type AffiliateMlInsightModelScope = "user" | "shop";

const AffiliateMlInsightRowModel = types.model("AffiliateMlInsightRow", {
  key: types.identifier,
  subjectKey: types.string,
  kind: types.enumeration(["user", "shop"]),
  shopId: types.maybe(types.string),
  modelScope: types.enumeration(["user", "shop"]),
  summary: types.maybeNull(types.frozen()),
  failed: types.optional(types.boolean, false),
});

function affiliateMlInsightSubjectKey(shopId?: string | null): string {
  return shopId ? `shop:${shopId}` : "user";
}

function normalizeAffiliateMlModelScope(value: unknown, fallback: AffiliateMlInsightModelScope): AffiliateMlInsightModelScope {
  return String(value ?? fallback).toLowerCase() === "shop" ? "shop" : "user";
}

function cleanRecipientLookupPart(value: string): string {
  return value.trim();
}

function recipientAliasFromAccount(
  account: {
    channelId?: string;
    accountId?: string;
    recipients?: { labels?: Record<string, string> } | null;
  } | null | undefined,
  channelId: string,
  accountId: string,
  recipientId: string,
): string | null {
  if (account?.channelId !== undefined && cleanRecipientLookupPart(account.channelId) !== channelId) return null;
  if (cleanRecipientLookupPart(account?.accountId ?? "") !== accountId) return null;
  const label = account?.recipients?.labels?.[recipientId]?.trim();
  return label || null;
}

/**
 * Panel-specific extension of RootStoreModel with CRUD mutation actions,
 * auth/session management, module enrollment, and entity sync.
 * Mutations fire GraphQL via `getEnv(self).apolloClient`. The response flows
 * through Desktop proxy -> ingestGraphQLResponse -> MST -> SSE -> Panel auto-updates,
 * so we do NOT manually update the store here.
 *
 * Entity-level actions (update, delete) live on per-model files in ./models/.
 * RootStore retains session-level actions and create operations (where no instance exists yet).
 */
const PanelRootStoreModel: IAnyModelType = RootStoreModel.props({
  currentUser: types.maybeNull(UserModel),
  surfaces: types.optional(types.array(SurfaceModel), []),
  runProfiles: types.optional(types.array(RunProfileModel), []),
  shops: types.optional(types.array(ShopModel), []),
  adsAdvertisers: types.optional(types.array(AdsAdvertiserModel), []),
  adsStoreBindings: types.optional(types.array(AdsStoreBindingModel), []),
  wmsAccounts: types.optional(types.array(WmsAccountModel), []),
  warehouses: types.optional(types.array(WarehouseModel), []),
  shopWarehouses: types.optional(types.array(ShopWarehouseModel), []),
  inventoryGoods: types.optional(types.array(InventoryGoodModel), []),
  providerKeys: types.optional(types.array(ProviderKeyModel), []),
  channelAccounts: types.optional(types.array(ChannelAccountModel), []),
  mobilePairings: types.optional(types.array(MobilePairingModel), []),
  llmManager: types.optional(LLMProviderModel, {}),
  channelManager: types.optional(ChannelManagerModel, {}),
  mobileManager: types.optional(MobileManagerModel, {}),
  ecommerceInventory: types.optional(EcommerceInventoryModel, {}),
  customerServiceWorkspace: types.optional(CustomerServiceWorkspaceModel, {}),
  activeCheckout: types.maybeNull(PaymentModel),
  checkoutScopeId: types.maybeNull(types.string),
  paymentInFlight: types.optional(types.boolean, false),
  checkoutError: types.maybeNull(types.string),
  checkoutNotice: types.maybeNull(types.string),
  affiliateMlInsightRows: types.optional(types.array(AffiliateMlInsightRowModel), []),
  affiliateMlInsightsLoading: types.optional(types.boolean, false),
  affiliateMlInsightsError: types.maybeNull(types.string),
  affiliateMlInsightsLoadedAt: types.maybeNull(types.number),
}).views((self) => ({
  affiliateMlInsightRow(subjectKey: string, modelScope: AffiliateMlInsightModelScope) {
    return self.affiliateMlInsightRows.find((row) => row.subjectKey === subjectKey && row.modelScope === modelScope) ?? null;
  },
  affiliateMlInsightRowsForSubject(subjectKey: string) {
    return self.affiliateMlInsightRows.filter((row) => row.subjectKey === subjectKey);
  },
  channelRecipientAlias(channelIdRaw: string, accountIdRaw: string, recipientIdRaw: string): string | null {
    const channelId = cleanRecipientLookupPart(channelIdRaw);
    const accountId = cleanRecipientLookupPart(accountIdRaw);
    const recipientId = cleanRecipientLookupPart(recipientIdRaw);
    if (!channelId || !accountId || !recipientId) return null;

    for (const account of self.channelAccounts) {
      const alias = recipientAliasFromAccount(account, channelId, accountId, recipientId);
      if (alias) return alias;
    }

    const snapshotAccounts = self.channelManager.statusSnapshot?.channelAccounts?.[channelId] ?? [];
    for (const account of snapshotAccounts) {
      const alias = recipientAliasFromAccount({ ...account, channelId }, channelId, accountId, recipientId);
      if (alias) return alias;
    }

    return null;
  },
})).actions((self) => {
  const client = () => getEnv<PanelStoreEnv>(self).apolloClient;

  return {
    // ── Auth actions ──

    /** Initialize the session: check Desktop auth state, validate via ME query if needed, trigger entity sync. */
    initSession: flow(function* () {
      try {
        const session: { authenticated: boolean; tokenPresent?: boolean } = yield fetchJson(clientPath(API["auth.session"]));
        if (session.authenticated || session.tokenPresent) {
          yield Promise.all([
            client().query({ query: BILLING_OVERVIEW_QUERY, fetchPolicy: "network-only" }),
            client().query({ query: BILLING_PLAN_DEFINITIONS_QUERY, fetchPolicy: "network-only" }),
            client().query({ query: READ_PAYMENTS_QUERY, fetchPolicy: "network-only" }),
          ]).catch(() => {});
          yield Promise.all([
            client().query({ query: ADS_ADVERTISERS_QUERY, fetchPolicy: "network-only" }),
            client().query({ query: ADS_STORE_ACCESSES_QUERY, fetchPolicy: "network-only" }),
            client().query({ query: PLATFORM_APPS_QUERY, fetchPolicy: "network-only" }),
            client().query({ query: READ_WMS_ACCOUNTS_QUERY, variables: { input: {} }, fetchPolicy: "network-only" }),
            client().query({ query: READ_WAREHOUSES_QUERY, variables: { input: {} }, fetchPolicy: "network-only" }),
            client().query({ query: READ_INVENTORY_GOODS_QUERY, variables: { input: {} }, fetchPolicy: "network-only" }),
          ]).catch(() => {});
          yield (self as any).fetchShops().catch(() => {});
          yield syncOfficialPresetSkills("safe").catch(() => {});
          return;
        }
      } catch {
        // Desktop unreachable
      }
    }),

    login: flow(function* (input: { email: string; password: string; captchaToken?: string; captchaAnswer?: string }) {
      yield fetchJson(clientPath(API["auth.login"]), {
        method: "POST",
        body: JSON.stringify(input),
      });
      yield syncOfficialPresetSkills("safe").catch(() => {});
      trackEvent("auth.login");
    }),

    register: flow(function* (input: { email: string; password: string; name?: string | null; captchaToken?: string; captchaAnswer?: string; inviteCode?: string | null }) {
      yield fetchJson(clientPath(API["auth.register"]), {
        method: "POST",
        body: JSON.stringify(input),
      });
      yield syncOfficialPresetSkills("safe").catch(() => {});
      trackEvent("auth.register");
    }),

    logout: flow(function* () {
      yield fetch(API["auth.logout"].path, { method: "POST" }).catch(() => {});
      trackEvent("auth.logout");
      // Desktop clears user in MST -> SSE -> Panel auto-updates
    }),

    clearAuth() {
      // Called when auth-expired event fires (401 from API)
      // Desktop will have already cleared the user via SSE, but clear locally for safety
      (self as any).currentUser = null;
      self.affiliateMlInsightRows.clear();
      self.affiliateMlInsightsLoading = false;
      self.affiliateMlInsightsError = null;
      self.affiliateMlInsightsLoadedAt = null;
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
      const result: ProviderKeyEntry = yield fetchJson<ProviderKeyEntry>(clientPath(API["providerKeys.create"]), {
        method: "POST",
        body: JSON.stringify(data),
      });
      invalidateCache("models");
      return result;
    }),

    // ── OAuth flow mutations (REST to Desktop) ──

    startOAuthFlow: flow(function* (provider: string) {
      const result: { ok: boolean; email?: string; tokenPreview?: string; providerKeyId?: string; provider?: string; manualMode?: boolean; authUrl?: string; flowId?: string } =
        yield fetchJson<{ ok: boolean; email?: string; tokenPreview?: string; providerKeyId?: string; provider?: string; manualMode?: boolean; authUrl?: string; flowId?: string }>(
          clientPath(API["oauth.start"]),
          { method: "POST", body: JSON.stringify({ provider }) },
        );
      return result;
    }),

    completeManualOAuth: flow(function* (provider: string, callbackUrl: string) {
      const result: { email?: string; tokenPreview?: string } =
        yield fetchJson<{ email?: string; tokenPreview?: string }>(clientPath(API["oauth.manualComplete"]), {
          method: "POST",
          body: JSON.stringify({ provider, callbackUrl }),
        });
      return result;
    }),

    pollOAuthStatus: flow(function* (flowId: string) {
      const result: { status: "pending" | "completed" | "failed"; tokenPreview?: string; email?: string; error?: string } =
        yield fetchJson<{ status: "pending" | "completed" | "failed"; tokenPreview?: string; email?: string; error?: string }>(
          clientPath(API["oauth.status"]) + `?flowId=${encodeURIComponent(flowId)}`,
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
          clientPath(API["oauth.save"]),
          { method: "POST", body: JSON.stringify({ provider, ...options }) },
        );
      invalidateCache("models");
      return result;
    }),

    // ── Shops / ecommerce mutations ──

    initiateTikTokOAuth: flow(function* (platformAppId: string) {
      const result = yield client().mutate({
        mutation: INITIATE_TIKTOK_OAUTH_MUTATION,
        variables: { platformAppId },
      });
      return result.data!.initiateTikTokOAuth as { authUrl: string; state: string };
    }),

    initiateTikTokAdsOAuth: flow(function* () {
      const result = yield client().mutate({
        mutation: INITIATE_TIKTOK_ADS_OAUTH_MUTATION,
      });
      return result.data!.initiateTikTokAdsOAuth as { authUrl: string; state: string };
    }),

    /** Fetch the authoritative shop list and replace the Panel cache. */
    fetchShops: flow(function* () {
      const result = yield client().query({ query: SHOPS_QUERY, fetchPolicy: "network-only" });
      applySnapshot(self.shops, stripTypename(result.data?.shops ?? []) as any);
      const shopIds = ((result.data?.shops ?? []) as Array<{ id?: string | null }>)
        .map((shop) => shop.id)
        .filter((shopId): shopId is string => Boolean(shopId));
      yield (self as any).fetchAffiliateMlInsights({ shopIds }).catch(() => {});
    }),

    fetchAffiliateMlInsights: flow(function* (input?: { shopIds?: string[] }) {
      if (!(self as any).currentUser) {
        self.affiliateMlInsightRows.clear();
        self.affiliateMlInsightsError = null;
        self.affiliateMlInsightsLoadedAt = null;
        return;
      }

      const shopIds = Array.from(
        new Set(
          (input?.shopIds ?? self.shops.map((shop) => shop.id))
            .map((shopId) => shopId.trim())
            .filter(Boolean),
        ),
      );
      self.affiliateMlInsightsLoading = true;
      self.affiliateMlInsightsError = null;
      try {
        const result = yield client().query({
          query: AFFILIATE_ML_INSIGHT_SUMMARIES_QUERY,
          variables: { input: { shopIds } },
          fetchPolicy: "network-only",
        });
        const summaries = (result.data?.affiliateMlInsightSummaries ?? []) as Array<Record<string, unknown>>;
        const rows = summaries.map((summary) => {
          const shopId = typeof summary.shopId === "string" && summary.shopId ? summary.shopId : undefined;
          const modelScope = normalizeAffiliateMlModelScope(summary.modelScope, shopId ? "shop" : "user");
          const subjectKey = affiliateMlInsightSubjectKey(shopId);
          return {
            key: `${subjectKey}:${modelScope}`,
            subjectKey,
            kind: shopId ? "shop" : "user",
            shopId,
            modelScope,
            summary: stripTypename(summary),
            failed: false,
          };
        });
        self.affiliateMlInsightRows.replace(rows);
        self.affiliateMlInsightsLoadedAt = Date.now();
      } catch (err) {
        self.affiliateMlInsightsError = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        self.affiliateMlInsightsLoading = false;
      }
    }),

    /** Fire ads advertisers query to populate MST via Desktop proxy. */
    fetchAdsAdvertisers: flow(function* () {
      yield client().query({ query: ADS_ADVERTISERS_QUERY, fetchPolicy: "network-only" });
    }),

    /** Fire ads store access query to populate MST via Desktop proxy. */
    fetchAdsStoreAccesses: flow(function* () {
      yield client().query({
        query: ADS_STORE_ACCESSES_QUERY,
        fetchPolicy: "network-only",
      });
    }),

    /** Fire single shop query to refresh one shop via Desktop proxy. */
    fetchShop: flow(function* (shopId: string) {
      yield client().query({ query: SHOP_QUERY, variables: { id: shopId }, fetchPolicy: "network-only" });
    }),

    /** Fire platform apps query to populate MST via Desktop proxy. */
    fetchPlatformApps: flow(function* () {
      yield client().query({ query: PLATFORM_APPS_QUERY, fetchPolicy: "network-only" });
    }),

    // ── Tool specs refresh ──

    /** Re-fetch toolSpecs from backend via Desktop proxy. */
    refreshToolSpecs: flow(function* () {
      yield client().query({ query: TOOL_SPECS_SYNC_QUERY, fetchPolicy: "network-only" });
    }),

    /**
     * Re-fetch account/shop billing overview from backend via Desktop proxy.
     * Usage changes whenever the user makes LLM or CS calls, so Panel surfaces
     * that display it (e.g. Account page) should call this on mount and on
     * window visibility changes to keep the user-visible numbers fresh.
     */
    refreshBilling: flow(function* () {
      yield client().query({ query: BILLING_OVERVIEW_QUERY, fetchPolicy: "network-only" });
    }),

    refreshPlanDefinitions: flow(function* () {
      yield client().query({ query: BILLING_PLAN_DEFINITIONS_QUERY, fetchPolicy: "network-only" });
    }),

    readPayments: flow(function* (input?: { id?: string; merchantOrderId?: string }) {
      yield client().query({
        query: READ_PAYMENTS_QUERY,
        variables: input ? { input } : {},
        fetchPolicy: "network-only",
      });
    }),

    /**
     * Canonical follow-up after a payment/subscription state transition.
     * Payment success changes both entitlement decisions and payment history;
     * keep this paired so checkout surfaces do not forget one side.
     */
    refreshBillingAfterPayment: flow(function* () {
      yield Promise.all([
        client().query({ query: BILLING_OVERVIEW_QUERY, fetchPolicy: "network-only" }),
        client().query({ query: READ_PAYMENTS_QUERY, variables: {}, fetchPolicy: "network-only" }),
      ]);
    }),

    startBillingSubscription: flow(function* (input: {
      planId: string;
      scopeType: string;
      scopeId: string;
      provider: string;
      successUrl?: string;
      cancelUrl?: string;
    }) {
      self.paymentInFlight = true;
      self.activeCheckout = null;
      self.checkoutScopeId = input.scopeId;
      self.checkoutError = null;
      self.checkoutNotice = null;
      try {
        const result = yield client().mutate({
          mutation: START_BILLING_SUBSCRIPTION_MUTATION,
          variables: { input },
        });
        const subscriptionResult = result.data?.startBillingSubscription;
        const payment = subscriptionResult?.payment;
        self.activeCheckout = payment ? stripTypename(payment) : null;
        self.checkoutScopeId = input.scopeId;
        if (subscriptionResult?.action === "SUBSCRIPTION_RESUMED" || subscriptionResult?.action === "ALREADY_ACTIVE") {
          self.checkoutNotice = subscriptionResult.action;
          yield (self as any).refreshBillingAfterPayment();
        }
        return subscriptionResult;
      } catch (err) {
        self.checkoutError = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        self.paymentInFlight = false;
      }
    }),

    refreshPayment: flow(function* (paymentId: string) {
      self.checkoutError = null;
      try {
        const result = yield client().mutate({
          mutation: REFRESH_PAYMENT_MUTATION,
          variables: { paymentId },
        });
        const payment = result.data?.refreshPayment;
        if (payment && self.activeCheckout?.id === payment.id) {
          self.activeCheckout = stripTypename(payment);
        }
        return payment;
      } catch (err) {
        self.checkoutError = err instanceof Error ? err.message : String(err);
        throw err;
      }
    }),

    cancelBillingSubscriptionAtPeriodEnd: flow(function* (input: {
      product: string;
      scopeType: string;
      scopeId: string;
    }) {
      yield client().mutate({
        mutation: CANCEL_BILLING_SUBSCRIPTION_MUTATION,
        variables: { input },
      });
      yield (self as any).refreshBillingAfterPayment();
    }),

    createStripeBillingPortalSession: flow(function* (input: {
      product: string;
      scopeType: string;
      scopeId: string;
    }) {
      const result = yield client().mutate({
        mutation: CREATE_STRIPE_BILLING_PORTAL_SESSION_MUTATION,
        variables: { input },
      });
      return result.data?.createStripeBillingPortalSession?.url ?? null;
    }),

    setCheckoutError(message: string | null, scopeId?: string | null) {
      if (scopeId !== undefined) self.checkoutScopeId = scopeId;
      self.checkoutError = message;
    },

    setCheckoutNotice(message: string | null, scopeId?: string | null) {
      if (scopeId !== undefined) self.checkoutScopeId = scopeId;
      self.checkoutNotice = message;
    },

    clearActiveCheckout() {
      self.activeCheckout = null;
      self.checkoutScopeId = null;
      self.checkoutError = null;
      self.checkoutNotice = null;
    },

    // ── Surface mutations ──

    createSurface: flow(function* (input: {
      name: string;
      description?: string;
      allowedToolIds: string[];
    }) {
      const result = yield client().mutate({
        mutation: CREATE_SURFACE_MUTATION,
        variables: { input },
      });
      return result.data!.createSurface;
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

    // ── Preset skills ──

    /** Fetch preset skills from backend. Returns { key: contentOrZipUrl } map or null. */
    fetchPresetSkills: flow(function* (serviceIds: string[]) {
      const result = yield client().query({
        query: PRESET_SKILLS_QUERY,
        variables: { serviceIds },
        fetchPolicy: "network-only",
      });
      const raw = result.data?.presetSkills as string | null;
      if (!raw) return null;
      return JSON.parse(raw) as Record<string, string>;
    }),

    // ── Mobile pairing mutations (temporary data, not stored in MST) ──

    generateMobilePairingCode: flow(function* (desktopDeviceId: string) {
      const result = yield client().mutate({
        mutation: GENERATE_PAIRING_CODE,
        variables: { desktopDeviceId },
      });
      const data = result.data?.generatePairingCode;
      return { code: data?.code, qrUrl: data?.qrUrl } as { code?: string; qrUrl?: string };
    }),

    waitForPairing: flow(function* (code: string) {
      const result = yield client().query({
        query: WAIT_FOR_PAIRING,
        variables: { code },
        fetchPolicy: "network-only",
      });
      return (result.data?.waitForPairing ?? { paired: false }) as {
        paired: boolean;
        pairingId?: string;
        accessToken?: string;
        relayUrl?: string;
        desktopDeviceId?: string;
        mobileDeviceId?: string;
        reason?: string;
      };
    }),

    getInstallUrl: flow(function* () {
      const result = yield client().query({
        query: GET_INSTALL_URL,
        fetchPolicy: "network-only",
      });
      return { installUrl: result.data?.mobileInstallUrl } as { installUrl?: string };
    }),

    registerMobilePairing: flow(function* (body: {
      pairingId?: string;
      desktopDeviceId: string;
      accessToken: string;
      relayUrl: string;
      mobileDeviceId?: string;
    }) {
      const response: { data?: { registerPairing: { success: boolean; pairingId: string } } | null; errors?: Array<{ message: string }> } =
        yield fetchJson(clientPath(API["mobile.graphql"]), {
          method: "POST",
          body: JSON.stringify({
            query: `mutation RegisterPairing($input: RegisterPairingInput!) {
              registerPairing(input: $input) {
                success
                pairingId
              }
            }`,
            variables: { input: body },
          }),
        });
      if (response.errors?.length) {
        return { error: response.errors[0]!.message } as { success?: boolean; error?: string };
      }
      return { success: response.data?.registerPairing?.success } as { success?: boolean; error?: string };
    }),

  };
});

// MST's .props() override doesn't propagate to Instance<> type inference.
// Explicitly declare Panel-extended entity types so pages see the actions.
interface PanelEntityOverrides {
  readonly currentUser: Instance<typeof UserModel> | null;
  readonly surfaces: Instance<typeof SurfaceModel>[];
  readonly runProfiles: Instance<typeof RunProfileModel>[];
  readonly shops: Instance<typeof ShopModel>[];
  readonly adsAdvertisers: Instance<typeof AdsAdvertiserModel>[];
  readonly adsStoreBindings: Instance<typeof AdsStoreBindingModel>[];
  readonly wmsAccounts: Instance<typeof WmsAccountModel>[];
  readonly warehouses: Instance<typeof WarehouseModel>[];
  readonly shopWarehouses: Instance<typeof ShopWarehouseModel>[];
  readonly inventoryGoods: Instance<typeof InventoryGoodModel>[];
  readonly providerKeys: Instance<typeof ProviderKeyModel>[];
  readonly channelAccounts: Instance<typeof ChannelAccountModel>[];
  readonly mobilePairings: Instance<typeof MobilePairingModel>[];
  readonly channelManager: Instance<typeof ChannelManagerModel>;
  readonly llmManager: Instance<typeof LLMProviderModel>;
  readonly mobileManager: Instance<typeof MobileManagerModel>;
  readonly ecommerceInventory: Instance<typeof EcommerceInventoryModel>;
  readonly customerServiceWorkspace: Instance<typeof CustomerServiceWorkspaceModel>;
  readonly activeCheckout: Instance<typeof PaymentModel> | null;
  readonly checkoutScopeId: string | null;
  readonly paymentInFlight: boolean;
  readonly checkoutError: string | null;
  readonly checkoutNotice: string | null;
  readonly affiliateMlInsightRows: Instance<typeof AffiliateMlInsightRowModel>[];
  readonly affiliateMlInsightsLoading: boolean;
  readonly affiliateMlInsightsError: string | null;
  readonly affiliateMlInsightsLoadedAt: number | null;
  affiliateMlInsightRow(subjectKey: string, modelScope: AffiliateMlInsightModelScope): Instance<typeof AffiliateMlInsightRowModel> | null;
  affiliateMlInsightRowsForSubject(subjectKey: string): Instance<typeof AffiliateMlInsightRowModel>[];
  channelRecipientAlias(channelId: string, accountId: string, recipientId: string): string | null;
  fetchAffiliateMlInsights(input?: { shopIds?: string[] }): Promise<void>;
  startBillingSubscription(input: {
    planId: string;
    scopeType: string;
    scopeId: string;
    provider: string;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<{ action: string; payment?: Instance<typeof PaymentModel> | null } | null>;
  refreshBillingAfterPayment(): Promise<void>;
  cancelBillingSubscriptionAtPeriodEnd(input: { product: string; scopeType: string; scopeId: string }): Promise<void>;
  createStripeBillingPortalSession(input: { product: string; scopeType: string; scopeId: string }): Promise<string | null>;
  initiateTikTokAdsOAuth(): Promise<{ authUrl: string; state: string }>;
  fetchAdsAdvertisers(): Promise<void>;
  fetchAdsStoreAccesses(): Promise<void>;
}

interface PanelRootActions {
  initSession(): Promise<void>;
  login(input: { email: string; password: string; captchaToken?: string; captchaAnswer?: string }): Promise<void>;
  register(input: { email: string; password: string; name?: string | null; captchaToken?: string; captchaAnswer?: string; inviteCode?: string | null }): Promise<void>;
  logout(): Promise<void>;
  clearAuth(): void;
  fetchShops(): Promise<void>;
  fetchPlatformApps(): Promise<void>;
  refreshToolSpecs(): Promise<void>;
  createProviderKey(input: any): Promise<any>;
  startOAuthFlow(input: any): Promise<any>;
  pollOAuthStatus(input: any): Promise<any>;
  completeManualOAuth(...args: any[]): Promise<any>;
  saveOAuthFlow(...args: any[]): Promise<any>;
  initiateTikTokOAuth(input?: any): Promise<any>;
  initiateTikTokAdsOAuth(input?: unknown): Promise<{ authUrl: string; state: string }>;
  generateMobilePairingCode(input?: any): Promise<any>;
  waitForPairing(input: any): Promise<any>;
  registerMobilePairing(input: any): Promise<any>;
  getInstallUrl(input?: any): Promise<any>;
  refreshBilling(): Promise<void>;
  refreshPlanDefinitions(): Promise<void>;
  readPayments(): Promise<void>;
  refreshPayment(...args: any[]): Promise<any>;
  setCheckoutError(message: string | null, scopeId?: string | null): void;
  clearActiveCheckout(): void;
  createRunProfile(input: unknown): Promise<unknown>;
  createSurface(input: unknown): Promise<unknown>;
}

export type PanelRootStore =
  Omit<Instance<typeof RootStoreModel>, keyof PanelEntityOverrides> &
  PanelEntityOverrides &
  PanelRootActions &
  IStateTreeNode;

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
) as unknown as PanelRootStore;

let unsubscribeSnapshot: (() => void) | null = null;
let unsubscribePatch: (() => void) | null = null;

/**
 * Subscribe to Desktop's unified event stream and sync store state.
 * Safe to call multiple times -- re-subscribes if already connected.
 *
 * On every (re)connect of the underlying shared EventSource, Desktop
 * re-emits `entity-snapshot` so the store self-heals without client logic.
 */
export function connectEntityStore(): void {
  disconnectEntityStore();

  unsubscribeSnapshot = panelEventBus.subscribe("entity-snapshot", (data) => {
    applySnapshot(entityStore, data as Parameters<typeof applySnapshot>[1]);
  });

  unsubscribePatch = panelEventBus.subscribe("entity-patch", (data) => {
    applyPatch(entityStore, data as IJsonPatch[]);
  });
}

/**
 * Unsubscribe from the shared event stream. Call on logout or unmount.
 * Does NOT close the underlying EventSource — other subscribers may
 * still need it (this is the point of the consolidation).
 */
export function disconnectEntityStore(): void {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }
  if (unsubscribePatch) {
    unsubscribePatch();
    unsubscribePatch = null;
  }
}
