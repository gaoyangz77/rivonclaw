import { gql } from "@apollo/client/core";
export const GET_UNPAID_EVALUATION = gql`
  query GetUnpaidEvaluation($shopId: ID!) {
    ecommerceGetCSUnpaidOrderEvaluation(shopId: $shopId) {
      enabled
      holdoutPercent
      configExperiment {
        id
        status
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
    }
  }
`;
export const CREATE_UNPAID_CONFIG_EXPERIMENT = gql`
  mutation CreateUnpaidConfigExperiment($input: CsUnpaidOrderConfigExperimentInput!) {
    ecommerceCreateCSUnpaidOrderConfigExperimentDraft(input: $input) {
      id
      status
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
  }
`;
export const START_UNPAID_CONFIG_EXPERIMENT = gql`
  mutation StartUnpaidConfigExperiment($experimentId: ID!) {
    ecommerceStartCSUnpaidOrderConfigExperiment(experimentId: $experimentId) {
      id
      status
      startedAt
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
  }
`;
export const STOP_UNPAID_CONFIG_EXPERIMENT = gql`
  mutation StopUnpaidConfigExperiment($experimentId: ID!) {
    ecommerceStopCSUnpaidOrderConfigExperiment(experimentId: $experimentId)
  }
`;
