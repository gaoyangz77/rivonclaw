import { gql } from "@apollo/client/core";

const AFFILIATE_FRESHNESS_FIELDS = gql`
  fragment AffiliateFreshnessFields on EcomBiFreshness {
    asOf
    cutoffAt
    watermarkStatus
    logicVersion
    lastRunId
    stale
    warnings
  }
`;

/**
 * Affiliate Overview — three sections, each its own root query so a failing
 * section degrades on its own instead of taking the page down.
 *
 * These payloads are typed by the backend-owned `GQL.Affiliate*Section` types;
 * `pages/ecommerce/affiliate-overview-types.ts` only wraps them in the query
 * envelopes that describe these selection sets.
 *
 * Deliberately absent: GMV, commission, leaderboards, campaign stage bars, the
 * platform-vs-sample contract split, and any comparison period. Order-line GMV
 * is 98.2% missing at 0–7 days of order age and keeps a ~17% permanent hole,
 * so a cohort-by-age money column would render a backfill curve as a business
 * trend. This page is built on invitations, applications and units only.
 */
export const AFFILIATE_OVERVIEW_REACHOUT_QUERY = gql`
  query AffiliateOverviewReachout($input: AffiliateOverviewInput!) {
    getAffiliateOverviewReachout(input: $input) {
      invitations
      responded
      cohortResponseRate
      immatureShare
      responsesExact
      responsesProxy
      horizons {
        horizon
        matureInvitations
        responsesWithinHorizon
        responseRate
      }
      daily {
        inviteDs
        invitations
        responded
        mature
      }
      coverage {
        fullCoverageFrom
        shopsSelected
        limitingShops { shopId shopName coverageFrom }
        shops { shopId shopName coverageFrom }
        daily { ds shopsWithData }
      }
    }
  }
`;

export const AFFILIATE_OVERVIEW_APPROVAL_QUERY = gql`
  query AffiliateOverviewApproval($input: AffiliateOverviewInput!) {
    getAffiliateOverviewApproval(input: $input) {
      applications
      approved
      merchantRejected
      overdueByUs
      inFlight
      approvalRate
      merchantRejectRate
      overdueRate
      daily {
        cohortDs
        applications
        approved
        merchantRejected
        overdueByUs
        inFlight
        approvalRate
      }
      byAge {
        ageBucket
        applications
        approved
        merchantRejected
        overdueByUs
        inFlight
        approvalRate
      }
      coverage {
        fullCoverageFrom
        shopsSelected
        limitingShops { shopId shopName coverageFrom }
        shops { shopId shopName coverageFrom }
        daily { ds shopsWithData }
      }
    }
  }
`;

export const AFFILIATE_OVERVIEW_POST_APPROVAL_QUERY = gql`
  query AffiliateOverviewPostApproval($input: AffiliateOverviewInput!) {
    getAffiliateOverviewPostApproval(input: $input) {
      approvedApplications
      applicationsWithOrder
      orderRate
      actualUnits
      projectedUnits
      unitsPerApprovedActual
      unitsPerApprovedProjected
      cohorts {
        cohortDs
        approvedApplications
        actualUnits
        projectedRemainingUnits
        completionFactor
        ageDays
      }
      maturationCurve {
        lagDays
        cumulativeShare
        basisCohorts
      }
      coverage {
        fullCoverageFrom
        shopsSelected
        limitingShops { shopId shopName coverageFrom }
        shops { shopId shopName coverageFrom }
        daily { ds shopsWithData }
      }
    }
  }
`;

/**
 * Portfolio counts for the Overview header.
 *
 * The cohort sections carry no portfolio, so these come from the existing
 * overview resolver, which applies no date predicate to them — they are current
 * values. The date range below is required by the input type and is therefore
 * held constant rather than tracking the cohort window, so changing the window
 * does not refetch a number that cannot move.
 */
export const AFFILIATE_OVERVIEW_PORTFOLIO_QUERY = gql`
  query AffiliateOverviewPortfolio($input: AffiliateAnalyticsOverviewInput!) {
    getAffiliateAnalyticsOverviewCore(input: $input) {
      portfolio {
        activeCampaigns
        activeTargetCollaborations
        activeOpenCollaborations
      }
    }
  }
`;

export const AFFILIATE_BI_CATALOG_QUERY = gql`
  query AffiliateBiCatalog {
    getEcommerceBiCatalog {
      id label description grain supportedGranularities defaultDimensions defaultMetrics
      groupingSets { dimensions }
      dimensions {
        id label description valueType entity source filterable groupable
        filterOperators requiredDimensions
      }
      metrics { id label description valueType }
    }
  }
`;

export const AFFILIATE_BI_DATA_QUERY = gql`
  ${AFFILIATE_FRESHNESS_FIELDS}
  query AffiliateBiData($input: EcomBiQueryInput!) {
    getEcommerceBiData(input: $input) {
      datasetId granularity totalCount rows
      columns { role dimension metric key label valueType }
      pageInfo { offset requestedLimit effectiveLimit returnedRows hasMore nextOffset }
      freshness { ...AffiliateFreshnessFields }
    }
  }
`;

export const AFFILIATE_BI_DIMENSION_VALUES_QUERY = gql`
  query AffiliateBiDimensionValues($input: EcomBiDimensionValuesInput!) {
    getEcommerceBiDimensionValues(input: $input) {
      datasetId dimension hasMore
      items { value label secondaryLabel }
    }
  }
`;
