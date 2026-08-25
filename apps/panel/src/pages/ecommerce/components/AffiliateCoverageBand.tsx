import { useTranslation } from "react-i18next";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GQL } from "@rivonclaw/core";
import { formatCohortDay, formatNumber } from "../affiliate-analytics-format.js";
import { buildCoverageBandRows, coverageShopLabel } from "../affiliate-overview.js";

/**
 * Recharts' default `YAxis` width. The band is a separate chart from the one it
 * sits under, so it only lines up with that chart's x-axis if it reserves the
 * same axis gutters. Reserving them with an invisible axis rather than with CSS
 * padding keeps the two plot areas identical even when the parent's tick labels
 * change width.
 */
const AXIS_GUTTER = 60;

/**
 * The data-coverage strip: how many of the selected shops had started producing
 * data on each day of the section's own series.
 *
 * It is deliberately a staircase and not a percentage. The question it answers
 * is "was this day measured over the same shops as that day?", and a step is
 * the only shape that makes an answer of "no" impossible to miss. It renders
 * for the WHOLE series span even when the series above it is truncated at the
 * boundary, so the reader can see that earlier data exists and is merely
 * partial rather than absent.
 */
export function AffiliateCoverageBand({ coverage, reserveRightGutter = false }: {
  coverage: GQL.AffiliateCoverage;
  /** Set on charts that carry a right-hand axis, so both gutters match. */
  reserveRightGutter?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const rows = buildCoverageBandRows(coverage);
  if (rows.length === 0) return null;

  return (
    <div className="affiliate-coverage-band">
      <div className="affiliate-coverage-band-plot">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows}>
            <XAxis dataKey="ds" hide />
            <YAxis
              yAxisId="shops"
              width={AXIS_GUTTER}
              domain={[0, Math.max(coverage.shopsSelected, 1)]}
              tick={false}
              axisLine={false}
              tickLine={false}
            />
            {reserveRightGutter ? (
              <YAxis
                yAxisId="gutter"
                orientation="right"
                width={AXIS_GUTTER}
                tick={false}
                axisLine={false}
                tickLine={false}
              />
            ) : null}
            <Tooltip
              labelFormatter={(value) => formatCohortDay(String(value), i18n.language)}
              formatter={(value) => [
                t("ecommerce.affiliateAnalytics.coverage.bandTooltip", {
                  withData: Number(value),
                  selected: coverage.shopsSelected,
                }),
                t("ecommerce.affiliateAnalytics.coverage.bandSeries"),
              ]}
            />
            <Area
              yAxisId="shops"
              type="stepAfter"
              dataKey="shopsWithData"
              name={t("ecommerce.affiliateAnalytics.coverage.bandSeries")}
              stroke="var(--affiliate-coverage)"
              strokeWidth={1}
              fill="var(--affiliate-coverage)"
              fillOpacity={0.9}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="affiliate-coverage-band-caption">
        {t("ecommerce.affiliateAnalytics.coverage.bandCaption", { count: coverage.shopsSelected })}
      </p>
    </div>
  );
}

/**
 * The section-level statement of the boundary, plus the two ways out of it.
 *
 * Both escape hatches are explicit and reversible, and neither hides what it
 * did: showing the partial range redraws the excluded days as a dashed
 * continuation, and excluding the limiting shops narrows the shop scope for the
 * whole page — which is why those shops are named before the choice is made
 * rather than after.
 */
export function AffiliateCoverageNotice({
  coverage,
  partialDays,
  showPartial,
  onShowPartialChange,
  onExcludeShops,
}: {
  coverage: GQL.AffiliateCoverage;
  /** Days in this section's series that sit before the boundary. */
  partialDays: number;
  showPartial: boolean;
  onShowPartialChange: (next: boolean) => void;
  /** Narrows the page's shop scope. Absent when the page cannot change it. */
  onExcludeShops?: (shopIds: string[]) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const boundary = coverage.fullCoverageFrom ?? null;
  const shopsWithData = coverage.shops.filter((shop) => shop.coverageFrom != null).length;

  if (boundary === null) {
    return (
      <div className="affiliate-coverage-notice is-empty" role="note">
        <strong>{t("ecommerce.affiliateAnalytics.coverage.noneTitle")}</strong>
        <p>{t("ecommerce.affiliateAnalytics.coverage.noneBody", { count: coverage.shopsSelected })}</p>
      </div>
    );
  }

  const limiting = coverage.limitingShops;
  // Excluding every shop that has data would leave nothing to measure, so the
  // action is only offered while at least one covered shop would remain.
  const canExclude = Boolean(onExcludeShops) && limiting.length > 0 && shopsWithData > limiting.length;
  const remaining = coverage.shops
    .filter((shop) => !limiting.some((limit) => limit.shopId === shop.shopId))
    .map((shop) => shop.shopId);

  return (
    <div className="affiliate-coverage-notice" role="note">
      <p className="affiliate-coverage-boundary">
        {t("ecommerce.affiliateAnalytics.coverage.boundary", {
          date: formatCohortDay(boundary, locale),
          shops: formatNumber(shopsWithData, locale),
        })}
      </p>
      {partialDays > 0 ? (
        <p className="affiliate-coverage-partial">
          {t("ecommerce.affiliateAnalytics.coverage.partialDays", { count: partialDays })}
        </p>
      ) : null}
      <div className="affiliate-coverage-actions">
        {partialDays > 0 ? (
          <button
            className="btn btn-secondary"
            type="button"
            aria-pressed={showPartial}
            onClick={() => onShowPartialChange(!showPartial)}
          >
            {showPartial
              ? t("ecommerce.affiliateAnalytics.coverage.hidePartial")
              : t("ecommerce.affiliateAnalytics.coverage.showPartial")}
          </button>
        ) : null}
        {canExclude ? (
          <button className="btn btn-secondary" type="button" onClick={() => onExcludeShops?.(remaining)}>
            {t("ecommerce.affiliateAnalytics.coverage.excludeLimiting", { count: limiting.length })}
          </button>
        ) : null}
      </div>
      {limiting.length > 0 ? (
        <p className="affiliate-coverage-limiting">
          {t("ecommerce.affiliateAnalytics.coverage.limitingShops", {
            shops: limiting.map((shop) => coverageShopLabel(shop)).join(" · "),
          })}
        </p>
      ) : null}
      {showPartial ? (
        <p className="affiliate-coverage-dashed">{t("ecommerce.affiliateAnalytics.coverage.dashedNote")}</p>
      ) : null}
    </div>
  );
}
