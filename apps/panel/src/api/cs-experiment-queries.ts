import { gql } from "@apollo/client/core";

const EXPERIMENT_LIST_FIELDS = gql`
  fragment CsExperimentListFields on CsExperimentListItemView {
    id
    experimentType
    displayStatus
    dataStatus
    version
    startedAt
    stoppedAt
    resultsFinalAt
    variantCount
    targetCount
    targets {
      id
      name
      region
    }
    quality {
      assignedUnits
      exposedUnits
      maturedUnits
      srmPValue
      maxAllocationDeviationBps
      calculatedAt
      nextMaturityAt
    }
  }
`;

export const ECOMMERCE_GET_CS_EXPERIMENT_PAGE = gql`
  ${EXPERIMENT_LIST_FIELDS}
  query EcommerceGetCSExperimentPage($input: CsExperimentPageInput!) {
    ecommerceGetCSExperimentPage(input: $input) {
      asOf nextCursor items { ...CsExperimentListFields }
    }
  }
`;

export const ECOMMERCE_GET_CS_EXPERIMENT_DETAIL = gql`
  query EcommerceGetCSExperimentDetail($experimentId: ID!) {
    ecommerceGetCSExperimentDetail(experimentId: $experimentId) {
      id
      experimentType
      displayStatus
      dataStatus
      version
      startedAt
      stoppedAt
      resultsFinalAt
      variantCount
      targetCount
      targets {
        id
        name
        region
      }
      quality {
        assignedUnits
        exposedUnits
        maturedUnits
        srmPValue
        maxAllocationDeviationBps
        calculatedAt
        nextMaturityAt
      }
      variants {
        variantKey
        label
        weightBps
        action
        stages {
          stageId
          stageIndex
          enabled
          delayMinutes
          templateHash
        }
      }
      metrics {
        metricKey
        variantKey
        dimensionKey
        dimensionValue
        eligibleUnits
        observedUnits
        value
      }
      comparisons {
        metricKey
        baselineVariantKey
        variantKey
        baselineUnits
        variantUnits
        baselineValue
        variantValue
        absoluteEffect
        relativeEffect
        confidenceIntervalLow
        confidenceIntervalHigh
        pValue
        adjustedPValue
        correctionMethod
        insufficientSample
        asOf
      }
    }
  }
`;

export const ECOMMERCE_GET_CS_EXPERIMENT_TREND = gql`
  query EcommerceGetCSExperimentTrend($input: CsExperimentTrendInput!) {
    ecommerceGetCSExperimentTrend(input: $input) {
      experimentId
      metricKey
      range
      bucketMinutes
      dataStatus
      asOf
      points {
        bucketStart
        variantKey
        dimensionKey
        dimensionValue
        eligibleUnits
        observedUnits
        value
      }
    }
  }
`;
