import { createLogger } from "@rivonclaw/logger";
import type { AffiliateWorkItemPayload } from "../cloud/backend-subscription-client.js";
import { getCsBridge } from "../gateway/connection.js";
import { rootStore } from "../app/store/desktop-store.js";

const log = createLogger("affiliate-work-item-actuator");

/**
 * The single device a work item is targeted at, or the reason no device can
 * claim it. Exactly one Desktop may dispatch a given work item; every Desktop
 * computes the same target from the same payload, and only the one whose
 * local device id equals the target proceeds.
 */
export type AffiliateWorkItemDeviceTarget =
  | { kind: "BUSINESS_DEVELOPER"; deviceId: string }
  /**
   * A Business Developer owns the Relationship but has no outreach device
   * bound. Nobody dispatches — the work waits visibly (the Panel banner is
   * the remediation surface). There is deliberately NO shop fallback: shop
   * devices must not pick up Business Developer work.
   */
  | { kind: "BUSINESS_DEVELOPER_WITHOUT_DEVICE" }
  | { kind: "SHOP"; deviceId: string; shopId: string }
  /** No candidate shop is enabled with an affiliate device; nobody dispatches. */
  | { kind: "NO_ELIGIBLE_SHOP" };

/** The per-shop facts the targeting rule needs, resolved by the caller. */
export interface AffiliateShopDeviceFacts {
  enabled: boolean;
  deviceId: string | null;
}

/**
 * Deterministic single-target device selection for an affiliate work item.
 *
 * Rule (in priority order):
 * 1. Business Developer first: when the relationship work summary names a
 *    Business Developer, the target is that developer's device and nothing
 *    else. A deviceless Business Developer means nobody dispatches — never
 *    fall back to a shop device.
 * 2. Otherwise the first enabled shop with an affiliate device wins, scanning
 *    the frozen agenda items' shop anchors in payload order.
 * 3. Only when no agenda item names a shop at all, scan the relationship's
 *    shop-state list in payload order with the same predicate. Anchored
 *    agendas whose shops all fail the predicate do NOT fall through to the
 *    shop-state list — the work has named its shops and none can carry it.
 *
 * Determinism comes from the payload: candidate order is the backend-frozen
 * agenda/shop-state order, and `lookupShop` is keyed by shop id, so the local
 * store's own iteration order can never influence the result. Every Desktop
 * of the seller therefore computes the same target.
 */
export function computeAffiliateWorkItemDeviceTarget(
  workItem: AffiliateWorkItemPayload,
  lookupShop: (shopId: string) => AffiliateShopDeviceFacts | undefined,
): AffiliateWorkItemDeviceTarget {
  const workSummary = workItem.creatorRelationship?.workSummary;
  const businessDeveloperId = trimmedOrNull(workSummary?.businessDeveloperId);
  if (businessDeveloperId) {
    const businessDeveloperDeviceId = trimmedOrNull(workSummary?.businessDeveloperDeviceId);
    return businessDeveloperDeviceId
      ? { kind: "BUSINESS_DEVELOPER", deviceId: businessDeveloperDeviceId }
      : { kind: "BUSINESS_DEVELOPER_WITHOUT_DEVICE" };
  }

  const agendaShopIds = orderedUniqueShopIds(
    (workItem.agentWorkingAgendaItems ?? []).map((item) => item.shopId),
  );
  const candidateShopIds = agendaShopIds.length > 0
    ? agendaShopIds
    : orderedUniqueShopIds(
        (workItem.creatorRelationship?.shopStates ?? []).map((state) => state.shopId),
      );

  for (const shopId of candidateShopIds) {
    const shop = lookupShop(shopId);
    if (shop?.enabled !== true) continue;
    const deviceId = trimmedOrNull(shop.deviceId);
    if (deviceId) return { kind: "SHOP", deviceId, shopId };
  }
  return { kind: "NO_ELIGIBLE_SHOP" };
}

export async function handleAffiliateWorkItemChanged(
  deviceId: string,
  workItem: AffiliateWorkItemPayload,
): Promise<void> {
  log.info(
    `Affiliate work item received: kind=${workItem.workKind} routes=${(workItem.routingPlatformShopIds ?? []).join(",") || workItem.triggerPlatformShopId} ` +
    `collaboration=${workItem.affiliateCollaborationId} status=${workItem.processingStatus}`,
  );

  const target = computeAffiliateWorkItemDeviceTarget(workItem, lookupAffiliateShopDeviceFacts);
  if (target.kind === "BUSINESS_DEVELOPER_WITHOUT_DEVICE") {
    log.info(
      `Affiliate work item is Business Developer-routed but the developer has no device; ` +
      `no desktop dispatches and the work waits visibly: relationship=${workItem.creatorRelationshipId}`,
    );
    return;
  }
  if (target.kind === "NO_ELIGIBLE_SHOP") {
    log.info(
      `Affiliate work item has no enabled shop with an affiliate device; no desktop dispatches: ` +
      `relationship=${workItem.creatorRelationshipId}`,
    );
    return;
  }
  if (target.deviceId !== deviceId) {
    log.info(
      `Ignoring affiliate work item targeted at another device: ` +
      `targetKind=${target.kind} targetDevice=${target.deviceId} currentDevice=${deviceId}`,
    );
    return;
  }

  ingestAffiliateWorkItemEntities(workItem);

  const bridge = getCsBridge();
  if (!bridge) {
    log.warn(
      `Affiliate work item arrived before ecommerce bridge was ready: relationship=${workItem.creatorRelationshipId}`,
    );
    return;
  }

  await bridge.handleAffiliateWorkItemChanged(workItem);
}

function lookupAffiliateShopDeviceFacts(shopId: string): AffiliateShopDeviceFacts | undefined {
  const shop = rootStore.findShopByObjectOrPlatformId(shopId, null);
  if (!shop) return undefined;
  const affiliateService = shop.services?.affiliateService;
  return {
    enabled: affiliateService?.enabled === true,
    deviceId: affiliateService?.deviceId ?? null,
  };
}

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function orderedUniqueShopIds(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values
        .map((value) => trimmedOrNull(value))
        .filter((value): value is string => value !== null),
    ),
  ];
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
