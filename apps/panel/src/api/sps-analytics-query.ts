import { gql } from "@apollo/client/core";

export const ECOMMERCE_GET_SPS_ANALYTICS_QUERY = gql`
  query EcommerceGetSpsAnalytics($input: SpsAnalyticsInput!) {
    ecommerceGetSpsAnalytics(input: $input) {
      asOf
      metricCode
      trendDurationDays
      supportedMarkets
      markets {
        market
        apiSupported
        shops {
          shopId
          shopName
          shopAlias
          market
          availability
          unavailableReason
          observedAt
          sourceUpdatedAt
          spsScore
          spsTier
          spsTierText
          peerPercentile
          primaryCategoryName
          topIssueSummary
          topIssueCodes
          metricCode
          metricDimension
          metricScore
          metricValue
          metricValueUnit
          metricStatus
          metricStatusText
          excellentThreshold
          poorThreshold
          evaluationDurationDays
          calculationNumeratorLabel
          calculationNumeratorValue
          calculationDenominatorLabel
          calculationDenominatorValue
          distributionDetails {
            name
            count
            percent
          }
          diagnosisSummaries
          diagnosisDetails
          trend {
            recordDate
            value
          }
        }
      }
    }
  }
`;
