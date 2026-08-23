import { describe, expect, it } from "vitest";
import {
  PLATFORM_DATASET,
  SAMPLE_DATASET,
  automaticAffiliateChartMode,
  buildAffiliateStackedChartData,
  defaultAffiliateDateRange,
  isAffiliateGroupingLegal,
  nextAffiliateDatasetDraft,
  relativeDelta,
  safeRatio,
  summarizeAffiliateRows,
  upsertAffiliateFilter,
} from "./affiliate-analytics.js";

const groupingSets = [
  { dimensions: [] },
  { dimensions: ["CAMPAIGN_ID"] },
  { dimensions: ["CREATOR_OPEN_ID"] },
  { dimensions: ["CAMPAIGN_ID", "CREATOR_OPEN_ID"] },
];

describe("Affiliate Analytics UI semantics", () => {
  it("uses the inclusive latest 30 ds days with an exclusive backend boundary", () => {
    expect(defaultAffiliateDateRange(new Date("2026-08-23T22:00:00Z"))).toEqual({
      startDateGe: "2026-07-25",
      endDateLt: "2026-08-24",
    });
  });

  it("does not invent ratios or deltas for zero denominators", () => {
    expect(safeRatio(4, 10)).toBe(0.4);
    expect(safeRatio(4, 0)).toBeNull();
    expect(relativeDelta(12, 10)).toBe(0.2);
    expect(relativeDelta(12, 0)).toBeNull();
  });

  it("uses dimensions and filters together for grouping legality", () => {
    expect(isAffiliateGroupingLegal(["DATE", "CAMPAIGN_NAME"], ["CREATOR_USERNAME"], groupingSets)).toBe(true);
    expect(isAffiliateGroupingLegal(["CAMPAIGN_ID", "PRODUCT_ID"], ["CREATOR_OPEN_ID"], groupingSets)).toBe(false);
  });

  it("resets incompatible query state when switching contracts", () => {
    const switched = nextAffiliateDatasetDraft({
      datasetId: PLATFORM_DATASET,
      shopIds: ["shop-1"],
      granularity: "DAILY",
      startDateGe: "2026-08-01",
      endDateLt: "2026-09-01",
      dimensions: ["CAMPAIGN_ID"],
      metrics: ["AFFILIATE_TARGET_RESPONSE_RATE"],
      filters: [{ dimension: "CAMPAIGN_ID", operator: "IN", values: ["campaign-1"] }],
      sortField: "AFFILIATE_TARGET_RESPONSE_RATE",
      sortDirection: "DESC",
      limit: 100,
    }, SAMPLE_DATASET);
    expect(switched.dimensions).toEqual(["DATE"]);
    expect(switched.filters).toEqual([]);
    expect(switched.metrics).toContain("AFFILIATE_APPLICATIONS_CREATED");
  });

  it("selects chart modes from the query shape", () => {
    expect(automaticAffiliateChartMode(["DATE", "CAMPAIGN_ID"])).toBe("LINE");
    expect(automaticAffiliateChartMode(["CREATOR_OPEN_ID"])).toBe("BAR");
    expect(automaticAffiliateChartMode(["CAMPAIGN_ID", "CREATOR_OPEN_ID"])).toBe("STACKED");
  });

  it("pivots a legal two-entity result into additive stacked series", () => {
    expect(buildAffiliateStackedChartData([
      { CAMPAIGN_NAME: "Launch", CREATOR_USERNAME: "alice", AFFILIATE_ORDERS: 2 },
      { CAMPAIGN_NAME: "Launch", CREATOR_USERNAME: "bob", AFFILIATE_ORDERS: 3 },
      { CAMPAIGN_NAME: "Always on", CREATOR_USERNAME: "alice", AFFILIATE_ORDERS: 4 },
    ], ["CAMPAIGN_NAME", "CREATOR_USERNAME"], "AFFILIATE_ORDERS")).toEqual({
      categoryDimension: "CAMPAIGN_NAME",
      rows: [
        { category: "Launch", CAMPAIGN_NAME: "Launch", series_0: 2, series_1: 3 },
        { category: "Always on", CAMPAIGN_NAME: "Always on", series_0: 4 },
      ],
      series: [
        { key: "series_0", label: "alice" },
        { key: "series_1", label: "bob" },
      ],
    });
  });

  it("recomputes rates from total components and preserves mixed native currency", () => {
    expect(summarizeAffiliateRows([
      { AFFILIATE_TARGET_SAMPLE_RESPONSES: 2, AFFILIATE_TARGET_CREATORS_INVITED: 4, AFFILIATE_TARGET_RESPONSE_RATE: 0.5, AFFILIATE_NET_GMV_NATIVE: 12 },
      { AFFILIATE_TARGET_SAMPLE_RESPONSES: 1, AFFILIATE_TARGET_CREATORS_INVITED: 6, AFFILIATE_TARGET_RESPONSE_RATE: 1 / 6, AFFILIATE_NET_GMV_NATIVE: null },
    ], ["AFFILIATE_TARGET_RESPONSE_RATE", "AFFILIATE_NET_GMV_NATIVE"])).toEqual({
      AFFILIATE_TARGET_RESPONSE_RATE: 0.3,
      AFFILIATE_NET_GMV_NATIVE: null,
    });
  });

  it("replaces one dimension filter without duplicating its breadcrumb", () => {
    expect(upsertAffiliateFilter([
      { dimension: "CAMPAIGN_ID", operator: "IN", values: ["a"] },
    ], { dimension: "CAMPAIGN_ID", operator: "NOT_IN", values: ["b"] })).toEqual([
      { dimension: "CAMPAIGN_ID", operator: "NOT_IN", values: ["b"] },
    ]);
  });
});
