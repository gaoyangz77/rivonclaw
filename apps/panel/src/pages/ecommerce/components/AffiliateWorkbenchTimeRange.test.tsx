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

/** 2026-09-20 10:00 local. Only `Date` is faked; timers stay real for waitFor. */
const NOW = new Date(2026, 8, 20, 10, 0, 0);
const LOCAL_TODAY_GE = new Date(2026, 8, 20).toISOString();
const LOCAL_TOMORROW_LT = new Date(2026, 8, 21).toISOString();

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  await i18n.changeLanguage("zh");
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("workbench time-range filter", () => {
  it.each(["SAMPLES", "MESSAGES"] as const)(
    "omits both bounds by default on %s, then sends a preset and restarts pagination",
    async (tab) => {
      const samples = tab === "SAMPLES";
      const query = samples
        ? AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY
        : AFFILIATE_WORKBENCH_PENDING_CONVERSATION_PAGE_QUERY;
      const field = samples
        ? "affiliateWorkbenchSamplePage"
        : "affiliateWorkbenchPendingConversationPage";
      // The queue filters its own time field: application time for Sample
      // review, waiting time for pending conversations.
      const timeArgs = samples
        ? { firstObservedAtGe: LOCAL_TODAY_GE, firstObservedAtLt: LOCAL_TOMORROW_LT }
        : { lastPendingAtGe: LOCAL_TODAY_GE, lastPendingAtLt: LOCAL_TOMORROW_LT };
      const input = {
        shopId: null,
        businessDeveloperId: null,
        protected: null,
        sortOrder: "ASC",
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
      // A cursor is bound to the range that minted it and the backend rejects a
      // cursor replayed under another, so choosing a range must request page 1
      // again (cursor null) rather than replay `all-1`.
      const steps = [
        { time: {}, cursor: null, nextCursor: "all-1" },
        { time: timeArgs, cursor: null, nextCursor: "today-1" },
        { time: timeArgs, cursor: "today-1", nextCursor: null },
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
        request: { query, variables: { input: { ...input, ...step.time, cursor: step.cursor } } },
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
      const timeLabel = i18n.t("ecommerce.affiliateWorkspace.workbench.timeFilter");
      const selectPreset = (label: string) => {
        fireEvent.click(screen.getByRole("button", { name: timeLabel }));
        const popup = document.querySelector(".custom-select-dropdown")!;
        const option = Array.from(popup.querySelectorAll(".custom-select-option")).find(
          (node) => node.textContent === label,
        )!;
        fireEvent.click(option);
      };

      // The default selection must leave the request byte-identical to the one
      // sent before a time filter existed: neither bound present.
      await waitFor(() => expect(results[0]).toHaveBeenCalledOnce());
      expect(
        screen.getByText(i18n.t("ecommerce.affiliateWorkspace.workbench.timeAll")),
      ).toBeTruthy();

      selectPreset(i18n.t("ecommerce.affiliateWorkspace.workbench.timeToday"));
      await waitFor(() => expect(results[1]).toHaveBeenCalledOnce());

      fireEvent.click(
        await screen.findByRole("button", {
          name: i18n.t("ecommerce.affiliateWorkspace.loadMoreProposals"),
        }),
      );
      await waitFor(() => expect(results[2]).toHaveBeenCalledOnce());
    },
  );

  it("reveals two date inputs for a custom range and keeps an inverted one unsent", async () => {
    const input = {
      shopId: null,
      businessDeveloperId: null,
      protected: null,
      statusFilter: "PENDING_REVIEW",
      sortOrder: "ASC",
      limit: 25,
      cursor: null,
    };
    const page = {
      items: [],
      hasMore: false,
      nextCursor: null,
      openCount: 0,
      expiringSoonCount: 0,
    };
    // Only the unfiltered request is mocked: an inverted range must never reach
    // the backend, which rejects `ge >= lt` outright.
    const mocks = [
      {
        request: { query: AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY, variables: { input } },
        result: { data: { affiliateWorkbenchSamplePage: page } },
        maxUsageCount: Number.POSITIVE_INFINITY,
        delay: 0,
      },
    ];
    render(
      <MockedProvider mocks={mocks}>
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

    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("ecommerce.affiliateWorkspace.workbench.timeFilter"),
      }),
    );
    const popup = document.querySelector(".custom-select-dropdown")!;
    fireEvent.click(
      Array.from(popup.querySelectorAll(".custom-select-option")).find(
        (node) => node.textContent === i18n.t("ecommerce.affiliateWorkspace.workbench.timeCustom"),
      )!,
    );

    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    expect(dateInputs.length).toBe(2);
    // Half-typed: the range cannot be sent yet, and the control says so.
    expect(
      screen.getByText(i18n.t("ecommerce.affiliateWorkspace.workbench.timeCustomHint")),
    ).toBeTruthy();

    fireEvent.change(dateInputs[0], { target: { value: "2026-09-20" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-09-10" } });
    await waitFor(() =>
      expect(
        screen.getByText(i18n.t("ecommerce.affiliateWorkspace.workbench.timeCustomInvalid")),
      ).toBeTruthy(),
    );
    // The list still shows the unfiltered result rather than a query error: an
    // inverted range that reached the backend would have had no mock to match,
    // so this text would never appear. `findByText`, because the empty state
    // appears when the initial query settles and that is not ordered against
    // the validation error above -- a synchronous read races Apollo.
    expect(
      await screen.findByText(i18n.t("ecommerce.affiliateWorkspace.workbench.noSamples")),
    ).toBeTruthy();
  });
});
