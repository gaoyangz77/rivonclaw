import type {
  CsConversationChangedPayload,
  CsConversationSignalPayload,
} from "../cloud/backend-subscription-client.js";

export type CsAgentDispatchReason =
  | "PENDING_BUYER_MESSAGE"
  | "MANUAL_START"
  | "SESSION_EXPIRING_ESCALATION_FOLLOW_UP"
  | "SESSION_EXPIRING_CUSTOMER_FOLLOW_UP";

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
};

const END_SESSION_GUIDANCE = [
  "When the buyer's issue is fully handled, there is no open escalation, no unresolved follow-up, and no need to wait for more buyer input, call ecom_cs_end_session after sending the final helpful reply.",
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

  return {
    type: plan.signalType,
    dispatchReason: plan.dispatchReason,
    useMessageDelta: plan.useMessageDelta,
    source: hint.source as CsConversationSignalPayload["source"],
    shopId: conversation.shopId ?? shop.id ?? "",
    platformShopId: conversation.platformShopId ?? shop.platformShopId ?? "",
    conversationId: conversation.conversationId,
    messageId: hint.messageId ?? conversation.latestMessage?.messageId ?? undefined,
    messageIndex: hint.messageIndex ?? conversation.latestMessage?.index ?? undefined,
    imUserId: buyer?.imUserId ?? undefined,
    buyerUserId: buyer?.userId ?? undefined,
    orderId: conversation.orderId ?? undefined,
    messageType: conversation.latestMessage?.type ?? undefined,
    senderRole: conversation.latestMessage?.sender?.role ?? undefined,
    aiEnabled: conversation.aiEnabled ?? true,
    latestMessagePreview: conversation.latestMessagePreview ?? conversation.latestMessage?.content ?? undefined,
    operatorInstruction: hint.operatorInstruction ?? undefined,
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
        "This dispatch is for a concise, truthful progress update if the issue is still being worked on.",
        "Inspect the latest conversation and escalation/order context before messaging.",
        "Do not claim resolution, close/dismiss the escalation, or offer compensation unless the operator explicitly instructed it and the conversation context supports it.",
      ].join(" ");
    case "SESSION_EXPIRING_CUSTOMER_FOLLOW_UP":
      return [
        "This customer-service session is approaching the platform timeout after customer service sent the latest effective message and the buyer has not replied.",
        "This dispatch is for at most one lightweight follow-up asking whether the buyer still needs help.",
        "Inspect the latest conversation state first, avoid repeating a recent follow-up, and do not introduce new promises or complex workflows unless the buyer has actually asked for them.",
        "If the current platform context clearly shows the buyer no longer needs help, call ecom_cs_end_session instead of sending another follow-up.",
      ].join(" ");
  }
}
