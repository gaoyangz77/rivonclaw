import { describe, expect, it } from "vitest";
import type { BillingEntitlementStatus, Shop, ShopBillingStatus } from "@rivonclaw/core/models";
import { GQL } from "@rivonclaw/core";
import { buildShopServiceBillingGroups } from "./shop-billing-groups.js";

function shop(input: {
  id: string;
  collectionKey: string;
  customerService?: boolean;
  inventory?: boolean;
  affiliate?: boolean;
}): Shop {
  return {
    id: input.id,
    collectionKey: input.collectionKey,
    shopName: input.id,
    services: {
      customerService: { enabled: !!input.customerService },
      wms: { enabled: !!input.inventory },
      affiliateService: { enabled: !!input.affiliate },
    },
  } as unknown as Shop;
}

function entitlement(input: {
  product: string;
  scopeId: string;
  allowed: boolean;
}): BillingEntitlementStatus {
  return {
    scopeType: GQL.BillingScopeType.Shop,
    scopeId: input.scopeId,
    product: input.product,
    allowed: input.allowed,
    code: input.allowed
      ? GQL.EntitlementDecisionCode.Allowed
      : GQL.EntitlementDecisionCode.PaymentRequired,
    source: null,
    subscription: null,
    validUntil: null,
    usage: [],
  } as unknown as BillingEntitlementStatus;
}

function billing(input: {
  shopId: string;
  csAllowed: boolean;
  inventoryAllowed: boolean;
  affiliateAllowed: boolean;
}): ShopBillingStatus {
  return {
    shopId: input.shopId,
    shopName: input.shopId,
    customerService: entitlement({
      product: GQL.BillableProduct.EcomCustomerService,
      scopeId: "seller:shared",
      allowed: input.csAllowed,
    }),
    inventory: entitlement({
      product: GQL.BillableProduct.EcomInventory,
      scopeId: `shop:${input.shopId}:inventory`,
      allowed: input.inventoryAllowed,
    }),
    affiliate: entitlement({
      product: GQL.BillableProduct.EcomAffiliate,
      scopeId: `shop:${input.shopId}:affiliate`,
      allowed: input.affiliateAllowed,
    }),
  } as unknown as ShopBillingStatus;
}

describe("shop billing groups", () => {
  it("keeps shared customer-service status at collection level without dropping per-shop service states", () => {
    const groups = buildShopServiceBillingGroups(
      [
        shop({
          id: "shop-a",
          collectionKey: "seller:shared",
          customerService: true,
          inventory: true,
          affiliate: true,
        }),
        shop({
          id: "shop-b",
          collectionKey: "seller:shared",
          customerService: true,
          inventory: true,
          affiliate: true,
        }),
      ],
      [
        billing({
          shopId: "shop-a",
          csAllowed: true,
          inventoryAllowed: true,
          affiliateAllowed: false,
        }),
        billing({
          shopId: "shop-b",
          csAllowed: true,
          inventoryAllowed: false,
          affiliateAllowed: true,
        }),
      ],
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].customerServiceRow?.billing?.customerService.scopeId).toBe("seller:shared");
    expect(groups[0].rows.map((row) => row.shop.id)).toEqual(["shop-a", "shop-b"]);
    expect(groups[0].rows[0].billing?.inventory.allowed).toBe(true);
    expect(groups[0].rows[0].billing?.affiliate.allowed).toBe(false);
    expect(groups[0].rows[1].billing?.inventory.allowed).toBe(false);
    expect(groups[0].rows[1].billing?.affiliate.allowed).toBe(true);
  });

  it("builds billing rows without depending on shop service enabled flags", () => {
    const groups = buildShopServiceBillingGroups(
      [
        shop({ id: "shop-a", collectionKey: "seller:shared" }),
        shop({ id: "shop-b", collectionKey: "seller:shared" }),
      ],
      [
        billing({
          shopId: "shop-a",
          csAllowed: false,
          inventoryAllowed: false,
          affiliateAllowed: false,
        }),
        billing({
          shopId: "shop-b",
          csAllowed: true,
          inventoryAllowed: true,
          affiliateAllowed: true,
        }),
      ],
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].customerServiceRow?.shop.id).toBe("shop-a");
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[0].rows[1].billing?.customerService.allowed).toBe(true);
    expect(groups[0].rows[1].billing?.inventory.allowed).toBe(true);
    expect(groups[0].rows[1].billing?.affiliate.allowed).toBe(true);
  });
});
