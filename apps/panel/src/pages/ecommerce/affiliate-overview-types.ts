/**
 * Affiliate Overview — Panel-local types and constants.
 *
 * The wire shapes themselves are NOT here: every section payload comes from
 * `GQL.*` in `packages/core/src/generated/graphql.ts`, which the backend owns
 * (ADR-027). What lives here is what codegen cannot express — Panel-side
 * narrowings of wire primitives, closed display sets, and the query-envelope
 * types that describe this page's selection sets.
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
 * Query envelopes for this page's selection sets.
 *
 * Each section field is non-null in the schema; Apollo still leaves `data`
 * undefined when the operation errors, which is what the `?? null` at every
 * read site covers.
 */
export interface AffiliateReachoutResult {
  getAffiliateOverviewReachout: GQL.AffiliateReachoutSection;
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
