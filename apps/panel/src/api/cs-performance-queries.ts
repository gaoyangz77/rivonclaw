import { gql } from "@apollo/client/core";

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
