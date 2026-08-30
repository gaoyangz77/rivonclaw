import { useTranslation } from "react-i18next";
import { RefreshIcon } from "../../../components/icons.js";
import { formatNumber } from "../affiliate-analytics-format.js";
import type { AffiliateAnalyticsShop } from "../affiliate-analytics-scope.js";
import { AFFILIATE_WINDOW_DAYS, type AffiliateOverviewPortfolio } from "../affiliate-overview-types.js";
import { useAffiliateOverview } from "../hooks/useAffiliateOverview.js";
import { AffiliateApprovalSectionView } from "./AffiliateApprovalSectionView.js";
import { AffiliatePostApprovalSectionView } from "./AffiliatePostApprovalSectionView.js";
import { AffiliateReachoutSectionView } from "./AffiliateReachoutSectionView.js";
import { AffiliateShopScopeControl } from "./AffiliateShopScopeControl.js";
import { TkSegmented } from "../../../components/design-system/index.js";

/**
 * Portfolio counts. These are current values read without any date predicate,
 * so they deliberately do not move when the cohort window changes — the caption
 * says so, because a number sitting next to a window control reads as windowed.
 */
function AffiliatePortfolioStrip({ portfolio }: { portfolio: AffiliateOverviewPortfolio | null }) {
  const { t, i18n } = useTranslation();
  const entries = [
    ["campaigns", portfolio?.activeCampaigns],
    ["target", portfolio?.activeTargetCollaborations],
    ["open", portfolio?.activeOpenCollaborations],
  ] as const;

  return (
    <div className="affiliate-portfolio-current">
      <span className="affiliate-portfolio-caption">{t("ecommerce.affiliateAnalytics.portfolio.caption")}</span>
      {entries.map(([key, value]) => (
        <div key={key}>
          <span>{t(`ecommerce.affiliateAnalytics.portfolio.${key}`)}</span>
          <strong>{value == null ? "—" : formatNumber(value, i18n.language)}</strong>
        </div>
      ))}
    </div>
  );
}

export function AffiliateOverviewTab({ shops }: { shops: AffiliateAnalyticsShop[] }) {
  const { t } = useTranslation();
  const state = useAffiliateOverview(shops);

  return (
    <div className="affiliate-overview">
      <section className="affiliate-control-bar" data-tutorial-id="affiliate-analytics-controls">
        <AffiliateShopScopeControl shops={shops} selected={state.shopIds} onChange={state.setShopIds} />
        <div className="affiliate-window-control">
          <span>{t("ecommerce.affiliateAnalytics.window")}</span>
          <TkSegmented
            size="sm"
            items={AFFILIATE_WINDOW_DAYS.map((days) => ({
              id: String(days),
              label: t("ecommerce.affiliateAnalytics.windowDays", { count: days }),
            }))}
            value={String(state.windowDays)}
            onChange={(value) => state.setWindowDays(Number(value) as (typeof AFFILIATE_WINDOW_DAYS)[number])}
            label={t("ecommerce.affiliateAnalytics.window")}
          />
        </div>
        <button
          className="btn btn-secondary affiliate-refresh"
          type="button"
          onClick={state.refetchAll}
          disabled={state.refreshing || state.shopIds.length === 0}
        >
          <RefreshIcon aria-hidden="true" />
          {state.refreshing ? t("ecommerce.affiliateAnalytics.refreshing") : t("ecommerce.affiliateAnalytics.refresh")}
        </button>
        <AffiliatePortfolioStrip portfolio={state.portfolio} />
      </section>

      {/*
        Excluding a section's limiting shops narrows the PAGE's shop scope, not
        just that section's chart: the three sections share one selection, and a
        per-section shop set would make their figures silently incomparable —
        the defect this whole layer exists to surface.
      */}
      <AffiliateReachoutSectionView query={state.reachout} onExcludeShops={state.setShopIds} />
      <AffiliateApprovalSectionView query={state.approval} onExcludeShops={state.setShopIds} />
      <AffiliatePostApprovalSectionView
        query={state.postApproval}
        windowDays={state.postApprovalWindowDays}
        onExcludeShops={state.setShopIds}
      />
    </div>
  );
}
