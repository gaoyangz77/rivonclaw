import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import type { Shop } from "@rivonclaw/core/models";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { entitlementStatusLabel } from "../../../components/billing/billing-labels.js";

export function BalanceBadge({ shop }: { shop: Shop }): JSX.Element | null {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  if (!shop.services?.customerService?.enabled) {
    return <span className="badge badge-muted">{t("common.disabled")}</span>;
  }
  const entitlement = entityStore.billingOverview?.shops.find((item) => item.shopId === shop.id)?.customerService ?? null;
  if (!entitlement) return null;

  return entitlement.allowed
    ? <span className="badge badge-active">{t("billing.allowed")}</span>
    : <span className="badge badge-warning">{entitlementStatusLabel(t, entitlement)}</span>;
}
