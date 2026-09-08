import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { requestProductCatalogs, type ProductOption } from "./product-catalog-request.js";
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
    query: "",
    status: "idle",
    completed: 0,
    total: 0,
  });
  useEffect(() => {
    setCatalog({ scope, options: [], query: "", status: "idle", completed: 0, total: 0 });
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
  const query = catalog.query;
  const matches = options.filter(
    (option) =>
      (option.title ?? "").toLocaleLowerCase().includes(query) || option.productId.includes(query),
  );
  const label = t("ecommerce.affiliateWorkspace.workbench.productFilter");
  const search = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    // Snapshot IDs before async work: never retain live shop nodes.
    const ids = shopId
      ? [shopId]
      : store.shops
          .filter((shop) => shop.authStatus === GQL.ShopAuthStatus.Authorized)
          .map((shop) => shop.id);
    const next = {
      scope,
      query: searchDraft.trim().toLocaleLowerCase(),
      options: [] as ProductOption[],
      completed: 0,
      total: ids.length,
      status: "loading",
    };
    setCatalog({ ...next });
    try {
      if (!ids.length) throw new Error("No authorized shops available");
      let failed = false;
      await requestProductCatalogs(client, ids, controller.signal, (result) => {
        if (result.status === "fulfilled") {
          next.options = [...next.options, ...result.products];
        } else {
          failed = true;
        }
        next.completed += 1;
        setCatalog({ ...next });
      });
      if (!controller.signal.aborted) {
        setCatalog({ ...next, status: failed ? "error" : "complete" });
      }
    } catch {
      // UI boundary: keep completed shops visible, but explicitly mark results incomplete.
      if (!controller.signal.aborted) setCatalog({ ...next, status: "error" });
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
            <p role="status">
              {t("ecommerce.affiliateWorkspace.workbench.loadingProducts", {
                completed: catalog.completed,
                total: catalog.total,
              })}
            </p>
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
