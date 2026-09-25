import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";
import {
  AFFILIATE_DETAIL_EXPORT_PAGE_SIZE,
  AffiliateDetailExportChangedError,
  AffiliateDetailExportTooLargeError,
  buildAffiliateDetailWorkbook,
  fetchAllAffiliateDetailRows,
  type AffiliateDetailPage,
} from "./affiliate-detail-export.js";
import type { GQL } from "@rivonclaw/core";

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
      columns: ["SHOP_ALIAS", "AFFILIATE_CREATOR_GMV_AT_APPLICATION"],
      rows: [{ SHOP_ALIAS: null, AFFILIATE_CREATOR_GMV_AT_APPLICATION: null }],
      label: (key) => key,
      displayText: (_key, value) => String(value),
    });
    const row = workbook.getWorksheet("Sample review")!.getRow(2);
    expect(row.getCell(1).value).toBeNull();
    expect(row.getCell(2).value).toBeNull();
  });
});

describe("Affiliate detail full export page walk", () => {
  const input = {
    datasetId: "AFFILIATE_SAMPLE_REVIEW_DETAIL",
    shopIds: ["shop-1"],
    filters: [{ dimension: "CREATOR_OPEN_ID", operator: "IN", values: ["creator-1"] }],
  } as GQL.EcomBiQueryInput;
  const page = (count: number, start: number, hasMore: boolean, totalRows: number | null) => ({
    rows: Array.from({ length: count }, (_, index) => ({ ROW: start + index })),
    pageInfo: { hasMore, totalRows },
  });

  /** Serves exact backend windows of a `total`-row result, whatever offset is asked. */
  const windowed = (total: number) =>
    vi.fn(async (pageInput: GQL.EcomBiQueryInput, _signal: AbortSignal) => {
      const offset = pageInput.offset ?? 0;
      const count = Math.max(0, Math.min(pageInput.limit ?? 0, total - offset));
      return page(count, offset, offset + count < total, total);
    });

  it("fetches every window of the frozen query at the page cap, in order", async () => {
    const fetchPage = windowed(2203);
    const progress: Array<[number, number]> = [];
    const rows = await fetchAllAffiliateDetailRows({
      input,
      fetchPage,
      signal: new AbortController().signal,
      onProgress: (done, total) => progress.push([done, total]),
    });
    expect(rows).toHaveLength(2203);
    expect(rows.map((row) => row.ROW)).toEqual(Array.from({ length: 2203 }, (_, index) => index));
    expect(fetchPage.mock.calls.map(([pageInput]) => [pageInput.limit, pageInput.offset])).toEqual([
      [AFFILIATE_DETAIL_EXPORT_PAGE_SIZE, 0],
      [AFFILIATE_DETAIL_EXPORT_PAGE_SIZE, 500],
      [AFFILIATE_DETAIL_EXPORT_PAGE_SIZE, 1000],
      [AFFILIATE_DETAIL_EXPORT_PAGE_SIZE, 1500],
      [AFFILIATE_DETAIL_EXPORT_PAGE_SIZE, 2000],
    ]);
    for (const [pageInput] of fetchPage.mock.calls) {
      expect(pageInput).toMatchObject({ datasetId: input.datasetId, filters: input.filters });
    }
    expect(input).not.toHaveProperty("offset");
    expect(progress).toEqual([[500, 2203], [1000, 2203], [1500, 2203], [2000, 2203], [2203, 2203]]);
  });

  it("never has more than one page in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    const serve = windowed(2000);
    const fetchPage = vi.fn(async (pageInput: GQL.EcomBiQueryInput, signal: AbortSignal) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
      return serve(pageInput, signal);
    });
    const rows = await fetchAllAffiliateDetailRows({
      input,
      fetchPage,
      signal: new AbortController().signal,
    });
    expect(rows).toHaveLength(2000);
    expect(peak).toBe(1);
  });

  it("refuses a result above the export cap before fetching further pages", async () => {
    const fetchPage = windowed(10_001);
    await expect(
      fetchAllAffiliateDetailRows({ input, fetchPage, signal: new AbortController().signal }),
    ).rejects.toBeInstanceOf(AffiliateDetailExportTooLargeError);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("stops at the next page boundary when cancelled and returns no rows", async () => {
    const controller = new AbortController();
    let release!: (value: AffiliateDetailPage) => void;
    const fetchPage = vi
      .fn<(pageInput: GQL.EcomBiQueryInput, signal: AbortSignal) => Promise<AffiliateDetailPage>>()
      .mockResolvedValueOnce(page(500, 0, true, 900))
      .mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const walk = fetchAllAffiliateDetailRows({ input, fetchPage, signal: controller.signal });
    await vi.waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    controller.abort();
    release(page(400, 500, false, 900));
    await expect(walk).rejects.toThrow();
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("fails loudly when the matching rows change mid-export or the total is missing", async () => {
    const drift = [page(500, 0, true, 900), page(400, 500, false, 901)];
    await expect(
      fetchAllAffiliateDetailRows({
        input,
        fetchPage: async () => drift.shift()!,
        signal: new AbortController().signal,
      }),
    ).rejects.toBeInstanceOf(AffiliateDetailExportChangedError);

    await expect(
      fetchAllAffiliateDetailRows({
        input,
        fetchPage: async () => page(3, 0, false, null),
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("totalRows");

    await expect(
      fetchAllAffiliateDetailRows({
        input,
        fetchPage: async () => page(0, 0, true, 10),
        signal: new AbortController().signal,
      }),
    ).rejects.toBeInstanceOf(AffiliateDetailExportChangedError);

    await expect(
      fetchAllAffiliateDetailRows({
        input,
        fetchPage: async () => page(10, 0, true, 10),
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("hasMore");
  });
});
