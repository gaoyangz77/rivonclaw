import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import i18n from "../../../i18n/index.js";
import { ToastProvider } from "../../../components/Toast.js";
import {
  AFFILIATE_PRODUCT_SUMMARIES_QUERY,
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

type Actor = { kind: string; displayName: string | null; businessDeveloperId: string | null };

const BD: Actor = {
  kind: "BUSINESS_DEVELOPER",
  displayName: "孙浩鹏",
  businessDeveloperId: "bd-1",
};
const AGENT: Actor = { kind: "AGENT", displayName: null, businessDeveloperId: null };

function sampleRow(
  index: number,
  overrides: { reviewDisposition: string; merchantReviewActor: Actor | null },
) {
  return {
    __typename: "AffiliateWorkbenchSampleRow" as const,
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
      productId: "product-1",
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
    },
    proposal: null,
  };
}

const PRODUCT_SUMMARY_MOCK = {
  request: {
    query: AFFILIATE_PRODUCT_SUMMARIES_QUERY,
    variables: { input: { refs: [{ shopId: "shop-1", productId: "product-1" }] } },
  },
  result: {
    data: {
      affiliateProductSummaries: [
        {
          shopId: "shop-1",
          product: {
            productId: "product-1",
            title: "Product",
            coverImage: null,
            status: null,
            priceMin: null,
            priceMax: null,
            skus: [],
          },
        },
      ],
    },
  },
};

function pageMock(statusFilter: string, items: unknown[]) {
  return {
    request: {
      query: AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY,
      variables: {
        input: {
          shopId: null,
          businessDeveloperId: null,
          protected: null,
          statusFilter,
          sortOrder: "ASC",
          limit: 25,
          cursor: null,
        },
      },
    },
    result: {
      data: {
        affiliateWorkbenchSamplePage: {
          __typename: "AffiliateWorkbenchSamplePage",
          items,
          hasMore: false,
          nextCursor: null,
          openCount: items.length,
          expiringSoonCount: 0,
        },
      },
    },
    delay: 0,
  };
}

function renderSamples(mocks: unknown[]) {
  render(
    <MockedProvider mocks={mocks as never[]}>
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
}

describe("workbench Sample Application reviewer", () => {
  it("shows who reviewed each row in the status column and nothing for an unreviewed row", async () => {
    renderSamples([
      pageMock("PENDING_REVIEW", [
        sampleRow(0, { reviewDisposition: "OPEN", merchantReviewActor: BD }),
        sampleRow(1, { reviewDisposition: "OPEN", merchantReviewActor: AGENT }),
        sampleRow(2, { reviewDisposition: "OPEN", merchantReviewActor: null }),
      ]),
      PRODUCT_SUMMARY_MOCK,
    ]);
    await waitFor(() => expect(document.querySelectorAll("tbody tr")).toHaveLength(3));

    const reviewerCells = [...document.querySelectorAll("tbody tr")].map(
      (row) => row.querySelector(".affiliate-workbench-cell-reviewer")?.textContent ?? null,
    );
    expect(reviewerCells).toEqual(["审核人：孙浩鹏", "审核人：Agent", null]);
  });

  it("shows the reviewer beside the ignored badge in the ignored view", async () => {
    renderSamples([
      pageMock("PENDING_REVIEW", []),
      pageMock("IGNORED", [
        sampleRow(0, { reviewDisposition: "SOFT_REJECTED", merchantReviewActor: BD }),
      ]),
      PRODUCT_SUMMARY_MOCK,
    ]);
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: i18n.t("ecommerce.affiliateWorkspace.workbench.colStatus"),
        }),
      ),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("ecommerce.affiliateWorkspace.workbench.colStatus"),
      }),
    );
    fireEvent.click(
      Array.from(document.querySelectorAll(".custom-select-option")).find(
        (node) => node.textContent?.trim() === "已忽略",
      )!,
    );

    await waitFor(() => expect(document.querySelectorAll("tbody tr")).toHaveLength(1));
    const handler = document.querySelector(".affiliate-workbench-cell-handler")!;
    expect(handler.textContent).toContain("审核人：孙浩鹏");
  });
});
