import type { GQL } from "@rivonclaw/core";
import type { Workbook } from "exceljs";

type ExcelJsModule = typeof import("exceljs");
type Row = Record<string, unknown>;

/** The backend caps a sample-detail page at 500 rows (`MAX_PAGE_SIZE`). */
export const AFFILIATE_DETAIL_EXPORT_PAGE_SIZE = 500;

/**
 * Largest result the Panel will download. Exports walk the backend page by
 * page (~1.5s per 500 rows through the Desktop proxy) and each page holds
 * backend analytics connections, so larger results must be split by the user
 * (date range, shops or filters) rather than run as one long walk.
 */
export const AFFILIATE_DETAIL_EXPORT_MAX_ROWS = 10_000;

export class AffiliateDetailExportTooLargeError extends Error {
  constructor(readonly totalRows: number) {
    super(`Affiliate detail export of ${totalRows} rows exceeds ${AFFILIATE_DETAIL_EXPORT_MAX_ROWS}`);
    this.name = "AffiliateDetailExportTooLargeError";
  }
}

const DATE_FIELDS = new Set(["DATE", "SAMPLE_SHIPPED_DATE", "ORDER_DATE"]);
const NUMBER_FIELDS = new Set([
  "AFFILIATE_CREATOR_FOLLOWERS_AT_APPLICATION",
  "AFFILIATE_CREATOR_GMV_AT_APPLICATION",
  "AFFILIATE_CREATOR_VIDEOS_AT_APPLICATION",
  "AFFILIATE_CREATOR_AVG_VIDEO_VIEWS_AT_APPLICATION",
  "AFFILIATE_CONTENTS_CREATED",
  "AFFILIATE_ORDERS",
  "AFFILIATE_UNITS",
  "AFFILIATE_ORDER_LINES",
  "AFFILIATE_NET_GMV_USD",
]);
const BOOLEAN_FIELDS = new Set([
  "SAMPLE_HAS_SHIPMENT",
  "SAMPLE_HAS_CONTENT",
  "SAMPLE_HAS_POST_APPLICATION_ORDER",
]);

/** Numeric detail columns: written as spreadsheet numbers and right-aligned on screen. */
export function isAffiliateDetailNumberField(key: string): boolean {
  return NUMBER_FIELDS.has(key);
}

/**
 * Sample-detail datasets always compute `pageInfo.totalRows`. A missing total
 * is a backend contract break, not an unknown-size result, so it fails loudly
 * instead of degrading the pager or the export progress into a guess.
 * (`totalCount` is the size of one response and must never stand in for it.)
 */
export function requireAffiliateDetailTotalRows(pageInfo: Pick<GQL.EcomBiPageInfo, "totalRows">): number {
  const total = pageInfo.totalRows;
  if (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0) {
    throw new Error("Affiliate detail query returned no pageInfo.totalRows");
  }
  return total;
}

/**
 * The matching rows changed between two pages of one export, so offset paging
 * can no longer guarantee a file without duplicated or missing rows.
 */
export class AffiliateDetailExportChangedError extends Error {
  constructor(
    readonly expectedRows: number,
    readonly observedRows: number,
  ) {
    super(`Affiliate detail rows changed during export (${expectedRows} → ${observedRows})`);
    this.name = "AffiliateDetailExportChangedError";
  }
}

export type AffiliateDetailPage = {
  rows: readonly Row[];
  pageInfo: Pick<GQL.EcomBiPageInfo, "hasMore" | "totalRows">;
};

/**
 * Fetches every row of one frozen query, one page at a time, at the backend
 * page cap. Pages stay sequential on purpose: each request holds two
 * connections of the backend's small analytics pool, which every user's BI
 * queries share, so parallel pages would speed one export by starving others.
 *
 * The first page fixes `totalRows`. Offsets are deterministic because the
 * backend ends every sort with unique keys, so each page must be exactly the
 * expected window: a changed total or a short page means the matching rows
 * moved during the export and fails loudly instead of writing a file with
 * duplicated or missing rows. The caller's `input` is never mutated; abort via
 * `signal` rejects with the signal's reason and never returns rows.
 */
export async function fetchAllAffiliateDetailRows(options: {
  input: GQL.EcomBiQueryInput;
  fetchPage: (input: GQL.EcomBiQueryInput, signal: AbortSignal) => Promise<AffiliateDetailPage>;
  signal: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}): Promise<Row[]> {
  const { input, fetchPage, signal, onProgress } = options;
  const pageSize = AFFILIATE_DETAIL_EXPORT_PAGE_SIZE;
  const rows: Row[] = [];
  let total: number | null = null;
  do {
    signal.throwIfAborted();
    const offset = rows.length;
    const page = await fetchPage({ ...input, limit: pageSize, offset }, signal);
    signal.throwIfAborted();
    const pageTotal = requireAffiliateDetailTotalRows(page.pageInfo);
    if (total !== null && pageTotal !== total) {
      throw new AffiliateDetailExportChangedError(total, pageTotal);
    }
    total = pageTotal;
    // The visible total can grow between Search and Download; enforce the cap here too.
    if (total > AFFILIATE_DETAIL_EXPORT_MAX_ROWS) throw new AffiliateDetailExportTooLargeError(total);
    const expectedRows = Math.max(0, Math.min(pageSize, total - offset));
    if (page.rows.length !== expectedRows) {
      throw new AffiliateDetailExportChangedError(total, offset + page.rows.length);
    }
    if (page.pageInfo.hasMore !== offset + expectedRows < total) {
      throw new Error("Affiliate detail page hasMore disagrees with pageInfo.totalRows");
    }
    rows.push(...page.rows);
    onProgress?.(rows.length, total);
  } while (rows.length < total);
  return rows;
}

function cellValue(key: string, value: unknown, displayText: (key: string, value: unknown) => string) {
  if (value === null || value === undefined || value === "") return null;
  if (DATE_FIELDS.has(key) && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }
  if (NUMBER_FIELDS.has(key)) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && Math.abs(numeric) <= Number.MAX_SAFE_INTEGER) return numeric;
  }
  if (BOOLEAN_FIELDS.has(key) || key === "SAMPLE_DECISION_BUCKET") {
    return displayText(key, value);
  }
  // IDs and other provider strings stay text, including values beginning with
  // "=". ExcelJS only creates a formula for an explicit { formula } value.
  return String(value);
}

export function buildAffiliateDetailWorkbook(
  ExcelJS: ExcelJsModule,
  options: {
    sheetName: string;
    columns: readonly string[];
    rows: readonly Row[];
    label: (key: string) => string;
    displayText: (key: string, value: unknown) => string;
  },
): Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(options.sheetName);
  sheet.columns = options.columns.map((key) => ({
    header: options.label(key),
    key,
    width: key === "PRODUCT_NAME" ? 52 : key.endsWith("_ID") ? 28 : 22,
  }));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: { row: 1, column: options.columns.length } };

  const header = sheet.getRow(1);
  header.height = 26;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF263342" } };
  header.alignment = { vertical: "middle" };

  options.rows.forEach((row, index) => {
    const excelRow = sheet.addRow(
      Object.fromEntries(
        options.columns.map((key) => [key, cellValue(key, row[key], options.displayText)]),
      ),
    );
    if (index % 2 === 1) {
      excelRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F5F8" } };
    }
    for (const key of options.columns) {
      if (DATE_FIELDS.has(key)) excelRow.getCell(key).numFmt = "yyyy-mm-dd";
      if (NUMBER_FIELDS.has(key)) excelRow.getCell(key).numFmt = "#,##0.##";
    }
  });
  return workbook;
}
