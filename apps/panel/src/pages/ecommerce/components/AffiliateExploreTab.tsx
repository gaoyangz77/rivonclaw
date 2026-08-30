import { useMemo, useState } from "react";
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
  AFFILIATE_BI_CATALOG_QUERY,
  AFFILIATE_BI_DATA_QUERY,
  AFFILIATE_BI_DIMENSION_VALUES_QUERY,
} from "../../../api/affiliate-analytics-queries.js";
import { Select } from "../../../components/inputs/Select.js";
import { TkSegmented, TkTableFrame } from "../../../components/design-system/index.js";
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
  removeAffiliateFilter,
  summarizeAffiliateRows,
  upsertAffiliateFilter,
  type AffiliateChartMode,
  type AffiliateDataset,
  type AffiliateExplorerDraft,
  type AffiliateFilterDraft,
  type AffiliateGranularity,
} from "../affiliate-analytics.js";
import {
  affiliateCatalogLabel,
  formatMoney,
  formatNumber,
  formatPercent,
  formatTimestamp,
  metricDisplay,
} from "../affiliate-analytics-format.js";
import {
  reconcileShopSelection,
  type AffiliateAnalyticsShop,
} from "../affiliate-analytics-scope.js";
import { AffiliateShopScopeControl } from "./AffiliateShopScopeControl.js";

type CatalogResult = { getEcommerceBiCatalog: GQL.EcomBiDatasetMetadata[] };
type DataResult = { getEcommerceBiData: GQL.EcomBiQueryResult };
type DimensionValuesResult = { getEcommerceBiDimensionValues: GQL.EcomBiDimensionValuesResult };

const CONTRACTS = [PLATFORM_DATASET, SAMPLE_DATASET] as const;
const GRANULARITIES: AffiliateGranularity[] = ["DAILY", "WEEKLY", "MONTHLY"];
const CHART_MODES: AffiliateChartMode[] = ["AUTO", "LINE", "BAR", "STACKED", "TABLE"];
const FILTER_OPERATORS = ["IN", "NOT_IN"] as const;
const SORT_DIRECTIONS = ["DESC", "ASC"] as const;
const ROW_LIMITS = [50, 100, 500] as const;
/** Stacked series colours live in CSS so both themes stay in one place. */
const STACK_COLOR_VARS = Array.from(
  { length: 8 },
  (_, index) => `var(--affiliate-stack-${index + 1})`,
);

const GROUP_PRESETS = [
  { key: "DATE", dimensions: ["DATE"] },
  { key: "SHOP", dimensions: ["SHOP_ID", "SHOP_NAME"] },
  { key: "REGION", dimensions: ["SHOP_REGION"] },
  { key: "CAMPAIGN", dimensions: ["CAMPAIGN_ID", "CAMPAIGN_NAME"] },
  {
    key: "COLLABORATION",
    dimensions: [
      "AFFILIATE_COLLABORATION_ID",
      "AFFILIATE_COLLABORATION_NAME",
      "AFFILIATE_COLLABORATION_TYPE",
    ],
  },
  { key: "CREATOR", dimensions: ["CREATOR_OPEN_ID", "CREATOR_USERNAME"] },
  { key: "PRODUCT", dimensions: ["PRODUCT_ID", "PRODUCT_NAME"] },
  { key: "DECISION_ORIGIN", dimensions: ["AFFILIATE_DECIDED_BY"] },
] as const;

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function activeChartPayload(state: unknown): Record<string, unknown> | undefined {
  if (!state || typeof state !== "object") return undefined;
  const activePayload = (state as { activePayload?: Array<{ payload?: Record<string, unknown> }> })
    .activePayload;
  return activePayload?.[0]?.payload;
}

function FreshnessBadge({
  label,
  freshness,
}: {
  label: string;
  freshness?: GQL.EcomBiFreshness | null;
}) {
  const { t, i18n } = useTranslation();
  return (
    <span
      className={`affiliate-freshness${freshness?.stale ? " is-stale" : ""}`}
      title={freshness?.warnings.join("\n")}
    >
      <i />
      <strong>{label}</strong>
      <span>
        {freshness?.stale
          ? t("ecommerce.affiliateAnalytics.stale")
          : formatTimestamp(freshness?.asOf, i18n.language)}
      </span>
    </span>
  );
}

function ExploreKpi({
  label,
  value,
  kind,
}: {
  label: string;
  value: number | null | undefined;
  kind: "number" | "money" | "rate";
}) {
  const { i18n } = useTranslation();
  const formatted =
    kind === "money"
      ? formatMoney(value, i18n.language)
      : kind === "rate"
        ? formatPercent(value, i18n.language)
        : formatNumber(value, i18n.language, true);
  return (
    <div className="affiliate-kpi">
      <span>{label}</span>
      <strong>{formatted}</strong>
    </div>
  );
}

export function AffiliateExploreTab({ shops }: { shops: AffiliateAnalyticsShop[] }) {
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

  // The draft keeps shop ids only; entitlement changes are reconciled during
  // render so an unauthorized shop can never reach the query variables.
  const shopIds = reconcileShopSelection(draft.shopIds, shops);
  const activeDraft: AffiliateExplorerDraft =
    shopIds === draft.shopIds ? draft : { ...draft, shopIds };

  const catalogQuery = useQuery<CatalogResult>(AFFILIATE_BI_CATALOG_QUERY, {
    fetchPolicy: "cache-first",
  });
  const datasets =
    catalogQuery.data?.getEcommerceBiCatalog.filter((item) =>
      CONTRACTS.includes(item.id as AffiliateDataset),
    ) ?? [];
  const catalog = datasets.find((item) => item.id === draft.datasetId);
  const groupingSets = catalog?.groupingSets ?? [];
  const legal = isAffiliateGroupingLegal(
    draft.dimensions,
    draft.filters.map((filter) => filter.dimension),
    groupingSets,
  );
  const [queryData, queryState] = useLazyQuery<DataResult, { input: GQL.EcomBiQueryInput }>(
    AFFILIATE_BI_DATA_QUERY,
    { fetchPolicy: "network-only" },
  );
  const [queryValues, valueState] = useLazyQuery<
    DimensionValuesResult,
    { input: GQL.EcomBiDimensionValuesInput }
  >(AFFILIATE_BI_DIMENSION_VALUES_QUERY, { fetchPolicy: "network-only" });

  const dimensionLabel = (id: string) =>
    affiliateCatalogLabel(
      t,
      "dimensions",
      id,
      catalog?.dimensions.find((item) => item.id === id)?.label,
    );
  const metricLabel = (id: string) =>
    affiliateCatalogLabel(t, "metrics", id, catalog?.metrics.find((item) => item.id === id)?.label);
  const fieldLabel = (id: string) =>
    catalog?.dimensions.some((item) => item.id === id) ? dimensionLabel(id) : metricLabel(id);

  const queryMetrics = (state: AffiliateExplorerDraft) => [
    ...new Set(state.metrics.flatMap((metric) => [metric, ...(RATE_COMPONENTS[metric] ?? [])])),
  ];
  const toInput = (state: AffiliateExplorerDraft, offset = 0): GQL.EcomBiQueryInput =>
    ({
      datasetId: state.datasetId,
      shopIds: state.shopIds,
      startDateGe: state.startDateGe,
      endDateLt: state.endDateLt,
      granularity: state.granularity,
      dimensions: state.dimensions,
      metrics: queryMetrics(state),
      filters: state.filters.map((filter) => ({
        dimension: filter.dimension,
        operator: filter.operator,
        values: filter.values,
      })),
      orderBy: state.sortField
        ? [
            {
              ...(state.dimensions.includes(state.sortField)
                ? { dimension: state.sortField }
                : { metric: state.sortField }),
              direction: state.sortDirection,
            },
          ]
        : [],
      limit: state.limit,
      offset,
    }) as GQL.EcomBiQueryInput;

  const execute = async (state: AffiliateExplorerDraft, append = false) => {
    const offset = append ? rows.length : 0;
    const response = await queryData({ variables: { input: toInput(state, offset) } });
    const next = response.data?.getEcommerceBiData;
    if (!next) return;
    const nextRows = next.rows as Array<Record<string, unknown>>;
    setRows((current) => (append ? mergeAffiliateResultPages(current, nextRows) : nextRows));
    setResult(next);
    setExecuted(state);
  };

  const selectPreset = (preset: (typeof GROUP_PRESETS)[number]) => {
    const active = preset.dimensions.every((dimension) => draft.dimensions.includes(dimension));
    const nextDimensions = active
      ? draft.dimensions.filter((dimension) => !preset.dimensions.includes(dimension as never))
      : [...new Set([...draft.dimensions, ...preset.dimensions])];
    if (
      !isAffiliateGroupingLegal(
        nextDimensions,
        draft.filters.map((filter) => filter.dimension),
        groupingSets,
      )
    )
      return;
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

  const searchValues = () =>
    queryValues({
      variables: {
        input: {
          datasetId: draft.datasetId,
          dimension: filterDimension,
          shopIds,
          startDateGe: draft.startDateGe,
          endDateLt: draft.endDateLt,
          search: filterSearch || null,
          limit: 25,
        } as GQL.EcomBiDimensionValuesInput,
      },
    });

  const displayedColumns =
    result?.columns.filter(
      (column) =>
        executed?.dimensions.includes(column.key) || executed?.metrics.includes(column.key),
    ) ?? [];
  const summary = summarizeAffiliateRows(rows, executed?.metrics ?? []);
  const resolvedChartMode =
    chartMode === "AUTO"
      ? automaticAffiliateChartMode(executed?.dimensions ?? draft.dimensions)
      : chartMode;
  const chartMetric = executed?.metrics[0];
  const categoryDimension = executed?.dimensions.find((dimension) => dimension !== "DATE");
  const chartRows = rows.slice(0, 50);
  const stackedChart =
    executed && chartMetric
      ? buildAffiliateStackedChartData(chartRows, executed.dimensions, chartMetric)
      : null;
  const resultChanged =
    executed != null && JSON.stringify(activeDraft) !== JSON.stringify(executed);

  /** Filter dimensions that would produce an illegal grouping cannot be chosen. */
  const filterDimensionOptions = (catalog?.dimensions ?? [])
    .filter((dimension) => dimension.filterable && dimension.id !== "DATE")
    .filter(
      (dimension) =>
        dimension.id === filterDimension ||
        isAffiliateGroupingLegal(
          draft.dimensions,
          [...draft.filters.map((filter) => filter.dimension), dimension.id],
          groupingSets,
        ),
    )
    .map((dimension) => ({ value: dimension.id, label: dimensionLabel(dimension.id) }));

  const drillFromPayload = (payload?: Record<string, unknown>) => {
    if (!payload || !categoryDimension || payload[categoryDimension] == null) return;
    const value = String(payload[categoryDimension]);
    if (!executed) return;
    const next = {
      ...executed,
      filters: upsertAffiliateFilter(executed.filters, {
        dimension: categoryDimension,
        operator: "IN",
        values: [value],
        labels: { [value]: value },
      }),
    };
    setDraft(next);
    void execute(next);
  };

  return (
    <div className="affiliate-explore" data-tutorial-id="affiliate-analytics-explore">
      <section className="affiliate-contract-selector" data-tutorial-id="affiliate-analytics-query">
        <div>
          <span>{t("ecommerce.affiliateAnalytics.explore.contract")}</span>
          <h2>{t("ecommerce.affiliateAnalytics.explore.chooseContract")}</h2>
        </div>
        {CONTRACTS.map((datasetId) => (
          <button
            key={datasetId}
            type="button"
            className={`${draft.datasetId === datasetId ? "active" : ""} ${datasetId === PLATFORM_DATASET ? "platform" : "sample"}`}
            onClick={() => {
              setDraft((current) => nextAffiliateDatasetDraft(current, datasetId));
              setRows([]);
              setResult(null);
              setExecuted(null);
            }}
          >
            {datasetId === PLATFORM_DATASET
              ? t("ecommerce.affiliateAnalytics.platformTitle")
              : t("ecommerce.affiliateAnalytics.sampleTitle")}
          </button>
        ))}
      </section>

      <section className="affiliate-query-composer">
        <div className="affiliate-composer-row">
          <AffiliateShopScopeControl
            shops={shops}
            selected={shopIds}
            onChange={(next) => setDraft((current) => ({ ...current, shopIds: next }))}
          />
          <label>
            <span>{t("ecommerce.affiliateAnalytics.startDate")}</span>
            <input
              type="date"
              value={draft.startDateGe}
              onChange={(event) =>
                setDraft((current) => ({ ...current, startDateGe: event.target.value }))
              }
            />
          </label>
          <label>
            <span>{t("ecommerce.affiliateAnalytics.endDate")}</span>
            <input
              type="date"
              value={formatInputEndDate(draft.endDateLt)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  endDateLt: endDateLtFromInclusive(event.target.value),
                }))
              }
            />
          </label>
          <label>
            <span>{t("ecommerce.affiliateAnalytics.granularity")}</span>
            <Select
              ariaLabel={t("ecommerce.affiliateAnalytics.granularity")}
              value={draft.granularity}
              options={GRANULARITIES.map((item) => ({
                value: item,
                label: t(`ecommerce.affiliateAnalytics.granularities.${item}`),
              }))}
              onChange={(value) =>
                setDraft((current) => ({ ...current, granularity: value as AffiliateGranularity }))
              }
            />
          </label>
        </div>

        <div className="affiliate-composer-grid">
          <div className="affiliate-composer-block">
            <h3>{t("ecommerce.affiliateAnalytics.explore.metrics")}</h3>
            <div className="affiliate-check-list">
              {catalog?.metrics.map((metric) => (
                <label key={metric.id} title={metric.description ?? undefined}>
                  <input
                    type="checkbox"
                    checked={draft.metrics.includes(metric.id)}
                    onChange={() =>
                      setDraft((current) => ({
                        ...current,
                        metrics: current.metrics.includes(metric.id)
                          ? current.metrics.filter((item) => item !== metric.id)
                          : [...current.metrics, metric.id],
                      }))
                    }
                  />
                  <span>{metricLabel(metric.id)}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="affiliate-composer-block">
            <h3>{t("ecommerce.affiliateAnalytics.explore.groupBy")}</h3>
            <div className="affiliate-chip-list">
              {GROUP_PRESETS.filter((preset) =>
                preset.dimensions.every((dimension) =>
                  catalog?.dimensions.some((candidate) => candidate.id === dimension),
                ),
              ).map((preset) => {
                const active = preset.dimensions.every((dimension) =>
                  draft.dimensions.includes(dimension),
                );
                const prospective = active
                  ? draft.dimensions.filter(
                      (dimension) => !preset.dimensions.includes(dimension as never),
                    )
                  : [...new Set([...draft.dimensions, ...preset.dimensions])];
                const disabled =
                  !active &&
                  !isAffiliateGroupingLegal(
                    prospective,
                    draft.filters.map((filter) => filter.dimension),
                    groupingSets,
                  );
                return (
                  <button
                    type="button"
                    key={preset.key}
                    className={active ? "active" : ""}
                    disabled={disabled}
                    onClick={() => selectPreset(preset)}
                  >
                    {t(`ecommerce.affiliateAnalytics.groupPresets.${preset.key}`)}
                  </button>
                );
              })}
            </div>
            {!legal && (
              <p className="affiliate-inline-warning">
                {t("ecommerce.affiliateAnalytics.explore.invalidGrouping")}
              </p>
            )}
          </div>
          <div className="affiliate-composer-block affiliate-filter-builder">
            <h3>{t("ecommerce.affiliateAnalytics.explore.filters")}</h3>
            <div className="affiliate-filter-fields">
              <Select
                ariaLabel={t("ecommerce.affiliateAnalytics.explore.filterDimension")}
                value={filterDimension}
                options={filterDimensionOptions}
                onChange={setFilterDimension}
              />
              <Select
                ariaLabel={t("ecommerce.affiliateAnalytics.explore.filterOperator")}
                value={filterOperator}
                options={FILTER_OPERATORS.map((operator) => ({
                  value: operator,
                  label: t(`ecommerce.affiliateAnalytics.explore.operators.${operator}`),
                }))}
                onChange={(value) => setFilterOperator(value as "IN" | "NOT_IN")}
              />
              <input
                value={filterSearch}
                placeholder={t("ecommerce.affiliateAnalytics.explore.searchValues")}
                onChange={(event) => setFilterSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void searchValues();
                }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void searchValues()}
                disabled={valueState.loading}
              >
                {t("ecommerce.affiliateAnalytics.search")}
              </button>
            </div>
            <div className="affiliate-value-results">
              {valueState.data?.getEcommerceBiDimensionValues.items.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  onClick={() => addFilter(item.value, item.label)}
                >
                  <strong>{item.label}</strong>
                  {item.secondaryLabel && <small>{item.secondaryLabel}</small>}
                </button>
              ))}
            </div>
            <div className="affiliate-manual-filter">
              <input
                value={manualFilterValue}
                placeholder={t("ecommerce.affiliateAnalytics.explore.exactValue")}
                onChange={(event) => setManualFilterValue(event.target.value)}
              />
              <button type="button" onClick={() => addFilter(manualFilterValue)}>
                {t("ecommerce.affiliateAnalytics.add")}
              </button>
            </div>
          </div>
        </div>

        <div className="affiliate-breadcrumbs">
          {draft.filters.map((filter) => (
            <button
              type="button"
              key={filter.dimension}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  filters: removeAffiliateFilter(current.filters, filter.dimension),
                }))
              }
            >
              <span>{dimensionLabel(filter.dimension)}</span>
              <strong>
                {t(`ecommerce.affiliateAnalytics.explore.operators.${filter.operator}`)}{" "}
                {filter.values.map((value) => filter.labels?.[value] ?? value).join(", ")}
              </strong>
              <b>×</b>
            </button>
          ))}
        </div>
        <div className="affiliate-run-row">
          <label>
            <span>{t("ecommerce.affiliateAnalytics.explore.sort")}</span>
            <Select
              ariaLabel={t("ecommerce.affiliateAnalytics.explore.sort")}
              value={draft.sortField}
              options={[
                { value: "", label: t("ecommerce.affiliateAnalytics.none") },
                ...[...draft.dimensions, ...draft.metrics].map((field) => ({
                  value: field,
                  label: fieldLabel(field),
                })),
              ]}
              onChange={(value) => setDraft((current) => ({ ...current, sortField: value }))}
            />
          </label>
          <label>
            <span>{t("ecommerce.affiliateAnalytics.explore.direction")}</span>
            <Select
              ariaLabel={t("ecommerce.affiliateAnalytics.explore.direction")}
              value={draft.sortDirection}
              options={SORT_DIRECTIONS.map((direction) => ({
                value: direction,
                label: t(`ecommerce.affiliateAnalytics.explore.directions.${direction}`),
              }))}
              onChange={(value) =>
                setDraft((current) => ({ ...current, sortDirection: value as "ASC" | "DESC" }))
              }
            />
          </label>
          <label>
            <span>{t("ecommerce.affiliateAnalytics.explore.limit")}</span>
            <Select
              ariaLabel={t("ecommerce.affiliateAnalytics.explore.limit")}
              value={String(draft.limit)}
              options={ROW_LIMITS.map((limit) => ({ value: String(limit), label: String(limit) }))}
              onChange={(value) => setDraft((current) => ({ ...current, limit: Number(value) }))}
            />
          </label>
          {resultChanged && (
            <span className="affiliate-dirty-query">
              {t("ecommerce.affiliateAnalytics.explore.notRun")}
            </span>
          )}
          <button
            type="button"
            className="btn btn-primary affiliate-run"
            disabled={!legal || !draft.metrics.length || !shopIds.length || queryState.loading}
            onClick={() => void execute(activeDraft)}
          >
            {queryState.loading
              ? t("ecommerce.affiliateAnalytics.running")
              : t("ecommerce.affiliateAnalytics.run")}
          </button>
        </div>
      </section>

      {queryState.error && (
        <section className="affiliate-state is-error">
          <strong>{t("ecommerce.affiliateAnalytics.errorTitle")}</strong>
          <p>{queryState.error.message}</p>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void execute(activeDraft)}
          >
            {t("ecommerce.affiliateAnalytics.retry")}
          </button>
        </section>
      )}
      {result && executed && (
        <>
          <section
            className="affiliate-result-status"
            data-tutorial-id="affiliate-analytics-results"
          >
            <div>
              <strong>
                {executed.datasetId === PLATFORM_DATASET
                  ? t("ecommerce.affiliateAnalytics.platformTitle")
                  : t("ecommerce.affiliateAnalytics.sampleTitle")}
              </strong>
              <span>
                {executed.startDateGe} → {formatInputEndDate(executed.endDateLt)}
              </span>
              <span>{t("ecommerce.affiliateAnalytics.explore.rows", { count: rows.length })}</span>
            </div>
            <FreshnessBadge
              label={t("ecommerce.affiliateAnalytics.materialized")}
              freshness={result.freshness}
            />
            {result.freshness?.warnings.map((warning) => (
              <small key={warning}>{warning}</small>
            ))}
          </section>
          <section className="affiliate-query-kpis">
            {executed.metrics.slice(0, 6).map((metric) => (
              <ExploreKpi
                key={metric}
                label={metricLabel(metric)}
                value={summary[metric]}
                kind={
                  metric.includes("GMV") || metric.includes("COMMISSION")
                    ? "money"
                    : metric.includes("RATE") || metric.includes("COVERAGE")
                      ? "rate"
                      : "number"
                }
              />
            ))}
          </section>
          {executed.metrics.some(
            (metric) => metric.endsWith("_NATIVE") && summary[metric] == null,
          ) && (
            <div className="affiliate-currency-warning">
              {t("ecommerce.affiliateAnalytics.explore.mixedCurrency")}
            </div>
          )}
          <section className="affiliate-panel affiliate-explore-chart">
            <header>
              <div>
                <span>{t("ecommerce.affiliateAnalytics.explore.visualization")}</span>
                <h2>{chartMetric ? metricLabel(chartMetric) : ""}</h2>
              </div>
              <TkSegmented
                size="sm"
                items={CHART_MODES.map((mode) => ({
                  id: mode,
                  label: t(`ecommerce.affiliateAnalytics.chartModes.${mode}`),
                }))}
                value={chartMode}
                onChange={(value) => setChartMode(value as AffiliateChartMode)}
                label={t("ecommerce.affiliateAnalytics.explore.visualization")}
              />
            </header>
            {resolvedChartMode !== "TABLE" && (
              <div className="affiliate-chart-large">
                <ResponsiveContainer width="100%" height="100%">
                  {resolvedChartMode === "LINE" ? (
                    <LineChart
                      data={chartRows}
                      onClick={(state) => drillFromPayload(activeChartPayload(state))}
                    >
                      <CartesianGrid strokeDasharray="3 6" vertical={false} />
                      <XAxis
                        dataKey={executed.dimensions.includes("DATE") ? "DATE" : categoryDimension}
                      />
                      <YAxis
                        tickFormatter={(value) => formatNumber(Number(value), i18n.language, true)}
                      />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey={chartMetric}
                        stroke={
                          executed.datasetId === PLATFORM_DATASET
                            ? "var(--affiliate-platform)"
                            : "var(--affiliate-sample)"
                        }
                        strokeWidth={3}
                      />
                    </LineChart>
                  ) : (
                    <BarChart
                      data={
                        resolvedChartMode === "STACKED" && stackedChart
                          ? stackedChart.rows
                          : chartRows
                      }
                      layout="vertical"
                      onClick={(state) => drillFromPayload(activeChartPayload(state))}
                    >
                      <CartesianGrid strokeDasharray="3 6" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis
                        type="category"
                        dataKey={
                          resolvedChartMode === "STACKED" && stackedChart
                            ? "category"
                            : categoryDimension
                        }
                        width={120}
                      />
                      <Tooltip />
                      <Legend />
                      {resolvedChartMode === "STACKED" && stackedChart ? (
                        stackedChart.series.map((series, index) => (
                          <Bar
                            key={series.key}
                            dataKey={series.key}
                            name={series.label}
                            stackId="affiliate"
                            fill={STACK_COLOR_VARS[index % STACK_COLOR_VARS.length]}
                          />
                        ))
                      ) : (
                        <Bar
                          dataKey={chartMetric}
                          fill={
                            executed.datasetId === PLATFORM_DATASET
                              ? "var(--affiliate-platform)"
                              : "var(--affiliate-sample)"
                          }
                        />
                      )}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </section>
          <section className="affiliate-panel affiliate-result-table">
            <header>
              <div>
                <span>{t("ecommerce.affiliateAnalytics.explore.detail")}</span>
                <h2>{t("ecommerce.affiliateAnalytics.explore.resultTable")}</h2>
              </div>
            </header>
            {rows.length === 0 ? (
              <div className="affiliate-state">
                <strong>{t("ecommerce.affiliateAnalytics.noDataTitle")}</strong>
                <p>{t("ecommerce.affiliateAnalytics.noDataBody")}</p>
              </div>
            ) : (
              <TkTableFrame variant="embedded" className="affiliate-table-scroll">
                <table>
                  <thead>
                    <tr>
                      {displayedColumns.map((column) => (
                        <th key={column.key}>
                          <button
                            type="button"
                            title={
                              column.metric && RATE_COMPONENTS[column.metric]
                                ? t("ecommerce.affiliateAnalytics.explore.rateTooltip", {
                                    numerator: metricLabel(RATE_COMPONENTS[column.metric][0]),
                                    denominator: metricLabel(RATE_COMPONENTS[column.metric][1]),
                                  })
                                : undefined
                            }
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                sortField: column.key,
                                sortDirection:
                                  current.sortField === column.key &&
                                  current.sortDirection === "DESC"
                                    ? "ASC"
                                    : "DESC",
                              }))
                            }
                          >
                            {column.dimension
                              ? dimensionLabel(column.key)
                              : metricLabel(column.key)}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {displayedColumns.map((column) => (
                          <td key={column.key}>
                            {column.dimension && row[column.key] != null ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const value = String(row[column.key]);
                                  const next = {
                                    ...executed,
                                    filters: upsertAffiliateFilter(executed.filters, {
                                      dimension: column.dimension!,
                                      operator: "IN",
                                      values: [value],
                                      labels: { [value]: value },
                                    }),
                                  };
                                  setDraft(next);
                                  void execute(next);
                                }}
                              >
                                {String(row[column.key])}
                              </button>
                            ) : (
                              metricDisplay(
                                row[column.key] == null ? null : numberValue(row[column.key]),
                                column.key,
                                i18n.language,
                              )
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TkTableFrame>
            )}
            {result.pageInfo.hasMore && (
              <button
                className="btn btn-secondary affiliate-load-more"
                type="button"
                disabled={queryState.loading}
                onClick={() => void execute(executed, true)}
              >
                {t("ecommerce.affiliateAnalytics.loadMore")}
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
