import { types, type Instance } from "mobx-state-tree";
import { ToolModel } from "./ToolSpec.js";
import { SurfaceModel } from "./Surface.js";
import { RunProfileModel } from "./RunProfile.js";
import { ShopModel } from "./Shop.js";
import { AdsAdvertiserModel } from "./AdsAdvertiser.js";
import { AdsStoreBindingModel } from "./AdsStoreBinding.js";
import { BillingOverviewModel, BillingPlanDefinitionModel, PaymentModel } from "./Subscription.js";
import { ProviderKeyModel } from "./ProviderKey.js";
import { ChannelAccountModel } from "./ChannelAccount.js";
import { MobilePairingModel } from "./MobilePairing.js";
import { ToolCapabilityModel } from "./ToolCapability.js";
import { UserModel } from "./User.js";
import { PlatformAppModel } from "./PlatformApp.js";
import { WmsAccountModel, WarehouseModel, ShopWarehouseModel } from "./Warehouse.js";
import { InventoryGoodModel } from "./InventoryGood.js";
import { AffiliateWorkspaceModel } from "./Affiliate.js";
import {
  SystemRunProfile,
  SystemSurface,
  type SystemRunProfile as SystemRunProfileId,
  type SystemSurface as SystemSurfaceId,
} from "../generated/graphql.js";

const SYSTEM_RUN_PROFILE_TOOL_AUGMENTATIONS: Partial<Record<SystemRunProfileId, string[]>> = {
  [SystemRunProfile.CustomerService]: ["image"],
  [SystemRunProfile.AffiliateOperator]: ["read"],
};

const SYSTEM_SURFACE_TOOL_AUGMENTATIONS: Partial<Record<SystemSurfaceId, string[]>> = {
  [SystemSurface.EcommerceSeller]: ["image"],
};

function dedupeToolIds(toolIds: string[]): string[] {
  return [...new Set(toolIds)];
}

const AuthBootstrapStateModel = types.model("AuthBootstrapState", {
  status: types.optional(
    types.enumeration("AuthBootstrapStatus", ["signed_out", "loading", "ready", "error"]),
    "signed_out",
  ),
  phase: types.optional(
    types.enumeration("AuthLifecyclePhase", ["settled", "transitioning"]),
    "settled",
  ),
  action: types.maybeNull(types.string),
  transitionId: types.optional(types.number, 0),
  settledUserId: types.maybeNull(types.string),
  error: types.maybeNull(types.string),
});

const ShopLifecycleStateModel = types.model("ShopLifecycleState", {
  status: types.optional(
    types.enumeration("ShopLifecycleStatus", ["empty", "loading", "ready", "error"]),
    "empty",
  ),
  generation: types.optional(types.number, 0),
  lastRefreshReason: types.maybeNull(types.string),
  lastRefreshAt: types.maybeNull(types.string),
  error: types.maybeNull(types.string),
});

type RootShopInstance = Instance<typeof ShopModel>;

function findShopByObjectOrPlatformId(
  shops: RootShopInstance[],
  shopId: string | null | undefined,
  platformShopId: string | null | undefined,
): RootShopInstance | undefined {
  return shops.find(
    (shop) =>
      (!!shopId && shop.id === shopId) ||
      (!!platformShopId && shop.platformShopId === platformShopId),
  );
}

export const RootStoreModel = types
  .model("RootStore", {
    /** System (core) tools — pre-seeded from SYSTEM_TOOL_CATALOG, filtered on gateway init. */
    systemTools: types.optional(types.array(ToolModel), []),
    /** Entitled tools from backend GraphQL (applySnapshot-safe with backend ToolSpec data). */
    entitledTools: types.optional(types.array(ToolModel), []),
    /** Client-side tools (from defineClientTool / gateway RPC). Separate to survive applySnapshot overwrites. */
    clientTools: types.optional(types.array(ToolModel), []),
    surfaces: types.optional(types.array(SurfaceModel), []),
    runProfiles: types.optional(types.array(RunProfileModel), []),
    shops: types.optional(types.array(ShopModel), []),
    adsAdvertisers: types.optional(types.array(AdsAdvertiserModel), []),
    adsStoreBindings: types.optional(types.array(AdsStoreBindingModel), []),
    providerKeys: types.optional(types.array(ProviderKeyModel), []),
    channelAccounts: types.optional(types.array(ChannelAccountModel), []),
    mobilePairings: types.optional(types.array(MobilePairingModel), []),
    billingOverview: types.maybeNull(BillingOverviewModel),
    billingPlanDefinitions: types.optional(types.array(BillingPlanDefinitionModel), []),
    payments: types.optional(types.array(PaymentModel), []),
    toolCapability: types.optional(ToolCapabilityModel, {}),
    currentUser: types.maybeNull(UserModel),
    authBootstrap: types.optional(AuthBootstrapStateModel, { status: "signed_out", error: null }),
    shopLifecycle: types.optional(ShopLifecycleStateModel, {}),
    platformApps: types.optional(types.array(PlatformAppModel), []),
    wmsAccounts: types.optional(types.array(WmsAccountModel), []),
    warehouses: types.optional(types.array(WarehouseModel), []),
    shopWarehouses: types.optional(types.array(ShopWarehouseModel), []),
    inventoryGoods: types.optional(types.array(InventoryGoodModel), []),
    affiliateWorkspace: types.optional(AffiliateWorkspaceModel, {}),
  })
  .views((self) => ({
    get authenticated() {
      return self.currentUser !== null;
    },
    get enrolledModules(): string[] {
      return self.currentUser?.enrolledModules ? [...self.currentUser.enrolledModules] : [];
    },
    isModuleEnrolled(moduleId: string) {
      return self.currentUser?.enrolledModules?.includes(moduleId) ?? false;
    },
  }))
  .views((self) => ({
    /** All tools across all sources: system + entitled + client. */
    get allTools() {
      return [...self.systemTools, ...self.entitledTools, ...self.clientTools];
    },
    /** @deprecated Use allTools */
    get mergedToolSpecs() {
      return [...self.entitledTools, ...self.clientTools];
    },
    /** @deprecated Use entitledTools */
    get toolSpecs() {
      return self.entitledTools;
    },
    getDerivedSurfaces() {
      // Surfaces are derived from entitled + client tools (system tools have no surfaces)
      const specs = this.mergedToolSpecs;
      const surfaceMap = new Map<string, string[]>();
      for (const spec of specs) {
        for (const name of spec.surfaces) {
          let toolIds = surfaceMap.get(name);
          if (!toolIds) {
            toolIds = [];
            surfaceMap.set(name, toolIds);
          }
          toolIds.push(spec.id);
        }
      }
      const derived: { id: string; name: string; allowedToolIds: string[]; userId: string }[] = [];
      for (const [name, toolIds] of surfaceMap) {
        derived.push({
          id: name,
          name,
          allowedToolIds: dedupeToolIds([
            ...toolIds,
            ...(SYSTEM_SURFACE_TOOL_AUGMENTATIONS[name as SystemSurfaceId] ?? []),
          ]),
          userId: "",
        });
      }
      return derived;
    },
    getToolIdsForSurface(surfaceName: string) {
      const target = surfaceName.toUpperCase();
      return this.mergedToolSpecs
        .filter((spec) => spec.surfaces.some((s: string) => s.toUpperCase() === target))
        .map((spec) => spec.id);
    },
    getToolIdsForRunProfile(profileName: string) {
      const target = profileName.toUpperCase();
      return this.mergedToolSpecs
        .filter((spec) => spec.runProfiles.some((rp: string) => rp.toUpperCase() === target))
        .map((spec) => spec.id);
    },
    getChannelAccount(channelId: string, accountId: string) {
      return self.channelAccounts.find(
        (a) => a.channelId === channelId && a.accountId === accountId,
      );
    },
    getMobilePairing(id: string) {
      return self.mobilePairings.find((p) => p.id === id);
    },
    getMobilePairingByPairingId(pairingId: string) {
      return self.mobilePairings.find((p) => p.pairingId === pairingId);
    },
    getShop(id: string) {
      return self.shops.find((s) => s.id === id);
    },
    getAdsAdvertiser(id: string) {
      return self.adsAdvertisers.find((advertiser) => advertiser.id === id);
    },
    getAdsStoreBinding(id: string) {
      return self.adsStoreBindings.find((binding) => binding.id === id);
    },
    findShopByObjectOrPlatformId(
      shopId: string | null | undefined,
      platformShopId: string | null | undefined,
    ) {
      return findShopByObjectOrPlatformId(self.shops, shopId, platformShopId);
    },
    getCustomerServiceShopIdsForDevice(deviceId: string | null | undefined): string[] {
      if (!deviceId) return [];
      return self.shops
        .filter((shop) => shop.handlesCustomerServiceOnDevice(deviceId))
        .map((shop) => shop.id)
        .filter((shopId): shopId is string => typeof shopId === "string" && shopId.length > 0);
    },
    get customerServiceEnabledShopCount(): number {
      return self.shops.filter((shop) => shop.services?.customerService?.enabled).length;
    },
    getWmsAccount(id: string) {
      return self.wmsAccounts.find((a) => a.id === id);
    },
    getWarehouse(id: string) {
      return self.warehouses.find((w) => w.id === id);
    },
    getShopWarehouse(id: string) {
      return self.shopWarehouses.find((w) => w.id === id);
    },
    getInventoryGood(id: string) {
      return self.inventoryGoods.find((good) => good.id === id);
    },
    getWarehousesForWmsAccount(wmsAccountId: string) {
      return self.warehouses.filter((w) => w.sourceId === wmsAccountId);
    },
    getShopWarehousesForShop(shopId: string) {
      return self.shopWarehouses.filter((w) => w.shopId === shopId);
    },
    getShopByPlatformId(platformShopId: string) {
      return self.shops.find((s) => s.platformShopId === platformShopId);
    },
    getRunProfile(id: string) {
      return self.runProfiles.find((p) => p.id === id);
    },
    /** Return the single globally active provider key (isDefault === true). */
    getActiveProviderKey() {
      return self.providerKeys.find((k) => k.isDefault);
    },
    /** Return all provider keys for a given provider. */
    getProviderKeysByProvider(provider: string) {
      return self.providerKeys.filter((k) => k.provider === provider);
    },
  }))
  .views((self) => ({
    getDerivedRunProfiles() {
      const profileMap = new Map<string, string[]>();
      for (const spec of self.mergedToolSpecs) {
        for (const name of spec.runProfiles) {
          let toolIds = profileMap.get(name);
          if (!toolIds) {
            toolIds = [];
            profileMap.set(name, toolIds);
          }
          toolIds.push(spec.id);
        }
      }
      const derivedSurfaces = self.getDerivedSurfaces();
      const profiles: {
        id: string;
        name: string;
        selectedToolIds: string[];
        surfaceId: string;
        userId: string;
      }[] = [];
      for (const [name, toolIds] of profileMap) {
        const runProfileId = name as SystemRunProfileId;
        const augmentedToolIds = dedupeToolIds([
          ...toolIds,
          ...(SYSTEM_RUN_PROFILE_TOOL_AUGMENTATIONS[runProfileId] ?? []),
        ]);
        const matchingSurface = derivedSurfaces.find((s) => {
          if (s.id === "Default") return false;
          const surfaceToolSet = new Set(s.allowedToolIds);
          return augmentedToolIds.every((tid) => surfaceToolSet.has(tid));
        });
        profiles.push({
          id: name,
          name,
          selectedToolIds: augmentedToolIds,
          surfaceId: matchingSurface?.id ?? "Default",
          userId: "",
        });
      }
      return profiles;
    },
    /** Pass-through to toolCapability.allSurfaces (backward compatibility). */
    get allSurfaces() {
      const defaultSurface = {
        id: "Default",
        name: "Default",
        allowedToolIds: [] as string[],
        userId: "",
      };
      return [
        defaultSurface,
        ...self.getDerivedSurfaces(),
        ...self.surfaces.map((s) => ({
          id: s.id,
          name: s.name,
          allowedToolIds: [...s.allowedToolIds],
          userId: s.userId,
        })),
      ];
    },
  }))
  .views((self) => ({
    get allRunProfiles() {
      return [
        ...self.getDerivedRunProfiles(),
        ...self.runProfiles.map((p) => ({
          id: p.id,
          name: p.name,
          selectedToolIds: [...p.selectedToolIds],
          surfaceId: p.surfaceId,
          userId: p.userId,
        })),
      ];
    },
    /** Available tools from ToolCapability sub-model (Panel reads this). */
    get availableTools() {
      return self.toolCapability.availableTools;
    },
  }));

export interface RootStore extends Instance<typeof RootStoreModel> {}
