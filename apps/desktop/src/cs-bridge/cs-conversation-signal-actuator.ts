import { createLogger } from "@rivonclaw/logger";
import { rootStore } from "../app/store/desktop-store.js";
import { getCsBridge } from "../gateway/connection.js";
import type {
  CsConversationChangedPayload,
  CsConversationSignalPayload,
} from "../cloud/backend-subscription-client.js";
import {
  resolveCsConversationDispatch,
  resolveCsSignalDispatch,
} from "./cs-agent-dispatch-resolver.js";

const log = createLogger("cs-signal-actuator");

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
  const bridge = getCsBridge();
  const hasCachedContext = bridge?.hasShopContext(signal.platformShopId) ?? false;

  if ((!shop || !cs?.enabled) && !hasCachedContext) {
    log.info(`Ignoring CS signal for unavailable/disabled shop ${signal.platformShopId}`);
    return;
  }

  if (shop && !shop.handlesCustomerServiceOnDevice(deviceId)) {
    log.info(
      `Ignoring CS signal for shop ${signal.platformShopId}: ` +
      `assignedDevice=${cs?.csDeviceId ?? ""} currentDevice=${deviceId}`,
    );
    return;
  }

  if (signal.aiEnabled === false) {
    log.info(`Ignoring CS signal for shop ${signal.platformShopId} conv=${signal.conversationId}: AI disabled`);
    return;
  }

  const dispatch = resolveCsSignalDispatch(signal);
  if (!dispatch) {
    log.warn(
      `Ignoring CS signal with unknown type ${String(signal.type)} ` +
      `for shop=${signal.platformShopId} conv=${signal.conversationId}`,
    );
    return;
  }

  if (!bridge) {
    log.warn(`CS signal arrived before bridge was ready: shop=${signal.platformShopId} conv=${signal.conversationId}`);
    return;
  }

  await bridge.handleCsConversationSignal(dispatch);
}

export async function handleCsConversationChanged(
  deviceId: string,
  conversation: CsConversationChangedPayload,
): Promise<void> {
  if (!conversation.dispatchHint) return;

  const shop = findConversationShop(conversation);
  const cs = shop?.services?.customerService;
  const bridge = getCsBridge();
  const hasCachedContext = bridge?.hasShopContext(conversation.platformShopId) ?? false;

  if ((!shop || !cs?.enabled) && !hasCachedContext) {
    log.info(`Ignoring CS conversation change for unavailable/disabled shop ${conversation.platformShopId}`);
    return;
  }

  if (shop && !shop.handlesCustomerServiceOnDevice(deviceId)) {
    log.info(
      `Ignoring CS conversation change for shop ${conversation.platformShopId}: ` +
      `assignedDevice=${cs?.csDeviceId ?? ""} currentDevice=${deviceId}`,
    );
    return;
  }

  if (conversation.aiEnabled === false) {
    log.info(`Ignoring CS conversation change for shop ${conversation.platformShopId} conv=${conversation.conversationId}: AI disabled`);
    return;
  }

  const dispatch = resolveCsConversationDispatch(conversation, shop ?? {
    id: conversation.shopId ?? undefined,
    platformShopId: conversation.platformShopId ?? undefined,
  });
  if (!dispatch) {
    log.warn(
      `Ignoring CS conversation dispatch with unsupported or incomplete hint ${String(conversation.dispatchHint.reason)} ` +
      `for shop=${conversation.platformShopId ?? conversation.shopId ?? ""} ` +
      `conv=${conversation.conversationId}`,
    );
    return;
  }

  if (!bridge) {
    log.warn(`CS conversation change arrived before bridge was ready: shop=${dispatch.platformShopId} conv=${dispatch.conversationId}`);
    return;
  }

  await bridge.handleCsConversationSignal(dispatch);
}
