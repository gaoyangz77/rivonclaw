import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GQL } from "@rivonclaw/core";
import type { Workbook } from "exceljs";
import i18n from "../../../i18n/index.js";
import { ProductKnowledgeExportButton } from "./ProductKnowledgeExportButton.js";

const mocks = vi.hoisted(() => ({ query: vi.fn(), download: vi.fn(), toast: vi.fn() }));
vi.mock("@apollo/client/react", () => ({ useApolloClient: () => ({ query: mocks.query }) }));
vi.mock("../../../components/Toast.js", () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock("../after-sale-export.js", async (original) => ({
  ...(await original<typeof import("../after-sale-export.js")>()),
  downloadAfterSaleWorkbook: mocks.download,
}));

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);

function knowledge(id: string, name: string) {
  return {
    id,
    name,
    merchantPid: null,
    status: GQL.ProductKnowledgeStatus.Active,
    revision: 1,
    bindingCount: 3,
    usageInstructionsMarkdown: "### 使用方法\n涂抹即可",
    qaMarkdown: "",
    creativeCasesMarkdown: "",
    archivedAt: null,
    createdAt: "2026-11-10T07:40:00.000Z",
    updatedAt: "2026-11-11T04:35:00.000Z",
  };
}

function page(items: unknown[], offset: number, totalCount: number) {
  return { data: { productKnowledges: { items, offset, limit: 100, totalCount } } };
}

it("keeps the clicked status and search across pages and downloads every entry", async () => {
  let resolveFirst!: (value: unknown) => void;
  mocks.query
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    )
    .mockResolvedValueOnce(page([knowledge("k2", "生发霜")], 1, 2));
  const view = render(
    <ProductKnowledgeExportButton
      status={GQL.ProductKnowledgeStatus.Active}
      search="霜"
      disabled={false}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "导出 Excel" }));
  expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  view.rerender(
    <ProductKnowledgeExportButton
      status={GQL.ProductKnowledgeStatus.Archived}
      search=""
      disabled={false}
    />,
  );
  await act(async () => {
    resolveFirst(page([knowledge("k1", "折叠风扇")], 0, 2));
  });
  await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(1));

  expect(mocks.query.mock.calls.map(([call]) => call.variables.input)).toEqual([
    { status: GQL.ProductKnowledgeStatus.Active, search: "霜", offset: 0, limit: 100 },
    { status: GQL.ProductKnowledgeStatus.Active, search: "霜", offset: 1, limit: 100 },
  ]);
  expect(mocks.query.mock.calls[0][0].fetchPolicy).toBe("no-cache");
  const [workbook, filename] = mocks.download.mock.calls[0] as [Workbook, string];
  expect(filename).toMatch(/^product-knowledge-active-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const sheet = workbook.worksheets[0];
  expect(sheet.name).toBe("产品知识");
  expect(sheet.rowCount).toBe(3);
  expect(sheet.getCell("A1").value).toBe("知识库名称");
  expect(sheet.getCell("A2").value).toBe("折叠风扇");
  expect(sheet.getCell("C2").value).toBe("使用中");
  expect(sheet.getCell("A3").value).toBe("生发霜");
  expect(mocks.toast).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "导出 Excel" }).hasAttribute("disabled")).toBe(false);
});

it("does not download a partial file when a later page fails", async () => {
  mocks.query
    .mockResolvedValueOnce(page([knowledge("k1", "折叠风扇")], 0, 2))
    .mockRejectedValueOnce(new Error("Second page unavailable"));
  render(
    <ProductKnowledgeExportButton
      status={GQL.ProductKnowledgeStatus.Active}
      search=""
      disabled={false}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "导出 Excel" }));
  await waitFor(() =>
    expect(mocks.toast).toHaveBeenCalledWith("导出失败。 Second page unavailable", "error"),
  );
  expect(mocks.download).not.toHaveBeenCalled();
  expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
});

it("stays disabled while the page says there is nothing to export", () => {
  render(
    <ProductKnowledgeExportButton status={GQL.ProductKnowledgeStatus.Active} search="" disabled />,
  );
  expect(screen.getByRole("button", { name: "导出 Excel" }).hasAttribute("disabled")).toBe(true);
});
