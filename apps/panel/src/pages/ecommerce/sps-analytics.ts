import type { GQL } from "@rivonclaw/core";

export interface SpsChartRow {
  recordDate: string;
  [shopId: string]: string | number | null;
}

export interface SpsChartSeries {
  shopId: string;
  shopName: string;
}

export interface SpsMarketChart {
  rows: SpsChartRow[];
  series: SpsChartSeries[];
}

function isPercentUnit(unit?: string | null): boolean {
  const normalized = unit?.trim().toLowerCase();
  return normalized === "%" || normalized === "percent" || normalized === "percentage";
}

function stableAxisNumber(value: number): number {
  return Number(value.toPrecision(12));
}

/**
 * Keep the chart focused on the visible variation instead of forcing rate
 * metrics onto a 0–100 scale. The returned bounds remain inside the semantic
 * 0–100 range for percentages and include enough padding to avoid exaggerating
 * a single noisy point.
 */
export function buildSpsYAxisDomain(
  values: number[],
  unit?: string | null,
): [number, number] {
  const finiteValues = values.filter(Number.isFinite);
  if (!finiteValues.length) return [0, 1];

  const minimum = Math.min(...finiteValues);
  const maximum = Math.max(...finiteValues);
  const percent = isPercentUnit(unit);
  const observedSpan = maximum - minimum;
  const flatSeriesPadding = percent
    ? 0.5
    : Math.max(Math.abs(maximum) * 0.05, 0.5);
  const padding = observedSpan > 0
    ? Math.max(observedSpan * 0.2, percent ? 0.05 : observedSpan * 0.05)
    : flatSeriesPadding;

  const rawMinimum = percent ? Math.max(0, minimum - padding) : minimum - padding;
  const rawMaximum = percent ? Math.min(100, maximum + padding) : maximum + padding;
  const rawSpan = Math.max(rawMaximum - rawMinimum, Number.EPSILON);
  const roundingStep = 10 ** Math.floor(Math.log10(rawSpan));
  const roundedMinimum = Math.floor(rawMinimum / roundingStep) * roundingStep;
  const roundedMaximum = Math.ceil(rawMaximum / roundingStep) * roundingStep;

  const domainMinimum = stableAxisNumber(
    percent ? Math.max(0, roundedMinimum) : roundedMinimum,
  );
  const domainMaximum = stableAxisNumber(
    percent ? Math.min(100, roundedMaximum) : roundedMaximum,
  );
  if (domainMaximum > domainMinimum) return [domainMinimum, domainMaximum];

  const fallbackPadding = percent ? 0.5 : 1;
  return [
    percent ? Math.max(0, minimum - fallbackPadding) : minimum - fallbackPadding,
    percent ? Math.min(100, maximum + fallbackPadding) : maximum + fallbackPadding,
  ];
}

export function displayShopName(
  shop: Pick<GQL.SpsAnalyticsShopView, "shopAlias" | "shopName">,
): string {
  return shop.shopAlias?.trim() || shop.shopName;
}

export function buildSpsMarketChart(
  shops: Array<
    Pick<
      GQL.SpsAnalyticsShopView,
      "availability" | "shopAlias" | "shopId" | "shopName" | "trend"
    >
  >,
): SpsMarketChart {
  const availableShops = shops.filter(
    (shop) => shop.availability === "AVAILABLE" && shop.trend.length > 0,
  );
  const rowsByDate = new Map<string, SpsChartRow>();

  for (const shop of availableShops) {
    for (const point of shop.trend) {
      const row = rowsByDate.get(point.recordDate) ?? {
        recordDate: point.recordDate,
      };
      row[shop.shopId] = point.value;
      rowsByDate.set(point.recordDate, row);
    }
  }

  return {
    rows: [...rowsByDate.values()].sort((left, right) =>
      left.recordDate.localeCompare(right.recordDate),
    ),
    series: availableShops.map((shop) => ({
      shopId: shop.shopId,
      shopName: displayShopName(shop),
    })),
  };
}

export function formatSpsValue(
  value: number | null | undefined,
  unit?: string | null,
  locale?: string,
): string {
  if (value == null || Number.isNaN(value)) return "—";
  const normalizedUnit = unit?.trim().toLowerCase();
  if (normalizedUnit === "%" || normalizedUnit === "percent" || normalizedUnit === "percentage") {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 2,
    }).format(value / 100);
  }
  if (normalizedUnit === "second" || normalizedUnit === "seconds" || normalizedUnit === "s") {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "second",
      unitDisplay: "narrow",
      maximumFractionDigits: 1,
    }).format(value);
  }
  if (normalizedUnit === "minute" || normalizedUnit === "minutes" || normalizedUnit === "min") {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "minute",
      unitDisplay: "narrow",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return [
    value.toLocaleString(locale, { maximumFractionDigits: 2 }),
    unit?.trim(),
  ].filter(Boolean).join(" ");
}
