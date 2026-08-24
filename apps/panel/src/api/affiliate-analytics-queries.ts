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

const AFFILIATE_PLATFORM_METRICS_FIELDS = gql`
  fragment AffiliatePlatformMetricsFields on AffiliateAnalyticsPlatformMetrics {
    grossGmvUsd
    netGmvUsd
    orders
    units
    estimatedCommissionUsd
    actualCommissionUsd
    targetCreatorsInvited
    targetSampleResponses
    targetResponseRate
    requestedTarget
    qualified
    sent
    replied
    failed
  }
`;

const AFFILIATE_SAMPLE_METRICS_FIELDS = gql`
  fragment AffiliateSampleMetricsFields on AffiliateAnalyticsSampleMetrics {
    grossGmvUsd
    netGmvUsd
    orders
    units
    estimatedCommissionUsd
    actualCommissionUsd
    applications
    approved
    rejected
    overdue
    inFlight
    completed
    shippedObserved
    contents
    approvalRate
    fulfillmentObservedRate
    completionRate
    statusBucketsExclusive
  }
`;

export const AFFILIATE_ANALYTICS_OVERVIEW_QUERY = gql`
  ${AFFILIATE_FRESHNESS_FIELDS}
  ${AFFILIATE_PLATFORM_METRICS_FIELDS}
  ${AFFILIATE_SAMPLE_METRICS_FIELDS}
  query AffiliateAnalyticsOverviewCore($input: AffiliateAnalyticsOverviewInput!) {
    getAffiliateAnalyticsOverviewCore(input: $input) {
      scope {
        shopIds
        shopCount
        current { startDateGe endDateLt }
        comparison { startDateGe endDateLt }
      }
      portfolio { shops activeCampaigns activeTargetCollaborations activeOpenCollaborations }
      freshness {
        platform { ...AffiliateFreshnessFields }
        sample { ...AffiliateFreshnessFields }
        liveResponseObservedAt
      }
      platform {
        current { ...AffiliatePlatformMetricsFields }
        comparison { ...AffiliatePlatformMetricsFields }
        trend {
          bucketStart grossGmvUsd netGmvUsd orders units estimatedCommissionUsd actualCommissionUsd
          targetCreatorsInvited targetSampleResponses targetResponseRate requestedTarget qualified sent replied failed
        }
        comparisonTrend {
          bucketStart grossGmvUsd netGmvUsd orders units estimatedCommissionUsd actualCommissionUsd
          targetCreatorsInvited targetSampleResponses targetResponseRate requestedTarget qualified sent replied failed
        }
      }
      sample {
        current { ...AffiliateSampleMetricsFields }
        comparison { ...AffiliateSampleMetricsFields }
        trend {
          bucketStart grossGmvUsd netGmvUsd orders units estimatedCommissionUsd actualCommissionUsd
          applications approved rejected overdue inFlight completed shippedObserved contents
          approvalRate fulfillmentObservedRate completionRate statusBucketsExclusive
        }
        comparisonTrend {
          bucketStart grossGmvUsd netGmvUsd orders units estimatedCommissionUsd actualCommissionUsd
          applications approved rejected overdue inFlight completed shippedObserved contents
          approvalRate fulfillmentObservedRate completionRate statusBucketsExclusive
        }
      }
      campaignStages { key label value }
      sampleStatuses { key label value share }
      sampleMaturity {
        ageBucket applications approved shippedObserved completed
        approvalRate fulfillmentObservedRate completionRate
      }
      health {
        creatorIdentityRowCoverage creatorIdentityGmvCoverage exactApplicationTimeShare
        targetMappedApplicationShare campaignMappedApplicationShare warnings
      }
    }
  }
`;

export const AFFILIATE_ANALYTICS_MATURITY_QUERY = gql`
  query AffiliateAnalyticsOutreachMaturity($input: AffiliateAnalyticsOverviewInput!) {
    getAffiliateAnalyticsOutreachMaturity(input: $input) {
      observedAt
      points {
        horizon horizonHours matureInvitations responsesWithinHorizon responseRate
        freshFetchInvitations staleFetchInvitations
      }
      basis { basis invitations }
    }
  }
`;

export const AFFILIATE_ANALYTICS_LEADERBOARD_QUERY = gql`
  query AffiliateAnalyticsLeaderboard($input: AffiliateAnalyticsLeaderboardInput!) {
    getAffiliateAnalyticsLeaderboard(input: $input) {
      entityType
      platform { entityId label secondaryLabel netGmvUsd orders applications responses }
      sample { entityId label secondaryLabel netGmvUsd orders applications responses }
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
