import { useTranslation } from "react-i18next";
import type { Shop } from "@rivonclaw/core/models";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { formatShopRegionLabel } from "../../../lib/ecommerce-labels.js";
import { getAuthStatusBadgeClass } from "../tiktok-shops-utils.js";
import { entitlementStatusLabel } from "../../../components/billing/billing-labels.js";
import {
  TkPanel,
  TkPanelBody,
  TkPanelHeader,
  TkInteractiveTableRow,
  TkTableFrame,
} from "../../../components/design-system/index.js";

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

  function renderCsAccessBadge(shop: Shop) {
    if (!shop.services?.customerService?.enabled) {
      return <span className="badge badge-muted">{t("common.disabled")}</span>;
    }
    const entitlement =
      entityStore.billingOverview?.shops.find((item) => item.shopId === shop.id)?.customerService ??
      null;
    if (!entitlement) return <span className="badge badge-muted">{t("common.loading")}</span>;
    return (
      <span className={entitlement.allowed ? "badge badge-active" : "badge badge-warning"}>
        {entitlementStatusLabel(t, entitlement)}
      </span>
    );
  }

  return (
    <TkPanel as="section" padding="none" clip className="section-card">
      <TkPanelHeader
        title={t("tiktokShops.connectedShops")}
        actions={
          <button
            className="btn btn-primary btn-sm"
            onClick={onConnectClick}
            disabled={oauthLoading || oauthWaiting}
          >
            {t("tiktokShops.connectShop")}
          </button>
        }
      />

      {shops.length === 0 ? (
        <TkPanelBody>
          <div className="empty-cell">{t("tiktokShops.noShops")}</div>
        </TkPanelBody>
      ) : (
        <TkTableFrame variant="embedded">
          <table className="shop-table">
            <thead>
              <tr>
                <th>{t("tiktokShops.tableHeaders.name")}</th>
                <th>{t("tiktokShops.tableHeaders.region")}</th>
                <th>{t("tiktokShops.tableHeaders.authStatus")}</th>
                <th>{t("tiktokShops.tableHeaders.balance")}</th>
                <th className="text-right">{t("tiktokShops.tableHeaders.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => {
                return (
                  <TkInteractiveTableRow
                    key={shop.id}
                    aria-label={`${t("tiktokShops.view")} ${shop.shopName}`}
                    onActivate={() => onView(shop.id)}
                  >
                    <td>
                      <span className="tk-v1-table-record-name">{shop.shopName}</span>
                    </td>
                    <td>{formatShopRegionLabel(shop.region, t)}</td>
                    <td>
                      <span className={getAuthStatusBadgeClass(shop.authStatus)}>
                        {t(`tiktokShops.authStatus_${shop.authStatus}`)}
                      </span>
                    </td>
                    <td>{renderCsAccessBadge(shop)}</td>
                    <td className="text-right">
                      <div className="td-actions">
                        {shop.authStatus === "TOKEN_EXPIRED" && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => onReauthorize(shop.id)}
                            disabled={oauthLoading || oauthWaiting}
                          >
                            {t("tiktokShops.reauthorize")}
                          </button>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={() => onDelete(shop.id)}>
                          {t("tiktokShops.disconnect")}
                        </button>
                      </div>
                    </td>
                  </TkInteractiveTableRow>
                );
              })}
            </tbody>
          </table>
        </TkTableFrame>
      )}
    </TkPanel>
  );
}
