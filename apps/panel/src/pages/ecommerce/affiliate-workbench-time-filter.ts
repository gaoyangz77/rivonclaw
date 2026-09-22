/**
 * Workbench time filter: local calendar days in, absolute instants out.
 *
 * The workbench tables render timestamps in browser-local wall clock
 * (`lib/format-datetime.ts` passes no `timeZone` to `Intl`), so "today" on this
 * surface means the operator's local day. Every bound produced here is therefore
 * a LOCAL midnight converted to an absolute instant, never a UTC calendar date.
 *
 * This is deliberately NOT `affiliate-analytics.ts`'s `defaultAffiliateDateRange`
 * / `endDateLtFromInclusive` / `formatInputEndDate`: those emit UTC calendar-date
 * strings (`YYYY-MM-DD`) for the BI datasets, which are bucketed in UTC. Reusing
 * them here would shift every queue filter by the operator's UTC offset — at
 * UTC+8, picking 今天 would query yesterday 08:00 → today 08:00.
 *
 * Ranges are half-open `[ge, lt)`, matching the backend arguments. The backend
 * rejects `ge >= lt`, so an incomplete or inverted custom range resolves to an
 * explicit non-sending state rather than a silently empty or inverted request.
 */

export type AffiliateWorkbenchTimePreset =
  | "ALL"
  | "TODAY"
  | "LAST_7_DAYS"
  | "LAST_30_DAYS"
  | "CUSTOM";

export const AFFILIATE_WORKBENCH_TIME_PRESETS: readonly AffiliateWorkbenchTimePreset[] = [
  "ALL",
  "TODAY",
  "LAST_7_DAYS",
  "LAST_30_DAYS",
  "CUSTOM",
];

/**
 * The control's own state. Both custom dates are INCLUSIVE local calendar days
 * in `<input type="date">` form; the exclusive upper bound is derived on send.
 */
export interface AffiliateWorkbenchTimeFilter {
  preset: AffiliateWorkbenchTimePreset;
  customStartDate: string;
  customEndDate: string;
}

/**
 * What the current filter resolves to.
 *
 * `RANGE` is the only state that sends bounds. `INCOMPLETE` and `INVALID_ORDER`
 * are surfaced to the operator as a field error instead of being sent — a
 * half-typed or inverted custom range would otherwise become a backend
 * `BAD_USER_INPUT`.
 */
export type AffiliateWorkbenchTimeSelection =
  | { state: "ALL_TIME" }
  | { state: "RANGE"; geIso: string; ltIso: string }
  | { state: "INCOMPLETE" }
  | { state: "INVALID_ORDER" };

export const ALL_TIME_WORKBENCH_FILTER: AffiliateWorkbenchTimeFilter = {
  preset: "ALL",
  customStartDate: "",
  customEndDate: "",
};

const LOCAL_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Midnight of `instant`'s own local calendar day. */
export function localDayStart(instant: Date): Date {
  return new Date(instant.getFullYear(), instant.getMonth(), instant.getDate());
}

/**
 * Local midnight of a `YYYY-MM-DD` day, or `null` when the text is not a real
 * calendar day. `new Date(y, m, d)` rolls `2026-02-31` over into March and maps
 * two-digit years into the 1900s, so the round trip below rejects both.
 */
export function localDayStartFromInput(dayText: string): Date | null {
  const match = LOCAL_DAY_PATTERN.exec(dayText);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const instant = new Date(year, monthIndex, day);
  if (
    instant.getFullYear() !== year ||
    instant.getMonth() !== monthIndex ||
    instant.getDate() !== day
  ) {
    return null;
  }
  return instant;
}

/** `YYYY-MM-DD` for an instant's local calendar day, for `<input type="date">`. */
export function localDayText(instant: Date): string {
  const month = `${instant.getMonth() + 1}`.padStart(2, "0");
  const day = `${instant.getDate()}`.padStart(2, "0");
  return `${instant.getFullYear()}-${month}-${day}`;
}

/**
 * Local-midnight arithmetic. `setDate` preserves wall-clock time across a DST
 * transition, so midnight stays midnight.
 */
function addLocalDays(instant: Date, days: number): Date {
  const next = new Date(instant);
  next.setDate(next.getDate() + days);
  return next;
}

function range(geInstant: Date, ltInstant: Date): AffiliateWorkbenchTimeSelection {
  return { state: "RANGE", geIso: geInstant.toISOString(), ltIso: ltInstant.toISOString() };
}

/**
 * Resolve the control state into the bounds to send.
 *
 * Presets snap to local midnight rather than to `now`, so the resolved bounds
 * are stable for the whole local day. That stability is load-bearing: the
 * result is built during render and fed straight into Apollo variables, and a
 * `now`-valued upper bound would change on every render and refetch forever.
 */
export function affiliateWorkbenchTimeSelection(
  filter: AffiliateWorkbenchTimeFilter,
  now: Date = new Date(),
): AffiliateWorkbenchTimeSelection {
  const today = localDayStart(now);
  const tomorrow = addLocalDays(today, 1);
  switch (filter.preset) {
    case "ALL":
      return { state: "ALL_TIME" };
    case "TODAY":
      return range(today, tomorrow);
    case "LAST_7_DAYS":
      return range(addLocalDays(today, -6), tomorrow);
    case "LAST_30_DAYS":
      return range(addLocalDays(today, -29), tomorrow);
    case "CUSTOM": {
      const startDay = localDayStartFromInput(filter.customStartDate);
      const endDay = localDayStartFromInput(filter.customEndDate);
      if (!startDay || !endDay) return { state: "INCOMPLETE" };
      if (startDay.getTime() > endDay.getTime()) return { state: "INVALID_ORDER" };
      // The end day is inclusive to the operator; the bound sent is exclusive.
      return range(startDay, addLocalDays(endDay, 1));
    }
  }
}

/**
 * The bounds a selection sends, or `null` when it sends none.
 *
 * Callers spread this under the argument names their own input type uses —
 * `createdAt*` for proposals and escalations, `firstObservedAt*` for Sample
 * review, `lastPendingAt*` for pending conversations.
 */
export function affiliateWorkbenchTimeBounds(
  selection: AffiliateWorkbenchTimeSelection,
): { geIso: string; ltIso: string } | null {
  return selection.state === "RANGE" ? { geIso: selection.geIso, ltIso: selection.ltIso } : null;
}

/**
 * The selection's contribution to a page-buffer/cursor key.
 *
 * A backend keyset cursor is bound to the range that minted it and a cursor
 * replayed under a different range is rejected outright, so the range must key
 * the buffer exactly as the other filters do. Keyed off the RESOLVED bounds, so
 * two filter states that send the same bounds share one page stream and an
 * unsendable custom range keys the same as no filter at all.
 */
export function affiliateWorkbenchTimeFilterKey(
  selection: AffiliateWorkbenchTimeSelection,
): string {
  const bounds = affiliateWorkbenchTimeBounds(selection);
  return bounds ? `${bounds.geIso}|${bounds.ltIso}` : "";
}
