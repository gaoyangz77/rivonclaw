import ExcelJS from "exceljs";
import i18next from "i18next";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { AFFILIATE_TEAM_TRANSLATIONS } from "../../i18n/affiliate-team-translations.js";
import {
  AFFILIATE_CREATOR_UPDATE_TEMPLATE_HEADERS,
  validateAffiliateCreatorUpdateTemplate,
} from "./affiliate-protection-import.js";
import {
  AFFILIATE_CREATOR_UPDATE_TEMPLATE_DATA_SHEET_NAME,
  AFFILIATE_CREATOR_UPDATE_TEMPLATE_TAG_SHEET_NAME,
  buildAffiliateCreatorUpdateTemplateWorkbook,
} from "./affiliate-creator-update-template.js";

type Locale = keyof typeof AFFILIATE_TEAM_TRANSLATIONS;

const LOCALES = Object.keys(AFFILIATE_TEAM_TRANSLATIONS) as Locale[];
const MANUAL_TAG_COLUMNS = ["G", "H", "I", "J", "K"];
// Includes a sensitive tag and a name with a comma, which an inline list would split.
const TAG_NAMES = ["VIP", "Blacklisted (sensitive)", "Gold, tier"];

async function translatorFor(locale: Locale) {
  const instance = i18next.createInstance();
  await instance.init({
    lng: locale,
    resources: { [locale]: { translation: AFFILIATE_TEAM_TRANSLATIONS[locale] } },
    interpolation: { escapeValue: false },
  });
  return instance.t.bind(instance) as (key: string) => string;
}

/** Real xlsx bytes, as the customer's spreadsheet app receives them. */
async function templateBytes(locale: Locale, tagNames: readonly string[]) {
  const workbook = buildAffiliateCreatorUpdateTemplateWorkbook(
    ExcelJS,
    await translatorFor(locale),
    tagNames,
  );
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

function zipXml(bytes: Uint8Array, path: string): Document {
  const archive = XLSX.CFB.read(bytes, { type: "array" });
  const entry = XLSX.CFB.find(archive, `/${path}`);
  if (!entry) throw new Error(`Missing ${path} in the workbook package`);
  return new DOMParser().parseFromString(
    new TextDecoder().decode(entry.content as Uint8Array),
    "application/xml",
  );
}

/** Resolves a sheet name to its worksheet XML through workbook.xml and its relationships. */
function worksheetXml(bytes: Uint8Array, sheetName: string): Document {
  const sheet = [...zipXml(bytes, "xl/workbook.xml").getElementsByTagName("sheet")]
    .find((candidate) => candidate.getAttribute("name") === sheetName);
  if (!sheet) throw new Error(`Missing sheet ${sheetName}`);
  const relationship = [...zipXml(bytes, "xl/_rels/workbook.xml.rels").getElementsByTagName("Relationship")]
    .find((candidate) => candidate.getAttribute("Id") === sheet.getAttribute("r:id"));
  const target = relationship?.getAttribute("Target")?.replace(/^\/?(xl\/)?/u, "");
  if (!target) throw new Error(`Missing relationship for ${sheetName}`);
  return zipXml(bytes, `xl/${target}`);
}

function validationsBySqref(bytes: Uint8Array) {
  const sheet = worksheetXml(bytes, AFFILIATE_CREATOR_UPDATE_TEMPLATE_DATA_SHEET_NAME);
  return new Map([...sheet.getElementsByTagName("dataValidation")].map((node) => [
    node.getAttribute("sqref"),
    {
      type: node.getAttribute("type"),
      allowBlank: node.getAttribute("allowBlank"),
      showErrorMessage: node.getAttribute("showErrorMessage"),
      errorStyle: node.getAttribute("errorStyle"),
      errorTitle: node.getAttribute("errorTitle"),
      error: node.getAttribute("error"),
      formula: node.getElementsByTagName("formula1")[0]?.textContent,
    },
  ]));
}

function readWithImporter(bytes: Uint8Array) {
  return XLSX.read(bytes, { type: "array" });
}

describe("Creator bulk-update template", () => {
  it("formats the seller UID column as text before customers enter long IDs", async () => {
    const workbook = buildAffiliateCreatorUpdateTemplateWorkbook(
      ExcelJS,
      await translatorFor("en"),
      [],
    );
    const sheet = workbook.getWorksheet(AFFILIATE_CREATOR_UPDATE_TEMPLATE_DATA_SHEET_NAME)!;
    expect(sheet.getColumn(2).numFmt).toBe("@");
  });

  for (const locale of LOCALES) {
    const copy = AFFILIATE_TEAM_TRANSLATIONS[locale].ecommerce.affiliateTeam;

    it(`gives every header its localized hover note in ${locale}`, async () => {
      const book = readWithImporter(await templateBytes(locale, TAG_NAMES));
      const data = book.Sheets[book.SheetNames[0]!]!;
      AFFILIATE_CREATOR_UPDATE_TEMPLATE_HEADERS.forEach((header, column) => {
        const cell = data[XLSX.utils.encode_cell({ r: 0, c: column })]!;
        expect(cell.v).toBe(header);
        const note = cell.c?.[0]?.t ?? "";
        const expected = header === "creator_username" ? copy.templateIdentityHint
          : header === "creator_uid_note" ? copy.templateCreatorUidHint
            : header === "creator_note" ? copy.templateCreatorNoteHint
              : header === "bd_name" ? copy.templateDeveloperHint
                : header === "protection_action" ? copy.templateProtectionActionHint
                  : header === "protection_note" ? copy.templateProtectionNoteHint
                    : copy.templateManualTagHint;
        expect(note).toContain(header);
        expect(note).toContain(expected);
      });
    });

    it(`stays importable: data sheet first, intact header, no data rows, hidden tag sheet in ${locale}`, async () => {
      const book = readWithImporter(await templateBytes(locale, TAG_NAMES));
      expect(book.SheetNames).toEqual([
        AFFILIATE_CREATOR_UPDATE_TEMPLATE_DATA_SHEET_NAME,
        copy.templateInstructionsSheetName,
        AFFILIATE_CREATOR_UPDATE_TEMPLATE_TAG_SHEET_NAME,
      ]);
      const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[book.SheetNames[0]!]!, {
        header: 1,
        defval: "",
        blankrows: false,
      });
      expect(rows).toEqual([[...AFFILIATE_CREATOR_UPDATE_TEMPLATE_HEADERS]]);
      expect(validateAffiliateCreatorUpdateTemplate(rows[0]!).valid).toBe(true);
      expect(book.Workbook?.Sheets?.map((sheet) => sheet.Hidden)).toEqual([0, 0, 1]);
    });

    it(`restricts protection_action to PROTECT or UNPROTECT, blank allowed, in ${locale}`, async () => {
      const validations = validationsBySqref(await templateBytes(locale, TAG_NAMES));
      expect(validations.get("E2:E10001")).toEqual({
        type: "list",
        allowBlank: "1",
        showErrorMessage: "1",
        errorStyle: "stop",
        errorTitle: copy.templateInvalidValueTitle,
        error: copy.templateProtectionActionInvalid,
        formula: "\"PROTECT,UNPROTECT\"",
      });
    });

    it(`points every manual tag column at exactly the catalogue in the hidden sheet in ${locale}`, async () => {
      const bytes = await templateBytes(locale, TAG_NAMES);
      const validations = validationsBySqref(bytes);
      for (const column of MANUAL_TAG_COLUMNS) {
        expect(validations.get(`${column}2:${column}10001`)).toEqual({
          type: "list",
          allowBlank: "1",
          showErrorMessage: "1",
          errorStyle: "stop",
          errorTitle: copy.templateInvalidValueTitle,
          error: copy.templateManualTagInvalid,
          formula: `${AFFILIATE_CREATOR_UPDATE_TEMPLATE_TAG_SHEET_NAME}!$A$1:$A$${TAG_NAMES.length}`,
        });
      }
      // Only protection_action and the five tag columns are validated.
      expect(validations.size).toBe(6);
      const listed = XLSX.utils.sheet_to_json<string[]>(
        readWithImporter(bytes).Sheets[AFFILIATE_CREATOR_UPDATE_TEMPLATE_TAG_SHEET_NAME]!,
        { header: 1, blankrows: true },
      );
      expect(listed).toHaveLength(TAG_NAMES.length);
      expect(listed.map((row) => row.length === 1 ? row[0] : row).sort()).toEqual([...TAG_NAMES].sort());
    });

    it(`keeps manual tag columns strict and blank-only when no tags exist in ${locale}`, async () => {
      const bytes = await templateBytes(locale, []);
      const validations = validationsBySqref(bytes);
      for (const column of MANUAL_TAG_COLUMNS) {
        expect(validations.get(`${column}2:${column}10001`)).toEqual({
          type: "custom",
          allowBlank: "1",
          showErrorMessage: "1",
          errorStyle: "stop",
          errorTitle: copy.templateInvalidValueTitle,
          error: copy.templateNoManualTags,
          formula: `LEN(${column}2)=0`,
        });
      }
      const tagSheet = readWithImporter(bytes).Sheets[AFFILIATE_CREATOR_UPDATE_TEMPLATE_TAG_SHEET_NAME]!;
      expect(XLSX.utils.sheet_to_json(tagSheet, { header: 1, blankrows: false })).toEqual([]);
    });

    it(`fits Excel's validation dialog limits in ${locale}`, () => {
      expect(copy.templateInvalidValueTitle.length).toBeLessThanOrEqual(32);
      for (const message of [
        copy.templateProtectionActionInvalid,
        copy.templateManualTagInvalid,
        copy.templateNoManualTags,
      ]) {
        expect(message.length).toBeLessThanOrEqual(255);
      }
    });

    it(`shows examples in the guide sheet for every field except manual tags in ${locale}`, async () => {
      const book = readWithImporter(await templateBytes(locale, TAG_NAMES));
      const guide = XLSX.utils.sheet_to_json<string[]>(book.Sheets[copy.templateInstructionsSheetName]!, {
        header: 1,
        defval: "",
      });
      expect(guide[0]).toEqual([
        copy.templateField,
        copy.templateRequirement,
        copy.templateInstructions,
        copy.templateExample,
      ]);
      const exampleByField = new Map(guide.slice(1).map((row) => [row[0], row[3]]));
      expect(exampleByField.get("creator_username")).toBe("@creatorname");
      expect(exampleByField.get("creator_uid_note")).toBe("6905667682868806661");
      expect(exampleByField.get("creator_note")).toBe(copy.templateCreatorNoteExample);
      expect(exampleByField.get("bd_name")).toBe(copy.templateDeveloperExample);
      expect(exampleByField.get("protection_action")).toBe("PROTECT");
      expect(exampleByField.get("protection_note")).toBe(copy.templateProtectionNoteExample);
      expect(exampleByField.get("add_manual_tag_1 … add_manual_tag_5")).toBe("");
    });

    it(`names every unknown manual tag in the preview row error in ${locale}`, async () => {
      const t = (await translatorFor(locale)) as (key: string, options?: Record<string, unknown>) => string;
      expect(t("ecommerce.affiliateTeam.creatorUpdateUnknownManualTags", { names: "Gold, tier, Retired" }))
        .toContain("Gold, tier, Retired");
    });
  }

  it("refuses a blank tag name instead of writing a hole into the dropdown source", async () => {
    expect(() => buildAffiliateCreatorUpdateTemplateWorkbook(
      ExcelJS,
      (key) => key,
      ["VIP", " "],
    )).toThrow("must not be blank");
  });
});
