import type { DataValidation, Workbook, Worksheet } from "exceljs";
import { AFFILIATE_CREATOR_UPDATE_TEMPLATE_HEADERS } from "./affiliate-protection-import.js";

type ExcelJsModule = typeof import("exceljs");
type Translate = (key: string, options?: Record<string, unknown>) => string;

export const AFFILIATE_CREATOR_UPDATE_TEMPLATE_DATA_SHEET_NAME = "Creator updates";
/** Hidden sheet holding the manual tag vocabulary the tag dropdowns point at. */
export const AFFILIATE_CREATOR_UPDATE_TEMPLATE_TAG_SHEET_NAME = "ManualTagOptions";
/**
 * Rows below the header that carry dropdown validation. A validation is one
 * `sqref` range, so the file size does not depend on this number; it only has
 * to exceed any realistic single upload. Rows beyond it are still checked by
 * the import preview and by the backend.
 */
export const AFFILIATE_CREATOR_UPDATE_TEMPLATE_VALIDATED_ROWS = 10_000;

const MANUAL_TAG_HEADER_PREFIX = "add_manual_tag_";
const PROTECTION_ACTIONS = ["PROTECT", "UNPROTECT"] as const;
// Excel refuses to open (and offers to "repair") a workbook whose validation
// dialog text exceeds these limits.
const EXCEL_ERROR_TITLE_MAX_LENGTH = 32;
const EXCEL_ERROR_MESSAGE_MAX_LENGTH = 255;

/**
 * The downloadable Creator bulk-update workbook.
 *
 * Guidance lives in two places that must never disagree, so both are built from
 * one field list: a hover note on each header cell (what a customer sees while
 * typing) and the Instructions sheet (field, requirement, how to fill, example).
 *
 * `protection_action` and every manual tag column carry strict dropdowns. Manual
 * tags are a controlled vocabulary: the dropdown lists exactly
 * `manualTagNames` from a hidden sheet (an inline list would cap at 255
 * characters and split names containing commas), and the import rejects any
 * other tag.
 *
 * The data sheet deliberately carries no example rows. The importer reads the
 * first sheet and treats every row below the header as data, so a leftover
 * example such as a PROTECT row would silently create a protection for a
 * username that does not exist. Manual tags get no example because every
 * seller's tag catalogue is different.
 */
export function buildAffiliateCreatorUpdateTemplateWorkbook(
  ExcelJS: ExcelJsModule,
  t: Translate,
  manualTagNames: readonly string[],
): Workbook {
  const required = t("ecommerce.affiliateTeam.templateRequired");
  const optional = t("ecommerce.affiliateTeam.templateOptional");
  const manualTagHint = t("ecommerce.affiliateTeam.templateManualTagHint");
  const fieldGuide = [
    {
      field: "creator_username",
      requirement: required,
      hint: t("ecommerce.affiliateTeam.templateIdentityHint"),
      example: "@creatorname",
    },
    {
      field: "creator_uid_note",
      requirement: optional,
      hint: t("ecommerce.affiliateTeam.templateCreatorUidHint"),
      example: "6905667682868806661",
    },
    {
      field: "creator_note",
      requirement: optional,
      hint: t("ecommerce.affiliateTeam.templateCreatorNoteHint"),
      example: t("ecommerce.affiliateTeam.templateCreatorNoteExample"),
    },
    {
      field: "bd_name",
      requirement: optional,
      hint: t("ecommerce.affiliateTeam.templateDeveloperHint"),
      example: t("ecommerce.affiliateTeam.templateDeveloperExample"),
    },
    {
      field: "protection_action",
      requirement: optional,
      hint: t("ecommerce.affiliateTeam.templateProtectionActionHint"),
      example: "PROTECT",
    },
    {
      field: "protection_note",
      requirement: optional,
      hint: t("ecommerce.affiliateTeam.templateProtectionNoteHint"),
      example: t("ecommerce.affiliateTeam.templateProtectionNoteExample"),
    },
  ];
  const headerNotes = new Map<string, string>(
    fieldGuide.map((entry) => [entry.field, `${entry.requirement} · ${entry.hint}`]),
  );
  const tagNames = [...manualTagNames].sort((left, right) => left.localeCompare(right));
  tagNames.forEach((name) => {
    if (!name.trim()) throw new Error("Creator manual tag names in the template must not be blank");
  });

  const workbook = new ExcelJS.Workbook();
  // The importer reads the first sheet, so the data sheet must be added first.
  const data = workbook.addWorksheet(AFFILIATE_CREATOR_UPDATE_TEMPLATE_DATA_SHEET_NAME);
  const headerRow = data.addRow([...AFFILIATE_CREATOR_UPDATE_TEMPLATE_HEADERS]);
  headerRow.font = { bold: true };
  AFFILIATE_CREATOR_UPDATE_TEMPLATE_HEADERS.forEach((header, index) => {
    const note = header.startsWith(MANUAL_TAG_HEADER_PREFIX)
      ? `${optional} · ${manualTagHint}`
      : headerNotes.get(header);
    if (!note) throw new Error(`Creator update template header has no guidance: ${header}`);
    // ExcelJS writes every note with the fixed author "Author", so the field
    // name leads the note text instead, reading as "creator_username / …".
    headerRow.getCell(index + 1).note = {
      texts: [{ font: { bold: true }, text: `${header}\n` }, { text: note }],
    };
  });
  const widths = [28, 28, 48, 32, 22, 42, 26, 26, 26, 26, 26];
  widths.forEach((width, index) => {
    data.getColumn(index + 1).width = width;
  });
  data.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: AFFILIATE_CREATOR_UPDATE_TEMPLATE_HEADERS.length },
  };
  const sellerUidColumn = AFFILIATE_CREATOR_UPDATE_TEMPLATE_HEADERS.indexOf("creator_uid_note") + 1;
  data.getColumn(sellerUidColumn).numFmt = "@";

  const instructions = workbook.addWorksheet(
    t("ecommerce.affiliateTeam.templateInstructionsSheetName"),
  );
  instructions.addRow([
    t("ecommerce.affiliateTeam.templateField"),
    t("ecommerce.affiliateTeam.templateRequirement"),
    t("ecommerce.affiliateTeam.templateInstructions"),
    t("ecommerce.affiliateTeam.templateExample"),
  ]).font = { bold: true };
  fieldGuide.forEach((entry) => {
    instructions.addRow([entry.field, entry.requirement, entry.hint, entry.example]);
  });
  instructions.addRow([
    `${MANUAL_TAG_HEADER_PREFIX}1 … ${MANUAL_TAG_HEADER_PREFIX}5`,
    optional,
    manualTagHint,
    "",
  ]);
  [34, 24, 76, 36].forEach((width, index) => {
    instructions.getColumn(index + 1).width = width;
  });
  instructions.getColumn(3).alignment = { wrapText: true, vertical: "top" };

  const tagOptions = workbook.addWorksheet(AFFILIATE_CREATOR_UPDATE_TEMPLATE_TAG_SHEET_NAME, {
    state: "hidden",
  });
  tagNames.forEach((name) => {
    tagOptions.addRow([name]);
  });

  const errorTitle = t("ecommerce.affiliateTeam.templateInvalidValueTitle");
  const protectionActionValidation = strictValidation(errorTitle, {
    type: "list",
    formulae: [`"${PROTECTION_ACTIONS.join(",")}"`],
    error: t("ecommerce.affiliateTeam.templateProtectionActionInvalid"),
  });
  // With no tags there is nothing to list, and a list pointing at an empty range
  // is not enforced by Excel. A formula that only holds for an empty cell keeps
  // the column strict while still allowing blank.
  const manualTagValidation = (column: string) =>
    tagNames.length > 0
      ? strictValidation(errorTitle, {
          type: "list",
          formulae: [
            `${AFFILIATE_CREATOR_UPDATE_TEMPLATE_TAG_SHEET_NAME}!$A$1:$A$${tagNames.length}`,
          ],
          error: t("ecommerce.affiliateTeam.templateManualTagInvalid"),
        })
      : strictValidation(errorTitle, {
          type: "custom",
          formulae: [`LEN(${column}2)=0`],
          error: t("ecommerce.affiliateTeam.templateNoManualTags"),
        });
  AFFILIATE_CREATOR_UPDATE_TEMPLATE_HEADERS.forEach((header, index) => {
    const column = data.getColumn(index + 1).letter;
    if (header === "protection_action") {
      addColumnValidation(data, column, protectionActionValidation);
    } else if (header.startsWith(MANUAL_TAG_HEADER_PREFIX)) {
      addColumnValidation(data, column, manualTagValidation(column));
    }
  });

  return workbook;
}

function strictValidation(
  errorTitle: string,
  validation: Pick<DataValidation, "type" | "formulae" | "error">,
): DataValidation {
  if (errorTitle.length > EXCEL_ERROR_TITLE_MAX_LENGTH) {
    throw new Error(
      `Template validation title exceeds Excel's ${EXCEL_ERROR_TITLE_MAX_LENGTH}-character limit: ${errorTitle}`,
    );
  }
  if ((validation.error ?? "").length > EXCEL_ERROR_MESSAGE_MAX_LENGTH) {
    throw new Error(
      `Template validation message exceeds Excel's ${EXCEL_ERROR_MESSAGE_MAX_LENGTH}-character limit: ${validation.error}`,
    );
  }
  return {
    ...validation,
    allowBlank: true,
    showErrorMessage: true,
    errorStyle: "stop",
    errorTitle,
  };
}

/**
 * ExcelJS supports range-addressed validations at runtime
 * (`worksheet.dataValidations.add("E2:E10001", …)`), but its type definitions
 * leave `dataValidations` out. Per-cell `cell.dataValidation` would instead
 * materialize thousands of cells for the optimiser to squeeze back together.
 */
function addColumnValidation(worksheet: Worksheet, column: string, validation: DataValidation) {
  const { dataValidations } = worksheet as Worksheet & {
    dataValidations: { add(address: string, validation: DataValidation): void };
  };
  const lastRow = AFFILIATE_CREATOR_UPDATE_TEMPLATE_VALIDATED_ROWS + 1;
  dataValidations.add(`${column}2:${column}${lastRow}`, validation);
}
