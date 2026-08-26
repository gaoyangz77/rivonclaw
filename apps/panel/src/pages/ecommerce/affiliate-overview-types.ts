/**
 * Affiliate Overview — Panel-local types and constants.
 *
 * Wire shapes belong in `GQL.*` in `packages/core/src/generated/graphql.ts`,
 * which the backend owns (ADR-027), and each use site names them there so the
 * provenance is visible where the type is read. What lives here is only what
 * codegen cannot express: Panel-side narrowings of wire primitives, closed
 * display sets, the query-envelope types that describe this page's selection
 * sets, and the per-section query state the Overview's hook hands its views.
 *
 * Nothing outside `pages/ecommerce/` may import from this file.
 */

import type { GQL } from "@rivonclaw/core";

/**
 * The three offered cohort windows.
 *
 * The wire field is `Int!` because GraphQL has no integer-literal union, and
 * the backend validates the value server-side. The Panel narrows it here so a
 * fourth window cannot reach the segmented control by accident; it widens back
 * to `number` at the query boundary.
 */
export type AffiliateWindowDays = 30 | 60 | 90;

export const AFFILIATE_WINDOW_DAYS: readonly AffiliateWindowDays[] = [30, 60, 90];

/** The seven fixed response horizons. The set is closed — never extend it here. */
export const AFFILIATE_RESPONSE_HORIZONS = ["3h", "12h", "24h", "72h", "7d", "14d", "30d"] as const;

export type AffiliateResponseHorizonKey = (typeof AFFILIATE_RESPONSE_HORIZONS)[number];

/** Horizons shorter than a day are only meaningful on exact submission timestamps. */
export const AFFILIATE_SUB_DAY_HORIZONS: readonly string[] = ["3h", "12h", "24h"];

/**
 * The post-approval section's own window, pinned at 90 days.
 *
 * This section does NOT follow the page's 30/60/90 control, and that is
 * deliberate rather than an oversight. Orders lag approval by so much that a
 * cohort bucketed by application date has produced almost nothing before it is
 * 60-90 days old. Measured on production 2026-08-25 for one seller: cohorts
 * aged 0-9d and 10-19d had 0 units, 20-29d had 1, while the 90-99d cohort had
 * 92,586 — and 65% of the last 30 days' order lines belonged to cohorts that
 * applied 60-89 days earlier. A 30-day view of this measure therefore renders a
 * seller doing several hundred thousand dollars a month as having sold nothing.
 *
 * The other two sections follow the control normally; only this one is pinned,
 * and it says so on the section so a reader never assumes otherwise.
 */
export const AFFILIATE_POST_APPROVAL_WINDOW_DAYS: AffiliateWindowDays = 90;

/**
 * Local mirror of the reachout section's fixed-cohort fields.
 *
 * The backend owns these types (ADR-027) and `GQL.AffiliateReachoutSection`
 * gains them when `packages/core/src/generated/graphql.ts` is regenerated from
 * the backend schema. Codegen writes a file shared with the root repo and is
 * sequenced separately, so this file carries the shape in the meantime — the
 * same stopgap it has used before. DELETE this and read the fields straight off
 * `GQL.AffiliateReachoutSection` once codegen has run.
 */
export interface AffiliateHorizonCohortFields {
  /** The single denominator every horizon point rests on. */
  horizonCohortSize: number;
  /** Earliest invitation day in that cohort; null when it is empty. */
  horizonCohortFrom?: string | null;
  /** Latest invitation day in that cohort; null when it is empty. */
  horizonCohortTo?: string | null;
}

export type AffiliateReachoutSection = GQL.AffiliateReachoutSection & AffiliateHorizonCohortFields;

/**
 * Query envelopes for this page's selection sets.
 *
 * Each section field is non-null in the schema; Apollo still leaves `data`
 * undefined when the operation errors, which is what the `?? null` at every
 * read site covers.
 */
export interface AffiliateReachoutResult {
  getAffiliateOverviewReachout: AffiliateReachoutSection;
}

export interface AffiliateApprovalResult {
  getAffiliateOverviewApproval: GQL.AffiliateApprovalSection;
}

export interface AffiliatePostApprovalResult {
  getAffiliateOverviewPostApproval: GQL.AffiliatePostApprovalSection;
}

/**
 * Portfolio counts, current values that carry no date predicate.
 *
 * Narrowed from the backing type rather than restated: the Overview header
 * shows three counts and deliberately omits `shops`, which the shop picker
 * already reports, so the full type would promise a field this page never asks
 * the server for.
 */
export type AffiliateOverviewPortfolio = Pick<
  GQL.AffiliateAnalyticsPortfolio,
  "activeCampaigns" | "activeTargetCollaborations" | "activeOpenCollaborations"
>;

export interface AffiliateOverviewPortfolioResult {
  getAffiliateAnalyticsOverviewCore: { portfolio: AffiliateOverviewPortfolio };
}

/** One section's slice of the Overview: its own data, loading and error state. */
export interface AffiliateSectionQuery<TSection> {
  section: TSection | null;
  loading: boolean;
  error?: Error;
  retry: () => void;
}
