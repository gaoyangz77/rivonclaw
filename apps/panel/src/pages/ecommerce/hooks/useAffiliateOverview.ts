import { useMemo, useState } from "react";
import { NetworkStatus } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import type { GQL } from "@rivonclaw/core";
import {
  AFFILIATE_OVERVIEW_APPROVAL_QUERY,
  AFFILIATE_OVERVIEW_PORTFOLIO_QUERY,
  AFFILIATE_OVERVIEW_POST_APPROVAL_QUERY,
  AFFILIATE_OVERVIEW_REACHOUT_QUERY,
} from "../../../api/affiliate-analytics-queries.js";
import { defaultAffiliateDateRange } from "../affiliate-analytics.js";
import { reconcileShopSelection, type AffiliateAnalyticsShop } from "../affiliate-analytics-scope.js";
import type {
  AffiliateApprovalResult,
  AffiliateOverviewPortfolio,
  AffiliateOverviewPortfolioResult,
  AffiliatePostApprovalResult,
  AffiliateReachoutResult,
  AffiliateSectionQuery,
  AffiliateWindowDays,
} from "../affiliate-overview-types.js";

export interface AffiliateOverviewState {
  shopIds: string[];
  setShopIds: (next: string[]) => void;
  windowDays: AffiliateWindowDays;
  setWindowDays: (next: AffiliateWindowDays) => void;
  portfolio: AffiliateOverviewPortfolio | null;
  reachout: AffiliateSectionQuery<GQL.AffiliateReachoutSection>;
  approval: AffiliateSectionQuery<GQL.AffiliateApprovalSection>;
  postApproval: AffiliateSectionQuery<GQL.AffiliatePostApprovalSection>;
  refreshing: boolean;
  refetchAll: () => void;
}

/**
 * Owns the Overview's four queries plus its two controls: the authorized shop
 * scope and the cohort window.
 *
 * The three cohort sections are separate root queries, so each one degrades on
 * its own — a failing section renders its own retry rather than blanking the
 * page. The shop selection is kept as ids only and re-validated against the
 * current authorized shops on every render, so a shop losing its entitlement
 * can never leave a stale id in the query variables.
 */
export function useAffiliateOverview(shops: AffiliateAnalyticsShop[]): AffiliateOverviewState {
  const [selection, setSelection] = useState<string[] | null>(null);
  const [windowDays, setWindowDays] = useState<AffiliateWindowDays>(30);

  const shopIds = selection ? reconcileShopSelection(selection, shops) : shops.map((shop) => shop.id);
  const skip = shopIds.length === 0;
  const sectionOptions = {
    variables: { input: { shopIds, windowDays } as GQL.AffiliateOverviewInput },
    skip,
    fetchPolicy: "cache-and-network" as const,
    notifyOnNetworkStatusChange: true,
  };

  // Portfolio counts carry no date predicate; the range only satisfies the input
  // type, so it is frozen for the lifetime of the page rather than tracking the
  // cohort window.
  const portfolioRange = useMemo(() => defaultAffiliateDateRange(), []);

  const reachoutQuery = useQuery<AffiliateReachoutResult, { input: GQL.AffiliateOverviewInput }>(
    AFFILIATE_OVERVIEW_REACHOUT_QUERY,
    sectionOptions,
  );
  const approvalQuery = useQuery<AffiliateApprovalResult, { input: GQL.AffiliateOverviewInput }>(
    AFFILIATE_OVERVIEW_APPROVAL_QUERY,
    sectionOptions,
  );
  const postApprovalQuery = useQuery<AffiliatePostApprovalResult, { input: GQL.AffiliateOverviewInput }>(
    AFFILIATE_OVERVIEW_POST_APPROVAL_QUERY,
    sectionOptions,
  );
  const portfolioQuery = useQuery<AffiliateOverviewPortfolioResult, { input: GQL.AffiliateAnalyticsOverviewInput }>(
    AFFILIATE_OVERVIEW_PORTFOLIO_QUERY,
    {
      variables: { input: { shopIds, ...portfolioRange } as GQL.AffiliateAnalyticsOverviewInput },
      skip,
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    },
  );

  const sectionQueries = [reachoutQuery, approvalQuery, postApprovalQuery, portfolioQuery];

  return {
    shopIds,
    setShopIds: setSelection,
    windowDays,
    setWindowDays,
    portfolio: portfolioQuery.data?.getAffiliateAnalyticsOverviewCore?.portfolio ?? null,
    reachout: {
      section: reachoutQuery.data?.getAffiliateOverviewReachout ?? null,
      loading: reachoutQuery.loading,
      error: reachoutQuery.error,
      retry: () => void reachoutQuery.refetch(),
    },
    approval: {
      section: approvalQuery.data?.getAffiliateOverviewApproval ?? null,
      loading: approvalQuery.loading,
      error: approvalQuery.error,
      retry: () => void approvalQuery.refetch(),
    },
    postApproval: {
      section: postApprovalQuery.data?.getAffiliateOverviewPostApproval ?? null,
      loading: postApprovalQuery.loading,
      error: postApprovalQuery.error,
      retry: () => void postApprovalQuery.refetch(),
    },
    refreshing: sectionQueries.some((query) => query.networkStatus === NetworkStatus.refetch),
    refetchAll: () => void Promise.all(sectionQueries.map((query) => query.refetch())),
  };
}
