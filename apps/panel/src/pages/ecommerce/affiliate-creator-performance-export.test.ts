import ExcelJS from "exceljs";
import i18next from "i18next";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import type { GQL } from "@rivonclaw/core";
import { AFFILIATE_CREATOR_SNAPSHOT_TRANSLATIONS } from "../../i18n/affiliate-creator-snapshot-translations.js";
import { AFFILIATE_TEAM_TRANSLATIONS } from "../../i18n/affiliate-team-translations.js";
import {
  buildAffiliateCreatorUpdateFailureWorkbook,
  buildAffiliateCreatorUpdateTemplateWorkbook,
} from "./affiliate-creator-update-template.js";
import {
  AFFILIATE_CREATOR_PERFORMANCE_EXPORT_HEADERS,
  AFFILIATE_CREATOR_UPDATE_TEMPLATE_HEADERS,
  parseAffiliateCreatorUpdateRow,
  validateAffiliateCreatorUpdateTemplate,
} from "./affiliate-protection-import.js";

type Locale = keyof typeof AFFILIATE_TEAM_TRANSLATIONS;
const LOCALES = Object.keys(AFFILIATE_TEAM_TRANSLATIONS) as Locale[];
const TAGS = ["VIP"];
const SHOP = "shop-1";

async function translatorFor(locale: Locale) {
  const instance = i18next.createInstance();
  await instance.init({
    lng: locale,
    resources: { [locale]: { translation: AFFILIATE_TEAM_TRANSLATIONS[locale] } },
    interpolation: { escapeValue: false },
  });
  instance.addResourceBundle(
    locale,
    "translation",
    AFFILIATE_CREATOR_SNAPSHOT_TRANSLATIONS[locale],
    true,
    true,
  );
  return instance.t.bind(instance) as (key: string) => string;
}

const rollup = {
  lastContentDate: "2026-10-30T00:00:00.000Z",
  lastOrderDate: "2026-10-31T00:00:00.000Z",
  lastSampleShippedDate: null,
  shippedSampleCount: 6,
  contentCount90d: 4,
  orderCount90d: 10,
  netGmvUsd90d: 200.456,
  shopCount: 2,
} as unknown as GQL.AffiliateCreatorPerformanceRollup;
const shopSnapshot = {
  lastContentDate: "2026-10-29T00:00:00.000Z",
  lastOrderDate: null,
  lastSampleShippedDate: "2026-09-01T00:00:00.000Z",
  shippedSampleCount: 3,
  contentCount90d: 2,
  orderCount90d: 0,
  netGmvUsd90d: 100,
  netGmvNative90d: 2000,
  gmvNativeCurrency: "MXN",
} as unknown as GQL.AffiliateCreatorShopPerformanceSnapshot;

function row(
  username: string,
  extra: Partial<GQL.AffiliateCreatorUpdateExportRow> = {},
): GQL.AffiliateCreatorUpdateExportRow {
  return {
    creatorRelationshipId: `relationship-${username}`,
    username,
    protect: true,
    sellerProvidedUid: "6905667682868806661",
    sellerNote: "Seller note",
    businessDeveloperName: "Old BD",
    protectionNote: "Keep",
    manualTagNames: TAGS,
    ...extra,
  };
}

async function sheetOf(workbook: ExcelJS.Workbook) {
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
  const book = XLSX.read(bytes, { type: "array" });
  return book.Sheets[book.SheetNames[0]!]!;
}

describe("Creator export performance columns", () => {
  it.each(LOCALES)(
    "exports the seven fields as trailing read-only columns in %s",
    async (locale) => {
      const t = await translatorFor(locale);
      const rows = [row("has-rollup", { performanceSnapshot: rollup }), row("not-reached")];
      const workbook = buildAffiliateCreatorUpdateTemplateWorkbook(ExcelJS, t, TAGS, rows, {
        scopeShopId: "",
        dataAsOf: "2026-11-04T16:00:00.000Z",
      });
      const sheet = await sheetOf(workbook);
      const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
      expect(table[0]).toEqual([
        ...AFFILIATE_CREATOR_UPDATE_TEMPLATE_HEADERS,
        ...AFFILIATE_CREATOR_PERFORMANCE_EXPORT_HEADERS,
      ]);
      const perf = (index: number) =>
        table[index]!.slice(AFFILIATE_CREATOR_UPDATE_TEMPLATE_HEADERS.length);
      // Date-only values are calendar dates in UTC; GMV is the USD rollup.
      expect(perf(1)).toEqual([
        "2026-10-30",
        "2026-10-31",
        "",
        6,
        4,
        10,
        200.46,
        "USD",
        "2026-11-04T16:00:00.000Z",
      ]);
      // A Creator the projection has not reached exports blanks, never zeros.
      expect(perf(2)).toEqual(["", "", "", "", "", "", "", "", "2026-11-04T16:00:00.000Z"]);
      expect(validateAffiliateCreatorUpdateTemplate(table[0]!).valid).toBe(true);
    },
  );

  it("exports the shop snapshot in the shop's own currency when scoped to one shop", async () => {
    const workbook = buildAffiliateCreatorUpdateTemplateWorkbook(
      ExcelJS,
      await translatorFor("en"),
      TAGS,
      [row("a", { performanceSnapshot: rollup, shopPerformanceSnapshot: shopSnapshot })],
      { scopeShopId: SHOP, dataAsOf: null },
    );
    const table = XLSX.utils.sheet_to_json<unknown[]>(await sheetOf(workbook), {
      header: 1,
      blankrows: false,
    });
    expect(table[1]!.slice(AFFILIATE_CREATOR_UPDATE_TEMPLATE_HEADERS.length)).toEqual([
      "2026-10-29",
      "",
      "2026-09-01",
      3,
      2,
      0,
      2000,
      "MXN",
      "",
    ]);
  });

  it("re-imports an export with the new columns exactly like one without them", async () => {
    const t = await translatorFor("zh");
    const rows = [row("creator.name", { performanceSnapshot: rollup })];
    const plain = await sheetOf(
      buildAffiliateCreatorUpdateTemplateWorkbook(ExcelJS, t, TAGS, rows),
    );
    const withPerformance = await sheetOf(
      buildAffiliateCreatorUpdateTemplateWorkbook(ExcelJS, t, TAGS, rows, {
        scopeShopId: "",
        dataAsOf: "2026-11-04T16:00:00.000Z",
      }),
    );
    const parse = (sheet: XLSX.WorkSheet) =>
      parseAffiliateCreatorUpdateRow(
        XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })[0]!,
        TAGS,
      );
    expect(parse(withPerformance)).toEqual(parse(plain));
    expect(parse(withPerformance)).toMatchObject({ username: "creator.name", issue: null });
  });

  it("drops the stale performance columns from the failed-rows export", async () => {
    const t = await translatorFor("en");
    const sheet = await sheetOf(
      buildAffiliateCreatorUpdateTemplateWorkbook(
        ExcelJS,
        t,
        TAGS,
        [row("creator.name", { performanceSnapshot: rollup })],
        { scopeShopId: "", dataAsOf: null },
      ),
    );
    const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    const failure = buildAffiliateCreatorUpdateFailureWorkbook(ExcelJS, t, table[0]!, [
      { rowNumber: 2, reason: "bad", sourceValues: table[1]! },
    ]);
    const out = XLSX.utils.sheet_to_json<unknown[]>(await sheetOf(failure), {
      header: 1,
      blankrows: false,
    });
    expect(out[0]).toEqual([
      ...AFFILIATE_CREATOR_UPDATE_TEMPLATE_HEADERS,
      "source_row",
      "failure_reason",
    ]);
    expect(out[1]!.at(-1)).toBe("bad");
  });
});
