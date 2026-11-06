import type { TFunction } from "i18next";
import { humanizePlatformValue, platformValueLabel } from "./customer-service-order-utils.js";

const PREFIX = "ecommerce.afterSale";

/** TikTok refusals observed on seller decisions that the workspace can explain to the seller. */
const DECISION_ERROR_KEYS: Readonly<Record<string, string>> = {
  "25011035": "parcelNotRejectable",
  "25011010": "withPlatform",
  "25001003": "stateChanged",
};

export function afterSaleKindLabel(t: TFunction, kind: string): string {
  return t(`${PREFIX}.kinds.${kind}`, { defaultValue: humanizePlatformValue(kind) });
}

export function afterSaleSellerDecisionLabel(t: TFunction, decision?: string | null): string {
  if (!decision) return "-";
  return t(`${PREFIX}.sellerDecisions.${decision}`, {
    defaultValue: humanizePlatformValue(decision),
  });
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

/**
 * What the seller reads when a decision fails. A known TikTok code gets the localized explanation
 * with the code kept for support; any other failure keeps its own text.
 */
export function afterSaleDecisionErrorText(t: TFunction, message: string): string {
  const code = /TikTok API error (\d+):/.exec(message)?.[1];
  const key = code ? DECISION_ERROR_KEYS[code] : undefined;
  return key ? t(`${PREFIX}.decision.platformErrors.${key}`, { code }) : message;
}
