import { Fragment, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Shop } from "@rivonclaw/core/models";
import { ChevronRightIcon, RefreshIcon } from "../../../components/icons.js";
import { formatShopRegionLabel } from "../../../lib/ecommerce-labels.js";
import { getAuthStatusBadgeClass } from "../ecommerce-utils.js";
import { BalanceBadge } from "./BalanceBadge.js";
import {
  groupShopsByCollection,
  shopCollectionName,
  shopCollectionRegions,
  sortShopCollectionGroupsByName,
} from "../../../lib/shop-collections.js";

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

function getAggregateStatusBadgeClass(activeCount: number, totalCount: number): string {
  if (activeCount === totalCount) return "badge badge-active shop-collection-summary-badge";
  if (activeCount === 0) return "badge badge-muted shop-collection-summary-badge";
  return "badge badge-warning shop-collection-summary-badge";
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
  const [collapsedCollectionKeys, setCollapsedCollectionKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const shopGroups = sortShopCollectionGroupsByName(groupShopsByCollection(shops));
  const shopAliasSignature = shops.map((shop) => `${shop.id}:${shop.alias ?? ""}`).join("\u0001");

  useEffect(() => {
    setDraftAliases((prev) => {
      const next: Record<string, string> = {};
      for (const shop of shops) {
        next[shop.id] = prev[shop.id] ?? shop.alias ?? "";
      }
      return next;
    });
  }, [shopAliasSignature]);

  async function commitAlias(shopId: string, currentAlias: string) {
    const nextAlias = (draftAliases[shopId] ?? currentAlias).trim();
    if (nextAlias === currentAlias) {
      setDraftAliases((prev) => ({ ...prev, [shopId]: currentAlias }));
      return;
    }

    setSavingAliasShopId(shopId);
    try {
      await onUpdateAlias(shopId, nextAlias);
      setDraftAliases((prev) => ({ ...prev, [shopId]: nextAlias }));
    } finally {
      setSavingAliasShopId((current) => (current === shopId ? null : current));
    }
  }

  function toggleCollection(key: string) {
    setCollapsedCollectionKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
                <th aria-sort="ascending">
                  <span className="shop-table-sort-heading">
                    {t("ecommerce.table.headers.name")}
                    <span className="shop-table-sort-indicator" aria-hidden="true">
                      ↑
                    </span>
                  </span>
                </th>
                <th className="shop-table-col-alias">{t("ecommerce.table.headers.alias")}</th>
                <th>{t("ecommerce.table.headers.platform")}</th>
                <th>{t("ecommerce.table.headers.region")}</th>
                <th>{t("ecommerce.table.headers.authStatus")}</th>
                <th>{t("ecommerce.table.headers.csBalance")}</th>
                <th className="text-right">{t("ecommerce.table.headers.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {shopGroups.map((group, groupIndex) => {
                const isCollection = group.shops.length > 1;
                const previousGroupIsCollection =
                  groupIndex > 0 && shopGroups[groupIndex - 1]!.shops.length > 1;
                const headerShop = group.shops[0];
                const collectionName = shopCollectionName(group.shops);
                const isExpanded = !collapsedCollectionKeys.has(group.key);
                const authorizedShopCount = group.shops.filter(
                  (shop) => shop.authStatus === "AUTHORIZED",
                ).length;
                const enabledCustomerServiceCount = group.shops.filter(
                  (shop) => shop.services?.customerService?.enabled,
                ).length;
                return (
                  <Fragment key={group.key}>
                    {groupIndex > 0 && (isCollection || previousGroupIsCollection) && (
                      <tr className="shop-group-spacer" aria-hidden="true">
                        <td colSpan={7} />
                      </tr>
                    )}
                    {isCollection && (
                      <tr className="shop-collection-row">
                        <td>
                          <div className="shop-collection-identity">
                            <button
                              type="button"
                              className={`shop-collection-toggle${
                                isExpanded ? " shop-collection-toggle-open" : ""
                              }`}
                              onClick={() => toggleCollection(group.key)}
                              aria-expanded={isExpanded}
                              aria-label={`${t(
                                isExpanded ? "chat.collapseMessage" : "chat.expandMessage",
                              )} ${collectionName}`}
                              title={`${t(
                                isExpanded ? "chat.collapseMessage" : "chat.expandMessage",
                              )} ${collectionName}`}
                            >
                              <ChevronRightIcon />
                            </button>
                            <span className="shop-table-name">{collectionName}</span>
                            <span className="shop-collection-count">
                              {group.shops.length} {t("ecommerce.shops")}
                            </span>
                          </div>
                        </td>
                        <td className="shop-table-col-alias">-</td>
                        <td>
                          {headerShop.platform === "TIKTOK_SHOP" ? "TikTok" : headerShop.platform}
                        </td>
                        <td>
                          {shopCollectionRegions(group.shops)
                            .map((region) => formatShopRegionLabel(region, t))
                            .join(", ")}
                        </td>
                        <td>
                          <span
                            className={getAggregateStatusBadgeClass(
                              authorizedShopCount,
                              group.shops.length,
                            )}
                          >
                            {authorizedShopCount}/{group.shops.length}{" "}
                            {t("tiktokShops.authStatus_AUTHORIZED")}
                          </span>
                        </td>
                        <td>
                          <span
                            className={getAggregateStatusBadgeClass(
                              enabledCustomerServiceCount,
                              group.shops.length,
                            )}
                          >
                            {enabledCustomerServiceCount}/{group.shops.length}{" "}
                            {t("billing.allowed")}
                          </span>
                        </td>
                        <td />
                      </tr>
                    )}
                    {(!isCollection || isExpanded) &&
                      group.shops.map((shop) => {
                        const shopId = shop.id;
                        const currentAlias = shop.alias ?? "";
                        return (
                          <tr
                            key={shopId}
                            className={isCollection ? "shop-collection-child-row" : undefined}
                          >
                            <td>
                              <span className="shop-table-name">{shop.shopName}</span>
                            </td>
                            <td className="shop-table-col-alias">
                              <input
                                className="shop-alias-input"
                                value={draftAliases[shopId] ?? currentAlias}
                                placeholder={t("ecommerce.table.aliasPlaceholder")}
                                disabled={savingAliasShopId === shopId}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setDraftAliases((prev) => ({ ...prev, [shopId]: value }));
                                }}
                                onBlur={() => {
                                  commitAlias(shopId, currentAlias).catch(() => {});
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                  } else if (e.key === "Escape") {
                                    setDraftAliases((prev) => ({
                                      ...prev,
                                      [shopId]: currentAlias,
                                    }));
                                    e.currentTarget.blur();
                                  }
                                }}
                              />
                            </td>
                            <td>{shop.platform === "TIKTOK_SHOP" ? "TikTok" : shop.platform}</td>
                            <td>{formatShopRegionLabel(shop.region, t)}</td>
                            <td>
                              <span className={getAuthStatusBadgeClass(shop.authStatus)}>
                                {t(`tiktokShops.authStatus_${shop.authStatus}`)}
                              </span>
                            </td>
                            <td>
                              <BalanceBadge shop={shop} />
                            </td>
                            <td className="text-right">
                              <div className="td-actions shop-table-actions">
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => onOpenDrawer(shopId)}
                                >
                                  {t("ecommerce.view")}
                                </button>
                                {shop.authStatus === "TOKEN_EXPIRED" && (
                                  <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => onReauthorize(shopId)}
                                    disabled={oauthLoading || oauthWaiting}
                                  >
                                    {t("ecommerce.reauthorize")}
                                  </button>
                                )}
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => onRequestDelete(shopId)}
                                >
                                  {t("ecommerce.disconnect")}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
