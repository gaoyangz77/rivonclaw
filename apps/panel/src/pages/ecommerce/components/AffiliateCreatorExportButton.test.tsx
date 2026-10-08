import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { GQL } from "@rivonclaw/core";
import type { Workbook } from "exceljs";
import i18n from "../../../i18n/index.js";
import { AffiliateCreatorExportButton } from "./AffiliateCreatorExportButton.js";

const mocks = vi.hoisted(() => ({ query: vi.fn(), download: vi.fn(), toast: vi.fn() }));
vi.mock("@apollo/client/react", () => ({ useApolloClient: () => ({ query: mocks.query }) }));
vi.mock("../../../components/Toast.js", () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock("../affiliate-creator-export.js", async (original) => ({
  ...(await original<typeof import("../affiliate-creator-export.js")>()),
  downloadAffiliateCreatorWorkbook: mocks.download,
}));

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);
const row: GQL.AffiliateCreatorUpdateExportRow = {
  creatorRelationshipId: "relationship-1",
  username: "creator-1",
  businessDeveloperName: "Old BD",
  sellerProvidedUid: "6905667682868806661",
  sellerNote: "Keep note",
  protect: false,
  manualTagNames: [],
};

it("keeps the clicked filters across pages even when the user changes BD while exporting", async () => {
  let resolveFirst!: (value: unknown) => void;
  mocks.query
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    )
    .mockResolvedValueOnce({
      data: {
        affiliateCreatorUpdateExportPage: {
          offset: 1,
          hasMore: false,
          items: [{ ...row, creatorRelationshipId: "relationship-2", username: "creator-2" }],
        },
      },
    })
    .mockResolvedValueOnce({ data: { creatorManualTags: [] } });
  const input = { businessDeveloperId: "old-bd", manualTagIds: ["tag-1"], shopId: "shop-1" };
  const view = render(<AffiliateCreatorExportButton input={input} />);
  fireEvent.click(screen.getByRole("button", { name: "导出当前筛选的达人" }));
  expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  input.manualTagIds.push("tag-2");
  view.rerender(<AffiliateCreatorExportButton input={{ businessDeveloperId: "new-bd" }} />);
  await act(async () => {
    resolveFirst({
      data: {
        affiliateCreatorUpdateExportPage: {
          offset: 0,
          hasMore: true,
          items: [row],
        },
      },
    });
  });
  await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(1));
  expect(mocks.query.mock.calls[1][0].variables.input).toEqual({
    businessDeveloperId: "old-bd",
    manualTagIds: ["tag-1"],
    shopId: "shop-1",
    offset: 1,
    limit: 100,
  });
  const [workbook, filename] = mocks.download.mock.calls[0] as [Workbook, string];
  expect(filename).toBe("affiliate-creator-bulk-update.xlsx");
  expect(workbook.worksheets[0].rowCount).toBe(3);
  expect(workbook.worksheets[0].getCell("B2").value).toBe("6905667682868806661");
  expect(mocks.toast).not.toHaveBeenCalled();
});

it("does not download a partial file when a later page fails", async () => {
  mocks.query
    .mockResolvedValueOnce({
      data: {
        affiliateCreatorUpdateExportPage: {
          offset: 0,
          hasMore: true,
          items: [row],
        },
      },
    })
    .mockRejectedValueOnce(new Error("Second page unavailable"));
  render(<AffiliateCreatorExportButton input={{ businessDeveloperId: "old-bd" }} />);
  fireEvent.click(screen.getByRole("button", { name: "导出当前筛选的达人" }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("Second page unavailable", "error"));
  expect(mocks.download).not.toHaveBeenCalled();
  expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
});
