import { useTranslation } from "react-i18next";
import { Select } from "../../../components/inputs/Select.js";
import { TkPrivate } from "../../../components/design-system/index.js";
import { shopDisplayLabel } from "../../../lib/shop-display.js";
import type { AffiliateAnalyticsShop } from "../affiliate-analytics-scope.js";

const CUSTOM_SCOPE = "__CUSTOM__";

export function AffiliateShopScopeControl({ shops, selected, onChange }: {
  shops: AffiliateAnalyticsShop[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  const regions = [...new Set(shops.map((shop) => shop.region).filter(Boolean) as string[])].sort();
  const allSelected = selected.length === shops.length && shops.every((shop) => selected.includes(shop.id));
  const selectedRegion = allSelected ? "" : regions.find((region) => {
    const regionShopIds = shops.filter((shop) => shop.region === region).map((shop) => shop.id);
    return regionShopIds.length === selected.length && regionShopIds.every((shopId) => selected.includes(shopId));
  });
  const regionValue = selectedRegion ?? CUSTOM_SCOPE;
  const toggle = (shopId: string) => onChange(
    selected.includes(shopId) ? selected.filter((id) => id !== shopId) : [...selected, shopId],
  );

  const options = [
    { value: "", label: t("ecommerce.affiliateAnalytics.allRegions") },
    ...(regionValue === CUSTOM_SCOPE
      ? [{ value: CUSTOM_SCOPE, label: t("ecommerce.affiliateAnalytics.customShopScope") }]
      : []),
    ...regions.map((region) => ({ value: region, label: region })),
  ];

  return (
    <div className="affiliate-scope-controls">
      <label>
        <span>{t("ecommerce.affiliateAnalytics.region")}</span>
        <Select
          ariaLabel={t("ecommerce.affiliateAnalytics.region")}
          value={regionValue}
          options={options}
          onChange={(region) => {
            if (region === CUSTOM_SCOPE) return;
            onChange(region
              ? shops.filter((shop) => shop.region === region).map((shop) => shop.id)
              : shops.map((shop) => shop.id));
          }}
        />
      </label>
      <details className="affiliate-shop-picker">
        <summary>{t("ecommerce.affiliateAnalytics.selectedShops", { count: selected.length })}</summary>
        <div>
          <button type="button" onClick={() => onChange(shops.map((shop) => shop.id))}>
            {t("ecommerce.affiliateAnalytics.selectAll")}
          </button>
          {shops.map((shop) => {
            const label = shopDisplayLabel(shop, shop.id);
            return (
              <label key={shop.id}>
                <input type="checkbox" checked={selected.includes(shop.id)} onChange={() => toggle(shop.id)} />
                <TkPrivate sensitive={label.sensitive}>{label.text}</TkPrivate>
                <small>{shop.region}</small>
              </label>
            );
          })}
        </div>
      </details>
    </div>
  );
}
