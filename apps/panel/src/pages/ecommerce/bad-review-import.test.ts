import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { BadReviewWorkbookError, readBadReviewWorkbook } from "./bad-review-import.js";
import { buildBadReviewTemplateWorkbook } from "./bad-review-template.js";

const HEADER = ["订单号", "差评原因", "差评星级", "差评时间", "跟进状态", "备注"];

function bytes(rows: unknown[][]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "data");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

describe("reading the workbook", () => {
  it("carries cells across as written, with the spreadsheet row number", () => {
    const rows = readBadReviewWorkbook(XLSX, bytes([
      HEADER,
      ["576000000000000001", "Broken", 1, "2026-11-01 10:00:00", "", ""],
      ["", "", "", "", "", ""],
      ["576000000000000002", "", "", "", "已结束", "Done"],
    ]));
    expect(rows).toEqual([
      {
        rowNumber: 2, orderId: "576000000000000001", reason: "Broken", stars: "1",
        reviewTime: "2026-11-01 10:00:00", status: null, note: null,
      },
      {
        rowNumber: 4, orderId: "576000000000000002", reason: null, stars: null,
        reviewTime: null, status: "已结束", note: "Done",
      },
    ]);
  });

  it("reads a date cell as its wall clock, with no time zone in the way", () => {
    // 2026-11-01 10:30:00 as an Excel serial.
    const [row] = readBadReviewWorkbook(XLSX, bytes([HEADER, ["576000000000000001", "", 2, 46327.4375, "", ""]]));
    expect(row?.reviewTime).toBe("2026-11-01 10:30:00");
  });

  it("never lets a numeric order ID pass as digits, because it has lost precision", () => {
    const [row] = readBadReviewWorkbook(XLSX, bytes([HEADER, [576000000000000001, "", "", "", "已结束", ""]]));
    expect(row?.orderId).not.toMatch(/^\d{18}$/);
  });

  it("names missing columns and refuses an empty file", () => {
    expect(() => readBadReviewWorkbook(XLSX, bytes([["订单号"], ["1"]]))).toThrow(BadReviewWorkbookError);
    try {
      readBadReviewWorkbook(XLSX, bytes([["订单号"], ["1"]]));
    } catch (error) {
      expect((error as BadReviewWorkbookError).columns).toContain("差评星级");
    }
    expect(() => readBadReviewWorkbook(XLSX, bytes([HEADER]))).toThrow("NO_ROWS");
  });
});

describe("the template", () => {
  const t = (key: string) => key;

  it("reads back through the importer: columns, text order IDs and no example rows", async () => {
    const workbook = buildBadReviewTemplateWorkbook(ExcelJS, t);
    const data = workbook.worksheets[0]!;
    expect(data.getRow(1).values).toEqual([undefined, ...HEADER]);
    expect(data.rowCount).toBe(1);
    expect(data.getColumn(1).numFmt).toBe("@");
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
    expect(() => readBadReviewWorkbook(XLSX, buffer)).toThrow("NO_ROWS");
  });

  it("offers every status in the dropdown except 跟进中", async () => {
    const workbook = buildBadReviewTemplateWorkbook(ExcelJS, t);
    const model = (workbook.worksheets[0] as unknown as {
      dataValidations: { model: Record<string, { formulae: string[] }> };
    }).dataValidations.model;
    const [formula] = Object.values(model)[0]!.formulae;
    expect(formula).toBe('"待跟进,已更新,已删评,已结束"');
    expect(formula).not.toContain("跟进中");
  });
});
