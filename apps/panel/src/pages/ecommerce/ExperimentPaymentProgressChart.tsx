import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
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
  experimentId: string;
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

interface CurveTimeDomain {
  start: number;
  end: number;
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

export function sortCurveTooltipSeries(
  series: CurveSeries[],
  points: Record<string, Pick<CurvePoint, "estimate"> | undefined>,
): CurveSeries[] {
  return [...series]
    .filter((item) => points[item.seriesKey] != null)
    .sort((left, right) => {
      const estimateDifference =
        (points[right.seriesKey]?.estimate ?? Number.NEGATIVE_INFINITY) -
        (points[left.seriesKey]?.estimate ?? Number.NEGATIVE_INFINITY);
      return estimateDifference || left.seriesKey.localeCompare(right.seriesKey);
    });
}

export function curveYAxisDomain(
  series: CurveDomainSeries[],
  visibleKeys: string[],
): [number, number] {
  const visible = new Set(visibleKeys);
  const values = series.flatMap((item) =>
    visible.has(item.seriesKey)
      ? item.points
          .filter((point) => point.elapsedMinutes > 0 && Number.isFinite(point.estimate))
          .map((point) => point.estimate * 100)
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

export function firstPositiveCurveMinute(points: Array<{ elapsedMinutes: number }>): number {
  const positive = points
    .map((point) => point.elapsedMinutes)
    .filter((minute) => Number.isFinite(minute) && minute > 0);
  return positive.length ? Math.min(...positive) : 1;
}

export function normalizeCurveTimeDomain(
  start: number,
  end: number,
  minimum: number,
  maximum: number,
): CurveTimeDomain | null {
  if (![start, end, minimum, maximum].every(Number.isFinite) || maximum <= minimum) return null;
  const lower = Math.max(minimum, Math.min(start, end));
  const upper = Math.min(maximum, Math.max(start, end));
  if (upper - lower < 1) return null;
  if (lower <= minimum && upper >= maximum) return null;
  return { start: lower, end: upper };
}

export function curveTimeWindowPresets(maximum: number): number[] {
  return [30, 60, 360, 1_440].filter((minutes) => minutes < maximum);
}

function activeChartMinute(event: unknown): number | null {
  if (!event || typeof event !== "object" || !("activeLabel" in event)) return null;
  const value = Number((event as { activeLabel?: unknown }).activeLabel);
  return Number.isFinite(value) ? value : null;
}

export function curveInterpolationType(
  estimator: GQL.CsExperimentCurveEstimator | undefined,
): "monotoneX" | "stepAfter" {
  return estimator === GQL.CsExperimentCurveEstimator.AalenJohansen ? "stepAfter" : "monotoneX";
}

function curveColor(index: number, series: CurveSeries): string {
  return series.seriesRole === "CONTROL"
    ? "var(--experiment-ink)"
    : SERIES_COLORS[index % SERIES_COLORS.length]!;
}

export function curveLinePresentation(
  seriesRole: CurveSeries["seriesRole"],
  reliable: boolean,
  focused: boolean,
): { strokeWidth: number; strokeDasharray?: string; strokeOpacity: number } {
  if (seriesRole === "CONTROL") {
    return {
      strokeWidth: focused ? 3.4 : 3,
      strokeDasharray: "12 5",
      strokeOpacity: reliable ? 1 : 0.88,
    };
  }
  if (reliable) return { strokeWidth: focused ? 2.7 : 1.9, strokeOpacity: 1 };
  return {
    strokeWidth: focused ? 2.3 : 1.9,
    strokeDasharray: "5 4",
    strokeOpacity: focused ? 0.78 : 0.62,
  };
}

export function ExperimentPaymentProgressChart({
  experimentId,
  curve,
  exposedUnits,
  loading,
  failed,
  onRetry,
}: ExperimentPaymentProgressChartProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;
  const [search, setSearch] = useState("");
  const [visibleKeys, setVisibleKeys] = useState<string[]>([]);
  const [focusedKey, setFocusedKey] = useState("");
  const [timeDomain, setTimeDomain] = useState<CurveTimeDomain | null>(null);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const initializedExperimentRef = useRef<string | null>(null);
  const formatElapsed = (minutes: number): string => {
    if (minutes < 60)
      return t("ecommerce.customerServiceExperiments.duration.minute", { count: minutes });
    return t("ecommerce.customerServiceExperiments.duration.hour", {
      count: Number((minutes / 60).toFixed(Number.isInteger(minutes / 60) ? 0 : 1)),
    });
  };
  const orderedSeries = useMemo(
    () =>
      [...(curve?.series ?? [])].sort((left, right) => {
        if (left.seriesRole === "CONTROL") return -1;
        if (right.seriesRole === "CONTROL") return 1;
        return left.label.localeCompare(right.label);
      }),
    [curve],
  );
  const displayLabel = (series: CurveSeries): string => {
    if (series.seriesRole === "CONTROL")
      return t("ecommerce.customerServiceExperiments.curve.controlLabel");
    if (series.seriesKey.trim().toUpperCase() === "PRODUCTION_CONFIG")
      return t("ecommerce.customerServiceExperiments.terms.productionConfig");
    if (
      series.seriesRole === "TREATMENT" ||
      series.seriesKey.trim().toUpperCase() === "TREATMENT" ||
      series.label.trim().toUpperCase() === "TREATMENT"
    )
      return t("ecommerce.customerServiceExperiments.terms.treatment");
    return series.label;
  };

  useEffect(() => {
    const keys = orderedSeries.map((series) => series.seriesKey);
    setVisibleKeys((current) => {
      const retained = current.filter((key) => keys.includes(key));
      if (retained.length) return retained;
      return defaultVisibleCurveSeries(orderedSeries);
    });
    setFocusedKey((current) => (keys.includes(current) ? current : (keys[0] ?? "")));
  }, [orderedSeries]);

  useEffect(() => {
    if (curve?.experimentId !== experimentId || initializedExperimentRef.current === experimentId)
      return;
    initializedExperimentRef.current = experimentId;
    setSearch("");
    setVisibleKeys(defaultVisibleCurveSeries(orderedSeries));
    setFocusedKey(
      orderedSeries.find((series) => series.seriesRole === "CONTROL")?.seriesKey ??
        orderedSeries[0]?.seriesKey ??
        "",
    );
    setTimeDomain(null);
    setSelectionStart(null);
    setSelectionEnd(null);
  }, [experimentId, curve?.experimentId, orderedSeries]);

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
  const interpolationType = curveInterpolationType(curve?.estimator);
  const firstElapsedMinute = firstPositiveCurveMinute(rows);
  const chartRows = rows.filter((row) => row.elapsedMinutes >= firstElapsedMinute);
  const maximumElapsedMinute = Math.max(firstElapsedMinute, curve?.maxElapsedMinutes ?? 0);
  const normalizedTimeDomain = timeDomain
    ? normalizeCurveTimeDomain(
        timeDomain.start,
        timeDomain.end,
        firstElapsedMinute,
        maximumElapsedMinute,
      )
    : null;
  const xDomain: [number, number] = normalizedTimeDomain
    ? [normalizedTimeDomain.start, normalizedTimeDomain.end]
    : [firstElapsedMinute, maximumElapsedMinute];
  const yDomain = curveYAxisDomain(
    orderedSeries.map((series) => ({
      ...series,
      points: series.points.filter(
        (point) => point.elapsedMinutes >= xDomain[0] && point.elapsedMinutes <= xDomain[1],
      ),
    })),
    visibleKeys,
  );
  const timeWindowPresets = curveTimeWindowPresets(maximumElapsedMinute);
  const focused =
    orderedSeries.find(
      (series) => series.seriesKey === focusedKey && visibleKeys.includes(series.seriesKey),
    ) ?? visibleSeries[0];
  const focusedEndpoint = focused?.points.at(-1);

  function finishTimeSelection(endMinute: number | null) {
    if (selectionStart != null && endMinute != null) {
      if (Math.abs(endMinute - selectionStart) >= 1) {
        setTimeDomain(
          normalizeCurveTimeDomain(
            selectionStart,
            endMinute,
            firstElapsedMinute,
            maximumElapsedMinute,
          ),
        );
      }
    }
    setSelectionStart(null);
    setSelectionEnd(null);
  }

  if (loading && !curve) return <div className="cs-experiments-loading">{t("common.loading")}</div>;
  if (failed)
    return (
      <div className="cs-experiment-curve-empty error">
        <strong>{t("ecommerce.customerServiceExperiments.curve.loadFailed")}</strong>
        <button className="btn btn-secondary" type="button" onClick={onRetry}>
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
              time: new Date(curve.asOf).toLocaleString(locale),
            })}
          </small>
        </div>
        <output className="cs-experiment-curve-scale" aria-live="polite">
          {t("ecommerce.customerServiceExperiments.curve.focusedScale", {
            low: yDomain[0],
            high: yDomain[1],
          })}
        </output>
      </div>
      <div className="cs-experiment-curve-time-controls">
        <div
          className="cs-experiment-curve-time-presets"
          role="group"
          aria-label={t("ecommerce.customerServiceExperiments.curve.timeWindow")}
        >
          <span>{t("ecommerce.customerServiceExperiments.curve.timeWindow")}</span>
          {timeWindowPresets.map((minutes) => {
            const active =
              normalizedTimeDomain?.start === firstElapsedMinute &&
              normalizedTimeDomain.end === minutes;
            return (
              <button
                key={minutes}
                type="button"
                className={active ? "active" : ""}
                aria-pressed={active}
                onClick={() => setTimeDomain({ start: firstElapsedMinute, end: minutes })}
              >
                {formatElapsed(minutes)}
              </button>
            );
          })}
          <button
            type="button"
            className={!normalizedTimeDomain ? "active" : ""}
            aria-pressed={!normalizedTimeDomain}
            onClick={() => setTimeDomain(null)}
          >
            {t("ecommerce.customerServiceExperiments.curve.fullWindow")}
          </button>
        </div>
        <div className="cs-experiment-curve-window-state">
          <output aria-live="polite">
            {formatElapsed(xDomain[0])}–{formatElapsed(xDomain[1])}
          </output>
          {normalizedTimeDomain ? (
            <button type="button" onClick={() => setTimeDomain(null)}>
              {t("ecommerce.customerServiceExperiments.curve.resetWindow")}
            </button>
          ) : (
            <small>{t("ecommerce.customerServiceExperiments.curve.dragHint")}</small>
          )}
        </div>
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
                {series.seriesRole === "CONTROL" ? (
                  <small className="series-role-badge">
                    {t("ecommerce.customerServiceExperiments.curve.baselineBadge")}
                  </small>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="cs-experiment-curve-chart focused-scale">
        <ResponsiveContainer width="100%" height={380}>
          <LineChart
            data={chartRows}
            margin={{ top: 18, right: 18, left: 4, bottom: 12 }}
            onMouseDown={(event) => {
              const minute = activeChartMinute(event);
              if (minute == null) return;
              setSelectionStart(minute);
              setSelectionEnd(minute);
            }}
            onMouseMove={(event) => {
              if (selectionStart == null) return;
              const minute = activeChartMinute(event);
              if (minute != null) setSelectionEnd(minute);
            }}
            onMouseUp={(event) => finishTimeSelection(activeChartMinute(event))}
          >
            <CartesianGrid
              strokeDasharray="2 6"
              vertical={false}
              stroke="var(--color-border-light)"
            />
            <XAxis
              type="number"
              dataKey="elapsedMinutes"
              domain={xDomain}
              allowDataOverflow
              tickFormatter={formatElapsed}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              domain={yDomain}
              allowDataOverflow
              tickCount={5}
              tickFormatter={(value) => `${value}%`}
              tick={{ fontSize: 11 }}
              width={52}
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
                {focused.stages
                  .filter(
                    (stage) => stage.delayMinutes >= xDomain[0] && stage.delayMinutes <= xDomain[1],
                  )
                  .map((stage) => (
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
            {selectionStart != null && selectionEnd != null ? (
              <ReferenceArea
                x1={Math.min(selectionStart, selectionEnd)}
                x2={Math.max(selectionStart, selectionEnd)}
                fill="var(--experiment-ink)"
                fillOpacity={0.12}
                stroke="var(--experiment-ink)"
                strokeOpacity={0.5}
              />
            ) : null}
            <Tooltip
              content={({ label }) => {
                const row = rows.find((item) => item.elapsedMinutes === Number(label));
                const tooltipSeries = row ? sortCurveTooltipSeries(visibleSeries, row.points) : [];
                return row ? (
                  <div className="cs-experiment-curve-tooltip">
                    <strong>{formatElapsed(row.elapsedMinutes)}</strong>
                    {tooltipSeries.map((series) => {
                      const point = row.points[series.seriesKey];
                      if (!point) return null;
                      const reliable = isCurvePointReliable(point);
                      return (
                        <div key={series.seriesKey}>
                          <b>{displayLabel(series)}</b>
                          <span className={!reliable ? "directional-estimate" : undefined}>
                            {t("ecommerce.customerServiceExperiments.curve.pointEstimate", {
                              value: (point.estimate * 100).toFixed(1),
                            })}
                          </span>
                          {!reliable ? (
                            <em>
                              {t("ecommerce.customerServiceExperiments.curve.directionalOnly")}
                            </em>
                          ) : null}
                          <small>
                            {t(
                              curve.estimator === GQL.CsExperimentCurveEstimator.AalenJohansen
                                ? "ecommerce.customerServiceExperiments.curve.rawIntervalLabel"
                                : "ecommerce.customerServiceExperiments.curve.modelIntervalLabel",
                            )}{" "}
                            {(point.confidenceIntervalLow * 100).toFixed(1)}–
                            {(point.confidenceIntervalHigh * 100).toFixed(1)}%
                          </small>
                          <small>
                            {t("ecommerce.customerServiceExperiments.curve.tooltipCounts", {
                              assigned: point.assignedUnits,
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
              const presentation = curveLinePresentation(
                series.seriesRole,
                true,
                series.seriesKey === focusedKey,
              );
              return (
                <Line
                  key={`${series.seriesKey}:reliable`}
                  type={interpolationType}
                  dataKey={`${series.seriesKey}:reliable`}
                  stroke={color}
                  strokeWidth={presentation.strokeWidth}
                  strokeDasharray={presentation.strokeDasharray}
                  strokeOpacity={presentation.strokeOpacity}
                  dot={false}
                  isAnimationActive={false}
                  onMouseEnter={() => setFocusedKey(series.seriesKey)}
                />
              );
            })}
            {visibleSeries.map((series) => {
              const presentation = curveLinePresentation(
                series.seriesRole,
                false,
                series.seriesKey === focusedKey,
              );
              return (
                <Line
                  key={`${series.seriesKey}:uncertain`}
                  type={interpolationType}
                  dataKey={`${series.seriesKey}:uncertain`}
                  stroke={curveColor(
                    orderedSeries.findIndex((item) => item.seriesKey === series.seriesKey),
                    series,
                  )}
                  strokeWidth={presentation.strokeWidth}
                  strokeDasharray={presentation.strokeDasharray}
                  strokeOpacity={presentation.strokeOpacity}
                  dot={false}
                  isAnimationActive={false}
                  onMouseEnter={() => setFocusedKey(series.seriesKey)}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <footer className="cs-experiment-curve-note">
        <div className="cs-experiment-curve-caption">
          <span>
            {t(
              curve.estimator === GQL.CsExperimentCurveEstimator.AalenJohansen
                ? "ecommerce.customerServiceExperiments.curve.rawAxisNote"
                : "ecommerce.customerServiceExperiments.curve.modelAxisNote",
            )}
          </span>
          <span>{t("ecommerce.customerServiceExperiments.curve.reliabilityNote")}</span>
          <div className="cs-experiment-curve-glossary">
            <strong>{t("ecommerce.customerServiceExperiments.curve.glossaryTitle")}</strong>
            <span>{t("ecommerce.customerServiceExperiments.curve.censoredDefinition")}</span>
            <span>{t("ecommerce.customerServiceExperiments.curve.atRiskDefinition")}</span>
            <span>{t("ecommerce.customerServiceExperiments.curve.coverageDefinition")}</span>
          </div>
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
