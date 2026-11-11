import type { GQL } from "@rivonclaw/core";
import type { Workbook } from "exceljs";
import { toLocalWallClockDate } from "./affiliate-review-time.js";

type ExcelJsModule = typeof import("exceljs");
type Knowledge = Omit<GQL.ProductKnowledge, "bindings">;

/** The backend's page-size cap for `productKnowledges`. */
export const PRODUCT_KNOWLEDGE_EXPORT_PAGE_SIZE = 100;

/**
 * The Product Knowledge download's columns, in sheet order (ADR-103 §6). Each key is also its
 * header's i18n key under `ecommerce.productKnowledge.export.columns`. One row is one entry.
 */
export const PRODUCT_KNOWLEDGE_EXPORT_COLUMNS = [
  "name",
  "merchantPid",
  "status",
  "usageInstructions",
  "qa",
  "creativeCases",
  "bindingCount",
  "createdAt",
  "updatedAt",
] as const;

export type ProductKnowledgeExportColumn = (typeof PRODUCT_KNOWLEDGE_EXPORT_COLUMNS)[number];

const SECTION_COLUMNS = new Set<ProductKnowledgeExportColumn>([
  "usageInstructions",
  "qa",
  "creativeCases",
]);
const DATE_TIME_COLUMNS = new Set<ProductKnowledgeExportColumn>(["createdAt", "updatedAt"]);

/** Localized text the sheet needs; the builder itself never touches i18n. */
export interface ProductKnowledgeExportText {
  header: (column: ProductKnowledgeExportColumn) => string;
  status: (status: GQL.ProductKnowledgeStatus) => string;
}

/**
 * Reads every entry the list shows, page by page, before a file is offered: a failed page never
 * produces a partial download. The list is offset-paged by `updatedAt`, so an entry edited while
 * the walk runs shifts the pages; a repeated id or a changed total stops the export instead of
 * silently dropping or duplicating an entry.
 */
export async function collectProductKnowledgeExportRows(options: {
  readPage: (offset: number, limit: number) => Promise<GQL.ProductKnowledgePage>;
  onProgress?: (done: number, total: number) => void;
}): Promise<Knowledge[]> {
  const rows: Knowledge[] = [];
  const seen = new Set<string>();
  let total: number | null = null;
  while (total === null || rows.length < total) {
    const page = await options.readPage(rows.length, PRODUCT_KNOWLEDGE_EXPORT_PAGE_SIZE);
    if (total !== null && page.totalCount !== total) {
      throw new Error("Product Knowledge changed during the export; try again");
    }
    total = page.totalCount;
    if (page.offset !== rows.length) {
      throw new Error("Product Knowledge export pagination did not advance; try again");
    }
    for (const item of page.items) {
      if (seen.has(item.id)) {
        throw new Error("Product Knowledge changed during the export; try again");
      }
      seen.add(item.id);
      rows.push(item);
    }
    options.onProgress?.(rows.length, total);
    if (page.items.length === 0 && rows.length < total) {
      throw new Error("Product Knowledge changed during the export; try again");
    }
  }
  return rows;
}

/** ISO instants become spreadsheet date-times on the device's clock, as the page shows them. */
function dateTime(value: string): Date {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`Product Knowledge export got an invalid time: ${value}`);
  }
  return toLocalWallClockDate(instant);
}

function cellValues(
  knowledge: Knowledge,
  text: ProductKnowledgeExportText,
): Record<ProductKnowledgeExportColumn, unknown> {
  return {
    name: knowledge.name,
    merchantPid: knowledge.merchantPid ?? null,
    status: text.status(knowledge.status),
    usageInstructions: knowledge.usageInstructionsMarkdown || null,
    qa: knowledge.qaMarkdown || null,
    creativeCases: knowledge.creativeCasesMarkdown || null,
    bindingCount: knowledge.bindingCount,
    createdAt: dateTime(knowledge.createdAt),
    updatedAt: dateTime(knowledge.updatedAt),
  };
}

export function buildProductKnowledgeWorkbook(
  ExcelJS: ExcelJsModule,
  options: { sheetName: string; rows: readonly Knowledge[]; text: ProductKnowledgeExportText },
): Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(options.sheetName);
  sheet.columns = PRODUCT_KNOWLEDGE_EXPORT_COLUMNS.map((key) => ({
    header: options.text.header(key),
    key,
    width: SECTION_COLUMNS.has(key)
      ? 60
      : key === "name"
        ? 32
        : DATE_TIME_COLUMNS.has(key)
          ? 20
          : 16,
  }));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: "A1",
    to: { row: 1, column: PRODUCT_KNOWLEDGE_EXPORT_COLUMNS.length },
  };

  const header = sheet.getRow(1);
  header.height = 26;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF263342" } };
  header.alignment = { vertical: "middle" };

  options.rows.forEach((knowledge, index) => {
    // Names, codes and Markdown stay text, including values beginning with "=": ExcelJS only
    // creates a formula for an explicit { formula } value.
    const excelRow = sheet.addRow(cellValues(knowledge, options.text));
    excelRow.alignment = { vertical: "top", wrapText: true };
    if (index % 2 === 1) {
      excelRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F5F8" } };
    }
    for (const key of DATE_TIME_COLUMNS) excelRow.getCell(key).numFmt = "yyyy-mm-dd hh:mm:ss";
  });
  return workbook;
}
