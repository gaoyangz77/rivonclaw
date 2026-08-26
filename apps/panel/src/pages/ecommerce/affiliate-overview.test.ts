// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  AFFILIATE_EXACT_SHARE_THRESHOLD,
  AFFILIATE_HORIZON_MIN_COHORT,
  AFFILIATE_SHIPMENT_TRAILING_DAYS,
  applyCoverageWindow,
  buildCoverageBandRows,
  buildInviteDailyRows,
  buildShipmentDailyRows,
  firstImmatureCohortDay,
  buildResponseHorizonSeries,
  countAxisDomain,
  countPartialDays,
  coverageBasis,
  coverageBoundaryMark,
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
 * The producer's shape since the fixed-cohort fix: ONE denominator on every
 * point, and a numerator that only ever rises. Deliberately shuffled, because
 * the ordering is this module's job rather than the server's.
 *
 * The shape it replaced carried a per-horizon denominator that shrank as the
 * horizon widened (620,000 at 3h down to 250,000 at 30d), which let the
 * "cumulative" rate fall between points.
 */
const COHORT_SIZE = 620_000;

const PRODUCTION_HORIZONS: GQL.AffiliateResponseHorizon[] = [
  horizon("7d", COHORT_SIZE, 853),
  horizon("3h", COHORT_SIZE, 258),
  horizon("72h", COHORT_SIZE, 756),
  horizon("30d", COHORT_SIZE, 1011),
  horizon("12h", COHORT_SIZE, 467),
  horizon("14d", COHORT_SIZE, 917),
  horizon("24h", COHORT_SIZE, 594),
];

/** The cohort fields the producer sends alongside `horizons`. */
const COHORT_FIELDS = {
  horizonCohortSize: COHORT_SIZE,
  horizonCohortFrom: "2026-07-01",
  horizonCohortTo: "2026-07-26",
};

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
      ...COHORT_FIELDS,
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
      ...COHORT_FIELDS,
      horizons: PRODUCTION_HORIZONS,
      responsesExact: 11,
      responsesProxy: 89,
    });

    expect(series.subDaySuppressed).toBe(true);
    expect(series.points.map((point) => point.horizon)).toEqual(["72h", "7d", "14d", "30d"]);
  });

  it("suppresses sub-day horizons when there is no response evidence at all", () => {
    const series = buildResponseHorizonSeries({
      ...COHORT_FIELDS,
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
      ...COHORT_FIELDS,
      horizons: PRODUCTION_HORIZONS,
      responsesExact: exact,
      responsesProxy: 100 - exact,
    });

    expect(series.subDaySuppressed).toBe(false);
  });

  it("plots a curve that never falls, over one unchanging denominator", () => {
    const series = buildResponseHorizonSeries({
      ...COHORT_FIELDS,
      horizons: PRODUCTION_HORIZONS,
      responsesExact: 92,
      responsesProxy: 8,
    });

    // The defect this replaced: 3h 0.044% -> 72h 0.114% -> 7d 0.090% -> 30d 0%,
    // measured on production over a 30-day window, because each point divided
    // by its own maturity population instead of one shared cohort.
    const denominators = series.points.map((point) => point.matureInvitations);
    expect(new Set(denominators)).toEqual(new Set([COHORT_SIZE]));

    const counts = series.points.map((point) => point.responsesWithinHorizon);
    const rates = series.points.map((point) => point.responseRate!);
    for (const [index] of counts.entries()) {
      if (index === 0) continue;
      expect(counts[index]).toBeGreaterThanOrEqual(counts[index - 1]);
      expect(rates[index]).toBeGreaterThanOrEqual(rates[index - 1]);
    }
    expect(series.cohortSize).toBe(COHORT_SIZE);
    expect(series.cohortTooSmall).toBe(false);
  });

  it("withholds the whole curve when the cohort is below the resolution floor", () => {
    // The measured 30-day cohort: 32 invitations old enough to judge at 30d,
    // against 415,035 invitations in the window. A rate over 32 rows cannot
    // resolve the ~0.1% it would be drawing.
    const series = buildResponseHorizonSeries({
      ...COHORT_FIELDS,
      horizonCohortSize: 32,
      horizons: PRODUCTION_HORIZONS,
      responsesExact: 92,
      responsesProxy: 8,
    });

    expect(series.cohortTooSmall).toBe(true);
    expect(series.points).toEqual([]);
    expect(series.cohortSize).toBe(32);
  });

  it("draws the curve exactly at the floor, and withholds it one below", () => {
    const atFloor = buildResponseHorizonSeries({
      ...COHORT_FIELDS,
      horizonCohortSize: AFFILIATE_HORIZON_MIN_COHORT,
      horizons: PRODUCTION_HORIZONS,
      responsesExact: 92,
      responsesProxy: 8,
    });
    const belowFloor = buildResponseHorizonSeries({
      ...COHORT_FIELDS,
      horizonCohortSize: AFFILIATE_HORIZON_MIN_COHORT - 1,
      horizons: PRODUCTION_HORIZONS,
      responsesExact: 92,
      responsesProxy: 8,
    });

    expect(atFloor.cohortTooSmall).toBe(false);
    expect(atFloor.points).not.toEqual([]);
    expect(belowFloor.cohortTooSmall).toBe(true);
  });

  it("withholds an empty cohort rather than plotting seven null points", () => {
    const series = buildResponseHorizonSeries({
      ...COHORT_FIELDS,
      horizonCohortSize: 0,
      horizonCohortFrom: null,
      horizonCohortTo: null,
      horizons: PRODUCTION_HORIZONS.map((point) => ({
        ...point, matureInvitations: 0, responsesWithinHorizon: 0, responseRate: null,
      })),
      responsesExact: 0,
      responsesProxy: 0,
    });

    expect(series.cohortTooSmall).toBe(true);
    expect(series.points).toEqual([]);
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

describe("buildShipmentDailyRows", () => {
  function day(ds: string, samplesShipped: number, affiliateUnits: number): GQL.AffiliateShipmentDailyPoint {
    return { ds, samplesShipped, affiliateUnits };
  }

  /**
   * The measured production shape for the reference seller: shipment
   * observation starts 2026-07-22 with two four-sample days, which read 1202
   * and 1150 units per sample, before the series settles into a stable 6-13
   * band from 07-24 on. Two of those points on a shared axis flatten the rest.
   */
  const RAMP_UP: GQL.AffiliateShipmentDailyPoint[] = [
    day("2026-07-21", 0, 5_177),
    day("2026-07-22", 4, 4_808),
    day("2026-07-23", 4, 4_600),
    day("2026-07-24", 512, 4_390),
    day("2026-07-25", 1_429, 4_234),
    day("2026-07-26", 980, 4_910),
    day("2026-07-27", 1_104, 5_301),
    day("2026-07-28", 861, 5_612),
    day("2026-07-29", 1_002, 5_780),
  ];

  it("keeps both daily counts exactly as the producer sent them", () => {
    const rows = buildShipmentDailyRows(RAMP_UP);

    expect(rows.map((row) => row.ds)).toEqual(RAMP_UP.map((point) => point.ds));
    expect(rows.map((row) => row.samplesShipped)).toEqual(RAMP_UP.map((point) => point.samplesShipped));
    expect(rows.map((row) => row.affiliateUnits)).toEqual(RAMP_UP.map((point) => point.affiliateUnits));
  });

  // The boundary is stated by shipmentCoverage, not enforced by dropping days.
  // A day with real units and no shipment observation is the record.
  it("keeps a pre-shipment day carrying real units and zero samples", () => {
    const [first] = buildShipmentDailyRows(RAMP_UP);

    expect(first.samplesShipped).toBe(0);
    expect(first.affiliateUnits).toBe(5_177);
  });

  it("has no ratio until a full trailing window has passed", () => {
    const rows = buildShipmentDailyRows(RAMP_UP);
    const withoutWindow = rows.slice(0, AFFILIATE_SHIPMENT_TRAILING_DAYS - 1);

    expect(withoutWindow).toHaveLength(6);
    for (const row of withoutWindow) expect(row.trailingUnitsPerSample).toBeNull();
    expect(rows[AFFILIATE_SHIPMENT_TRAILING_DAYS - 1].trailingUnitsPerSample).not.toBeNull();
  });

  it("divides summed units by summed samples over the trailing window", () => {
    const rows = buildShipmentDailyRows(RAMP_UP);
    const window = RAMP_UP.slice(0, AFFILIATE_SHIPMENT_TRAILING_DAYS);
    const units = window.reduce((total, point) => total + point.affiliateUnits, 0);
    const samples = window.reduce((total, point) => total + point.samplesShipped, 0);

    expect(rows[AFFILIATE_SHIPMENT_TRAILING_DAYS - 1].trailingUnitsPerSample).toBeCloseTo(units / samples);
  });

  /*
   * The whole point of widening the window rather than filtering days: the
   * two four-sample days read 1202 and 1150 on their own, and the trailing
   * ratio absorbs them into the same order of magnitude as the rest of the
   * series. No cutoff, no minimum denominator, no estimate.
   */
  it("absorbs the ramp-up instead of spiking three orders of magnitude", () => {
    const ratios = buildShipmentDailyRows(RAMP_UP)
      .map((row) => row.trailingUnitsPerSample)
      .filter((value): value is number => value != null);

    expect(ratios.length).toBeGreaterThan(0);
    for (const ratio of ratios) expect(ratio).toBeLessThan(20);
    // Left as a raw per-day ratio, day two alone would have been this.
    expect(RAMP_UP[1].affiliateUnits / RAMP_UP[1].samplesShipped).toBeGreaterThan(1_000);
  });

  it("reports no ratio, never a zero, when the trailing window shipped nothing", () => {
    const rows = buildShipmentDailyRows([
      day("2026-07-15", 0, 4_100),
      day("2026-07-16", 0, 4_250),
      day("2026-07-17", 0, 3_980),
    ], 2);

    expect(rows.map((row) => row.trailingUnitsPerSample)).toEqual([null, null, null]);
  });

  it("uses only the trailing window, not the whole series to date", () => {
    const rows = buildShipmentDailyRows([
      day("2026-08-01", 100, 100),
      day("2026-08-02", 100, 100),
      day("2026-08-03", 10, 100),
    ], 2);

    // Last two days: (100 + 100) / (100 + 10) — the first day is outside it.
    expect(rows[2].trailingUnitsPerSample).toBeCloseTo(200 / 110);
  });

  it("returns nothing for an empty series rather than a placeholder point", () => {
    expect(buildShipmentDailyRows([])).toEqual([]);
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

  it("keeps every day by default — the boundary informs, it does not truncate", () => {
    const rows = [{ ds: "2026-07-30" }, { ds: "2026-08-01" }, { ds: "2026-08-02" }];
    const dsOf = (row: { ds: string }) => row.ds;

    expect(applyCoverageWindow(rows, dsOf, "2026-08-01", false).map(dsOf))
      .toEqual(["2026-07-30", "2026-08-01", "2026-08-02"]);
    // Narrowing is opt-in, and still available.
    expect(applyCoverageWindow(rows, dsOf, "2026-08-01", true).map(dsOf))
      .toEqual(["2026-08-01", "2026-08-02"]);
    expect(applyCoverageWindow(rows, dsOf, null, false)).toHaveLength(3);
    expect(applyCoverageWindow(rows, dsOf, null, true)).toHaveLength(3);
  });

  it("never lets one late shop erase the history of older ones", () => {
    // The measured case: a German shop covered from 2026-08-06 with 99 rows and
    // 0 units, and a UK shop from 2026-08-04 with 808 rows and 0 units, set the
    // boundary for three US shops covered from 2026-05-15 carrying 81,627 rows
    // and 142,397 units. Truncating by default deleted the US history.
    const usHistory = ["2026-05-15", "2026-06-20", "2026-07-15", "2026-08-01"];
    const rows = [...usHistory, "2026-08-06", "2026-08-20"].map((ds) => ({ ds }));
    const dsOf = (row: { ds: string }) => row.ds;

    const shown = applyCoverageWindow(rows, dsOf, "2026-08-06", false).map(dsOf);
    for (const ds of usHistory) expect(shown).toContain(ds);
    expect(shown).toHaveLength(rows.length);
  });

  it("counts the days that sit before the boundary without removing them", () => {
    expect(countPartialDays(["2026-07-30", "2026-08-01", "2026-08-02"], "2026-08-01")).toBe(1);
    expect(countPartialDays(["2026-07-30"], null)).toBe(1);
  });

  it("marks the boundary only where it is a plotted day with history behind it", () => {
    const dates = ["2026-07-30", "2026-08-01", "2026-08-02"];

    expect(coverageBoundaryMark(dates, "2026-08-01")).toBe("2026-08-01");
    // Nothing before it: the mark would separate the series from nothing.
    expect(coverageBoundaryMark(dates, "2026-07-30")).toBeNull();
    // A categorical axis cannot place a line on a day it does not plot.
    expect(coverageBoundaryMark(dates, "2026-07-31")).toBeNull();
    expect(coverageBoundaryMark(dates, null)).toBeNull();
    expect(coverageBoundaryMark([], "2026-08-01")).toBeNull();
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
