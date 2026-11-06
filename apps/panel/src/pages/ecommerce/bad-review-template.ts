import type { DataValidation, Workbook, Worksheet } from "exceljs";
import { BAD_REVIEW_TEMPLATE_HEADERS } from "./bad-review-import.js";

type ExcelJsModule = typeof import("exceljs");
type Translate = (key: string, options?: Record<string, unknown>) => string;

export const BAD_REVIEW_TEMPLATE_FILENAME = "bad-review-import-template.xlsx";
const DATA_SHEET_NAME = "差评导入";
/** One validation is one `sqref` range, so the row count does not affect the file size. */
const VALIDATED_ROWS = 10_000;
/** 跟进中 is left out on purpose: it turns AI off, so only the Start follow-up button sets it. */
const WORKBOOK_STATUSES = ["待跟进", "已更新", "已删评", "已结束"] as const;
const PREFIX = "ecommerce.badReview.template";

/**
 * The downloadable workbook. The data sheet comes first and carries no example rows, because the
 * importer reads the first sheet and treats every row below the header as data.
 */
export function buildBadReviewTemplateWorkbook(ExcelJS: ExcelJsModule, t: Translate): Workbook {
  const required = t(`${PREFIX}.required`);
  const optional = t(`${PREFIX}.optional`);
  const guide = [
    { requirement: required, hint: t(`${PREFIX}.orderHint`), example: "576000000000000001" },
    { requirement: optional, hint: t(`${PREFIX}.reasonHint`), example: t(`${PREFIX}.reasonExample`) },
    { requirement: optional, hint: t(`${PREFIX}.starsHint`), example: "1" },
    { requirement: optional, hint: t(`${PREFIX}.timeHint`), example: "2026-11-01 10:00:00" },
    { requirement: optional, hint: t(`${PREFIX}.statusHint`), example: "已结束" },
    { requirement: optional, hint: t(`${PREFIX}.noteHint`), example: t(`${PREFIX}.noteExample`) },
  ];

  const workbook = new ExcelJS.Workbook();
  const data = workbook.addWorksheet(DATA_SHEET_NAME);
  const headerRow = data.addRow([...BAD_REVIEW_TEMPLATE_HEADERS]);
  headerRow.font = { bold: true };
  BAD_REVIEW_TEMPLATE_HEADERS.forEach((header, index) => {
    const entry = guide[index]!;
    headerRow.getCell(index + 1).note = {
      texts: [
        { font: { bold: true }, text: `${header}\n` },
        { text: `${entry.requirement} · ${entry.hint}` },
      ],
    };
  });
  [24, 40, 12, 24, 14, 40].forEach((width, index) => {
    data.getColumn(index + 1).width = width;
  });
  // Text columns: Excel would otherwise turn an 18-digit order ID into a rounded number.
  data.getColumn(1).numFmt = "@";
  data.getColumn(4).numFmt = "@";
  data.views = [{ state: "frozen", ySplit: 1 }];
  const { dataValidations } = data as Worksheet & {
    dataValidations: { add(address: string, validation: DataValidation): void };
  };
  dataValidations.add(`E2:E${VALIDATED_ROWS + 1}`, {
    type: "list",
    formulae: [`"${WORKBOOK_STATUSES.join(",")}"`],
    allowBlank: true,
    showErrorMessage: true,
    errorStyle: "stop",
    errorTitle: t(`${PREFIX}.invalidValueTitle`),
    error: t(`${PREFIX}.statusInvalid`),
  });

  const instructions = workbook.addWorksheet(t(`${PREFIX}.instructionsSheetName`));
  instructions.addRow([
    t(`${PREFIX}.field`),
    t(`${PREFIX}.requirement`),
    t(`${PREFIX}.instructions`),
    t(`${PREFIX}.example`),
  ]).font = { bold: true };
  BAD_REVIEW_TEMPLATE_HEADERS.forEach((header, index) => {
    const entry = guide[index]!;
    instructions.addRow([header, entry.requirement, entry.hint, entry.example]);
  });
  [16, 14, 80, 28].forEach((width, index) => {
    instructions.getColumn(index + 1).width = width;
  });
  instructions.getColumn(3).alignment = { wrapText: true, vertical: "top" };
  return workbook;
}
