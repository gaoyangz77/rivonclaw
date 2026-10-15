import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import { print } from "graphql";
import i18n from "../../../i18n/index.js";
import { ToastProvider } from "../../../components/Toast.js";
import {
  AFFILIATE_PRODUCT_SUMMARIES_QUERY,
  AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY,
} from "../../../api/shops-queries.js";
import { AffiliateSampleOrderCopyButton } from "./AffiliateSampleOrderCopyButton.js";
import { AffiliateWorkbenchEntityTabs } from "./AffiliateWorkbenchEntityTabs.js";

vi.mock("../../../components/ecommerce/ProductFilter.js", () => ({ ProductFilter: () => null }));

const ORDER_ID = "8071789659962573985";
const writeText = vi.fn();
const copyLabel = () => i18n.t("ecommerce.affiliateWorkspace.sampleApplication.copyOrderId");

beforeEach(async () => {
  await i18n.changeLanguage("zh");
  writeText.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", Object.assign(Object.create(navigator), {
    clipboard: { writeText },
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function button(orderId?: string | null) {
  return <ToastProvider><AffiliateSampleOrderCopyButton orderId={orderId} /></ToastProvider>;
}

function sampleRow(index: number, platformOrderId: string | null, sampleWorkStatus: string) {
  return {
    __typename: "AffiliateWorkbenchSampleRow",
    id: `sample-${index}`, creatorRelationshipId: `rel-${index}`,
    creatorName: `Creator ${index}`, creatorUsername: `creator${index}`, creatorAvatarUrl: null,
    shopName: "Shop", productTitle: "Product", businessDeveloperName: null,
    protected: false, humanOnly: false, hasPendingAgentProposal: false,
    sampleTier: null, systemTags: [], manualTags: [], proposal: null,
    sampleApplication: {
      __typename: "SampleApplicationRecord",
      id: `app-${index}`, userId: "user-1", shopId: "shop-1",
      platformApplicationId: `application-${index}`, creatorRelationshipId: `rel-${index}`,
      creatorId: `creator-${index}`, creatorOpenId: `open-${index}`, productId: "product-1",
      skuId: null, skuName: null, skuImageUrl: null, sampleWorkStatus,
      reviewDisposition: "OPEN", reviewDispositionRevision: 1, merchantReviewDecision: null,
      merchantReviewExecutionMode: null, merchantReviewRejectReason: null,
      merchantReviewRejectReasonExplanation: null, merchantReviewNote: null,
      merchantReviewDecidedAt: null, merchantReviewActorType: null, merchantReviewActor: null,
      platformStatus: null, approveExpirationAt: null, projectionRevision: 1,
      firstObservedAt: "2026-10-01T00:00:00Z", lastObservedAt: "2026-10-15T00:00:00Z",
      order: platformOrderId == null ? null : { __typename: "SampleApplicationOrderRecord", platformOrderId },
    },
  };
}

describe("workbench Sample order number copy", () => {
  it("requests the persisted order number in the list query", () => {
    expect(print(AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY)).toMatch(/order\s*\{\s*platformOrderId\s*\}/);
  });

  it.each([undefined, null, "", " ", "0", "00", " 0 "])("hides invalid order ID %s", (id) => {
    render(button(id));
    expect(screen.queryByRole("button", { name: copyLabel() })).toBeNull();
  });

  it("copies the full order ID as a string, trimming surrounding whitespace", async () => {
    render(button(` ${ORDER_ID} `));
    fireEvent.click(screen.getByRole("button", { name: copyLabel() }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(ORDER_ID));
    expect(writeText).toHaveBeenCalledOnce();
    expect(await screen.findByText(i18n.t("common.copied"))).toBeTruthy();
  });

  it("uses the latest order number after refresh rather than a captured row", async () => {
    const { rerender } = render(button(null));
    expect(screen.queryByRole("button", { name: copyLabel() })).toBeNull();
    rerender(button(ORDER_ID));
    fireEvent.click(screen.getByRole("button", { name: copyLabel() }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(ORDER_ID));
    rerender(button("8071789659962573986"));
    fireEvent.click(screen.getByRole("button", { name: copyLabel() }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("8071789659962573986"));
    rerender(button(null));
    expect(screen.queryByRole("button", { name: copyLabel() })).toBeNull();
  });

  it("reports clipboard failure instead of claiming success", async () => {
    writeText.mockRejectedValueOnce(new Error("Permission denied"));
    render(button(ORDER_ID));
    fireEvent.click(screen.getByRole("button", { name: copyLabel() }));
    expect(await screen.findByText(i18n.t("ecommerce.affiliateWorkspace.copyFailed"))).toBeTruthy();
    expect(screen.queryByText(i18n.t("common.copied"))).toBeNull();
  });

  it("handles an unavailable clipboard", async () => {
    vi.stubGlobal("navigator", Object.create(null));
    render(button(ORDER_ID));
    fireEvent.click(screen.getByRole("button", { name: copyLabel() }));
    expect(await screen.findByText(i18n.t("ecommerce.affiliateWorkspace.copyFailed"))).toBeTruthy();
  });

  it("keeps the button disabled while a clipboard write is in flight", async () => {
    let finish!: () => void;
    writeText.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(button(ORDER_ID));
    const copy = screen.getByRole("button", { name: copyLabel() });
    fireEvent.click(copy);
    expect(copy).toHaveProperty("disabled", true);
    fireEvent.click(copy);
    expect(writeText).toHaveBeenCalledOnce();
    finish();
    await waitFor(() => expect(copy).toHaveProperty("disabled", false));
  });

  it("renders in the last list cell and does not open the row on copy or keyboard events", async () => {
    const onOpen = vi.fn();
    const items = [
      sampleRow(0, ORDER_ID, "APPROVED_AWAITING_SHIPMENT"),
      sampleRow(1, "0", "SHIPPED_IN_TRANSIT"),
      sampleRow(2, null, "REQUEST_PENDING_REVIEW"),
      sampleRow(3, "8071789659962573986", "DELIVERED_AWAITING_CONTENT"),
      sampleRow(4, "8071789659962573987", "FULFILLED"),
    ];
    render(
      <MockedProvider mocks={[
        {
          request: {
            query: AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY,
            variables: { input: {
              shopId: null, businessDeveloperId: null, protected: null,
              statusFilter: "PENDING_REVIEW", sortOrder: "ASC", limit: 25, cursor: null,
            } },
          },
          result: { data: { affiliateWorkbenchSamplePage: {
            items, hasMore: false, nextCursor: null, openCount: 5, expiringSoonCount: 0,
          } } },
        },
        {
          request: { query: AFFILIATE_PRODUCT_SUMMARIES_QUERY, variables: {
            input: { refs: [{ shopId: "shop-1", productId: "product-1" }] },
          } },
          result: { data: { affiliateProductSummaries: [] } },
        },
      ]}>
        <ToastProvider>
          <AffiliateWorkbenchEntityTabs tab="SAMPLES" selectedShopIds={null} shops={[]}
            onSelectShops={vi.fn()} businessDeveloperOptions={[]}
            selectedBusinessDeveloperId="" onSelectBusinessDeveloper={vi.fn()}
            refreshRevision={0} onOpen={onOpen} />
        </ToastProvider>
      </MockedProvider>,
    );
    const copies = await screen.findAllByRole("button", { name: copyLabel() });
    expect(copies).toHaveLength(3);
    const row = copies[0]!.closest("tr")!;
    expect(row.lastElementChild?.contains(copies[0]!)).toBe(true);
    fireEvent.keyDown(copies[0]!, { key: "Enter" });
    fireEvent.keyDown(copies[0]!, { key: " " });
    fireEvent.click(copies[0]!);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(ORDER_ID));
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith({
      creatorRelationshipId: "rel-0", selectedShopId: "shop-1", initialTab: "samples",
    });
  });
});
