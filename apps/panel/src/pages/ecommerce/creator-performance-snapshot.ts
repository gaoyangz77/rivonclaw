/**
 * Creator performance snapshot (ADR-101): pure selection and formatting.
 *
 * Every field is null until the projection reaches a Creator, and null is never
 * rendered as zero. At a single-shop scope the shop's own snapshot is shown, and
 * a missing shop snapshot stays empty: the seller-wide rollup is a different
 * population and must not stand in for it.
 */
import type { GQL } from "@rivonclaw/core";
import { formatLocalizedCalendarDate } from "../../lib/format-datetime.js";

type RollupSnapshot = Pick<
  GQL.AffiliateCreatorPerformanceRollup,
  | "lastContentDate"
  | "lastOrderDate"
  | "lastSampleShippedDate"
  | "shippedSampleCount"
  | "contentCount90d"
  | "orderCount90d"
  | "netGmvUsd90d"
  | "shopCount"
>;

type ShopSnapshot = Pick<
  GQL.AffiliateCreatorShopPerformanceSnapshot,
  | "lastContentDate"
  | "lastOrderDate"
  | "lastSampleShippedDate"
  | "shippedSampleCount"
  | "contentCount90d"
  | "orderCount90d"
  | "netGmvUsd90d"
  | "netGmvNative90d"
  | "gmvNativeCurrency"
>;

export type CreatorPerformanceSource = {
  performanceSnapshot?: RollupSnapshot | null;
  shopStates?: ReadonlyArray<{
    shopId: string;
    performanceSnapshot?: ShopSnapshot | null;
  }> | null;
};

export type CreatorPerformanceView = {
  scope: "SHOP" | "ROLLUP";
  /** Shops that contributed to a rollup; null for a single shop. */
  shopCount: number | null;
  lastContentDate: string | null;
  lastOrderDate: string | null;
  lastSampleShippedDate: string | null;
  shippedSampleCount: number;
  contentCount90d: number;
  orderCount90d: number;
  /** Net GMV after refunds. */
  gmv: { amount: number; currency: string };
};

export function resolveCreatorPerformance(
  source: CreatorPerformanceSource | null | undefined,
  scopeShopId: string,
): CreatorPerformanceView | null {
  if (!source) return null;
  if (scopeShopId) {
    const snapshot = source.shopStates?.find(
      (state) => state.shopId === scopeShopId,
    )?.performanceSnapshot;
    if (!snapshot) return null;
    const native = snapshot.netGmvNative90d != null && snapshot.gmvNativeCurrency;
    return {
      scope: "SHOP",
      shopCount: null,
      lastContentDate: snapshot.lastContentDate ?? null,
      lastOrderDate: snapshot.lastOrderDate ?? null,
      lastSampleShippedDate: snapshot.lastSampleShippedDate ?? null,
      shippedSampleCount: snapshot.shippedSampleCount,
      contentCount90d: snapshot.contentCount90d,
      orderCount90d: snapshot.orderCount90d,
      gmv: native
        ? { amount: snapshot.netGmvNative90d!, currency: snapshot.gmvNativeCurrency! }
        : { amount: snapshot.netGmvUsd90d, currency: "USD" },
    };
  }
  const rollup = source.performanceSnapshot;
  if (!rollup) return null;
  return {
    scope: "ROLLUP",
    shopCount: rollup.shopCount,
    lastContentDate: rollup.lastContentDate ?? null,
    lastOrderDate: rollup.lastOrderDate ?? null,
    lastSampleShippedDate: rollup.lastSampleShippedDate ?? null,
    shippedSampleCount: rollup.shippedSampleCount,
    contentCount90d: rollup.contentCount90d,
    orderCount90d: rollup.orderCount90d,
    gmv: { amount: rollup.netGmvUsd90d, currency: "USD" },
  };
}

export type CreatorPerformanceFreshness = {
  /** Warehouse cutoff the values are correct as of. */
  cutoffAt: string;
  /** Last day of the 90-day window. */
  windowEndDate: string;
};

type ProjectionState = Pick<
  GQL.AffiliateCreatorPerformanceProjectionState,
  "shopId" | "sourceCutoffAt" | "windowEndDate"
>;

/**
 * "Data as of" for the shops a value covers. Across several shops the oldest
 * cutoff is shown, since no value is fresher than the slowest contributing shop.
 * Null when no covered shop has received a watermark yet.
 */
export function resolveCreatorPerformanceFreshness(
  states: readonly ProjectionState[],
  scopeShopId: string,
): CreatorPerformanceFreshness | null {
  const covered = scopeShopId ? states.filter((state) => state.shopId === scopeShopId) : states;
  let oldest: ProjectionState | null = null;
  for (const state of covered) {
    if (!oldest || Date.parse(state.sourceCutoffAt) < Date.parse(oldest.sourceCutoffAt)) {
      oldest = state;
    }
  }
  return oldest ? { cutoffAt: oldest.sourceCutoffAt, windowEndDate: oldest.windowEndDate } : null;
}

export function formatCreatorPerformanceDate(value: string | null, locale: string): string {
  return formatLocalizedCalendarDate(value, locale);
}

export function formatCreatorPerformanceCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatCreatorPerformanceGmv(
  gmv: CreatorPerformanceView["gmv"],
  locale: string,
): string {
  const maximumFractionDigits = Math.abs(gmv.amount) >= 1000 ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: gmv.currency,
      maximumFractionDigits,
    }).format(gmv.amount);
  } catch (error) {
    // Intl rejects a currency code it does not know. Show the amount with the
    // code as sent rather than dropping the figure.
    if (!(error instanceof RangeError)) throw error;
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits }).format(gmv.amount)} ${gmv.currency}`;
  }
}

/** ISO calendar date (UTC) for spreadsheet cells; locale independent. */
export function creatorPerformanceIsoDate(value: string | null): string {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}
