import { useMemo, useState } from "react";
import { NetworkStatus } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import type { GQL } from "@rivonclaw/core";
import { useTranslation } from "react-i18next";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ECOMMERCE_GET_SPS_ANALYTICS_QUERY } from "../../api/sps-analytics-query.js";
import { RefreshIcon } from "../../components/icons.js";
import {
  TkPageFrame,
  TkPageHeader,
  TkPanel,
  TkSegmented,
} from "../../components/design-system/index.js";
import { formatLocalizedDateTime, formatLocalizedMonthDay } from "../../lib/format-datetime.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import {
  buildSpsMarketChart,
  buildSpsYAxisDomain,
  displayShopName,
  formatSpsValue,
} from "./sps-analytics.js";
import "./ShopAnalyticsPage.css";

const METRICS: Array<{
  code: GQL.SpsAnalyticsMetricCode;
  shortLabel: string;
}> = [
  { code: "OTDR", shortLabel: "OTDR" },
  { code: "NRR", shortLabel: "NRR" },
  { code: "NBFR", shortLabel: "NBFR" },
  { code: "SFCR", shortLabel: "SFCR" },
  { code: "AHT", shortLabel: "AHT" },
  { code: "IM_DSAT", shortLabel: "IM DSAT" },
];

const SERIES_COLORS = [
  "var(--color-primary)",
  "var(--color-accent-secondary)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-danger)",
  "var(--color-info)",
];

interface ChartTooltipEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: string | number;
}

function SpsChartTooltip({
  active,
  label,
  payload,
  unit,
}: {
  active?: boolean;
  label?: string | number;
  payload?: readonly ChartTooltipEntry[];
  unit?: string | null;
}) {
  const { i18n } = useTranslation();
  if (!active || !payload?.length) return null;
  return (
    <div className="sps-chart-tooltip">
      <strong>{formatChartDate(String(label ?? ""), i18n.language)}</strong>
      {payload.map((entry) => (
        <div key={String(entry.dataKey ?? entry.name)}>
          <span>{entry.name}</span>
          <b>{formatSpsValue(Number(entry.value), unit, i18n.language)}</b>
        </div>
      ))}
    </div>
  );
}

function formatChartDate(value: string, locale: string): string {
  const date = new Date(`${value}T00:00:00`);
  return formatLocalizedMonthDay(date, locale, undefined, value);
}

function formatTimestamp(value: string | null | undefined, locale: string): string {
  return formatLocalizedDateTime(value, locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function marketName(market: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(market) ?? market;
  } catch {
    return market;
  }
}

function scoreTone(value?: number | null): string {
  if (value == null) return "neutral";
  if (value >= 4) return "good";
  if (value >= 3) return "watch";
  return "risk";
}

function ShopDiagnosisCard({ shop }: { shop: GQL.SpsAnalyticsShopView }) {
  const { t, i18n } = useTranslation();
  const available = shop.availability === "AVAILABLE";
  const issueCodes = shop.topIssueCodes.length
    ? shop.topIssueCodes.join(" · ")
    : t("shopAnalytics.shop.noTopIssue");
  const unavailableReason = t(`shopAnalytics.unavailableReasons.${shop.availability}`, {
    defaultValue: shop.unavailableReason || t("shopAnalytics.unavailableReasons.PLATFORM_ERROR"),
  });

  return (
    <article
      className={`sps-shop-card data-card-hover sps-shop-card-${available ? "available" : "unavailable"}`}
    >
      <div className="sps-shop-card-heading">
        <div>
          <h3>{displayShopName(shop)}</h3>
          {shop.shopAlias && <p>{shop.shopName}</p>}
        </div>
        <span
          className={`sps-availability sps-availability-${available ? "available" : "unavailable"}`}
        >
          {t(`shopAnalytics.availability.${shop.availability}`)}
        </span>
      </div>

      {!available ? (
        <p className="sps-unavailable-reason">{unavailableReason}</p>
      ) : (
        <>
          <div className="sps-score-row">
            <div className={`sps-score-orb sps-score-${scoreTone(shop.spsScore)}`}>
              <span>SPS</span>
              <strong>{formatSpsValue(shop.spsScore, undefined, i18n.language)}</strong>
            </div>
            <div className="sps-score-copy">
              <strong>
                {shop.spsTierText || shop.spsTier || t("shopAnalytics.shop.currentTier")}
              </strong>
              <span>
                {shop.peerPercentile == null
                  ? shop.primaryCategoryName || t("shopAnalytics.shop.defaultCategory")
                  : t("shopAnalytics.shop.aheadOfPeers", {
                      percent: shop.peerPercentile.toLocaleString(i18n.language, {
                        maximumFractionDigits: 1,
                      }),
                    })}
              </span>
              <small>
                {t("shopAnalytics.shop.observed", {
                  date: formatTimestamp(shop.observedAt, i18n.language),
                })}
              </small>
            </div>
          </div>

          <div className="sps-metric-strip">
            <div>
              <span>{t("shopAnalytics.shop.metricValue")}</span>
              <strong>
                {formatSpsValue(shop.metricValue, shop.metricValueUnit, i18n.language)}
              </strong>
            </div>
            <div>
              <span>{t("shopAnalytics.shop.metricScore")}</span>
              <strong>{formatSpsValue(shop.metricScore, undefined, i18n.language)}</strong>
            </div>
            <div>
              <span>{t("shopAnalytics.shop.status")}</span>
              <strong>{shop.metricStatusText || shop.metricStatus || "—"}</strong>
            </div>
          </div>

          <div className="sps-issue-block">
            <span>{t("shopAnalytics.shop.topIssues")}</span>
            <strong>{issueCodes}</strong>
            {shop.topIssueSummary && <p>{shop.topIssueSummary}</p>}
          </div>

          {(shop.diagnosisSummaries.length > 0 || shop.diagnosisDetails.length > 0) && (
            <div className="sps-diagnosis-block">
              <span>{t("shopAnalytics.shop.diagnosis")}</span>
              {shop.diagnosisSummaries.map((summary) => (
                <strong key={summary}>{summary}</strong>
              ))}
              {shop.diagnosisDetails.map((detail) => (
                <p key={detail}>{detail}</p>
              ))}
            </div>
          )}

          <details className="sps-method-details">
            <summary>{t("shopAnalytics.shop.method")}</summary>
            <div className="sps-method-grid">
              <div>
                <span>{shop.calculationNumeratorLabel || t("shopAnalytics.shop.numerator")}</span>
                <strong>
                  {formatSpsValue(shop.calculationNumeratorValue, undefined, i18n.language)}
                </strong>
              </div>
              <div>
                <span>
                  {shop.calculationDenominatorLabel || t("shopAnalytics.shop.denominator")}
                </span>
                <strong>
                  {formatSpsValue(shop.calculationDenominatorValue, undefined, i18n.language)}
                </strong>
              </div>
              <div>
                <span>{t("shopAnalytics.shop.excellentThreshold")}</span>
                <strong>
                  {formatSpsValue(shop.excellentThreshold, shop.metricValueUnit, i18n.language)}
                </strong>
              </div>
              <div>
                <span>{t("shopAnalytics.shop.poorThreshold")}</span>
                <strong>
                  {formatSpsValue(shop.poorThreshold, shop.metricValueUnit, i18n.language)}
                </strong>
              </div>
            </div>
            {shop.distributionDetails.length > 0 && (
              <div className="sps-distribution-list">
                {shop.distributionDetails.map((detail, index) => (
                  <div key={`${detail.name ?? "range"}-${index}`}>
                    <span>{detail.name || t("shopAnalytics.shop.range")}</span>
                    <strong>
                      {detail.count?.toLocaleString(i18n.language) ?? "—"}
                      {detail.percent == null
                        ? ""
                        : ` · ${detail.percent.toLocaleString(i18n.language, {
                            maximumFractionDigits: 1,
                          })}%`}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </details>
        </>
      )}
    </article>
  );
}

function MarketSection({ market }: { market: GQL.SpsAnalyticsMarketView }) {
  const { t, i18n } = useTranslation();
  const chart = buildSpsMarketChart(market.shops);
  const unit = market.shops.find((shop) => shop.availability === "AVAILABLE")?.metricValueUnit;
  const yAxisValues = chart.rows.flatMap((row) =>
    chart.series
      .map((series) => row[series.shopId])
      .filter((value): value is number => typeof value === "number"),
  );
  const yAxisDomain = buildSpsYAxisDomain(yAxisValues, unit);

  return (
    <section className="sps-market-section" data-tutorial-id="analytics-market">
      <div className="sps-market-heading">
        <div>
          <span className="sps-market-code">{market.market}</span>
          <div>
            <h2>{marketName(market.market, i18n.language)}</h2>
            <p>
              {market.shops.length === 1
                ? t("shopAnalytics.market.oneShop")
                : t("shopAnalytics.market.shops", { count: market.shops.length })}
            </p>
          </div>
        </div>
        <span
          className={`sps-market-support sps-market-support-${market.apiSupported ? "live" : "unsupported"}`}
        >
          {market.apiSupported
            ? t("shopAnalytics.market.live")
            : t("shopAnalytics.market.unavailable")}
        </span>
      </div>

      <TkPanel as="section" className="section-card sps-chart-card">
        <div className="sps-chart-header">
          <div>
            <span>{t("shopAnalytics.chart.trendByShop")}</span>
            <h3>
              {market.apiSupported
                ? t("shopAnalytics.chart.latestObservations", { days: 90 })
                : t("shopAnalytics.chart.unsupportedTitle")}
            </h3>
            {market.apiSupported && <small>{t("shopAnalytics.chart.autoScale")}</small>}
          </div>
          {chart.series.length > 0 && (
            <div className="sps-chart-legend" aria-label={t("shopAnalytics.chart.seriesAria")}>
              {chart.series.map((series, index) => (
                <span
                  key={series.shopId}
                  className={`sps-series-key sps-series-key-${index % SERIES_COLORS.length}`}
                >
                  {series.shopName}
                </span>
              ))}
            </div>
          )}
        </div>

        {chart.rows.length > 0 ? (
          <div className="sps-chart">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chart.rows}>
                <CartesianGrid
                  stroke="var(--color-border-light)"
                  strokeDasharray="2 6"
                  vertical={false}
                />
                <XAxis
                  dataKey="recordDate"
                  tickFormatter={(value) => formatChartDate(value, i18n.language)}
                  minTickGap={36}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  domain={yAxisDomain}
                  padding={{ top: 12, bottom: 12 }}
                  tickFormatter={(value) => formatSpsValue(Number(value), unit, i18n.language)}
                  tick={{ fontSize: 11 }}
                  width={68}
                />
                <Tooltip content={<SpsChartTooltip unit={unit} />} />
                {chart.series.map((series, index) => (
                  <Line
                    key={series.shopId}
                    type="monotone"
                    dataKey={series.shopId}
                    name={series.shopName}
                    stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="sps-chart-empty">
            <strong>
              {market.apiSupported
                ? t("shopAnalytics.chart.noTrendTitle")
                : t("shopAnalytics.chart.usOnlyTitle")}
            </strong>
            <p>
              {market.apiSupported
                ? t("shopAnalytics.chart.noTrendBody")
                : t("shopAnalytics.chart.unsupportedBody")}
            </p>
          </div>
        )}
      </TkPanel>

      <div className="sps-shop-grid" data-tutorial-id="analytics-shops">
        {market.shops.map((shop) => (
          <ShopDiagnosisCard key={shop.shopId} shop={shop} />
        ))}
      </div>
    </section>
  );
}

export function ShopAnalyticsPage() {
  const { t, i18n } = useTranslation();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking =
    (entityStore as unknown as { authBootstrap?: { status?: string } }).authBootstrap?.status ===
    "loading";
  const [metricCode, setMetricCode] = useState<GQL.SpsAnalyticsMetricCode>("OTDR");

  const query = useQuery<
    { ecommerceGetSpsAnalytics: GQL.SpsAnalyticsView },
    { input: GQL.SpsAnalyticsInput }
  >(ECOMMERCE_GET_SPS_ANALYTICS_QUERY, {
    variables: { input: { metricCode } },
    skip: !user,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const report = query.data?.ecommerceGetSpsAnalytics;
  const orderedMarkets = report
    ? [...report.markets].sort(
        (left, right) =>
          Number(right.apiSupported) - Number(left.apiSupported) ||
          left.market.localeCompare(right.market),
      )
    : [];
  const shops = report?.markets.flatMap((market) => market.shops) ?? [];
  const availableShops = shops.filter((shop) => shop.availability === "AVAILABLE");
  const currentScores = availableShops
    .map((shop) => shop.spsScore)
    .filter((value): value is number => value != null);
  const averageScore = currentScores.length
    ? currentScores.reduce((sum, value) => sum + value, 0) / currentScores.length
    : null;
  const selectedMetric = METRICS.find((metric) => metric.code === metricCode) ?? METRICS[0];
  const refreshing = query.networkStatus === NetworkStatus.refetch;
  const loading = query.loading && !report;
  const latestObservation = useMemo(() => {
    return availableShops
      .map((shop) => shop.observedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);
  }, [availableShops]);

  if (authChecking) {
    return (
      <TkPageFrame>
        <TkPanel className="section-card">{t("shopAnalytics.loadingPage")}</TkPanel>
      </TkPageFrame>
    );
  }

  if (!user) {
    return (
      <TkPageFrame>
        <TkPanel className="section-card">
          <h2>{t("shopAnalytics.signInTitle")}</h2>
          <p>{t("shopAnalytics.signInBody")}</p>
        </TkPanel>
      </TkPageFrame>
    );
  }

  return (
    <TkPageFrame className="sps-analytics-page">
      <TkPageHeader
        eyebrow={t("shopAnalytics.eyebrow")}
        title={t("shopAnalytics.title")}
        description={t("shopAnalytics.subtitle")}
        data-tutorial-id="analytics-header"
        actionsClassName="sps-hero-actions"
        actions={
          <>
            <span className="sps-live-pill">
              <i /> {t("shopAnalytics.liveApi")}
            </span>
            <button
              className="btn btn-secondary sps-refresh-button"
              type="button"
              onClick={() => void query.refetch()}
              disabled={refreshing}
            >
              <RefreshIcon aria-hidden="true" />
              {refreshing ? t("shopAnalytics.refreshing") : t("shopAnalytics.refresh")}
            </button>
          </>
        }
      />

      <div
        className="sps-metric-selector"
        data-tutorial-id="analytics-metrics"
      >
        <div className="sps-metric-selector-copy">
          <span>{t("shopAnalytics.diagnosisLens")}</span>
          <strong>{t(`shopAnalytics.metrics.${selectedMetric.code}`)}</strong>
        </div>
        <TkSegmented
          size="sm"
          items={METRICS.map((metric) => ({ id: metric.code, label: metric.shortLabel }))}
          value={metricCode}
          onChange={(value) => setMetricCode(value as GQL.SpsAnalyticsMetricCode)}
          label={t("shopAnalytics.metricSelectorAria")}
        />
      </div>

      <div className="sps-summary-grid" data-tutorial-id="analytics-summary">
        <TkPanel padding="sm" className="sps-summary-card data-card-hover">
          <span>{t("shopAnalytics.summary.markets")}</span>
          <strong>{report?.markets.length ?? "—"}</strong>
          <small>{t("shopAnalytics.summary.marketsHint")}</small>
        </TkPanel>
        <TkPanel padding="sm" className="sps-summary-card data-card-hover">
          <span>{t("shopAnalytics.summary.liveShops")}</span>
          <strong>{report ? availableShops.length : "—"}</strong>
          <small>{t("shopAnalytics.summary.liveShopsHint")}</small>
        </TkPanel>
        <TkPanel
          padding="sm"
          className="sps-summary-card data-card-hover sps-summary-card-featured"
        >
          <span>{t("shopAnalytics.summary.averageSps")}</span>
          <strong>{formatSpsValue(averageScore, undefined, i18n.language)}</strong>
          <small>{t("shopAnalytics.summary.averageSpsHint")}</small>
        </TkPanel>
        <TkPanel padding="sm" className="sps-summary-card data-card-hover">
          <span>{t("shopAnalytics.summary.lastObserved")}</span>
          <strong className="sps-summary-time">
            {formatTimestamp(latestObservation, i18n.language)}
          </strong>
          <small>
            {t("shopAnalytics.summary.trendWindow", {
              days: report?.trendDurationDays ?? 90,
            })}
          </small>
        </TkPanel>
      </div>

      <div className="sps-data-note" data-tutorial-id="analytics-timeline">
        <strong>{t("shopAnalytics.timeline.title")}</strong>
        <p>{t("shopAnalytics.timeline.body")}</p>
      </div>

      {loading && (
        <TkPanel className="section-card sps-state-card">
          {t("shopAnalytics.states.loading")}
        </TkPanel>
      )}

      {query.error && (
        <TkPanel className="section-card sps-state-card sps-state-card-error">
          <strong>{t("shopAnalytics.states.errorTitle")}</strong>
          <p>{query.error.message}</p>
          <button className="btn btn-secondary" type="button" onClick={() => void query.refetch()}>
            {t("shopAnalytics.states.retry")}
          </button>
        </TkPanel>
      )}

      {!loading && !query.error && report?.markets.length === 0 && (
        <TkPanel className="section-card sps-state-card">
          <strong>{t("shopAnalytics.states.noShopsTitle")}</strong>
          <p>{t("shopAnalytics.states.noShopsBody")}</p>
        </TkPanel>
      )}

      {!query.error &&
        orderedMarkets.map((market) => <MarketSection key={market.market} market={market} />)}
    </TkPageFrame>
  );
}
