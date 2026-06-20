import { createLogger } from "@rivonclaw/logger";
import type { AffiliateWorkItemPayload } from "../cloud/backend-subscription-client.js";
import { getCsBridge } from "../gateway/connection.js";
import { rootStore } from "../app/store/desktop-store.js";

const log = createLogger("affiliate-work-item-actuator");

function findWorkItemShop(workItem: AffiliateWorkItemPayload): any | undefined {
  return rootStore.findShopByObjectOrPlatformId(workItem.shopId, workItem.platformShopId);
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

  ingestAffiliateWorkItemEntities(workItem);

  const bridge = getCsBridge();
  if (!bridge) {
    log.warn(`Affiliate work item arrived before ecommerce bridge was ready: shop=${workItem.platformShopId}`);
    return;
  }

  await bridge.handleAffiliateWorkItemChanged(workItem);
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
