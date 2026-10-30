/**
 * Review-action-time helpers for the Affiliate Details tab.
 *
 * The backend speaks UTC instants (`reviewActionAtGe/Lt` in, ISO strings out);
 * sellers read and type wall-clock time in the device's timezone. Every
 * conversion between the two lives here so the rest of the tab never touches
 * `Date` arithmetic. Pure functions, no React.
 */

/** The backend rejects a review-action window longer than this. */
export const REVIEW_ACTION_MAX_SPAN_DAYS = 366;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A window as typed into two `datetime-local` inputs: `YYYY-MM-DDTHH:mm`, device-local, end exclusive. */
export interface LocalDateTimeRange {
  start: string;
  end: string;
}

export interface ReviewActionBounds {
  reviewActionAtGe: string;
  reviewActionAtLt: string;
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

function localDateText(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The value a `datetime-local` input holds for `date`, in device-local time. */
export function formatLocalDateTimeInput(date: Date): string {
  return `${localDateText(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Default window: today 00:00 → tomorrow 00:00, device-local. */
export function defaultReviewActionRange(now = new Date()): LocalDateTimeRange {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start: formatLocalDateTimeInput(start), end: formatLocalDateTimeInput(end) };
}

/** `datetime-local` text → instant. A date-time without an offset is device-local by specification. */
function parseLocalDateTimeInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The query bounds for a typed window, or null while it is not searchable:
 * a cleared input, an end that is not after the start, or a span the backend
 * would refuse (more than 366 days).
 */
export function reviewActionBounds(range: LocalDateTimeRange): ReviewActionBounds | null {
  const start = parseLocalDateTimeInput(range.start);
  const end = parseLocalDateTimeInput(range.end);
  if (!start || !end) return null;
  const span = end.getTime() - start.getTime();
  if (span <= 0 || span > REVIEW_ACTION_MAX_SPAN_DAYS * DAY_MS) return null;
  return { reviewActionAtGe: start.toISOString(), reviewActionAtLt: end.toISOString() };
}

/** A backend `SAMPLE_REVIEW_ACTION_AT` value (ISO-8601 UTC string) as an instant, or null when absent or unreadable. */
export function parseReviewActionAt(value: unknown): Date | null {
  if (typeof value !== "string" || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Device-local `YYYY-MM-DD HH:mm:ss` for an instant. */
export function formatLocalDateTime(date: Date): string {
  return `${localDateText(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * The instant whose UTC components equal `date`'s device-local components.
 * A spreadsheet date-time carries no zone, so writing this value shows the
 * seller's local clock reading in Excel.
 */
export function toLocalWallClockDate(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds(),
    ),
  );
}

/** Device UTC offset as `GMT+08:00`. */
export function deviceUtcOffsetLabel(at = new Date()): string {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes < 0 ? "-" : "+";
  const absolute = Math.abs(minutes);
  return `GMT${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

/** `GMT+08:00 (Asia/Shanghai)`, or the bare offset when the runtime reports no IANA zone. */
export function deviceTimeZoneLabel(at = new Date()): string {
  const offset = deviceUtcOffsetLabel(at);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone ? `${offset} (${zone})` : offset;
}
