import { describe, expect, it } from "vitest";
import {
  creatorPerformanceIsoDate,
  formatCreatorPerformanceGmv,
  resolveCreatorPerformance,
  resolveCreatorPerformanceFreshness,
  type CreatorPerformanceSource,
} from "./creator-performance-snapshot.js";

const shop = (overrides: Record<string, unknown> = {}) => ({
  lastContentDate: null,
  lastOrderDate: null,
  lastSampleShippedDate: null,
  shippedSampleCount: 0,
  contentCount90d: 0,
  orderCount90d: 0,
  netGmvUsd90d: 12.5,
  netGmvNative90d: null,
  gmvNativeCurrency: null,
  ...overrides,
});

const source = {
  performanceSnapshot: {
    lastContentDate: null,
    lastOrderDate: null,
    lastSampleShippedDate: null,
    shippedSampleCount: 5,
    contentCount90d: 1,
    orderCount90d: 2,
    netGmvUsd90d: 30,
    shopCount: 2,
  },
  shopStates: [
    { shopId: "a", performanceSnapshot: shop({ netGmvNative90d: 250, gmvNativeCurrency: "MXN" }) },
    { shopId: "b", performanceSnapshot: shop() },
    { shopId: "c", performanceSnapshot: null },
  ],
} as CreatorPerformanceSource;

describe("resolveCreatorPerformance", () => {
  it("uses the seller-wide rollup, in USD, without a shop scope", () => {
    expect(resolveCreatorPerformance(source, "")).toMatchObject({
      scope: "ROLLUP",
      shopCount: 2,
      shippedSampleCount: 5,
      gmv: { amount: 30, currency: "USD" },
    });
  });
  it("prefers the shop's native currency, else falls back to USD", () => {
    expect(resolveCreatorPerformance(source, "a")?.gmv).toEqual({ amount: 250, currency: "MXN" });
    expect(resolveCreatorPerformance(source, "b")?.gmv).toEqual({ amount: 12.5, currency: "USD" });
  });
  it("returns nothing for an unreached Creator or shop, never a rollup stand-in or zeros", () => {
    expect(resolveCreatorPerformance(source, "c")).toBeNull();
    expect(resolveCreatorPerformance(source, "unknown")).toBeNull();
    expect(resolveCreatorPerformance({ shopStates: [] }, "")).toBeNull();
    expect(resolveCreatorPerformance(null, "")).toBeNull();
  });
});

describe("resolveCreatorPerformanceFreshness", () => {
  const states = [
    {
      shopId: "a",
      sourceCutoffAt: "2026-11-04T16:00:00.000Z",
      windowEndDate: "2026-11-04T00:00:00.000Z",
    },
    {
      shopId: "b",
      sourceCutoffAt: "2026-11-03T16:00:00.000Z",
      windowEndDate: "2026-11-03T00:00:00.000Z",
    },
  ];
  it("uses the scoped shop's cutoff", () => {
    expect(resolveCreatorPerformanceFreshness(states, "a")?.cutoffAt).toBe(
      "2026-11-04T16:00:00.000Z",
    );
  });
  it("shows the oldest cutoff across shops, since no value is fresher than the slowest shop", () => {
    expect(resolveCreatorPerformanceFreshness(states, "")).toEqual({
      cutoffAt: "2026-11-03T16:00:00.000Z",
      windowEndDate: "2026-11-03T00:00:00.000Z",
    });
  });
  it("is null when the shop has no watermark yet", () => {
    expect(resolveCreatorPerformanceFreshness(states, "z")).toBeNull();
    expect(resolveCreatorPerformanceFreshness([], "")).toBeNull();
  });
});

describe("formatting", () => {
  it("keeps the amount when Intl does not know the currency code", () => {
    expect(formatCreatorPerformanceGmv({ amount: 1500, currency: "ZZZZ" }, "en")).toBe(
      "1,500 ZZZZ",
    );
  });
  it("exports calendar dates in UTC and blanks for absent dates", () => {
    expect(creatorPerformanceIsoDate("2026-10-30T00:00:00.000Z")).toBe("2026-10-30");
    expect(creatorPerformanceIsoDate(null)).toBe("");
  });
});
