import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@apollo/client/react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GQL } from "@rivonclaw/core";
import {
  ECOMMERCE_GET_CS_PERFORMANCE_QUERY,
  ECOMMERCE_GET_CS_REALTIME_PERFORMANCE_QUERY,
} from "../../api/cs-performance-queries.js";
import { DownloadIcon, InfoIcon, RefreshIcon } from "../../components/icons.js";
import { Select } from "../../components/inputs/Select.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";

type PerformanceTab = "history" | "realtime";
type TimeRange = "7d" | "30d" | "90d";
type RealtimeRange = "1" | "6" | "12" | "24";

type ChartRow = GQL.CustomerServicePerformanceDailyRow & {
  dateLabel: string;
  satisfaction7dWeighted: number | null;
  guidedGmvValue: number | null;
};

type RealtimeChartRow = GQL.CustomerServiceRealtimePerformancePoint & {
  timeLabel: string;
};

const RANGE_DAYS: Record<TimeRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function isoDateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function todayIsoDate(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function formatCount(value: number | null | undefined): string {
  return Number(value ?? 0).toLocaleString();
}

function formatRate(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  return `${(value * 100).toFixed(1)}%`;
}

function formatSeconds(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  if (value < 60) return `${Math.round(value)}s`;
  return `${(value / 60).toFixed(value >= 600 ? 0 : 1)}m`;
}

function formatRealtimeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(11, 16);
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDecimal(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toFixed(value >= 10 ? 0 : 2);
}

function formatMoney(
  value: string | number | null | undefined,
  currency: string | null | undefined,
  locale?: string,
): string {
  if (value == null || currency == null) return "--";
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return "--";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(numericValue);
  } catch {
    return `${currency} ${numericValue.toLocaleString(locale)}`;
  }
}

function formatCompactMoney(
  value: number | null | undefined,
  currency: string | null | undefined,
  locale?: string,
): string {
  if (value == null || currency == null || Number.isNaN(value)) return "--";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return formatMoney(value, currency, locale);
  }
}

function metricNumber(value: number | null | undefined): number {
  return Number(value ?? 0);
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export const CustomerServicePerformancePage = observer(function CustomerServicePerformancePage() {
  const { t, i18n } = useTranslation();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const shops = entityStore.shops;
  const [activeTab, setActiveTab] = useState<PerformanceTab>("realtime");
  const [shopId, setShopId] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [realtimeRange, setRealtimeRange] = useState<RealtimeRange>("6");

  useEffect(() => {
    if (user) entityStore.fetchShops().catch(() => {});
  }, [entityStore, user]);

  const range = useMemo(() => ({
    startTime: isoDateDaysAgo(RANGE_DAYS[timeRange]),
    endTime: todayIsoDate(),
  }), [timeRange]);

  const historyQuery = useQuery<{
    ecommerceGetCSPerformance: GQL.CustomerServicePerformanceReport;
  }>(ECOMMERCE_GET_CS_PERFORMANCE_QUERY, {
    variables: {
      shopId: shopId || null,
      startTime: range.startTime,
      endTime: range.endTime,
    },
    skip: !user || activeTab !== "history",
    fetchPolicy: "cache-and-network",
  });

  const realtimeQuery = useQuery<{
    ecommerceGetCSRealtimePerformance: GQL.CustomerServiceRealtimePerformanceReport;
  }>(ECOMMERCE_GET_CS_REALTIME_PERFORMANCE_QUERY, {
    variables: {
      shopId: shopId || null,
      hours: Number(realtimeRange),
    },
    skip: !user || activeTab !== "realtime",
    fetchPolicy: "cache-and-network",
    pollInterval: activeTab === "realtime" ? 60_000 : 0,
  });

  const loading = activeTab === "realtime" ? realtimeQuery.loading : historyQuery.loading;
  const error = activeTab === "realtime" ? realtimeQuery.error : historyQuery.error;
  const report = historyQuery.data?.ecommerceGetCSPerformance ?? null;
  const realtimeReport = realtimeQuery.data?.ecommerceGetCSRealtimePerformance ?? null;
  const summary = report?.summary;
  const chartRows: ChartRow[] = useMemo(() => {
    const rows = (report?.byDate ?? []).map((row) => ({
      ...row,
      dateLabel: row.dateKey.slice(5),
      guidedGmvValue: row.csGuidedGmv == null || Number.isNaN(Number(row.csGuidedGmv))
        ? null
        : Number(row.csGuidedGmv),
    }));

    return rows.map((row, index) => {
      const windowRows = rows.slice(Math.max(0, index - 6), index + 1);
      const ratedSessions = windowRows.reduce((sum, item) => sum + metricNumber(item.ratedSessions), 0);
      const satisfiedSessions = windowRows.reduce((sum, item) => sum + metricNumber(item.satisfiedSessions), 0);
      return {
        ...row,
        satisfaction7dWeighted: ratedSessions > 0 ? satisfiedSessions / ratedSessions : null,
      };
    });
  }, [report]);

  const guidedGmvCurrency = summary?.csGuidedGmvCurrency
    ?? chartRows.find((row) => row.csGuidedGmvCurrency)?.csGuidedGmvCurrency
    ?? null;
  const hasMatureGuidedGmv = chartRows.some((row) => row.guidedGmvValue != null);

  const realtimeRows: RealtimeChartRow[] = useMemo(() => (
    (realtimeReport?.points ?? []).map((point) => ({
      ...point,
      timeLabel: formatRealtimeLabel(point.sampledAt),
    }))
  ), [realtimeReport]);

  const tableRows = useMemo(() => [...chartRows].reverse(), [chartRows]);

  const shopOptions = useMemo(() => [
    { value: "", label: t("ecommerce.customerServicePerformance.allShops") },
    ...shops
      .filter((shop) => shop.services?.customerService?.enabled)
      .map((shop) => ({
        value: shop.id,
        label: shop.alias || shop.shopName || shop.platformShopId || shop.id,
      })),
  ], [shops, t]);

  const rangeOptions = useMemo(() => ([
    { value: "7d", label: t("ecommerce.customerServicePerformance.ranges.7d") },
    { value: "30d", label: t("ecommerce.customerServicePerformance.ranges.30d") },
    { value: "90d", label: t("ecommerce.customerServicePerformance.ranges.90d") },
  ]), [t]);

  const realtimeRangeOptions = useMemo(() => ([
    { value: "1", label: t("ecommerce.customerServicePerformance.realtimeRanges.1h") },
    { value: "6", label: t("ecommerce.customerServicePerformance.realtimeRanges.6h") },
    { value: "12", label: t("ecommerce.customerServicePerformance.realtimeRanges.12h") },
    { value: "24", label: t("ecommerce.customerServicePerformance.realtimeRanges.24h") },
  ]), [t]);

  const downloadCsv = () => {
    const headers = [
      t("ecommerce.customerServicePerformance.table.date"),
      t("ecommerce.customerServicePerformance.table.newSessions"),
      t("ecommerce.customerServicePerformance.table.endedSessions"),
      t("ecommerce.customerServicePerformance.table.escalated"),
      t("ecommerce.customerServicePerformance.table.resolved"),
      t("ecommerce.customerServicePerformance.table.resolveRate"),
      t("ecommerce.customerServicePerformance.table.satisfaction"),
      t("ecommerce.customerServicePerformance.table.satisfaction7dWeighted"),
      t("ecommerce.customerServicePerformance.table.firstResponse"),
      t("ecommerce.customerServicePerformance.table.errors"),
      t("ecommerce.customerServicePerformance.table.guidedGmv"),
    ];
    const rows = tableRows.map((row) => [
      row.dateKey,
      metricNumber(row.newSessionCount),
      metricNumber(row.supportSessionCount),
      metricNumber(row.escalateConversations),
      metricNumber(row.escalationResolved),
      formatRate(row.escalationResolveRate),
      formatRate(row.satisfactionRate),
      formatRate(row.satisfaction7dWeighted),
      formatSeconds(row.firstResponseP50Secs),
      formatDecimal(row.errorsPerConversation),
      formatMoney(row.csGuidedGmv, row.csGuidedGmvCurrency, i18n.resolvedLanguage),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cs-performance-${range.startTime}-${range.endTime}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (authChecking) {
    return (
      <div className="page-enter">
        <div className="section-card">
          <p>{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-enter">
        <div className="section-card">
          <h2>{t("auth.loginRequired")}</h2>
          <p>{t("auth.loginFromSidebar")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter cs-performance-page">
      <div className="ecommerce-page-header cs-performance-header">
        <div>
          <h1>{t("ecommerce.customerServicePerformance.title")}</h1>
          <p className="ecommerce-page-subtitle">{t("ecommerce.customerServicePerformance.subtitle")}</p>
        </div>
      </div>

      <div className="cs-performance-tabs" role="tablist" aria-label={t("ecommerce.customerServicePerformance.tabs.label")}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "realtime"}
          className={`cs-performance-tab ${activeTab === "realtime" ? "active" : ""}`}
          onClick={() => setActiveTab("realtime")}
        >
          {t("ecommerce.customerServicePerformance.tabs.realtime")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "history"}
          className={`cs-performance-tab ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          {t("ecommerce.customerServicePerformance.tabs.history")}
        </button>
      </div>

      <div className="section-card cs-performance-toolbar">
        <label className="cs-performance-filter">
          <span>{t("ecommerce.customerServicePerformance.shopFilter")}</span>
          <Select
            ariaLabel={t("ecommerce.customerServicePerformance.shopFilter")}
            options={shopOptions}
            value={shopId}
            onChange={setShopId}
            searchable
          />
        </label>
        {activeTab === "history" ? (
          <label className="cs-performance-filter">
            <span>{t("ecommerce.customerServicePerformance.timeRange")}</span>
            <Select
              ariaLabel={t("ecommerce.customerServicePerformance.timeRange")}
              options={rangeOptions}
              value={timeRange}
              onChange={(value) => setTimeRange(value as TimeRange)}
            />
          </label>
        ) : (
          <label className="cs-performance-filter">
            <span>{t("ecommerce.customerServicePerformance.timeRange")}</span>
            <Select
              ariaLabel={t("ecommerce.customerServicePerformance.timeRange")}
              options={realtimeRangeOptions}
              value={realtimeRange}
              onChange={(value) => setRealtimeRange(value as RealtimeRange)}
            />
          </label>
        )}
        <button
          className="icon-button"
          type="button"
          onClick={() => (activeTab === "realtime" ? realtimeQuery.refetch() : historyQuery.refetch())}
          title={t("common.refresh")}
        >
          <RefreshIcon aria-hidden="true" />
        </button>
      </div>

      {error && (
        <div className="section-card cs-performance-error">
          <strong>{t("ecommerce.customerServicePerformance.loadFailed")}</strong>
          <span>{error.message}</span>
        </div>
      )}

      {activeTab === "history" ? (
        <>
          <div className="cs-performance-kpis">
            <MetricTile
              label={t("ecommerce.customerServicePerformance.metrics.sessionFlow")}
              value={formatCount(summary?.supportSessionCount)}
              detail={t("ecommerce.customerServicePerformance.metrics.newSessions", {
                value: formatCount(summary?.newSessionCount),
                defaultValue: "{{value}} new sessions",
              })}
            />
            <MetricTile
              label={t("ecommerce.customerServicePerformance.metrics.escalations")}
              value={formatCount(summary?.escalateConversations)}
              detail={t("ecommerce.customerServicePerformance.metrics.resolvedWithRate", {
                value: formatCount(summary?.escalationResolved),
                rate: formatRate(summary?.escalationResolveRate),
                defaultValue: "{{value}} resolved · {{rate}} resolve rate",
              })}
            />
            <MetricTile
              label={t("ecommerce.customerServicePerformance.metrics.satisfaction")}
              value={formatRate(summary?.satisfactionRate)}
              detail={t("ecommerce.customerServicePerformance.metrics.ratedSessions", {
                value: formatCount(summary?.ratedSessions),
                defaultValue: "{{value}} rated sessions",
              })}
            />
            <MetricTile
              label={t("ecommerce.customerServicePerformance.metrics.firstResponse")}
              value={formatSeconds(summary?.firstResponseP50Secs)}
              detail={t("ecommerce.customerServicePerformance.metrics.firstResponseSamples", {
                value: formatCount(summary?.firstResponseCount),
                defaultValue: "{{value}} measured conversations",
              })}
            />
            <MetricTile
              label={t("ecommerce.customerServicePerformance.metrics.guidedGmv")}
              value={formatMoney(
                summary?.csGuidedGmv,
                summary?.csGuidedGmvCurrency,
                i18n.resolvedLanguage,
              )}
              detail={t("ecommerce.customerServicePerformance.metrics.guidedGmvMaturity")}
              accent="gmv"
            />
          </div>

          <div className="cs-performance-chart-grid">
            <ChartPanel
              title={t("ecommerce.customerServicePerformance.charts.guidedGmv")}
              tooltip={t("ecommerce.customerServicePerformance.charts.guidedGmvTooltip")}
              loading={loading}
              empty={!hasMatureGuidedGmv}
              loadingLabel={t("common.loading")}
              emptyLabel={t("ecommerce.customerServicePerformance.guidedGmvNoMatureData")}
              wide
            >
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dateLabel" tickLine={false} />
                  <YAxis
                    tickFormatter={(value) => formatCompactMoney(Number(value), guidedGmvCurrency, i18n.resolvedLanguage)}
                    tickLine={false}
                    width={72}
                  />
                  <Tooltip
                    formatter={(value) => formatMoney(Number(value), guidedGmvCurrency, i18n.resolvedLanguage)}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="line" />
                  <Line
                    type="monotone"
                    dataKey="guidedGmvValue"
                    name={t("ecommerce.customerServicePerformance.series.guidedGmv")}
                    stroke="var(--cs-performance-gmv)"
                    strokeWidth={2.6}
                    dot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel
              title={t("ecommerce.customerServicePerformance.charts.volume")}
              loading={loading}
              empty={!chartRows.length}
              loadingLabel={t("common.loading")}
              emptyLabel={t("ecommerce.customerServicePerformance.noData")}
            >
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dateLabel" tickLine={false} />
                  <YAxis tickLine={false} width={44} />
                  <Tooltip formatter={(value) => formatCount(Number(value))} />
                  <Legend verticalAlign="bottom" height={36} iconType="line" />
                  <Line type="monotone" dataKey="newSessionCount" name={t("ecommerce.customerServicePerformance.series.newSessions")} stroke="var(--cs-performance-accent)" strokeWidth={2.4} dot={false} connectNulls />
                  <Line type="monotone" dataKey="supportSessionCount" name={t("ecommerce.customerServicePerformance.series.endedSessions")} stroke="var(--cs-performance-ink)" strokeWidth={2.4} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel
              title={t("ecommerce.customerServicePerformance.charts.escalation")}
              tooltip={t("ecommerce.customerServicePerformance.charts.escalationTooltip")}
              loading={loading}
              empty={!chartRows.length}
              loadingLabel={t("common.loading")}
              emptyLabel={t("ecommerce.customerServicePerformance.noData")}
            >
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dateLabel" tickLine={false} />
                  <YAxis tickLine={false} width={44} />
                  <Tooltip formatter={(value) => formatCount(Number(value))} />
                  <Legend verticalAlign="bottom" height={36} iconType="line" />
                  <Line type="monotone" dataKey="escalateConversations" name={t("ecommerce.customerServicePerformance.series.escalated")} stroke="var(--cs-performance-danger)" strokeWidth={2.4} dot={false} connectNulls />
                  <Line type="monotone" dataKey="escalationResolved" name={t("ecommerce.customerServicePerformance.series.resolved")} stroke="var(--cs-performance-good)" strokeWidth={2.4} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel
              title={t("ecommerce.customerServicePerformance.charts.satisfaction")}
              loading={loading}
              empty={!chartRows.length}
              loadingLabel={t("common.loading")}
              emptyLabel={t("ecommerce.customerServicePerformance.noData")}
            >
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dateLabel" tickLine={false} />
                  <YAxis tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} tickLine={false} width={44} />
                  <Tooltip formatter={(value) => formatRate(Number(value))} />
                  <Legend verticalAlign="bottom" height={36} iconType="line" />
                  <Line type="monotone" dataKey="satisfactionRate" name={t("ecommerce.customerServicePerformance.series.satisfaction")} stroke="var(--cs-performance-good)" strokeWidth={2.4} dot={false} connectNulls />
                  <Line type="monotone" dataKey="satisfaction7dWeighted" name={t("ecommerce.customerServicePerformance.series.satisfaction7dWeighted")} stroke="var(--cs-performance-accent)" strokeWidth={2.4} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel
              title={t("ecommerce.customerServicePerformance.charts.firstResponse")}
              loading={loading}
              empty={!chartRows.length}
              loadingLabel={t("common.loading")}
              emptyLabel={t("ecommerce.customerServicePerformance.noData")}
            >
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dateLabel" tickLine={false} />
                  <YAxis tickFormatter={(value) => formatSeconds(Number(value))} tickLine={false} width={44} />
                  <Tooltip formatter={(value) => formatSeconds(Number(value))} />
                  <Legend verticalAlign="bottom" height={36} iconType="line" />
                  <Line type="monotone" dataKey="firstResponseP50Secs" name={t("ecommerce.customerServicePerformance.series.firstResponseP50")} stroke="var(--cs-performance-ink)" strokeWidth={2.4} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>
          </div>
        </>
      ) : (
        <div className="cs-performance-chart-grid">
          <ChartPanel
            title={t("ecommerce.customerServicePerformance.realtimeCharts.state")}
            loading={loading}
            empty={!realtimeRows.length}
            loadingLabel={t("common.loading")}
            emptyLabel={t("ecommerce.customerServicePerformance.noData")}
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={realtimeRows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="timeLabel" tickLine={false} />
                <YAxis tickLine={false} width={44} />
                <Tooltip formatter={(value) => formatCount(Number(value))} />
                <Legend verticalAlign="bottom" height={36} iconType="line" />
                <Line type="monotone" dataKey="activeConversations" name={t("ecommerce.customerServicePerformance.series.active")} stroke="var(--cs-performance-ink)" strokeWidth={2.4} dot={false} connectNulls />
                <Line type="monotone" dataKey="pendingConversations" name={t("ecommerce.customerServicePerformance.series.pending")} stroke="var(--cs-performance-warn)" strokeWidth={2.4} dot={false} connectNulls />
                <Line type="monotone" dataKey="escalatedConversations" name={t("ecommerce.customerServicePerformance.series.escalated")} stroke="var(--cs-performance-danger)" strokeWidth={2.4} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel
            title={t("ecommerce.customerServicePerformance.realtimeCharts.escalationActivity")}
            tooltip={t("ecommerce.customerServicePerformance.realtimeCharts.escalationActivityTooltip")}
            loading={loading}
            empty={!realtimeRows.length}
            loadingLabel={t("common.loading")}
            emptyLabel={t("ecommerce.customerServicePerformance.noData")}
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={realtimeRows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="timeLabel" tickLine={false} />
                <YAxis tickLine={false} width={44} />
                <Tooltip formatter={(value) => formatCount(Number(value))} />
                <Legend verticalAlign="bottom" height={36} iconType="line" />
                <Line type="monotone" dataKey="escalationCreatedCount" name={t("ecommerce.customerServicePerformance.series.escalationCreated")} stroke="var(--cs-performance-danger)" strokeWidth={2.4} dot={false} connectNulls />
                <Line type="monotone" dataKey="escalationResolvedCount" name={t("ecommerce.customerServicePerformance.series.escalationResolved")} stroke="var(--cs-performance-accent)" strokeWidth={2.4} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel
            title={t("ecommerce.customerServicePerformance.realtimeCharts.slaBuckets")}
            loading={loading}
            empty={!realtimeRows.length}
            loadingLabel={t("common.loading")}
            emptyLabel={t("ecommerce.customerServicePerformance.noData")}
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={realtimeRows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="timeLabel" tickLine={false} />
                <YAxis tickLine={false} width={44} />
                <Tooltip formatter={(value) => formatCount(Number(value))} />
                <Legend verticalAlign="bottom" height={36} iconType="line" />
                <Line type="monotone" dataKey="pendingOver5m" name={t("ecommerce.customerServicePerformance.series.pendingOver5m")} stroke="var(--cs-performance-accent)" strokeWidth={2.4} dot={false} connectNulls />
                <Line type="monotone" dataKey="pendingOver15m" name={t("ecommerce.customerServicePerformance.series.pendingOver15m")} stroke="var(--cs-performance-warn)" strokeWidth={2.4} dot={false} connectNulls />
                <Line type="monotone" dataKey="pendingOver30m" name={t("ecommerce.customerServicePerformance.series.pendingOver30m")} stroke="var(--cs-performance-danger)" strokeWidth={2.4} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel
            title={t("ecommerce.customerServicePerformance.realtimeCharts.sessionFlow")}
            tooltip={t("ecommerce.customerServicePerformance.realtimeCharts.sessionFlowTooltip")}
            loading={loading}
            empty={!realtimeRows.length}
            loadingLabel={t("common.loading")}
            emptyLabel={t("ecommerce.customerServicePerformance.noData")}
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={realtimeRows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="timeLabel" tickLine={false} />
                <YAxis tickLine={false} width={44} />
                <Tooltip formatter={(value) => formatCount(Number(value))} />
                <Legend verticalAlign="bottom" height={36} iconType="line" />
                <Line type="monotone" dataKey="agentRoundCount" name={t("ecommerce.customerServicePerformance.series.agentRounds")} stroke="var(--cs-performance-accent)" strokeWidth={2.4} dot={false} connectNulls />
                <Line type="monotone" dataKey="endedSessionCount" name={t("ecommerce.customerServicePerformance.series.endedSessions")} stroke="var(--cs-performance-ink)" strokeWidth={2.4} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>
        </div>
      )}

      {activeTab === "history" && (
        <div className="section-card cs-performance-table-card">
        <div className="ecommerce-section-header cs-performance-table-header">
          <div>
            <h3>{t("ecommerce.customerServicePerformance.dailyTable")}</h3>
            <p className="ecommerce-section-subtitle">
              {t("ecommerce.customerServicePerformance.scopeSummary", {
                start: report?.scope.startDate ?? range.startTime,
                end: report?.scope.endDate ?? range.endTime,
                shops: formatCount(report?.scope.shopCount),
              })}
            </p>
          </div>
          <button
            className="button-secondary cs-performance-download"
            type="button"
            onClick={downloadCsv}
            disabled={!tableRows.length}
          >
            <DownloadIcon aria-hidden="true" />
            <span>{t("ecommerce.customerServicePerformance.downloadCsv")}</span>
          </button>
        </div>
        <div className="cs-performance-table-wrap">
          <table className="cs-performance-table">
            <thead>
              <tr>
                <th>{t("ecommerce.customerServicePerformance.table.date")}</th>
                <th>{t("ecommerce.customerServicePerformance.table.newSessions")}</th>
                <th>{t("ecommerce.customerServicePerformance.table.endedSessions")}</th>
                <th>{t("ecommerce.customerServicePerformance.table.escalated")}</th>
                <th>{t("ecommerce.customerServicePerformance.table.resolved")}</th>
                <th>{t("ecommerce.customerServicePerformance.table.resolveRate")}</th>
                <th>{t("ecommerce.customerServicePerformance.table.satisfaction")}</th>
                <th>{t("ecommerce.customerServicePerformance.table.satisfaction7dWeighted")}</th>
                <th>{t("ecommerce.customerServicePerformance.table.firstResponse")}</th>
                <th>{t("ecommerce.customerServicePerformance.table.errors")}</th>
                <th>{t("ecommerce.customerServicePerformance.table.guidedGmv")}</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 && (
                <tr>
                  <td colSpan={11}>{loading ? t("common.loading") : t("ecommerce.customerServicePerformance.noData")}</td>
                </tr>
              )}
              {tableRows.map((row) => (
                <tr key={row.dateKey}>
                  <td>{row.dateKey}</td>
                  <td>{formatCount(row.newSessionCount)}</td>
                  <td>{formatCount(row.supportSessionCount)}</td>
                  <td>{formatCount(row.escalateConversations)}</td>
                  <td>{formatCount(row.escalationResolved)}</td>
                  <td>{formatRate(row.escalationResolveRate)}</td>
                  <td>{formatRate(row.satisfactionRate)}</td>
                  <td>{formatRate(row.satisfaction7dWeighted)}</td>
                  <td>{formatSeconds(row.firstResponseP50Secs)}</td>
                  <td>{formatDecimal(row.errorsPerConversation)}</td>
                  <td>{formatMoney(row.csGuidedGmv, row.csGuidedGmvCurrency, i18n.resolvedLanguage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
});

function MetricTile({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: "gmv";
}) {
  return (
    <div className={`cs-performance-kpi${accent ? ` ${accent}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function ChartPanel({
  title,
  tooltip,
  loading,
  empty,
  loadingLabel,
  emptyLabel,
  wide,
  children,
}: {
  title: string;
  tooltip?: string;
  loading: boolean;
  empty: boolean;
  loadingLabel: string;
  emptyLabel: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`section-card cs-performance-chart-card${wide ? " wide" : ""}`}>
      <div className="cs-performance-chart-title">
        <h3>{title}</h3>
        {tooltip && (
          <span className="cs-performance-info" tabIndex={0}>
            <InfoIcon aria-hidden="true" />
            <span className="cs-performance-info-bubble" role="tooltip">{tooltip}</span>
          </span>
        )}
      </div>
      {empty ? (
        <div className="cs-performance-empty">{loading ? loadingLabel : emptyLabel}</div>
      ) : children}
    </div>
  );
}
