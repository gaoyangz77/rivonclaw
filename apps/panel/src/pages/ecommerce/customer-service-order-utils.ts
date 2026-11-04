import type { TFunction } from "i18next";
import panelI18n from "../../i18n/index.js";
import { formatLocalizedDateTime } from "../../lib/format-datetime.js";

export function formatCompactDateTime(value?: string | number | null): string {
  if (value == null) return "-";
  const date = typeof value === "number" ? new Date(value * 1000) : value;
  return formatLocalizedDateTime(
    date,
    panelI18n.language,
    { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
    "-",
  );
}

export function formatOrderMoney(
  value?: string | null,
  currency?: string | null,
  locale?: string,
): string {
  if (!value) return "-";
  const amount = Number(value);
  if (!Number.isFinite(amount) || !currency) return [currency, value].filter(Boolean).join(" ");
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${value}`;
  }
}

export function humanizePlatformValue(value?: string | null): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export type PlatformValueGroup =
  | "returnType"
  | "returnStatus"
  | "returnMethod"
  | "recordRole"
  | "recordEvent"
  | "cancelStatus";

/** Localized label for a TikTok enum value; values without a translation fall back to a humanized form. */
export function platformValueLabel(
  t: TFunction,
  group: PlatformValueGroup,
  value?: string | null,
): string {
  if (!value) return "";
  return t(`ecommerce.customerServiceWorkspace.platformValues.${group}.${value}`, {
    defaultValue: humanizePlatformValue(value),
  });
}
