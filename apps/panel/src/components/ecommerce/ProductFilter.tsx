import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { requestUserProducts, type ProductOption } from "./product-catalog-request.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { shopDisplayLabel } from "../../lib/shop-display.js";
import { TkButton, TkField, TkPopover, TkPrivate } from "../design-system/index.js";
import "./ProductFilter.css";

export interface ProductFilterValue {
  shopId: string;
  productId: string;
}
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
  const [searchDraft, setSearchDraft] = useState("");
  const scope = shopId || "";
  const client = useApolloClient();
  const request = useRef<AbortController | null>(null);
  const [catalog, setCatalog] = useState({
    scope,
    options: [] as ProductOption[],
    status: "idle",
  });
  useEffect(() => {
    setCatalog({ scope, options: [], status: "idle" });
    return () => request.current?.abort();
  }, [scope]);
  const active = catalog.scope === scope;
  const loading = active && catalog.status === "loading";
  const error = active && catalog.status === "error";
  const options = (active ? catalog.options : []).filter(
    (option): option is ProductOption & { shopId: string } =>
      Boolean(option.shopId) && (!shopId || option.shopId === shopId),
  );
  const selected = new Set(value.map(keyOf));
  const matches = options;
  const label = t("ecommerce.affiliateWorkspace.workbench.productFilter");
  const search = async () => {
    // Guard rapid repeated submits before React commits the disabled button state.
    if (request.current && !request.current.signal.aborted) return;
    const keywordOrId = searchDraft.trim();
    if (!keywordOrId) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const next = {
      scope,
      options: [] as ProductOption[],
      status: "loading",
    };
    setCatalog({ ...next });
    try {
      const result = await requestUserProducts(client, keywordOrId, controller.signal);
      if (!controller.signal.aborted) {
        setCatalog({
          ...next,
          options: result.products,
          status: result.failedShopIds.length ? "error" : "complete",
        });
      }
    } catch {
      // UI boundary: a transport failure is not an empty successful search.
      if (!controller.signal.aborted) setCatalog({ ...next, status: "error" });
    } finally {
      if (request.current === controller) request.current = null;
    }
  };
  const cancel = () => {
    request.current?.abort();
    setCatalog((current) => ({ ...current, status: "cancelled" }));
  };
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
      onOpenChange={setOpen}
      trigger={(props) => (
        <TkButton {...props}>
          {label}
          {value.length ? ` (${value.length})` : ""}
        </TkButton>
      )}
    >
      <div className="product-filter-content">
        <form
          className="product-filter-search"
          onSubmit={(event) => {
            event.preventDefault();
            if (!loading && searchDraft.trim()) void search();
          }}
        >
          <TkField
            label={t("ecommerce.affiliateWorkspace.workbench.productSearch")}
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            type="search"
          />
          <TkButton type="submit" disabled={loading || !searchDraft.trim()}>
            {t("ecommerce.affiliateWorkspace.workbench.searchCreator")}
          </TkButton>
        </form>
        <div className="product-filter-actions">
          <span>
            {t("ecommerce.affiliateWorkspace.workbench.productsSelected", { count: value.length })}
          </span>
          <TkButton size="sm" variant="ghost" disabled={!value.length} onClick={() => onChange([])}>
            {t("ecommerce.affiliateWorkspace.workbench.clearProducts")}
          </TkButton>
          {loading ? (
            <TkButton size="sm" variant="ghost" onClick={cancel}>
              {t("common.cancel")}
            </TkButton>
          ) : error ? (
            <TkButton size="sm" variant="ghost" disabled={loading} onClick={() => void search()}>
              {t("ecommerce.affiliateWorkspace.workbench.reloadProducts")}
            </TkButton>
          ) : null}
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
          ) : !active || catalog.status === "idle" ? (
            <p role="status">{t("ecommerce.affiliateWorkspace.workbench.productSearchPrompt")}</p>
          ) : catalog.status === "cancelled" ? (
            <p role="status">
              {t("ecommerce.affiliateWorkspace.workbench.productSearchCancelled")}
            </p>
          ) : !matches.length ? (
            <p role="status">{t("ecommerce.affiliateWorkspace.workbench.noMatchingProducts")}</p>
          ) : null}
          {matches.map((option) => {
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
                    <span className="product-filter-title" title={option.title ?? option.productId}>
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
          })}
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
