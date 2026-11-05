import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";
import type { GQL } from "@rivonclaw/core";
import {
  AFTER_SALE_EXPORT_COLUMNS,
  buildAfterSaleWorkbook,
  collectAfterSaleExportRows,
  type AfterSaleExportText,
} from "./after-sale-export.js";
import { useTimeZone } from "../../../test/use-time-zone.js";

function request(overrides: Partial<GQL.EcomAfterSaleRequest> = {}): GQL.EcomAfterSaleRequest {
  return {
    kind: "RETURN_AND_REFUND",
    requestId: "4035000000000001",
    shopId: "shop-1",
    shopName: "Brightloom US",
    orderId: "576955457941576627",
    status: "RETURN_OR_REFUND_REQUEST_PENDING",
    requestType: "RETURN_AND_REFUND",
    role: "BUYER",
    reason: "ecom_order_delivered_refund_and_return_reason_damaged",
    reasonText: "Damaged item",
    currency: "USD",
    refundTotal: "1234.5",
    isQuickRefund: false,
    sellerNextAction: "SELLER_RESPOND_RETURN",
    sellerActionDeadline: "2026-11-06T02:00:00.000Z",
    createTime: "2026-11-01T10:30:00.000Z",
    updateTime: "2026-11-02T10:30:00.000Z",
    needsReview: true,
    sellerDecision: null,
    sellerDecidedAt: null,
    decisionAwaitingPlatform: false,
    lines: [
      {
        lineItemId: "l1",
        orderLineItemId: "ol1",
        productId: "p1",
        productName: "Linen shirt",
        skuId: "s1",
        skuName: "White / M",
        sellerSku: "=SKU-1",
        productImageUrl: null,
        currency: "USD",
        refundTotal: "1000",
      },
      {
        lineItemId: "l2",
        orderLineItemId: "ol2",
        productId: "p2",
        productName: "Canvas tote",
        skuId: "s2",
        skuName: null,
        sellerSku: "TOTE-1",
        productImageUrl: null,
        currency: "USD",
        refundTotal: "234.5",
      },
    ],
    ...overrides,
  } as GQL.EcomAfterSaleRequest;
}

const text: AfterSaleExportText = {
  header: (column) => `h:${column}`,
  kind: (kind) => `kind:${kind}`,
  status: (status) => `status:${status}`,
  sellerAction: (action) => `action:${action}`,
  sellerDecision: (decision) => `decision:${decision}`,
  role: (role) => `role:${role}`,
  requestType: (requestType) => `type:${requestType}`,
  shop: (row) => row.shopName ?? row.shopId,
  yes: "Yes",
  no: "No",
};

function page(
  items: GQL.EcomAfterSaleRequest[],
  nextCursor: string | null,
  totalCount: number,
): GQL.EcomAfterSaleRequestPage {
  return { items, nextCursor, totalCount } as GQL.EcomAfterSaleRequestPage;
}

describe("after-sale export pages", () => {
  it("walks the cursor to the end with the frozen filters and the largest page", async () => {
    const input: GQL.EcomAfterSaleRequestsInput = { view: "ALL", kinds: ["REFUND"] };
    const readPage = vi
      .fn()
      .mockResolvedValueOnce(page([request({ requestId: "a" }), request({ requestId: "b" })], "c1", 3))
      .mockResolvedValueOnce(page([request({ requestId: "c" })], null, 3));
    const progress = vi.fn();

    const rows = await collectAfterSaleExportRows({ input, pageSize: 100, readPage, onProgress: progress });

    expect(rows.map((row) => row.requestId)).toEqual(["a", "b", "c"]);
    expect(readPage.mock.calls.map(([call]) => call)).toEqual([
      { view: "ALL", kinds: ["REFUND"], limit: 100 },
      { view: "ALL", kinds: ["REFUND"], limit: 100, cursor: "c1" },
    ]);
    expect(input).toEqual({ view: "ALL", kinds: ["REFUND"] });
    expect(progress.mock.calls).toEqual([
      [2, 3],
      [3, 3],
    ]);
  });

  it("keeps one row per request when a moved request comes back on a later page", async () => {
    const readPage = vi
      .fn()
      .mockResolvedValueOnce(page([request({ requestId: "a", status: "OLD" }), request({ requestId: "b" })], "c1", 2))
      .mockResolvedValueOnce(page([request({ requestId: "a", status: "NEW" })], null, 2));

    const rows = await collectAfterSaleExportRows({ input: { view: "TO_REVIEW" }, pageSize: 100, readPage });

    expect(rows.map((row) => [row.requestId, row.status])).toEqual([
      ["a", "NEW"],
      ["b", "RETURN_OR_REFUND_REQUEST_PENDING"],
    ]);
  });

  it("fails instead of looping when the cursor does not advance", async () => {
    const readPage = vi.fn().mockResolvedValue(page([request()], "same", 9));
    await expect(
      collectAfterSaleExportRows({ input: { view: "ALL" }, pageSize: 100, readPage }),
    ).rejects.toThrow(/did not advance/);
    expect(readPage).toHaveBeenCalledTimes(2);
  });

  it("rejects without a file when a page fails", async () => {
    const readPage = vi
      .fn()
      .mockResolvedValueOnce(page([request()], "c1", 2))
      .mockRejectedValueOnce(new Error("Network down"));
    await expect(
      collectAfterSaleExportRows({ input: { view: "ALL" }, pageSize: 100, readPage }),
    ).rejects.toThrow("Network down");
  });
});

describe("after-sale workbook", () => {
  useTimeZone("Asia/Shanghai");

  it("writes localized headers, labelled values, joined lines and spreadsheet times", async () => {
    const workbook = buildAfterSaleWorkbook(ExcelJS, {
      sheetName: "After-sale",
      rows: [
        request(),
        request({
          kind: "CANCELLATION",
          requestId: "c2",
          orderId: null,
          isQuickRefund: true,
          refundTotal: null,
          sellerDecision: "APPROVED",
          sellerDecidedAt: "2026-11-03T00:00:00.000Z",
          sellerActionDeadline: null,
          lines: [],
        }),
      ],
      text,
    });
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = loaded.getWorksheet("After-sale")!;
    const cell = (row: number, column: (typeof AFTER_SALE_EXPORT_COLUMNS)[number]) =>
      sheet.getRow(row).getCell(AFTER_SALE_EXPORT_COLUMNS.indexOf(column) + 1).value;

    expect(sheet.getRow(1).values).toEqual([
      undefined,
      ...AFTER_SALE_EXPORT_COLUMNS.map((column) => `h:${column}`),
    ]);
    expect(cell(2, "kind")).toBe("kind:RETURN_AND_REFUND");
    expect(cell(2, "orderId")).toBe("576955457941576627");
    expect(cell(2, "status")).toBe("status:RETURN_OR_REFUND_REQUEST_PENDING");
    expect(cell(2, "sellerAction")).toBe("action:SELLER_RESPOND_RETURN");
    expect(cell(2, "refund")).toBe(1234.5);
    expect(cell(2, "reason")).toBe("Damaged item");
    expect(cell(2, "products")).toBe("Linen shirt\nCanvas tote");
    expect(cell(2, "skus")).toBe("White / M");
    // A value beginning with "=" stays text, never a formula.
    expect(cell(2, "sellerSkus")).toBe("=SKU-1\nTOTE-1");
    expect(cell(2, "role")).toBe("role:BUYER");
    expect(cell(2, "quickRefund")).toBe("No");
    // 02:00Z is 10:00 in Shanghai: the sheet shows the device's wall clock.
    expect(cell(2, "deadline")).toEqual(new Date("2026-11-06T10:00:00.000Z"));
    expect(cell(2, "created")).toEqual(new Date("2026-11-01T18:30:00.000Z"));

    expect(cell(3, "orderId")).toBeNull();
    expect(cell(3, "refund")).toBeNull();
    expect(cell(3, "deadline")).toBeNull();
    expect(cell(3, "products")).toBeNull();
    expect(cell(3, "quickRefund")).toBe("Yes");
    expect(cell(3, "sellerDecision")).toBe("decision:APPROVED");
    expect(cell(3, "sellerDecidedAt")).toEqual(new Date("2026-11-03T08:00:00.000Z"));
  });
});
