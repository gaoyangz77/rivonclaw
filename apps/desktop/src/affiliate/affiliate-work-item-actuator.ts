import { createLogger } from "@rivonclaw/logger";
import type { AffiliateWorkItemPayload } from "../cloud/backend-subscription-client.js";
import { getCsBridge } from "../gateway/connection.js";
import { rootStore } from "../app/store/desktop-store.js";

const log = createLogger("affiliate-work-item-actuator");

function findWorkItemShop(workItem: AffiliateWorkItemPayload): any | undefined {
  return rootStore.shops.find((shop: any) =>
    shop.id === workItem.shopId || shop.platformShopId === workItem.platformShopId,
  );
}

export async function handleAffiliateWorkItemChanged(
  deviceId: string,
  workItem: AffiliateWorkItemPayload,
): Promise<void> {
  log.info(
    `Affiliate work item received: kind=${workItem.workKind} shop=${workItem.platformShopId} ` +
    `collaboration=${workItem.collaborationRecordId} status=${workItem.processingStatus}`,
  );

  const shop = findWorkItemShop(workItem);
  const affiliateService = shop?.services?.affiliateService;
  if (!shop || !affiliateService?.enabled) {
    log.info(`Ignoring affiliate work item for unavailable/disabled shop ${workItem.platformShopId}`);
    return;
  }

  if (affiliateService.csDeviceId !== deviceId) {
    log.info(
      `Ignoring affiliate work item for shop ${workItem.platformShopId}: ` +
      `assignedDevice=${affiliateService.csDeviceId ?? ""} currentDevice=${deviceId}`,
    );
    return;
  }

  const bridge = getCsBridge();
  if (!bridge) {
    log.warn(`Affiliate work item arrived before ecommerce bridge was ready: shop=${workItem.platformShopId}`);
    return;
  }

  await bridge.handleAffiliateWorkItemChanged(workItem);
}
