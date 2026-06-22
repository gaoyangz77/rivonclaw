import { describe, expect, it } from "vitest";
import {
  groupShopsByCollection,
  shopCollectionDisplayName,
  shopCollectionRegions,
} from "./shop-collections.js";

describe("shop collection grouping", () => {
  it("groups shops with the same collectionKey", () => {
    const groups = groupShopsByCollection([
      { id: "shop-a", collectionKey: "seller:1", shopName: "US", region: "US" },
      { id: "shop-b", collectionKey: "seller:1", shopName: "GB", region: "GB" },
      { id: "shop-c", collectionKey: "seller:2", shopName: "Other", region: "US" },
    ]);

    expect(groups.map((group) => [group.key, group.shops.map((shop) => shop.id)])).toEqual([
      ["seller:1", ["shop-a", "shop-b"]],
      ["seller:2", ["shop-c"]],
    ]);
  });

  it("falls back to per-shop keys when collectionKey is missing", () => {
    const groups = groupShopsByCollection([
      { id: "shop-a", shopName: "A" },
      { id: "shop-b", collectionKey: "", shopName: "B" },
    ]);

    expect(groups.map((group) => group.key)).toEqual(["shop:shop-a", "shop:shop-b"]);
  });

  it("builds compact display metadata for grouped shops", () => {
    const shops = [
      { id: "shop-a", alias: "Ireland", shopName: "Windboss BenessereIE", region: "IE" },
      { id: "shop-b", alias: "France", shopName: "Windboss BenessereFR", region: "FR" },
      { id: "shop-c", alias: "Italy", shopName: "Windboss Benessere", region: "IT" },
    ];

    expect(shopCollectionDisplayName(shops)).toBe("Windboss Benessere + 2");
    expect(shopCollectionRegions(shops)).toEqual(["IE", "FR", "IT"]);
  });
});
