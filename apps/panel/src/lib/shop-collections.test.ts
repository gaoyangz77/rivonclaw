import { describe, expect, it } from "vitest";
import {
  groupShopsByCollection,
  shopCollectionDisplayName,
  shopCollectionName,
  shopCollectionRegions,
  sortShopCollectionGroupsByName,
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

    expect(shopCollectionName(shops)).toBe("Windboss Benessere");
    expect(shopCollectionDisplayName(shops)).toBe("Windboss Benessere + 2");
    expect(shopCollectionRegions(shops)).toEqual(["IE", "FR", "IT"]);
  });

  it("sorts collection groups and their shops by display name with stable tie breakers", () => {
    const groups = groupShopsByCollection([
      { id: "shop-z", shopName: "Shop 10" },
      { id: "shop-fr", collectionKey: "seller:windboss", shopName: "Windboss FR" },
      { id: "shop-b", shopName: "Same Shop" },
      { id: "shop-de", collectionKey: "seller:windboss", shopName: "Windboss DE" },
      { id: "shop-a", shopName: "Same Shop" },
      { id: "shop-two", shopName: "Shop 2" },
    ]);

    const sorted = sortShopCollectionGroupsByName(groups);

    expect(sorted.map((group) => group.key)).toEqual([
      "shop:shop-a",
      "shop:shop-b",
      "shop:shop-two",
      "shop:shop-z",
      "seller:windboss",
    ]);
    expect(sorted.at(-1)?.shops.map((shop) => shop.id)).toEqual(["shop-de", "shop-fr"]);
  });
});
