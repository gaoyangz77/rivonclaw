import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import {
  PRODUCT_KNOWLEDGE_EXPORT_COLUMNS,
  PRODUCT_KNOWLEDGE_EXPORT_PAGE_SIZE,
  buildProductKnowledgeWorkbook,
  collectProductKnowledgeExportRows,
  type ProductKnowledgeExportText,
} from "./product-knowledge-export.js";
import { useTimeZone } from "../../../test/use-time-zone.js";

type Knowledge = Omit<GQL.ProductKnowledge, "bindings">;

function knowledge(overrides: Partial<Knowledge> = {}): Knowledge {
  return {
    id: "k1",
    name: "折叠风扇",
    merchantPid: "FAN-01",
    status: GQL.ProductKnowledgeStatus.Active,
    revision: 2,
    bindingCount: 5,
    usageInstructionsMarkdown: "### 使用方法\n1. 按下电源键开机",
    qaMarkdown: "**问:** 能挂脖吗？\n\n答: 可以",
    creativeCasesMarkdown: "",
    archivedAt: null,
    createdAt: "2026-11-10T07:40:00.000Z",
    updatedAt: "2026-11-11T04:35:00.000Z",
    ...overrides,
  } as Knowledge;
}

function page(items: Knowledge[], offset: number, totalCount: number): GQL.ProductKnowledgePage {
  return {
    items,
    offset,
    limit: PRODUCT_KNOWLEDGE_EXPORT_PAGE_SIZE,
    totalCount,
  } as GQL.ProductKnowledgePage;
}

const text: ProductKnowledgeExportText = {
  header: (column) => `h:${column}`,
  status: (status) => `status:${status}`,
};

describe("product knowledge export pages", () => {
  it("reads offset pages of the largest size until the total is reached", async () => {
    const readPage = vi
      .fn()
      .mockResolvedValueOnce(page([knowledge({ id: "a" }), knowledge({ id: "b" })], 0, 3))
      .mockResolvedValueOnce(page([knowledge({ id: "c" })], 2, 3));
    const progress = vi.fn();

    const rows = await collectProductKnowledgeExportRows({ readPage, onProgress: progress });

    expect(rows.map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(readPage.mock.calls).toEqual([
      [0, PRODUCT_KNOWLEDGE_EXPORT_PAGE_SIZE],
      [2, PRODUCT_KNOWLEDGE_EXPORT_PAGE_SIZE],
    ]);
    expect(progress.mock.calls).toEqual([
      [2, 3],
      [3, 3],
    ]);
  });

  it("returns nothing from an empty library after one request", async () => {
    const readPage = vi.fn().mockResolvedValue(page([], 0, 0));
    await expect(collectProductKnowledgeExportRows({ readPage })).resolves.toEqual([]);
    expect(readPage).toHaveBeenCalledTimes(1);
  });

  it("stops when an entry edited mid-export comes back on a later page", async () => {
    const readPage = vi
      .fn()
      .mockResolvedValueOnce(page([knowledge({ id: "a" }), knowledge({ id: "b" })], 0, 3))
      .mockResolvedValueOnce(page([knowledge({ id: "b" })], 2, 3));
    await expect(collectProductKnowledgeExportRows({ readPage })).rejects.toThrow(
      /changed during the export/,
    );
  });

  it("stops when the total changes between pages", async () => {
    const readPage = vi
      .fn()
      .mockResolvedValueOnce(page([knowledge({ id: "a" })], 0, 2))
      .mockResolvedValueOnce(page([knowledge({ id: "b" })], 1, 3));
    await expect(collectProductKnowledgeExportRows({ readPage })).rejects.toThrow(
      /changed during the export/,
    );
  });

  it("stops instead of looping when a page comes back empty before the total", async () => {
    const readPage = vi
      .fn()
      .mockResolvedValueOnce(page([knowledge({ id: "a" })], 0, 2))
      .mockResolvedValueOnce(page([], 1, 2));
    await expect(collectProductKnowledgeExportRows({ readPage })).rejects.toThrow(
      /changed during the export/,
    );
    expect(readPage).toHaveBeenCalledTimes(2);
  });

  it("rejects without rows when a page fails", async () => {
    const readPage = vi
      .fn()
      .mockResolvedValueOnce(page([knowledge({ id: "a" })], 0, 2))
      .mockRejectedValueOnce(new Error("Network down"));
    await expect(collectProductKnowledgeExportRows({ readPage })).rejects.toThrow("Network down");
  });
});

describe("product knowledge workbook", () => {
  useTimeZone("Asia/Shanghai");

  it("writes localized headers, Markdown as text and spreadsheet times", async () => {
    const workbook = buildProductKnowledgeWorkbook(ExcelJS, {
      sheetName: "Knowledge",
      rows: [
        knowledge(),
        knowledge({
          id: "k2",
          name: "=SUM(A1)",
          merchantPid: null,
          status: GQL.ProductKnowledgeStatus.Archived,
          bindingCount: 0,
          qaMarkdown: "",
        }),
      ],
      text,
    });
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = loaded.getWorksheet("Knowledge")!;
    const cell = (row: number, column: (typeof PRODUCT_KNOWLEDGE_EXPORT_COLUMNS)[number]) =>
      sheet.getRow(row).getCell(PRODUCT_KNOWLEDGE_EXPORT_COLUMNS.indexOf(column) + 1).value;

    expect(sheet.getRow(1).values).toEqual([
      undefined,
      ...PRODUCT_KNOWLEDGE_EXPORT_COLUMNS.map((column) => `h:${column}`),
    ]);
    expect(cell(2, "name")).toBe("折叠风扇");
    expect(cell(2, "merchantPid")).toBe("FAN-01");
    expect(cell(2, "status")).toBe("status:ACTIVE");
    expect(cell(2, "usageInstructions")).toBe("### 使用方法\n1. 按下电源键开机");
    expect(cell(2, "qa")).toBe("**问:** 能挂脖吗？\n\n答: 可以");
    expect(cell(2, "creativeCases")).toBeNull();
    expect(cell(2, "bindingCount")).toBe(5);
    // 04:35Z is 12:35 in Shanghai: the sheet shows the device's wall clock.
    expect(cell(2, "updatedAt")).toEqual(new Date("2026-11-11T12:35:00.000Z"));
    expect(cell(2, "createdAt")).toEqual(new Date("2026-11-10T15:40:00.000Z"));

    // A value beginning with "=" stays text, never a formula.
    expect(cell(3, "name")).toBe("=SUM(A1)");
    expect(cell(3, "merchantPid")).toBeNull();
    expect(cell(3, "status")).toBe("status:ARCHIVED");
    expect(cell(3, "qa")).toBeNull();
    expect(cell(3, "bindingCount")).toBe(0);
  });
});
