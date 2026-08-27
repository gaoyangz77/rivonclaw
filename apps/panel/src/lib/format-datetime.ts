/**
 * Locale-aware date/time formatting for the panel.
 *
 * User-visible dates must use the panel language rather than the operating
 * system locale. `Intl` still owns the user's local timezone; only the locale
 * and presentation order are controlled here.
 */

export type LocalizedDateTimeValue = Date | string | number | null | undefined;

function resolveIntlLocale(panelLocale: string): string {
  const language = panelLocale.trim().toLowerCase().split(/[-_]/u)[0];
  const localeByLanguage: Record<string, string> = {
    de: "de-DE",
    en: "en-US",
    es: "es-ES",
    fr: "fr-FR",
    id: "id-ID",
    it: "it-IT",
    th: "th-TH",
    zh: "zh-CN",
  };
  return localeByLanguage[language] ?? "en-US";
}

function validDate(value: LocalizedDateTimeValue): Date | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLocalized(
  value: LocalizedDateTimeValue,
  panelLocale: string,
  options: Intl.DateTimeFormatOptions,
  fallback: string,
): string {
  const date = validDate(value);
  if (!date) return fallback;
  try {
    return new Intl.DateTimeFormat(resolveIntlLocale(panelLocale), options).format(date);
  } catch {
    return fallback;
  }
}

/** Full local date and time for detail views, tables, and tooltips. */
export function formatLocalizedDateTime(
  value: LocalizedDateTimeValue,
  panelLocale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
  fallback = "—",
): string {
  return formatLocalized(value, panelLocale, options, fallback);
}

/** Date only for membership, expiry, and other day-level values. */
export function formatLocalizedDate(
  value: LocalizedDateTimeValue,
  panelLocale: string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  },
  fallback = "—",
): string {
  return formatLocalized(value, panelLocale, options, fallback);
}

/** Time only for chart axes and recently-refreshed labels. */
export function formatLocalizedTime(
  value: LocalizedDateTimeValue,
  panelLocale: string,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
  fallback = "—",
): string {
  return formatLocalized(value, panelLocale, options, fallback);
}

/** Compact month/day label, optionally pinned to a data timezone such as UTC. */
export function formatLocalizedMonthDay(
  value: LocalizedDateTimeValue,
  panelLocale: string,
  timeZone?: string,
  fallback = "—",
): string {
  return formatLocalized(
    value,
    panelLocale,
    { month: "short", day: "numeric", ...(timeZone ? { timeZone } : {}) },
    fallback,
  );
}

/** Localized relative time used by cron and activity surfaces. */
export function formatLocalizedRelativeTime(
  targetMs: number,
  nowMs: number,
  panelLocale: string,
  numeric: Intl.RelativeTimeFormatNumeric = "always",
): string {
  const diffMs = targetMs - nowMs;
  const absDiff = Math.abs(diffMs);
  let unit: Intl.RelativeTimeFormatUnit = "second";
  let divisor = 1_000;

  if (absDiff >= 86_400_000) {
    unit = "day";
    divisor = 86_400_000;
  } else if (absDiff >= 3_600_000) {
    unit = "hour";
    divisor = 3_600_000;
  } else if (absDiff >= 60_000) {
    unit = "minute";
    divisor = 60_000;
  }

  const value = Math.round(diffMs / divisor);
  try {
    return new Intl.RelativeTimeFormat(resolveIntlLocale(panelLocale), {
      numeric,
      style: "short",
    }).format(value, unit);
  } catch {
    return formatLocalizedDateTime(targetMs, panelLocale);
  }
}

/** Compact date + 24h time embedded in sentence copy. */
export function formatShortDateTime(
  value: LocalizedDateTimeValue,
  panelLocale: string,
): string {
  return formatLocalizedDateTime(value, panelLocale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Compatibility name for existing date-only call sites. */
export function formatShortDate(value: LocalizedDateTimeValue, panelLocale: string): string {
  return formatLocalizedDate(value, panelLocale);
}
