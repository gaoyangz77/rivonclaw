import type { Shop, ShopBillingStatus } from "@rivonclaw/core/models";
import { groupShopsByCollection } from "./shop-collections.js";

export interface ShopServiceBillingRow {
  shop: Shop;
  billing: ShopBillingStatus | null;
}

export interface ShopServiceBillingGroup {
  key: string;
  shops: Shop[];
  rows: ShopServiceBillingRow[];
  customerServiceRow: (ShopServiceBillingRow & { shops: Shop[] }) | null;
}

export function buildShopServiceBillingGroups(
  shops: readonly Shop[],
  billingStatuses: readonly ShopBillingStatus[],
): ShopServiceBillingGroup[] {
  const billingByShopId = new Map(billingStatuses.map((status) => [status.shopId, status]));

  return groupShopsByCollection(shops).map((group) => {
    const rows = group.shops.map((shop) => ({
      shop,
      billing: billingByShopId.get(shop.id) ?? null,
    }));
    const customerServiceRow = rows[0] ?? null;

    return {
      key: group.key,
      shops: group.shops,
      rows,
      customerServiceRow: customerServiceRow
        ? { ...customerServiceRow, shops: group.shops }
        : null,
    };
  });
}
