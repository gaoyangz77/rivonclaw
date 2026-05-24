import { useTranslation } from "react-i18next";
import type { Shop } from "@rivonclaw/core/models";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";

interface TikTokShopSessionsTabProps {
  shop: Shop;
}

export function TikTokShopSessionsTab({ shop }: TikTokShopSessionsTabProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const entitlement = entityStore.billingOverview?.shops.find((item) => item.shopId === shop.id)?.customerService ?? null;

  if (!entitlement) {
    return (
      <div className="shop-detail-section">
        <div className="empty-cell">{t("tiktokShops.modal.sessions.noData")}</div>
      </div>
    );
  }

  return (
    <div className="shop-detail-section">
      <div className="shop-detail-grid">
        <div className="shop-detail-field">
          <span className="form-label-block">{t("tiktokShops.modal.sessions.balance")}</span>
          <span className="shop-balance-cell">
            {entitlement.allowed ? t("common.enabled") : entitlement.code}
            <span className={entitlement.allowed ? "badge badge-active" : "badge badge-warning"}>
              {entitlement.allowed ? t("common.enabled") : entitlement.code}
            </span>
          </span>
        </div>
        {entitlement.validUntil && (
          <div className="shop-detail-field">
            <span className="form-label-block">{t("tiktokShops.detail.balanceExpiry")}</span>
            <span>{new Date(entitlement.validUntil).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
