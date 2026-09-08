import { useState } from "react";
import { useQuery } from "@apollo/client/react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { ECOMMERCE_PRODUCT_FILTER_OPTIONS_QUERY } from "../../api/shops-queries.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { shopDisplayLabel } from "../../lib/shop-display.js";
import { TkButton, TkField, TkPopover, TkPrivate } from "../design-system/index.js";
import "./ProductFilter.css";

export interface ProductFilterValue {
  shopId: string;
  productId: string;
}
type ProductOption = Pick<GQL.EcomProductSummary, "shopId" | "productId" | "title">;
const keyOf = (value: ProductFilterValue) => JSON.stringify([value.shopId, value.productId]);

/** Catalog selection only: consumers own their entity queries and pagination. */
export const ProductFilter = observer(function ProductFilter({
  shopId,
  value,
  onChange,
}: {
  shopId?: string;
  value: ProductFilterValue[];
  onChange: (value: ProductFilterValue[]) => void;
}) {
  const { t } = useTranslation();
  const store = useEntityStore();
  const [open, setOpen] = useState(false);
  const [requestedScope, setRequestedScope] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const scope = shopId || "";
  const { data, loading, error, refetch } = useQuery<
    { ecommerceSearchProducts: ProductOption[] },
    { shopIds: string[] | null }
  >(ECOMMERCE_PRODUCT_FILTER_OPTIONS_QUERY, {
    variables: { shopIds: shopId ? [shopId] : null },
    skip: requestedScope !== scope,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });
  const options = (data?.ecommerceSearchProducts ?? []).filter(
    (option): option is ProductOption & { shopId: string } =>
      Boolean(option.shopId) && (!shopId || option.shopId === shopId),
  );
  const selected = new Set(value.map(keyOf));
  const query = searchDraft.trim().toLocaleLowerCase();
  const matches = options.filter(
    (option) =>
      (option.title ?? "").toLocaleLowerCase().includes(query) || option.productId.includes(query),
  );
  const label = t("ecommerce.affiliateWorkspace.workbench.productFilter");
  const toggle = (option: ProductFilterValue) => {
    const key = keyOf(option);
    onChange(
      selected.has(key)
        ? value.filter((item) => keyOf(item) !== key)
        : [...value, { shopId: option.shopId, productId: option.productId }],
    );
  };
  return (
    <TkPopover
      label={label}
      className="product-filter-popover"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setRequestedScope(scope);
      }}
      trigger={(props) => (
        <TkButton {...props}>
          {label}
          {value.length ? ` (${value.length})` : ""}
        </TkButton>
      )}
    >
      <div className="product-filter-content">
        <TkField
          label={t("ecommerce.affiliateWorkspace.workbench.productSearch")}
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          type="search"
        />
        <div className="product-filter-actions">
          <span>
            {t("ecommerce.affiliateWorkspace.workbench.productsSelected", { count: value.length })}
          </span>
          <TkButton size="sm" variant="ghost" disabled={!value.length} onClick={() => onChange([])}>
            {t("ecommerce.affiliateWorkspace.workbench.clearProducts")}
          </TkButton>
          <TkButton
            size="sm"
            variant="ghost"
            disabled={loading}
            onClick={() => void refetch().catch(() => {})}
          >
            {t("ecommerce.affiliateWorkspace.workbench.reloadProducts")}
          </TkButton>
        </div>
        {value.length > 0 && (
          <div
            className="product-filter-selected"
            aria-label={t("ecommerce.affiliateWorkspace.workbench.selectedProducts")}
          >
            {value.map((item) => {
              const option = options.find((candidate) => keyOf(candidate) === keyOf(item));
              return (
                <TkButton
                  key={keyOf(item)}
                  className="product-filter-selection"
                  size="sm"
                  variant="ghost"
                  title={option?.title ?? item.productId}
                  onClick={() => toggle(item)}
                  aria-label={t("ecommerce.affiliateWorkspace.workbench.removeProduct", {
                    name: option?.title ?? item.productId,
                  })}
                >
                  <span className="product-filter-option-layout">
                    <span className="product-filter-title">{option?.title ?? item.productId}</span>
                    <span aria-hidden="true">×</span>
                  </span>
                </TkButton>
              );
            })}
          </div>
        )}
        <div className="product-filter-results" aria-busy={loading}>
          {loading ? (
            <p role="status">{t("ecommerce.affiliateWorkspace.workbench.loadingProducts")}</p>
          ) : error ? (
            <p role="alert">{t("ecommerce.affiliateWorkspace.workbench.productsLoadFailed")}</p>
          ) : !matches.length ? (
            <p role="status">{t("ecommerce.affiliateWorkspace.workbench.noMatchingProducts")}</p>
          ) : (
            matches.map((option) => {
              const shop = shopDisplayLabel(
                store.shops.find((candidate) => candidate.id === option.shopId),
                option.shopId,
              );
              const checked = selected.has(keyOf(option));
              return (
                <TkButton
                  key={keyOf(option)}
                  variant={checked ? "secondary" : "ghost"}
                  className="product-filter-option"
                  aria-pressed={checked}
                  disabled={!checked && value.length >= 100}
                  onClick={() => toggle(option)}
                >
                  <span className="product-filter-option-layout">
                    <span aria-hidden="true">{checked ? "✓" : "+"}</span>
                    <span className="product-filter-option-copy">
                      <span
                        className="product-filter-title"
                        title={option.title ?? option.productId}
                      >
                        {option.title || option.productId}
                      </span>
                      <span className="product-filter-meta">
                        <TkPrivate sensitive={shop.sensitive}>{shop.text}</TkPrivate>
                        <span>{option.productId}</span>
                      </span>
                    </span>
                  </span>
                </TkButton>
              );
            })
          )}
        </div>
        <p className="product-filter-hint">
          {t("ecommerce.affiliateWorkspace.workbench.productSelectionHint")}
        </p>
        <TkButton size="sm" variant="primary" onClick={() => setOpen(false)}>
          {t("ecommerce.affiliateWorkspace.workbench.finishProductSelection")}
        </TkButton>
      </div>
    </TkPopover>
  );
});
