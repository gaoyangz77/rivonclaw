import { createLogger } from "@rivonclaw/logger";
import type { AffiliateWorkItemPayload } from "../cloud/backend-subscription-client.js";
import { getCsBridge } from "../gateway/connection.js";
import { rootStore } from "../app/store/desktop-store.js";

const log = createLogger("affiliate-work-item-actuator");

function findWorkItemShopForDevice(workItem: AffiliateWorkItemPayload, deviceId: string): any | undefined {
  const shopKeys = uniqueShopKeys([
    ...(workItem.routingShopIds ?? []),
    ...(workItem.routingPlatformShopIds ?? []),
    workItem.focusShopId,
    workItem.focusPlatformShopId,
  ]);
  for (const shopKey of shopKeys) {
    const shop = rootStore.findShopByObjectOrPlatformId(shopKey, shopKey);
    const affiliateService = shop?.services?.affiliateService;
    if (shop && affiliateService?.enabled && affiliateService.csDeviceId === deviceId) {
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
    `Affiliate work item received: kind=${workItem.workKind} routes=${(workItem.routingPlatformShopIds ?? []).join(",") || workItem.focusPlatformShopId} ` +
    `collaboration=${workItem.collaborationRecordId} status=${workItem.processingStatus}`,
  );

  const shop = findWorkItemShopForDevice(workItem, deviceId);
  const affiliateService = shop?.services?.affiliateService;
  if (!shop || !affiliateService?.enabled) {
    log.info(`Ignoring affiliate work item with no available enabled route for this desktop`);
    return;
  }

  if (affiliateService.csDeviceId !== deviceId) {
    log.info(
      `Ignoring affiliate work item for shop ${shop.platformShopId}: ` +
      `assignedDevice=${affiliateService.csDeviceId ?? ""} currentDevice=${deviceId}`,
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
  if (isCompleteCollaborationRecord(workItem.collaboration)) {
    workspace.upsertAffiliateCollaborationRecord(workItem.collaboration as any);
  } else if (workItem.collaboration?.id) {
    log.warn(`Skipping incomplete affiliate collaboration snapshot from work item: id=${workItem.collaboration.id}`);
  }

  if (isCompleteSampleApplicationRecord(workItem.sampleApplicationRecord)) {
    workspace.upsertAffiliateSampleApplicationRecord(workItem.sampleApplicationRecord as any);
  } else if (workItem.sampleApplicationRecord?.id) {
    log.warn(`Skipping incomplete affiliate sample snapshot from work item: id=${workItem.sampleApplicationRecord.id}`);
  }

  workspace.upsertAffiliateCreatorRelationship(
    (workItem.creatorRelationship ?? workItem.context?.creatorRelation) as any,
  );
  workspace.upsertAffiliateCreatorProfile(workItem.context?.creatorProfile as any);

  const primarySample = workItem.context?.primarySampleApplication;
  if (isCompleteSampleApplicationRecord(primarySample)) {
    workspace.upsertAffiliateSampleApplicationRecord(primarySample as any);
  } else if (primarySample?.id) {
    log.warn(`Skipping incomplete primary affiliate sample snapshot from work item: id=${primarySample.id}`);
  }

  for (const sample of workItem.context?.relatedSampleApplications ?? []) {
    if (isCompleteSampleApplicationRecord(sample)) {
      workspace.upsertAffiliateSampleApplicationRecord(sample as any);
    } else if (sample?.id) {
      log.warn(`Skipping incomplete related affiliate sample snapshot from work item: id=${sample.id}`);
    }
  }

  const productSummary = (workItem.context?.productContext as any)?.productSummary;
  if (productSummary) {
    workspace.upsertAffiliateProductSummary(productSummary);
  }
}

function hasString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isCompleteCollaborationRecord(record: AffiliateWorkItemPayload["collaboration"]): boolean {
  return Boolean(
    record
    && hasString(record.id)
    && hasString((record as any).userId)
    && hasString((record as any).shopId)
    && hasString(record.creatorId)
    && hasString(record.lifecycleStage)
    && hasString(record.processingStatus)
    && hasString(record.requiredAction)
    && hasString((record as any).stateUpdatedAt)
    && hasString((record as any).startedAt)
    && hasString((record as any).createdAt)
    && hasString(record.updatedAt),
  );
}

function isCompleteSampleApplicationRecord(
  record: AffiliateWorkItemPayload["sampleApplicationRecord"],
): boolean {
  return Boolean(
    record
    && hasString(record.id)
    && hasString(record.userId)
    && hasString(record.shopId)
    && hasString(record.platformApplicationId)
    && hasString(record.sampleWorkStatus)
    && hasString(record.updatedAt),
  );
}
