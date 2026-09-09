import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import i18n from "../../../i18n/index.js";
import { ToastProvider } from "../../../components/Toast.js";
import {
  AFFILIATE_WORKBENCH_PENDING_CONVERSATION_PAGE_QUERY,
  AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY,
} from "../../../api/shops-queries.js";
import { AffiliateWorkbenchEntityTabs } from "./AffiliateWorkbenchEntityTabs.js";

vi.mock("../../../components/ecommerce/ProductFilter.js", () => ({
  ProductFilter: () => null,
}));

beforeEach(async () => {
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);

describe("workbench time-order control", () => {
  it.each(["SAMPLES", "MESSAGES"] as const)(
    "sends the order on %s queries and pagination, resetting the cursor when it changes",
    async (tab) => {
      const samples = tab === "SAMPLES";
      const query = samples
        ? AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY
        : AFFILIATE_WORKBENCH_PENDING_CONVERSATION_PAGE_QUERY;
      const field = samples
        ? "affiliateWorkbenchSamplePage"
        : "affiliateWorkbenchPendingConversationPage";
      const input = {
        shopId: null,
        businessDeveloperId: null,
        protected: null,
        limit: 25,
        ...(samples ? { reviewDisposition: "OPEN" } : { channel: null }),
      };
      const counts = samples
        ? { openCount: 0, expiringSoonCount: 0 }
        : {
            totalCount: 0,
            platformCount: 0,
            whatsappCount: 0,
            emailCount: 0,
            waitingOver24hCount: 0,
          };
      // A cursor is bound to the order that minted it, so switching the order
      // must request page 1 again (cursor null) rather than replay `asc-1`.
      const steps = [
        { sortOrder: "ASC", cursor: null, nextCursor: "asc-1" },
        { sortOrder: "DESC", cursor: null, nextCursor: "desc-1" },
        { sortOrder: "DESC", cursor: "desc-1", nextCursor: null },
        { sortOrder: "ASC", cursor: null, nextCursor: null },
      ];
      const results = steps.map((step) =>
        vi.fn(() => ({
          data: {
            [field]: {
              items: [],
              hasMore: Boolean(step.nextCursor),
              nextCursor: step.nextCursor,
              ...counts,
            },
          },
        })),
      );
      const mocks = steps.map((step, index) => ({
        request: {
          query,
          variables: { input: { ...input, sortOrder: step.sortOrder, cursor: step.cursor } },
        },
        result: results[index],
        delay: 0,
      }));
      render(
        <MockedProvider mocks={mocks}>
          <ToastProvider>
            <AffiliateWorkbenchEntityTabs
              tab={tab}
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
      const sortLabelKey = samples
        ? "ecommerce.affiliateWorkspace.workbench.sampleSortLabel"
        : "ecommerce.affiliateWorkspace.workbench.messageSortLabel";
      const oldestFirstKey = samples
        ? "ecommerce.affiliateWorkspace.workbench.sampleSortOldestFirst"
        : "ecommerce.affiliateWorkspace.workbench.messageSortLongestWaitingFirst";
      const newestFirstKey = samples
        ? "ecommerce.affiliateWorkspace.workbench.sampleSortNewestFirst"
        : "ecommerce.affiliateWorkspace.workbench.messageSortNewestFirst";
      const selectOrder = (label: string) => {
        fireEvent.click(screen.getByRole("button", { name: i18n.t(sortLabelKey) }));
        const popup = document.querySelector(".custom-select-dropdown")!;
        const option = Array.from(popup.querySelectorAll(".custom-select-option")).find(
          (node) => node.textContent === label,
        )!;
        fireEvent.click(option);
      };

      await waitFor(() => expect(results[0]).toHaveBeenCalledOnce());
      const label = screen.getByText(i18n.t(sortLabelKey));
      expect(label.classList.contains("tk-v1-label")).toBe(true);
      expect(document.querySelector("select")).toBeNull();

      selectOrder(i18n.t(newestFirstKey));
      await waitFor(() => expect(results[1]).toHaveBeenCalledOnce());
      fireEvent.click(
        await screen.findByRole("button", {
          name: i18n.t("ecommerce.affiliateWorkspace.loadMoreProposals"),
        }),
      );
      await waitFor(() => expect(results[2]).toHaveBeenCalledOnce());
      selectOrder(i18n.t(oldestFirstKey));
      await waitFor(() => expect(results[3]).toHaveBeenCalledOnce());
    },
  );
});
