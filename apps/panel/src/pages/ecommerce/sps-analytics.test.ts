import { describe, expect, it } from "vitest";
import {
  buildSpsMarketChart,
  buildSpsQueryShopIds,
  buildSpsYAxisDomain,
  defaultSpsShopSelection,
  displayShopName,
  formatSpsValue,
  isSpsLiveCandidate,
  isSpsShopSelectionError,
  reconcileSpsShopSelection,
  type SpsScopeShop,
} from "./sps-analytics.js";

describe("SPS analytics chart helpers", () => {
  it("pivots available shop trends into one market chart without inventing points", () => {
    const chart = buildSpsMarketChart([
      {
        availability: "AVAILABLE",
        shopAlias: "West",
        shopId: "shop-a",
        shopName: "West LLC",
        trend: [
          { recordDate: "2026-07-25", value: 91 },
          { recordDate: "2026-07-26", value: 93 },
        ],
      },
      {
        availability: "AVAILABLE",
        shopAlias: null,
        shopId: "shop-b",
        shopName: "East",
        trend: [{ recordDate: "2026-07-26", value: 88 }],
      },
      {
        availability: "UNSUPPORTED_REGION",
        shopAlias: "Mexico",
        shopId: "shop-mx",
        shopName: "Mexico",
        trend: [{ recordDate: "2026-07-26", value: 100 }],
      },
    ]);

    expect(chart.series).toEqual([
      { shopId: "shop-a", shopName: "West" },
      { shopId: "shop-b", shopName: "East" },
    ]);
    expect(chart.rows).toEqual([
      { recordDate: "2026-07-25", "shop-a": 91 },
      { recordDate: "2026-07-26", "shop-a": 93, "shop-b": 88 },
    ]);
  });

  it("uses the alias only when it is meaningful and formats supported units", () => {
    expect(displayShopName({ shopAlias: "  ", shopName: "Fallback" })).toBe("Fallback");
    expect(formatSpsValue(97.123, "%", "en-US")).toBe("97.12%");
    expect(formatSpsValue(97.123, "%", "de-DE")).toBe("97,12 %");
    expect(formatSpsValue(75, "seconds", "en-US")).toBe("75s");
    expect(formatSpsValue(1_234.5, undefined, "de-DE")).toBe("1.234,5");
    expect(formatSpsValue(null, "%", "th-TH")).toBe("—");
  });

  it("zooms the Y axis to the visible percentage range", () => {
    expect(buildSpsYAxisDomain([99.89, 99.95, 100], "%")).toEqual([99.8, 100]);
    expect(buildSpsYAxisDomain([0.6, 0.8, 1.2], "percent")).toEqual([0.4, 1.4]);
    expect(buildSpsYAxisDomain([100, 100], "%")).toEqual([99.5, 100]);
  });

  it("keeps a useful domain for non-percentage and empty series", () => {
    expect(buildSpsYAxisDomain([4.7, 4.9], "score")).toEqual([4.6, 5]);
    expect(buildSpsYAxisDomain([], "%")).toEqual([0, 1]);
  });

  it("limits chart series without adding points from hidden shops", () => {
    const chart = buildSpsMarketChart(
      [
        {
          availability: "AVAILABLE",
          shopAlias: "First",
          shopId: "shop-a",
          shopName: "First",
          trend: [{ recordDate: "2026-07-26", value: 93 }],
        },
        {
          availability: "AVAILABLE",
          shopAlias: "Second",
          shopId: "shop-b",
          shopName: "Second",
          trend: [{ recordDate: "2026-07-26", value: 88 }],
        },
      ],
      1,
    );

    expect(chart.series).toEqual([{ shopId: "shop-a", shopName: "First" }]);
    expect(chart.rows).toEqual([{ recordDate: "2026-07-26", "shop-a": 93 }]);
  });
});

describe("SPS shop scope helpers", () => {
  const scopeShop = (id: string, overrides: Partial<SpsScopeShop> = {}): SpsScopeShop => ({
    id,
    shopName: id,
    alias: null,
    region: "US",
    platform: "TIKTOK_SHOP",
    authStatus: "AUTHORIZED",
    ...overrides,
  });

  it("identifies the shops that consume live SPS capacity", () => {
    expect(isSpsLiveCandidate(scopeShop("us"))).toBe(true);
    expect(isSpsLiveCandidate(scopeShop("mx", { region: "MX" }))).toBe(false);
    expect(isSpsLiveCandidate(scopeShop("expired", { authStatus: "EXPIRED" }))).toBe(false);
  });

  it("selects every shop up to the limit and requires a choice above it", () => {
    const fifty = Array.from({ length: 50 }, (_, index) => scopeShop(`shop-${index}`));
    const fiftyOne = [...fifty, scopeShop("shop-50")];

    expect(defaultSpsShopSelection(fifty)).toHaveLength(50);
    expect(defaultSpsShopSelection(fiftyOne)).toEqual([]);
  });

  it("drops unavailable ids and keeps the selection within the limit", () => {
    const shops = [scopeShop("shop-a"), scopeShop("shop-b")];
    expect(reconcileSpsShopSelection(["missing", "shop-b", "shop-a"], shops, 1)).toEqual([
      "shop-b",
    ]);
  });

  it("queries only selected shops that can use the SPS Open API", () => {
    const shops = [
      scopeShop("live-a"),
      scopeShop("live-b"),
      scopeShop("mx", { region: "MX" }),
      scopeShop("expired", { authStatus: "EXPIRED" }),
    ];

    expect(buildSpsQueryShopIds(shops, ["live-b"])).toEqual(["live-b"]);
  });

  it("recognizes the structured backend selection error", () => {
    expect(
      isSpsShopSelectionError({
        errors: [{ extensions: { code: "SPS_SHOP_SELECTION_REQUIRED" } }],
      }),
    ).toBe(true);
    expect(isSpsShopSelectionError(new Error("network unavailable"))).toBe(false);
  });
});
