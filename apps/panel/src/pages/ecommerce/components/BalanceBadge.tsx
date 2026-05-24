import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import type { Shop } from "@rivonclaw/core/models";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";

export function BalanceBadge({ shop }: { shop: Shop }): JSX.Element | null {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const entitlement = entityStore.billingOverview?.shops.find((item) => item.shopId === shop.id)?.customerService ?? null;
  if (!entitlement) return null;

  return entitlement.allowed
    ? <span className="badge badge-active">{t("common.enabled")}</span>
    : <span className="badge badge-warning">{entitlement.code}</span>;
}
