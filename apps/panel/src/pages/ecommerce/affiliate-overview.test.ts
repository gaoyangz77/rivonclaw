// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  AFFILIATE_EXACT_SHARE_THRESHOLD,
  applyCoverageWindow,
  buildCohortUnitsRows,
  buildCoverageBandRows,
  buildInviteDailyRows,
  firstImmatureCohortDay,
  buildResponseHorizonSeries,
  countAxisDomain,
  countImmatureCohorts,
  countPartialDays,
  coverageBasis,
  coverageShopLabel,
  exactSubmissionShare,
  isFullyCoveredDay,
  orderResponseHorizons,
  rateAxisDomain,
  safeShare,
  splitCoverageSeries,
} from "./affiliate-overview.js";
import type { GQL } from "@rivonclaw/core";

function horizon(
  key: string,
  matureInvitations: number,
  responsesWithinHorizon: number,
): GQL.AffiliateResponseHorizon {
  return {
    horizon: key,
    matureInvitations,
    responsesWithinHorizon,
    responseRate: matureInvitations > 0 ? responsesWithinHorizon / matureInvitations : null,
  };
}

/**
 * Production shape: the raw numerator is NOT monotone across horizons because
 * it is gated on invitation maturity (within_72h = 749 > within_7d = 627).
 */
const PRODUCTION_HORIZONS: GQL.AffiliateResponseHorizon[] = [
  horizon("7d", 400_000, 627),
  horizon("3h", 620_000, 210),
  horizon("72h", 540_000, 749),
  horizon("30d", 250_000, 430),
  horizon("12h", 610_000, 320),
  horizon("14d", 340_000, 540),
  horizon("24h", 600_000, 500),
];

describe("safeShare", () => {
  it("returns null instead of dividing by an empty denominator", () => {
    expect(safeShare(4, 0)).toBeNull();
    expect(safeShare(0, 0)).toBeNull();
    expect(safeShare(1, 4)).toBe(0.25);
  });
});

describe("exactSubmissionShare", () => {
  it("measures exact submissions against all recorded responses", () => {
    expect(exactSubmissionShare({ responsesExact: 92, responsesProxy: 8 })).toBeCloseTo(0.92);
    expect(exactSubmissionShare({ responsesExact: 11, responsesProxy: 89 })).toBeCloseTo(0.11);
  });

  it("is null when the cohort recorded no response at all", () => {
    expect(exactSubmissionShare({ responsesExact: 0, responsesProxy: 0 })).toBeNull();
  });
});

describe("orderResponseHorizons", () => {
  it("restores the canonical 3h → 30d order regardless of server order", () => {
    expect(orderResponseHorizons(PRODUCTION_HORIZONS).map((point) => point.horizon))
      .toEqual(["3h", "12h", "24h", "72h", "7d", "14d", "30d"]);
  });

  it("keeps an unrecognised horizon at the end rather than dropping it", () => {
    const ordered = orderResponseHorizons([horizon("90d", 10, 1), horizon("7d", 10, 2)]);
    expect(ordered.map((point) => point.horizon)).toEqual(["7d", "90d"]);
  });
});

describe("buildResponseHorizonSeries", () => {
  it("keeps sub-day horizons when the exact-submission share is high", () => {
    const series = buildResponseHorizonSeries({
      horizons: PRODUCTION_HORIZONS,
      responsesExact: 92,
      responsesProxy: 8,
    });

    expect(series.subDaySuppressed).toBe(false);
    expect(series.points.map((point) => point.horizon))
      .toEqual(["3h", "12h", "24h", "72h", "7d", "14d", "30d"]);
    expect(series.exactShare).toBeCloseTo(0.92);
  });

  it("suppresses 3h/12h/24h when most response times are proxies", () => {
    const series = buildResponseHorizonSeries({
      horizons: PRODUCTION_HORIZONS,
      responsesExact: 11,
      responsesProxy: 89,
    });

    expect(series.subDaySuppressed).toBe(true);
    expect(series.points.map((point) => point.horizon)).toEqual(["72h", "7d", "14d", "30d"]);
  });

  it("suppresses sub-day horizons when there is no response evidence at all", () => {
    const series = buildResponseHorizonSeries({
      horizons: PRODUCTION_HORIZONS,
      responsesExact: 0,
      responsesProxy: 0,
    });

    expect(series.exactShare).toBeNull();
    expect(series.subDaySuppressed).toBe(true);
  });

  it("treats the threshold as inclusive of the passing side", () => {
    const exact = Math.round(AFFILIATE_EXACT_SHARE_THRESHOLD * 100);
    const series = buildResponseHorizonSeries({
      horizons: PRODUCTION_HORIZONS,
      responsesExact: exact,
      responsesProxy: 100 - exact,
    });

    expect(series.subDaySuppressed).toBe(false);
  });

  it("plots only rates — the raw numerator it carries is non-monotone", () => {
    const series = buildResponseHorizonSeries({
      horizons: PRODUCTION_HORIZONS,
      responsesExact: 92,
      responsesProxy: 8,
    });
    const within72h = series.points.find((point) => point.horizon === "72h")!;
    const within7d = series.points.find((point) => point.horizon === "7d")!;

    expect(within72h.responsesWithinHorizon).toBeGreaterThan(within7d.responsesWithinHorizon);
    expect(within72h.responseRate!).toBeLessThan(within7d.responseRate!);
  });
});

describe("rateAxisDomain", () => {
  it("fills the axis for a sub-percent rate instead of hardcoding [0, 1]", () => {
    const [lower, upper] = rateAxisDomain([0.0011, 0.0015, 0.0013]);

    expect(lower).toBe(0);
    expect(upper).toBeCloseTo(0.002);
    expect(upper).toBeLessThan(0.01);
  });

  it("leaves headroom above the largest point", () => {
    const [, upper] = rateAxisDomain([0.42]);
    expect(upper).toBeGreaterThan(0.42);
  });

  it("respects a cap for series bounded at 1 by construction", () => {
    expect(rateAxisDomain([0.2, 0.75, 1], 1)).toEqual([0, 1]);
  });

  it("ignores nulls and non-finite values", () => {
    const [, upper] = rateAxisDomain([null, undefined, Number.NaN, 0.03]);
    expect(upper).toBeGreaterThan(0.03);
    expect(upper).toBeLessThan(0.1);
  });

  it("falls back to the cap when nothing positive is present", () => {
    expect(rateAxisDomain([0, null], 1)).toEqual([0, 1]);
    expect(rateAxisDomain([])).toEqual([0, 1]);
  });
});

describe("countAxisDomain", () => {
  it("rounds up to a readable ceiling", () => {
    const [lower, upper] = countAxisDomain([120, 830, 640]);
    expect(lower).toBe(0);
    expect(upper).toBeGreaterThanOrEqual(830);
    expect(upper).toBeLessThanOrEqual(1000);
  });

  it("keeps an empty series from collapsing the axis", () => {
    expect(countAxisDomain([])).toEqual([0, 1]);
  });
});

describe("buildInviteDailyRows", () => {
  const daily: GQL.AffiliateInviteDailyPoint[] = [
    { inviteDs: "2026-06-01", invitations: 8_000, responded: 9, mature: true },
    { inviteDs: "2026-08-20", invitations: 6_400, responded: 1, mature: false },
  ];

  it("keeps invitations in one series and derives the response rate", () => {
    expect(buildInviteDailyRows(daily)).toEqual([
      { inviteDs: "2026-06-01", mature: true, invitations: 8_000, responded: 9, responseRate: 9 / 8_000 },
      { inviteDs: "2026-08-20", mature: false, invitations: 6_400, responded: 1, responseRate: 1 / 6_400 },
    ]);
  });

  // Maturity is a property of the cohort DAY: every invitation on a day shares
  // one age, so a day is entirely mature or entirely not. Splitting it into two
  // stacked bar series rendered two segments that could never coexist, which
  // read as "part of this day is mature" - a state that cannot occur. The
  // immature span is a background band instead.
  it("exposes maturity as a per-day flag, not a split within the day", () => {
    for (const row of buildInviteDailyRows(daily)) {
      expect(typeof row.mature).toBe("boolean");
      expect(row.invitations).toBeGreaterThan(0);
    }
  });

  it("reports null response rate rather than zero when a day had no invitations", () => {
    const [row] = buildInviteDailyRows([
      { inviteDs: "2026-07-04", invitations: 0, responded: 0, mature: true } as GQL.AffiliateInviteDailyPoint,
    ]);
    expect(row.responseRate).toBeNull();
  });

  // Deliberately NOT suppressed by a denominator floor: a 3-invitation cohort
  // reading 66.7% is a symptom of missing collaboration detail upstream, and
  // masking it here would disguise incomplete data as small-sample noise.
  it("reports the real rate for a tiny cohort instead of hiding it", () => {
    const [row] = buildInviteDailyRows([
      { inviteDs: "2026-06-05", invitations: 3, responded: 2, mature: true } as GQL.AffiliateInviteDailyPoint,
    ]);
    expect(row.responseRate).toBeCloseTo(2 / 3);
  });
});

describe("firstImmatureCohortDay", () => {
  it("returns the left edge of the immature band", () => {
    const rows = buildInviteDailyRows([
      { inviteDs: "2026-06-01", invitations: 800, responded: 9, mature: true },
      { inviteDs: "2026-08-20", invitations: 640, responded: 1, mature: false },
      { inviteDs: "2026-08-21", invitations: 610, responded: 0, mature: false },
    ] as GQL.AffiliateInviteDailyPoint[]);
    expect(firstImmatureCohortDay(rows)).toBe("2026-08-20");
  });

  it("returns null when every day in the window is mature", () => {
    const rows = buildInviteDailyRows([
      { inviteDs: "2026-06-01", invitations: 800, responded: 9, mature: true } as GQL.AffiliateInviteDailyPoint,
    ]);
    expect(firstImmatureCohortDay(rows)).toBeNull();
  });
});

describe("buildCohortUnitsRows", () => {
  function cohort(overrides: Partial<GQL.AffiliateCohortUnitsPoint>): GQL.AffiliateCohortUnitsPoint {
    return {
      cohortDs: "2026-08-01",
      approvedApplications: 40,
      actualUnits: 30,
      projectedRemainingUnits: 0,
      completionFactor: 1,
      ageDays: 60,
      ...overrides,
    };
  }

  it("marks a cohort with an outstanding projection as immature", () => {
    const [row] = buildCohortUnitsRows([cohort({ projectedRemainingUnits: 12.5, completionFactor: 0.7, ageDays: 9 })]);

    expect(row.projectedRemainingUnits).toBeCloseTo(12.5);
    expect(row.immature).toBe(true);
  });

  it("leaves a fully mature cohort without a projection segment", () => {
    const [row] = buildCohortUnitsRows([cohort({})]);

    expect(row.projectedRemainingUnits).toBe(0);
    expect(row.immature).toBe(false);
  });

  it("never projects a day-0 cohort, which has no signal", () => {
    const [row] = buildCohortUnitsRows([cohort({ ageDays: 0, projectedRemainingUnits: 99, completionFactor: null })]);

    expect(row.projectedRemainingUnits).toBe(0);
    expect(row.immature).toBe(false);
  });

  it("clamps a negative or non-finite projection at zero", () => {
    const rows = buildCohortUnitsRows([
      cohort({ projectedRemainingUnits: -4, ageDays: 5 }),
      cohort({ projectedRemainingUnits: null, ageDays: 5, completionFactor: 1 }),
    ]);

    expect(rows.map((row) => row.projectedRemainingUnits)).toEqual([0, 0]);
  });

  it("counts the cohorts still accruing units", () => {
    const rows = buildCohortUnitsRows([
      cohort({ projectedRemainingUnits: 3, completionFactor: 0.8, ageDays: 4 }),
      cohort({ completionFactor: 0.5, ageDays: 2 }),
      cohort({}),
    ]);

    expect(countImmatureCohorts(rows)).toBe(2);
  });
});

describe("coverage boundary shaping", () => {
  const coverage: GQL.AffiliateCoverage = {
    fullCoverageFrom: "2026-08-01",
    shopsSelected: 4,
    limitingShops: [{ shopId: "shop-late", shopName: "Late Shop", coverageFrom: "2026-08-01" }],
    shops: [
      { shopId: "shop-early", shopName: "Early Shop", coverageFrom: "2026-05-01" },
      { shopId: "shop-mid", shopName: "Mid Shop", coverageFrom: "2026-06-15" },
      { shopId: "shop-late", shopName: "Late Shop", coverageFrom: "2026-08-01" },
      { shopId: "shop-empty", shopName: "Empty Shop", coverageFrom: null },
    ],
    daily: [
      { ds: "2026-07-30", shopsWithData: 2 },
      { ds: "2026-08-01", shopsWithData: 3 },
      { ds: "2026-08-02", shopsWithData: 3 },
    ],
  };

  it("fills the band to the selected scope so the empty part is visible", () => {
    expect(buildCoverageBandRows(coverage)).toEqual([
      { ds: "2026-07-30", shopsWithData: 2, shopsMissing: 2 },
      { ds: "2026-08-01", shopsWithData: 3, shopsMissing: 1 },
      { ds: "2026-08-02", shopsWithData: 3, shopsMissing: 1 },
    ]);
  });

  it("treats an absent boundary as nothing covered, never as everything covered", () => {
    expect(isFullyCoveredDay("2026-08-02", null)).toBe(false);
    expect(isFullyCoveredDay("2026-07-31", "2026-08-01")).toBe(false);
    expect(isFullyCoveredDay("2026-08-01", "2026-08-01")).toBe(true);
  });

  it("truncates a series at the boundary by default and restores it on request", () => {
    const rows = [{ ds: "2026-07-30" }, { ds: "2026-08-01" }, { ds: "2026-08-02" }];
    const dsOf = (row: { ds: string }) => row.ds;

    expect(applyCoverageWindow(rows, dsOf, "2026-08-01", false).map(dsOf))
      .toEqual(["2026-08-01", "2026-08-02"]);
    expect(applyCoverageWindow(rows, dsOf, "2026-08-01", true).map(dsOf))
      .toEqual(["2026-07-30", "2026-08-01", "2026-08-02"]);
    // With no boundary there is nothing to truncate against, so the caller must
    // still see its rows rather than an empty chart.
    expect(applyCoverageWindow(rows, dsOf, null, false)).toHaveLength(3);
  });

  it("counts the days that would be dropped", () => {
    expect(countPartialDays(["2026-07-30", "2026-08-01", "2026-08-02"], "2026-08-01")).toBe(1);
    expect(countPartialDays(["2026-07-30"], null)).toBe(1);
  });

  it("splits a series into a solid covered half and a dashed partial half", () => {
    const rows = [
      { ds: "2026-07-30", rate: 0.1 },
      { ds: "2026-08-01", rate: 0.2 },
      { ds: "2026-08-02", rate: 0.3 },
    ];
    const split = splitCoverageSeries(rows, (row) => row.ds, (row) => row.rate, "2026-08-01");

    expect(split.map((row) => [row.coveredValue, row.partialValue])).toEqual([
      [null, 0.1],
      // The boundary day carries both, so the dashed segment meets the solid
      // one instead of leaving a gap where only the population changed.
      [0.2, 0.2],
      [0.3, null],
    ]);
    expect(split.map((row) => row.covered)).toEqual([false, true, true]);
  });

  it("reports a non-finite value as absent rather than as zero", () => {
    const split = splitCoverageSeries(
      [{ ds: "2026-08-02", rate: null }],
      (row) => row.ds,
      (row) => row.rate,
      "2026-08-01",
    );
    expect(split[0].coveredValue).toBeNull();
  });

  it("states the basis as shops with data out of the selected scope", () => {
    expect(coverageBasis(coverage)).toEqual({
      shopsSelected: 4,
      shopsWithData: 3,
      fullCoverageFrom: "2026-08-01",
    });
  });

  it("labels a shop by name and falls back to its id, never to an empty string", () => {
    expect(coverageShopLabel({ shopId: "shop-1", shopName: "North Shop" })).toBe("North Shop");
    expect(coverageShopLabel({ shopId: "shop-1", shopName: "  " })).toBe("shop-1");
    expect(coverageShopLabel({ shopId: "shop-1", shopName: null })).toBe("shop-1");
  });
});
