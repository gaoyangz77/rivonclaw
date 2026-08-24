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
} from "./affiliate-overview-types.js";

/**
 * Sub-day horizons are only interpretable where most response times are real
 * platform submission timestamps. Measured exact share: 2026-08 = 92%,
 * 2026-06 = 11% — below this bar a 3h/12h/24h point is a misleading zero.
 */
export const AFFILIATE_EXACT_SHARE_THRESHOLD = 0.6;

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
  /** Ordered horizons that may be plotted. */
  points: GQL.AffiliateResponseHorizon[];
  /** Share of responses carrying an exact submission timestamp, or null. */
  exactShare: number | null;
  /** True when 3h/12h/24h were withheld because the exact share is too low. */
  subDaySuppressed: boolean;
}

/**
 * Builds the plottable horizon series. Sub-day horizons are suppressed — not
 * zeroed — when the exact-submission share is below the threshold, so the chart
 * never draws a proxy artefact as a real short-horizon response rate.
 */
export function buildResponseHorizonSeries(
  section: Pick<GQL.AffiliateReachoutSection, "horizons" | "responsesExact" | "responsesProxy">,
  threshold = AFFILIATE_EXACT_SHARE_THRESHOLD,
): AffiliateHorizonSeries {
  const exactShare = exactSubmissionShare(section);
  const subDaySuppressed = exactShare == null || exactShare < threshold;
  const ordered = orderResponseHorizons(section.horizons);
  return {
    points: subDaySuppressed
      ? ordered.filter((point) => !AFFILIATE_SUB_DAY_HORIZONS.includes(point.horizon))
      : ordered,
    exactShare,
    subDaySuppressed,
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
  mature: boolean;
  /** Invitations old enough to have produced their full response tail. */
  matureInvitations: number;
  /** Trailing-30d invitations; still accruing responses. */
  immatureInvitations: number;
  responded: number;
}

/**
 * Splits daily invitation cohorts into a mature and an immature series so the
 * chart can colour them differently. A short trailing bar must read as "not
 * finished yet", never as a bad day.
 */
export function buildInviteDailyRows(daily: readonly GQL.AffiliateInviteDailyPoint[]): AffiliateInviteDailyRow[] {
  return daily.map((point) => ({
    inviteDs: point.inviteDs,
    mature: point.mature,
    matureInvitations: point.mature ? point.invitations : 0,
    immatureInvitations: point.mature ? 0 : point.invitations,
    responded: point.responded,
  }));
}

export interface AffiliateCohortUnitsRow {
  cohortDs: string;
  approvedApplications: number;
  actualUnits: number;
  projectedRemainingUnits: number;
  /**
   * Normalized to a single absent value. Codegen models a nullable field as
   * `?: Maybe<T>`, so the wire shape carries both `null` and `undefined`; a
   * display row should not make a reader handle two kinds of missing.
   */
  completionFactor: number | null;
  ageDays: number;
  /** Cohort still accruing units — its bar carries a projection segment. */
  immature: boolean;
}

/**
 * Shapes the cohort units series. `projectedRemainingUnits` is clamped at zero
 * and day-0 cohorts never carry a projection, matching the producer contract.
 */
export function buildCohortUnitsRows(cohorts: readonly GQL.AffiliateCohortUnitsPoint[]): AffiliateCohortUnitsRow[] {
  return cohorts.map((cohort) => {
    const projected = cohort.ageDays >= 1 && isPositiveFinite(cohort.projectedRemainingUnits)
      ? cohort.projectedRemainingUnits
      : 0;
    return {
      cohortDs: cohort.cohortDs,
      approvedApplications: cohort.approvedApplications,
      actualUnits: cohort.actualUnits,
      projectedRemainingUnits: projected,
      completionFactor: cohort.completionFactor ?? null,
      ageDays: cohort.ageDays,
      immature: projected > 0 || (cohort.completionFactor != null && cohort.completionFactor < 1),
    };
  });
}

/** Number of cohorts in the series that are still accruing units. */
export function countImmatureCohorts(rows: readonly AffiliateCohortUnitsRow[]): number {
  return rows.filter((row) => row.immature).length;
}
