import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCohortDay, formatNumber, formatPercent } from "../affiliate-analytics-format.js";
import { countAxisDomain } from "../affiliate-overview.js";
import type { GQL } from "@rivonclaw/core";
import type { AffiliateSectionQuery } from "../affiliate-overview-types.js";
import { AffiliateChartCard, AffiliateMetric, AffiliateSectionHeader, AffiliateSectionState } from "./AffiliateOverviewParts.js";

const OUTCOME_SERIES = [
  { key: "approved", labelKey: "approved", fill: "var(--affiliate-approved)" },
  { key: "merchantRejected", labelKey: "merchantRejected", fill: "var(--affiliate-rejected)" },
  { key: "overdueByUs", labelKey: "overdueByUs", fill: "var(--affiliate-overdue)" },
  { key: "inFlight", labelKey: "inFlight", fill: "var(--affiliate-inflight)" },
] as const;

/**
 * Section 2 — Approval. Cohort axis: the application submission date, so an
 * outcome is always counted back against the day the Creator applied.
 */
export function AffiliateApprovalSectionView({ query }: { query: AffiliateSectionQuery<GQL.AffiliateApprovalSection> }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const section = query.section;

  const outcomeBars = OUTCOME_SERIES.map((series) => (
    <Bar
      key={series.key}
      dataKey={series.key}
      stackId="outcome"
      name={t(`ecommerce.affiliateAnalytics.approval.${series.labelKey}`)}
      fill={series.fill}
    />
  ));

  const body = (() => {
    if (!section) return <AffiliateSectionState loading={query.loading} error={query.error} onRetry={query.retry} />;

    const dailyDomain = countAxisDomain(section.daily.map((point) => point.applications));
    const ageDomain = countAxisDomain(section.byAge.map((point) => point.applications));

    return (
      <>
        <div className="affiliate-metric-strip">
          <AffiliateMetric
            label={t("ecommerce.affiliateAnalytics.approval.applications")}
            value={formatNumber(section.applications, locale)}
          />
          <AffiliateMetric
            label={t("ecommerce.affiliateAnalytics.approval.approvalRate")}
            value={formatPercent(section.approvalRate, locale)}
          />
          <AffiliateMetric
            label={t("ecommerce.affiliateAnalytics.approval.merchantRejectRate")}
            value={formatPercent(section.merchantRejectRate, locale)}
          />
          <AffiliateMetric
            label={t("ecommerce.affiliateAnalytics.approval.overdueRate")}
            value={formatPercent(section.overdueRate, locale)}
            hint={t("ecommerce.affiliateAnalytics.approval.overdueRateHint")}
            tone="warning"
          />
        </div>

        <div className="affiliate-chart-grid">
          <AffiliateChartCard
            title={t("ecommerce.affiliateAnalytics.approval.dailyTitle")}
            note={t("ecommerce.affiliateAnalytics.approval.dailyNote")}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={section.daily}>
                <CartesianGrid strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="cohortDs" minTickGap={26} tickFormatter={(value) => formatCohortDay(String(value), locale)} />
                <YAxis domain={dailyDomain} tickFormatter={(value) => formatNumber(Number(value), locale, true)} />
                <Tooltip
                  labelFormatter={(value) => formatCohortDay(String(value), locale)}
                  formatter={(value, name) => [formatNumber(Number(value), locale), String(name)]}
                />
                <Legend />
                {outcomeBars}
              </BarChart>
            </ResponsiveContainer>
          </AffiliateChartCard>

          <AffiliateChartCard
            title={t("ecommerce.affiliateAnalytics.approval.byAgeTitle")}
            note={t("ecommerce.affiliateAnalytics.approval.byAgeNote")}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={section.byAge}>
                <CartesianGrid strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="ageBucket" />
                <YAxis domain={ageDomain} tickFormatter={(value) => formatNumber(Number(value), locale, true)} />
                <Tooltip formatter={(value, name) => [formatNumber(Number(value), locale), String(name)]} />
                <Legend />
                {outcomeBars}
              </BarChart>
            </ResponsiveContainer>
          </AffiliateChartCard>
        </div>

        <div className="affiliate-evidence-strip">
          {OUTCOME_SERIES.map((series) => (
            <span key={series.key}>
              {t(`ecommerce.affiliateAnalytics.approval.${series.labelKey}`)}
              <b>{formatNumber(section[series.key], locale)}</b>
            </span>
          ))}
        </div>
      </>
    );
  })();

  return (
    <section className="affiliate-section" data-tutorial-id="affiliate-analytics-approval">
      <AffiliateSectionHeader
        index="2"
        title={t("ecommerce.affiliateAnalytics.approval.title")}
        axis={t("ecommerce.affiliateAnalytics.approval.axis")}
      />
      {body}
    </section>
  );
}
