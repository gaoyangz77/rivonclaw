import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildAffiliateDetailWorkbook } from "./affiliate-detail-export.js";

describe("Affiliate detail Excel export", () => {
  it("keeps provider IDs as text and dates and metrics as spreadsheet values", async () => {
    const workbook = buildAffiliateDetailWorkbook(ExcelJS, {
      sheetName: "Fulfillment",
      columns: [
        "DATE",
        "SHOP_NAME",
        "SHOP_ALIAS",
        "ORDER_ID",
        "SAMPLE_HAS_SHIPMENT",
        "AFFILIATE_UNITS",
      ],
      rows: [{
        DATE: "2026-09-24",
        SHOP_NAME: "=1+1",
        SHOP_ALIAS: "MXTK-02",
        ORDER_ID: "576955457941576627",
        SAMPLE_HAS_SHIPMENT: 1,
        AFFILIATE_UNITS: "12",
      }],
      label: (key) => key,
      displayText: (_key, value) => value === 1 ? "Yes" : String(value),
    });
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = loaded.getWorksheet("Fulfillment")!;
    expect(sheet.getCell("A2").value).toEqual(new Date("2026-09-24T00:00:00.000Z"));
    expect(sheet.getCell("B2").value).toBe("=1+1");
    expect(sheet.getCell("C2").value).toBe("MXTK-02");
    expect(sheet.getCell("D2").value).toBe("576955457941576627");
    expect(sheet.getCell("E2").value).toBe("Yes");
    expect(sheet.getCell("F2").value).toBe(12);
    expect(sheet.getCell("A2").numFmt).toBe("yyyy-mm-dd");
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
  });

  it("does not convert missing metrics to zero", () => {
    const workbook = buildAffiliateDetailWorkbook(ExcelJS, {
      sheetName: "Sample review",
      columns: ["SHOP_ALIAS", "AFFILIATE_CREATOR_30D_GMV_AT_APPLICATION"],
      rows: [{ SHOP_ALIAS: null, AFFILIATE_CREATOR_30D_GMV_AT_APPLICATION: null }],
      label: (key) => key,
      displayText: (_key, value) => String(value),
    });
    const row = workbook.getWorksheet("Sample review")!.getRow(2);
    expect(row.getCell(1).value).toBeNull();
    expect(row.getCell(2).value).toBeNull();
  });
});
