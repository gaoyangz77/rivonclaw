/**
 * Affiliate Overview — pure data shaping.
 *
 * No React, no i18n, no Apollo. Every function here is covered by
 * `affiliate-overview.test.ts` against fixtures, because the backend resolvers
 * land separately and cannot be exercised from the Panel test suite.
 */

import type { GQL } from "@rivonclaw/core";
import {
  AFFILIATE_RESPONSE_HORIZONS,
  AFFILIATE_SUB_DAY_HORIZONS,
  type AffiliateHorizonCohortFields,
} from "./affiliate-overview-types.js";

/**
 * Sub-day horizons are only interpretable where most response times are real
 * platform submission timestamps. Measured exact share: 2026-08 = 92%,
 * 2026-06 = 11% — below this bar a 3h/12h/24h point is a misleading zero.
 */
export const AFFILIATE_EXACT_SHARE_THRESHOLD = 0.6;

/**
 * Smallest horizon cohort that can carry a curve at all.
 *
 * This is a resolution floor, not a taste threshold. The curve reports a rate,
 * and the smallest non-zero rate a cohort of N can express is 1/N. Response
 * rates on this page run around 0.1%, so below N = 1,000 the chart cannot
 * resolve the quantity it is drawing: every point collapses to either zero or a
 * spike an order of magnitude above the true rate. The measured 30-day cohort
 * that exposed this was 32 invitations — a curve drawn from a rounding error.
 */
export const AFFILIATE_HORIZON_MIN_COHORT = 1000;

const HORIZON_ORDER = new Map(AFFILIATE_RESPONSE_HORIZONS.map((horizon, index) => [horizon as string, index]));

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function safeShare(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

/**
 * Share of responses whose time came from an EXACT_SUBMISSION_EVENT rather than
 * an observation proxy. `null` when the cohort recorded no response at all.
 */
export function exactSubmissionShare(section: Pick<GQL.AffiliateReachoutSection, "responsesExact" | "responsesProxy">): number | null {
  return safeShare(section.responsesExact, section.responsesExact + section.responsesProxy);
}

/** Canonical horizon ordering; unrecognised horizons keep their relative order at the end. */
export function orderResponseHorizons(horizons: readonly GQL.AffiliateResponseHorizon[]): GQL.AffiliateResponseHorizon[] {
  return [...horizons].sort((left, right) => {
    const leftIndex = HORIZON_ORDER.get(left.horizon) ?? AFFILIATE_RESPONSE_HORIZONS.length;
    const rightIndex = HORIZON_ORDER.get(right.horizon) ?? AFFILIATE_RESPONSE_HORIZONS.length;
    return leftIndex - rightIndex;
  });
}

export interface AffiliateHorizonSeries {
  /** Ordered horizons that may be plotted. Empty when the cohort is too small. */
  points: GQL.AffiliateResponseHorizon[];
  /** Share of responses carrying an exact submission timestamp, or null. */
  exactShare: number | null;
  /** True when 3h/12h/24h were withheld because the exact share is too low. */
  subDaySuppressed: boolean;
  /** The one denominator behind every point. */
  cohortSize: number;
  /** True when the whole curve is withheld for resting on too few invitations. */
  cohortTooSmall: boolean;
}

/**
 * Builds the plottable horizon series.
 *
 * Two independent suppressions, because they answer different questions and a
 * reader told the wrong one would go looking in the wrong place:
 *
 *  - sub-day horizons are dropped when the exact-submission share is too low,
 *    since a 3h point computed off a day-coarse proxy is an artefact;
 *  - the WHOLE curve is dropped when the fixed cohort is below the resolution
 *    floor, since no amount of correct arithmetic makes a rate over 32
 *    invitations informative.
 *
 * Neither zeroes anything. A suppressed point is absent and named as absent.
 */
export function buildResponseHorizonSeries(
  section: Pick<GQL.AffiliateReachoutSection, "horizons" | "responsesExact" | "responsesProxy">
    & AffiliateHorizonCohortFields,
  threshold = AFFILIATE_EXACT_SHARE_THRESHOLD,
  minCohort = AFFILIATE_HORIZON_MIN_COHORT,
): AffiliateHorizonSeries {
  const exactShare = exactSubmissionShare(section);
  const subDaySuppressed = exactShare == null || exactShare < threshold;
  const cohortSize = section.horizonCohortSize;
  const cohortTooSmall = cohortSize < minCohort;
  const ordered = orderResponseHorizons(section.horizons);
  const withinExactShare = subDaySuppressed
    ? ordered.filter((point) => !AFFILIATE_SUB_DAY_HORIZONS.includes(point.horizon))
    : ordered;
  return {
    points: cohortTooSmall ? [] : withinExactShare,
    exactShare,
    subDaySuppressed,
    cohortSize,
    cohortTooSmall,
  };
}

function niceCeiling(value: number): number {
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const normalized = value / base;
  const step = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((candidate) => normalized <= candidate + 1e-9) ?? 10;
  return step * base;
}

/**
 * Data-driven Y domain for a rate chart. Never returns a hardcoded [0, 1]:
 * a 0.15% response rate must fill the axis instead of hugging the baseline.
 * `cap` bounds series that are share-of-total by construction (max 1).
 */
export function rateAxisDomain(
  values: ReadonlyArray<number | null | undefined>,
  cap?: number,
): [number, number] {
  const max = values.reduce<number>((current, value) => (isPositiveFinite(value) && value > current ? value : current), 0);
  if (max <= 0) return [0, cap ?? 1];
  const upper = niceCeiling(max * 1.08);
  return [0, cap == null ? upper : Math.min(upper, cap)];
}

/** Data-driven Y domain for a count chart, with the same nice-ceiling rounding. */
export function countAxisDomain(values: ReadonlyArray<number | null | undefined>): [number, number] {
  const max = values.reduce<number>((current, value) => (isPositiveFinite(value) && value > current ? value : current), 0);
  return max <= 0 ? [0, 1] : [0, niceCeiling(max * 1.05)];
}

export interface AffiliateInviteDailyRow {
  inviteDs: string;
  /**
   * Whether this cohort day is old enough to have produced its full response
   * tail. Every invitation on a day shares one age, so this is a property of
   * the DAY, never a split within it — which is why maturity is drawn as a
   * background band over the immature date range rather than as a second bar
   * series. Two stacked segments would imply a day can be part-mature.
   */
  mature: boolean;
  invitations: number;
  responded: number;
  /**
   * Rendered on its own right-hand axis. Invitations run to ~80k/day while
   * responses run 0-156, so a shared axis pins the response series flat to the
   * baseline - the same defect as a hardcoded [0, 1] rate domain.
   */
  responseRate: number | null;
}

/**
 * One row per invitation cohort day: the volume, and the rate it produced.
 *
 * No denominator floor is applied. A cohort of 3 invitations with 2 responses
 * genuinely reads 66.7%, and hiding that would disguise a data-completeness
 * problem as a small-sample one: 150,690 of 178,371 TARGET collaborations
 * (84.5%) have never had their detail fetched, so their start_at and member
 * list are absent and early cohorts are undercounted. That fix belongs in
 * acquisition, not in this chart.
 */
export function buildInviteDailyRows(daily: readonly GQL.AffiliateInviteDailyPoint[]): AffiliateInviteDailyRow[] {
  return daily.map((point) => ({
    inviteDs: point.inviteDs,
    mature: point.mature,
    invitations: point.invitations,
    responded: point.responded,
    responseRate: safeShare(point.responded, point.invitations),
  }));
}

/**
 * First cohort day that is still accruing responses, or null when every day in
 * the window is mature. Maturity only ever flips once across the window - days
 * are ordered and age monotonically - so this is the left edge of the immature
 * band.
 */
export function firstImmatureCohortDay(rows: readonly AffiliateInviteDailyRow[]): string | null {
  return rows.find((row) => !row.mature)?.inviteDs ?? null;
}

/**
 * Length of the trailing window behind the shipment ratio line.
 *
 * Seven days, so the window closes over one whole week and cannot be read as a
 * weekday effect. It is a summing window, not a smoothing parameter: the point
 * it produces is still a ratio of two counts that were actually observed.
 */
export const AFFILIATE_SHIPMENT_TRAILING_DAYS = 7;

export interface AffiliateShipmentDailyRow {
  ds: string;
  /** Free samples we observed shipping that day. */
  samplesShipped: number;
  /** Units the affiliate channel sold that day. */
  affiliateUnits: number;
  /**
   * Trailing 7-day sum(affiliateUnits) / sum(samplesShipped).
   *
   * Null for the first six days of the series, which have no full window
   * behind them, and null when the trailing shipment sum is zero. Both are
   * genuine absences and are drawn as gaps, never as a zero.
   */
  trailingUnitsPerSample: number | null;
}

/**
 * Shapes the shipment series and derives the trailing ratio drawn beside it.
 *
 * The per-day ratio the producer already sends is unusable as a line: measured
 * on production for one seller, the first two shipment days carry four samples
 * each and read 1202 and 1150, against a stable 6–13 from the third day on. A
 * shared axis is destroyed by those two points.
 *
 * The fix is to widen the window, not to filter the days. Summing seven days of
 * each count before dividing absorbs the ramp-up without a cutoff, and keeps
 * the result a ratio of two direct observations — no estimator, no completion
 * factor, and deliberately NO minimum-denominator threshold, which would
 * disguise a data-completeness problem as a small-sample one.
 *
 * Days before shipment observation began legitimately carry `samplesShipped: 0`
 * with real `affiliateUnits`. They are kept: the shipment coverage boundary is
 * what explains them, and dropping them would hide it.
 */
export function buildShipmentDailyRows(
  daily: readonly GQL.AffiliateShipmentDailyPoint[],
  trailingDays = AFFILIATE_SHIPMENT_TRAILING_DAYS,
): AffiliateShipmentDailyRow[] {
  return daily.map((point, index) => {
    const start = index + 1 - trailingDays;
    const window = start < 0 ? null : daily.slice(start, index + 1);
    return {
      ds: point.ds,
      samplesShipped: point.samplesShipped,
      affiliateUnits: point.affiliateUnits,
      trailingUnitsPerSample: window == null ? null : safeShare(
        window.reduce((total, day) => total + day.affiliateUnits, 0),
        window.reduce((total, day) => total + day.samplesShipped, 0),
      ),
    };
  });
}

/* -------------------------------------------------------------------------
 * Data-coverage boundary
 *
 * Shops onboard on different days, so on any day before the last of them
 * started, a cohort rate is computed over a SMALLER shop set than the day
 * after. Drawing those days on the same series as the rest presents a changing
 * population as a moving business number — the same defect this page exists to
 * remove. Nothing here repairs the data; it only makes the boundary a visible
 * layer so the reader decides what to do about it.
 * ------------------------------------------------------------------------- */

/** One day of the band strip: how many shops had started, and how many had not. */
export interface AffiliateCoverageBandRow {
  ds: string;
  shopsWithData: number;
  /** The remainder up to `shopsSelected`; drawn as the empty part of the strip. */
  shopsMissing: number;
}

/**
 * Band rows for one section, on that section's own series days.
 *
 * `shopsMissing` is materialised rather than computed in the chart so the strip
 * is a plain stacked series summing to `shopsSelected` on every day: the full
 * height is always the selected scope, and the filled part is what that day
 * actually had.
 */
export function buildCoverageBandRows(coverage: GQL.AffiliateCoverage): AffiliateCoverageBandRow[] {
  return coverage.daily.map((point) => ({
    ds: point.ds,
    shopsWithData: point.shopsWithData,
    shopsMissing: Math.max(coverage.shopsSelected - point.shopsWithData, 0),
  }));
}

/**
 * Whether `ds` is inside the fully-covered window.
 *
 * A null boundary means no selected shop has data at all, in which case NO day
 * is covered — never the reverse. Reading an absent boundary as "everything is
 * fine" is exactly the silent resolution this layer exists to stop.
 */
export function isFullyCoveredDay(ds: string, fullCoverageFrom: string | null | undefined): boolean {
  return fullCoverageFrom != null && ds >= fullCoverageFrom;
}

/**
 * Narrows a series to the fully-covered range — ONLY when the reader has asked
 * for it.
 *
 * The default is the full range, which is the opposite of what this layer
 * originally did. Defaulting to the intersection let one late shop erase the
 * rest: measured on production 2026-08-25 for one owner, a German shop with a
 * 2026-08-06 floor and 99 rows (0 units) and a UK shop with a 2026-08-04 floor
 * and 808 rows (0 units) truncated away 81,627 rows and 142,397 units of
 * history belonging to three US shops covered from 2026-05-15.
 *
 * The boundary is real and still stated — by the coverage band, the reference
 * line at the first fully-covered day, and the dashed/faint treatment of the
 * partial region. What it must not do is silently delete the data it describes.
 * Narrowing scope remains available as an explicit, reversible action.
 */
export function applyCoverageWindow<TRow>(
  rows: readonly TRow[],
  dsOf: (row: TRow) => string,
  fullCoverageFrom: string | null | undefined,
  restrictToCovered: boolean,
): TRow[] {
  if (!restrictToCovered || fullCoverageFrom == null) return [...rows];
  return rows.filter((row) => isFullyCoveredDay(dsOf(row), fullCoverageFrom));
}

/** Number of days in a series that sit before the boundary. */
export function countPartialDays(
  dates: readonly string[],
  fullCoverageFrom: string | null | undefined,
): number {
  return dates.filter((ds) => !isFullyCoveredDay(ds, fullCoverageFrom)).length;
}

/**
 * The x-axis category to mark as the first fully-covered day, or null.
 *
 * Charts here use a categorical axis, so a reference line can only land on a
 * value that is actually plotted — an interpolated date would silently not
 * render. It returns null when the boundary is absent, is not one of the
 * plotted days, or has nothing before it, because a line with no partial region
 * to its left marks a distinction that does not exist in the view.
 */
export function coverageBoundaryMark(
  dates: readonly string[],
  fullCoverageFrom: string | null | undefined,
): string | null {
  if (fullCoverageFrom == null) return null;
  if (!dates.includes(fullCoverageFrom)) return null;
  return dates.some((ds) => ds < fullCoverageFrom) ? fullCoverageFrom : null;
}

export interface AffiliateCoverageSplitRow {
  /** True when this day sits inside the fully-covered window. */
  covered: boolean;
  /** The value on covered days, null elsewhere — drawn solid. */
  coveredValue: number | null;
  /** The value on partial days, null elsewhere — drawn dashed. */
  partialValue: number | null;
}

/**
 * Splits one numeric series into a solid covered half and a dashed partial
 * half, so a partial-range line can never be read as a comparable trend.
 *
 * The boundary day carries BOTH values on purpose: without it the two line
 * segments would not touch and the chart would show a gap where the population
 * merely changed. Recharts draws two series; only their styling differs.
 */
export function splitCoverageSeries<TRow>(
  rows: readonly TRow[],
  dsOf: (row: TRow) => string,
  valueOf: (row: TRow) => number | null | undefined,
  fullCoverageFrom: string | null | undefined,
): Array<TRow & AffiliateCoverageSplitRow> {
  return rows.map((row) => {
    const covered = isFullyCoveredDay(dsOf(row), fullCoverageFrom);
    const raw = valueOf(row);
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    const onBoundary = fullCoverageFrom != null && dsOf(row) === fullCoverageFrom;
    return {
      ...row,
      covered,
      coveredValue: covered ? value : null,
      partialValue: !covered || onBoundary ? value : null,
    };
  });
}

/** What a section's headline figures were actually computed over. */
export interface AffiliateCoverageBasis {
  shopsSelected: number;
  /** Selected shops that carry any data for this section at all. */
  shopsWithData: number;
  fullCoverageFrom: string | null;
}

/**
 * The basis a section's metric strip must disclose.
 *
 * The server computes those figures across the WHOLE window and the WHOLE
 * selected scope — truncation is a display decision made here — so the card
 * has to say how many shops stood behind the number and from when they were
 * all present, rather than letting a reader assume both.
 */
export function coverageBasis(coverage: GQL.AffiliateCoverage): AffiliateCoverageBasis {
  return {
    shopsSelected: coverage.shopsSelected,
    shopsWithData: coverage.shops.filter((shop) => shop.coverageFrom != null).length,
    fullCoverageFrom: coverage.fullCoverageFrom ?? null,
  };
}

/** Display label for a shop in the coverage layer; never a bare id when a name exists. */
export function coverageShopLabel(shop: GQL.AffiliateShopCoverage): string {
  return shop.shopName?.trim() || shop.shopId;
}
