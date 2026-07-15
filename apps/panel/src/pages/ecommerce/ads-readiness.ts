import type { AdsAdvertiser, AdsStoreBinding, Shop } from "@rivonclaw/core/models";

export type ShopAdsReadinessStatus = "connected" | "needs_link" | "needs_advertiser";

export interface ShopAdsReadiness {
  status: ShopAdsReadinessStatus;
  binding: AdsStoreBinding | null;
  bindings: AdsStoreBinding[];
  exclusiveAuthorizedAdvertiserId: string | null;
}

export function findAdsBindingsForShop(
  shop: Shop,
  bindings: readonly AdsStoreBinding[],
): AdsStoreBinding[] {
  if (!shop.platformShopId) return [];
  return bindings.filter((binding) => binding.storeId === shop.platformShopId);
}

export function findAdsBindingForShop(
  shop: Shop,
  bindings: readonly AdsStoreBinding[],
): AdsStoreBinding | null {
  return findAdsBindingsForShop(shop, bindings)[0] ?? null;
}

export function findExclusiveAuthorizedAdvertiserId(
  bindings: readonly AdsStoreBinding[],
): string | null {
  const advertiserIds = new Set(
    bindings
      .map((binding) => binding.exclusiveAuthorizedAdvertiserId)
      .filter((advertiserId): advertiserId is string => Boolean(advertiserId)),
  );
  return advertiserIds.size === 1 ? [...advertiserIds][0] : null;
}

export function filterAuthorizedAdsBindings(
  advertisers: readonly AdsAdvertiser[],
  bindings: readonly AdsStoreBinding[],
): AdsStoreBinding[] {
  const authorizedIds = new Set<string>();
  for (const advertiser of advertisers) {
    if (advertiser.auth.status !== "AUTHORIZED") continue;
    authorizedIds.add(advertiser.id);
    authorizedIds.add(advertiser.advertiserId);
  }
  return bindings.filter(
    (binding) =>
      authorizedIds.has(binding.adsAdvertiserId ?? "") || authorizedIds.has(binding.advertiserId),
  );
}

export function resolveShopAdsReadiness(
  shop: Shop,
  advertisers: readonly AdsAdvertiser[],
  bindings: readonly AdsStoreBinding[],
): ShopAdsReadiness {
  const shopBindings = filterAuthorizedAdsBindings(
    advertisers,
    findAdsBindingsForShop(shop, bindings),
  );
  const exclusiveAuthorizedAdvertiserId = findExclusiveAuthorizedAdvertiserId(shopBindings);
  const binding =
    shopBindings.find((item) => item.advertiserId === exclusiveAuthorizedAdvertiserId) ??
    shopBindings[0] ??
    null;
  if (binding) {
    return {
      status: "connected",
      binding,
      bindings: shopBindings,
      exclusiveAuthorizedAdvertiserId,
    };
  }

  const hasAuthorizedAdvertiser = advertisers.some(
    (advertiser) => advertiser.auth.status === "AUTHORIZED",
  );
  return {
    status: hasAuthorizedAdvertiser ? "needs_link" : "needs_advertiser",
    binding: null,
    bindings: [],
    exclusiveAuthorizedAdvertiserId: null,
  };
}

export function getReadinessBadgeClass(status: ShopAdsReadinessStatus | "partial"): string {
  if (status === "connected") return "status-badge status-authorized";
  if (status === "partial") return "status-badge status-info";
  if (status === "needs_link") return "status-badge status-warning";
  return "status-badge status-neutral";
}

export function navigateToAdsManagement() {
  const path = "/commerce/ads";
  if (window.location.pathname !== path) {
    window.history.pushState(null, "", path);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
}
