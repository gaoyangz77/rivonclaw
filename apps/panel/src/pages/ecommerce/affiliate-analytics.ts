export const PLATFORM_DATASET = "AFFILIATE_PLATFORM_PERFORMANCE_DAILY" as const;
export const SAMPLE_DATASET = "AFFILIATE_SAMPLE_CONVERSION_DAILY" as const;

export type AffiliateDataset = typeof PLATFORM_DATASET | typeof SAMPLE_DATASET;
export type AffiliateGranularity = "DAILY" | "WEEKLY" | "MONTHLY";
export type AffiliateChartMode = "AUTO" | "LINE" | "BAR" | "STACKED" | "TABLE";

export interface AffiliateDateRange {
  startDateGe: string;
  endDateLt: string;
}

export interface AffiliateFilterDraft {
  dimension: string;
  operator: "IN" | "NOT_IN";
  values: string[];
  labels?: Record<string, string>;
}

export interface AffiliateExplorerDraft extends AffiliateDateRange {
  datasetId: AffiliateDataset;
  shopIds: string[];
  granularity: AffiliateGranularity;
  dimensions: string[];
  metrics: string[];
  filters: AffiliateFilterDraft[];
  sortField: string;
  sortDirection: "ASC" | "DESC";
  limit: number;
}

const ENTITY_BY_DIMENSION: Record<string, string | undefined> = {
  CAMPAIGN_ID: "CAMPAIGN",
  CAMPAIGN_NAME: "CAMPAIGN",
  AFFILIATE_COLLABORATION_ID: "COLLABORATION",
  AFFILIATE_COLLABORATION_NAME: "COLLABORATION",
  AFFILIATE_COLLABORATION_TYPE: "COLLABORATION",
  CREATOR_OPEN_ID: "CREATOR",
  CREATOR_USERNAME: "CREATOR",
  PRODUCT_ID: "PRODUCT",
  PRODUCT_NAME: "PRODUCT",
};

export const RATE_COMPONENTS: Record<string, readonly [string, string]> = {
  AFFILIATE_TARGET_RESPONSE_RATE: ["AFFILIATE_TARGET_SAMPLE_RESPONSES", "AFFILIATE_TARGET_CREATORS_INVITED"],
  AFFILIATE_CAMPAIGN_REPLY_RATE: ["AFFILIATE_REPLIED", "AFFILIATE_SENT"],
  AFFILIATE_CREATOR_IDENTITY_ROW_COVERAGE: ["AFFILIATE_CREATOR_IDENTITY_RESOLVED", "AFFILIATE_CREATOR_IDENTITY_ELIGIBLE"],
  AFFILIATE_CAMPAIGN_MAPPING_ROW_COVERAGE: ["AFFILIATE_CAMPAIGN_MAPPING_RESOLVED", "AFFILIATE_CAMPAIGN_MAPPING_ELIGIBLE"],
  AFFILIATE_APPROVAL_RATE: ["AFFILIATE_CURRENTLY_APPROVED", "AFFILIATE_APPLICATIONS_CREATED"],
  AFFILIATE_FULFILLMENT_OBSERVED_RATE: ["AFFILIATE_SHIPPED_OBSERVED_CURRENT", "AFFILIATE_CURRENTLY_APPROVED"],
  AFFILIATE_COMPLETION_RATE: ["AFFILIATE_CURRENTLY_COMPLETED", "AFFILIATE_CURRENTLY_APPROVED"],
  AFFILIATE_APPLICATION_TIME_EXACT_RATE: ["AFFILIATE_APPLICATION_TIME_EXACT", "AFFILIATE_APPLICATIONS_CREATED"],
  AFFILIATE_TARGET_MAPPING_RATE: ["AFFILIATE_TARGET_MAPPED_APPLICATIONS", "AFFILIATE_APPLICATIONS_CREATED"],
  AFFILIATE_CAMPAIGN_MAPPING_RATE: ["AFFILIATE_CAMPAIGN_MAPPED_APPLICATIONS", "AFFILIATE_APPLICATIONS_CREATED"],
};

const PLATFORM_DEFAULT_METRICS = [
  "AFFILIATE_NET_GMV_USD",
  "AFFILIATE_ORDERS",
];

const SAMPLE_DEFAULT_METRICS = [
  "AFFILIATE_APPLICATIONS_CREATED",
  "AFFILIATE_CURRENTLY_APPROVED",
  "AFFILIATE_SHIPPED_OBSERVED_CURRENT",
  "AFFILIATE_NET_GMV_USD",
];

function utcDateText(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function defaultAffiliateDateRange(now = new Date()): AffiliateDateRange {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 29);
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + 1);
  return { startDateGe: utcDateText(start), endDateLt: utcDateText(end) };
}

export function formatInputEndDate(endDateLt: string): string {
  const end = new Date(`${endDateLt}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  return utcDateText(end);
}

export function endDateLtFromInclusive(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return utcDateText(date);
}

export function safeRatio(numerator: number, denominator: number): number | null {
  return denominator ? numerator / denominator : null;
}

export function relativeDelta(current: number, comparison: number | null | undefined): number | null {
  if (comparison == null || comparison === 0) return null;
  return (current - comparison) / Math.abs(comparison);
}

export function affiliateEntitySet(dimensions: readonly string[]): string[] {
  return [...new Set(dimensions.map((dimension) => ENTITY_BY_DIMENSION[dimension]).filter(Boolean) as string[])].sort();
}

function canonicalSetKey(dimensions: readonly string[]): string {
  return affiliateEntitySet(dimensions).join("|");
}

export function isAffiliateGroupingLegal(
  selectedDimensions: readonly string[],
  filterDimensions: readonly string[],
  groupingSets: ReadonlyArray<{ dimensions: readonly string[] }>,
): boolean {
  const requested = canonicalSetKey([...selectedDimensions, ...filterDimensions]);
  return groupingSets.some((set) => canonicalSetKey(set.dimensions) === requested);
}

export function nextAffiliateDatasetDraft(
  draft: AffiliateExplorerDraft,
  datasetId: AffiliateDataset,
): AffiliateExplorerDraft {
  return {
    ...draft,
    datasetId,
    dimensions: ["DATE"],
    metrics: datasetId === PLATFORM_DATASET ? [...PLATFORM_DEFAULT_METRICS] : [...SAMPLE_DEFAULT_METRICS],
    filters: [],
    sortField: "",
    sortDirection: "DESC",
  };
}

export function automaticAffiliateChartMode(dimensions: readonly string[]): Exclude<AffiliateChartMode, "AUTO"> {
  if (dimensions.includes("DATE")) return "LINE";
  const entities = affiliateEntitySet(dimensions);
  if (entities.length === 1) return "BAR";
  if (entities.length === 2) return "STACKED";
  return "TABLE";
}

const DISPLAY_DIMENSIONS_BY_ENTITY: Record<string, readonly string[]> = {
  CAMPAIGN: ["CAMPAIGN_NAME", "CAMPAIGN_ID"],
  COLLABORATION: ["AFFILIATE_COLLABORATION_NAME", "AFFILIATE_COLLABORATION_ID"],
  CREATOR: ["CREATOR_USERNAME", "CREATOR_OPEN_ID"],
  PRODUCT: ["PRODUCT_NAME", "PRODUCT_ID"],
};

export interface AffiliateStackedChartData {
  categoryDimension: string;
  rows: Array<Record<string, unknown>>;
  series: Array<{ key: string; label: string }>;
}

export function buildAffiliateStackedChartData(
  rows: ReadonlyArray<Record<string, unknown>>,
  dimensions: readonly string[],
  metric: string,
): AffiliateStackedChartData | null {
  const entities = affiliateEntitySet(dimensions);
  if (entities.length !== 2) return null;
  const selectedDisplayDimension = (entity: string) =>
    DISPLAY_DIMENSIONS_BY_ENTITY[entity]?.find((dimension) => dimensions.includes(dimension));
  const categoryDimension = selectedDisplayDimension(entities[0]);
  const stackDimension = selectedDisplayDimension(entities[1]);
  if (!categoryDimension || !stackDimension) return null;

  const stackValues = [...new Set(rows.map((row) => String(row[stackDimension] ?? "—")))];
  const series = stackValues.map((label, index) => ({ key: `series_${index}`, label }));
  const seriesKeyByLabel = new Map(series.map((item) => [item.label, item.key]));
  const rowsByCategory = new Map<string, Record<string, unknown>>();
  for (const source of rows) {
    const category = String(source[categoryDimension] ?? "—");
    const stack = String(source[stackDimension] ?? "—");
    const target = rowsByCategory.get(category) ?? { category, [categoryDimension]: category };
    const seriesKey = seriesKeyByLabel.get(stack)!;
    target[seriesKey] = numeric(target[seriesKey]) + numeric(source[metric]);
    rowsByCategory.set(category, target);
  }
  return { categoryDimension, rows: [...rowsByCategory.values()], series };
}

function numeric(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function summarizeAffiliateRows(
  rows: ReadonlyArray<Record<string, unknown>>,
  metrics: readonly string[],
): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  for (const metric of metrics) {
    const components = RATE_COMPONENTS[metric];
    if (components) {
      const numerator = rows.reduce((sum, row) => sum + numeric(row[components[0]]), 0);
      const denominator = rows.reduce((sum, row) => sum + numeric(row[components[1]]), 0);
      result[metric] = safeRatio(numerator, denominator);
      continue;
    }
    const values = rows.map((row) => row[metric]);
    result[metric] = values.some((value) => value == null)
      && metric.endsWith("_NATIVE")
      ? null
      : values.reduce<number>((sum, value) => sum + numeric(value), 0);
  }
  return result;
}

export function mergeAffiliateResultPages(
  current: ReadonlyArray<Record<string, unknown>>,
  next: ReadonlyArray<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return [...current, ...next];
}

export function upsertAffiliateFilter(
  filters: readonly AffiliateFilterDraft[],
  next: AffiliateFilterDraft,
): AffiliateFilterDraft[] {
  return [...filters.filter((filter) => filter.dimension !== next.dimension), next];
}

export function removeAffiliateFilter(
  filters: readonly AffiliateFilterDraft[],
  dimension: string,
): AffiliateFilterDraft[] {
  return filters.filter((filter) => filter.dimension !== dimension);
}
