/**
 * Shared, React-free formatting helpers for the Affiliate Analytics feature.
 * Used by both the Overview and the Explore tab.
 */

export function formatNumber(value: number | null | undefined, locale: string, compact = false): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

export function formatMoney(value: number | null | undefined, locale: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
    notation: Math.abs(value) >= 100_000 ? "compact" : "standard",
  }).format(value);
}

/**
 * Percent formatter with enough precision for the sub-percent rates this page
 * actually carries — a 0.15% response rate must not render as "0%".
 */
export function formatPercent(value: number | null | undefined, locale: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const magnitude = Math.abs(value);
  const maximumFractionDigits = magnitude === 0 ? 0 : magnitude < 0.01 ? 3 : magnitude < 0.1 ? 2 : 1;
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits }).format(value);
}

export function formatRatio(value: number | null | undefined, locale: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
}

export function formatTimestamp(value: string | null | undefined, locale: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Short axis label for a `YYYY-MM-DD` cohort day. */
export function formatCohortDay(value: string, locale: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: "UTC" });
}

export function metricDisplay(value: number | null | undefined, key: string, locale: string): string {
  const lowered = key.toLowerCase();
  if (lowered.includes("gmv") || lowered.includes("commission")) return formatMoney(value, locale);
  if (lowered.includes("rate") || lowered.includes("coverage") || lowered.includes("share")) return formatPercent(value, locale);
  return formatNumber(value, locale);
}

export type AffiliateCatalogScope = "dimensions" | "metrics";

/**
 * Resolves a catalog label by its stable enum id, falling back to the label the
 * server sent (always English) and finally to the raw id. The backend owns the
 * id; the Panel owns its localized display name.
 */
export function affiliateCatalogLabel(
  translate: (key: string) => string,
  scope: AffiliateCatalogScope,
  id: string,
  serverLabel?: string | null,
): string {
  const key = `ecommerce.affiliateAnalytics.catalog.${scope}.${id}`;
  const translated = translate(key);
  if (translated && translated !== key) return translated;
  const trimmed = serverLabel?.trim();
  return trimmed || id;
}
