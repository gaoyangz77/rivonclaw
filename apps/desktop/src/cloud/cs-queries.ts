export const SEND_MESSAGE_MUTATION = `
  mutation($shopId: String!, $conversationId: String!, $type: EcomMessageType!, $content: String!) {
    ecommerceSendMessage(shopId: $shopId, conversationId: $conversationId, type: $type, content: $content) {
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
  mutation CsGetOrCreateSession($shopId: ID!, $conversationId: String!, $buyerUserId: String!) {
    csGetOrCreateSession(shopId: $shopId, conversationId: $conversationId, buyerUserId: $buyerUserId) {
      sessionId
      isNew
      balance
    }
  }
`;
