import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCohortDay, formatNumber, formatPercent, formatRatio } from "../affiliate-analytics-format.js";
import {
  AFFILIATE_SHIPMENT_TRAILING_DAYS,
  applyCoverageWindow,
  buildShipmentDailyRows,
  countAxisDomain,
  countPartialDays,
  coverageBasis,
  coverageBoundaryMark,
  rateAxisDomain,
  splitCoverageSeries,
} from "../affiliate-overview.js";
import type { AffiliateSectionQuery, AffiliateWindowDays } from "../affiliate-overview-types.js";
import { AffiliateCoverageBand, AffiliateCoverageNotice } from "./AffiliateCoverageBand.js";
import { AffiliateChartCard, AffiliateMetric, AffiliateSectionHeader, AffiliateSectionState } from "./AffiliateOverviewParts.js";

/** Partial-range series are drawn with this dash so they cannot read as a trend. */
const PARTIAL_DASH = "4 4";

/** How solid a bar in the partial range is drawn, relative to a covered one. */
const PARTIAL_BAR_OPACITY = 0.35;

/**
 * Section 3 — Post-approval performance.
 *
 * Two bases live here, and the section states which is which rather than
 * blending them:
 *
 *  - the approval basis counts what happened to the applications we approved
 *    inside the window, on the application date;
 *  - the shipment basis is a same-day comparison — we shipped N free samples on
 *    day D and the affiliate channel sold M units on day D — with the trailing
 *    7-day ratio of those two counts drawn beside them.
 *
 * There is no cohorting, no lag model, and no estimate of any kind on this
 * section: every figure is a count the producer observed, or a ratio of two.
 * GMV is likewise absent — order-line GMV is 98.2% missing at 0–7 days old and
 * keeps a ~17% permanent hole, while units are never missing.
 */
export function AffiliatePostApprovalSectionView({ query, windowDays, onExcludeShops }: {
  query: AffiliateSectionQuery<GQL.AffiliatePostApprovalSection>;
  /**
   * The window this section actually asked for. It is pinned rather than taken
   * from the page control, so the section states it — a number sitting under a
   * 30/60/90 control otherwise reads as though it followed it.
   */
  windowDays: AffiliateWindowDays;
  onExcludeShops?: (shopIds: string[]) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const section = query.section;
  // Defaults to false: the full range is the default view, and narrowing to
  // the fully-covered range is the reader's explicit choice.
  const [restrictToCovered, setRestrictToCovered] = useState(false);

  const body = (() => {
    if (!section) return <AffiliateSectionState loading={query.loading} error={query.error} onRetry={query.retry} />;

    /*
     * The chart sits on the shipment basis, so the boundary it is drawn against
     * is the SHIPMENT one. Ship date is our own observation rather than a
     * platform fact, so it begins later than application coverage and no
     * earlier day can ever gain one — which is exactly why the two coverage
     * objects are reported separately below instead of collapsed into one.
     */
    const coverage = section.coverage;
    const shipmentCoverage = section.shipmentCoverage;
    const shipmentBoundary = shipmentCoverage.fullCoverageFrom ?? null;

    // The trailing window is summed over the WHOLE series the producer sent, so
    // narrowing the view afterwards hides days without silently rebasing the
    // ratio drawn on the days that remain.
    const allRows = buildShipmentDailyRows(section.daily);
    const partialDays = countPartialDays(allRows.map((row) => row.ds), shipmentBoundary);
    const windowRows = applyCoverageWindow(allRows, (row) => row.ds, shipmentBoundary, restrictToCovered);
    const dailyRows = splitCoverageSeries(
      windowRows,
      (row) => row.ds,
      (row) => row.trailingUnitsPerSample,
      shipmentBoundary,
    );
    const boundaryOnChart = coverageBoundaryMark(windowRows.map((row) => row.ds), shipmentBoundary);
    const countsDomain = countAxisDomain(
      dailyRows.flatMap((row) => [row.samplesShipped, row.affiliateUnits]),
    );
    const ratioDomain = rateAxisDomain(dailyRows.map((row) => row.trailingUnitsPerSample));
    const activityByDay = new Map<string, {
      ds: string; aiOrders: number; notAiOrders: number; aiUnits: number; notAiUnits: number;
    }>();
    for (const point of section.sampleActivityDailyByDecisionOrigin) {
      const row = activityByDay.get(point.ds) ?? {
        ds: point.ds, aiOrders: 0, notAiOrders: 0, aiUnits: 0, notAiUnits: 0,
      };
      if (point.decidedBy === "AI") {
        row.aiOrders += point.orders;
        row.aiUnits += point.units;
      } else {
        row.notAiOrders += point.orders;
        row.notAiUnits += point.units;
      }
      activityByDay.set(point.ds, row);
    }
    const activityRows = [...activityByDay.values()].sort((left, right) => left.ds.localeCompare(right.ds));
    const activityDomain = countAxisDomain(activityRows.flatMap((row) => [
      row.aiOrders, row.notAiOrders, row.aiUnits, row.notAiUnits,
    ]));

    const basis = coverageBasis(coverage);
    const shipmentBasis = coverageBasis(shipmentCoverage);
    const basisNote = (source: typeof basis) => t("ecommerce.affiliateAnalytics.coverage.metricBasis", {
      shops: formatNumber(source.shopsWithData, locale),
      selected: formatNumber(source.shopsSelected, locale),
      date: source.fullCoverageFrom
        ? formatCohortDay(source.fullCoverageFrom, locale)
        : t("ecommerce.affiliateAnalytics.coverage.noDate"),
    });

    return (
      <>
        <p className="affiliate-section-window-note">
          {t("ecommerce.affiliateAnalytics.postApproval.twoBases", {
            applicationDate: basis.fullCoverageFrom
              ? formatCohortDay(basis.fullCoverageFrom, locale)
              : t("ecommerce.affiliateAnalytics.coverage.noDate"),
            shipmentDate: shipmentBasis.fullCoverageFrom
              ? formatCohortDay(shipmentBasis.fullCoverageFrom, locale)
              : t("ecommerce.affiliateAnalytics.coverage.noDate"),
          })}
        </p>

        <div className="affiliate-metric-group">
          <h3>{t("ecommerce.affiliateAnalytics.postApproval.approvalBasisTitle")}</h3>
          <div className="affiliate-metric-strip">
            <AffiliateMetric
              label={t("ecommerce.affiliateAnalytics.postApproval.approvedApplications")}
              value={formatNumber(section.approvedApplications, locale)}
            />
            <AffiliateMetric
              label={t("ecommerce.affiliateAnalytics.postApproval.applicationsWithOrder")}
              value={formatNumber(section.applicationsWithOrder, locale)}
            />
            <AffiliateMetric
              label={t("ecommerce.affiliateAnalytics.postApproval.orderRate")}
              value={formatPercent(section.orderRate, locale)}
              hint={t("ecommerce.affiliateAnalytics.postApproval.orderRateHint", {
                count: section.applicationsWithOrder,
              })}
              basis={basisNote(basis)}
            />
            <AffiliateMetric
              label={t("ecommerce.affiliateAnalytics.postApproval.actualUnits")}
              value={formatNumber(section.actualUnits, locale)}
              hint={t("ecommerce.affiliateAnalytics.postApproval.unitsPerApprovedActual", {
                value: formatRatio(section.unitsPerApprovedActual, locale),
              })}
            />
          </div>
        </div>

        <div className="affiliate-origin-disclosure">
          <strong>{t("ecommerce.affiliateAnalytics.decisionOrigin.postApprovalTitle")}</strong>
          <span>{t("ecommerce.affiliateAnalytics.decisionOrigin.activityDisclosure")}</span>
        </div>

        {/* Design-system exception: this is a variable-axis analytics matrix, not a record table. Affiliate Analytics owns its complete ARIA grid. */}
        <div className="affiliate-origin-matrix affiliate-origin-post-matrix" role="table" data-tk-table-exception="analytics-matrix" aria-label={t("ecommerce.affiliateAnalytics.decisionOrigin.postApprovalTitle")}>
          <div className="affiliate-origin-matrix-head" role="row">
            <span role="columnheader">{t("ecommerce.affiliateAnalytics.decisionOrigin.metric")}</span>
            {section.byDecisionOrigin.map((row) => <strong key={row.decidedBy} role="columnheader">{t(`ecommerce.affiliateAnalytics.decisionOrigin.${row.decidedBy}`)}</strong>)}
          </div>
          {[
            ["approvedApplications", "approvedApplications", "number"],
            ["applicationsWithOrder", "applicationsWithOrder", "number"],
            ["orderRate", "orderRate", "percent"],
            ["actualUnits", "actualUnits", "number"],
          ].map(([key, label, format]) => <div key={key} role="row">
            <span role="rowheader">{t(`ecommerce.affiliateAnalytics.postApproval.${label}`)}</span>
            {section.byDecisionOrigin.map((row) => <b key={row.decidedBy} role="cell">
              {format === "percent"
                ? formatPercent(row[key as keyof typeof row] as number | null, locale)
                : formatNumber(row[key as keyof typeof row] as number, locale)}
            </b>)}
          </div>)}
        </div>

        <AffiliateChartCard
          title={t("ecommerce.affiliateAnalytics.postApproval.originActivityTitle")}
          note={t("ecommerce.affiliateAnalytics.postApproval.originActivityNote")}
          height="tall"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={activityRows}>
              <CartesianGrid strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="ds" minTickGap={26} tickFormatter={(value) => formatCohortDay(String(value), locale)} />
              <YAxis domain={activityDomain} tickFormatter={(value) => formatNumber(Number(value), locale, true)} />
              <Tooltip labelFormatter={(value) => formatCohortDay(String(value), locale)} formatter={(value, name) => [formatNumber(Number(value), locale), String(name)]} />
              <Legend />
              <Bar dataKey="aiOrders" name={t("ecommerce.affiliateAnalytics.postApproval.aiOrdersSeries")} fill="var(--affiliate-sample)" />
              <Bar dataKey="notAiOrders" name={t("ecommerce.affiliateAnalytics.postApproval.notAiOrdersSeries")} fill="var(--affiliate-not-ai)" />
              <Line type="monotone" dataKey="aiUnits" name={t("ecommerce.affiliateAnalytics.postApproval.aiUnitsSeries")} stroke="var(--affiliate-sample-dark)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="notAiUnits" name={t("ecommerce.affiliateAnalytics.postApproval.notAiUnitsSeries")} stroke="var(--affiliate-not-ai-dark)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </AffiliateChartCard>

        <div className="affiliate-metric-group">
          <h3>{t("ecommerce.affiliateAnalytics.postApproval.shipmentBasisTitle")}</h3>
          <div className="affiliate-metric-strip">
            <AffiliateMetric
              label={t("ecommerce.affiliateAnalytics.postApproval.samplesShipped")}
              value={formatNumber(section.samplesShipped, locale)}
            />
            <AffiliateMetric
              label={t("ecommerce.affiliateAnalytics.postApproval.affiliateUnits")}
              value={formatNumber(section.affiliateUnits, locale)}
            />
            <AffiliateMetric
              label={t("ecommerce.affiliateAnalytics.postApproval.unitsPerSampleShipped")}
              value={formatRatio(section.unitsPerSampleShipped, locale)}
              hint={t("ecommerce.affiliateAnalytics.postApproval.unitsPerSampleShippedHint")}
              basis={basisNote(shipmentBasis)}
            />
            <AffiliateMetric
              label={t("ecommerce.affiliateAnalytics.postApproval.shipmentBoundary")}
              value={shipmentBoundary
                ? formatCohortDay(shipmentBoundary, locale)
                : t("ecommerce.affiliateAnalytics.coverage.noDate")}
              hint={t("ecommerce.affiliateAnalytics.postApproval.shipmentBoundaryHint")}
              tone="muted"
            />
          </div>
        </div>

        <AffiliateCoverageNotice
          coverage={shipmentCoverage}
          partialDays={partialDays}
          restrictToCovered={restrictToCovered}
          onRestrictToCoveredChange={setRestrictToCovered}
          onExcludeShops={onExcludeShops}
        />

        <AffiliateChartCard
          title={t("ecommerce.affiliateAnalytics.postApproval.shipmentTitle")}
          note={t("ecommerce.affiliateAnalytics.postApproval.shipmentNote", {
            count: AFFILIATE_SHIPMENT_TRAILING_DAYS,
          })}
          band={<AffiliateCoverageBand coverage={shipmentCoverage} reserveRightGutter />}
          height="tall"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dailyRows}>
              <CartesianGrid strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="ds" minTickGap={26} tickFormatter={(value) => formatCohortDay(String(value), locale)} />
              <YAxis
                yAxisId="counts"
                domain={countsDomain}
                tickFormatter={(value) => formatNumber(Number(value), locale, true)}
              />
              <YAxis
                yAxisId="ratio"
                orientation="right"
                domain={ratioDomain}
                tickFormatter={(value) => formatRatio(Number(value), locale)}
              />
              <Tooltip
                labelFormatter={(value) => formatCohortDay(String(value), locale)}
                formatter={(value, name, item) => (
                  (item?.dataKey === "coveredValue" || item?.dataKey === "partialValue")
                    ? [formatRatio(Number(value), locale), String(name)]
                    : [formatNumber(Number(value), locale), String(name)]
                )}
              />
              <Legend />
              {/*
                The boundary is marked, never used to drop days. A day to its
                left with zero samples and real units is honest: shipment
                observation had not begun, and the band beneath says so.
              */}
              {boundaryOnChart && (
                <ReferenceLine
                  yAxisId="counts"
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
              <Bar
                yAxisId="counts"
                dataKey="samplesShipped"
                name={t("ecommerce.affiliateAnalytics.postApproval.samplesShippedSeries")}
                fill="var(--affiliate-sample)"
              >
                {dailyRows.map((row) => (
                  <Cell key={row.ds} fillOpacity={row.covered ? 1 : PARTIAL_BAR_OPACITY} />
                ))}
              </Bar>
              <Bar
                yAxisId="counts"
                dataKey="affiliateUnits"
                name={t("ecommerce.affiliateAnalytics.postApproval.affiliateUnitsSeries")}
                fill="var(--affiliate-units)"
              >
                {dailyRows.map((row) => (
                  <Cell key={row.ds} fillOpacity={row.covered ? 1 : PARTIAL_BAR_OPACITY} />
                ))}
              </Bar>
              <Line
                yAxisId="ratio"
                type="monotone"
                dataKey="coveredValue"
                name={t("ecommerce.affiliateAnalytics.postApproval.trailingRatioSeries", {
                  count: AFFILIATE_SHIPMENT_TRAILING_DAYS,
                })}
                stroke="var(--affiliate-response)"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
              <Line
                yAxisId="ratio"
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
      <p className="affiliate-section-window-note">
        {t("ecommerce.affiliateAnalytics.postApproval.pinnedWindow", { count: windowDays })}
      </p>
      {body}
    </section>
  );
}
