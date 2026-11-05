import { useTranslation } from "react-i18next";

import { TkChoiceSelect } from "../../../components/design-system/index.js";
import { CheckboxMultiSelect } from "../../../components/inputs/CheckboxMultiSelect.js";
import { shopDisplayLabel, shopSelectSearchTerms } from "../../../lib/shop-display.js";
import "./AffiliateShopScopeControl.css";
import type { AffiliateAnalyticsShop } from "../affiliate-analytics-scope.js";

const CUSTOM_SCOPE = "__CUSTOM__";

export function AffiliateShopScopeControl({
  shops,
  selected,
  onChange,
  showRegion = true,
  label,
}: {
  shops: AffiliateAnalyticsShop[];
  selected: string[];
  onChange: (next: string[], region?: string) => void;
  showRegion?: boolean;
  label?: string;
}) {
  const { t } = useTranslation();
  const regions = [...new Set(shops.map((shop) => shop.region).filter(Boolean) as string[])].sort();
  const allSelected =
    selected.length === shops.length && shops.every((shop) => selected.includes(shop.id));
  const selectedRegion = allSelected
    ? ""
    : regions.find((region) => {
        const regionShopIds = shops.filter((shop) => shop.region === region).map((shop) => shop.id);
        return (
          regionShopIds.length === selected.length &&
          regionShopIds.every((shopId) => selected.includes(shopId))
        );
      });
  const regionValue = selectedRegion ?? CUSTOM_SCOPE;
  const options = [
    { value: "", label: t("ecommerce.affiliateAnalytics.allRegions") },
    ...(regionValue === CUSTOM_SCOPE
      ? [{ value: CUSTOM_SCOPE, label: t("ecommerce.affiliateAnalytics.customShopScope") }]
      : []),
    ...regions.map((region) => ({ value: region, label: region })),
  ];
  const pickerLabel =
    label ?? t("ecommerce.affiliateAnalytics.selectedShops", { count: selected.length });
  return (
    <div className="affiliate-scope-controls">
      {showRegion && (
        <TkChoiceSelect
          label={t("ecommerce.affiliateAnalytics.region")}
          value={regionValue}
          options={options}
          onChange={(region) => {
            if (region === CUSTOM_SCOPE) return;
            onChange(
              region
                ? shops.filter((shop) => shop.region === region).map((shop) => shop.id)
                : shops.map((shop) => shop.id),
              region,
            );
          }}
        />
      )}
      <CheckboxMultiSelect
        label={label}
        buttonText={t("ecommerce.affiliateAnalytics.selectedShops", { count: selected.length })}
        popoverLabel={pickerLabel}
        options={shops.map((shop) => {
          const display = shopDisplayLabel(shop, shop.id);
          return {
            id: shop.id,
            label: display.text,
            sensitive: display.sensitive,
            meta: shop.region ?? undefined,
            searchTerms: shopSelectSearchTerms(shop, shop.id),
          };
        })}
        selected={selected}
        onChange={(next) => onChange(next)}
        selectAllLabel={t("ecommerce.affiliateAnalytics.selectAll")}
        deselectAllLabel={t("ecommerce.affiliateAnalytics.deselectAll")}
        searchLabel={t("common.searchShops")}
      />
    </div>
  );
}
