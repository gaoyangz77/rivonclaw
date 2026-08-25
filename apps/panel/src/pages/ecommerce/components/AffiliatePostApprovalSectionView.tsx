import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCohortDay, formatNumber, formatPercent, formatRatio } from "../affiliate-analytics-format.js";
import {
  applyCoverageWindow,
  buildCohortUnitsRows,
  countAxisDomain,
  countImmatureCohorts,
  countPartialDays,
  coverageBasis,
  isFullyCoveredDay,
  rateAxisDomain,
} from "../affiliate-overview.js";
import type { AffiliateSectionQuery } from "../affiliate-overview-types.js";
import { AffiliateCoverageBand, AffiliateCoverageNotice } from "./AffiliateCoverageBand.js";
import { AffiliateChartCard, AffiliateMetric, AffiliateSectionHeader, AffiliateSectionState } from "./AffiliateOverviewParts.js";

/** How solid a bar in the partial range is drawn, relative to a covered one. */
const PARTIAL_BAR_OPACITY = 0.35;

/**
 * Section 3 — Post-approval performance. Cohort axis: the application date, and
 * the measure is UNITS. GMV is deliberately absent: order-line GMV is 98.2%
 * missing at 0–7 days old and keeps a ~17% permanent hole, while `units` is
 * never missing.
 */
export function AffiliatePostApprovalSectionView({ query, onExcludeShops }: {
  query: AffiliateSectionQuery<GQL.AffiliatePostApprovalSection>;
  onExcludeShops?: (shopIds: string[]) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const section = query.section;
  // Primitive UI state only: the boundary itself lives in the section payload.
  const [showPartial, setShowPartial] = useState(false);

  const body = (() => {
    if (!section) return <AffiliateSectionState loading={query.loading} error={query.error} onRetry={query.retry} />;

    const coverage = section.coverage;
    const boundary = coverage.fullCoverageFrom ?? null;
    const allRows = buildCohortUnitsRows(section.cohorts);
    const partialDays = countPartialDays(allRows.map((row) => row.cohortDs), boundary);
    const cohortRows = applyCoverageWindow(allRows, (row) => row.cohortDs, boundary, showPartial);
    const basis = coverageBasis(coverage);
    const basisNote = t("ecommerce.affiliateAnalytics.coverage.metricBasis", {
      shops: formatNumber(basis.shopsWithData, locale),
      selected: formatNumber(basis.shopsSelected, locale),
      date: basis.fullCoverageFrom
        ? formatCohortDay(basis.fullCoverageFrom, locale)
        : t("ecommerce.affiliateAnalytics.coverage.noDate"),
    });

    const immatureCohorts = countImmatureCohorts(cohortRows);
    const unitsDomain = countAxisDomain(cohortRows.map((row) => row.actualUnits + row.projectedRemainingUnits));
    // The bar analogue of a dashed line: a partial-range cohort keeps its real
    // height but is drawn faint, so it is never read as comparable.
    const coverageCells = cohortRows.map((row) => (
      <Cell key={row.cohortDs} fillOpacity={isFullyCoveredDay(row.cohortDs, boundary) ? 1 : PARTIAL_BAR_OPACITY} />
    ));
    const maturationDomain = rateAxisDomain(section.maturationCurve.map((point) => point.cumulativeShare), 1);

    return (
      <>
        <div className="affiliate-metric-strip">
          <AffiliateMetric
            label={t("ecommerce.affiliateAnalytics.postApproval.approvedApplications")}
            value={formatNumber(section.approvedApplications, locale)}
          />
          <AffiliateMetric
            label={t("ecommerce.affiliateAnalytics.postApproval.orderRate")}
            value={formatPercent(section.orderRate, locale)}
            hint={t("ecommerce.affiliateAnalytics.postApproval.orderRateHint", {
              count: section.applicationsWithOrder,
            })}
            basis={basisNote}
          />
          <AffiliateMetric
            label={t("ecommerce.affiliateAnalytics.postApproval.actualUnits")}
            value={formatNumber(section.actualUnits, locale)}
            hint={t("ecommerce.affiliateAnalytics.postApproval.unitsPerApprovedActual", {
              value: formatRatio(section.unitsPerApprovedActual, locale),
            })}
          />
          <AffiliateMetric
            label={t("ecommerce.affiliateAnalytics.postApproval.projectedUnits")}
            value={formatNumber(section.projectedUnits, locale)}
            hint={t("ecommerce.affiliateAnalytics.postApproval.unitsPerApprovedProjected", {
              value: formatRatio(section.unitsPerApprovedProjected, locale),
            })}
            tone="projection"
          />
        </div>

        <AffiliateCoverageNotice
          coverage={coverage}
          partialDays={partialDays}
          showPartial={showPartial}
          onShowPartialChange={setShowPartial}
          onExcludeShops={onExcludeShops}
        />

        <div className="affiliate-chart-grid">
          <AffiliateChartCard
            title={t("ecommerce.affiliateAnalytics.postApproval.cohortsTitle")}
            note={t("ecommerce.affiliateAnalytics.postApproval.cohortsNote", { count: immatureCohorts })}
            band={<AffiliateCoverageBand coverage={coverage} />}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cohortRows}>
                <CartesianGrid strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="cohortDs" minTickGap={26} tickFormatter={(value) => formatCohortDay(String(value), locale)} />
                <YAxis domain={unitsDomain} tickFormatter={(value) => formatNumber(Number(value), locale, true)} />
                <Tooltip
                  labelFormatter={(value) => formatCohortDay(String(value), locale)}
                  formatter={(value, name) => [formatNumber(Number(value), locale), String(name)]}
                />
                <Legend />
                <Bar
                  dataKey="actualUnits"
                  stackId="units"
                  name={t("ecommerce.affiliateAnalytics.postApproval.actualUnitsSeries")}
                  fill="var(--affiliate-units)"
                >
                  {coverageCells}
                </Bar>
                <Bar
                  dataKey="projectedRemainingUnits"
                  stackId="units"
                  name={t("ecommerce.affiliateAnalytics.postApproval.projectedUnitsSeries")}
                  fill="var(--affiliate-projection)"
                >
                  {coverageCells}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </AffiliateChartCard>

          <AffiliateChartCard
            title={t("ecommerce.affiliateAnalytics.postApproval.maturationTitle")}
            note={t("ecommerce.affiliateAnalytics.postApproval.maturationNote")}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={section.maturationCurve}>
                <CartesianGrid strokeDasharray="3 6" vertical={false} />
                <XAxis
                  dataKey="lagDays"
                  tickFormatter={(value) => t("ecommerce.affiliateAnalytics.postApproval.lagDay", { count: Number(value) })}
                />
                <YAxis domain={maturationDomain} tickFormatter={(value) => formatPercent(Number(value), locale)} />
                <Tooltip
                  labelFormatter={(value) => t("ecommerce.affiliateAnalytics.postApproval.lagDay", { count: Number(value) })}
                  formatter={(value, _name, item) => [
                    formatPercent(Number(value), locale),
                    t("ecommerce.affiliateAnalytics.postApproval.basisCohorts", {
                      count: Number((item?.payload as { basisCohorts?: number } | undefined)?.basisCohorts ?? 0),
                    }),
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeShare"
                  name={t("ecommerce.affiliateAnalytics.postApproval.maturationSeries")}
                  stroke="var(--affiliate-units)"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </AffiliateChartCard>
        </div>
      </>
    );
  })();

  return (
    <section className="affiliate-section" data-tutorial-id="affiliate-analytics-post-approval">
      <AffiliateSectionHeader
        index="3"
        title={t("ecommerce.affiliateAnalytics.postApproval.title")}
        axis={t("ecommerce.affiliateAnalytics.postApproval.axis")}
      />
      {body}
    </section>
  );
}
