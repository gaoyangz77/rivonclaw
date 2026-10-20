import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import { GQL } from "@rivonclaw/core";
import i18n from "../../../i18n/index.js";
import { ToastProvider } from "../../../components/Toast.js";
import {
  AFFILIATE_WORKBENCH_PENDING_CONVERSATION_PAGE_QUERY,
  AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY,
} from "../../../api/shops-queries.js";
import { AffiliateWorkbenchEntityTabs } from "./AffiliateWorkbenchEntityTabs.js";

vi.mock("../../../components/ecommerce/ProductFilter.js", () => ({ ProductFilter: () => null }));
beforeEach(async () => {
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);
type Actor = { kind: string; displayName: string | null; businessDeveloperId: string | null };
function sampleRow(
  index: number,
  overrides: { reviewDisposition: string; merchantReviewActor: Actor | null },
) {
  return {
    __typename: "AffiliateWorkbenchSampleRow" as const,
    creatorGmv: null, creatorPostRate: null, creatorAverageVideoViews: null, creatorUnitsSold: null,
    creatorPerformanceMarket: null, creatorPerformanceObservedAt: null,
    id: `sample-${index}`,
    hasPendingAgentProposal: false,
    creatorRelationshipId: `rel-${index}`,
    creatorName: `Creator ${index}`,
    creatorUsername: `creator${index}`,
    creatorAvatarUrl: null,
    shopName: "Shop",
    productTitle: "Product",
    businessDeveloperName: null,
    protected: false,
    humanOnly: false,
    sampleTier: null,
    systemTags: [],
    manualTags: [],
    sampleApplication: {
      __typename: "SampleApplicationRecord" as const,
      id: `app-${index}`,
      userId: "user-1",
      shopId: "shop-1",
      platformApplicationId: `platform-${index}`,
      creatorRelationshipId: `rel-${index}`,
      creatorId: `creator-${index}`,
      creatorOpenId: `open-${index}`,
      productId: null,
      skuId: null,
      skuName: null,
      skuImageUrl: null,
      sampleWorkStatus: null,
      reviewDisposition: overrides.reviewDisposition,
      reviewDispositionRevision: 1,
      merchantReviewDecision: null,
      merchantReviewExecutionMode: null,
      merchantReviewRejectReason: null,
      merchantReviewRejectReasonExplanation: null,
      merchantReviewNote: null,
      merchantReviewDecidedAt: overrides.merchantReviewActor ? "2026-09-02T00:00:00.000Z" : null,
      merchantReviewActorType: null,
      merchantReviewActor: overrides.merchantReviewActor
        ? { __typename: "AffiliateActorDisplay" as const, ...overrides.merchantReviewActor }
        : null,
      platformStatus: null,
      approveExpirationAt: null,
      firstObservedAt: "2026-09-01T00:00:00.000Z",
      lastObservedAt: "2026-09-01T00:00:00.000Z",
      projectionRevision: 1,
      order: null, shippedAt: null, deliveredAt: null,
    },
    proposal: null,
  };
}

function messageRow(id: string, conversationStatus: GQL.AffiliateChannelConversationStatus) {
  return {
    id,
    conversationStatus,
    creatorRelationshipId: id,
    channel: "EMAIL",
    lastPendingAt: "2026-09-01T00:00:00Z",
    sourceLabel: "Email",
    sourceShopId: null,
    replyToLifecycleEventId: `event-${id}`,
    hasPendingAgentProposal: false,
    creatorName: id,
    creatorUsername: id,
    creatorAvatarUrl: null,
    shopName: null,
    businessDeveloperName: null,
    protected: false,
    humanOnly: false,
    sampleTier: null,
    systemTags: [],
    manualTags: [],
    proposal: null,
  };
}

it.each(["SAMPLES", "MESSAGES"] as const)(
  "%s keeps later pages on background refresh and removes reviewed/handled rows",
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
      sortOrder: "ASC",
      limit: 25,
      ...(samples ? { statusFilter: "PENDING_REVIEW" } : { channel: null }),
    };
    const mock = (cursor: string | null, ids: number[], nextCursor: string | null, delay = 0) => ({
      request: { query, variables: { input: { ...input, cursor } } },
      result: {
        data: {
          [field]: {
            items: ids.map((id) =>
              samples
                ? sampleRow(id, { reviewDisposition: "OPEN", merchantReviewActor: null })
                : messageRow(`Creator ${id}`, GQL.AffiliateChannelConversationStatus.Pending),
            ),
            hasMore: Boolean(nextCursor),
            nextCursor,
            ...(samples
              ? { openCount: 100, expiringSoonCount: 0 }
              : {
                  totalCount: 100,
                  platformCount: 0,
                  whatsappCount: 0,
                  emailCount: 100,
                  waitingOver24hCount: 0,
                }),
          },
        },
      },
      delay,
    });
    const mocks = [
      mock(null, [1, 2], "after-2"),
      mock("after-2", [3, 4], "after-4"),
      // First-page refresh removes Creator 1; later-page refresh removes Creator 4.
      mock(null, [2, 3], "new-after-3"),
      mock("new-after-3", [5, 6], "after-6", 80),
      mock("after-6", [7], null),
    ];
    const props = {
      tab,
      selectedShopIds: null,
      shops: [],
      onSelectShops: vi.fn(),
      businessDeveloperOptions: [],
      selectedBusinessDeveloperId: "",
      onSelectBusinessDeveloper: vi.fn(),
      onOpen: vi.fn(),
    };
    const tree = (refreshRevision: number) => (
      <MockedProvider mocks={mocks}>
        <ToastProvider>
          <AffiliateWorkbenchEntityTabs {...props} refreshRevision={refreshRevision} />
        </ToastProvider>
      </MockedProvider>
    );
    const view = render(tree(0));
    await screen.findByText("Creator 1");
    fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
    await screen.findByText("Creator 4");
    view.rerender(tree(1));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "加载中..." }).hasAttribute("disabled")).toBe(true),
    );
    expect(screen.getByText("Creator 4")).toBeTruthy();
    await screen.findByText("Creator 6");
    expect(document.querySelectorAll("tbody tr")).toHaveLength(4);
    expect(screen.queryByText("Creator 1")).toBeNull();
    expect(screen.queryByText("Creator 4")).toBeNull();
    expect(screen.getByText("Creator 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
    await screen.findByText("Creator 7");
    expect(document.querySelectorAll("tbody tr")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: "加载更多" })).toBeNull();
  },
);
