import type { GQL } from "@rivonclaw/core";

type XlsxModule = typeof import("xlsx");

/** The columns of the template, in order (ADR-102). */
export const BAD_REVIEW_TEMPLATE_HEADERS = [
  "订单号",
  "差评原因",
  "差评星级",
  "差评时间",
  "跟进状态",
  "备注",
] as const;

export class BadReviewWorkbookError extends Error {
  constructor(
    readonly code: "MISSING_COLUMNS" | "NO_ROWS",
    readonly columns: readonly string[] = [],
  ) {
    super(code);
  }
}

function text(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

/**
 * An order ID the spreadsheet stored as a number has already lost digits. It stays in exponent
 * form so the server rejects it instead of matching some other order.
 */
function orderIdCell(value: unknown): string {
  return typeof value === "number" ? value.toExponential() : String(value ?? "").trim();
}

/** The wall clock of a date cell, read from its serial so no time zone touches it. */
function timeCell(XLSX: XlsxModule, value: unknown): string | null {
  if (typeof value !== "number") return text(value);
  const date = XLSX.SSF.parse_date_code(value);
  if (!date) return String(value);
  const two = (part: number) => String(part).padStart(2, "0");
  return (
    `${date.y}-${two(date.m)}-${two(date.d)} ` +
    `${two(date.H)}:${two(date.M)}:${two(Math.floor(date.S))}`
  );
}

/**
 * Reads the first sheet as written. Cells are only carried across: the server parses and validates
 * every value, in preview and again on apply.
 */
export function readBadReviewWorkbook(
  XLSX: XlsxModule,
  bytes: ArrayBuffer,
): GQL.EcomBadReviewImportRowInput[] {
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  const cells = sheet
    ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true, blankrows: true })
    : [];
  const headerRow = (cells[0] ?? []).map((cell) => String(cell).trim());
  const missing = BAD_REVIEW_TEMPLATE_HEADERS.filter((header) => !headerRow.includes(header));
  if (missing.length) throw new BadReviewWorkbookError("MISSING_COLUMNS", missing);
  const [order, reason, stars, time, status, note] = BAD_REVIEW_TEMPLATE_HEADERS.map((header) =>
    headerRow.indexOf(header),
  ) as [number, number, number, number, number, number];

  const rows: GQL.EcomBadReviewImportRowInput[] = [];
  cells.slice(1).forEach((cell, index) => {
    if (cell.every((value) => !String(value ?? "").trim())) return;
    rows.push({
      rowNumber: index + 2,
      orderId: orderIdCell(cell[order]),
      reason: text(cell[reason]),
      stars: text(cell[stars]),
      reviewTime: timeCell(XLSX, cell[time]),
      status: text(cell[status]),
      note: text(cell[note]),
    });
  });
  if (!rows.length) throw new BadReviewWorkbookError("NO_ROWS");
  return rows;
}
