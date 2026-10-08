import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  TkButton,
  TkChoiceSelect,
  TkField,
  TkPanel,
  TkPanelBody,
  TkPopover,
  TkPrivate,
} from "../../../components/design-system/index.js";
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
  onChange: (next: string[]) => void;
  showRegion?: boolean;
  label?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [shopSearch, setShopSearch] = useState("");
  const normalizedShopSearch = shopSearch.trim().toLocaleLowerCase();
  const visibleShops = normalizedShopSearch
    ? shops.filter((shop) =>
        shopSelectSearchTerms(shop, shop.id).some((term) =>
          term.toLocaleLowerCase().includes(normalizedShopSearch),
        ),
      )
    : shops;
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
  const toggle = (shopId: string) =>
    onChange(
      selected.includes(shopId) ? selected.filter((id) => id !== shopId) : [...selected, shopId],
    );
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
            );
          }}
        />
      )}
      <div className="affiliate-shop-scope-field">
        {label && <span className="tk-v1-label">{label}</span>}
        <TkPopover
          label={pickerLabel}
          open={open}
          onOpenChange={setOpen}
          className="affiliate-shop-scope-popover"
          trigger={(triggerProps) => (
            <TkButton {...triggerProps} variant="secondary" aria-label={pickerLabel}>
              {t("ecommerce.affiliateAnalytics.selectedShops", { count: selected.length })}
            </TkButton>
          )}
        >
          <TkField
            type="search"
            value={shopSearch}
            onChange={(event) => setShopSearch(event.target.value)}
            placeholder={t("common.searchShops")}
            label={t("common.searchShops")}
            hideLabel
          />
          <TkButton
            variant="ghost"
            size="sm"
            onClick={() => onChange(shops.map((shop) => shop.id))}
          >
            {t("ecommerce.affiliateAnalytics.selectAll")}
          </TkButton>
          <TkPanel variant="subtle" padding="none">
            <TkPanelBody scroll className="affiliate-shop-scope-list">
              {visibleShops.map((shop) => {
                const display = shopDisplayLabel(shop, shop.id);
                return (
                  <label className="affiliate-shop-scope-option" key={shop.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(shop.id)}
                      onChange={() => toggle(shop.id)}
                    />
                    <TkPrivate sensitive={display.sensitive}>{display.text}</TkPrivate>
                    <small>{shop.region}</small>
                  </label>
                );
              })}
            </TkPanelBody>
          </TkPanel>
        </TkPopover>
      </div>
    </div>
  );
}
