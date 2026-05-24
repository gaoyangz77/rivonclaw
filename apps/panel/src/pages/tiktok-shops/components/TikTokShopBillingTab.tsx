import { useTranslation } from "react-i18next";
import type { Shop } from "@rivonclaw/core/models";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";

interface TikTokShopBillingTabProps {
  shop: Shop;
}

export function TikTokShopBillingTab({ shop }: TikTokShopBillingTabProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const entitlement = entityStore.billingOverview?.shops.find((item) => item.shopId === shop.id)?.customerService ?? null;

  return (
    <div className="shop-detail-section">
      <div className="shop-detail-field">
        <span className="form-label-block">{t("tiktokShops.modal.billing.currentTier")}</span>
        <span>
          {entitlement?.source ?? entitlement?.code ?? t("tiktokShops.modal.billing.noTier")}
        </span>
      </div>

      <div className="shop-detail-field">
        <span className="form-label-block">{t("tiktokShops.tableHeaders.balance")}</span>
        <span className="shop-balance-cell">
          {entitlement?.allowed ? t("common.enabled") : (entitlement?.code ?? "\u2014")}
          {entitlement && (
            <span className={entitlement.allowed ? "badge badge-active" : "badge badge-warning"}>
              {entitlement.allowed ? t("common.enabled") : entitlement.code}
            </span>
          )}
        </span>
      </div>

      {entitlement?.validUntil && (
        <div className="shop-detail-field">
          <span className="form-label-block">{t("tiktokShops.detail.balanceExpiry")}</span>
          <span>{new Date(entitlement.validUntil).toLocaleDateString()}</span>
        </div>
      )}

      {entitlement?.usage.length ? (
        <div>
          <span className="form-label-block">{t("tiktokShops.modal.billing.credits")}</span>
          <div className="acct-item-list">
            {entitlement.usage.map((usage) => (
              <div key={`${usage.metric}:${usage.window}`} className="acct-item">
                <div className="acct-item-title-row">
                  <span className="acct-item-name">{usage.metric}</span>
                  <span className="badge badge-muted">{usage.window}</span>
                </div>
                <div className="acct-item-meta">
                  <span>{usage.remaining}/{usage.limit}</span>
                  <span>{new Date(usage.refreshAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
