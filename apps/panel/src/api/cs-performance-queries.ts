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
