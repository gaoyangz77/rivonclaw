import { createLogger } from "@rivonclaw/logger";
import type { AffiliateConversationSignalPayload } from "../cloud/backend-subscription-client.js";
import { getCsBridge } from "../gateway/connection.js";
import { rootStore } from "../app/store/desktop-store.js";

const log = createLogger("affiliate-signal-actuator");

function findSignalShop(signal: AffiliateConversationSignalPayload): any | undefined {
  return rootStore.shops.find((shop: any) =>
    shop.id === signal.shopId || shop.platformShopId === signal.platformShopId,
  );
}

/**
 * Wire affiliate backend signals into the desktop subscription lifecycle.
 *
 * Business execution is intentionally left empty for now. Keeping this as a
 * separate actuator gives us the subscription plumbing without coupling
 * affiliate workflow decisions to the lower-level GraphQL subscription client.
 */
export async function handleAffiliateConversationSignal(
  deviceId: string,
  signal: AffiliateConversationSignalPayload,
): Promise<void> {
  log.info(
    `Affiliate signal received: type=${signal.type} shop=${signal.platformShopId} ` +
    `conv=${signal.conversationId ?? ""} msg=${signal.messageId ?? ""}`,
  );

  const shop = findSignalShop(signal);
  const affiliateService = shop?.services?.affiliateService;
  if (!shop || !affiliateService?.enabled) {
    log.info(`Ignoring affiliate signal for unavailable/disabled shop ${signal.platformShopId}`);
    return;
  }

  if (affiliateService.csDeviceId !== deviceId) {
    log.info(
      `Ignoring affiliate signal for shop ${signal.platformShopId}: ` +
      `assignedDevice=${affiliateService.csDeviceId ?? ""} currentDevice=${deviceId}`,
    );
    return;
  }

  const bridge = getCsBridge();
  if (!bridge) {
    log.warn(`Affiliate signal arrived before ecommerce bridge was ready: shop=${signal.platformShopId}`);
    return;
  }

  await bridge.handleAffiliateConversationSignal(signal);
}
