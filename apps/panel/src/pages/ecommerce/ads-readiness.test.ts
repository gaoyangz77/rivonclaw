import { describe, expect, it } from "vitest";
import type { AdsAdvertiser, AdsStoreBinding, Shop } from "@rivonclaw/core/models";
import {
  findAdsBindingsForShop,
  findExclusiveAuthorizedAdvertiserId,
  filterAuthorizedAdsBindings,
  resolveShopAdsReadiness,
} from "./ads-readiness.js";

function shop(platformShopId: string): Shop {
  return { platformShopId } as Shop;
}

function binding(
  advertiserId: string,
  exclusiveAuthorizedAdvertiserId: string | null,
): AdsStoreBinding {
  return {
    advertiserId,
    storeId: "store-1",
    exclusiveAuthorizedAdvertiserId,
  } as AdsStoreBinding;
}

function advertiser(advertiserId: string, status = "AUTHORIZED"): AdsAdvertiser {
  return {
    id: `mongo-${advertiserId}`,
    advertiserId,
    auth: { status },
  } as AdsAdvertiser;
}

describe("shop Ads readiness", () => {
  it("keeps every advertiser-store access row instead of selecting only the first account", () => {
    const bindings = [
      binding("advertiser-1", "advertiser-2"),
      binding("advertiser-2", "advertiser-2"),
    ];
    const advertisers = [advertiser("advertiser-1"), advertiser("advertiser-2")];

    expect(findAdsBindingsForShop(shop("store-1"), bindings)).toHaveLength(2);
    expect(findExclusiveAuthorizedAdvertiserId(bindings)).toBe("advertiser-2");

    const readiness = resolveShopAdsReadiness(shop("store-1"), advertisers, bindings);
    expect(readiness.status).toBe("connected");
    expect(readiness.bindings).toHaveLength(2);
    expect(readiness.binding?.advertiserId).toBe("advertiser-2");
    expect(readiness.exclusiveAuthorizedAdvertiserId).toBe("advertiser-2");
  });

  it("does not claim a current GMV Max account when synced rows disagree", () => {
    const bindings = [
      binding("advertiser-1", "advertiser-1"),
      binding("advertiser-2", "advertiser-2"),
    ];

    expect(findExclusiveAuthorizedAdvertiserId(bindings)).toBeNull();
  });

  it("excludes store accesses whose advertiser is no longer authorized", () => {
    const bindings = [binding("advertiser-1", null), binding("advertiser-2", null)];
    const advertisers = [advertiser("advertiser-1", "DISCONNECTED"), advertiser("advertiser-2")];

    expect(filterAuthorizedAdsBindings(advertisers, bindings)).toEqual([bindings[1]]);
    expect(resolveShopAdsReadiness(shop("store-1"), advertisers, bindings).bindings).toEqual([
      bindings[1],
    ]);
  });

  it("still reports an uncovered shop when there are no matching accesses", () => {
    const advertisers = [advertiser("advertiser-2")];
    const readiness = resolveShopAdsReadiness(shop("store-2"), advertisers, [
      binding("advertiser-1", null),
    ]);

    expect(readiness.status).toBe("needs_link");
    expect(readiness.bindings).toEqual([]);
  });
});
