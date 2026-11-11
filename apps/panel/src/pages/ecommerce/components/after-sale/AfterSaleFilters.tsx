import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import {
  TkChoiceSelect,
  TkField,
  TkSegmented,
  TkToolbar,
} from "../../../../components/design-system/index.js";
import {
  AFTER_SALE_KINDS,
  AFTER_SALE_SELLER_ACTIONS,
  AFTER_SALE_STATUSES,
} from "../../../../lib/after-sale.js";
import { useEntityStore } from "../../../../store/EntityStoreProvider.js";
import {
  AFTER_SALE_MAX_WINDOW_DAYS,
  type AfterSaleView,
} from "../../../../store/models/EcommerceAfterSaleModel.js";
import {
  afterSaleKindLabel,
  afterSaleSellerActionLabel,
  afterSaleStatusLabel,
} from "../../after-sale-labels.js";
import type { AffiliateAnalyticsShop } from "../../affiliate-analytics-scope.js";
import { MAX_ORDER_SEARCH_IDS } from "../../../../lib/order-search.js";
import { AffiliateShopScopeControl } from "../AffiliateShopScopeControl.js";
import { OrderSearchField } from "../OrderSearchField.js";

/** "" is "every value"; the model keeps a list so the query can take several. */
function singleValue(values: readonly string[]): string {
  return values[0] ?? "";
}

/**
 * One row of filters, built from the controls the other analysis pages use: the region and shop
 * scope control, and the design-system choice select for each request field.
 */
export const AfterSaleFilters = observer(function AfterSaleFilters() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const afterSale = entityStore.ecommerceAfterSale;

  // Plain DTOs projected during render; MST shop nodes never reach the scope control's state.
  const shops: AffiliateAnalyticsShop[] = entityStore.shops.map((shop) => ({
    id: shop.id,
    shopName: shop.shopName,
    alias: shop.alias,
    region: shop.region,
  }));
  const selectedShopIds = afterSale.allShops
    ? shops.map((shop) => shop.id)
    : [...afterSale.shopIds];
  const windowIssue = afterSale.windowIssue;
  // An order search drops the window, so its dates are shown but cannot be edited.
  const anyDate = afterSale.view === "ALL" && !afterSale.windowApplies;
  const choices = (all: string, values: readonly string[], labelOf: (value: string) => string) => [
    { value: "", label: all },
    ...values.map((value) => ({ value, label: labelOf(value) })),
  ];

  return (
    <TkToolbar className="after-sale-filters" data-tutorial-id="after-sale-filters">
      <div className="tk-v1-field">
        <span className="tk-v1-label">{t("ecommerce.afterSale.viewLabel")}</span>
        <TkSegmented
          label={t("ecommerce.afterSale.viewLabel")}
          items={[
            { id: "TO_REVIEW", label: t("ecommerce.afterSale.views.toReview") },
            { id: "ALL", label: t("ecommerce.afterSale.views.all") },
          ]}
          value={afterSale.view}
          onChange={(view) => afterSale.setView(view as AfterSaleView)}
        />
      </div>
      <OrderSearchField
        label={t("ecommerce.afterSale.filters.orderSearch")}
        placeholder={t("ecommerce.afterSale.filters.orderSearchPlaceholder")}
        error={
          afterSale.orderSearchTooMany
            ? t("ecommerce.afterSale.filters.orderSearchTooMany", { max: MAX_ORDER_SEARCH_IDS })
            : undefined
        }
        draft={afterSale.orderSearchDraft}
        onDraftChange={(value) => afterSale.setOrderSearchDraft(value)}
        onSearch={() => afterSale.applyOrderSearch()}
      />
      <AffiliateShopScopeControl
        shops={shops}
        selected={selectedShopIds}
        label={t("ecommerce.afterSale.filters.shops")}
        onChange={(next) => afterSale.setShopScope(next, shops.length)}
      />
      <TkChoiceSelect
        label={t("ecommerce.afterSale.filters.kinds")}
        value={singleValue(afterSale.kinds)}
        options={choices(t("ecommerce.afterSale.filters.allKinds"), AFTER_SALE_KINDS, (kind) =>
          afterSaleKindLabel(t, kind),
        )}
        onChange={(kind) => afterSale.setKinds(kind ? [kind] : [])}
      />
      {afterSale.view === "ALL" ? (
        <>
          <TkChoiceSelect
            label={t("ecommerce.afterSale.filters.sellerActions")}
            value={singleValue(afterSale.sellerActions)}
            options={choices(
              t("ecommerce.afterSale.filters.allSellerActions"),
              AFTER_SALE_SELLER_ACTIONS,
              (action) => afterSaleSellerActionLabel(t, action),
            )}
            onChange={(action) => afterSale.setSellerActions(action ? [action] : [])}
          />
          <TkChoiceSelect
            label={t("ecommerce.afterSale.filters.statuses")}
            value={singleValue(afterSale.statuses)}
            options={choices(
              t("ecommerce.afterSale.filters.allStatuses"),
              AFTER_SALE_STATUSES,
              (status) => afterSaleStatusLabel(t, status),
            )}
            searchable
            searchPlaceholder={t("ecommerce.afterSale.filters.search")}
            onChange={(status) => afterSale.setStatuses(status ? [status] : [])}
          />
          <TkField
            type="date"
            label={t("ecommerce.afterSale.filters.createdFrom")}
            value={afterSale.windowFrom}
            max={afterSale.windowTo || undefined}
            disabled={anyDate}
            onChange={(event) => afterSale.setWindow(event.target.value, afterSale.windowTo)}
          />
          <TkField
            type="date"
            label={t("ecommerce.afterSale.filters.createdTo")}
            value={afterSale.windowTo}
            min={afterSale.windowFrom || undefined}
            disabled={anyDate}
            hint={anyDate ? t("ecommerce.afterSale.filters.orderSearchAnyDate") : undefined}
            error={
              windowIssue
                ? t(`ecommerce.afterSale.windowIssue.${windowIssue}`, {
                    days: AFTER_SALE_MAX_WINDOW_DAYS,
                  })
                : undefined
            }
            onChange={(event) => afterSale.setWindow(afterSale.windowFrom, event.target.value)}
          />
        </>
      ) : null}
    </TkToolbar>
  );
});
