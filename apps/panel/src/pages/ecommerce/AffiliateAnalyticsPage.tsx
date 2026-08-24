import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import type { AffiliateAnalyticsShop } from "./affiliate-analytics-scope.js";
import { AffiliateExploreTab } from "./components/AffiliateExploreTab.js";
import { AffiliateOverviewTab } from "./components/AffiliateOverviewTab.js";
import "./AffiliateAnalyticsPage.css";

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
      <div className="page-enter">
        <section className="affiliate-state">
          <strong>{t("ecommerce.affiliateAnalytics.signInTitle")}</strong>
          <p>{t("ecommerce.affiliateAnalytics.signInBody")}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page-enter affiliate-analytics-page">
      <header className="affiliate-analytics-hero" data-tutorial-id="affiliate-analytics-header">
        <div>
          <span>{t("ecommerce.affiliateAnalytics.eyebrow")}</span>
          <h1>{t("ecommerce.affiliateAnalytics.title")}</h1>
          <p>{t("ecommerce.affiliateAnalytics.subtitle")}</p>
        </div>
        <div className="affiliate-tabs" role="tablist" data-tutorial-id="affiliate-analytics-tabs">
          <button
            data-tutorial-id="affiliate-analytics-overview-tab"
            role="tab"
            type="button"
            aria-selected={tab === "OVERVIEW"}
            className={tab === "OVERVIEW" ? "active" : ""}
            onClick={() => setTab("OVERVIEW")}
          >
            {t("ecommerce.affiliateAnalytics.overview")}
          </button>
          <button
            data-tutorial-id="affiliate-analytics-explore-tab"
            role="tab"
            type="button"
            aria-selected={tab === "EXPLORE"}
            className={tab === "EXPLORE" ? "active" : ""}
            onClick={() => setTab("EXPLORE")}
          >
            {t("ecommerce.affiliateAnalytics.explore.title")}
          </button>
        </div>
      </header>
      {shops.length === 0 ? (
        <section className="affiliate-state is-upgrade">
          <strong>{t("ecommerce.affiliateAnalytics.noEntitlementTitle")}</strong>
          <p>{t("ecommerce.affiliateAnalytics.noEntitlementBody")}</p>
        </section>
      ) : tab === "OVERVIEW" ? (
        <AffiliateOverviewTab shops={shops} />
      ) : (
        <AffiliateExploreTab shops={shops} />
      )}
    </div>
  );
}
