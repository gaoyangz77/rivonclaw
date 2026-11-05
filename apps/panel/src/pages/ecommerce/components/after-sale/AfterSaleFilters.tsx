import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { TkField, TkSegmented, TkToolbar } from "../../../../components/design-system/index.js";
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
import { CheckboxMultiSelect } from "../../../../components/inputs/CheckboxMultiSelect.js";
import { AffiliateShopScopeControl } from "../AffiliateShopScopeControl.js";

/**
 * A request filter where the model's empty selection means every value: the list then shows every
 * value checked, checking all of them goes back to "all", and "only this" picks a single value.
 * The list never becomes empty.
 */
function AfterSaleMultiFilter({
  label,
  allText,
  values,
  selected,
  labelOf,
  onChange,
  searchable = false,
}: {
  label: string;
  allText: string;
  values: readonly string[];
  selected: readonly string[];
  labelOf: (value: string) => string;
  onChange: (next: string[]) => void;
  searchable?: boolean;
}) {
  const { t } = useTranslation();
  const buttonText =
    selected.length === 0
      ? allText
      : selected.length === 1
        ? labelOf(selected[0]!)
        : t("ecommerce.afterSale.filters.selectedCount", { count: selected.length });
  return (
    <CheckboxMultiSelect
      label={label}
      buttonText={buttonText}
      popoverLabel={label}
      options={values.map((value) => ({ id: value, label: labelOf(value) }))}
      selected={selected.length ? selected : values}
      onChange={(next) => onChange(next.length === values.length ? [] : next)}
      selectAllLabel={t("ecommerce.afterSale.filters.selectAll")}
      deselectAllLabel={t("ecommerce.afterSale.filters.deselectAll")}
      searchLabel={searchable ? t("ecommerce.afterSale.filters.search") : undefined}
      onlyLabel={t("ecommerce.afterSale.filters.only")}
    />
  );
}

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
  const all = afterSale.view === "ALL";

  // The view switch is a row of its own; every filter under it is a label over a same-height
  // control, so the row lines up on the controls' bottom edge.
  return (
    <TkToolbar className="after-sale-filters" data-tutorial-id="after-sale-filters">
      <TkSegmented
        label={t("ecommerce.afterSale.viewLabel")}
        items={[
          { id: "TO_REVIEW", label: t("ecommerce.afterSale.views.toReview") },
          { id: "ALL", label: t("ecommerce.afterSale.views.all") },
        ]}
        value={afterSale.view}
        onChange={(view) => afterSale.setView(view as AfterSaleView)}
      />
      <div className="after-sale-filter-row">
        <AffiliateShopScopeControl
          shops={shops}
          selected={selectedShopIds}
          showRegion={false}
          label={t("ecommerce.afterSale.filters.shops")}
          onChange={(next) => afterSale.setShopScope(next, shops.length)}
        />
        <AfterSaleMultiFilter
          label={t("ecommerce.afterSale.filters.kinds")}
          allText={t("ecommerce.afterSale.filters.allKinds")}
          values={AFTER_SALE_KINDS}
          selected={[...afterSale.kinds]}
          labelOf={(kind) => afterSaleKindLabel(t, kind)}
          onChange={(next) => afterSale.setKinds(next)}
        />
        {all ? (
          <>
            <AfterSaleMultiFilter
              label={t("ecommerce.afterSale.filters.sellerActions")}
              allText={t("ecommerce.afterSale.filters.allSellerActions")}
              values={AFTER_SALE_SELLER_ACTIONS}
              selected={[...afterSale.sellerActions]}
              labelOf={(action) => afterSaleSellerActionLabel(t, action)}
              onChange={(next) => afterSale.setSellerActions(next)}
            />
            <AfterSaleMultiFilter
              label={t("ecommerce.afterSale.filters.statuses")}
              allText={t("ecommerce.afterSale.filters.allStatuses")}
              values={AFTER_SALE_STATUSES}
              selected={[...afterSale.statuses]}
              labelOf={(status) => afterSaleStatusLabel(t, status)}
              onChange={(next) => afterSale.setStatuses(next)}
              searchable
            />
            <TkField
              type="date"
              label={t("ecommerce.afterSale.filters.createdFrom")}
              value={afterSale.windowFrom}
              max={afterSale.windowTo || undefined}
              onChange={(event) => afterSale.setWindow(event.target.value, afterSale.windowTo)}
            />
            <TkField
              type="date"
              label={t("ecommerce.afterSale.filters.createdTo")}
              value={afterSale.windowTo}
              min={afterSale.windowFrom || undefined}
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
      </div>
    </TkToolbar>
  );
});
