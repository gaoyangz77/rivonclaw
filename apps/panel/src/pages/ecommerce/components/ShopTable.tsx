import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Shop } from "@rivonclaw/core/models";
import { RefreshIcon } from "../../../components/icons.js";
import { formatBalanceDisplay, getAuthStatusBadgeClass } from "../ecommerce-utils.js";
import { BalanceBadge } from "./BalanceBadge.js";

interface ShopTableProps {
  shops: Shop[];
  oauthLoading: boolean;
  oauthWaiting: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onAddShop: () => void;
  onUpdateAlias: (shopId: string, alias: string) => Promise<void>;
  onOpenDrawer: (shopId: string) => void;
  onReauthorize: (shopId: string) => void;
  onRequestDelete: (shopId: string) => void;
}

export function ShopTable({
  shops,
  oauthLoading,
  oauthWaiting,
  refreshing,
  onRefresh,
  onAddShop,
  onUpdateAlias,
  onOpenDrawer,
  onReauthorize,
  onRequestDelete,
}: ShopTableProps) {
  const { t } = useTranslation();
  const [draftAliases, setDraftAliases] = useState<Record<string, string>>({});
  const [savingAliasShopId, setSavingAliasShopId] = useState<string | null>(null);

  useEffect(() => {
    setDraftAliases((prev) => {
      const next: Record<string, string> = {};
      for (const shop of shops) {
        next[shop.id] = prev[shop.id] ?? (shop.alias ?? "");
      }
      return next;
    });
  }, [shops]);

  async function commitAlias(shop: Shop) {
    const currentAlias = shop.alias ?? "";
    const nextAlias = (draftAliases[shop.id] ?? currentAlias).trim();
    if (nextAlias === currentAlias) {
      setDraftAliases((prev) => ({ ...prev, [shop.id]: currentAlias }));
      return;
    }

    setSavingAliasShopId(shop.id);
    try {
      await onUpdateAlias(shop.id, nextAlias);
      setDraftAliases((prev) => ({ ...prev, [shop.id]: nextAlias }));
    } finally {
      setSavingAliasShopId((current) => (current === shop.id ? null : current));
    }
  }

  return (
    <div className="section-card">
      <div className="ecommerce-section-header">
        <div>
          <h3>{t("ecommerce.shops")}</h3>
          <p className="ecommerce-section-subtitle">{t("ecommerce.shopsSubtitle")}</p>
        </div>
        <div className="ecommerce-section-actions">
          <button
            className="btn-icon-inline"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={t("ecommerce.refreshShops")}
            title={t("ecommerce.refreshShops")}
          >
            <RefreshIcon className={refreshing ? "spin" : ""} />
          </button>
          <button className="btn btn-primary btn-sm" onClick={onAddShop} disabled={oauthLoading}>
            {t("ecommerce.addShop")}
          </button>
        </div>
      </div>

      {shops.length === 0 ? (
        <div className="empty-cell">{t("ecommerce.noShops")}</div>
      ) : (
        <div className="table-scroll-wrap shop-table-wrap">
          <table className="shop-table">
            <thead>
              <tr>
                <th>{t("ecommerce.table.headers.name")}</th>
                <th className="shop-table-col-alias">{t("ecommerce.table.headers.alias")}</th>
                <th>{t("ecommerce.table.headers.platform")}</th>
                <th>{t("ecommerce.table.headers.region")}</th>
                <th>{t("ecommerce.table.headers.authStatus")}</th>
                <th>{t("ecommerce.table.headers.csBalance")}</th>
                <th className="text-right">{t("ecommerce.table.headers.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => {
                const billing = shop.services?.customerServiceBilling;
                return (
                  <tr key={shop.id}>
                    <td>
                      <span className="shop-table-name">{shop.shopName}</span>
                    </td>
                    <td className="shop-table-col-alias">
                      <input
                        className="shop-alias-input"
                        value={draftAliases[shop.id] ?? (shop.alias ?? "")}
                        placeholder={t("ecommerce.table.aliasPlaceholder")}
                        disabled={savingAliasShopId === shop.id}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDraftAliases((prev) => ({ ...prev, [shop.id]: value }));
                        }}
                        onBlur={() => {
                          commitAlias(shop).catch(() => {});
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.currentTarget.blur();
                          } else if (e.key === "Escape") {
                            setDraftAliases((prev) => ({ ...prev, [shop.id]: shop.alias ?? "" }));
                            e.currentTarget.blur();
                          }
                        }}
                      />
                    </td>
                    <td>{shop.platform === "TIKTOK_SHOP" ? "TikTok" : shop.platform}</td>
                    <td>{shop.region}</td>
                    <td>
                      <span className={getAuthStatusBadgeClass(shop.authStatus)}>
                        {t(`tiktokShops.authStatus_${shop.authStatus}`)}
                      </span>
                    </td>
                    <td>
                      <span className="shop-balance-cell">
                        {billing
                          ? formatBalanceDisplay(billing.balance, billing.tier, t)
                          : "\u2014"}
                        <BalanceBadge shop={shop} />
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="td-actions shop-table-actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onOpenDrawer(shop.id)}
                        >
                          {t("ecommerce.view")}
                        </button>
                        {shop.authStatus === "TOKEN_EXPIRED" && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => onReauthorize(shop.id)}
                            disabled={oauthLoading || oauthWaiting}
                          >
                            {t("ecommerce.reauthorize")}
                          </button>
                        )}
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => onRequestDelete(shop.id)}
                        >
                          {t("ecommerce.disconnect")}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
