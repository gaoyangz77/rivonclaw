import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import { GQL } from "@rivonclaw/core";
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

const MANUAL_TAGS = ["高潜", "美妆", "北美", "复购", "长期"].map((name, index) => ({
  __typename: "CreatorManualTag" as const,
  id: `manual-${index}`,
  name,
}));

/**
 * Three rows covering every rendering the tag column has: one Creator carrying
 * all three kinds, one carrying none, and one whose manual tags exceed the chip
 * budget.
 */
const TAG_FIXTURES = [
  {
    sampleTier: GQL.CreatorSampleTier.SampleFulfilled,
    systemTags: [GQL.AffiliateCreatorSystemTag.NoCampaignDisturb],
    manualTags: MANUAL_TAGS.slice(0, 1),
  },
  { sampleTier: null, systemTags: [], manualTags: [] },
  { sampleTier: null, systemTags: [], manualTags: MANUAL_TAGS },
];

function sampleRow(index: number) {
  return {
    __typename: "AffiliateWorkbenchSampleRow" as const,
    id: `sample-${index}`,
    creatorRelationshipId: `rel-${index}`,
    creatorName: `Creator ${index}`,
    creatorUsername: `creator${index}`,
    creatorAvatarUrl: null,
    shopName: "Shop",
    productTitle: "Product",
    businessDeveloperName: null,
    protected: false,
    humanOnly: false,
    ...TAG_FIXTURES[index],
    sampleApplication: {
      __typename: "SampleApplicationRecord" as const,
      id: `app-${index}`,
      userId: "user-1",
      shopId: "shop-1",
      platformApplicationId: `platform-${index}`,
      creatorRelationshipId: `rel-${index}`,
      creatorId: `creator-${index}`,
      creatorOpenId: `open-${index}`,
      productId: "product-1",
      sampleWorkStatus: null,
      reviewDisposition: "OPEN",
      reviewDispositionRevision: 1,
      merchantReviewDecision: null,
      merchantReviewExecutionMode: null,
      merchantReviewRejectReason: null,
      merchantReviewRejectReasonExplanation: null,
      merchantReviewDecidedAt: null,
      merchantReviewActorType: null,
      platformStatus: null,
      approveExpirationAt: null,
      firstObservedAt: "2026-09-01T00:00:00.000Z",
      lastObservedAt: "2026-09-01T00:00:00.000Z",
      projectionRevision: 1,
    },
    proposal: null,
  };
}

function conversationRow(index: number) {
  return {
    __typename: "AffiliateWorkbenchPendingConversationRow" as const,
    id: `message-${index}`,
    creatorRelationshipId: `rel-${index}`,
    channel: GQL.AffiliateMessageChannel.PlatformChat,
    lastPendingAt: "2026-09-01T00:00:00.000Z",
    sourceLabel: "Shop",
    sourceShopId: "shop-1",
    replyToLifecycleEventId: `event-${index}`,
    creatorName: `Creator ${index}`,
    creatorUsername: `creator${index}`,
    creatorAvatarUrl: null,
    shopName: "Shop",
    businessDeveloperName: null,
    protected: false,
    humanOnly: false,
    ...TAG_FIXTURES[index],
    proposal: null,
  };
}

function renderTab(tab: "SAMPLES" | "MESSAGES") {
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
    sortOrder: "ASC",
    limit: 25,
    cursor: null,
    ...(samples ? { reviewDisposition: "OPEN" } : { channel: null }),
  };
  const counts = samples
    ? { openCount: 3, expiringSoonCount: 0 }
    : {
        totalCount: 3,
        platformCount: 3,
        whatsappCount: 0,
        emailCount: 0,
        waitingOver24hCount: 0,
      };
  const items = TAG_FIXTURES.map((_, index) =>
    samples ? sampleRow(index) : conversationRow(index),
  );
  render(
    <MockedProvider
      mocks={[
        {
          request: { query, variables: { input } },
          result: {
            data: {
              [field]: {
                __typename: samples
                  ? "AffiliateWorkbenchSamplePage"
                  : "AffiliateWorkbenchPendingConversationPage",
                items,
                hasMore: false,
                nextCursor: null,
                ...counts,
              },
            },
          },
          delay: 0,
        },
      ]}
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
}

describe.each(["SAMPLES", "MESSAGES"] as const)("%s creator tag column", (tab) => {
  it("renders every tag kind, an em dash when there is none, and a +N overflow", async () => {
    renderTab(tab);
    await waitFor(() => expect(document.querySelectorAll("tbody tr")).toHaveLength(3));

    // The column sits directly after the Creator column in the header row.
    const headers = [...document.querySelectorAll("thead th")].map((cell) => cell.textContent);
    expect(headers[1]).toBe(i18n.t("ecommerce.affiliateWorkspace.workbench.colCreator"));
    expect(headers[2]).toBe(i18n.t("ecommerce.affiliateWorkspace.workbench.colTags"));

    // The footer spans every column, the new one included.
    const footerCell = document.querySelector("tfoot td");
    expect(footerCell?.getAttribute("colspan")).toBe(String(headers.length));

    const cells = [...document.querySelectorAll(".affiliate-workbench-cell-tags")];
    expect(cells).toHaveLength(3);
    // Each tags cell is its own <td>, immediately after the Creator cell.
    for (const cell of cells) {
      const td = cell.closest("td")!;
      expect(td.parentElement!.children[2]).toBe(td);
    }

    // All three kinds: one tier chip, one system chip, one manual chip.
    const [allKinds, none, overflow] = cells as [HTMLElement, HTMLElement, HTMLElement];
    expect(allKinds.querySelector(".affiliate-workbench-tag-tier")?.textContent).toBe(
      `🥇 ${i18n.t("ecommerce.affiliateWorkspace.sampleTiers.SAMPLE_FULFILLED")}`,
    );
    expect(allKinds.querySelector(".affiliate-workbench-tag-system")?.textContent).toBe(
      i18n.t("ecommerce.affiliateWorkspace.systemTags.values.NO_CAMPAIGN_DISTURB.label"),
    );
    expect(
      [...allKinds.querySelectorAll(".affiliate-workbench-tag-manual")].map((c) => c.textContent),
    ).toEqual(["高潜"]);

    // No tier and no tags is an em dash, not three empty slots and not the
    // lowest rung.
    expect(none.textContent).toBe("—");
    expect(none.querySelectorAll(".affiliate-workbench-tag")).toHaveLength(0);

    // Past the budget, the remainder collapses into one +N chip whose title
    // carries the full set.
    const manualChips = [...overflow.querySelectorAll(".affiliate-workbench-tag-manual")];
    expect(manualChips.map((chip) => chip.textContent)).toEqual([
      "高潜",
      "美妆",
      "北美",
      "+2",
    ]);
    const overflowChip = overflow.querySelector(".affiliate-workbench-tag-overflow")!;
    expect(overflowChip.textContent).toBe("+2");
    expect(overflowChip.getAttribute("title")).toBe(MANUAL_TAGS.map((tag) => tag.name).join(", "));
  });
});
