import { CUSTOMER_SERVICE_AGENT_ID } from "@rivonclaw/core/node";

export function buildCustomerServiceSessionKey(input: {
  platform: string;
  shopId: string;
  conversationId: string;
}): string {
  return `agent:${CUSTOMER_SERVICE_AGENT_ID}:cs:${input.platform}:${input.shopId}:${input.conversationId}`;
}

export function buildCustomerServiceSummarySessionKey(input: {
  shopId: string;
  conversationId: string;
  nonce: string;
}): string {
  return `agent:${CUSTOMER_SERVICE_AGENT_ID}:cs-summary:${input.shopId}:${input.conversationId}:${input.nonce}`;
}
