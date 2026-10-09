import type { GQL } from "@rivonclaw/core";
import type { TFunction } from "i18next";
import { formatAffiliateActor } from "../../lib/affiliate-actor.js";
import {
  isAffiliateDetailNumberField,
  isAffiliateDetailPercentField,
} from "./affiliate-detail-export.js";

/** Filter draft edited in the Details tab; only a search freezes it into a query. */
export interface AffiliateDetailFilterDraft {
  origin: string;
  /** An AFFILIATE_SAMPLE_REVIEWER filter key (`HUMAN:<userId>`, `AGENT`, `SYSTEM`), or "" for everyone. */
  reviewer: string;
  decision: string;
  creatorId: string;
  productId: string;
  shipped: string;
  hasContent: string;
  postApplicationOrder: string;
}

export type AffiliateDetailEntity = "REVIEW" | "FULFILLMENT";
type Row = Record<string, unknown>;

export const EMPTY_AFFILIATE_DETAIL_FILTERS: AffiliateDetailFilterDraft = {
  origin: "",
  reviewer: "",
  decision: "",
  creatorId: "",
  productId: "",
  shipped: "",
  hasContent: "",
  postApplicationOrder: "",
};

const REVIEW_DATASET: GQL.EcomBiDatasetId = "AFFILIATE_SAMPLE_REVIEW_DETAIL";
const FULFILLMENT_DATASET: GQL.EcomBiDatasetId = "AFFILIATE_SAMPLE_FULFILLMENT_DETAIL";
const ORDER_DATASET: GQL.EcomBiDatasetId = "AFFILIATE_SAMPLE_ORDER_DETAIL";

const REVIEW_DIMENSIONS: GQL.EcomBiDimension[] = [
  "DATE",
  "SHOP_ID",
  "SHOP_NAME",
  "SHOP_ALIAS",
  "SAMPLE_APPLICATION_ID",
  "CREATOR_OPEN_ID",
  "CREATOR_USERNAME",
  "PRODUCT_ID",
  "PRODUCT_NAME",
  "AFFILIATE_DECIDED_BY",
  "AFFILIATE_SAMPLE_REVIEWER",
  "SAMPLE_DECISION_BUCKET",
  "SAMPLE_APPLICATION_STATUS",
  "SAMPLE_ORDER_ID",
  "TRACKING_ID",
  "SAMPLE_SHIPPED_DATE",
  "AFFILIATE_CREATOR_GMV_CURRENCY",
];
const FULFILLMENT_DIMENSIONS: GQL.EcomBiDimension[] = [
  ...REVIEW_DIMENSIONS,
  "SAMPLE_HAS_POST_APPLICATION_ORDER",
  "SAMPLE_HAS_SHIPMENT",
  "SAMPLE_HAS_CONTENT",
];
/**
 * Creator performance captured at application, in display order. Every money
 * metric is in the row's `AFFILIATE_CREATOR_GMV_CURRENCY`, so that column sits
 * right after the money block it qualifies.
 */
const CREATOR_MONEY_BLOCK: GQL.EcomBiMetric[] = [
  "AFFILIATE_CREATOR_FOLLOWERS_AT_APPLICATION",
  "AFFILIATE_CREATOR_UNITS_SOLD_AT_APPLICATION",
  "AFFILIATE_CREATOR_GMV_AT_APPLICATION",
  "AFFILIATE_CREATOR_VIDEO_GMV_AT_APPLICATION",
  "AFFILIATE_CREATOR_LIVE_GMV_AT_APPLICATION",
  "AFFILIATE_CREATOR_GMV_PER_BUYER_AT_APPLICATION",
  "AFFILIATE_CREATOR_GPM_AT_APPLICATION",
  "AFFILIATE_CREATOR_VIDEO_GPM_AT_APPLICATION",
  "AFFILIATE_CREATOR_LIVE_GPM_AT_APPLICATION",
];
const CREATOR_ACTIVITY_BLOCK: GQL.EcomBiMetric[] = [
  "AFFILIATE_CREATOR_PROMOTED_PRODUCTS_AT_APPLICATION",
  "AFFILIATE_CREATOR_BRAND_COLLABORATIONS_AT_APPLICATION",
  "AFFILIATE_CREATOR_VIDEOS_AT_APPLICATION",
  "AFFILIATE_CREATOR_LIVES_AT_APPLICATION",
  "AFFILIATE_CREATOR_AVG_VIDEO_VIEWS_AT_APPLICATION",
  "AFFILIATE_CREATOR_AVG_VIDEO_LIKES_AT_APPLICATION",
  "AFFILIATE_CREATOR_AVG_VIDEO_COMMENTS_AT_APPLICATION",
  "AFFILIATE_CREATOR_AVG_VIDEO_SHARES_AT_APPLICATION",
  "AFFILIATE_CREATOR_AVG_LIVE_VIEWS_AT_APPLICATION",
  "AFFILIATE_CREATOR_AVG_LIVE_LIKES_AT_APPLICATION",
  "AFFILIATE_CREATOR_AVG_LIVE_COMMENTS_AT_APPLICATION",
  "AFFILIATE_CREATOR_AVG_LIVE_SHARES_AT_APPLICATION",
  "AFFILIATE_CREATOR_VIDEO_ENGAGEMENT_RATE_AT_APPLICATION",
  "AFFILIATE_CREATOR_POST_RATE_AT_APPLICATION",
  "AFFILIATE_CREATOR_COMMISSION_RATE_AT_APPLICATION",
];
const CREATOR_METRICS: GQL.EcomBiMetric[] = [...CREATOR_MONEY_BLOCK, ...CREATOR_ACTIVITY_BLOCK];
const CREATOR_COLUMNS: readonly string[] = [
  ...CREATOR_MONEY_BLOCK,
  "AFFILIATE_CREATOR_GMV_CURRENCY",
  ...CREATOR_ACTIVITY_BLOCK,
];
const REVIEW_METRICS: GQL.EcomBiMetric[] = CREATOR_METRICS;
const FULFILLMENT_METRICS: GQL.EcomBiMetric[] = [
  "AFFILIATE_CONTENTS_CREATED",
  "AFFILIATE_ORDERS",
  "AFFILIATE_UNITS",
  ...CREATOR_METRICS,
];
const ORDER_DIMENSIONS: GQL.EcomBiDimension[] = [
  "DATE",
  "SHOP_ID",
  "SAMPLE_APPLICATION_ID",
  "ORDER_DATE",
  "ORDER_ID",
  "CONTENT_ID",
];
const ORDER_METRICS: GQL.EcomBiMetric[] = [
  "AFFILIATE_ORDER_LINES",
  "AFFILIATE_UNITS",
  "AFFILIATE_NET_GMV_USD",
];

/** Displayed (and exported) columns, in order, for each result type. */
export const AFFILIATE_DETAIL_COLUMNS: Record<AffiliateDetailEntity, readonly string[]> = {
  REVIEW: [
    "DATE",
    "SHOP_NAME",
    "SHOP_ALIAS",
    "CREATOR_USERNAME",
    "PRODUCT_NAME",
    "SAMPLE_DECISION_BUCKET",
    "AFFILIATE_SAMPLE_REVIEWER",
    "SAMPLE_ORDER_ID",
    "TRACKING_ID",
    "SAMPLE_SHIPPED_DATE",
    ...CREATOR_COLUMNS,
  ],
  FULFILLMENT: [
    "DATE",
    "SHOP_NAME",
    "SHOP_ALIAS",
    "CREATOR_USERNAME",
    "PRODUCT_NAME",
    "SAMPLE_DECISION_BUCKET",
    "AFFILIATE_SAMPLE_REVIEWER",
    "SAMPLE_SHIPPED_DATE",
    "SAMPLE_HAS_SHIPMENT",
    "SAMPLE_HAS_CONTENT",
    "SAMPLE_HAS_POST_APPLICATION_ORDER",
    "AFFILIATE_CONTENTS_CREATED",
    "AFFILIATE_ORDERS",
    "AFFILIATE_UNITS",
    ...CREATOR_COLUMNS,
  ],
};

export const AFFILIATE_ORDER_COLUMNS: readonly string[] = [
  "ORDER_DATE",
  "ORDER_ID",
  "CONTENT_ID",
  ...ORDER_METRICS,
];

function filter(dimension: GQL.EcomBiDimension, value: string): GQL.EcomBiFilterInput {
  return { dimension, operator: "IN", values: [value] };
}

/** Which result type a frozen query belongs to. */
export function affiliateDetailEntityOf(input: GQL.EcomBiQueryInput): AffiliateDetailEntity {
  return input.datasetId === FULFILLMENT_DATASET ? "FULFILLMENT" : "REVIEW";
}

/** Application-grain query for the current filter draft (paging is set by the caller). */
export function buildAffiliateDetailInput(options: {
  entity: AffiliateDetailEntity;
  shopIds: string[];
  startDateGe: string;
  endDateLt: string;
  filters: AffiliateDetailFilterDraft;
}): GQL.EcomBiQueryInput {
  const { entity, filters } = options;
  const review = entity === "REVIEW";
  const creatorId = filters.creatorId.trim();
  const productId = filters.productId.trim();
  return {
    datasetId: review ? REVIEW_DATASET : FULFILLMENT_DATASET,
    shopIds: options.shopIds,
    startDateGe: options.startDateGe,
    endDateLt: options.endDateLt,
    granularity: "DAILY",
    dimensions: review ? REVIEW_DIMENSIONS : FULFILLMENT_DIMENSIONS,
    metrics: review ? REVIEW_METRICS : FULFILLMENT_METRICS,
    filters: [
      ...(filters.origin ? [filter("AFFILIATE_DECIDED_BY", filters.origin)] : []),
      ...(filters.reviewer ? [filter("AFFILIATE_SAMPLE_REVIEWER", filters.reviewer)] : []),
      ...(creatorId ? [filter("CREATOR_OPEN_ID", creatorId)] : []),
      ...(productId ? [filter("PRODUCT_ID", productId)] : []),
      ...(review && filters.decision ? [filter("SAMPLE_DECISION_BUCKET", filters.decision)] : []),
      ...(!review && filters.shipped ? [filter("SAMPLE_HAS_SHIPMENT", filters.shipped)] : []),
      ...(!review && filters.hasContent ? [filter("SAMPLE_HAS_CONTENT", filters.hasContent)] : []),
      ...(!review && filters.postApplicationOrder
        ? [filter("SAMPLE_HAS_POST_APPLICATION_ORDER", filters.postApplicationOrder)]
        : []),
    ],
    orderBy: [{ dimension: "DATE", direction: "DESC" }],
  };
}

/** Post-application order lines of one application, over the frozen search's window. */
export function buildAffiliateOrderInput(options: {
  shopId: string;
  applicationId: string;
  search: Pick<GQL.EcomBiQueryInput, "startDateGe" | "endDateLt">;
}): GQL.EcomBiQueryInput {
  return {
    datasetId: ORDER_DATASET,
    shopIds: [options.shopId],
    startDateGe: options.search.startDateGe,
    endDateLt: options.search.endDateLt,
    granularity: "DAILY",
    dimensions: ORDER_DIMENSIONS,
    metrics: ORDER_METRICS,
    filters: [filter("SAMPLE_APPLICATION_ID", options.applicationId)],
    orderBy: [{ dimension: "ORDER_DATE", direction: "DESC" }],
  };
}

function formatted(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export function affiliateDetailTitle(value: unknown): string {
  return formatted(value);
}

/** Column header; order detail relabels units as post-application units. */
export function affiliateDetailLabel(t: TFunction, key: string, orderDetail = false): string {
  return t(
    `ecommerce.affiliateAnalytics.details.fields.${orderDetail && key === "AFFILIATE_UNITS" ? "POST_APPLICATION_UNITS" : key}`,
  );
}

/** The reviewer cell is a structured actor, or null while the application is unreviewed. */
function isReviewerActor(value: unknown): value is GQL.AffiliateActorDisplay {
  return typeof value === "object" && value !== null && "kind" in value;
}

/** Choices of the reviewer filter: everyone first, then each reviewer the backend offers. */
export function affiliateReviewerSelectOptions(
  t: TFunction,
  reviewers: readonly Pick<GQL.AffiliateSampleReviewerOption, "key" | "actor">[],
): Array<{ value: string; label: string }> {
  return [
    { value: "", label: t("ecommerce.affiliateAnalytics.details.all") },
    ...reviewers.map((reviewer) => ({
      value: reviewer.key,
      label: formatAffiliateActor(reviewer.actor, t),
    })),
  ];
}

/** Display text for one cell; missing values render "—", never zero. */
export function affiliateDetailCell(t: TFunction, language: string, row: Row, key: string): string {
  const value = row[key];
  if (key === "AFFILIATE_SAMPLE_REVIEWER")
    return isReviewerActor(value) ? formatAffiliateActor(value, t) : formatted(value);
  if (key === "SAMPLE_DECISION_BUCKET")
    return t(`ecommerce.affiliateAnalytics.details.decisions.${String(value)}`, {
      defaultValue: formatted(value),
    });
  if (
    key === "SAMPLE_HAS_POST_APPLICATION_ORDER" ||
    key === "SAMPLE_HAS_SHIPMENT" ||
    key === "SAMPLE_HAS_CONTENT"
  )
    return value === null || value === undefined
      ? t("ecommerce.affiliateAnalytics.details.unknown")
      : t(`ecommerce.affiliateAnalytics.details.${Number(value) ? "yes" : "no"}`);
  if (isAffiliateDetailNumberField(key) && value !== null && value !== undefined && value !== "") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      // Counts and money show at most 2 decimals; ratios (0.0812) show as "8.12%".
      return new Intl.NumberFormat(language, {
        maximumFractionDigits: 2,
        ...(isAffiliateDetailPercentField(key) ? { style: "percent" } : {}),
      }).format(numeric);
    }
  }
  if (typeof value === "string" && /^-?\d+\.\d+$/.test(value))
    return new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(Number(value));
  if (typeof value === "number") return new Intl.NumberFormat(language).format(value);
  return formatted(value);
}
