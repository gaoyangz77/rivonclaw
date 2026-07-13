import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { observer } from "mobx-react-lite";
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
import { GQL } from "@rivonclaw/core";
import {
  ECOMMERCE_GET_CS_EXPERIMENT_PAGE,
  ECOMMERCE_GET_CS_EXPERIMENT_WORKSPACE,
} from "../../api/cs-experiment-queries.js";
import { RefreshIcon } from "../../components/icons.js";
import { Select } from "../../components/inputs/Select.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { ExperimentPaymentProgressChart } from "./ExperimentPaymentProgressChart.js";

type View = "REALTIME" | "HISTORY";
type SignalView = "PAYMENT_PROGRESS" | "METRIC_TREND";
const REALTIME_REFRESH_INTERVAL_MS = 5 * 60_000;

interface ExperimentWorkspaceData {
  ecommerceGetCSExperimentDetail: GQL.CsExperimentDetailView;
  ecommerceGetCSExperimentTimeToEventCurve?: GQL.CsExperimentTimeToEventCurveView;
  ecommerceGetCSExperimentTrend?: GQL.CsExperimentTrendView;
}

interface ExperimentWorkspaceVariables {
  experimentId: string;
  curveInput: GQL.CsExperimentTimeToEventCurveInput;
  trendInput: GQL.CsExperimentTrendInput;
  includeCurve: boolean;
  includeTrend: boolean;
}
const METRICS: GQL.CsExperimentMetricKey[] = [
  "PAYMENT_WITHIN_WINDOW",
  "GMV_PER_ASSIGNED_ORDER",
  "UNITS_PER_ASSIGNED_ORDER",
  "PAYMENT_LATENCY",
  "MESSAGE_SEND_FAILURE_RATE",
];
const SERIES_COLORS = [
  "#176b67",
  "#d58b38",
  "#5e75b8",
  "#a6546f",
  "#6a8d3b",
  "#845ec2",
  "#b85f3c",
  "#2b7a9b",
];

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const view: View = params.get("view") === "history" ? "HISTORY" : "REALTIME";
  return {
    view,
    experimentId: params.get("experimentId") ?? "",
    metric: (METRICS.includes(params.get("metric") as GQL.CsExperimentMetricKey)
      ? params.get("metric")
      : "PAYMENT_WITHIN_WINDOW") as GQL.CsExperimentMetricKey,
    range: params.get("range") ?? (view === "REALTIME" ? "REALTIME_24H" : "DAILY_30D"),
  };
}

function usePageVisibility(): boolean {
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

function formatDate(value?: string | null, includeTime = true): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(
    undefined,
    includeTime
      ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
      : { year: "numeric", month: "short", day: "numeric" },
  ).format(date);
}
function formatMetric(metric: GQL.CsExperimentMetricKey, value?: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (metric === "PAYMENT_WITHIN_WINDOW" || metric === "MESSAGE_SEND_FAILURE_RATE")
    return `${(value * 100).toFixed(2)}%`;
  if (metric === "PAYMENT_LATENCY")
    return value >= 3_600 ? `${(value / 3_600).toFixed(1)}h` : `${(value / 60).toFixed(1)}m`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function formatLift(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}

export const CustomerServiceExperimentsPage = observer(function CustomerServiceExperimentsPage() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const initial = useMemo(readUrlState, []);
  const [view, setView] = useState<View>(initial.view);
  const [experimentId, setExperimentId] = useState(initial.experimentId);
  const [metric, setMetric] = useState<GQL.CsExperimentMetricKey>(initial.metric);
  const [range, setRange] = useState(initial.range);
  const [typeFilter, setTypeFilter] = useState("");
  const [shopId, setShopId] = useState("");
  const [signalView, setSignalView] = useState<SignalView>("PAYMENT_PROGRESS");
  const visible = usePageVisibility();

  useEffect(() => {
    if (entityStore.currentUser) entityStore.fetchShops().catch(() => {});
  }, [entityStore, entityStore.currentUser]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("view", view.toLowerCase());
    if (experimentId) params.set("experimentId", experimentId);
    params.set("metric", metric);
    params.set("range", range);
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }, [view, experimentId, metric, range]);

  const pageQuery = useQuery<{ ecommerceGetCSExperimentPage: GQL.CsExperimentPageResult }>(
    ECOMMERCE_GET_CS_EXPERIMENT_PAGE,
    {
      variables: {
        input: { view, experimentType: typeFilter || null, shopId: shopId || null, limit: 20 },
      },
      skip: !entityStore.currentUser,
      fetchPolicy: "cache-and-network",
      pollInterval: view === "REALTIME" && visible ? REALTIME_REFRESH_INTERVAL_MS : 0,
      notifyOnNetworkStatusChange: true,
    },
  );
  const items = pageQuery.data?.ecommerceGetCSExperimentPage.items ?? [];

  useEffect(() => {
    if (!items.length) {
      if (!pageQuery.loading) setExperimentId("");
      return;
    }
    if (!experimentId || !items.some((item) => item.id === experimentId))
      setExperimentId(items[0]!.id);
  }, [items, experimentId, pageQuery.loading]);

  const validRanges =
    view === "REALTIME"
      ? ["REALTIME_6H", "REALTIME_24H", "REALTIME_72H"]
      : ["DAILY_30D", "DAILY_90D"];
  const effectiveRange = (validRanges.includes(range)
    ? range
    : view === "REALTIME"
      ? "REALTIME_24H"
      : "DAILY_30D") as GQL.CsExperimentTrendRange;
  useEffect(() => {
    if (range !== effectiveRange) setRange(effectiveRange);
  }, [view, range]);
  const workspaceQuery = useQuery<ExperimentWorkspaceData, ExperimentWorkspaceVariables>(
    ECOMMERCE_GET_CS_EXPERIMENT_WORKSPACE,
    {
      variables: {
        experimentId,
        curveInput: {
          experimentId,
          eventKey: GQL.CsExperimentOutcomeEventKey.CsUnpaidPayment,
        },
        trendInput: { experimentId, metricKey: metric, range: effectiveRange },
        includeCurve: signalView === "PAYMENT_PROGRESS",
        includeTrend: signalView === "METRIC_TREND",
      },
      skip: !experimentId,
      fetchPolicy: "cache-and-network",
      errorPolicy: "all",
      notifyOnNetworkStatusChange: true,
      pollInterval: view === "REALTIME" && visible ? REALTIME_REFRESH_INTERVAL_MS : 0,
    },
  );
  const workspaceData =
    workspaceQuery.data?.ecommerceGetCSExperimentDetail.id === experimentId
      ? workspaceQuery.data
      : workspaceQuery.previousData?.ecommerceGetCSExperimentDetail.id === experimentId
        ? workspaceQuery.previousData
        : undefined;
  const detail = workspaceData?.ecommerceGetCSExperimentDetail;
  const trend = workspaceData?.ecommerceGetCSExperimentTrend;
  const curve = workspaceData?.ecommerceGetCSExperimentTimeToEventCurve;

  const chart = useMemo(() => {
    const rows = new Map<string, Record<string, string | number | null>>();
    const series = new Set<string>();
    for (const point of trend?.points ?? []) {
      const key = point.bucketStart;
      const seriesKey = `${point.variantKey}${point.dimensionValue ? ` · ${point.dimensionValue}` : ""}`;
      series.add(seriesKey);
      const row: Record<string, string | number | null> =
        rows.get(key) ?? { bucketStart: key, label: formatDate(key) };
      row[seriesKey] = point.value ?? null;
      rows.set(key, row);
    }
    return { rows: [...rows.values()], series: [...series] };
  }, [trend]);

  const metricRows = detail?.metrics.filter((item) => item.metricKey === metric) ?? [];
  const comparisons = detail?.comparisons.filter((item) => item.metricKey === metric) ?? [];
  const shops = [
    { value: "", label: t("ecommerce.customerServiceExperiments.filters.allShops") },
    ...entityStore.shops.map((shop) => ({
      value: shop.id,
      label: shop.alias || shop.shopName || shop.platformShopId || shop.id,
    })),
  ];
  const maturity =
    detail?.quality && detail.quality.assignedUnits > 0
      ? detail.quality.maturedUnits / detail.quality.assignedUnits
      : 0;

  const switchView = (next: View) => {
    setView(next);
    setExperimentId("");
    setRange(next === "REALTIME" ? "REALTIME_24H" : "DAILY_30D");
  };
  const loadMore = () => {
    const cursor = pageQuery.data?.ecommerceGetCSExperimentPage.nextCursor;
    if (!cursor) return;
    void pageQuery.fetchMore({
      variables: {
        input: {
          view,
          experimentType: typeFilter || null,
          shopId: shopId || null,
          cursor,
          limit: 20,
        },
      },
      updateQuery: (previous, { fetchMoreResult }) => ({
        ecommerceGetCSExperimentPage: {
          ...fetchMoreResult.ecommerceGetCSExperimentPage,
          items: [
            ...previous.ecommerceGetCSExperimentPage.items,
            ...fetchMoreResult.ecommerceGetCSExperimentPage.items,
          ],
        },
      }),
    });
  };
  const refreshActiveView = () => {
    void Promise.all([
      pageQuery.refetch(),
      experimentId ? workspaceQuery.refetch() : Promise.resolve(undefined),
    ]);
  };

  if (!entityStore.currentUser)
    return (
      <div className="page-enter">
        <div className="section-card">
          <h2>{t("auth.loginRequired")}</h2>
        </div>
      </div>
    );

  return (
    <div className="page-enter cs-experiments-page">
      <header className="page-header cs-experiments-header">
        <div>
          <div className="cs-experiments-eyebrow">
            {t("ecommerce.customerServiceExperiments.eyebrow")}
          </div>
          <h1>{t("ecommerce.customerServiceExperiments.title")}</h1>
          <p>{t("ecommerce.customerServiceExperiments.subtitle")}</p>
        </div>
        <div
          className="cs-experiments-tabs"
          role="tablist"
          aria-label={t("ecommerce.customerServiceExperiments.tabs.label")}
        >
          {(["REALTIME", "HISTORY"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={view === item}
              className={view === item ? "active" : ""}
              onClick={() => switchView(item)}
            >
              <span className="cs-experiments-tab-dot" />
              {t(`ecommerce.customerServiceExperiments.tabs.${item.toLowerCase()}`)}
            </button>
          ))}
        </div>
      </header>

      <div className="section-card cs-experiments-toolbar">
        <label className="cs-experiments-toolbar-field">
          <span>{t("ecommerce.customerServiceExperiments.filters.shop")}</span>
          <Select
            value={shopId}
            onChange={setShopId}
            options={shops}
            searchable
            className="cs-experiments-filter-select"
          />
        </label>
        <label className="cs-experiments-toolbar-field">
          <span>{t("ecommerce.customerServiceExperiments.filters.type")}</span>
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            className="cs-experiments-filter-select"
            options={[
              { value: "", label: t("ecommerce.customerServiceExperiments.filters.allTypes") },
              { value: "HOLDOUT", label: t("ecommerce.customerServiceExperiments.types.holdout") },
              { value: "CONFIG", label: t("ecommerce.customerServiceExperiments.types.config") },
            ]}
          />
        </label>
        <button
          type="button"
          className="icon-button"
          aria-label={t("common.refresh")}
          onClick={refreshActiveView}
        >
          <RefreshIcon />
        </button>
        <div className="cs-experiments-freshness">
          <span />
          {t("ecommerce.customerServiceExperiments.asOf", {
            time: formatDate(pageQuery.data?.ecommerceGetCSExperimentPage.asOf),
          })}
        </div>
      </div>

      {pageQuery.error ? (
        <div className="section-card cs-experiments-error">
          {t("ecommerce.customerServiceExperiments.loadFailed")}: {pageQuery.error.message}
        </div>
      ) : null}
      {!pageQuery.loading && !items.length ? (
        <div className="section-card cs-experiments-empty">
          <div className="cs-experiments-empty-mark">∅</div>
          <h3>{t("ecommerce.customerServiceExperiments.emptyTitle")}</h3>
          <p>{t("ecommerce.customerServiceExperiments.emptyBody")}</p>
        </div>
      ) : null}

      {items.length ? (
        <div className="cs-experiments-workbench">
          <aside
            className="section-card cs-experiment-list"
            aria-label={t("ecommerce.customerServiceExperiments.experimentList")}
          >
            <div className="cs-experiment-list-heading">
              <span>
                {view === "REALTIME"
                  ? t("ecommerce.customerServiceExperiments.liveQueue")
                  : t("ecommerce.customerServiceExperiments.archive")}
              </span>
              <b>{items.length}</b>
            </div>
            <div className="cs-experiment-list-scroll">
              {items.map((item) => {
                const progress =
                  item.quality && item.quality.assignedUnits
                    ? item.quality.maturedUnits / item.quality.assignedUnits
                    : 0;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`cs-experiment-list-item${experimentId === item.id ? " active" : ""}`}
                    onClick={() => setExperimentId(item.id)}
                  >
                    <span className={`cs-experiment-status ${item.displayStatus.toLowerCase()}`}>
                      {t(`ecommerce.customerServiceExperiments.status.${item.displayStatus}`)}
                    </span>
                    <strong>
                      {item.experimentType === "HOLDOUT"
                        ? t("ecommerce.customerServiceExperiments.types.holdout")
                        : t("ecommerce.customerServiceExperiments.types.config")}
                    </strong>
                    <small>
                      {item.targets.map((target) => target.name || target.id).join(", ") ||
                        t("ecommerce.customerServiceExperiments.unknownShop")}
                    </small>
                    <div className="cs-experiment-mini-progress">
                      <i style={{ width: `${Math.min(progress * 100, 100)}%` }} />
                    </div>
                    <footer>
                      <span>
                        v{item.version} · {item.variantCount}{" "}
                        {t("ecommerce.customerServiceExperiments.variants")}
                      </span>
                      <span>{Math.round(progress * 100)}%</span>
                    </footer>
                  </button>
                );
              })}
            </div>
            {pageQuery.data?.ecommerceGetCSExperimentPage.nextCursor ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm cs-experiment-load-more"
                onClick={loadMore}
              >
                {t("ecommerce.customerServiceExperiments.loadMore")}
              </button>
            ) : null}
          </aside>

          <main className="cs-experiment-detail">
            {workspaceQuery.error && !detail ? (
              <div className="section-card cs-experiments-error">{workspaceQuery.error.message}</div>
            ) : null}
            {!detail && workspaceQuery.loading ? (
              <div className="section-card cs-experiments-loading">{t("common.loading")}</div>
            ) : null}
            {detail ? (
              <>
                <section className="section-card cs-experiment-overview">
                  <div className="cs-experiment-overview-title">
                    <div>
                      <span
                        className={`cs-experiment-status ${detail.displayStatus.toLowerCase()}`}
                      >
                        {t(`ecommerce.customerServiceExperiments.status.${detail.displayStatus}`)}
                      </span>
                      <h2>
                        {detail.experimentType === "HOLDOUT"
                          ? t("ecommerce.customerServiceExperiments.types.holdout")
                          : t("ecommerce.customerServiceExperiments.types.config")}
                      </h2>
                      <p>
                        {detail.targets
                          .map(
                            (target) =>
                              `${target.name || target.id}${target.region ? ` · ${target.region}` : ""}`,
                          )
                          .join("  /  ")}
                      </p>
                    </div>
                    <div className="cs-experiment-id">
                      <span>ID</span>
                      <code>{detail.id}</code>
                    </div>
                  </div>
                  <div className="cs-experiment-stat-strip">
                    <div>
                      <span>{t("ecommerce.customerServiceExperiments.kpis.assigned")}</span>
                      <strong>{detail.quality?.assignedUnits.toLocaleString() ?? "—"}</strong>
                    </div>
                    <div>
                      <span>{t("ecommerce.customerServiceExperiments.kpis.matured")}</span>
                      <strong>{detail.quality?.maturedUnits.toLocaleString() ?? "—"}</strong>
                      <small>{(maturity * 100).toFixed(1)}%</small>
                    </div>
                    <div>
                      <span>{t("ecommerce.customerServiceExperiments.kpis.variants")}</span>
                      <strong>{detail.variantCount}</strong>
                    </div>
                    <div>
                      <span>{t("ecommerce.customerServiceExperiments.kpis.srm")}</span>
                      <strong>
                        {detail.quality?.srmPValue == null
                          ? "—"
                          : detail.quality.srmPValue.toFixed(3)}
                      </strong>
                      <small>
                        {detail.quality?.srmPValue != null && detail.quality.srmPValue < 0.01
                          ? t("ecommerce.customerServiceExperiments.kpis.review")
                          : t("ecommerce.customerServiceExperiments.kpis.healthy")}
                      </small>
                    </div>
                    <div>
                      <span>{t("ecommerce.customerServiceExperiments.kpis.started")}</span>
                      <strong className="date">{formatDate(detail.startedAt)}</strong>
                    </div>
                  </div>
                </section>

                <section className="section-card cs-experiment-variants">
                  <div className="cs-experiment-section-heading">
                    <div>
                      <span>01</span>
                      <h3>{t("ecommerce.customerServiceExperiments.allocation")}</h3>
                    </div>
                    <small>{t("ecommerce.customerServiceExperiments.allocationHint")}</small>
                  </div>
                  <div className="cs-experiment-allocation-bar">
                    {detail.variants.map((variant, index) => (
                      <i
                        key={variant.variantKey}
                        style={{
                          width: `${variant.weightBps / 100}%`,
                          background: SERIES_COLORS[index % SERIES_COLORS.length],
                        }}
                        title={`${variant.label}: ${variant.weightBps / 100}%`}
                      />
                    ))}
                  </div>
                  <div className="cs-experiment-variant-grid">
                    {detail.variants.map((variant, index) => (
                      <article key={variant.variantKey}>
                        <header>
                          <i style={{ background: SERIES_COLORS[index % SERIES_COLORS.length] }} />
                          <strong>{variant.label}</strong>
                          <b>{(variant.weightBps / 100).toFixed(0)}%</b>
                        </header>
                        <small>
                          {variant.variantKey} ·{" "}
                          {t(`ecommerce.customerServiceExperiments.actions.${variant.action}`)}
                        </small>
                        {variant.stages.length ? (
                          <div className="cs-experiment-stage-line">
                            {variant.stages.map((stage) => (
                              <span
                                key={stage.stageId}
                                className={!stage.enabled ? "disabled" : ""}
                              >
                                {stage.delayMinutes}m
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="cs-experiment-stage-line muted">
                            {variant.action === "CONTINUE"
                              ? t("ecommerce.customerServiceExperiments.usesBaseConfiguration")
                              : t("ecommerce.customerServiceExperiments.noReachout")}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </section>

                <section className="section-card cs-experiment-analysis">
                  <div className="cs-experiment-section-heading">
                    <div>
                      <span>02</span>
                      <h3>{t("ecommerce.customerServiceExperiments.analysis")}</h3>
                    </div>
                    <span
                      className={`cs-experiment-data-status ${detail.dataStatus.toLowerCase()}`}
                    >
                      {t(`ecommerce.customerServiceExperiments.dataStatus.${detail.dataStatus}`)}
                    </span>
                  </div>
                  <div className="cs-experiment-signal-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={signalView === "PAYMENT_PROGRESS"}
                      className={signalView === "PAYMENT_PROGRESS" ? "active" : ""}
                      onClick={() => setSignalView("PAYMENT_PROGRESS")}
                    >
                      {t("ecommerce.customerServiceExperiments.curve.paymentProgress")}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={signalView === "METRIC_TREND"}
                      className={signalView === "METRIC_TREND" ? "active" : ""}
                      onClick={() => setSignalView("METRIC_TREND")}
                    >
                      {t("ecommerce.customerServiceExperiments.curve.metricTrend")}
                    </button>
                  </div>
                  {signalView === "PAYMENT_PROGRESS" ? (
                    <ExperimentPaymentProgressChart
                      curve={curve}
                      exposedUnits={detail.quality?.exposedUnits ?? 0}
                      loading={workspaceQuery.loading}
                      failed={Boolean(workspaceQuery.error)}
                      onRetry={() => void workspaceQuery.refetch()}
                    />
                  ) : (
                    <>
                      <div className="cs-experiment-analysis-controls">
                        <Select
                          value={metric}
                          onChange={(value) => setMetric(value as GQL.CsExperimentMetricKey)}
                          options={METRICS.map((value) => ({
                            value,
                            label: t(`ecommerce.customerServiceExperiments.metrics.${value}`),
                          }))}
                        />
                        <Select
                          value={range}
                          onChange={setRange}
                          options={validRanges.map((value) => ({
                            value,
                            label: t(`ecommerce.customerServiceExperiments.ranges.${value}`),
                          }))}
                        />
                      </div>
                      <div className="cs-experiment-metric-cards">
                        {metricRows.map((item, index) => (
                          <div key={`${item.variantKey}:${item.dimensionValue}`}>
                            <i style={{ background: SERIES_COLORS[index % SERIES_COLORS.length] }} />
                            <span>
                              {item.variantKey}
                              {item.dimensionValue ? ` · ${item.dimensionValue}` : ""}
                            </span>
                            <strong>{formatMetric(metric, item.value)}</strong>
                            <small>n = {item.observedUnits.toLocaleString()}</small>
                          </div>
                        ))}
                      </div>
                      <div className="cs-experiment-chart">
                        {workspaceQuery.loading && !trend ? (
                          <div className="cs-experiments-loading">{t("common.loading")}</div>
                        ) : detail.quality?.maturedUnits === 0 ? (
                          <div className="cs-experiment-maturity-empty">
                            <strong>
                              {t("ecommerce.customerServiceExperiments.awaitingMaturityTitle")}
                            </strong>
                            <p>
                              {t("ecommerce.customerServiceExperiments.awaitingMaturityBody", {
                                assigned: detail.quality.assignedUnits.toLocaleString(),
                                time: formatDate(detail.quality.nextMaturityAt),
                              })}
                            </p>
                          </div>
                        ) : chart.rows.length ? (
                          <ResponsiveContainer width="100%" height={280}>
                            <LineChart
                              data={chart.rows}
                              margin={{ top: 12, right: 18, left: 4, bottom: 4 }}
                            >
                              <CartesianGrid
                                strokeDasharray="2 6"
                                vertical={false}
                                stroke="var(--color-border-light)"
                              />
                              <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={36} />
                              <YAxis
                                tick={{ fontSize: 11 }}
                                tickFormatter={(value) => formatMetric(metric, value)}
                                width={64}
                              />
                              <Tooltip formatter={(value) => formatMetric(metric, Number(value))} />
                              {chart.series.map((series, index) => (
                                <Line
                                  key={series}
                                  type="monotone"
                                  dataKey={series}
                                  stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                                  strokeWidth={2}
                                  dot={false}
                                  connectNulls
                                />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="cs-experiments-chart-empty">
                            {t("ecommerce.customerServiceExperiments.noTrend")}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </section>

                <section className="section-card cs-experiment-comparisons">
                  <div className="cs-experiment-section-heading">
                    <div>
                      <span>03</span>
                      <h3>{t("ecommerce.customerServiceExperiments.comparisons")}</h3>
                    </div>
                    <small>{t("ecommerce.customerServiceExperiments.comparisonHint")}</small>
                  </div>
                  {comparisons.length ? (
                    <div className="cs-experiment-comparison-table">
                      <table>
                        <thead>
                          <tr>
                            <th>{t("ecommerce.customerServiceExperiments.table.comparison")}</th>
                            <th>{t("ecommerce.customerServiceExperiments.table.rate")}</th>
                            <th>{t("ecommerce.customerServiceExperiments.table.lift")}</th>
                            <th>95% CI</th>
                            <th>p</th>
                            <th>{t("ecommerce.customerServiceExperiments.table.signal")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparisons.map((item) => (
                            <tr key={`${item.baselineVariantKey}:${item.variantKey}`}>
                              <td>
                                <strong>{item.variantKey}</strong>
                                <span>vs {item.baselineVariantKey}</span>
                              </td>
                              <td>{formatMetric(metric, item.variantValue)}</td>
                              <td
                                className={
                                  (item.relativeEffect ?? 0) >= 0 ? "positive" : "negative"
                                }
                              >
                                {formatLift(item.relativeEffect)}
                              </td>
                              <td>
                                {item.confidenceIntervalLow == null
                                  ? "—"
                                  : `${formatLift(item.confidenceIntervalLow)} – ${formatLift(item.confidenceIntervalHigh)}`}
                              </td>
                              <td>
                                {item.adjustedPValue?.toFixed(4) ?? item.pValue?.toFixed(4) ?? "—"}
                              </td>
                              <td>
                                <span
                                  className={
                                    item.insufficientSample ? "signal waiting" : "signal ready"
                                  }
                                >
                                  {item.insufficientSample
                                    ? t("ecommerce.customerServiceExperiments.insufficient")
                                    : t("ecommerce.customerServiceExperiments.ready")}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : detail.quality?.maturedUnits === 0 ? (
                    <div className="cs-experiment-maturity-empty compact">
                      <strong>
                        {t("ecommerce.customerServiceExperiments.comparisonAwaitingTitle")}
                      </strong>
                      <p>
                        {t("ecommerce.customerServiceExperiments.comparisonAwaitingBody", {
                          time: formatDate(detail.quality.nextMaturityAt),
                        })}
                      </p>
                    </div>
                  ) : (
                    <div className="cs-experiments-chart-empty">
                      {t("ecommerce.customerServiceExperiments.noComparison")}
                    </div>
                  )}
                </section>
              </>
            ) : null}
          </main>
        </div>
      ) : null}
    </div>
  );
});
