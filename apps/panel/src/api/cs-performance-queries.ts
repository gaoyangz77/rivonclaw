import { gql } from "@apollo/client/core";

export const ECOMMERCE_GET_CS_UNPAID_REACHOUT_PERFORMANCE_QUERY = gql`
  query EcommerceGetCSUnpaidOrderReachoutPerformance($shopId: String, $startTime: String, $endTime: String) {
    ecommerceGetCSUnpaidOrderReachoutPerformance(shopId: $shopId, startTime: $startTime, endTime: $endTime) {
      startDate endDate semanticsNotice
      summary { eligible reached sentMessages associatedPaidOrders associatedSalesUnits associatedConversionRate associatedGmv { currency amount } }
      byDate { cohortDate eligible reached sentMessages associatedPaidOrders associatedSalesUnits associatedConversionRate associatedGmv { currency amount } }
      byStage { stageId stageIndex delayMinutes eligible sent associatedPayments associatedSalesUnits associatedGmv { currency amount } }
      experiment {
        experimentId insufficientSample absolutePaymentRateDifference relativePaymentRateDifference confidenceIntervalLow confidenceIntervalHigh
        arms { assignment eligible paidOrders paymentRate gmvPerEligible { currency amount } unitsPerEligible }
      }
    }
  }
`;

export const ECOMMERCE_GET_CS_PERFORMANCE_QUERY = gql`
  query EcommerceGetCSPerformance($shopId: String, $startTime: String, $endTime: String) {
    ecommerceGetCSPerformance(shopId: $shopId, startTime: $startTime, endTime: $endTime) {
      scope {
        shopId
        shopCount
        startDate
        endDate
      }
      summary {
        csGuidedGmv
        csGuidedGmv7dAverage
        csGuidedGmv7dAverageCurrency
        csGuidedGmvCurrency
        activeConversations
        newConversations
        reopenedConversations
        escalateConversations
        escalationResolved
        escalationRatio
        escalationResolveRate
        inboundMessages
        outboundMessages
        errorCount
        errorsPerConversation
        inputTokens
        outputTokens
        totalTokens
        tokensPerConversation
        newSessionCount
        supportSessionCount
        endedMessageCount
        ratedSessions
        satisfiedSessions
        satisfactionRate
        avgFirstResponseSecs
        firstResponseCount
        firstResponseP50Secs
      }
      byDate {
        dateKey
        startDate
        endDate
        csGuidedGmv
        csGuidedGmv7dAverage
        csGuidedGmv7dAverageCurrency
        csGuidedGmvCurrency
        activeConversations
        newConversations
        reopenedConversations
        escalateConversations
        escalationResolved
        escalationRatio
        escalationResolveRate
        inboundMessages
        outboundMessages
        errorCount
        errorsPerConversation
        inputTokens
        outputTokens
        totalTokens
        tokensPerConversation
        newSessionCount
        supportSessionCount
        endedMessageCount
        ratedSessions
        satisfiedSessions
        satisfactionRate
        avgFirstResponseSecs
        firstResponseCount
        firstResponseP50Secs
      }
    }
  }
`;

export const ECOMMERCE_GET_CS_REALTIME_PERFORMANCE_QUERY = gql`
  query EcommerceGetCSRealtimePerformance($shopId: String, $hours: Int) {
    ecommerceGetCSRealtimePerformance(shopId: $shopId, hours: $hours) {
      scope {
        shopId
        shopCount
        hours
        bucketMinutes
        startTime
        endTime
      }
      points {
        sampledAt
        activeConversations
        pendingConversations
        escalatedConversations
        pendingAgeSecs
        pendingOver5m
        pendingOver15m
        pendingOver30m
        firstResponseP50Secs
        escalationCreatedCount
        escalationResolvedCount
        agentRoundCount
        endedSessionCount
      }
    }
  }
`;
