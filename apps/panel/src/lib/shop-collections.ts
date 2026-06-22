export interface ShopCollectionLike {
  id: string;
  collectionKey?: string | null;
  platform?: string | null;
  region?: string | null;
  shopName?: string | null;
  alias?: string | null;
}

export interface ShopCollectionGroup<TShop extends ShopCollectionLike> {
  key: string;
  shops: TShop[];
}

export function shopCollectionKey(shop: ShopCollectionLike): string {
  return shop.collectionKey?.trim() || `shop:${shop.id}`;
}

export function groupShopsByCollection<TShop extends ShopCollectionLike>(
  shops: readonly TShop[],
): ShopCollectionGroup<TShop>[] {
  const byKey = new Map<string, TShop[]>();
  for (const shop of shops) {
    const key = shopCollectionKey(shop);
    byKey.set(key, [...(byKey.get(key) ?? []), shop]);
  }
  return [...byKey.entries()].map(([key, groupShops]) => ({ key, shops: groupShops }));
}

export function shopCollectionDisplayName(shops: readonly ShopCollectionLike[]): string {
  const shopNames = shops
    .map((shop) => shop.shopName?.trim())
    .filter((name): name is string => !!name)
    .sort((a, b) => a.length - b.length || a.localeCompare(b, undefined, { numeric: true }));
  const displayName = shopNames[0];
  const fallback = shops[0]?.alias || shops[0]?.id || "";
  const collectionName = displayName || fallback;
  return shops.length === 1 ? collectionName : `${collectionName} + ${shops.length - 1}`;
}

export function shopCollectionRegions(shops: readonly ShopCollectionLike[]): string[] {
  return [...new Set(shops.map((shop) => shop.region).filter((region): region is string => !!region))];
}
