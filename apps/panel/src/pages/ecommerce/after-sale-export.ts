import type { GQL } from "@rivonclaw/core";
import type { Workbook } from "exceljs";
import { toLocalWallClockDate } from "./affiliate-review-time.js";

type ExcelJsModule = typeof import("exceljs");
type Request = GQL.EcomAfterSaleRequest;
type PageInput = GQL.EcomAfterSaleRequestsInput;

/**
 * The after-sale download's columns, in sheet order. Each key is also its header's i18n key under
 * `ecommerce.afterSale.export.columns`. One row is one request; its lines are joined in a cell.
 */
export const AFTER_SALE_EXPORT_COLUMNS = [
  "kind",
  "requestId",
  "orderId",
  "shop",
  "status",
  "sellerAction",
  "deadline",
  "refund",
  "currency",
  "reason",
  "products",
  "skus",
  "sellerSkus",
  "requestType",
  "role",
  "quickRefund",
  "sellerDecision",
  "sellerDecidedAt",
  "created",
  "updated",
] as const;

export type AfterSaleExportColumn = (typeof AFTER_SALE_EXPORT_COLUMNS)[number];

const DATE_TIME_COLUMNS = new Set<AfterSaleExportColumn>([
  "deadline",
  "sellerDecidedAt",
  "created",
  "updated",
]);
const WIDE_COLUMNS = new Set<AfterSaleExportColumn>(["shop", "reason", "products", "skus"]);
const ID_COLUMNS = new Set<AfterSaleExportColumn>(["requestId", "orderId", "sellerSkus"]);

/** Localized text the sheet needs; the builder itself never touches i18n. */
export interface AfterSaleExportText {
  header: (column: AfterSaleExportColumn) => string;
  kind: (kind: string) => string;
  status: (status: string | null | undefined) => string;
  sellerAction: (action: string | null | undefined) => string;
  sellerDecision: (decision: string | null | undefined) => string;
  role: (role: string) => string;
  requestType: (requestType: string) => string;
  shop: (request: Request) => string;
  yes: string;
  no: string;
}

/**
 * Reads every request matching one frozen filter set, page by page along the backend's keyset
 * cursor, before a file is offered: a failed page never produces a partial download. A request
 * whose sort key moved while the walk ran can come back twice; its later copy replaces the
 * earlier one in place. The caller's `input` is never mutated.
 */
export async function collectAfterSaleExportRows(options: {
  input: PageInput;
  pageSize: number;
  readPage: (input: PageInput) => Promise<GQL.EcomAfterSaleRequestPage>;
  onProgress?: (done: number, total: number) => void;
}): Promise<Request[]> {
  const rows = new Map<string, Request>();
  let cursor: string | null = null;
  do {
    const page: GQL.EcomAfterSaleRequestPage = await options.readPage({
      ...options.input,
      limit: options.pageSize,
      ...(cursor ? { cursor } : {}),
    });
    const next = page.nextCursor ?? null;
    if (next !== null && next === cursor) {
      throw new Error("After-sale export pagination did not advance; refresh and try again");
    }
    for (const request of page.items) {
      rows.set(`${request.shopId}:${request.kind}:${request.requestId}`, request);
    }
    cursor = next;
    options.onProgress?.(rows.size, Math.max(rows.size, page.totalCount));
  } while (cursor !== null);
  return [...rows.values()];
}

function joinLines(request: Request, pick: (line: GQL.EcomAfterSaleRequestLine) => string | null | undefined) {
  const values = request.lines.map(pick).filter((value): value is string => Boolean(value));
  return values.length ? values.join("\n") : null;
}

/** ISO instants become spreadsheet date-times on the device's clock, as the table shows them. */
function dateTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) throw new Error(`After-sale export got an invalid time: ${value}`);
  return toLocalWallClockDate(instant);
}

function money(value: string | null | undefined): number | string | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  // A platform amount that is not a plain number stays text rather than turning into NaN.
  return Number.isFinite(numeric) ? numeric : value;
}

function cellValues(request: Request, text: AfterSaleExportText): Record<AfterSaleExportColumn, unknown> {
  return {
    kind: text.kind(request.kind),
    requestId: request.requestId,
    orderId: request.orderId ?? null,
    shop: text.shop(request),
    status: text.status(request.status),
    sellerAction: text.sellerAction(request.sellerNextAction),
    deadline: dateTime(request.sellerActionDeadline),
    refund: money(request.refundTotal),
    currency: request.currency ?? null,
    reason: request.reasonText ?? request.reason ?? null,
    products: joinLines(request, (line) => line.productName),
    skus: joinLines(request, (line) => line.skuName),
    sellerSkus: joinLines(request, (line) => line.sellerSku),
    requestType: request.requestType ? text.requestType(request.requestType) : null,
    role: request.role ? text.role(request.role) : null,
    quickRefund: request.isQuickRefund ? text.yes : text.no,
    sellerDecision: request.sellerDecision ? text.sellerDecision(request.sellerDecision) : null,
    sellerDecidedAt: dateTime(request.sellerDecidedAt),
    created: dateTime(request.createTime),
    updated: dateTime(request.updateTime),
  };
}

export function buildAfterSaleWorkbook(
  ExcelJS: ExcelJsModule,
  options: { sheetName: string; rows: readonly Request[]; text: AfterSaleExportText },
): Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(options.sheetName);
  sheet.columns = AFTER_SALE_EXPORT_COLUMNS.map((key) => ({
    header: options.text.header(key),
    key,
    width: WIDE_COLUMNS.has(key) ? 40 : ID_COLUMNS.has(key) ? 24 : DATE_TIME_COLUMNS.has(key) ? 20 : 16,
  }));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: { row: 1, column: AFTER_SALE_EXPORT_COLUMNS.length } };

  const header = sheet.getRow(1);
  header.height = 26;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF263342" } };
  header.alignment = { vertical: "middle" };

  options.rows.forEach((request, index) => {
    // Ids and platform strings stay text, including values beginning with "=": ExcelJS only
    // creates a formula for an explicit { formula } value.
    const excelRow = sheet.addRow(cellValues(request, options.text));
    excelRow.alignment = { vertical: "top", wrapText: true };
    if (index % 2 === 1) {
      excelRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F5F8" } };
    }
    for (const key of DATE_TIME_COLUMNS) excelRow.getCell(key).numFmt = "yyyy-mm-dd hh:mm:ss";
    excelRow.getCell("refund").numFmt = "#,##0.00";
  });
  return workbook;
}

/** Hands a workbook to the browser as a download. */
export async function downloadAfterSaleWorkbook(workbook: Workbook, filename: string) {
  const bytes = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
