/**
 * Sends one CS message. The mutation is purposely minimal — no BI counters
 * piggyback. All per-conversation analytics (message count, token totals,
 * tool-call argsJson) now flow through the CS business telemetry stream
 * (`cs.message`, `cs.token_snapshot`, `ecom.tool_call` events in ClickHouse),
 * not through MongoDB. See `packages/telemetry` + `CustomerServiceSession`.
 */
export const SEND_MESSAGE_MUTATION = `
  mutation(
    $shopId: String!,
    $conversationId: String!,
    $type: EcomMessageType!,
    $content: String!
  ) {
    ecommerceSendMessage(
      shopId: $shopId,
      conversationId: $conversationId,
      type: $type,
      content: $content
    ) {
      messageId
    }
  }
`;

export const GET_CONVERSATION_DETAILS_QUERY = `
  query($shopId: String!, $conversationId: String!) {
    ecommerceGetConversationDetails(shopId: $shopId, conversationId: $conversationId) {
      buyer { userId nickname }
    }
  }
`;

export const GET_CONVERSATION_MESSAGE_DELTA_QUERY = `
  query CsConversationMessageDelta(
    $shopId: String!,
    $conversationId: String!,
    $currentMessageId: String!,
    $anchor: ConversationMessageDeltaAnchorInput,
    $maxPages: Int,
    $locale: String
  ) {
    ecommerceGetConversationMessageDelta(
      shopId: $shopId,
      conversationId: $conversationId,
      currentMessageId: $currentMessageId,
      anchor: $anchor,
      maxPages: $maxPages,
      locale: $locale
    ) {
      items {
        messageId
        type
        text
        createTime
        sender {
          role
          nickname
        }
      }
      meta {
        completeness
        anchorMatchType
        currentMessageFound
        anchorMatched
        pageLimitReached
        fetchedMessageCount
        anchorMessageId
        anchorCreateTime
      }
    }
  }
`;

export const GET_BUYER_ORDERS_QUERY = `
  query($shopId: String!, $buyerUserId: String) {
    ecommerceGetOrders(shopId: $shopId, buyerUserId: $buyerUserId) {
      orderId
      createTime
    }
  }
`;

export const CS_GET_OR_CREATE_SESSION_MUTATION = `
  mutation CsGetOrCreateSession($shopId: ID!, $conversationId: String!) {
    csGetOrCreateSession(shopId: $shopId, conversationId: $conversationId) {
      sessionId
      isNew
      balance
    }
  }
`;

const CS_ESCALATION_EVENT_FIELDS = `
  escalation {
    id
    shopId
    conversationId
    buyerUserId
    orderId
    reason
    context
    status
    version
  }
  event {
    id
    type
    status
    decision
    instructions
    createdAt
    updatedAt
  }
`;

export const CS_CLAIM_ESCALATION_EVENT_MUTATION = `
  mutation CsClaimEscalationEvent($input: ClaimCsEscalationEventInput!) {
    csClaimEscalationEvent(input: $input) {
      ${CS_ESCALATION_EVENT_FIELDS}
    }
  }
`;

export const CS_ACK_ESCALATION_EVENT_MUTATION = `
  mutation CsAckEscalationEvent($input: AckCsEscalationEventInput!) {
    csAckEscalationEvent(input: $input) {
      ${CS_ESCALATION_EVENT_FIELDS}
    }
  }
`;

export const CS_ESCALATE_MUTATION = `
  mutation CsEscalate(
    $shopId: ID!,
    $conversationId: String!,
    $buyerUserId: String!,
    $reason: String!,
    $orderId: String,
    $context: String
  ) {
    csEscalate(
      shopId: $shopId,
      conversationId: $conversationId,
      buyerUserId: $buyerUserId,
      reason: $reason,
      orderId: $orderId,
      context: $context
    ) {
      ok
      escalationId
      status
      error
    }
  }
`;

export const CS_RESPOND_MUTATION = `
  mutation CsRespond($escalationId: ID!, $decision: String!, $instructions: String!, $resolved: Boolean!) {
    csRespond(
      escalationId: $escalationId,
      decision: $decision,
      instructions: $instructions,
      resolved: $resolved
    ) {
      ok
      escalationId
      status
      version
      error
    }
  }
`;

export const CS_GET_ESCALATION_RESULT_QUERY = `
  query CsGetEscalationResult($escalationId: ID!) {
    csGetEscalationResult(escalationId: $escalationId) {
      id
      shopId
      conversationId
      buyerUserId
      orderId
      reason
      context
      createdAt
      status
      version
      guidance
      result {
        decision
        instructions
        resolved
        resolvedAt
      }
    }
  }
`;
