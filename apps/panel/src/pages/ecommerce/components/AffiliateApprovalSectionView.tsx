import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCohortDay, formatNumber, formatPercent } from "../affiliate-analytics-format.js";
import {
  applyCoverageWindow,
  countAxisDomain,
  countPartialDays,
  coverageBasis,
  coverageBoundaryMark,
  isFullyCoveredDay,
} from "../affiliate-overview.js";
import type { AffiliateSectionQuery } from "../affiliate-overview-types.js";
import { AffiliateCoverageBand, AffiliateCoverageNotice } from "./AffiliateCoverageBand.js";
import { AffiliateChartCard, AffiliateMetric, AffiliateSectionHeader, AffiliateSectionState } from "./AffiliateOverviewParts.js";

/** How solid a bar in the partial range is drawn, relative to a covered one. */
const PARTIAL_BAR_OPACITY = 0.35;

const OUTCOME_SERIES = [
  { key: "approved", labelKey: "approved", fill: "var(--affiliate-approved)" },
  { key: "merchantRejected", labelKey: "merchantRejected", fill: "var(--affiliate-rejected)" },
  { key: "overdueByUs", labelKey: "overdueByUs", fill: "var(--affiliate-overdue)" },
  { key: "inFlight", labelKey: "inFlight", fill: "var(--affiliate-inflight)" },
] as const;

const DECISION_ORIGINS = ["AI", "NOT_AI"] as const;

/**
 * Section 2 — Approval. Cohort axis: the application submission date, so an
 * outcome is always counted back against the day the Creator applied.
 */
export function AffiliateApprovalSectionView({ query, onExcludeShops }: {
  query: AffiliateSectionQuery<GQL.AffiliateApprovalSection>;
  onExcludeShops?: (shopIds: string[]) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const section = query.section;
  // Primitive UI state only: the boundary itself lives in the section payload.
  // Defaults to false: the full range is the default view, and narrowing to
  // the fully-covered range is the reader's explicit choice.
  const [restrictToCovered, setRestrictToCovered] = useState(false);

  const body = (() => {
    if (!section) return <AffiliateSectionState loading={query.loading} error={query.error} onRetry={query.retry} />;

    const coverage = section.coverage;
    const boundary = coverage.fullCoverageFrom ?? null;
    const partialDays = countPartialDays(section.daily.map((point) => point.cohortDs), boundary);
    const dailyRows = applyCoverageWindow(section.daily, (point) => point.cohortDs, boundary, restrictToCovered);
    const originDailyRows = applyCoverageWindow(
      section.dailyByDecisionOrigin,
      (point) => point.cohortDs,
      boundary,
      restrictToCovered,
    );
    const boundaryOnChart = coverageBoundaryMark(dailyRows.map((point) => point.cohortDs), boundary);
    const basis = coverageBasis(coverage);
    const basisNote = t("ecommerce.affiliateAnalytics.coverage.metricBasis", {
      shops: formatNumber(basis.shopsWithData, locale),
      selected: formatNumber(basis.shopsSelected, locale),
      date: basis.fullCoverageFrom
        ? formatCohortDay(basis.fullCoverageFrom, locale)
        : t("ecommerce.affiliateAnalytics.coverage.noDate"),
    });

    const dailyDomain = countAxisDomain(originDailyRows.map((point) => point.applications));
    const ageDomain = countAxisDomain(section.byAgeAndDecisionOrigin.map((point) => point.applications));

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
            basis={basisNote}
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

        <div className="affiliate-origin-disclosure">
          <strong>{t("ecommerce.affiliateAnalytics.decisionOrigin.title")}</strong>
          <span>{t("ecommerce.affiliateAnalytics.decisionOrigin.notAiDisclosure")}</span>
        </div>

        <div className="affiliate-origin-matrix" role="table" aria-label={t("ecommerce.affiliateAnalytics.decisionOrigin.title")}>
          <div className="affiliate-origin-matrix-head" role="row">
            <span role="columnheader">{t("ecommerce.affiliateAnalytics.decisionOrigin.metric")}</span>
            {section.byDecisionOrigin.map((row) => (
              <strong key={row.decidedBy} role="columnheader">
                {t(`ecommerce.affiliateAnalytics.decisionOrigin.${row.decidedBy}`)}
              </strong>
            ))}
          </div>
          {[
            ["applications", "applications"],
            ["approved", "approved"],
            ["merchantRejected", "merchantRejected"],
            ["overdueByUs", "overdueByUs"],
            ["inFlight", "inFlight"],
          ].map(([key, label]) => (
            <div key={key} role="row">
              <span role="rowheader">{t(`ecommerce.affiliateAnalytics.approval.${label}`)}</span>
              {section.byDecisionOrigin.map((row) => (
                <b key={row.decidedBy} role="cell">{formatNumber(row[key as keyof typeof row] as number, locale)}</b>
              ))}
            </div>
          ))}
          <div role="row">
            <span role="rowheader">{t("ecommerce.affiliateAnalytics.approval.approvalRate")}</span>
            {section.byDecisionOrigin.map((row) => (
              <b key={row.decidedBy} role="cell">{formatPercent(row.approvalRate, locale)}</b>
            ))}
          </div>
        </div>

        <AffiliateCoverageNotice
          coverage={coverage}
          partialDays={partialDays}
          restrictToCovered={restrictToCovered}
          onRestrictToCoveredChange={setRestrictToCovered}
          onExcludeShops={onExcludeShops}
        />

        <div className="affiliate-chart-grid">
          <AffiliateChartCard
            title={t("ecommerce.affiliateAnalytics.approval.dailyTitle")}
            note={t("ecommerce.affiliateAnalytics.approval.originDailyNote")}
            band={<AffiliateCoverageBand coverage={coverage} />}
          >
            <div className="affiliate-origin-small-multiples">
              {DECISION_ORIGINS.map((origin) => {
                const rows = originDailyRows.filter((point) => point.decidedBy === origin);
                return <div key={origin} className={`affiliate-origin-chart is-${origin.toLowerCase().replace("_", "-")}`}>
                  <h4>{t(`ecommerce.affiliateAnalytics.decisionOrigin.${origin}`)}</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rows}>
                      <CartesianGrid strokeDasharray="3 6" vertical={false} />
                      <XAxis dataKey="cohortDs" minTickGap={26} tickFormatter={(value) => formatCohortDay(String(value), locale)} />
                      <YAxis domain={dailyDomain} tickFormatter={(value) => formatNumber(Number(value), locale, true)} />
                      <Tooltip labelFormatter={(value) => formatCohortDay(String(value), locale)} formatter={(value, name) => [formatNumber(Number(value), locale), String(name)]} />
                      {boundaryOnChart && <ReferenceLine x={boundaryOnChart} stroke="var(--affiliate-coverage)" strokeDasharray="4 4" />}
                      {OUTCOME_SERIES.map((series) => <Bar key={series.key} dataKey={series.key} stackId="outcome" name={t(`ecommerce.affiliateAnalytics.approval.${series.labelKey}`)} fill={series.fill}>
                        {rows.map((point) => <Cell key={point.cohortDs} fillOpacity={isFullyCoveredDay(point.cohortDs, boundary) ? 1 : PARTIAL_BAR_OPACITY} />)}
                      </Bar>)}
                    </BarChart>
                  </ResponsiveContainer>
                </div>;
              })}
            </div>
          </AffiliateChartCard>

          <AffiliateChartCard
            title={t("ecommerce.affiliateAnalytics.approval.byAgeTitle")}
            note={t("ecommerce.affiliateAnalytics.approval.originAgeNote")}
          >
            <div className="affiliate-origin-small-multiples">
              {DECISION_ORIGINS.map((origin) => {
                const rows = section.byAgeAndDecisionOrigin.filter((point) => point.decidedBy === origin);
                return <div key={origin} className={`affiliate-origin-chart is-${origin.toLowerCase().replace("_", "-")}`}>
                  <h4>{t(`ecommerce.affiliateAnalytics.decisionOrigin.${origin}`)}</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rows}>
                      <CartesianGrid strokeDasharray="3 6" vertical={false} />
                      <XAxis dataKey="ageBucket" />
                      <YAxis domain={ageDomain} tickFormatter={(value) => formatNumber(Number(value), locale, true)} />
                      <Tooltip formatter={(value, name) => [formatNumber(Number(value), locale), String(name)]} />
                      {OUTCOME_SERIES.map((series) => <Bar key={series.key} dataKey={series.key} stackId="outcome" name={t(`ecommerce.affiliateAnalytics.approval.${series.labelKey}`)} fill={series.fill} />)}
                    </BarChart>
                  </ResponsiveContainer>
                </div>;
              })}
            </div>
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
