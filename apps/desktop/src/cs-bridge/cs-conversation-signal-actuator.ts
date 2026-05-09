import { createLogger } from "@rivonclaw/logger";
import { rootStore } from "../app/store/desktop-store.js";
import { getCsBridge } from "../gateway/connection.js";
import type { CsConversationSignalPayload } from "../cloud/backend-subscription-client.js";

const log = createLogger("cs-signal-actuator");

function findSignalShop(signal: CsConversationSignalPayload): any | undefined {
  return rootStore.shops.find((shop: any) =>
    shop.id === signal.shopId || shop.platformShopId === signal.platformShopId,
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

  const bridge = getCsBridge();
  if (!bridge) {
    log.warn(`CS signal arrived before bridge was ready: shop=${signal.platformShopId} conv=${signal.conversationId}`);
    return;
  }

  await bridge.handleCsConversationSignal(signal);
}
