/**
 * Sends one CS message. The optional `usage` argument piggybacks the
 * conversation's cumulative LLM token totals for billing accounting — backend
 * advances `cs_sessions.inputTokens` / `outputTokens` via `$max` and refreshes
 * `lastProvider` / `lastModel` without any seat indirection.
 *
 * Usage is intentionally optional: a missing or malformed payload must never
 * block message delivery, so Desktop omits the argument when it cannot build a
 * valid snapshot.
 */
export const SEND_MESSAGE_MUTATION = `
  mutation(
    $shopId: String!,
    $conversationId: String!,
    $type: EcomMessageType!,
    $content: String!,
    $usage: CsSendUsageInput
  ) {
    ecommerceSendMessage(
      shopId: $shopId,
      conversationId: $conversationId,
      type: $type,
      content: $content,
      usage: $usage
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

export const GET_BUYER_ORDERS_QUERY = `
  query($shopId: String!, $buyerUserId: String) {
    ecommerceGetOrders(shopId: $shopId, buyerUserId: $buyerUserId) {
      items { orderId createTime }
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

/**
 * Increments CS session messageCount. Counts BOTH inbound buyer messages and
 * outbound agent replies — one call per message (not per "turn"). This is the
 * raw conversation message counter.
 */
export const CS_INCREMENT_MESSAGE_COUNT_MUTATION = `
  mutation CsIncrementMessageCount($shopId: ID!, $conversationId: String!) {
    csIncrementMessageCount(shopId: $shopId, conversationId: $conversationId)
  }
`;
