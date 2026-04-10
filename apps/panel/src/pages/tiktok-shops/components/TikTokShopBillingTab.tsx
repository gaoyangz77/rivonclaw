import { useTranslation } from "react-i18next";
import type { Shop, ServiceCredit } from "@rivonclaw/core/models";
import { formatBalanceDisplay, isBalanceExpiringSoon, getBalanceBadgeInfo } from "../tiktok-shops-utils.js";

interface TikTokShopBillingTabProps {
  shop: Shop;
  csCredits: ServiceCredit[];
  creditsLoading: boolean;
  redeemingCreditId: string | null;
  onRedeemCredit: (credit: ServiceCredit) => void;
}

export function TikTokShopBillingTab({
  shop,
  csCredits,
  creditsLoading,
  redeemingCreditId,
  onRedeemCredit,
}: TikTokShopBillingTabProps) {
  const { t } = useTranslation();

  function renderBalanceBadge() {
    const info = getBalanceBadgeInfo(shop);
    if (!info) return null;
    return <span className={info.className}>{t(info.labelKey, info.labelOpts)}</span>;
  }

  return (
    <div className="shop-detail-section">
      {/* Current Plan */}
      <div className="shop-detail-field">
        <span className="form-label-block">{t("tiktokShops.modal.billing.currentTier")}</span>
        <span>
          {shop.services?.customerServiceBilling?.tier
            ? t(`tiktokShops.tier.${shop.services?.customerServiceBilling?.tier}`, { defaultValue: shop.services?.customerServiceBilling?.tier })
            : t("tiktokShops.modal.billing.noTier")}
        </span>
      </div>

      {/* Balance */}
      <div className="shop-detail-field">
        <span className="form-label-block">{t("tiktokShops.tableHeaders.balance")}</span>
        <span className="shop-balance-cell">
          {shop.services?.customerServiceBilling
            ? formatBalanceDisplay(
                shop.services?.customerServiceBilling?.balance,
                shop.services?.customerServiceBilling?.tier,
                t,
              )
            : "\u2014"}
          {renderBalanceBadge()}
        </span>
      </div>

      {/* Balance Expiry */}
      {shop.services?.customerServiceBilling?.balanceExpiresAt && (
        <div className="shop-detail-field">
          <span className="form-label-block">{t("tiktokShops.detail.balanceExpiry")}</span>
          <span>
            {new Date(shop.services!.customerServiceBilling!.balanceExpiresAt!).toLocaleDateString()}
            {isBalanceExpiringSoon(shop.services?.customerServiceBilling?.balanceExpiresAt) && (
              <span className="badge badge-warning shop-badge-inline">
                {t("tiktokShops.balance.expiring", {
                  date: new Date(shop.services!.customerServiceBilling!.balanceExpiresAt!).toLocaleDateString(),
                })}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Available Credits */}
      <div>
        <span className="form-label-block">{t("tiktokShops.modal.billing.credits")}</span>
        {creditsLoading ? (
          <div className="empty-cell">{t("common.loading")}</div>
        ) : csCredits.length === 0 ? (
          <div className="form-hint">{t("tiktokShops.credits.noCredits")}</div>
        ) : (
          <div className="acct-item-list">
            {csCredits.map((credit) => (
              <div key={credit.id} className="acct-item">
                <div className="acct-item-title-row">
                  <span className="acct-item-name">
                    {t("tiktokShops.credits.quota", { quota: credit.quota })}
                  </span>
                  <span className="badge badge-muted">{credit.source}</span>
                  <div className="acct-item-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onRedeemCredit(credit)}
                      disabled={redeemingCreditId === credit.id}
                    >
                      {redeemingCreditId === credit.id
                        ? t("common.loading")
                        : t("tiktokShops.credits.redeem")}
                    </button>
                  </div>
                </div>
                <div className="acct-item-meta">
                  <span>
                    {t("tiktokShops.credits.expires", {
                      date: new Date(credit.expiresAt).toLocaleDateString(),
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
