import { createLogger } from "@rivonclaw/logger";
import { rootStore } from "../app/store/desktop-store.js";
import { getCsBridge } from "../gateway/connection.js";
import type {
  CsConversationChangedPayload,
  CsConversationSignalPayload,
} from "../cloud/backend-subscription-client.js";

const log = createLogger("cs-signal-actuator");

const DISPATCH_REASON_TO_SIGNAL_TYPE: Record<string, CsConversationSignalPayload["type"]> = {
  MANUAL_START: "MANUAL_START",
  PENDING_BUYER_MESSAGE: "UNREAD_DETECTED",
  SESSION_EXPIRING_ESCALATION_FOLLOW_UP: "UNREAD_DETECTED",
  SESSION_EXPIRING_CUSTOMER_FOLLOW_UP: "UNREAD_DETECTED",
};

function findSignalShop(signal: CsConversationSignalPayload): any | undefined {
  return rootStore.shops.find((shop: any) =>
    shop.id === signal.shopId || shop.platformShopId === signal.platformShopId,
  );
}

function findConversationShop(conversation: CsConversationChangedPayload): any | undefined {
  return rootStore.shops.find((shop: any) =>
    shop.id === conversation.shopId || shop.platformShopId === conversation.platformShopId,
  );
}

function conversationToSignal(
  conversation: CsConversationChangedPayload,
  shop: any,
): CsConversationSignalPayload | null {
  const hint = conversation.dispatchHint;
  if (!hint) return null;
  const signalType = DISPATCH_REASON_TO_SIGNAL_TYPE[String(hint.reason)];
  if (!signalType) {
    log.warn(
      `Ignoring CS conversation dispatch with unknown reason ${String(hint.reason)} ` +
      `for shop=${conversation.platformShopId ?? conversation.shopId ?? ""} ` +
      `conv=${conversation.conversationId}`,
    );
    return null;
  }

  const buyer = conversation.participants?.find((participant) => participant?.role === "BUYER")
    ?? conversation.participants?.find(Boolean);
  const eventTime = hint.eventTime != null
    ? new Date(hint.eventTime * 1000).toISOString()
    : new Date().toISOString();

  return {
    type: signalType,
    source: hint.source,
    shopId: conversation.shopId ?? shop.id,
    platformShopId: conversation.platformShopId ?? shop.platformShopId,
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

/**
 * Execute local CS side effects for backend conversation signals.
 *
 * Backend subscriptions are user-scoped, not device-scoped. Multiple desktops
 * can be signed in as the same user, so the final device gate lives here:
 * only the desktop whose `deviceId` matches the shop's `csDeviceId` may wake
 * the local CS agent.
 */
export async function handleCsConversationSignal(
  deviceId: string,
  signal: CsConversationSignalPayload,
): Promise<void> {
  const shop = findSignalShop(signal);
  const cs = shop?.services?.customerService;

  if (!shop || !cs?.enabled) {
    log.info(`Ignoring CS signal for unavailable/disabled shop ${signal.platformShopId}`);
    return;
  }

  if (!shop.handlesCustomerServiceOnDevice(deviceId)) {
    log.info(
      `Ignoring CS signal for shop ${signal.platformShopId}: ` +
      `assignedDevice=${cs.csDeviceId ?? ""} currentDevice=${deviceId}`,
    );
    return;
  }

  if (signal.aiEnabled === false) {
    log.info(`Ignoring CS signal for shop ${signal.platformShopId} conv=${signal.conversationId}: AI disabled`);
    return;
  }

  const bridge = getCsBridge();
  if (!bridge) {
    log.warn(`CS signal arrived before bridge was ready: shop=${signal.platformShopId} conv=${signal.conversationId}`);
    return;
  }

  await bridge.handleCsConversationSignal(signal);
}

export async function handleCsConversationChanged(
  deviceId: string,
  conversation: CsConversationChangedPayload,
): Promise<void> {
  if (!conversation.dispatchHint) return;

  const shop = findConversationShop(conversation);
  const cs = shop?.services?.customerService;

  if (!shop || !cs?.enabled) {
    log.info(`Ignoring CS conversation change for unavailable/disabled shop ${conversation.platformShopId}`);
    return;
  }

  if (!shop.handlesCustomerServiceOnDevice(deviceId)) {
    log.info(
      `Ignoring CS conversation change for shop ${conversation.platformShopId}: ` +
      `assignedDevice=${cs.csDeviceId ?? ""} currentDevice=${deviceId}`,
    );
    return;
  }

  if (conversation.aiEnabled === false) {
    log.info(`Ignoring CS conversation change for shop ${conversation.platformShopId} conv=${conversation.conversationId}: AI disabled`);
    return;
  }

  const signal = conversationToSignal(conversation, shop);
  if (!signal) return;

  const bridge = getCsBridge();
  if (!bridge) {
    log.warn(`CS conversation change arrived before bridge was ready: shop=${signal.platformShopId} conv=${signal.conversationId}`);
    return;
  }

  await bridge.handleCsConversationSignal(signal);
}
