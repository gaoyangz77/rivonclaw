import type { Workbook } from "exceljs";
import {
  CREATOR_LIST_HEADER,
  CREATOR_LIST_MAX_USERNAMES,
} from "./affiliate-campaign-creator-list.js";

type ExcelJsModule = typeof import("exceljs");
type Translate = (key: string, options?: Record<string, unknown>) => string;

export const CREATOR_LIST_TEMPLATE_DATA_SHEET_NAME = "Creators";
const PREFIX = "ecommerce.affiliateCampaign.creatorList.template";

/**
 * The downloadable Creator list workbook (ADR-106). The data sheet comes first and carries no
 * example rows, because the importer reads the first sheet and treats every row below the header
 * as a username to reach.
 */
export function buildCreatorListTemplateWorkbook(ExcelJS: ExcelJsModule, t: Translate): Workbook {
  const requirement = t(`${PREFIX}.required`);
  const hint = t(`${PREFIX}.usernameHint`, { max: CREATOR_LIST_MAX_USERNAMES });

  const workbook = new ExcelJS.Workbook();
  const data = workbook.addWorksheet(CREATOR_LIST_TEMPLATE_DATA_SHEET_NAME);
  const headerRow = data.addRow([CREATOR_LIST_HEADER]);
  headerRow.font = { bold: true };
  headerRow.getCell(1).note = {
    texts: [
      { font: { bold: true }, text: `${CREATOR_LIST_HEADER}\n` },
      { text: `${requirement} · ${hint}` },
    ],
  };
  const column = data.getColumn(1);
  column.width = 32;
  // Text: a username made of digits must not be turned into a number.
  column.numFmt = "@";
  data.views = [{ state: "frozen", ySplit: 1 }];

  const instructions = workbook.addWorksheet(t(`${PREFIX}.instructionsSheetName`));
  instructions.addRow([
    t(`${PREFIX}.field`),
    t(`${PREFIX}.requirement`),
    t(`${PREFIX}.instructions`),
    t(`${PREFIX}.example`),
  ]).font = { bold: true };
  instructions.addRow([CREATOR_LIST_HEADER, requirement, hint, "@creatorname"]);
  [20, 14, 80, 24].forEach((width, index) => {
    instructions.getColumn(index + 1).width = width;
  });
  instructions.getColumn(3).alignment = { wrapText: true, vertical: "top" };
  return workbook;
}
