import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCohortDay, formatNumber, formatPercent } from "../affiliate-analytics-format.js";
import {
  AFFILIATE_HORIZON_MIN_COHORT,
  applyCoverageWindow,
  buildInviteDailyRows,
  buildResponseHorizonSeries,
  countAxisDomain,
  countPartialDays,
  coverageBasis,
  coverageBoundaryMark,
  firstImmatureCohortDay,
  rateAxisDomain,
  splitCoverageSeries,
} from "../affiliate-overview.js";
import type { AffiliateReachoutSection, AffiliateSectionQuery } from "../affiliate-overview-types.js";
import { AffiliateCoverageBand, AffiliateCoverageNotice } from "./AffiliateCoverageBand.js";
import { AffiliateChartCard, AffiliateMetric, AffiliateSectionHeader, AffiliateSectionState } from "./AffiliateOverviewParts.js";

/** Partial-range series are drawn with this dash so they cannot read as a trend. */
const PARTIAL_DASH = "4 4";

/** How solid a bar in the partial range is drawn, relative to a covered one. */
const PARTIAL_BAR_OPACITY = 0.35;

/**
 * Section 1 — Reachout. Cohort axis: the real platform invitation date
 * (`start_at`, 100% coverage), never the day a response happened to land.
 */
export function AffiliateReachoutSectionView({ query, onExcludeShops }: {
  query: AffiliateSectionQuery<AffiliateReachoutSection>;
  onExcludeShops?: (shopIds: string[]) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const section = query.section;
  // Primitive UI state only: the boundary itself lives in the section payload.
  // Defaults to false — the full range is the default view, and narrowing to
  // the fully-covered range is the reader's explicit choice.
  const [restrictToCovered, setRestrictToCovered] = useState(false);

  const body = (() => {
    if (!section) return <AffiliateSectionState loading={query.loading} error={query.error} onRetry={query.retry} />;

    const coverage = section.coverage;
    const boundary = coverage.fullCoverageFrom ?? null;
    const allRows = buildInviteDailyRows(section.daily);
    const partialDays = countPartialDays(allRows.map((row) => row.inviteDs), boundary);
    const windowRows = applyCoverageWindow(allRows, (row) => row.inviteDs, boundary, restrictToCovered);
    const dailyRows = splitCoverageSeries(windowRows, (row) => row.inviteDs, (row) => row.responseRate, boundary);
    const basis = coverageBasis(coverage);

    const horizonSeries = buildResponseHorizonSeries(section);
    const rateDomain = rateAxisDomain(horizonSeries.points.map((point) => point.responseRate));
    const inviteDomain = countAxisDomain(dailyRows.map((row) => row.invitations));
    const dailyRateDomain = rateAxisDomain(dailyRows.map((row) => row.responseRate));
    const firstImmatureDay = firstImmatureCohortDay(windowRows);
    const immatureDays = windowRows.filter((row) => !row.mature).length;
    const boundaryOnChart = coverageBoundaryMark(windowRows.map((row) => row.inviteDs), boundary);
    /*
     * The horizon curve and the daily bars describe DIFFERENT date ranges, and
     * the note has to say so. The curve is computed over one fixed cohort — the
     * invitations old enough for the 30d horizon — which necessarily stops
     * ~30 days before the bars beside it do. Leaving the reader to infer that
     * is how two honest charts become one misleading comparison.
     */
    const horizonNote = horizonSeries.cohortTooSmall
      ? t("ecommerce.affiliateAnalytics.reachout.cohortTooSmallNote")
      : [
        t("ecommerce.affiliateAnalytics.reachout.horizonNote", {
          count: horizonSeries.cohortSize,
        }),
        section.horizonCohortFrom && section.horizonCohortTo
          ? t("ecommerce.affiliateAnalytics.reachout.horizonCohortRange", {
            from: formatCohortDay(section.horizonCohortFrom, locale),
            to: formatCohortDay(section.horizonCohortTo, locale),
          })
          : null,
        horizonSeries.subDaySuppressed
          ? t("ecommerce.affiliateAnalytics.reachout.subDaySuppressed", {
            share: formatPercent(horizonSeries.exactShare, locale),
          })
          : null,
      ].filter(Boolean).join(" ");
    const basisNote = t("ecommerce.affiliateAnalytics.coverage.metricBasis", {
      shops: formatNumber(basis.shopsWithData, locale),
      selected: formatNumber(basis.shopsSelected, locale),
      date: basis.fullCoverageFrom
        ? formatCohortDay(basis.fullCoverageFrom, locale)
        : t("ecommerce.affiliateAnalytics.coverage.noDate"),
    });

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
            basis={basisNote}
          />
          <AffiliateMetric
            label={t("ecommerce.affiliateAnalytics.reachout.immatureShare")}
            value={formatPercent(section.immatureShare, locale)}
            hint={t("ecommerce.affiliateAnalytics.reachout.immatureShareHint")}
            tone="warning"
          />
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
            title={t("ecommerce.affiliateAnalytics.reachout.horizonTitle")}
            note={horizonNote}
          >
            {horizonSeries.cohortTooSmall ? (
              <p className="affiliate-chart-suppressed">
                {t("ecommerce.affiliateAnalytics.reachout.cohortTooSmall", {
                  count: horizonSeries.cohortSize,
                  minimum: formatNumber(AFFILIATE_HORIZON_MIN_COHORT, locale),
                })}
              </p>
            ) : (
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
            )}
          </AffiliateChartCard>

          <AffiliateChartCard
            title={t("ecommerce.affiliateAnalytics.reachout.dailyTitle")}
            note={t("ecommerce.affiliateAnalytics.reachout.dailyNote", { count: immatureDays })}
            band={<AffiliateCoverageBand coverage={coverage} reserveRightGutter />}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyRows}>
                <CartesianGrid strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="inviteDs" minTickGap={26} tickFormatter={(value) => formatCohortDay(String(value), locale)} />
                <YAxis yAxisId="invites" domain={inviteDomain} tickFormatter={(value) => formatNumber(Number(value), locale, true)} />
                <YAxis
                  yAxisId="rate"
                  orientation="right"
                  domain={dailyRateDomain}
                  tickFormatter={(value) => formatPercent(Number(value), locale)}
                />
                <Tooltip
                  labelFormatter={(value) => formatCohortDay(String(value), locale)}
                  formatter={(value, name, item) => (
                    (item?.dataKey === "coveredValue" || item?.dataKey === "partialValue")
                      ? [formatPercent(Number(value), locale), String(name)]
                      : [formatNumber(Number(value), locale), String(name)]
                  )}
                />
                <Legend />
                {/*
                  The boundary is marked, not enforced. Days to its left are
                  real and are drawn; they were simply measured over fewer
                  shops, which the faint bars, the dashed rate line and this
                  line together say without deleting anything.
                */}
                {boundaryOnChart && (
                  <ReferenceLine
                    yAxisId="invites"
                    x={boundaryOnChart}
                    stroke="var(--affiliate-coverage)"
                    strokeDasharray={PARTIAL_DASH}
                    label={{
                      value: t("ecommerce.affiliateAnalytics.coverage.boundaryMark"),
                      position: "insideTopLeft",
                      fontSize: 11,
                    }}
                  />
                )}
                {firstImmatureDay && (
                  <ReferenceArea
                    yAxisId="invites"
                    x1={firstImmatureDay}
                    x2={dailyRows[dailyRows.length - 1]?.inviteDs}
                    fill="var(--affiliate-immature)"
                    fillOpacity={0.28}
                    label={{ value: t("ecommerce.affiliateAnalytics.reachout.immatureBand"), position: "insideTop", fontSize: 11 }}
                  />
                )}
                <Bar
                  yAxisId="invites"
                  dataKey="invitations"
                  name={t("ecommerce.affiliateAnalytics.reachout.inviteSeries")}
                  fill="var(--affiliate-reachout)"
                >
                  {dailyRows.map((row) => (
                    <Cell key={row.inviteDs} fillOpacity={row.covered ? 1 : PARTIAL_BAR_OPACITY} />
                  ))}
                </Bar>
                <Line
                  yAxisId="rate"
                  type="monotone"
                  dataKey="coveredValue"
                  name={t("ecommerce.affiliateAnalytics.reachout.responseRateSeries")}
                  stroke="var(--affiliate-response)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  yAxisId="rate"
                  type="monotone"
                  dataKey="partialValue"
                  name={t("ecommerce.affiliateAnalytics.coverage.partialSeries")}
                  stroke="var(--affiliate-response)"
                  strokeDasharray={PARTIAL_DASH}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  legendType="none"
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
