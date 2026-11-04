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
import { AffiliateChipMultiSelect } from "../AffiliateChipMultiSelect.js";
import { AffiliateShopScopeControl } from "../AffiliateShopScopeControl.js";

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
  const matchAll = t("ecommerce.afterSale.filters.matchAll");
  const windowIssue = afterSale.windowIssue;

  return (
    <TkToolbar className="after-sale-filters" data-tutorial-id="after-sale-filters">
      <div className="after-sale-filter-row">
        <TkSegmented
          label={t("ecommerce.afterSale.viewLabel")}
          items={[
            { id: "TO_REVIEW", label: t("ecommerce.afterSale.views.toReview") },
            { id: "ALL", label: t("ecommerce.afterSale.views.all") },
          ]}
          value={afterSale.view}
          onChange={(view) => afterSale.setView(view as AfterSaleView)}
        />
        <AffiliateShopScopeControl
          shops={shops}
          selected={selectedShopIds}
          showRegion={false}
          label={t("ecommerce.afterSale.filters.shops")}
          onChange={(next) => afterSale.setShopScope(next, shops.length)}
        />
        {afterSale.view === "ALL" ? (
          <>
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
      {afterSale.view === "ALL" ? (
        <div className="after-sale-filter-row">
          <AffiliateChipMultiSelect
            label={t("ecommerce.afterSale.filters.kinds")}
            emptyLabel={matchAll}
            options={AFTER_SALE_KINDS.map((kind) => ({
              id: kind,
              label: afterSaleKindLabel(t, kind),
            }))}
            selectedIds={[...afterSale.kinds]}
            onChange={(next) => afterSale.setKinds(next)}
          />
          <AffiliateChipMultiSelect
            label={t("ecommerce.afterSale.filters.sellerActions")}
            emptyLabel={matchAll}
            options={AFTER_SALE_SELLER_ACTIONS.map((action) => ({
              id: action,
              label: afterSaleSellerActionLabel(t, action),
            }))}
            selectedIds={[...afterSale.sellerActions]}
            onChange={(next) => afterSale.setSellerActions(next)}
          />
          <AffiliateChipMultiSelect
            label={t("ecommerce.afterSale.filters.statuses")}
            emptyLabel={matchAll}
            options={AFTER_SALE_STATUSES.map((status) => ({
              id: status,
              label: afterSaleStatusLabel(t, status),
            }))}
            selectedIds={[...afterSale.statuses]}
            onChange={(next) => afterSale.setStatuses(next)}
          />
        </div>
      ) : null}
    </TkToolbar>
  );
});
