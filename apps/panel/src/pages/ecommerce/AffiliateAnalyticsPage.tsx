import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import type { AffiliateAnalyticsShop } from "./affiliate-analytics-scope.js";
import { AffiliateExploreTab } from "./components/AffiliateExploreTab.js";
import { AffiliateOverviewTab } from "./components/AffiliateOverviewTab.js";
import { AffiliatePageFrame, AffiliatePageHeader } from "./components/AffiliateUi.js";
import { TkPanel, TkTabs } from "../../components/design-system/index.js";
import "./AffiliateAnalyticsPage.css";
import "./components/AffiliateUi.css";

export function AffiliateAnalyticsPage() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const [tab, setTab] = useState<"OVERVIEW" | "EXPLORE">("OVERVIEW");
  const user = entityStore.currentUser;

  // Projected to plain DTOs during render: MST nodes must never be captured in
  // state, memos or closures (`.claude/rules/mst-react-state.md`).
  const allowed = new Set(
    entityStore.billingOverview?.shops.filter((item) => item.analytics.allowed).map((item) => item.shopId) ?? [],
  );
  const shops: AffiliateAnalyticsShop[] = entityStore.shops
    .filter((shop) => allowed.has(shop.id))
    .map((shop) => ({ id: shop.id, shopName: shop.shopName, alias: shop.alias, region: shop.region }));

  if (!user) {
    return (
      <AffiliatePageFrame>
        <TkPanel as="section" className="affiliate-state">
          <strong>{t("ecommerce.affiliateAnalytics.signInTitle")}</strong>
          <p>{t("ecommerce.affiliateAnalytics.signInBody")}</p>
        </TkPanel>
      </AffiliatePageFrame>
    );
  }

  return (
    <AffiliatePageFrame className="affiliate-analytics-page">
      <AffiliatePageHeader
        className="affiliate-analytics-hero"
        data-tutorial-id="affiliate-analytics-header"
        eyebrow={t("ecommerce.affiliateAnalytics.eyebrow")}
        title={t("ecommerce.affiliateAnalytics.title")}
        subtitle={t("ecommerce.affiliateAnalytics.subtitle")}
      />
      <TkTabs
        items={[
          {
            id: "OVERVIEW",
            label: t("ecommerce.affiliateAnalytics.overview"),
            buttonProps: { "data-tutorial-id": "affiliate-analytics-overview-tab" },
          },
          {
            id: "EXPLORE",
            label: t("ecommerce.affiliateAnalytics.explore.title"),
            buttonProps: { "data-tutorial-id": "affiliate-analytics-explore-tab" },
          },
        ]}
        value={tab}
        onChange={(value) => setTab(value as "OVERVIEW" | "EXPLORE")}
        label={t("ecommerce.affiliateAnalytics.title")}
        data-tutorial-id="affiliate-analytics-tabs"
      />
      {shops.length === 0 ? (
        <TkPanel as="section" className="affiliate-state is-upgrade">
          <strong>{t("ecommerce.affiliateAnalytics.noEntitlementTitle")}</strong>
          <p>{t("ecommerce.affiliateAnalytics.noEntitlementBody")}</p>
        </TkPanel>
      ) : tab === "OVERVIEW" ? (
        <AffiliateOverviewTab shops={shops} />
      ) : (
        <AffiliateExploreTab shops={shops} />
      )}
    </AffiliatePageFrame>
  );
}
