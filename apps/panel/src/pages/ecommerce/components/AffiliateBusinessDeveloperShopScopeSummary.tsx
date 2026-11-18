import { Fragment, type ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { TkPrivate } from "../../../components/design-system/index.js";
import { formatShopRegionLabel } from "../../../lib/ecommerce-labels.js";
import { shopDisplayLabel } from "../../../lib/shop-display.js";
import {
  isUnrestrictedShopScope,
  scopeShopsFrom,
  summarizeShopScope,
} from "../../../lib/affiliate-bd-shop-scope.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";

/** Shops named per region before the rest collapse into "+N more". */
const SHOPS_SHOWN_PER_REGION = 2;

/**
 * One compact line describing a business developer's shop access (ADR-110):
 * "All shops", or e.g. "US (whole region) · GB: Shop A, Shop B +3 more".
 * Shop names are platform names and are masked in privacy mode.
 */
export const AffiliateBusinessDeveloperShopScopeSummary = observer(
  function AffiliateBusinessDeveloperShopScopeSummary({
    regions,
    shopIds,
  }: {
    regions: readonly string[];
    shopIds: readonly string[];
  }) {
    const { t } = useTranslation();
    const entityStore = useEntityStore();
    const scope = { regions, shopIds };
    if (isUnrestrictedShopScope(scope)) {
      return <>{t("ecommerce.affiliateTeam.shopScopeSummaryAll")}</>;
    }
    const summary = summarizeShopScope(scope, scopeShopsFrom(entityStore.shops));
    const segments: ReactNode[] = [
      ...summary.wholeRegions.map((region) =>
        t("ecommerce.affiliateTeam.shopScopeSummaryWholeRegion", {
          region: formatShopRegionLabel(region, t),
        }),
      ),
      ...summary.shopGroups.map((group) => {
        const lead = t("ecommerce.affiliateTeam.shopScopeSummaryRegionLead", {
          region: group.region
            ? formatShopRegionLabel(group.region, t)
            : t("ecommerce.affiliateTeam.shopScopeShopsWithoutRegion"),
        });
        const shown = group.shops.slice(0, SHOPS_SHOWN_PER_REGION);
        const hidden = group.shops.length - shown.length;
        return (
          <Fragment key={group.region ?? "__NO_REGION__"}>
            {lead}
            {shown.map((shop, index) => {
              const display = shopDisplayLabel(shop, shop.id);
              return (
                <Fragment key={shop.id}>
                  {index > 0 && t("ecommerce.affiliateTeam.shopScopeSummaryShopSeparator")}
                  <TkPrivate sensitive={display.sensitive}>{display.text}</TkPrivate>
                </Fragment>
              );
            })}
            {hidden > 0 && ` ${t("ecommerce.affiliateTeam.shopScopeSummaryMore", { count: hidden })}`}
          </Fragment>
        );
      }),
      ...(summary.missingShopCount > 0
        ? [
            t("ecommerce.affiliateTeam.shopScopeSummaryMissingShops", {
              count: summary.missingShopCount,
            }),
          ]
        : []),
    ];
    return (
      <>
        {segments.map((segment, index) => (
          <Fragment key={index}>
            {index > 0 && " · "}
            {segment}
          </Fragment>
        ))}
      </>
    );
  },
);
