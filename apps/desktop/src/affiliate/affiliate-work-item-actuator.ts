import { createLogger } from "@rivonclaw/logger";
import type { AffiliateWorkItemPayload } from "../cloud/backend-subscription-client.js";
import { getCsBridge } from "../gateway/connection.js";
import { rootStore } from "../app/store/desktop-store.js";

const log = createLogger("affiliate-work-item-actuator");

function findWorkItemShopForDevice(workItem: AffiliateWorkItemPayload, deviceId: string): any | undefined {
  const shopKeys = uniqueShopKeys([
    ...(workItem.routingShopIds ?? []),
    ...(workItem.routingPlatformShopIds ?? []),
    workItem.triggerShopId,
    workItem.triggerPlatformShopId,
  ]);
  for (const shopKey of shopKeys) {
    const shop = rootStore.findShopByObjectOrPlatformId(shopKey, shopKey);
    const affiliateService = shop?.services?.affiliateService;
    if (shop && affiliateService?.enabled && affiliateService.deviceId === deviceId) {
      return shop;
    }
  }
  return undefined;
}

export async function handleAffiliateWorkItemChanged(
  deviceId: string,
  workItem: AffiliateWorkItemPayload,
): Promise<void> {
  log.info(
    `Affiliate work item received: kind=${workItem.workKind} routes=${(workItem.routingPlatformShopIds ?? []).join(",") || workItem.triggerPlatformShopId} ` +
    `collaboration=${workItem.affiliateCollaborationId} status=${workItem.processingStatus}`,
  );

  const shop = findWorkItemShopForDevice(workItem, deviceId);
  const affiliateService = shop?.services?.affiliateService;
  if (!shop || !affiliateService?.enabled) {
    log.info(`Ignoring affiliate work item with no available enabled route for this desktop`);
    return;
  }

  if (affiliateService.deviceId !== deviceId) {
    log.info(
      `Ignoring affiliate work item for shop ${shop.platformShopId}: ` +
      `assignedDevice=${affiliateService.deviceId ?? ""} currentDevice=${deviceId}`,
    );
    return;
  }

  ingestAffiliateWorkItemEntities(workItem);

  const bridge = getCsBridge();
  if (!bridge) {
    log.warn(`Affiliate work item arrived before ecommerce bridge was ready: shop=${shop.platformShopId}`);
    return;
  }

  await bridge.handleAffiliateWorkItemChanged(workItem);
}

function uniqueShopKeys(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
}

function ingestAffiliateWorkItemEntities(workItem: AffiliateWorkItemPayload): void {
  const workspace = rootStore.affiliateWorkspace;
  workspace.upsertAffiliateCreatorRelationship(
    (workItem.creatorRelationship ?? workItem.context?.creatorRelation) as any,
  );

  const productSummary = (workItem.context?.productContext as any)?.productSummary;
  if (productSummary) {
    workspace.upsertAffiliateProductSummary(productSummary);
  }
}
