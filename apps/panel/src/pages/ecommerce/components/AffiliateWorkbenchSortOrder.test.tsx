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
        ...(samples ? { statusFilter: "PENDING_REVIEW" } : { channel: null }),
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
      // The Sample queue opens on the soonest-deadline sort; choosing either
      // application-time order moves it to APPLICATION_TIME.
      const sortBy = (key: string) => (samples ? { sortBy: key } : {});
      const steps = [
        { ...sortBy("REVIEW_DEADLINE"), sortOrder: "ASC", cursor: null, nextCursor: "asc-1" },
        { ...sortBy("APPLICATION_TIME"), sortOrder: "DESC", cursor: null, nextCursor: "desc-1" },
        { ...sortBy("APPLICATION_TIME"), sortOrder: "DESC", cursor: "desc-1", nextCursor: null },
        { ...sortBy("APPLICATION_TIME"), sortOrder: "ASC", cursor: null, nextCursor: null },
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
          variables: {
            input: {
              ...input,
              ...(samples ? { sortBy: step.sortBy } : {}),
              sortOrder: step.sortOrder,
              cursor: step.cursor,
            },
          },
        },
        result: results[index],
        delay: 0,
      }));
      render(
        <MockedProvider mocks={mocks}>
          <ToastProvider>
            <AffiliateWorkbenchEntityTabs
              tab={tab}
              selectedShopIds={null}
              shops={[]}
              onSelectShops={vi.fn()}
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
          name: i18n.t("ecommerce.affiliateWorkspace.workbench.loadMore"),
        }),
      );
      await waitFor(() => expect(results[2]).toHaveBeenCalledOnce());
      selectOrder(i18n.t(oldestFirstKey));
      await waitFor(() => expect(results[3]).toHaveBeenCalledOnce());
    },
  );

  it("offers the deadline sort only in the pending-review view and sends application time elsewhere", async () => {
    const respond = () => ({
      data: {
        affiliateWorkbenchSamplePage: {
          items: [],
          hasMore: false,
          nextCursor: null,
          openCount: 0,
          expiringSoonCount: 0,
        },
      },
    });
    const input = { shopId: null, businessDeveloperId: null, protected: null, limit: 25, cursor: null };
    const request = (statusFilter: string, sortBy: string) => ({
      request: {
        query: AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY,
        variables: { input: { ...input, statusFilter, sortBy, sortOrder: "ASC" } },
      },
      result: vi.fn(respond),
      delay: 0,
    });
    const pending = request("PENDING_REVIEW", "REVIEW_DEADLINE");
    const approved = request("APPROVED", "APPLICATION_TIME");
    const pendingAgain = request("PENDING_REVIEW", "REVIEW_DEADLINE");
    render(
      <MockedProvider mocks={[pending, approved, pendingAgain]}>
        <ToastProvider>
          <AffiliateWorkbenchEntityTabs
            tab="SAMPLES"
            selectedShopIds={null}
            shops={[]}
            onSelectShops={vi.fn()}
            businessDeveloperOptions={[]}
            selectedBusinessDeveloperId=""
            onSelectBusinessDeveloper={vi.fn()}
            refreshRevision={0}
            onOpen={vi.fn()}
          />
        </ToastProvider>
      </MockedProvider>,
    );
    const sortLabel = i18n.t("ecommerce.affiliateWorkspace.workbench.sampleSortLabel");
    const statusLabel = i18n.t("ecommerce.affiliateWorkspace.workbench.colStatus");
    const optionLabels = () => {
      const popup = document.querySelector(".custom-select-dropdown")!;
      return Array.from(popup.querySelectorAll(".custom-select-option")).map((node) => node.textContent?.trim());
    };
    const chooseStatus = (label: string) => {
      fireEvent.click(screen.getByRole("button", { name: statusLabel }));
      const popup = document.querySelector(".custom-select-dropdown")!;
      fireEvent.click(
        Array.from(popup.querySelectorAll(".custom-select-option")).find(
          (node) => node.textContent?.trim() === label,
        )!,
      );
    };

    await waitFor(() => expect(pending.result).toHaveBeenCalledOnce());
    expect(sortLabel).toBe("排序");
    // The deadline option is the default selection in the pending-review view.
    expect(screen.getByRole("button", { name: sortLabel }).textContent).toContain("最快到期优先");
    fireEvent.click(screen.getByRole("button", { name: sortLabel }));
    expect(optionLabels()).toEqual(["最快到期优先", "最早申请优先", "最新申请优先"]);
    fireEvent.click(screen.getByRole("button", { name: sortLabel }));

    chooseStatus(i18n.t("ecommerce.affiliateWorkspace.workbench.sampleStatusApproved"));
    await waitFor(() => expect(approved.result).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: sortLabel }).textContent).toContain("最早申请优先");
    fireEvent.click(screen.getByRole("button", { name: sortLabel }));
    expect(optionLabels()).toEqual(["最早申请优先", "最新申请优先"]);
    fireEvent.click(screen.getByRole("button", { name: sortLabel }));

    // Returning to pending review restores the deadline sort without a stored reset.
    chooseStatus(i18n.t("ecommerce.affiliateWorkspace.workbench.sampleStatusPendingReview"));
    await waitFor(() => expect(pendingAgain.result).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: sortLabel }).textContent).toContain("最快到期优先");
  });
});
