/**
 * Locale-aware date/time formatting for the panel.
 *
 * Always pass `i18n.language` (from `useTranslation`) as `locale` — we want the
 * output to track the panel's active language, not the OS locale. The underlying
 * `Intl.DateTimeFormat` picks up the timezone from Electron/Chromium (i.e. the
 * user's OS timezone); we never fix `timeZone` explicitly.
 */

function resolveIntlLocale(panelLocale: string): string {
  // Panel only ships zh/en today; map anything starting with "zh" to zh-CN so
  // month names render as "4月" rather than "四月" (standalone-narrow form).
  return panelLocale.startsWith("zh") ? "zh-CN" : "en-US";
}

/**
 * Short date + 24h time in the panel language. Example output:
 *
 *   en: "Apr 17, 14:30"
 *   zh: "4月17日 14:30"
 *
 * Use for quota refresh timestamps, session archival, and anywhere a compact
 * local-time hint is embedded in a sentence via i18n interpolation.
 */
export function formatShortDateTime(ts: number, panelLocale: string): string {
  const d = new Date(ts);
  try {
    return new Intl.DateTimeFormat(resolveIntlLocale(panelLocale), {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    // Intl is always present in Electron/Chromium; guard only to avoid a crash
    // on an unexpectedly stripped runtime.
    return d.toISOString();
  }
}

/**
 * Date only (no time), locale-aware. Example output:
 *
 *   en: "May 15, 2026"
 *   zh: "2026年5月15日"
 *
 * Use for long-horizon dates where minute precision is noise — subscription
 * expiry, billing periods, membership start/end.
 */
export function formatShortDate(ts: number, panelLocale: string): string {
  const d = new Date(ts);
  try {
    return new Intl.DateTimeFormat(resolveIntlLocale(panelLocale), {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
