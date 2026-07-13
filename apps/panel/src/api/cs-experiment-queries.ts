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

const EXPERIMENT_DETAIL_FIELDS = gql`
  fragment CsExperimentDetailFields on CsExperimentDetailView {
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
        messageTemplate
      }
    }
    analysisPopulation {
      variantKey
      assignedUnits
      actualWeightBps
      includedInPrimaryAnalysis
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
  ${EXPERIMENT_DETAIL_FIELDS}
  query EcommerceGetCSExperimentDetail($experimentId: ID!) {
    ecommerceGetCSExperimentDetail(experimentId: $experimentId) { ...CsExperimentDetailFields }
  }
`;

export const ECOMMERCE_GET_CS_EXPERIMENT_WORKSPACE = gql`
  ${EXPERIMENT_DETAIL_FIELDS}
  query EcommerceGetCSExperimentWorkspace(
    $experimentId: ID!
    $curveInput: CsExperimentTimeToEventCurveInput!
    $trendInput: CsExperimentTrendInput!
    $includeCurve: Boolean!
    $includeTrend: Boolean!
  ) {
    ecommerceGetCSExperimentDetail(experimentId: $experimentId) {
      ...CsExperimentDetailFields
    }
    ecommerceGetCSExperimentTimeToEventCurve(input: $curveInput) @include(if: $includeCurve) {
      experimentId
      eventKey
      estimator
      dataStatus
      asOf
      maxElapsedMinutes
      assignedUnits
      excludedUnits
      series {
        seriesKey
        seriesRole
        label
        action
        stages {
          stageIndex
          delayMinutes
        }
        points {
          elapsedMinutes
          estimate
          confidenceIntervalLow
          confidenceIntervalHigh
          assignedUnits
          observedThroughUnits
          atRiskUnits
          cumulativePaidUnits
          cumulativeCancelledUnits
          censoredUnits
          coverageRate
        }
      }
    }
    ecommerceGetCSExperimentTrend(input: $trendInput) @include(if: $includeTrend) {
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

export const ECOMMERCE_GET_CS_EXPERIMENT_TIME_TO_EVENT_CURVE = gql`
  query EcommerceGetCSExperimentTimeToEventCurve($input: CsExperimentTimeToEventCurveInput!) {
    ecommerceGetCSExperimentTimeToEventCurve(input: $input) {
      experimentId
      eventKey
      estimator
      dataStatus
      asOf
      maxElapsedMinutes
      assignedUnits
      excludedUnits
      series {
        seriesKey
        seriesRole
        label
        action
        stages {
          stageIndex
          delayMinutes
        }
        points {
          elapsedMinutes
          estimate
          confidenceIntervalLow
          confidenceIntervalHigh
          assignedUnits
          observedThroughUnits
          atRiskUnits
          cumulativePaidUnits
          cumulativeCancelledUnits
          censoredUnits
          coverageRate
        }
      }
    }
  }
`;
