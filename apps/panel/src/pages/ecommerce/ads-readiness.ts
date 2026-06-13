import type { AdsAdvertiser, AdsStoreBinding, Shop } from "@rivonclaw/core/models";

export type ShopAdsReadinessStatus = "connected" | "needs_link" | "needs_advertiser";

export interface ShopAdsReadiness {
  status: ShopAdsReadinessStatus;
  binding: AdsStoreBinding | null;
}

export function findAdsBindingForShop(
  shop: Shop,
  bindings: readonly AdsStoreBinding[],
): AdsStoreBinding | null {
  return bindings.find((binding) =>
    !!shop.platformShopId &&
    binding.storeId === shop.platformShopId
  ) ?? null;
}

export function resolveShopAdsReadiness(
  shop: Shop,
  advertisers: readonly AdsAdvertiser[],
  bindings: readonly AdsStoreBinding[],
): ShopAdsReadiness {
  const binding = findAdsBindingForShop(shop, bindings);
  if (binding) {
    return { status: "connected", binding };
  }

  const hasAuthorizedAdvertiser = advertisers.some((advertiser) => advertiser.auth.status === "AUTHORIZED");
  return {
    status: hasAuthorizedAdvertiser ? "needs_link" : "needs_advertiser",
    binding: null,
  };
}

export function getReadinessBadgeClass(status: ShopAdsReadinessStatus): string {
  if (status === "connected") return "status-badge status-authorized";
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
