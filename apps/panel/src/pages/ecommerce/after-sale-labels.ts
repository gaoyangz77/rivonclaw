import type { TFunction } from "i18next";
import { humanizePlatformValue, platformValueLabel } from "./customer-service-order-utils.js";

const PREFIX = "ecommerce.afterSale";

export function afterSaleKindLabel(t: TFunction, kind: string): string {
  return t(`${PREFIX}.kinds.${kind}`, { defaultValue: humanizePlatformValue(kind) });
}

export function afterSaleSellerActionLabel(t: TFunction, action?: string | null): string {
  if (!action) return "-";
  return t(`${PREFIX}.sellerActions.${action}`, { defaultValue: humanizePlatformValue(action) });
}

/**
 * Localized platform status. The workspace's own table covers the statuses the shared
 * customer-service tables lack; anything unknown falls back to a humanized form.
 */
export function afterSaleStatusLabel(t: TFunction, status?: string | null): string {
  if (!status) return "-";
  const group = status.startsWith("CANCELLATION_") ? "cancelStatus" : "returnStatus";
  return t(`${PREFIX}.status.${status}`, {
    defaultValue: platformValueLabel(t, group, status),
  });
}
