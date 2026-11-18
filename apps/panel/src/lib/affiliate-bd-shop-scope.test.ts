import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import {
  businessDeveloperShopScopeErrorKey,
  clearShopScopeSelection,
  grantEveryShopScopeRegion,
  groupShopIdsByRegion,
  isShopScopeDraftChanged,
  isShopScopeDraftSaveable,
  isUnrestrictedShopScope,
  ownerAssignmentCandidates,
  scopeShopsFrom,
  summarizeShopScope,
  shopScopeCoversAnyShop,
  shopScopeCoversShop,
  shopScopeDraftFrom,
  shopScopeOfDraft,
  shopScopeRegionState,
  toggleShopScopeRegion,
  toggleShopScopeShop,
  withShopScopeMode,
} from "./affiliate-bd-shop-scope.js";

const US = GQL.ShopRegion.Us;
const GB = GQL.ShopRegion.Gb;
const DE = GQL.ShopRegion.De;

const regionByShopId = new Map<string, string | null>([
  ["us-1", "US"],
  ["us-2", "US"],
  ["gb-1", "GB"],
  ["bare", null],
]);

describe("shopScopeCoversAnyShop", () => {
  it("treats both grants empty as unrestricted, even for a relationship without shops", () => {
    expect(isUnrestrictedShopScope({ regions: [], shopIds: [] })).toBe(true);
    expect(shopScopeCoversAnyShop({ regions: [], shopIds: [] }, [], regionByShopId)).toBe(true);
    expect(shopScopeCoversAnyShop({ regions: [], shopIds: [] }, ["gb-1"], regionByShopId)).toBe(
      true,
    );
  });

  it("covers a relationship when ONE of its shops is covered by region", () => {
    const scope = { regions: ["US"], shopIds: [] };
    expect(shopScopeCoversAnyShop(scope, ["gb-1", "us-2"], regionByShopId)).toBe(true);
    expect(shopScopeCoversAnyShop(scope, ["gb-1"], regionByShopId)).toBe(false);
  });

  it("covers a relationship when ONE of its shops is granted by id", () => {
    const scope = { regions: [], shopIds: ["gb-1"] };
    expect(shopScopeCoversAnyShop(scope, ["us-1", "gb-1"], regionByShopId)).toBe(true);
    expect(shopScopeCoversAnyShop(scope, ["us-1"], regionByShopId)).toBe(false);
  });

  it("combines both grants as a union", () => {
    const scope = { regions: ["US"], shopIds: ["gb-1"] };
    expect(shopScopeCoversAnyShop(scope, ["us-1"], regionByShopId)).toBe(true);
    expect(shopScopeCoversAnyShop(scope, ["gb-1"], regionByShopId)).toBe(true);
    expect(shopScopeCoversAnyShop(scope, ["bare"], regionByShopId)).toBe(false);
  });

  it("never covers a relationship without shops when the scope is restricted", () => {
    expect(shopScopeCoversAnyShop({ regions: ["US"], shopIds: [] }, [], regionByShopId)).toBe(
      false,
    );
  });

  it("does not cover a shop whose region is unknown unless it is granted by id", () => {
    expect(shopScopeCoversAnyShop({ regions: ["US"], shopIds: [] }, ["gone"], regionByShopId)).toBe(
      false,
    );
    expect(
      shopScopeCoversAnyShop({ regions: ["US"], shopIds: ["gone"] }, ["gone"], regionByShopId),
    ).toBe(true);
  });

  it("covers a single shop by region or id", () => {
    expect(shopScopeCoversShop({ regions: ["US"], shopIds: [] }, { id: "x", region: "US" })).toBe(
      true,
    );
    expect(shopScopeCoversShop({ regions: [], shopIds: ["x"] }, { id: "x", region: null })).toBe(
      true,
    );
    expect(shopScopeCoversShop({ regions: ["US"], shopIds: [] }, { id: "x", region: "GB" })).toBe(
      false,
    );
  });
});

describe("scope draft", () => {
  it("starts unrestricted scopes in ALL and restricted ones in SPECIFIC", () => {
    expect(shopScopeDraftFrom({ regions: [], shopIds: [] }).shopScopeMode).toBe("ALL");
    expect(shopScopeDraftFrom({ regions: ["US"], shopIds: [] }).shopScopeMode).toBe("SPECIFIC");
    expect(shopScopeDraftFrom({ regions: [], shopIds: ["a"] }).shopScopeMode).toBe("SPECIFIC");
  });

  it("drops shop ids that no longer exist but keeps the SPECIFIC mode", () => {
    const draft = shopScopeDraftFrom(
      { regions: [], shopIds: ["alive", "deleted"] },
      new Set(["alive"]),
    );
    expect(draft.shopIds).toEqual(["alive"]);

    const onlyDeleted = shopScopeDraftFrom({ regions: [], shopIds: ["deleted"] }, new Set());
    expect(onlyDeleted).toMatchObject({ shopScopeMode: "SPECIFIC", shopIds: [] });
    // A scope that held only deleted shops must not silently become unrestricted.
    expect(isShopScopeDraftSaveable(onlyDeleted)).toBe(false);
  });

  it("refuses to save SPECIFIC with nothing selected", () => {
    const empty = withShopScopeMode(shopScopeDraftFrom({ regions: [], shopIds: [] }), "SPECIFIC");
    expect(isShopScopeDraftSaveable(empty)).toBe(false);
    expect(isShopScopeDraftSaveable({ ...empty, regions: [US] })).toBe(true);
    expect(isShopScopeDraftSaveable({ ...empty, shopIds: ["a"] })).toBe(true);
    expect(isShopScopeDraftSaveable({ ...empty, shopScopeMode: "ALL" })).toBe(true);
  });

  it("sends nothing in ALL mode even if the draft still holds a previous selection", () => {
    const draft = { shopScopeMode: "ALL" as const, regions: [US], shopIds: ["a"] };
    expect(shopScopeOfDraft(draft)).toEqual({ regions: [], shopIds: [] });
    expect(shopScopeOfDraft({ ...draft, shopScopeMode: "SPECIFIC" })).toEqual({
      regions: [US],
      shopIds: ["a"],
    });
  });

  it("detects changes in mode, regions and shops, ignoring order", () => {
    const source = { regions: ["US", "GB"], shopIds: ["a", "b"] };
    const same = {
      shopScopeMode: "SPECIFIC" as const,
      regions: [GB, US],
      shopIds: ["b", "a"],
    };
    expect(isShopScopeDraftChanged(same, source)).toBe(false);
    expect(isShopScopeDraftChanged({ ...same, shopIds: ["a"] }, source)).toBe(true);
    expect(isShopScopeDraftChanged({ ...same, regions: [US] }, source)).toBe(true);
    expect(isShopScopeDraftChanged({ ...same, shopScopeMode: "ALL" }, source)).toBe(true);
    // Unrestricted source: leftover arrays in ALL mode are not a change...
    const open = { regions: [], shopIds: [] };
    expect(
      isShopScopeDraftChanged({ shopScopeMode: "ALL", regions: [US], shopIds: [] }, open),
    ).toBe(false);
    // ...but switching to SPECIFIC is, even before anything is picked.
    expect(
      isShopScopeDraftChanged({ shopScopeMode: "SPECIFIC", regions: [], shopIds: [] }, open),
    ).toBe(true);
  });
});

describe("region and shop toggles", () => {
  const base = { shopScopeMode: "SPECIFIC" as const, regions: [], shopIds: ["us-1", "gb-1"] };

  it("drops the region's individually ticked shops when the whole region is granted", () => {
    const next = toggleShopScopeRegion(base, US, true, ["us-1", "us-2"]);
    expect(next.regions).toEqual([US]);
    expect(next.shopIds).toEqual(["gb-1"]);
  });

  it("does not turn a region off into its shops: unticking leaves the shops unticked", () => {
    const granted = toggleShopScopeRegion(base, US, true, ["us-1", "us-2"]);
    const off = toggleShopScopeRegion(granted, US, false, ["us-1", "us-2"]);
    expect(off.regions).toEqual([]);
    expect(off.shopIds).toEqual(["gb-1"]);
  });

  it("toggles a single shop without duplicating it", () => {
    expect(toggleShopScopeShop(base, "us-1", true).shopIds).toEqual(["us-1", "gb-1"]);
    expect(toggleShopScopeShop(base, "us-2", true).shopIds).toEqual(["us-1", "gb-1", "us-2"]);
    expect(toggleShopScopeShop(base, "us-1", false).shopIds).toEqual(["gb-1"]);
  });
});

describe("region state", () => {
  const regionShops = ["us-1", "us-2"];
  const draft = (regions: GQL.ShopRegion[], shopIds: string[]) => ({
    shopScopeMode: "SPECIFIC" as const,
    regions,
    shopIds,
  });

  it("reports a granted region as whole", () => {
    expect(shopScopeRegionState(draft([US], []), "US", regionShops)).toMatchObject({
      wholeRegion: true,
      indeterminate: false,
      everyCurrentShopTickedWithoutRegion: false,
    });
  });

  it("is indeterminate while some shops are ticked individually", () => {
    expect(shopScopeRegionState(draft([], ["us-1"]), "US", regionShops)).toMatchObject({
      wholeRegion: false,
      selectedShopCount: 1,
      indeterminate: true,
      everyCurrentShopTickedWithoutRegion: false,
    });
  });

  it("flags every current shop ticked without the region: later shops would not be included", () => {
    expect(shopScopeRegionState(draft([], ["us-1", "us-2"]), "US", regionShops)).toMatchObject({
      wholeRegion: false,
      indeterminate: true,
      everyCurrentShopTickedWithoutRegion: true,
    });
  });

  it("never flags the region-less group or an empty region", () => {
    expect(shopScopeRegionState(draft([], ["bare"]), null, ["bare"])).toMatchObject({
      everyCurrentShopTickedWithoutRegion: false,
    });
    expect(shopScopeRegionState(draft([], []), "US", [])).toMatchObject({
      everyCurrentShopTickedWithoutRegion: false,
    });
  });
});

describe("quick actions", () => {
  const shops = [
    { id: "us-1", region: "US" },
    { id: "us-2", region: "US" },
    { id: "gb-1", region: "GB" },
    { id: "bare", region: null },
  ];

  it("grants every region that has shops as a whole region and ticks region-less shops", () => {
    const next = grantEveryShopScopeRegion(
      { shopScopeMode: "SPECIFIC", regions: [DE], shopIds: ["us-1"] },
      shops,
    );
    // DE has no shops but was already granted, so it stays.
    expect(next.regions).toEqual([DE, GB, US]);
    expect(next.shopIds).toEqual(["bare"]);
  });

  it("clears both grants but keeps the mode", () => {
    expect(
      clearShopScopeSelection({ shopScopeMode: "SPECIFIC", regions: [US], shopIds: ["a"] }),
    ).toEqual({ shopScopeMode: "SPECIFIC", regions: [], shopIds: [] });
  });

  it("groups shops by region in code order with the region-less group last", () => {
    expect(groupShopIdsByRegion([shops[3], shops[2], shops[0], shops[1]])).toEqual([
      { region: "GB", shopIds: ["gb-1"] },
      { region: "US", shopIds: ["us-1", "us-2"] },
      { region: null, shopIds: ["bare"] },
    ]);
  });
});

describe("scopeShopsFrom and summarizeShopScope", () => {
  const shops = scopeShopsFrom([
    { id: "us-1", platform: "TIKTOK_SHOP", region: "US", shopName: "Shop A" },
    { id: "us-2", platform: "TIKTOK_SHOP", region: "US", alias: "B" },
    { id: "gb-1", platform: "TIKTOK_SHOP", region: "GB", shopName: "Shop C" },
    { id: "other", platform: "SHOPIFY", region: "US" },
  ]);

  it("keeps TikTok shops only", () => {
    expect(shops.map((shop) => shop.id)).toEqual(["us-1", "us-2", "gb-1"]);
  });

  it("lists a granted region once and never repeats its shops", () => {
    const summary = summarizeShopScope({ regions: ["US"], shopIds: ["us-1", "gb-1"] }, shops);
    expect(summary.wholeRegions).toEqual(["US"]);
    expect(summary.shopGroups.map((group) => [group.region, group.shops.map((s) => s.id)])).toEqual(
      [["GB", ["gb-1"]]],
    );
    expect(summary.missingShopCount).toBe(0);
  });

  it("counts granted ids that match no shop", () => {
    const summary = summarizeShopScope({ regions: [], shopIds: ["gb-1", "deleted"] }, shops);
    expect(summary.missingShopCount).toBe(1);
    expect(summary.wholeRegions).toEqual([]);
  });
});

describe("businessDeveloperShopScopeErrorKey", () => {
  const coded = (code: string) => ({ errors: [{ extensions: { code } }] });

  it("maps the two scope refusals to their copy", () => {
    expect(
      businessDeveloperShopScopeErrorKey(coded("AFFILIATE_BUSINESS_DEVELOPER_OUT_OF_SHOP_SCOPE")),
    ).toBe("ecommerce.affiliateTeam.ownerOutOfShopScope");
    expect(
      businessDeveloperShopScopeErrorKey(coded("AFFILIATE_BUSINESS_DEVELOPER_SHOP_NOT_FOUND")),
    ).toBe("ecommerce.affiliateTeam.shopScopeShopNotFound");
  });

  it("leaves every other failure to the caller", () => {
    expect(businessDeveloperShopScopeErrorKey(coded("SOMETHING_ELSE"))).toBeNull();
    expect(businessDeveloperShopScopeErrorKey(new Error("network"))).toBeNull();
  });
});

describe("ownerAssignmentCandidates", () => {
  const developers = [
    { id: "open", regions: [], shopIds: [] },
    { id: "us", regions: ["US"], shopIds: [] },
    { id: "gb-shop", regions: [], shopIds: ["gb-1"] },
    { id: "de", regions: ["DE"], shopIds: [] },
    { id: "archived-open", regions: [], shopIds: [], archivedAt: "2026-01-01T00:00:00Z" },
  ];
  const ids = (items: Array<{ developer: { id: string } }>) => items.map((item) => item.developer.id);

  it("offers only active developers whose scope covers at least one of the Creator's shops", () => {
    const candidates = ownerAssignmentCandidates(developers, ["us-1", "gb-1"], regionByShopId, "");
    expect(ids(candidates)).toEqual(["open", "us", "gb-shop"]);
    expect(candidates.every((candidate) => candidate.covered)).toBe(true);
  });

  it("offers only unrestricted developers for a Creator without shops", () => {
    expect(ids(ownerAssignmentCandidates(developers, [], regionByShopId, ""))).toEqual(["open"]);
  });

  it("keeps an out-of-scope current owner, flagged, but no other out-of-scope developer", () => {
    const candidates = ownerAssignmentCandidates(developers, ["us-1"], regionByShopId, "de");
    expect(ids(candidates)).toEqual(["open", "us", "de"]);
    expect(candidates.find((candidate) => candidate.developer.id === "de")?.covered).toBe(false);
  });
});
