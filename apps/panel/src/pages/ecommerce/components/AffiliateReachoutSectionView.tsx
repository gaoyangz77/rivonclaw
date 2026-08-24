import { useTranslation } from "react-i18next";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCohortDay, formatNumber, formatPercent } from "../affiliate-analytics-format.js";
import {
  buildInviteDailyRows,
  buildResponseHorizonSeries,
  countAxisDomain,
  rateAxisDomain,
} from "../affiliate-overview.js";
import type { GQL } from "@rivonclaw/core";
import type { AffiliateSectionQuery } from "../affiliate-overview-types.js";
import { AffiliateChartCard, AffiliateMetric, AffiliateSectionHeader, AffiliateSectionState } from "./AffiliateOverviewParts.js";

/**
 * Section 1 — Reachout. Cohort axis: the real platform invitation date
 * (`start_at`, 100% coverage), never the day a response happened to land.
 */
export function AffiliateReachoutSectionView({ query }: { query: AffiliateSectionQuery<GQL.AffiliateReachoutSection> }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const section = query.section;

  const body = (() => {
    if (!section) return <AffiliateSectionState loading={query.loading} error={query.error} onRetry={query.retry} />;

    const horizonSeries = buildResponseHorizonSeries(section);
    const dailyRows = buildInviteDailyRows(section.daily);
    const rateDomain = rateAxisDomain(horizonSeries.points.map((point) => point.responseRate));
    const inviteDomain = countAxisDomain(dailyRows.map((row) => row.matureInvitations + row.immatureInvitations));
    const immatureDays = dailyRows.filter((row) => !row.mature).length;

    return (
      <>
        <div className="affiliate-metric-strip">
          <AffiliateMetric
            label={t("ecommerce.affiliateAnalytics.reachout.invitations")}
            value={formatNumber(section.invitations, locale)}
          />
          <AffiliateMetric
            label={t("ecommerce.affiliateAnalytics.reachout.responded")}
            value={formatNumber(section.responded, locale)}
          />
          <AffiliateMetric
            label={t("ecommerce.affiliateAnalytics.reachout.cohortResponseRate")}
            value={formatPercent(section.cohortResponseRate, locale)}
            hint={t("ecommerce.affiliateAnalytics.reachout.cohortResponseRateHint")}
          />
          <AffiliateMetric
            label={t("ecommerce.affiliateAnalytics.reachout.immatureShare")}
            value={formatPercent(section.immatureShare, locale)}
            hint={t("ecommerce.affiliateAnalytics.reachout.immatureShareHint")}
            tone="warning"
          />
        </div>

        <div className="affiliate-chart-grid">
          <AffiliateChartCard
            title={t("ecommerce.affiliateAnalytics.reachout.horizonTitle")}
            note={horizonSeries.subDaySuppressed
              ? t("ecommerce.affiliateAnalytics.reachout.subDaySuppressed", {
                share: formatPercent(horizonSeries.exactShare, locale),
              })
              : t("ecommerce.affiliateAnalytics.reachout.horizonNote")}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={horizonSeries.points}>
                <CartesianGrid strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="horizon" />
                <YAxis domain={rateDomain} tickFormatter={(value) => formatPercent(Number(value), locale)} />
                <Tooltip
                  formatter={(value, _name, item) => [
                    formatPercent(Number(value), locale),
                    t("ecommerce.affiliateAnalytics.reachout.matureBasis", {
                      count: Number((item?.payload as { matureInvitations?: number } | undefined)?.matureInvitations ?? 0),
                    }),
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="responseRate"
                  name={t("ecommerce.affiliateAnalytics.reachout.responseRateSeries")}
                  stroke="var(--affiliate-reachout)"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </AffiliateChartCard>

          <AffiliateChartCard
            title={t("ecommerce.affiliateAnalytics.reachout.dailyTitle")}
            note={t("ecommerce.affiliateAnalytics.reachout.dailyNote", { count: immatureDays })}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyRows}>
                <CartesianGrid strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="inviteDs" minTickGap={26} tickFormatter={(value) => formatCohortDay(String(value), locale)} />
                <YAxis domain={inviteDomain} tickFormatter={(value) => formatNumber(Number(value), locale, true)} />
                <Tooltip
                  labelFormatter={(value) => formatCohortDay(String(value), locale)}
                  formatter={(value, name) => [formatNumber(Number(value), locale), String(name)]}
                />
                <Legend />
                <Bar
                  dataKey="matureInvitations"
                  stackId="invitations"
                  name={t("ecommerce.affiliateAnalytics.reachout.matureSeries")}
                  fill="var(--affiliate-reachout)"
                />
                <Bar
                  dataKey="immatureInvitations"
                  stackId="invitations"
                  name={t("ecommerce.affiliateAnalytics.reachout.immatureSeries")}
                  fill="var(--affiliate-immature)"
                />
                <Line
                  type="monotone"
                  dataKey="responded"
                  name={t("ecommerce.affiliateAnalytics.reachout.respondedSeries")}
                  stroke="var(--affiliate-response)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </AffiliateChartCard>
        </div>

        <div className="affiliate-evidence-strip">
          <span>
            {t("ecommerce.affiliateAnalytics.reachout.exactResponses")}
            <b>{formatNumber(section.responsesExact, locale)}</b>
          </span>
          <span>
            {t("ecommerce.affiliateAnalytics.reachout.proxyResponses")}
            <b>{formatNumber(section.responsesProxy, locale)}</b>
          </span>
          <span>
            {t("ecommerce.affiliateAnalytics.reachout.exactShare")}
            <b>{formatPercent(horizonSeries.exactShare, locale)}</b>
          </span>
          <small>{t("ecommerce.affiliateAnalytics.reachout.timeBasisDisclosure")}</small>
        </div>
      </>
    );
  })();

  return (
    <section className="affiliate-section" data-tutorial-id="affiliate-analytics-reachout">
      <AffiliateSectionHeader
        index="1"
        title={t("ecommerce.affiliateAnalytics.reachout.title")}
        axis={t("ecommerce.affiliateAnalytics.reachout.axis")}
      />
      {body}
    </section>
  );
}
