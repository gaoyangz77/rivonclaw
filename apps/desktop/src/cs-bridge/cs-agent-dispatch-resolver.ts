import type {
  CsConversationChangedPayload,
  CsConversationSignalPayload,
} from "../cloud/backend-subscription-client.js";

export type CsAgentDispatchReason =
  | "PENDING_BUYER_MESSAGE"
  | "MANUAL_START"
  | "SESSION_EXPIRING_ESCALATION_FOLLOW_UP"
  | "SESSION_EXPIRING_CUSTOMER_FOLLOW_UP"
  | "UNPAID_ORDER_FOLLOW_UP"
  | "BAD_REVIEW_REACHOUT";

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
  BAD_REVIEW_REACHOUT: {
    signalType: "MANUAL_START",
    dispatchReason: "BAD_REVIEW_REACHOUT",
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
  "Follow the operator instruction for this dispatch.",
  "Use the current tool specs as the source of truth for tool behavior and parameters.",
  "Use the provided dispatch context and local session context before taking action.",
  "Do not invent platform state; use tools when needed.",
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
        "This dispatch MUST produce a buyer-facing reply unless you intentionally end the session with ecom_cs_end_session.",
        "If the buyer's latest message needs no substantive answer, still send a brief acknowledgement in the buyer's language instead of finishing silently.",
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
        "This is a backend-directed close-out dispatch for a resolved customer-service conversation approaching platform timeout.",
        "Use the operator instruction as the task authority.",
        "Use the provided dispatch context and local session context; fetch more context only when the operator instruction cannot be executed from available context.",
        END_SESSION_GUIDANCE,
      ].join(" ");
    case "UNPAID_ORDER_FOLLOW_UP":
      return [
        "This dispatch was initiated by backend/Airflow for a TikTok Shop unpaid-order customer-service flow.",
      ].join(" ");
    case "BAD_REVIEW_REACHOUT":
      return [
        "This dispatch was initiated by backend/Airflow for a TikTok Shop bad-review reachout.",
        "Do not assume a buyer message triggered this run.",
        "Use the operator instruction as the task authority and review context.",
        "Send one concise buyer-facing message: apologize for the poor experience and ask what went wrong or how we can help.",
        "Do not offer coupons, refunds, replacements, or other compensation unless the current shop policy and conversation context explicitly support it.",
        END_SESSION_GUIDANCE,
      ].join(" ");
  }
}
