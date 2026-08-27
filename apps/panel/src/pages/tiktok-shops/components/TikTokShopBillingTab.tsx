import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import type { Shop } from "@rivonclaw/core/models";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { CustomerServiceBillingCta } from "../../../components/billing/CustomerServiceBillingCta.js";
import {
  billingEnumLabel,
  usagePercentLabel,
} from "../../../components/billing/billing-labels.js";
import { formatLocalizedDateTime } from "../../../lib/format-datetime.js";

interface TikTokShopBillingTabProps {
  shop: Shop;
}

export function TikTokShopBillingTab({ shop }: TikTokShopBillingTabProps) {
  const { t, i18n } = useTranslation();
  const entityStore = useEntityStore();
  const entitlement = entityStore.billingOverview?.shops.find((item) => item.shopId === shop.id)?.customerService ?? null;

  useEffect(() => {
    entityStore.refreshPlanDefinitions().catch(() => {});
    entityStore.refreshBilling().catch(() => {});
  }, [entityStore]);

  return (
    <div className="shop-detail-section">
      <CustomerServiceBillingCta shopId={shop.id} shopName={shop.alias || shop.shopName} entitlement={entitlement} />

      {entitlement?.usage.length ? (
        <div>
          <span className="form-label-block">{t("tiktokShops.modal.billing.credits")}</span>
          <div className="acct-item-list">
            {entitlement.usage.map((usage) => (
              <div key={`${usage.metric}:${usage.window}`} className="acct-item">
                <div className="acct-item-title-row">
                  <span className="acct-item-name">{billingEnumLabel(t, "usageMetric", usage.metric)}</span>
                  <span className="badge badge-muted">{billingEnumLabel(t, "usageWindow", usage.window)}</span>
                </div>
                <div className="acct-item-meta">
                  <span>{t("billing.usageUsedPercent", { percent: usagePercentLabel(usage.usedPercent) })}</span>
                  <span>{formatLocalizedDateTime(usage.refreshAt, i18n.language)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
