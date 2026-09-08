import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import i18n from "../../../i18n/index.js";
import { ToastProvider } from "../../../components/Toast.js";
import {
  AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY,
  AFFILIATE_WORKBENCH_PENDING_CONVERSATION_PAGE_QUERY,
} from "../../../api/shops-queries.js";
import { AffiliateWorkbenchEntityTabs } from "./AffiliateWorkbenchEntityTabs.js";

vi.mock("../../../components/ecommerce/ProductFilter.js", () => ({
  ProductFilter: ({
    onChange,
  }: {
    onChange: (value: Array<{ shopId: string; productId: string }>) => void;
  }) => (
    <button onClick={() => onChange([{ shopId: "shop-1", productId: "product-1" }])}>
      Choose product
    </button>
  ),
}));
beforeEach(async () => {
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);

it.each(["SAMPLES", "MESSAGES"] as const)(
  "sends creator search on %s first/next pages and resets on clear",
  async (tab) => {
    const samples = tab === "SAMPLES";
    const query = samples
      ? AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY
      : AFFILIATE_WORKBENCH_PENDING_CONVERSATION_PAGE_QUERY;
    const field = samples
      ? "affiliateWorkbenchSamplePage"
      : "affiliateWorkbenchPendingConversationPage";
    const base = {
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
    const selections = samples ? { products: [{ shopId: "shop-1", productId: "product-1" }] } : {};
    const steps = [
      { input: { ...base, cursor: null }, nextCursor: "initial" },
      { input: { ...base, cursor: null, creatorSearch: "@alice" }, nextCursor: "alice" },
      ...(samples
        ? [
            {
              input: { ...base, cursor: null, creatorSearch: "@alice", ...selections },
              nextCursor: "alice-product",
            },
          ]
        : []),
      {
        input: {
          ...base,
          cursor: samples ? "alice-product" : "alice",
          creatorSearch: "@alice",
          ...selections,
        },
        nextCursor: null,
      },
      { input: { ...base, cursor: null, ...selections }, nextCursor: null },
    ];
    const results = steps.map((step) =>
      vi.fn(() => ({
        data: {
          [field]: {
            items: [],
            nextCursor: step.nextCursor,
            hasMore: !!step.nextCursor,
            ...counts,
          },
        },
      })),
    );
    render(
      <MockedProvider
        mocks={steps.map((step, i) => ({
          request: { query, variables: { input: step.input } },
          result: results[i],
          delay: 0,
        }))}
      >
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
    await waitFor(() => expect(results[0]).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索达人" }), {
      target: { value: " @alice " },
    });
    expect(results[1]).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));
    await waitFor(() => expect(results[1]).toHaveBeenCalledOnce());
    if (samples) {
      fireEvent.click(screen.getByText("Choose product"));
      await waitFor(() => expect(results[2]).toHaveBeenCalledOnce());
    } else expect(screen.queryByText("Choose product")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("ecommerce.affiliateWorkspace.loadMoreProposals"),
      }),
    );
    await waitFor(() => expect(results.at(-2)).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "清除搜索" }));
    await waitFor(() => expect(results.at(-1)).toHaveBeenCalledOnce());
  },
);
