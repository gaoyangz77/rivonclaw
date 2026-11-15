import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  CREATOR_LIST_HEADER,
  CREATOR_LIST_MAX_USERNAMES,
  CreatorListWorkbookError,
  isValidCreatorListUsername,
  normalizeCreatorListUsername,
  prepareCreatorListUsernames,
  readCreatorListWorkbook,
} from "./affiliate-campaign-creator-list.js";
import {
  CREATOR_LIST_TEMPLATE_DATA_SHEET_NAME,
  buildCreatorListTemplateWorkbook,
} from "./affiliate-campaign-creator-list-template.js";

function bytes(rows: unknown[][]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "data");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

function row(raw: string, rowNumber = 2) {
  return { rowNumber, raw };
}

describe("normalizing a username", () => {
  it.each([
    ["@Name", "name"],
    ["  name ", "name"],
    ["@@Name", "name"],
    ["https://www.tiktok.com/@Name?lang=en", "name"],
    ["tiktok.com/@name/", "name"],
    ["https://www.tiktok.com/@Some.Name_1/video/123", "some.name_1"],
  ])("%s -> %s", (raw, expected) => {
    expect(normalizeCreatorListUsername(raw)).toBe(expected);
  });

  it("accepts letters, digits, dot and underscore up to 24 characters", () => {
    expect(isValidCreatorListUsername("a.b_c9")).toBe(true);
    expect(isValidCreatorListUsername("a".repeat(24))).toBe(true);
    expect(isValidCreatorListUsername("a".repeat(25))).toBe(false);
    expect(isValidCreatorListUsername("")).toBe(false);
    expect(isValidCreatorListUsername("bad name")).toBe(false);
    expect(isValidCreatorListUsername("bad-name")).toBe(false);
    expect(isValidCreatorListUsername("名字")).toBe(false);
  });
});

describe("reading the workbook", () => {
  it("reads the creator_username column with its spreadsheet row, skipping blank rows", () => {
    expect(
      readCreatorListWorkbook(XLSX, bytes([[CREATOR_LIST_HEADER], ["@Alice"], [""], ["bob"]])),
    ).toEqual([row("@Alice", 2), row("bob", 4)]);
  });

  it("finds the header in a column that is not the first, ignoring case and spacing", () => {
    expect(
      readCreatorListWorkbook(
        XLSX,
        bytes([
          ["note", " Creator_Username "],
          ["x", "alice"],
          ["y", ""],
        ]),
      ),
    ).toEqual([row("alice")]);
  });

  it("converts a numeric cell, and keeps an imprecise one invalid", () => {
    const [digits, imprecise, fraction] = readCreatorListWorkbook(
      XLSX,
      bytes([[CREATOR_LIST_HEADER], [12345], [Number.MAX_SAFE_INTEGER * 4], [1.5]]),
    );
    expect(digits?.raw).toBe("12345");
    expect(isValidCreatorListUsername(normalizeCreatorListUsername(imprecise!.raw))).toBe(false);
    expect(isValidCreatorListUsername(normalizeCreatorListUsername(fraction!.raw))).toBe(false);
  });

  it("reads a csv", () => {
    const encoded = new TextEncoder().encode("\uFEFFcreator_username\n@Alice\nbob\n");
    const csv = new ArrayBuffer(encoded.length);
    new Uint8Array(csv).set(encoded);
    const rows = readCreatorListWorkbook(XLSX, csv);
    expect(rows.map((r) => r.raw)).toEqual(["@Alice", "bob"]);
  });

  it("names a missing column and refuses a file without usernames", () => {
    expect(() => readCreatorListWorkbook(XLSX, bytes([["username"], ["a"]]))).toThrow(
      CreatorListWorkbookError,
    );
    expect(() => readCreatorListWorkbook(XLSX, bytes([["username"], ["a"]]))).toThrow(
      "MISSING_COLUMN",
    );
    expect(() => readCreatorListWorkbook(XLSX, bytes([[CREATOR_LIST_HEADER]]))).toThrow("NO_ROWS");
    expect(() => readCreatorListWorkbook(XLSX, bytes([[CREATOR_LIST_HEADER], [""]]))).toThrow(
      "NO_ROWS",
    );
  });
});

describe("preparing usernames", () => {
  it("normalizes, dedupes keeping the first, and reports invalid rows with their numbers", () => {
    const prepared = prepareCreatorListUsernames([
      row("@Alice", 2),
      row("bob", 3),
      row("ALICE", 4),
      row("bad name", 5),
      row("a".repeat(25), 6),
      row("https://www.tiktok.com/@Bob?lang=en", 7),
    ]);
    expect(prepared.usernames).toEqual(["alice", "bob"]);
    expect(prepared.duplicateCount).toBe(2);
    expect(prepared.invalid).toEqual([row("bad name", 5), row("a".repeat(25), 6)]);
    expect(prepared.tooMany).toBe(false);
  });

  it("flags more than 5,000 distinct usernames, and not exactly 5,000 or duplicates beyond it", () => {
    const make = (count: number) =>
      Array.from({ length: count }, (_, index) => row(`user${index}`, index + 2));
    expect(prepareCreatorListUsernames(make(CREATOR_LIST_MAX_USERNAMES)).tooMany).toBe(false);
    expect(prepareCreatorListUsernames(make(CREATOR_LIST_MAX_USERNAMES + 1)).tooMany).toBe(true);
    const withDuplicates = [...make(CREATOR_LIST_MAX_USERNAMES), row("user0")];
    expect(prepareCreatorListUsernames(withDuplicates).tooMany).toBe(false);
  });
});

describe("the template", () => {
  const t = (key: string) => key;

  it("has the single header on the data sheet first, text format, and no example rows", async () => {
    const workbook = buildCreatorListTemplateWorkbook(ExcelJS, t);
    const data = workbook.worksheets[0]!;
    expect(data.name).toBe(CREATOR_LIST_TEMPLATE_DATA_SHEET_NAME);
    expect(data.getRow(1).values).toEqual([undefined, CREATOR_LIST_HEADER]);
    expect(data.rowCount).toBe(1);
    expect(data.getColumn(1).numFmt).toBe("@");
    expect(workbook.worksheets).toHaveLength(2);
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
    expect(() => readCreatorListWorkbook(XLSX, buffer)).toThrow("NO_ROWS");
  });

  it("reads back through the importer once a seller fills a row", async () => {
    const workbook = buildCreatorListTemplateWorkbook(ExcelJS, t);
    workbook.worksheets[0]!.addRow(["@Alice"]);
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
    expect(readCreatorListWorkbook(XLSX, buffer)).toEqual([row("@Alice")]);
  });
});
