import type {
  CsConversationChangedPayload,
  CsConversationSignalPayload,
} from "../cloud/backend-subscription-client.js";

export type CsAgentDispatchReason =
  | "PENDING_BUYER_MESSAGE"
  | "MANUAL_START"
  | "SESSION_EXPIRING_ESCALATION_FOLLOW_UP"
  | "SESSION_EXPIRING_CUSTOMER_FOLLOW_UP"
  | "UNPAID_ORDER_FOLLOW_UP";

export interface CsAgentDispatchRequest extends CsConversationSignalPayload {
  dispatchReason: CsAgentDispatchReason;
  useMessageDelta: boolean;
}

const CONVERSATION_DISPATCH_PLANS: Record<string, {
  signalType: CsConversationSignalPayload["type"];
  dispatchReason: CsAgentDispatchReason;
  useMessageDelta: boolean;
}> = {
  MANUAL_START: {
    signalType: "MANUAL_START",
    dispatchReason: "MANUAL_START",
    useMessageDelta: false,
  },
  PENDING_BUYER_MESSAGE: {
    signalType: "UNREAD_DETECTED",
    dispatchReason: "PENDING_BUYER_MESSAGE",
    useMessageDelta: true,
  },
  SESSION_EXPIRING_ESCALATION_FOLLOW_UP: {
    signalType: "UNREAD_DETECTED",
    dispatchReason: "SESSION_EXPIRING_ESCALATION_FOLLOW_UP",
    useMessageDelta: false,
  },
  SESSION_EXPIRING_CUSTOMER_FOLLOW_UP: {
    signalType: "UNREAD_DETECTED",
    dispatchReason: "SESSION_EXPIRING_CUSTOMER_FOLLOW_UP",
    useMessageDelta: false,
  },
  UNPAID_ORDER_FOLLOW_UP: {
    signalType: "UNPAID_ORDER_FOLLOW_UP",
    dispatchReason: "UNPAID_ORDER_FOLLOW_UP",
    useMessageDelta: false,
  },
};

const SIGNAL_DISPATCH_PLANS: Record<string, {
  dispatchReason: CsAgentDispatchReason;
  useMessageDelta: boolean;
}> = {
  MANUAL_START: {
    dispatchReason: "MANUAL_START",
    useMessageDelta: false,
  },
  MESSAGE_RECEIVED: {
    dispatchReason: "PENDING_BUYER_MESSAGE",
    useMessageDelta: true,
  },
  UNREAD_DETECTED: {
    dispatchReason: "PENDING_BUYER_MESSAGE",
    useMessageDelta: true,
  },
  UNPAID_ORDER_FOLLOW_UP: {
    dispatchReason: "UNPAID_ORDER_FOLLOW_UP",
    useMessageDelta: false,
  },
};

const END_SESSION_GUIDANCE = [
  "Use ecom_cs_end_session only as a deliberate close-out action after the buyer's issue is clearly complete.",
  "Before ending, verify there is no open escalation, no unresolved follow-up, no pending buyer choice/action, and the latest buyer message explicitly indicates no more help is needed or confirms a completed action that requires no response.",
  "Do not end the session after short acknowledgements, apologies, or backchannels such as 'ok', 'oh mb', 'got it', or 'thanks'; reply or leave the session open so the buyer can finish.",
  "Do not end immediately after offering a choice, cancellation check, replacement/refund step, tracking follow-up, or anything that may invite another buyer response.",
  "In after-sales service, if recent order context exists, send one separate warm message asking the customer for a positive review before calling ecom_cs_end_session.",
  "Ending the session lets the platform close the support session cleanly and may show the buyer the appropriate review/evaluation flow.",
  "Never call ecom_cs_end_session while an escalation is still open or while the buyer still needs service.",
].join(" ");

export function resolveCsConversationDispatch(
  conversation: CsConversationChangedPayload,
  shop: { id?: string; platformShopId?: string },
): CsAgentDispatchRequest | null {
  const hint = conversation.dispatchHint;
  if (!hint) return null;
  const plan = CONVERSATION_DISPATCH_PLANS[String(hint.reason)];
  if (!plan) return null;

  const buyer = conversation.participants?.find((participant) => participant?.role === "BUYER")
    ?? conversation.participants?.find(Boolean);
  const eventTime = hint.eventTime != null
    ? new Date(hint.eventTime * 1000).toISOString()
    : new Date().toISOString();
  const isPendingBuyerDispatch = plan.dispatchReason === "PENDING_BUYER_MESSAGE";
  const hintMessageId = hint.messageId ?? undefined;
  const hintMessageIndex = hint.messageIndex ?? undefined;
  if (isPendingBuyerDispatch && !hintMessageId) return null;
  const localLatestMatchesHint = Boolean(
    hintMessageId &&
    conversation.latestMessage?.messageId &&
    hintMessageId === conversation.latestMessage.messageId,
  );

  return {
    type: plan.signalType,
    dispatchReason: plan.dispatchReason,
    useMessageDelta: plan.useMessageDelta,
    source: hint.source as CsConversationSignalPayload["source"],
    shopId: conversation.shopId ?? shop.id ?? "",
    platformShopId: conversation.platformShopId ?? shop.platformShopId ?? "",
    conversationId: conversation.conversationId,
    messageId: hintMessageId ?? (isPendingBuyerDispatch ? undefined : conversation.latestMessage?.messageId ?? undefined),
    messageIndex: hintMessageIndex ?? (isPendingBuyerDispatch ? undefined : conversation.latestMessage?.index ?? undefined),
    imUserId: buyer?.imUserId ?? undefined,
    buyerUserId: buyer?.userId ?? undefined,
    orderId: conversation.orderId ?? undefined,
    messageType: isPendingBuyerDispatch && !localLatestMatchesHint
      ? undefined
      : conversation.latestMessage?.type ?? undefined,
    senderRole: isPendingBuyerDispatch
      ? "BUYER"
      : conversation.latestMessage?.sender?.role ?? undefined,
    aiEnabled: conversation.aiEnabled ?? true,
    latestMessagePreview: isPendingBuyerDispatch && !localLatestMatchesHint
      ? undefined
      : conversation.latestMessagePreview ?? conversation.latestMessage?.content ?? undefined,
    operatorInstruction: hint.operatorInstruction ?? undefined,
    dispatchEventTime: hint.dispatchEventTime != null
      ? new Date(hint.dispatchEventTime * 1000).toISOString()
      : eventTime,
    eventTime,
  };
}

export function resolveCsSignalDispatch(
  signal: CsConversationSignalPayload | CsAgentDispatchRequest,
): CsAgentDispatchRequest | null {
  const existingReason = (signal as Partial<CsAgentDispatchRequest>).dispatchReason;
  const existingUseMessageDelta = (signal as Partial<CsAgentDispatchRequest>).useMessageDelta;
  if (existingReason && typeof existingUseMessageDelta === "boolean") {
    return signal as CsAgentDispatchRequest;
  }

  const plan = SIGNAL_DISPATCH_PLANS[String(signal.type)];
  if (!plan) return null;
  return {
    ...signal,
    dispatchReason: plan.dispatchReason,
    useMessageDelta: plan.useMessageDelta,
  };
}

export function buildCsAgentDispatchSystemPrompt(reason: CsAgentDispatchReason): string {
  switch (reason) {
    case "PENDING_BUYER_MESSAGE":
      return [
        "A buyer may be waiting for a response in this conversation.",
        "Treat this dispatch as buyer-message handling: identify the latest buyer-side request, verify the current platform conversation state, and respond only after you understand what the buyer actually needs.",
        "WARNING: there may have been messages exchanged since your last interaction that you did not receive.",
        "You MUST call ecom_cs_get_conversation_messages before sending a buyer-facing response unless this run includes a complete conversation delta in the prompt.",
        "If you create or update an escalation, you still MUST send a concise buyer-facing status reply in this same run unless you intentionally end the session.",
        END_SESSION_GUIDANCE,
      ].join(" ");
    case "MANUAL_START":
      return [
        "An operator manually asked you to work on this customer-service conversation.",
        "Do not assume a new buyer message triggered this run.",
        "Follow the operator instruction when provided, inspect the latest conversation state as needed, and take only actions that are supported by the current platform context.",
        END_SESSION_GUIDANCE,
      ].join(" ");
    case "SESSION_EXPIRING_ESCALATION_FOLLOW_UP":
      return [
        "This customer-service session is approaching the platform timeout and still has an open escalation.",
        "Inspect the latest conversation, escalation, and order context before taking action.",
        "If the escalated request is still needed, send the buyer a concise, truthful progress update when appropriate.",
        "If the buyer's request changed, normal customer-service handling already resolved the issue, or a human customer-service operator already handled the case, call cs_dismiss_conversation_escalations.",
        "After dismissing open escalations, call ecom_cs_end_session only when the close-out criteria are satisfied.",
        "Do not claim resolution, dismiss an escalation, end the session, or offer compensation unless the current conversation context supports it.",
        END_SESSION_GUIDANCE,
      ].join(" ");
    case "SESSION_EXPIRING_CUSTOMER_FOLLOW_UP":
      return [
        "This customer-service session is approaching the platform timeout after customer service sent the latest effective message and the buyer has not replied.",
        "This dispatch is for at most one lightweight follow-up asking whether the buyer still needs help.",
        "Inspect the latest conversation state first, avoid repeating a recent follow-up, and do not introduce new promises or complex workflows unless the buyer has actually asked for them.",
        "If the current platform context explicitly shows the buyer no longer needs help and there is no pending buyer choice/action, call ecom_cs_end_session instead of sending another follow-up.",
        "Do not end after a short acknowledgement such as 'ok', 'oh mb', 'got it', or 'thanks' unless the buyer also clearly said they need nothing else.",
      ].join(" ");
    case "UNPAID_ORDER_FOLLOW_UP":
      return [
        "This is a backend/Airflow-driven proactive reachout for a TikTok Shop unpaid order.",
        "The backend has already selected the order as unpaid and eligible; do not spend tokens rechecking unpaid status or eligibility.",
        "Use the target language specified in the operator instruction.",
        "Send at most one concise, natural seller-initiated reminder that can help the buyer continue checkout or ask a relevant question.",
        "Do not imply the buyer contacted support first, do not claim a discount or urgency unless current product/promotion context supports it, and do not create an escalation unless you find a real customer-service issue.",
        "You may use customer-service order, product, or promotion tools when useful for personalization.",
      ].join(" ");
  }
}
