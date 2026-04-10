import { useTranslation } from "react-i18next";
import type { SessionStats } from "@rivonclaw/core/models";
import { isBalanceLow, isBalanceExpiringSoon } from "../tiktok-shops-utils.js";

interface TikTokShopSessionsTabProps {
  sessionStatsLoading: boolean;
  sessionStats: SessionStats | null;
}

export function TikTokShopSessionsTab({
  sessionStatsLoading,
  sessionStats,
}: TikTokShopSessionsTabProps) {
  const { t } = useTranslation();

  if (sessionStatsLoading) {
    return <div className="shop-detail-section"><div className="empty-cell">{t("common.loading")}</div></div>;
  }

  if (!sessionStats) {
    return <div className="shop-detail-section"><div className="empty-cell">{t("tiktokShops.modal.sessions.noData")}</div></div>;
  }

  return (
    <div className="shop-detail-section">
      <div className="shop-detail-grid">
        <div className="shop-detail-field">
          <span className="form-label-block">{t("tiktokShops.modal.sessions.active")}</span>
          <span className="shop-stat-value">{sessionStats.activeSessions}</span>
        </div>
        <div className="shop-detail-field">
          <span className="form-label-block">{t("tiktokShops.modal.sessions.total")}</span>
          <span className="shop-stat-value">{sessionStats.totalSessions}</span>
        </div>
        <div className="shop-detail-field">
          <span className="form-label-block">{t("tiktokShops.modal.sessions.balance")}</span>
          <span className="shop-balance-cell">
            {sessionStats.balance}
            {sessionStats.balance === 0 && (
              <span className="badge badge-danger">{t("tiktokShops.balance.none")}</span>
            )}
            {isBalanceLow(sessionStats.balance) && (
              <span className="badge badge-warning">{t("tiktokShops.balance.low")}</span>
            )}
          </span>
        </div>
        {sessionStats.balanceExpiresAt && (
          <div className="shop-detail-field">
            <span className="form-label-block">{t("tiktokShops.detail.balanceExpiry")}</span>
            <span>
              {new Date(sessionStats.balanceExpiresAt).toLocaleDateString()}
              {isBalanceExpiringSoon(sessionStats.balanceExpiresAt) && (
                <span className="badge badge-warning shop-badge-inline">
                  {t("tiktokShops.balance.expiring", {
                    date: new Date(sessionStats.balanceExpiresAt).toLocaleDateString(),
                  })}
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
