import {
  onPatch,
  applySnapshot,
  getSnapshot,
  getChildType,
  typecheck,
  types,
  type IJsonPatch,
  type Instance,
} from "mobx-state-tree";
import { RootStoreModel, productCategoryCacheSnapshot, sanitizeForMst } from "@rivonclaw/core/models";
import type { GQL } from "@rivonclaw/core";
import type { AdsEntityDelta } from "../../cloud/ads-entity-delta.js";
import { SYSTEM_TOOL_CATALOG } from "../../generated/system-tool-catalog.js";
import {
  LLMProviderManagerModel,
  type LLMProviderManagerEnv,
} from "../../providers/llm-provider-manager.js";
import { ChannelManagerModel, type ChannelManagerEnv } from "../../channels/channel-manager.js";
import { normalizePlatform } from "../../utils/platform.js";

export interface CustomerServiceShopContextProjection {
  objectId: string;
  platformShopId: string;
  shopName: string;
  platform: string;
  systemPrompt: string;
  runProfileId?: string | null;
}

export interface AffiliateShopContextProjection {
  id: string;
  userId?: string | null;
  platform?: string | null;
  platformShopId?: string | null;
  shopName?: string | null;
  runProfileId?: string | null;
  businessPrompt?: string | null;
  decisionThresholds?: GQL.AffiliateDecisionThresholds | null;
}

// ---------------------------------------------------------------------------
// Desktop store environment — late-initialized infrastructure dependencies.
// The LLMProviderManager uses its own setEnv(), so the top-level env is now
// only needed if other desktop-store actions require infrastructure deps.
// ---------------------------------------------------------------------------

/** Initialize the LLM Provider Manager environment. Called once during startup in main.ts. */
export function initLLMProviderManagerEnv(env: LLMProviderManagerEnv): void {
  rootStore.llmManager.setEnv(env);
}

/** Initialize the Channel Manager environment. Called once during startup in main.ts. */
export function initChannelManagerEnv(env: ChannelManagerEnv): void {
  rootStore.channelManager.setEnv(env);
  rootStore.channelManager.init();
}

// Re-export the env types for main.ts convenience
export type { LLMProviderManagerEnv, ChannelManagerEnv };

// ---------------------------------------------------------------------------
// Desktop-specific RootStore: extends shared model with ingestion actions
// ---------------------------------------------------------------------------

const DesktopRootStoreModel = RootStoreModel.views((self) => ({
  getCustomerServiceShopContextsForDevice(
    deviceId: string | null | undefined,
  ): CustomerServiceShopContextProjection[] {
    if (!deviceId) return [];
    const contexts: CustomerServiceShopContextProjection[] = [];
    for (const shop of self.shops as any[]) {
      const platformShopId = shop.platformShopId;
      if (!platformShopId || !shop.handlesCustomerServiceOnDevice(deviceId)) continue;
      const assembledPrompt = shop.services?.customerService?.assembledPrompt;
      if (!assembledPrompt) continue;
      contexts.push({
        objectId: shop.id,
        platformShopId,
        shopName: shop.shopName ?? platformShopId,
        platform: normalizePlatform(shop.platform),
        systemPrompt: assembledPrompt,
        runProfileId: shop.services?.customerService?.runProfileId ?? undefined,
      });
    }
    return contexts;
  },

  getAffiliateShopContextsForDevice(
    deviceId: string | null | undefined,
  ): AffiliateShopContextProjection[] {
    if (!deviceId) return [];
    const contexts: AffiliateShopContextProjection[] = [];
    for (const shop of self.shops as any[]) {
      const affiliateService = shop.services?.affiliateService;
      if (!shop.platformShopId || !affiliateService?.enabled) continue;
      // A BD's device can differ from the shop's fallback device. Cache the
      // enabled shop's context on either device; the work-item actuator owns
      // device admission (BD first, then shop fallback) before dispatch.
      contexts.push({
        id: shop.id,
        userId: shop.userId,
        platform: shop.platform,
        platformShopId: shop.platformShopId,
        shopName: shop.shopName,
        runProfileId: affiliateService.runProfileId,
        businessPrompt: affiliateService.businessPrompt,
        decisionThresholds: affiliateService.decisionThresholds,
      });
    }
    return contexts;
  },

  isKnownShopCacheReady(): boolean {
    return self.shopLifecycle.status === "ready";
  },

  isCustomerServiceShopAvailableForDevice(
    shopId: string | null | undefined,
    platformShopId: string | null | undefined,
    deviceId: string | null | undefined,
  ): boolean {
    const shop = self.findShopByObjectOrPlatformId(shopId, platformShopId);
    return !!shop?.handlesCustomerServiceOnDevice(deviceId);
  },

  isAffiliateShopAvailableForDevice(
    shopId: string | null | undefined,
    platformShopId: string | null | undefined,
    deviceId: string | null | undefined,
  ): boolean {
    if (!deviceId) return false;
    const shop = self.findShopByObjectOrPlatformId(shopId, platformShopId);
    const affiliateService = shop?.services?.affiliateService;
    return !!(affiliateService?.enabled && affiliateService.deviceId === deviceId);
  },
}))
  .actions((self) => ({
    beginCategoryLoad(locale: string) {
      if (!self.categories.has(locale)) self.categories.set(locale, { locale });
      const bucket = self.categories.get(locale)!;
      bucket.loading = true;
      bucket.error = null;
    },
    ingestCategoryCatalog(catalog: GQL.ProductCategoryCatalog) {
      self.categories.set(catalog.locale, productCategoryCacheSnapshot(catalog));
    },
    failCategoryLoad(locale: string, error: string) {
      const bucket = self.categories.get(locale);
      if (bucket) {
        bucket.loading = false;
        bucket.error = error;
      }
    },
  }))
  .actions((self) => ({
    /**
     * Update systemTools from gateway catalog IDs.
     * Preserves metadata from pre-seeded SYSTEM_TOOL_CATALOG entries.
     */
    updateSystemToolsFromCatalog(catalogCoreIds: string[]) {
      if (catalogCoreIds.length === 0) return;
      const existingMeta = new Map(
        self.systemTools.map((t) => [
          t.id,
          { displayName: t.displayName, description: t.description, category: t.category },
        ]),
      );
      applySnapshot(
        self.systemTools,
        catalogCoreIds.map((id) => {
          const meta = existingMeta.get(id);
          return {
            id,
            name: id,
            displayName: meta?.displayName ?? id,
            description: meta?.description ?? "",
            category: meta?.category ?? "system",
            source: "system",
            operationType: "system",
          };
        }),
      );
    },

    /** Replace only the notified advertiser scopes, including removed ACTIVE accesses. */
    applyAdsEntityDelta(advertiserIds: readonly string[], data: AdsEntityDelta) {
      const scope = new Set(advertiserIds);
      const prepare = (target: any, rows: unknown[], scopeKey: string) => {
        if (!Array.isArray(rows)) throw new Error("Incomplete Ads delta response");
        const existing = new Map<string, any>(target.map((row: any) => [row.id, row]));
        const snapshots = new Map<string, any>();
        for (const raw of rows) {
          const row = sanitizeForMst(raw) as Record<string, any>;
          if (!row || typeof row.id !== "string" || !scope.has(row[scopeKey])) {
            throw new Error("Ads entity outside requested delta scope");
          }
          if (snapshots.has(row.id)) throw new Error("Duplicate Ads entity in delta");
          const previous = existing.get(row.id);
          if (previous && !scope.has(previous[scopeKey])) {
            throw new Error("Ads delta conflicts with an unrelated account");
          }
          const snapshot = {
            ...(previous ? (getSnapshot(previous) as Record<string, unknown>) : {}),
            ...row,
          };
          typecheck(getChildType(target), snapshot);
          snapshots.set(row.id, snapshot);
        }
        return { target, existing, snapshots, scopeKey };
      };
      // Validate both collections before changing either; partial results must
      // never clear unrelated accounts or leave half an update in the Panel.
      const plans = [
        prepare(self.adsAdvertisers, data.adsAdvertisers, "id"),
        prepare(self.adsStoreBindings, data.adsStoreAccesses, "adsAdvertiserId"),
      ];
      for (const { target, existing, snapshots, scopeKey } of plans) {
        for (let i = target.length - 1; i >= 0; i--) {
          if (scope.has(target[i][scopeKey]) && !snapshots.has(target[i].id)) target.splice(i, 1);
        }
        for (const [id, snapshot] of snapshots) {
          const previous = existing.get(id);
          if (previous) applySnapshot(previous, snapshot);
          else target.push(snapshot);
        }
      }
    },

    /** Clear user on logout. */
    clearUser() {
      self.categories.clear();
      self.categorySession++;
      self.currentUser = null;
      self.billingOverview = null;
      applySnapshot(self.billingPlanDefinitions, []);
      applySnapshot(self.payments, []);
    },

    /** Replace all client tool specs in the MST store (from gateway RPC). */
    loadClientToolSpecs(specs: any[]) {
      applySnapshot(self.clientTools, specs);
    },

    /** Replace all provider keys in the MST store (bulk load from storage). */
    loadProviderKeys(keys: any[]) {
      applySnapshot(self.providerKeys, keys);
    },

    /** Upsert a single provider key (after create/update). */
    upsertProviderKey(key: any) {
      const idx = self.providerKeys.findIndex((k) => k.id === key.id);
      if (idx >= 0) {
        applySnapshot(self.providerKeys[idx], key);
      } else {
        self.providerKeys.push(key);
      }
    },

    /** Remove a provider key by ID. */
    removeProviderKey(id: string) {
      const idx = self.providerKeys.findIndex((k) => k.id === id);
      if (idx >= 0) self.providerKeys.splice(idx, 1);
    },

    /** Replace all channel accounts in the MST store (bulk load from storage). */
    loadChannelAccounts(accounts: any[]) {
      applySnapshot(self.channelAccounts, accounts);
    },

    /** Upsert a single channel account (after create/update). */
    upsertChannelAccount(account: any) {
      const idx = self.channelAccounts.findIndex(
        (a) => a.channelId === account.channelId && a.accountId === account.accountId,
      );
      if (idx >= 0) {
        applySnapshot(self.channelAccounts[idx], account);
      } else {
        self.channelAccounts.push(account);
      }
    },

    /** Update ephemeral channel account status derived from local runtime state. */
    updateChannelAccountStatus(
      channelId: string,
      accountId: string,
      status: Record<string, unknown>,
    ) {
      const account = self.channelAccounts.find(
        (a) => a.channelId === channelId && a.accountId === accountId,
      );
      if (!account) return;
      applySnapshot(account, {
        ...getSnapshot(account),
        status: {
          ...(getSnapshot(account).status ?? {}),
          ...status,
        },
      });
    },

    /** Update account-scoped recipient state derived from pairing/allowFrom storage. */
    updateChannelAccountRecipients(
      channelId: string,
      accountId: string,
      recipients: Record<string, unknown>,
    ) {
      const account = self.channelAccounts.find(
        (a) => a.channelId === channelId && a.accountId === accountId,
      );
      if (!account) return;
      applySnapshot(account, {
        ...getSnapshot(account),
        recipients,
      });
    },

    /** Remove a channel account by composite key. */
    removeChannelAccount(channelId: string, accountId: string) {
      const idx = self.channelAccounts.findIndex(
        (a) => a.channelId === channelId && a.accountId === accountId,
      );
      if (idx >= 0) self.channelAccounts.splice(idx, 1);
    },
  }))
  .props({
    /** LLM Provider Manager — encapsulates provider key transaction actions. */
    llmManager: types.optional(LLMProviderManagerModel, {}),
    /** Channel Manager — encapsulates channel account CRUD and plugin entry computation. */
    channelManager: types.optional(ChannelManagerModel, {}),
  });

/** Singleton MST store instance for the Desktop process. */
export type DesktopRootStore = Instance<typeof DesktopRootStoreModel>;

export const rootStore: DesktopRootStore = DesktopRootStoreModel.create({
  systemTools: SYSTEM_TOOL_CATALOG.map((t) => ({
    id: t.id,
    name: t.id,
    displayName: t.label ?? t.id,
    description: t.description ?? "",
    category: t.section ?? "system",
    source: "system",
    operationType: "system",
  })),
});

// ---------------------------------------------------------------------------
// Patch listener registry (used by SSE broadcasting in Phase 2)
// ---------------------------------------------------------------------------

type PatchListener = (patches: IJsonPatch[]) => void;
const patchListeners = new Set<PatchListener>();

export function subscribeToPatch(listener: PatchListener): () => void {
  patchListeners.add(listener);
  return () => patchListeners.delete(listener);
}

// Batch patches within the same microtask to avoid SSE message storms.
// A single applySnapshot of 50 entitledTools fires 50+ onPatch calls synchronously;
// buffering them into one flush prevents Panel render thrashing.
let patchBuffer: IJsonPatch[] = [];
let flushScheduled = false;

function flushPatches() {
  flushScheduled = false;
  if (patchBuffer.length === 0) return;
  const batch = patchBuffer;
  patchBuffer = [];
  for (const listener of patchListeners) {
    listener(batch);
  }
}

onPatch(rootStore, (patch) => {
  patchBuffer.push(patch);
  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(flushPatches);
  }
});

export { getSnapshot };
