import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import i18n from "../../../i18n/index.js";
import { ToastProvider } from "../../../components/Toast.js";
import { AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY } from "../../../api/shops-queries.js";
import { AffiliateWorkbenchEntityTabs } from "./AffiliateWorkbenchEntityTabs.js";

vi.mock("../../../components/ecommerce/ProductFilter.js", () => ({
  ProductFilter: () => null,
}));

beforeEach(async () => {
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);

describe("Affiliate workbench Sample status filter", () => {
  it("offers every history view and sends ALL as an unfiltered status view", async () => {
    const baseInput = {
      shopId: null,
      businessDeveloperId: null,
      protected: null,
      sortOrder: "ASC",
      limit: 25,
      cursor: null,
    };
    const pendingResult = vi.fn(() => ({
      data: {
        affiliateWorkbenchSamplePage: {
          items: [],
          hasMore: false,
          nextCursor: null,
          openCount: 0,
          expiringSoonCount: 0,
        },
      },
    }));
    const allResult = vi.fn(() => ({
      data: {
        affiliateWorkbenchSamplePage: {
          items: [],
          hasMore: false,
          nextCursor: null,
          openCount: 0,
          expiringSoonCount: 0,
        },
      },
    }));

    render(
      <MockedProvider
        mocks={[
          {
            request: {
              query: AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY,
              variables: {
                input: { ...baseInput, statusFilter: "PENDING_REVIEW" },
              },
            },
            result: pendingResult,
          },
          {
            request: {
              query: AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY,
              variables: { input: { ...baseInput, statusFilter: "ALL" } },
            },
            result: allResult,
          },
        ]}
      >
        <ToastProvider>
          <AffiliateWorkbenchEntityTabs
            tab="SAMPLES"
            selectedShopId=""
            shopOptions={[{ value: "", label: "全部店铺" }]}
            onSelectShop={vi.fn()}
            businessDeveloperOptions={[]}
            selectedBusinessDeveloperId=""
            onSelectBusinessDeveloper={vi.fn()}
            refreshRevision={0}
            onOpen={vi.fn()}
          />
        </ToastProvider>
      </MockedProvider>,
    );

    await waitFor(() => expect(pendingResult).toHaveBeenCalledOnce());
    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("ecommerce.affiliateWorkspace.workbench.colStatus"),
      }),
    );
    const popup = document.querySelector(".custom-select-dropdown")!;
    const labels = Array.from(popup.querySelectorAll(".custom-select-option")).map((node) =>
      node.textContent?.trim(),
    );
    expect(labels).toEqual([
      "全部",
      "待审核",
      "已忽略",
      "已同意",
      "已拒绝",
      "已取消",
      "已过期",
      "同步异常",
    ]);
    fireEvent.click(
      Array.from(popup.querySelectorAll(".custom-select-option")).find(
        (node) => node.textContent?.trim() === "全部",
      )!,
    );
    await waitFor(() => expect(allResult).toHaveBeenCalledOnce());
  });
});
