import type { Workbook } from "exceljs";

type ExcelJsModule = typeof import("exceljs");
type Row = Record<string, unknown>;

const DATE_FIELDS = new Set(["DATE", "SAMPLE_SHIPPED_DATE", "ORDER_DATE"]);
const NUMBER_FIELDS = new Set([
  "AFFILIATE_CREATOR_FOLLOWERS_AT_APPLICATION",
  "AFFILIATE_CREATOR_30D_GMV_AT_APPLICATION",
  "AFFILIATE_CREATOR_30D_CONTENTS_AT_APPLICATION",
  "AFFILIATE_CREATOR_MEDIAN_VIDEO_VIEWS_AT_APPLICATION",
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
