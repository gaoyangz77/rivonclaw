import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const RELIABLE_CI_WIDTH = 0.1;
const RELIABLE_COVERAGE = 0.8;
const RELIABLE_ASSIGNED_UNITS = 100;
const FLOAT_TOLERANCE = 1e-9;
const SERIES_COLORS = [
  "var(--experiment-ink)",
  "var(--experiment-brass)",
  "var(--color-info)",
  "var(--color-warning)",
  "var(--color-danger)",
  "var(--color-success)",
  "var(--color-accent-secondary)",
  "var(--color-primary)",
];

interface ExperimentPaymentProgressChartProps {
  curve?: GQL.CsExperimentTimeToEventCurveView;
  exposedUnits: number;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}

type CurvePoint = GQL.CsExperimentTimeToEventCurvePointView;
type CurveSeries = GQL.CsExperimentTimeToEventCurveSeriesView;

interface ChartRow {
  elapsedMinutes: number;
  points: Record<string, CurvePoint | undefined>;
  [key: string]: number | Record<string, CurvePoint | undefined> | null;
}

type CurveDomainSeries = Pick<CurveSeries, "seriesKey"> & {
  points: Array<
    Pick<CurvePoint, "elapsedMinutes" | "estimate"> &
      Partial<Pick<CurvePoint, "confidenceIntervalHigh" | "confidenceIntervalLow">>
  >;
};

export function isCurvePointReliable(
  point: Pick<
    CurvePoint,
    "assignedUnits" | "confidenceIntervalHigh" | "confidenceIntervalLow" | "coverageRate"
  >,
): boolean {
  return (
    point.assignedUnits >= RELIABLE_ASSIGNED_UNITS &&
    point.confidenceIntervalHigh - point.confidenceIntervalLow <=
      RELIABLE_CI_WIDTH + FLOAT_TOLERANCE &&
    point.coverageRate + FLOAT_TOLERANCE >= RELIABLE_COVERAGE
  );
}

export function defaultVisibleCurveSeries(
  series: Array<Pick<CurveSeries, "seriesKey" | "seriesRole">>,
): string[] {
  return [...series]
    .sort(
      (left, right) =>
        Number(right.seriesRole === "CONTROL") - Number(left.seriesRole === "CONTROL"),
    )
    .slice(0, 6)
    .map((item) => item.seriesKey);
}

export function zoomedCurveYAxisDomain(
  series: CurveDomainSeries[],
  visibleKeys: string[],
): [number, number] {
  const visible = new Set(visibleKeys);
  const values = series.flatMap((item) =>
    visible.has(item.seriesKey)
      ? item.points
          .filter((point) => point.elapsedMinutes > 0 && Number.isFinite(point.estimate))
          .flatMap((point) =>
            [
              point.estimate,
              point.confidenceIntervalLow,
              point.confidenceIntervalHigh,
            ]
              .filter((value): value is number => value != null && Number.isFinite(value))
              .map((value) => value * 100),
          )
      : [],
  );
  if (!values.length) return [0, 100];

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = Math.max(0.5, (maximum - minimum) * 0.15);
  let lower = Math.max(0, Math.floor((minimum - padding) * 2) / 2);
  let upper = Math.min(100, Math.ceil((maximum + padding) * 2) / 2);
  if (upper - lower < 1) {
    lower = Math.max(0, Math.floor((minimum - 0.5) * 2) / 2);
    upper = Math.min(100, Math.ceil((maximum + 0.5) * 2) / 2);
  }
  return upper > lower ? [lower, upper] : [Math.max(0, lower - 0.5), Math.min(100, upper + 0.5)];
}

function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function curveColor(index: number, series: CurveSeries): string {
  return series.seriesRole === "CONTROL"
    ? "var(--color-text-muted)"
    : SERIES_COLORS[index % SERIES_COLORS.length]!;
}

export function ExperimentPaymentProgressChart({
  curve,
  exposedUnits,
  loading,
  failed,
  onRetry,
}: ExperimentPaymentProgressChartProps) {
  const { t } = useTranslation();
  const [zoomed, setZoomed] = useState(false);
  const [search, setSearch] = useState("");
  const [visibleKeys, setVisibleKeys] = useState<string[]>([]);
  const [focusedKey, setFocusedKey] = useState("");
  const orderedSeries = useMemo(
    () =>
      [...(curve?.series ?? [])].sort((left, right) => {
        if (left.seriesRole === "CONTROL") return -1;
        if (right.seriesRole === "CONTROL") return 1;
        return left.label.localeCompare(right.label);
      }),
    [curve],
  );
  const displayLabel = (series: CurveSeries): string =>
    series.seriesRole === "CONTROL"
      ? t("ecommerce.customerServiceExperiments.curve.controlLabel")
      : series.label;

  useEffect(() => {
    const keys = orderedSeries.map((series) => series.seriesKey);
    setVisibleKeys((current) => {
      const retained = current.filter((key) => keys.includes(key));
      if (retained.length) return retained;
      return defaultVisibleCurveSeries(orderedSeries);
    });
    setFocusedKey((current) => (keys.includes(current) ? current : (keys[0] ?? "")));
  }, [orderedSeries]);

  const rows = useMemo(() => {
    const byMinute = new Map<number, ChartRow>();
    for (const series of orderedSeries) {
      let previousReliable: boolean | undefined;
      for (const point of series.points) {
        const row: ChartRow = byMinute.get(point.elapsedMinutes) ?? {
          elapsedMinutes: point.elapsedMinutes,
          points: {},
        };
        row.points[series.seriesKey] = point;
        const percent = point.estimate * 100;
        const reliable = isCurvePointReliable(point);
        row[`${series.seriesKey}:${reliable ? "reliable" : "uncertain"}`] = percent;
        // Share the transition point so reliable and directional segments meet
        // without connectNulls drawing either style across the other segment.
        if (previousReliable !== undefined && previousReliable !== reliable) {
          row[`${series.seriesKey}:${previousReliable ? "reliable" : "uncertain"}`] = percent;
        }
        previousReliable = reliable;
        row[`${series.seriesKey}:ciBase`] = point.confidenceIntervalLow * 100;
        row[`${series.seriesKey}:ciSpan`] =
          (point.confidenceIntervalHigh - point.confidenceIntervalLow) * 100;
        byMinute.set(point.elapsedMinutes, row);
      }
    }
    return [...byMinute.values()].sort((left, right) => left.elapsedMinutes - right.elapsedMinutes);
  }, [orderedSeries]);
  const visibleSeries = orderedSeries.filter((series) => visibleKeys.includes(series.seriesKey));
  const filteredSeries = orderedSeries.filter((series) =>
    displayLabel(series).toLowerCase().includes(search.trim().toLowerCase()),
  );
  const zoomDomain = zoomedCurveYAxisDomain(orderedSeries, visibleKeys);
  const chartRows = zoomed ? rows.filter((row) => row.elapsedMinutes > 0) : rows;
  const focused =
    orderedSeries.find(
      (series) => series.seriesKey === focusedKey && visibleKeys.includes(series.seriesKey),
    ) ?? visibleSeries[0];
  const focusedEndpoint = focused?.points.at(-1);

  if (loading && !curve)
    return <div className="cs-experiments-loading">{t("common.loading")}</div>;
  if (failed)
    return (
      <div className="cs-experiment-curve-empty error">
        <strong>{t("ecommerce.customerServiceExperiments.curve.loadFailed")}</strong>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={onRetry}
        >
          {t("ecommerce.customerServiceExperiments.curve.retry")}
        </button>
      </div>
    );
  if (!curve?.series.length)
    return (
      <div className="cs-experiment-curve-empty">
        <strong>{t("ecommerce.customerServiceExperiments.curve.preparingTitle")}</strong>
        <p>{t("ecommerce.customerServiceExperiments.curve.preparingBody")}</p>
      </div>
    );

  return (
    <div className="cs-experiment-curve-workbench">
      <div className="cs-experiment-curve-toolbar">
        <div>
          <span className={`cs-experiment-data-status ${curve.dataStatus.toLowerCase()}`}>
            {t(`ecommerce.customerServiceExperiments.dataStatus.${curve.dataStatus}`)}
          </span>
          <small>
            {t("ecommerce.customerServiceExperiments.curve.asOf", {
              time: new Date(curve.asOf).toLocaleString(),
            })}
          </small>
        </div>
        <label className={`cs-experiment-curve-zoom ${zoomed ? "active" : ""}`}>
          <input
            type="checkbox"
            checked={zoomed}
            onChange={(event) => setZoomed(event.target.checked)}
          />
          <span>{t("ecommerce.customerServiceExperiments.curve.zoomDifferences")}</span>
          {zoomed ? (
            <output className="cs-experiment-curve-zoom-range" aria-live="polite">
              {zoomDomain[0]}–{zoomDomain[1]}%
            </output>
          ) : null}
        </label>
      </div>
      {exposedUnits === 0 ? (
        <div className="cs-experiment-curve-context-warning" role="status">
          <strong>{t("ecommerce.customerServiceExperiments.curve.noExposureTitle")}</strong>
          <span>{t("ecommerce.customerServiceExperiments.curve.noExposureBody")}</span>
        </div>
      ) : null}
      <div className="cs-experiment-curve-legend">
        {orderedSeries.length > 6 ? (
          <div className="cs-experiment-curve-legend-tools">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("ecommerce.customerServiceExperiments.curve.searchVariants")}
              aria-label={t("ecommerce.customerServiceExperiments.curve.searchVariants")}
            />
            <button
              type="button"
              onClick={() => setVisibleKeys(orderedSeries.map((series) => series.seriesKey))}
            >
              {t("ecommerce.customerServiceExperiments.curve.selectAll")}
            </button>
            <button type="button" onClick={() => setVisibleKeys([])}>
              {t("ecommerce.customerServiceExperiments.curve.clear")}
            </button>
          </div>
        ) : null}
        <div className="cs-experiment-curve-legend-items">
          {filteredSeries.map((series) => {
            const index = orderedSeries.findIndex((item) => item.seriesKey === series.seriesKey);
            return (
              <button
                type="button"
                key={series.seriesKey}
                className={`${visibleKeys.includes(series.seriesKey) ? "active" : ""} ${series.seriesRole === "CONTROL" ? "control" : ""}`}
                onClick={() => {
                  setFocusedKey(series.seriesKey);
                  setVisibleKeys((keys) =>
                    keys.includes(series.seriesKey)
                      ? keys.filter((key) => key !== series.seriesKey)
                      : [...keys, series.seriesKey],
                  );
                }}
              >
                <i className={`series-color series-color-${index % SERIES_COLORS.length}`} />
                {displayLabel(series)}
              </button>
            );
          })}
        </div>
      </div>
      <div className={`cs-experiment-curve-chart ${zoomed ? "zoomed" : ""}`}>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={chartRows} margin={{ top: 18, right: 18, left: 4, bottom: 12 }}>
            <CartesianGrid
              strokeDasharray="2 6"
              vertical={false}
              stroke="var(--color-border-light)"
            />
            <XAxis
              type="number"
              dataKey="elapsedMinutes"
              domain={[0, curve.maxElapsedMinutes]}
              tickFormatter={formatElapsed}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              domain={zoomed ? zoomDomain : [0, 100]}
              allowDataOverflow={zoomed}
              tickCount={5}
              tickFormatter={(value) => `${value}%`}
              tick={{ fontSize: 10 }}
              width={48}
            />
            {focused ? (
              <>
                <Area
                  dataKey={`${focused.seriesKey}:ciBase`}
                  stackId="focused-ci"
                  stroke="none"
                  fill="transparent"
                />
                <Area
                  dataKey={`${focused.seriesKey}:ciSpan`}
                  stackId="focused-ci"
                  stroke="none"
                  fill="var(--experiment-curve-ci)"
                />
                {focused.stages.map((stage) => (
                  <ReferenceLine
                    key={`${focused.seriesKey}:${stage.stageIndex}:${stage.delayMinutes}`}
                    x={stage.delayMinutes}
                    stroke="var(--experiment-brass)"
                    strokeDasharray="3 5"
                    label={{
                      value: formatElapsed(stage.delayMinutes),
                      fill: "var(--color-text-muted)",
                      fontSize: 9,
                    }}
                  />
                ))}
              </>
            ) : null}
            <Tooltip
              content={({ label }) => {
                const row = rows.find((item) => item.elapsedMinutes === Number(label));
                return row ? (
                  <div className="cs-experiment-curve-tooltip">
                    <strong>{formatElapsed(row.elapsedMinutes)}</strong>
                    {visibleSeries.map((series) => {
                      const point = row.points[series.seriesKey];
                      if (!point) return null;
                      const reliable = isCurvePointReliable(point);
                      return (
                        <div key={series.seriesKey}>
                          <b>{displayLabel(series)}</b>
                          {reliable ? (
                            <span>{(point.estimate * 100).toFixed(1)}%</span>
                          ) : (
                            <em>
                              {t("ecommerce.customerServiceExperiments.curve.directionalOnly")}
                            </em>
                          )}
                          <small>
                            95% CI {(point.confidenceIntervalLow * 100).toFixed(1)}–
                            {(point.confidenceIntervalHigh * 100).toFixed(1)}%
                          </small>
                          <small>
                            {t("ecommerce.customerServiceExperiments.curve.tooltipCounts", {
                              paid: point.cumulativePaidUnits,
                              cancelled: point.cumulativeCancelledUnits,
                              censored: point.censoredUnits,
                              risk: point.atRiskUnits,
                              coverage: (point.coverageRate * 100).toFixed(0),
                            })}
                          </small>
                        </div>
                      );
                    })}
                  </div>
                ) : null;
              }}
            />
            {visibleSeries.map((series) => {
              const color = curveColor(
                orderedSeries.findIndex((item) => item.seriesKey === series.seriesKey),
                series,
              );
              return (
                <Line
                  key={`${series.seriesKey}:reliable`}
                  type="stepAfter"
                  dataKey={`${series.seriesKey}:reliable`}
                  stroke={color}
                  strokeWidth={series.seriesKey === focusedKey ? 2.6 : 1.8}
                  strokeDasharray={series.seriesRole === "CONTROL" ? "7 5" : undefined}
                  dot={false}
                  isAnimationActive={false}
                  onMouseEnter={() => setFocusedKey(series.seriesKey)}
                />
              );
            })}
            {visibleSeries.map((series) => (
              <Line
                key={`${series.seriesKey}:uncertain`}
                type="stepAfter"
                dataKey={`${series.seriesKey}:uncertain`}
                stroke={curveColor(
                  orderedSeries.findIndex((item) => item.seriesKey === series.seriesKey),
                  series,
                )}
                strokeWidth={1.5}
                strokeDasharray="2 7"
                strokeOpacity={0.35}
                dot={false}
                isAnimationActive={false}
                onMouseEnter={() => setFocusedKey(series.seriesKey)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <footer className="cs-experiment-curve-note">
        <div>
          <span>{t("ecommerce.customerServiceExperiments.curve.axisNote")}</span>
          <span>{t("ecommerce.customerServiceExperiments.curve.reliabilityNote")}</span>
        </div>
        {focusedEndpoint && isCurvePointReliable(focusedEndpoint) ? (
          <div className="cs-experiment-curve-endpoint">
            <strong>{displayLabel(focused)}</strong>
            <span>
              {t("ecommerce.customerServiceExperiments.curve.endpointCancelled", {
                value: (
                  (focusedEndpoint.cumulativeCancelledUnits / focusedEndpoint.assignedUnits) *
                  100
                ).toFixed(1),
              })}
            </span>
            <span>
              {t("ecommerce.customerServiceExperiments.curve.endpointStillUnpaid", {
                value: (
                  (focusedEndpoint.censoredUnits / focusedEndpoint.assignedUnits) *
                  100
                ).toFixed(1),
              })}
            </span>
          </div>
        ) : focusedEndpoint ? (
          <div className="cs-experiment-curve-endpoint directional">
            <strong>{displayLabel(focused)}</strong>
            <span>{t("ecommerce.customerServiceExperiments.curve.endpointDirectional")}</span>
          </div>
        ) : null}
      </footer>
    </div>
  );
}
