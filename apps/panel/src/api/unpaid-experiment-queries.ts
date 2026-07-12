import { gql } from "@apollo/client/core";

const CONFIG_EXPERIMENT_FIELDS = gql`
  fragment UnpaidConfigExperimentFields on CsUnpaidOrderConfigExperimentView {
    id
    status
    displayStatus
    version
    startedAt
    stoppedAt
    resultsFinalAt
    variants {
      variantKey
      label
      percentage
      stages {
        id
        enabled
        delayMinutes
        messageTemplate
      }
    }
  }
`;

export const GET_UNPAID_EVALUATION = gql`
  ${CONFIG_EXPERIMENT_FIELDS}
  query GetUnpaidEvaluation($shopId: ID!) {
    ecommerceGetCSUnpaidOrderEvaluation(shopId: $shopId) {
      reachoutEnabled
      stages { id enabled delayMinutes messageTemplate }
      holdout {
        enabled
        holdoutPercent
        experiment { id status displayStatus version startedAt stoppedAt resultsFinalAt }
      }
      config {
        runningExperiment { ...UnpaidConfigExperimentFields }
        draftExperiment { ...UnpaidConfigExperimentFields }
        recentExperiments { ...UnpaidConfigExperimentFields }
      }
      locks { canEditBaseStages canStartConfigExperiment reason }
    }
  }
`;

export const UPDATE_UNPAID_REACHOUT_SETTINGS = gql`
  ${CONFIG_EXPERIMENT_FIELDS}
  mutation UpdateUnpaidReachoutSettings($input: CsUnpaidOrderReachoutSettingsInput!) {
    ecommerceUpdateCSUnpaidOrderReachoutSettings(input: $input) {
      reachoutEnabled
      stages { id enabled delayMinutes messageTemplate }
      holdout {
        enabled
        holdoutPercent
        experiment { id status displayStatus version startedAt stoppedAt resultsFinalAt }
      }
      config {
        runningExperiment { ...UnpaidConfigExperimentFields }
        draftExperiment { ...UnpaidConfigExperimentFields }
        recentExperiments { ...UnpaidConfigExperimentFields }
      }
      locks { canEditBaseStages canStartConfigExperiment reason }
    }
  }
`;

export const CREATE_UNPAID_CONFIG_EXPERIMENT = gql`
  ${CONFIG_EXPERIMENT_FIELDS}
  mutation CreateUnpaidConfigExperiment($input: CsUnpaidOrderConfigExperimentInput!) {
    ecommerceCreateCSUnpaidOrderConfigExperimentDraft(input: $input) {
      ...UnpaidConfigExperimentFields
    }
  }
`;

export const UPDATE_UNPAID_CONFIG_EXPERIMENT = gql`
  ${CONFIG_EXPERIMENT_FIELDS}
  mutation UpdateUnpaidConfigExperiment($experimentId: ID!, $input: CsUnpaidOrderConfigExperimentInput!) {
    ecommerceUpdateCSUnpaidOrderConfigExperimentDraft(experimentId: $experimentId, input: $input) {
      ...UnpaidConfigExperimentFields
    }
  }
`;

export const ARCHIVE_UNPAID_CONFIG_EXPERIMENT = gql`
  ${CONFIG_EXPERIMENT_FIELDS}
  mutation ArchiveUnpaidConfigExperiment($experimentId: ID!) {
    ecommerceArchiveCSUnpaidOrderConfigExperimentDraft(experimentId: $experimentId) {
      ...UnpaidConfigExperimentFields
    }
  }
`;

export const START_UNPAID_CONFIG_EXPERIMENT = gql`
  ${CONFIG_EXPERIMENT_FIELDS}
  mutation StartUnpaidConfigExperiment($experimentId: ID!, $expectedRunningExperimentId: ID) {
    ecommerceStartCSUnpaidOrderConfigExperiment(
      experimentId: $experimentId
      expectedRunningExperimentId: $expectedRunningExperimentId
    ) {
      ...UnpaidConfigExperimentFields
    }
  }
`;

export const STOP_UNPAID_CONFIG_EXPERIMENT = gql`
  ${CONFIG_EXPERIMENT_FIELDS}
  mutation StopUnpaidConfigExperiment($experimentId: ID!) {
    ecommerceStopCSUnpaidOrderConfigExperiment(experimentId: $experimentId) {
      ...UnpaidConfigExperimentFields
    }
  }
`;

export const APPLY_UNPAID_CONFIG_VARIANT = gql`
  mutation ApplyUnpaidConfigVariant($experimentId: ID!, $variantKey: String!) {
    ecommerceApplyCSUnpaidOrderConfigVariantToBase(
      experimentId: $experimentId
      variantKey: $variantKey
    ) {
      reachoutEnabled
      stages {
        id
        enabled
        delayMinutes
        messageTemplate
      }
    }
  }
`;
