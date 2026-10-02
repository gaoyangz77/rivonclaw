import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TkPrivate } from "../../../components/design-system/index.js";
import { useDismissibleDetails } from "../../../hooks/useDismissibleDetails.js";
import { shopDisplayLabel, shopSelectSearchTerms } from "../../../lib/shop-display.js";
import { SPS_LIVE_SHOP_LIMIT, type SpsScopeShop } from "../sps-analytics.js";

export function SpsShopScopeControl({
  shops,
  selectedIds,
  onChange,
}: {
  shops: SpsScopeShop[];
  selectedIds: string[];
  onChange: (shopIds: string[]) => void;
}) {
  const { t } = useTranslation();
  const pickerRef = useDismissibleDetails();
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleShops = normalizedSearch
    ? shops.filter((shop) =>
        shopSelectSearchTerms(shop, shop.id).some((term) =>
          term.toLocaleLowerCase().includes(normalizedSearch),
        ),
      )
    : shops;
  const selected = new Set(selectedIds);
  const selectionRequired = shops.length > 0 && selectedIds.length === 0;

  const toggleShop = (shopId: string) => {
    if (selected.has(shopId)) {
      onChange(selectedIds.filter((id) => id !== shopId));
      return;
    }
    if (selectedIds.length >= SPS_LIVE_SHOP_LIMIT) return;
    onChange([...selectedIds, shopId]);
  };

  return (
    <section
      className={`sps-scope-control${selectionRequired ? " sps-scope-control-required" : ""}`}
      aria-labelledby="sps-scope-title"
      data-tutorial-id="analytics-shop-scope"
    >
      <div className="sps-scope-copy">
        <span>{t("shopAnalytics.scope.market")}</span>
        <strong id="sps-scope-title">{t("shopAnalytics.scope.title")}</strong>
        <small>
          {selectionRequired
            ? t("shopAnalytics.scope.selectionRequired", {
                total: shops.length,
                max: SPS_LIVE_SHOP_LIMIT,
              })
            : t("shopAnalytics.scope.selected", {
                selected: selectedIds.length,
                total: shops.length,
              })}
        </small>
      </div>

      <div className="sps-scope-actions">
        <span className="sps-scope-market">US</span>
        <details ref={pickerRef} className="sps-shop-picker">
          <summary>
            {t("shopAnalytics.scope.selected", {
              selected: selectedIds.length,
              total: shops.length,
            })}
          </summary>
          <div className="sps-shop-picker-popover">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("common.searchShops")}
              aria-label={t("common.searchShops")}
            />
            <div className="sps-shop-picker-toolbar">
              <button
                type="button"
                onClick={() =>
                  onChange(visibleShops.slice(0, SPS_LIVE_SHOP_LIMIT).map((shop) => shop.id))
                }
                disabled={visibleShops.length === 0}
              >
                {t("shopAnalytics.scope.selectVisible", { max: SPS_LIVE_SHOP_LIMIT })}
              </button>
              <button type="button" onClick={() => onChange([])} disabled={!selectedIds.length}>
                {t("shopAnalytics.scope.clear")}
              </button>
            </div>
            <div className="sps-shop-picker-list">
              {visibleShops.length ? (
                visibleShops.map((shop) => {
                  const label = shopDisplayLabel(shop, shop.id);
                  const checked = selected.has(shop.id);
                  return (
                    <label key={shop.id}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && selectedIds.length >= SPS_LIVE_SHOP_LIMIT}
                        onChange={() => toggleShop(shop.id)}
                      />
                      <TkPrivate sensitive={label.sensitive}>{label.text}</TkPrivate>
                    </label>
                  );
                })
              ) : (
                <p>{t("shopAnalytics.scope.noMatches")}</p>
              )}
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
