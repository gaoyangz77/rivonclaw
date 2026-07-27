import { describe, expect, it } from "vitest";
import {
  buildSpsMarketChart,
  buildSpsYAxisDomain,
  displayShopName,
  formatSpsValue,
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
});
