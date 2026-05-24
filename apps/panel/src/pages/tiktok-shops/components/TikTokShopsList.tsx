import { useTranslation } from "react-i18next";
import type { Shop } from "@rivonclaw/core/models";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { getAuthStatusBadgeClass } from "../tiktok-shops-utils.js";

interface TikTokShopsListProps {
  shops: Shop[];
  oauthLoading: boolean;
  oauthWaiting: boolean;
  onConnectClick: () => void;
  onView: (shopId: string) => void;
  onReauthorize: (shopId: string) => void;
  onDelete: (shopId: string) => void;
}

export function TikTokShopsList({
  shops,
  oauthLoading,
  oauthWaiting,
  onConnectClick,
  onView,
  onReauthorize,
  onDelete,
}: TikTokShopsListProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();

  function renderCsStatusBadge(shop: Shop) {
    if (shop.services?.customerService?.enabled) {
      return <span className="badge badge-active">{t("common.enabled")}</span>;
    }
    return <span className="badge badge-muted">{t("common.disabled")}</span>;
  }

  return (
    <div className="section-card">
      <div className="acct-section-header">
        <div>
          <h3>{t("tiktokShops.connectedShops")}</h3>
        </div>
        <div className="td-actions">
          <button
            className="btn btn-primary btn-sm"
            onClick={onConnectClick}
            disabled={oauthLoading || oauthWaiting}
          >
            {t("tiktokShops.connectShop")}
          </button>
        </div>
      </div>

      {shops.length === 0 ? (
        <div className="empty-cell">{t("tiktokShops.noShops")}</div>
      ) : (
        <table className="shop-table">
          <thead>
            <tr>
              <th>{t("tiktokShops.tableHeaders.name")}</th>
              <th>{t("tiktokShops.tableHeaders.region")}</th>
              <th>{t("tiktokShops.tableHeaders.authStatus")}</th>
              <th>{t("tiktokShops.tableHeaders.csStatus")}</th>
              <th>{t("tiktokShops.tableHeaders.balance")}</th>
              <th className="text-right">{t("tiktokShops.tableHeaders.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {shops.map((shop) => {
              const entitlement = entityStore.billingOverview?.shops.find((item) => item.shopId === shop.id)?.customerService ?? null;
              return (
                <tr key={shop.id}>
                  <td>
                    <span className="shop-table-name">{shop.shopName}</span>
                  </td>
                  <td>{shop.region}</td>
                  <td>
                    <span className={getAuthStatusBadgeClass(shop.authStatus)}>
                      {t(`tiktokShops.authStatus_${shop.authStatus}`)}
                    </span>
                  </td>
                  <td>{renderCsStatusBadge(shop)}</td>
                  <td>
                    <span className="shop-balance-cell">
                      {entitlement?.allowed ? t("common.enabled") : (entitlement?.code ?? "\u2014")}
                      {entitlement && (
                        <span className={entitlement.allowed ? "badge badge-active" : "badge badge-warning"}>
                          {entitlement.allowed ? t("common.enabled") : entitlement.code}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="td-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onView(shop.id)}
                      >
                        {t("tiktokShops.view")}
                      </button>
                      {shop.authStatus === "TOKEN_EXPIRED" && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => onReauthorize(shop.id)}
                          disabled={oauthLoading || oauthWaiting}
                        >
                          {t("tiktokShops.reauthorize")}
                        </button>
                      )}
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => onDelete(shop.id)}
                      >
                        {t("tiktokShops.disconnect")}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
