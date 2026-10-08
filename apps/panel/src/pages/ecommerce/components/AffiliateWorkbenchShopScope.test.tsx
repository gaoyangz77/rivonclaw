import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import i18n from "../../../i18n/index.js";
import { ToastProvider } from "../../../components/Toast.js";
import {
  AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY,
  AFFILIATE_WORKBENCH_PENDING_CONVERSATION_PAGE_QUERY,
} from "../../../api/shops-queries.js";
import {
  AffiliateWorkbenchEntityTabs,
  type AffiliateWorkbenchEntityTab,
} from "./AffiliateWorkbenchEntityTabs.js";

vi.mock("../../../components/ecommerce/ProductFilter.js", () => ({
  ProductFilter: ({
    shopIds,
    onChange,
  }: {
    shopIds?: string[];
    onChange: (value: Array<{ shopId: string; productId: string }>) => void;
  }) => (
    <button
      data-shop-ids={JSON.stringify(shopIds)}
      onClick={() => onChange([{ shopId: "shop-1", productId: "p1" }])}
    >
      Choose product
    </button>
  ),
}));
const shops = [
  { id: "shop-1", alias: "MXTK-01", shopName: "Mexico official", region: "MX" },
  { id: "shop-2", alias: "MXTK-02", shopName: "Mexico second", region: "MX" },
  { id: "shop-3", alias: "USTK-01", shopName: "US official", region: "US" },
];
function Harness({ tab }: { tab: AffiliateWorkbenchEntityTab }) {
  const [selectedShopIds, onSelectShops] = useState<string[] | null>(null);
  return (
    <AffiliateWorkbenchEntityTabs
      tab={tab}
      selectedShopIds={selectedShopIds}
      shops={shops}
      onSelectShops={onSelectShops}
      businessDeveloperOptions={[]}
      selectedBusinessDeveloperId=""
      onSelectBusinessDeveloper={vi.fn()}
      refreshRevision={0}
      onOpen={vi.fn()}
    />
  );
}
beforeEach(async () => {
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);

it.each(["SAMPLES", "MESSAGES"] as const)(
  "sends the selected shops on %s first/next pages and resets scope",
  async (tab) => {
    const samples = tab === "SAMPLES";
    const query = samples
      ? AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY
      : AFFILIATE_WORKBENCH_PENDING_CONVERSATION_PAGE_QUERY;
    const field = samples
      ? "affiliateWorkbenchSamplePage"
      : "affiliateWorkbenchPendingConversationPage";
    const inputs: Array<Record<string, unknown>> = [];
    const result = vi.fn(() => ({
      data: {
        [field]: {
          items: [],
          hasMore: true,
          nextCursor: `cursor-${inputs.length}`,
          ...(samples
            ? { openCount: 0, expiringSoonCount: 0 }
            : {
                totalCount: 0,
                platformCount: 0,
                whatsappCount: 0,
                emailCount: 0,
                waitingOver24hCount: 0,
              }),
        },
      },
    }));
    render(
      <MockedProvider
        mocks={[
          {
            request: {
              query,
              variables: (variables: { input: Record<string, unknown> }) => {
                inputs.push(variables.input);
                return true;
              },
            },
            result,
            maxUsageCount: Infinity,
            delay: 0,
          },
        ]}
      >
        <ToastProvider>
          <Harness tab={tab} />
        </ToastProvider>
      </MockedProvider>,
    );
    await waitFor(() => expect(result).toHaveBeenCalledOnce());
    if (!samples) {
      fireEvent.click(screen.getByRole("button", { name: /^TikTok Shop/ }));
      await waitFor(() => expect(inputs.at(-1)?.channel).toBe("PLATFORM_CHAT"));
    }
    const shopLabel = i18n.t("ecommerce.affiliateWorkspace.workbench.colShop");
    fireEvent.click(screen.getByRole("button", { name: shopLabel }));
    // Platform names remain searchable even when the visible display uses an alias.
    fireEvent.change(screen.getByRole("searchbox", { name: i18n.t("common.searchShops") }), {
      target: { value: "US official" },
    });
    expect(screen.queryByRole("checkbox", { name: /MXTK-01/ })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: /USTK-01/ }));
    await waitFor(() => expect(inputs.at(-1)?.shopIds).toEqual(["shop-1", "shop-2"]));
    expect(inputs.at(-1)?.cursor).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: shopLabel }).getAttribute("aria-expanded")).toBe(
      "false",
    );
    if (samples) {
      expect(screen.getByText("Choose product").getAttribute("data-shop-ids")).toBe(
        '["shop-1","shop-2"]',
      );
      fireEvent.click(screen.getByText("Choose product"));
      await waitFor(() =>
        expect(inputs.at(-1)?.products).toEqual([{ shopId: "shop-1", productId: "p1" }]),
      );
    }
    fireEvent.click(
      await screen.findByRole("button", {
        name: i18n.t("ecommerce.affiliateWorkspace.loadMoreProposals"),
      }),
    );
    await waitFor(() => expect(inputs.at(-1)?.cursor).toMatch(/^cursor-/));
    expect(inputs.at(-1)?.shopIds).toEqual(["shop-1", "shop-2"]);
    fireEvent.click(screen.getByRole("button", { name: shopLabel }));
    fireEvent.change(screen.getByRole("searchbox", { name: i18n.t("common.searchShops") }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /MXTK-02/ }));
    await waitFor(() => expect(inputs.at(-1)?.shopIds).toEqual(["shop-1"]));
    expect(inputs.at(-1)?.cursor).toBeNull();
    expect(inputs.at(-1)?.products).toBeUndefined();
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("ecommerce.affiliateAnalytics.selectAll") }),
    );
    await waitFor(() => expect(inputs.at(-1)?.shopIds).toBeUndefined());
    expect(inputs.at(-1)?.cursor).toBeNull();
  },
);
