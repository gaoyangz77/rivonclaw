import { useEffect, useMemo, useState } from "react";
import { NetworkStatus } from "@apollo/client";
import { useLazyQuery, useQuery } from "@apollo/client/react";
import type { GQL } from "@rivonclaw/core";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AFFILIATE_ANALYTICS_OVERVIEW_QUERY,
  AFFILIATE_BI_CATALOG_QUERY,
  AFFILIATE_BI_DATA_QUERY,
  AFFILIATE_BI_DIMENSION_VALUES_QUERY,
} from "../../api/affiliate-analytics-queries.js";
import { RefreshIcon } from "../../components/icons.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import {
  PLATFORM_DATASET,
  RATE_COMPONENTS,
  SAMPLE_DATASET,
  automaticAffiliateChartMode,
  buildAffiliateStackedChartData,
  defaultAffiliateDateRange,
  endDateLtFromInclusive,
  formatInputEndDate,
  isAffiliateGroupingLegal,
  mergeAffiliateResultPages,
  nextAffiliateDatasetDraft,
  relativeDelta,
  removeAffiliateFilter,
  summarizeAffiliateRows,
  upsertAffiliateFilter,
  type AffiliateChartMode,
  type AffiliateDataset,
  type AffiliateExplorerDraft,
  type AffiliateFilterDraft,
  type AffiliateGranularity,
} from "./affiliate-analytics.js";
import "./AffiliateAnalyticsPage.css";

type OverviewResult = { getAffiliateAnalyticsOverview: GQL.AffiliateAnalyticsOverview };
type CatalogResult = { getEcommerceBiCatalog: GQL.EcomBiDatasetMetadata[] };
type DataResult = { getEcommerceBiData: GQL.EcomBiQueryResult };
type DimensionValuesResult = { getEcommerceBiDimensionValues: GQL.EcomBiDimensionValuesResult };
type AnalyticsShop = { id: string; shopName?: string | null; alias?: string | null; region?: string | null };

const CONTRACTS = [PLATFORM_DATASET, SAMPLE_DATASET] as const;
const TREND_METRICS = ["netGmvUsd", "orders", "units", "actualCommissionUsd"] as const;
const LEADER_TYPES = ["SHOP", "CAMPAIGN", "COLLABORATION", "CREATOR", "PRODUCT"] as const;
const GRANULARITIES: AffiliateGranularity[] = ["DAILY", "WEEKLY", "MONTHLY"];
const CHART_MODES: AffiliateChartMode[] = ["AUTO", "LINE", "BAR", "STACKED", "TABLE"];
const STACK_COLORS = ["#0891b2", "#f59e0b", "#64748b", "#14b8a6", "#f97316", "#8b5cf6", "#0ea5e9", "#d97706"];

const GROUP_PRESETS = [
  { key: "DATE", dimensions: ["DATE"] },
  { key: "SHOP", dimensions: ["SHOP_ID", "SHOP_NAME"] },
  { key: "REGION", dimensions: ["SHOP_REGION"] },
  { key: "CAMPAIGN", dimensions: ["CAMPAIGN_ID", "CAMPAIGN_NAME"] },
  { key: "COLLABORATION", dimensions: ["AFFILIATE_COLLABORATION_ID", "AFFILIATE_COLLABORATION_NAME", "AFFILIATE_COLLABORATION_TYPE"] },
  { key: "CREATOR", dimensions: ["CREATOR_OPEN_ID", "CREATOR_USERNAME"] },
  { key: "PRODUCT", dimensions: ["PRODUCT_ID", "PRODUCT_NAME"] },
] as const;

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function activeChartPayload(state: unknown): Record<string, unknown> | undefined {
  if (!state || typeof state !== "object") return undefined;
  const activePayload = (state as {
    activePayload?: Array<{ payload?: Record<string, unknown> }>;
  }).activePayload;
  return activePayload?.[0]?.payload;
}

function formatNumber(value: number | null | undefined, locale: string, compact = false): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

function formatMoney(value: number | null | undefined, locale: string): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
    notation: Math.abs(value) >= 100_000 ? "compact" : "standard",
  }).format(value);
}

function formatPercent(value: number | null | undefined, locale: string): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function formatTimestamp(value: string | null | undefined, locale: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function metricDisplay(value: number | null | undefined, key: string, locale: string): string {
  if (key.toLowerCase().includes("gmv") || key.toLowerCase().includes("commission")) return formatMoney(value, locale);
  if (key.toLowerCase().includes("rate") || key.toLowerCase().includes("coverage") || key.toLowerCase().includes("share")) return formatPercent(value, locale);
  return formatNumber(value, locale);
}

function FreshnessBadge({ label, freshness }: { label: string; freshness?: GQL.EcomBiFreshness | null }) {
  const { t, i18n } = useTranslation();
  return (
    <span className={`affiliate-freshness${freshness?.stale ? " is-stale" : ""}`} title={freshness?.warnings.join("\n")}>
      <i />
      <strong>{label}</strong>
      <span>{freshness?.stale ? t("ecommerce.affiliateAnalytics.stale") : formatTimestamp(freshness?.asOf, i18n.language)}</span>
    </span>
  );
}

function Delta({ current, comparison }: { current: number; comparison?: number | null }) {
  const { t, i18n } = useTranslation();
  const delta = relativeDelta(current, comparison);
  if (delta == null) return <small>{t("ecommerce.affiliateAnalytics.noComparison")}</small>;
  return <small className={delta >= 0 ? "is-positive" : "is-negative"}>{delta >= 0 ? "↑" : "↓"} {formatPercent(Math.abs(delta), i18n.language)}</small>;
}

function Kpi({ label, value, comparison, kind = "number" }: {
  label: string;
  value: number | null | undefined;
  comparison?: number | null;
  kind?: "number" | "money" | "rate";
}) {
  const { i18n } = useTranslation();
  const formatted = kind === "money" ? formatMoney(value, i18n.language) : kind === "rate" ? formatPercent(value, i18n.language) : formatNumber(value, i18n.language, true);
  return (
    <div className="affiliate-kpi">
      <span>{label}</span>
      <strong>{formatted}</strong>
      {value != null && <Delta current={value} comparison={comparison} />}
    </div>
  );
}

function ShopScopeControl({ shops, selected, onChange }: {
  shops: AnalyticsShop[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  const regions = [...new Set(shops.map((shop) => shop.region).filter(Boolean) as string[])].sort();
  const allSelected = selected.length === shops.length && shops.every((shop) => selected.includes(shop.id));
  const selectedRegion = allSelected ? "" : regions.find((region) => {
    const regionShopIds = shops.filter((shop) => shop.region === region).map((shop) => shop.id);
    return regionShopIds.length === selected.length && regionShopIds.every((shopId) => selected.includes(shopId));
  });
  const regionValue = selectedRegion ?? "__CUSTOM__";
  const toggle = (shopId: string) => onChange(selected.includes(shopId) ? selected.filter((id) => id !== shopId) : [...selected, shopId]);
  return (
    <div className="affiliate-scope-controls">
      <label>
        <span>{t("ecommerce.affiliateAnalytics.region")}</span>
        <select
          aria-label={t("ecommerce.affiliateAnalytics.region")}
          onChange={(event) => {
            const region = event.target.value;
            if (region === "__CUSTOM__") return;
            onChange(region ? shops.filter((shop) => shop.region === region).map((shop) => shop.id) : shops.map((shop) => shop.id));
          }}
          value={regionValue}
        >
          <option value="">{t("ecommerce.affiliateAnalytics.allRegions")}</option>
          {regionValue === "__CUSTOM__" && <option value="__CUSTOM__" disabled>{t("ecommerce.affiliateAnalytics.customShopScope")}</option>}
          {regions.map((region) => <option key={region} value={region}>{region}</option>)}
        </select>
      </label>
      <details className="affiliate-shop-picker">
        <summary>{t("ecommerce.affiliateAnalytics.selectedShops", { count: selected.length })}</summary>
        <div>
          <button type="button" onClick={() => onChange(shops.map((shop) => shop.id))}>{t("ecommerce.affiliateAnalytics.selectAll")}</button>
          {shops.map((shop) => (
            <label key={shop.id}>
              <input type="checkbox" checked={selected.includes(shop.id)} onChange={() => toggle(shop.id)} />
              <span>{shop.alias?.trim() || shop.shopName || shop.id}</span>
              <small>{shop.region}</small>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

function OverviewTab({ shops }: { shops: AnalyticsShop[] }) {
  const { t, i18n } = useTranslation();
  const initialRange = useMemo(() => defaultAffiliateDateRange(), []);
  const [shopIds, setShopIds] = useState(() => shops.map((shop) => shop.id));
  const [range, setRange] = useState(initialRange);
  const [comparisonMode, setComparisonMode] = useState("PREVIOUS_PERIOD");
  const [granularity, setGranularity] = useState<AffiliateGranularity>("DAILY");
  const [trendMetric, setTrendMetric] = useState<(typeof TREND_METRICS)[number]>("netGmvUsd");
  const [leaderType, setLeaderType] = useState<(typeof LEADER_TYPES)[number]>("SHOP");

  useEffect(() => {
    const allowed = new Set(shops.map((shop) => shop.id));
    setShopIds((current) => current.filter((id) => allowed.has(id)).length ? current.filter((id) => allowed.has(id)) : shops.map((shop) => shop.id));
  }, [shops]);

  const query = useQuery<OverviewResult, { input: GQL.AffiliateAnalyticsOverviewInput }>(
    AFFILIATE_ANALYTICS_OVERVIEW_QUERY,
    {
      variables: { input: { shopIds, ...range, comparisonMode, granularity } as GQL.AffiliateAnalyticsOverviewInput },
      skip: shopIds.length === 0,
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    },
  );
  const report = query.data?.getAffiliateAnalyticsOverview;
  const refreshing = query.networkStatus === NetworkStatus.refetch;
  const trendRows = useMemo(() => {
    if (!report) return [];
    const length = Math.max(report.platform.trend.length, report.sample.trend.length);
    return Array.from({ length }, (_, index) => ({
      bucket: report.platform.trend[index]?.bucketStart ?? report.sample.trend[index]?.bucketStart ?? String(index),
      platform: numberValue(report.platform.trend[index]?.[trendMetric]),
      sample: numberValue(report.sample.trend[index]?.[trendMetric]),
      platformComparison: report.platform.comparisonTrend[index] == null ? null : numberValue(report.platform.comparisonTrend[index]?.[trendMetric]),
      sampleComparison: report.sample.comparisonTrend[index] == null ? null : numberValue(report.sample.comparisonTrend[index]?.[trendMetric]),
    }));
  }, [report, trendMetric]);
  const leader = report?.leaderboards.find((item) => item.entityType === leaderType);
  const maxStage = Math.max(1, ...(report?.campaignStages.map((stage) => stage.value) ?? [1]));
  const maxStatus = Math.max(1, ...(report?.sampleStatuses.map((status) => status.value) ?? [1]));

  return (
    <div className="affiliate-overview">
      <section className="affiliate-control-bar" data-tutorial-id="affiliate-analytics-controls">
        <ShopScopeControl shops={shops} selected={shopIds} onChange={setShopIds} />
        <label><span>{t("ecommerce.affiliateAnalytics.startDate")}</span><input type="date" value={range.startDateGe} onChange={(event) => setRange((current) => ({ ...current, startDateGe: event.target.value }))} /></label>
        <label><span>{t("ecommerce.affiliateAnalytics.endDate")}</span><input type="date" value={formatInputEndDate(range.endDateLt)} onChange={(event) => setRange((current) => ({ ...current, endDateLt: endDateLtFromInclusive(event.target.value) }))} /></label>
        <label><span>{t("ecommerce.affiliateAnalytics.comparison")}</span><select value={comparisonMode} onChange={(event) => setComparisonMode(event.target.value)}><option value="PREVIOUS_PERIOD">{t("ecommerce.affiliateAnalytics.previousPeriod")}</option><option value="PREVIOUS_YEAR">{t("ecommerce.affiliateAnalytics.previousYear")}</option><option value="NONE">{t("ecommerce.affiliateAnalytics.none")}</option></select></label>
        <div className="affiliate-segmented" aria-label={t("ecommerce.affiliateAnalytics.granularity")}>
          {GRANULARITIES.map((item) => <button key={item} type="button" className={granularity === item ? "active" : ""} onClick={() => setGranularity(item)}>{t(`ecommerce.affiliateAnalytics.granularities.${item}`)}</button>)}
        </div>
        <button className="btn btn-secondary affiliate-refresh" type="button" onClick={() => void query.refetch()} disabled={refreshing || !shopIds.length}><RefreshIcon aria-hidden="true" />{refreshing ? t("ecommerce.affiliateAnalytics.refreshing") : t("ecommerce.affiliateAnalytics.refresh")}</button>
        <div className="affiliate-freshness-pair">
          <FreshnessBadge label={t("ecommerce.affiliateAnalytics.platformShort")} freshness={report?.freshness.platform} />
          <FreshnessBadge label={t("ecommerce.affiliateAnalytics.sampleShort")} freshness={report?.freshness.sample} />
        </div>
      </section>

      {query.loading && !report && <div className="affiliate-skeleton-grid" aria-label={t("ecommerce.affiliateAnalytics.loading")}>{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>}
      {query.error && <section className="affiliate-state is-error"><strong>{t("ecommerce.affiliateAnalytics.errorTitle")}</strong><p>{query.error.message}</p><button className="btn btn-secondary" type="button" onClick={() => void query.refetch()}>{t("ecommerce.affiliateAnalytics.retry")}</button></section>}
      {!query.loading && !query.error && !report && <section className="affiliate-state"><strong>{t("ecommerce.affiliateAnalytics.noDataTitle")}</strong><p>{t("ecommerce.affiliateAnalytics.noDataBody")}</p></section>}

      {report && (
        <>
          <section className="affiliate-portfolio-strip">
            {[
              [t("ecommerce.affiliateAnalytics.portfolio.shops"), report.portfolio.shops],
              [t("ecommerce.affiliateAnalytics.portfolio.campaigns"), report.portfolio.activeCampaigns],
              [t("ecommerce.affiliateAnalytics.portfolio.target"), report.portfolio.activeTargetCollaborations],
              [t("ecommerce.affiliateAnalytics.portfolio.open"), report.portfolio.activeOpenCollaborations],
            ].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{formatNumber(Number(value), i18n.language)}</strong></div>)}
          </section>

          <section className="affiliate-contract-grid" data-tutorial-id="affiliate-analytics-contracts">
            <article className="affiliate-contract affiliate-contract-platform">
              <header><span>{t("ecommerce.affiliateAnalytics.platformEyebrow")}</span><h2>{t("ecommerce.affiliateAnalytics.platformTitle")}</h2></header>
              <div className="affiliate-kpi-grid">
                <Kpi label={t("ecommerce.affiliateAnalytics.metrics.netGmv")} value={report.platform.current.netGmvUsd} comparison={report.platform.comparison?.netGmvUsd} kind="money" />
                <Kpi label={t("ecommerce.affiliateAnalytics.metrics.orders")} value={report.platform.current.orders} comparison={report.platform.comparison?.orders} />
                <Kpi label={t("ecommerce.affiliateAnalytics.metrics.units")} value={report.platform.current.units} comparison={report.platform.comparison?.units} />
                <Kpi label={t("ecommerce.affiliateAnalytics.metrics.commission")} value={report.platform.current.actualCommissionUsd || report.platform.current.estimatedCommissionUsd} comparison={(report.platform.comparison?.actualCommissionUsd || report.platform.comparison?.estimatedCommissionUsd) ?? null} kind="money" />
                <Kpi label={t("ecommerce.affiliateAnalytics.metrics.invited")} value={report.platform.current.targetCreatorsInvited} comparison={report.platform.comparison?.targetCreatorsInvited} />
                <Kpi label={t("ecommerce.affiliateAnalytics.metrics.responseRate")} value={report.platform.current.targetResponseRate} comparison={report.platform.comparison?.targetResponseRate} kind="rate" />
              </div>
            </article>
            <div className="affiliate-contract-divider"><span>≠</span><p>{t("ecommerce.affiliateAnalytics.nonAdditive")}</p></div>
            <article className="affiliate-contract affiliate-contract-sample">
              <header><span>{t("ecommerce.affiliateAnalytics.sampleEyebrow")}</span><h2>{t("ecommerce.affiliateAnalytics.sampleTitle")}</h2></header>
              <div className="affiliate-kpi-grid">
                <Kpi label={t("ecommerce.affiliateAnalytics.metrics.sampleGmv")} value={report.sample.current.netGmvUsd} comparison={report.sample.comparison?.netGmvUsd} kind="money" />
                <Kpi label={t("ecommerce.affiliateAnalytics.metrics.orders")} value={report.sample.current.orders} comparison={report.sample.comparison?.orders} />
                <Kpi label={t("ecommerce.affiliateAnalytics.metrics.units")} value={report.sample.current.units} comparison={report.sample.comparison?.units} />
                <Kpi label={t("ecommerce.affiliateAnalytics.metrics.applications")} value={report.sample.current.applications} comparison={report.sample.comparison?.applications} />
                <Kpi label={t("ecommerce.affiliateAnalytics.metrics.approvalRate")} value={report.sample.current.approvalRate} comparison={report.sample.comparison?.approvalRate} kind="rate" />
                <Kpi label={t("ecommerce.affiliateAnalytics.metrics.completionRate")} value={report.sample.current.completionRate} comparison={report.sample.comparison?.completionRate} kind="rate" />
              </div>
            </article>
          </section>

          <section className="affiliate-panel affiliate-trend-panel">
            <header><div><span>{t("ecommerce.affiliateAnalytics.section.performance")}</span><h2>{t("ecommerce.affiliateAnalytics.section.trend")}</h2></div><div className="affiliate-segmented">{TREND_METRICS.map((metric) => <button type="button" key={metric} className={trendMetric === metric ? "active" : ""} onClick={() => setTrendMetric(metric)}>{t(`ecommerce.affiliateAnalytics.trendMetrics.${metric}`)}</button>)}</div></header>
            <div className="affiliate-chart-large">
              <ResponsiveContainer width="100%" height="100%"><LineChart data={trendRows}><CartesianGrid strokeDasharray="3 6" vertical={false} /><XAxis dataKey="bucket" minTickGap={28} /><YAxis tickFormatter={(value) => formatNumber(Number(value), i18n.language, true)} /><Tooltip formatter={(value, name) => [metricDisplay(Number(value), trendMetric, i18n.language), String(name)]} /><Legend /><Line type="monotone" dataKey="platform" name={t("ecommerce.affiliateAnalytics.platformShort")} stroke="var(--affiliate-platform)" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="sample" name={t("ecommerce.affiliateAnalytics.sampleShort")} stroke="var(--affiliate-sample)" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="platformComparison" name={t("ecommerce.affiliateAnalytics.platformComparison")} stroke="var(--affiliate-platform)" strokeDasharray="5 5" dot={false} /><Line type="monotone" dataKey="sampleComparison" name={t("ecommerce.affiliateAnalytics.sampleComparison")} stroke="var(--affiliate-sample)" strokeDasharray="5 5" dot={false} /></LineChart></ResponsiveContainer>
            </div>
          </section>

          <section className="affiliate-two-column">
            <article className="affiliate-panel">
              <header><div><span>{t("ecommerce.affiliateAnalytics.platformShort")}</span><h2>{t("ecommerce.affiliateAnalytics.section.activity")}</h2></div><small>{t("ecommerce.affiliateAnalytics.activityNote")}</small></header>
              <div className="affiliate-stage-list">{report.campaignStages.map((stage) => <div key={stage.key}><span>{stage.label}</span><progress max={maxStage} value={stage.value} /><strong>{formatNumber(stage.value, i18n.language)}</strong></div>)}</div>
            </article>
            <article className="affiliate-panel">
              <header><div><span>{t("ecommerce.affiliateAnalytics.sampleShort")}</span><h2>{t("ecommerce.affiliateAnalytics.section.status")}</h2></div>{!report.sample.current.statusBucketsExclusive && <small className="is-warning">{t("ecommerce.affiliateAnalytics.statusNonExclusive")}</small>}</header>
              <div className={`affiliate-status-list${report.sample.current.statusBucketsExclusive ? " is-exclusive" : ""}`}>{report.sampleStatuses.map((status) => <div key={status.key}><span>{status.label}</span><progress max={maxStatus} value={status.value} /><strong>{formatNumber(status.value, i18n.language)}</strong></div>)}</div>
              <div className="affiliate-secondary-stats"><span>{t("ecommerce.affiliateAnalytics.metrics.shipped")} <b>{formatNumber(report.sample.current.shippedObserved, i18n.language)}</b></span><span>{t("ecommerce.affiliateAnalytics.metrics.contents")} <b>{formatNumber(report.sample.current.contents, i18n.language)}</b></span><span>{t("ecommerce.affiliateAnalytics.metrics.orders")} <b>{formatNumber(report.sample.current.orders, i18n.language)}</b></span></div>
            </article>
          </section>

          <section className="affiliate-two-column" data-tutorial-id="affiliate-analytics-maturity">
            <article className="affiliate-panel">
              <header><div><span>{t("ecommerce.affiliateAnalytics.maturity")}</span><h2>{t("ecommerce.affiliateAnalytics.responseMaturity")}</h2></div><small>{t("ecommerce.affiliateAnalytics.liveObserved", { date: formatTimestamp(report.freshness.liveResponseObservedAt, i18n.language) })}</small></header>
              <div className="affiliate-chart-medium"><ResponsiveContainer width="100%" height="100%"><LineChart data={report.outreachMaturity}><CartesianGrid strokeDasharray="3 6" vertical={false} /><XAxis dataKey="horizon" /><YAxis tickFormatter={(value) => formatPercent(Number(value), i18n.language)} domain={[0, 1]} /><Tooltip formatter={(value, name, item) => [formatPercent(Number(value), i18n.language), `${String(name)} · n=${item.payload.matureInvitations}`]} /><Line type="monotone" dataKey="responseRate" stroke="var(--affiliate-platform)" strokeWidth={3} /></LineChart></ResponsiveContainer></div>
              <div className="affiliate-basis-row">{report.outreachMaturityBasis.map((basis) => <span key={basis.basis}>{basis.basis}: <b>{formatNumber(basis.invitations, i18n.language)}</b></span>)}</div>
            </article>
            <article className="affiliate-panel">
              <header><div><span>{t("ecommerce.affiliateAnalytics.maturity")}</span><h2>{t("ecommerce.affiliateAnalytics.sampleAge")}</h2></div><small>{t("ecommerce.affiliateAnalytics.sampleAgeNote")}</small></header>
              <div className="affiliate-chart-medium"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.sampleMaturity}><CartesianGrid strokeDasharray="3 6" vertical={false} /><XAxis dataKey="ageBucket" /><YAxis tickFormatter={(value) => formatPercent(Number(value), i18n.language)} domain={[0, 1]} /><Tooltip formatter={(value) => formatPercent(Number(value), i18n.language)} /><Legend /><Bar dataKey="approvalRate" name={t("ecommerce.affiliateAnalytics.metrics.approvalRate")} fill="var(--affiliate-sample)" /><Bar dataKey="fulfillmentObservedRate" name={t("ecommerce.affiliateAnalytics.metrics.fulfillmentRate")} fill="var(--affiliate-sample-soft)" /><Bar dataKey="completionRate" name={t("ecommerce.affiliateAnalytics.metrics.completionRate")} fill="var(--affiliate-graphite)" /></BarChart></ResponsiveContainer></div>
            </article>
          </section>

          <section className="affiliate-panel affiliate-leaderboard" data-tutorial-id="affiliate-analytics-leaders">
            <header><div><span>{t("ecommerce.affiliateAnalytics.section.portfolio")}</span><h2>{t("ecommerce.affiliateAnalytics.section.leaderboard")}</h2></div><div className="affiliate-segmented">{LEADER_TYPES.map((type) => <button type="button" key={type} className={leaderType === type ? "active" : ""} onClick={() => setLeaderType(type)}>{t(`ecommerce.affiliateAnalytics.leaderTypes.${type}`)}</button>)}</div></header>
            <div className="affiliate-leader-columns">
              {(["platform", "sample"] as const).map((contract) => <div key={contract}><h3>{contract === "platform" ? t("ecommerce.affiliateAnalytics.platformTitle") : t("ecommerce.affiliateAnalytics.sampleTitle")}</h3><table><thead><tr><th>{t("ecommerce.affiliateAnalytics.entity")}</th><th>{contract === "platform" ? t("ecommerce.affiliateAnalytics.metrics.netGmv") : t("ecommerce.affiliateAnalytics.metrics.applications")}</th><th>{t("ecommerce.affiliateAnalytics.metrics.orders")}</th></tr></thead><tbody>{leader?.[contract].map((row) => <tr key={row.entityId}><td><strong>{row.label}</strong><small>{row.secondaryLabel}</small></td><td>{contract === "platform" ? formatMoney(row.netGmvUsd, i18n.language) : formatNumber(row.applications, i18n.language)}</td><td>{formatNumber(row.orders, i18n.language)}</td></tr>)}</tbody></table></div>)}
            </div>
          </section>

          <section className="affiliate-health" data-tutorial-id="affiliate-analytics-health">
            <header><span>{t("ecommerce.affiliateAnalytics.section.quality")}</span><h2>{t("ecommerce.affiliateAnalytics.section.health")}</h2></header>
            <div>{[
              [t("ecommerce.affiliateAnalytics.health.creatorRows"), report.health.creatorIdentityRowCoverage],
              [t("ecommerce.affiliateAnalytics.health.creatorGmv"), report.health.creatorIdentityGmvCoverage],
              [t("ecommerce.affiliateAnalytics.health.exactTime"), report.health.exactApplicationTimeShare],
              [t("ecommerce.affiliateAnalytics.health.targetMapping"), report.health.targetMappedApplicationShare],
              [t("ecommerce.affiliateAnalytics.health.campaignMapping"), report.health.campaignMappedApplicationShare],
            ].map(([label, value]) => <article key={String(label)}><span>{label}</span><strong>{formatPercent(value == null ? null : Number(value), i18n.language)}</strong><progress max={1} value={value == null ? 0 : Number(value)} /></article>)}</div>
            {report.health.warnings.length > 0 && <ul>{report.health.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
          </section>
        </>
      )}
    </div>
  );
}

function ExploreTab({ shops }: { shops: AnalyticsShop[] }) {
  const { t, i18n } = useTranslation();
  const initialRange = useMemo(() => defaultAffiliateDateRange(), []);
  const [draft, setDraft] = useState<AffiliateExplorerDraft>({
    datasetId: PLATFORM_DATASET,
    shopIds: shops.map((shop) => shop.id),
    granularity: "DAILY",
    ...initialRange,
    dimensions: ["DATE"],
    metrics: ["AFFILIATE_NET_GMV_USD", "AFFILIATE_ORDERS"],
    filters: [],
    sortField: "",
    sortDirection: "DESC",
    limit: 100,
  });
  const [executed, setExecuted] = useState<AffiliateExplorerDraft | null>(null);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [result, setResult] = useState<GQL.EcomBiQueryResult | null>(null);
  const [chartMode, setChartMode] = useState<AffiliateChartMode>("AUTO");
  const [filterDimension, setFilterDimension] = useState("CAMPAIGN_ID");
  const [filterOperator, setFilterOperator] = useState<"IN" | "NOT_IN">("IN");
  const [filterSearch, setFilterSearch] = useState("");
  const [manualFilterValue, setManualFilterValue] = useState("");

  useEffect(() => {
    const allowed = new Set(shops.map((shop) => shop.id));
    setDraft((current) => ({ ...current, shopIds: current.shopIds.filter((id) => allowed.has(id)).length ? current.shopIds.filter((id) => allowed.has(id)) : shops.map((shop) => shop.id) }));
  }, [shops]);

  const catalogQuery = useQuery<CatalogResult>(AFFILIATE_BI_CATALOG_QUERY, { fetchPolicy: "cache-first" });
  const datasets = catalogQuery.data?.getEcommerceBiCatalog.filter((item) => CONTRACTS.includes(item.id as AffiliateDataset)) ?? [];
  const catalog = datasets.find((item) => item.id === draft.datasetId);
  const groupingSets = catalog?.groupingSets ?? [];
  const legal = isAffiliateGroupingLegal(draft.dimensions, draft.filters.map((filter) => filter.dimension), groupingSets);
  const [queryData, queryState] = useLazyQuery<DataResult, { input: GQL.EcomBiQueryInput }>(AFFILIATE_BI_DATA_QUERY, { fetchPolicy: "network-only" });
  const [queryValues, valueState] = useLazyQuery<DimensionValuesResult, { input: GQL.EcomBiDimensionValuesInput }>(AFFILIATE_BI_DIMENSION_VALUES_QUERY, { fetchPolicy: "network-only" });

  const queryMetrics = (state: AffiliateExplorerDraft) => [...new Set(state.metrics.flatMap((metric) => [metric, ...(RATE_COMPONENTS[metric] ?? [])]))];
  const toInput = (state: AffiliateExplorerDraft, offset = 0): GQL.EcomBiQueryInput => ({
    datasetId: state.datasetId,
    shopIds: state.shopIds,
    startDateGe: state.startDateGe,
    endDateLt: state.endDateLt,
    granularity: state.granularity,
    dimensions: state.dimensions,
    metrics: queryMetrics(state),
    filters: state.filters.map((filter) => ({ dimension: filter.dimension, operator: filter.operator, values: filter.values })),
    orderBy: state.sortField ? [{
      ...(state.dimensions.includes(state.sortField) ? { dimension: state.sortField } : { metric: state.sortField }),
      direction: state.sortDirection,
    }] : [],
    limit: state.limit,
    offset,
  } as GQL.EcomBiQueryInput);

  const execute = async (state: AffiliateExplorerDraft, append = false) => {
    const offset = append ? rows.length : 0;
    const response = await queryData({ variables: { input: toInput(state, offset) } });
    const next = response.data?.getEcommerceBiData;
    if (!next) return;
    const nextRows = next.rows as Array<Record<string, unknown>>;
    setRows((current) => append ? mergeAffiliateResultPages(current, nextRows) : nextRows);
    setResult(next);
    setExecuted(state);
  };

  const selectPreset = (preset: (typeof GROUP_PRESETS)[number]) => {
    const active = preset.dimensions.every((dimension) => draft.dimensions.includes(dimension));
    const nextDimensions = active
      ? draft.dimensions.filter((dimension) => !preset.dimensions.includes(dimension as never))
      : [...new Set([...draft.dimensions, ...preset.dimensions])];
    if (!isAffiliateGroupingLegal(nextDimensions, draft.filters.map((filter) => filter.dimension), groupingSets)) return;
    setDraft((current) => ({ ...current, dimensions: nextDimensions }));
  };

  const addFilter = (value: string, label = value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const existing = draft.filters.find((filter) => filter.dimension === filterDimension);
    const next: AffiliateFilterDraft = {
      dimension: filterDimension,
      operator: filterOperator,
      values: [...new Set([...(existing?.values ?? []), trimmed])],
      labels: { ...existing?.labels, [trimmed]: label },
    };
    setDraft((current) => ({ ...current, filters: upsertAffiliateFilter(current.filters, next) }));
    setManualFilterValue("");
  };

  const searchValues = () => queryValues({ variables: { input: {
    datasetId: draft.datasetId,
    dimension: filterDimension,
    shopIds: draft.shopIds,
    startDateGe: draft.startDateGe,
    endDateLt: draft.endDateLt,
    search: filterSearch || null,
    limit: 25,
  } as GQL.EcomBiDimensionValuesInput } });

  const displayedColumns = result?.columns.filter((column) => executed?.dimensions.includes(column.key) || executed?.metrics.includes(column.key)) ?? [];
  const summary = summarizeAffiliateRows(rows, executed?.metrics ?? []);
  const resolvedChartMode = chartMode === "AUTO" ? automaticAffiliateChartMode(executed?.dimensions ?? draft.dimensions) : chartMode;
  const chartMetric = executed?.metrics[0];
  const categoryDimension = executed?.dimensions.find((dimension) => dimension !== "DATE");
  const chartRows = useMemo(() => rows.slice(0, 50), [rows]);
  const stackedChart = useMemo(
    () => executed && chartMetric ? buildAffiliateStackedChartData(chartRows, executed.dimensions, chartMetric) : null,
    [chartMetric, chartRows, executed],
  );
  const resultChanged = executed != null && JSON.stringify(draft) !== JSON.stringify(executed);

  const drillFromPayload = (payload?: Record<string, unknown>) => {
    if (!payload || !categoryDimension || payload[categoryDimension] == null) return;
    const value = String(payload[categoryDimension]);
    if (!executed) return;
    const next = { ...executed, filters: upsertAffiliateFilter(executed.filters, { dimension: categoryDimension, operator: "IN", values: [value], labels: { [value]: value } }) };
    setDraft(next);
    void execute(next);
  };

  return (
    <div className="affiliate-explore" data-tutorial-id="affiliate-analytics-explore">
      <section className="affiliate-contract-selector" data-tutorial-id="affiliate-analytics-query">
        <div><span>{t("ecommerce.affiliateAnalytics.explore.contract")}</span><h2>{t("ecommerce.affiliateAnalytics.explore.chooseContract")}</h2></div>
        {CONTRACTS.map((datasetId) => <button key={datasetId} type="button" className={`${draft.datasetId === datasetId ? "active" : ""} ${datasetId === PLATFORM_DATASET ? "platform" : "sample"}`} onClick={() => { setDraft((current) => nextAffiliateDatasetDraft(current, datasetId)); setRows([]); setResult(null); setExecuted(null); }}>{datasetId === PLATFORM_DATASET ? t("ecommerce.affiliateAnalytics.platformTitle") : t("ecommerce.affiliateAnalytics.sampleTitle")}</button>)}
      </section>

      <section className="affiliate-query-composer">
        <div className="affiliate-composer-row">
          <ShopScopeControl shops={shops} selected={draft.shopIds} onChange={(shopIds) => setDraft((current) => ({ ...current, shopIds }))} />
          <label><span>{t("ecommerce.affiliateAnalytics.startDate")}</span><input type="date" value={draft.startDateGe} onChange={(event) => setDraft((current) => ({ ...current, startDateGe: event.target.value }))} /></label>
          <label><span>{t("ecommerce.affiliateAnalytics.endDate")}</span><input type="date" value={formatInputEndDate(draft.endDateLt)} onChange={(event) => setDraft((current) => ({ ...current, endDateLt: endDateLtFromInclusive(event.target.value) }))} /></label>
          <label><span>{t("ecommerce.affiliateAnalytics.granularity")}</span><select value={draft.granularity} onChange={(event) => setDraft((current) => ({ ...current, granularity: event.target.value as AffiliateGranularity }))}>{GRANULARITIES.map((item) => <option key={item} value={item}>{t(`ecommerce.affiliateAnalytics.granularities.${item}`)}</option>)}</select></label>
        </div>

        <div className="affiliate-composer-grid">
          <div className="affiliate-composer-block">
            <h3>{t("ecommerce.affiliateAnalytics.explore.metrics")}</h3>
            <div className="affiliate-check-list">{catalog?.metrics.map((metric) => <label key={metric.id} title={metric.description}><input type="checkbox" checked={draft.metrics.includes(metric.id)} onChange={() => setDraft((current) => ({ ...current, metrics: current.metrics.includes(metric.id) ? current.metrics.filter((item) => item !== metric.id) : [...current.metrics, metric.id] }))} /><span>{metric.label}</span></label>)}</div>
          </div>
          <div className="affiliate-composer-block">
            <h3>{t("ecommerce.affiliateAnalytics.explore.groupBy")}</h3>
            <div className="affiliate-chip-list">{GROUP_PRESETS.map((preset) => {
              const active = preset.dimensions.every((dimension) => draft.dimensions.includes(dimension));
              const prospective = active ? draft.dimensions.filter((dimension) => !preset.dimensions.includes(dimension as never)) : [...new Set([...draft.dimensions, ...preset.dimensions])];
              const disabled = !active && !isAffiliateGroupingLegal(prospective, draft.filters.map((filter) => filter.dimension), groupingSets);
              return <button type="button" key={preset.key} className={active ? "active" : ""} disabled={disabled} onClick={() => selectPreset(preset)}>{t(`ecommerce.affiliateAnalytics.groupPresets.${preset.key}`)}</button>;
            })}</div>
            {!legal && <p className="affiliate-inline-warning">{t("ecommerce.affiliateAnalytics.explore.invalidGrouping")}</p>}
          </div>
          <div className="affiliate-composer-block affiliate-filter-builder">
            <h3>{t("ecommerce.affiliateAnalytics.explore.filters")}</h3>
            <div className="affiliate-filter-fields">
              <select value={filterDimension} onChange={(event) => setFilterDimension(event.target.value)}>{catalog?.dimensions.filter((dimension) => dimension.filterable && dimension.id !== "DATE").map((dimension) => <option key={dimension.id} value={dimension.id} disabled={!isAffiliateGroupingLegal(draft.dimensions, [...draft.filters.map((filter) => filter.dimension), dimension.id], groupingSets)}>{dimension.label}</option>)}</select>
              <select value={filterOperator} onChange={(event) => setFilterOperator(event.target.value as "IN" | "NOT_IN")}><option value="IN">IN</option><option value="NOT_IN">NOT IN</option></select>
              <input value={filterSearch} placeholder={t("ecommerce.affiliateAnalytics.explore.searchValues")} onChange={(event) => setFilterSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchValues(); }} />
              <button type="button" className="btn btn-secondary" onClick={() => void searchValues()} disabled={valueState.loading}>{t("ecommerce.affiliateAnalytics.search")}</button>
            </div>
            <div className="affiliate-value-results">{valueState.data?.getEcommerceBiDimensionValues.items.map((item) => <button type="button" key={item.value} onClick={() => addFilter(item.value, item.label)}><strong>{item.label}</strong>{item.secondaryLabel && <small>{item.secondaryLabel}</small>}</button>)}</div>
            <div className="affiliate-manual-filter"><input value={manualFilterValue} placeholder={t("ecommerce.affiliateAnalytics.explore.exactValue")} onChange={(event) => setManualFilterValue(event.target.value)} /><button type="button" onClick={() => addFilter(manualFilterValue)}>{t("ecommerce.affiliateAnalytics.add")}</button></div>
          </div>
        </div>

        <div className="affiliate-breadcrumbs">{draft.filters.map((filter) => <button type="button" key={filter.dimension} onClick={() => setDraft((current) => ({ ...current, filters: removeAffiliateFilter(current.filters, filter.dimension) }))}><span>{filter.dimension}</span><strong>{filter.operator} {filter.values.map((value) => filter.labels?.[value] ?? value).join(", ")}</strong><b>×</b></button>)}</div>
        <div className="affiliate-run-row">
          <label><span>{t("ecommerce.affiliateAnalytics.explore.sort")}</span><select value={draft.sortField} onChange={(event) => setDraft((current) => ({ ...current, sortField: event.target.value }))}><option value="">{t("ecommerce.affiliateAnalytics.none")}</option>{[...draft.dimensions, ...draft.metrics].map((field) => <option key={field} value={field}>{catalog?.dimensions.find((item) => item.id === field)?.label ?? catalog?.metrics.find((item) => item.id === field)?.label ?? field}</option>)}</select></label>
          <label><span>{t("ecommerce.affiliateAnalytics.explore.direction")}</span><select value={draft.sortDirection} onChange={(event) => setDraft((current) => ({ ...current, sortDirection: event.target.value as "ASC" | "DESC" }))}><option value="DESC">DESC</option><option value="ASC">ASC</option></select></label>
          <label><span>{t("ecommerce.affiliateAnalytics.explore.limit")}</span><select value={draft.limit} onChange={(event) => setDraft((current) => ({ ...current, limit: Number(event.target.value) }))}><option value={50}>50</option><option value={100}>100</option><option value={500}>500</option></select></label>
          {resultChanged && <span className="affiliate-dirty-query">{t("ecommerce.affiliateAnalytics.explore.notRun")}</span>}
          <button type="button" className="btn btn-primary affiliate-run" disabled={!legal || !draft.metrics.length || !draft.shopIds.length || queryState.loading} onClick={() => void execute(draft)}>{queryState.loading ? t("ecommerce.affiliateAnalytics.running") : t("ecommerce.affiliateAnalytics.run")}</button>
        </div>
      </section>

      {queryState.error && <section className="affiliate-state is-error"><strong>{t("ecommerce.affiliateAnalytics.errorTitle")}</strong><p>{queryState.error.message}</p><button className="btn btn-secondary" type="button" onClick={() => void execute(draft)}>{t("ecommerce.affiliateAnalytics.retry")}</button></section>}
      {result && executed && (
        <>
          <section className="affiliate-result-status" data-tutorial-id="affiliate-analytics-results">
            <div><strong>{executed.datasetId === PLATFORM_DATASET ? t("ecommerce.affiliateAnalytics.platformTitle") : t("ecommerce.affiliateAnalytics.sampleTitle")}</strong><span>{executed.startDateGe} → {formatInputEndDate(executed.endDateLt)}</span><span>{t("ecommerce.affiliateAnalytics.explore.rows", { count: rows.length })}</span></div>
            <FreshnessBadge label={t("ecommerce.affiliateAnalytics.materialized")} freshness={result.freshness} />
            {result.freshness?.warnings.map((warning) => <small key={warning}>{warning}</small>)}
          </section>
          <section className="affiliate-query-kpis">{executed.metrics.slice(0, 6).map((metric) => <Kpi key={metric} label={catalog?.metrics.find((item) => item.id === metric)?.label ?? metric} value={summary[metric]} kind={metric.includes("GMV") || metric.includes("COMMISSION") ? "money" : metric.includes("RATE") || metric.includes("COVERAGE") ? "rate" : "number"} />)}</section>
          {executed.metrics.some((metric) => metric.endsWith("_NATIVE") && summary[metric] == null) && <div className="affiliate-currency-warning">{t("ecommerce.affiliateAnalytics.explore.mixedCurrency")}</div>}
          <section className="affiliate-panel affiliate-explore-chart">
            <header><div><span>{t("ecommerce.affiliateAnalytics.explore.visualization")}</span><h2>{catalog?.metrics.find((item) => item.id === chartMetric)?.label ?? chartMetric}</h2></div><div className="affiliate-segmented">{CHART_MODES.map((mode) => <button key={mode} type="button" className={chartMode === mode ? "active" : ""} onClick={() => setChartMode(mode)}>{t(`ecommerce.affiliateAnalytics.chartModes.${mode}`)}</button>)}</div></header>
            {resolvedChartMode !== "TABLE" && <div className="affiliate-chart-large"><ResponsiveContainer width="100%" height="100%">{resolvedChartMode === "LINE" ? <LineChart data={chartRows} onClick={(state) => drillFromPayload(activeChartPayload(state))}><CartesianGrid strokeDasharray="3 6" vertical={false} /><XAxis dataKey={executed.dimensions.includes("DATE") ? "DATE" : categoryDimension} /><YAxis tickFormatter={(value) => formatNumber(Number(value), i18n.language, true)} /><Tooltip /><Line type="monotone" dataKey={chartMetric} stroke={executed.datasetId === PLATFORM_DATASET ? "var(--affiliate-platform)" : "var(--affiliate-sample)"} strokeWidth={3} /></LineChart> : <BarChart data={resolvedChartMode === "STACKED" && stackedChart ? stackedChart.rows : chartRows} layout="vertical" onClick={(state) => drillFromPayload(activeChartPayload(state))}><CartesianGrid strokeDasharray="3 6" horizontal={false} /><XAxis type="number" /><YAxis type="category" dataKey={resolvedChartMode === "STACKED" && stackedChart ? "category" : categoryDimension} width={120} /><Tooltip /><Legend />{resolvedChartMode === "STACKED" && stackedChart ? stackedChart.series.map((series, index) => <Bar key={series.key} dataKey={series.key} name={series.label} stackId="affiliate" fill={STACK_COLORS[index % STACK_COLORS.length]} />) : <Bar dataKey={chartMetric} fill={executed.datasetId === PLATFORM_DATASET ? "var(--affiliate-platform)" : "var(--affiliate-sample)"} />}</BarChart>}</ResponsiveContainer></div>}
          </section>
          <section className="affiliate-panel affiliate-result-table">
            <header><div><span>{t("ecommerce.affiliateAnalytics.explore.detail")}</span><h2>{t("ecommerce.affiliateAnalytics.explore.resultTable")}</h2></div></header>
            {rows.length === 0 ? <div className="affiliate-state"><strong>{t("ecommerce.affiliateAnalytics.noDataTitle")}</strong><p>{t("ecommerce.affiliateAnalytics.noDataBody")}</p></div> : <div className="affiliate-table-scroll"><table><thead><tr>{displayedColumns.map((column) => <th key={column.key}><button type="button" title={column.metric && RATE_COMPONENTS[column.metric] ? t("ecommerce.affiliateAnalytics.explore.rateTooltip", { numerator: RATE_COMPONENTS[column.metric][0], denominator: RATE_COMPONENTS[column.metric][1] }) : undefined} onClick={() => setDraft((current) => ({ ...current, sortField: column.key, sortDirection: current.sortField === column.key && current.sortDirection === "DESC" ? "ASC" : "DESC" }))}>{column.label}</button></th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{displayedColumns.map((column) => <td key={column.key}>{column.dimension && row[column.key] != null ? <button type="button" onClick={() => { const value = String(row[column.key]); const next = { ...executed, filters: upsertAffiliateFilter(executed.filters, { dimension: column.dimension!, operator: "IN", values: [value], labels: { [value]: value } }) }; setDraft(next); void execute(next); }}>{String(row[column.key])}</button> : metricDisplay(row[column.key] == null ? null : numberValue(row[column.key]), column.key, i18n.language)}</td>)}</tr>)}</tbody></table></div>}
            {result.pageInfo.hasMore && <button className="btn btn-secondary affiliate-load-more" type="button" disabled={queryState.loading} onClick={() => void execute(executed, true)}>{t("ecommerce.affiliateAnalytics.loadMore")}</button>}
          </section>
        </>
      )}
    </div>
  );
}

export function AffiliateAnalyticsPage() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const [tab, setTab] = useState<"OVERVIEW" | "EXPLORE">("OVERVIEW");
  const user = entityStore.currentUser;
  const shops = useMemo(() => {
    const allowed = new Set(entityStore.billingOverview?.shops.filter((item) => item.analytics.allowed).map((item) => item.shopId) ?? []);
    return entityStore.shops.filter((shop) => allowed.has(shop.id)).map((shop) => ({ id: shop.id, shopName: shop.shopName, alias: shop.alias, region: shop.region })) as AnalyticsShop[];
  }, [entityStore.billingOverview, entityStore.shops]);

  if (!user) return <div className="page-enter"><section className="affiliate-state"><strong>{t("ecommerce.affiliateAnalytics.signInTitle")}</strong><p>{t("ecommerce.affiliateAnalytics.signInBody")}</p></section></div>;

  return (
    <div className="page-enter affiliate-analytics-page">
      <header className="affiliate-analytics-hero" data-tutorial-id="affiliate-analytics-header">
        <div><span>{t("ecommerce.affiliateAnalytics.eyebrow")}</span><h1>{t("ecommerce.affiliateAnalytics.title")}</h1><p>{t("ecommerce.affiliateAnalytics.subtitle")}</p></div>
        <div className="affiliate-tabs" role="tablist" data-tutorial-id="affiliate-analytics-tabs">
          <button data-tutorial-id="affiliate-analytics-overview-tab" role="tab" type="button" aria-selected={tab === "OVERVIEW"} className={tab === "OVERVIEW" ? "active" : ""} onClick={() => setTab("OVERVIEW")}>{t("ecommerce.affiliateAnalytics.overview")}</button>
          <button data-tutorial-id="affiliate-analytics-explore-tab" role="tab" type="button" aria-selected={tab === "EXPLORE"} className={tab === "EXPLORE" ? "active" : ""} onClick={() => setTab("EXPLORE")}>{t("ecommerce.affiliateAnalytics.explore.title")}</button>
        </div>
      </header>
      {shops.length === 0 ? <section className="affiliate-state is-upgrade"><strong>{t("ecommerce.affiliateAnalytics.noEntitlementTitle")}</strong><p>{t("ecommerce.affiliateAnalytics.noEntitlementBody")}</p></section> : tab === "OVERVIEW" ? <OverviewTab shops={shops} /> : <ExploreTab shops={shops} />}
    </div>
  );
}
