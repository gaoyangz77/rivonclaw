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
  const first = shops[0];
  if (!first) return "";
  const firstName = first.alias || first.shopName || first.id;
  return shops.length === 1 ? firstName : `${firstName} + ${shops.length - 1}`;
}

export function shopCollectionRegions(shops: readonly ShopCollectionLike[]): string[] {
  return [...new Set(shops.map((shop) => shop.region).filter((region): region is string => !!region))];
}
