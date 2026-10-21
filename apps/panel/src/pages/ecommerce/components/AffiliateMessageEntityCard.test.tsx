import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApolloClient, ApolloLink, InMemoryCache, Observable } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { GQL } from "@rivonclaw/core";
import i18n from "../../../i18n/index.js";
import { ToastProvider } from "../../../components/Toast.js";
import { AffiliateMessageEntityCard } from "../AffiliateManagementPage.js";
import { AffiliateMessageAttachmentCard } from "./AffiliateMessageAttachmentCard.js";

beforeEach(async () => { await i18n.changeLanguage("zh"); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function setup(part: GQL.AffiliateHistoryPart, failure?: string) {
  const operations: string[] = [], onRefresh = vi.fn().mockResolvedValue(undefined);
  const client = new ApolloClient({ cache: new InMemoryCache(), link: new ApolloLink(operation => {
    operations.push(operation.operationName ?? "");
    return new Observable(observer => {
      if (failure) { observer.error(new Error(failure)); return; }
      expect(operation.operationName).toBe("RefreshAffiliateMessageCards");
      expect(operation.variables).toEqual({ input: { creatorRelationshipId: "rel-1", referenceTokens: ["signed-reference"] } });
      observer.next({ data: { refreshAffiliateMessageCards: true } }); observer.complete();
    });
  }) });
  render(<ApolloProvider client={client}><ToastProvider><AffiliateMessageEntityCard part={part}
    creatorRelationshipId="rel-1" shopId="shop-1" onRefresh={onRefresh} /></ToastProvider></ApolloProvider>);
  return { operations, onRefresh };
}
it("renders a compact Sample with Product/SKU/current state and folded details without mount or disclosure queries", () => {
  const { operations } = setup({ kind: GQL.AffiliateHistoryPartKind.FreeSampleCard, productSummary: { productId: "p1", title: "Product name" },
    sampleApplication: { id: "sample-1", shopId: "shop-1", platformApplicationId: "platform-apply", productId: "p1", skuName: "Small",
      sampleWorkStatus: GQL.SampleWorkStatus.ShippedInTransit, reviewDisposition: GQL.AffiliateSampleReviewDisposition.Open,
      firstObservedAt: "2026-10-01T00:00:00Z", lastObservedAt: "2026-10-21T00:00:00Z", updatedAt: "2026-10-21T00:00:00Z" } as GQL.SampleApplicationRecord });
  expect(screen.getByText("样品申请卡片")).toBeTruthy();
  expect(screen.getByText("Product name")).toBeTruthy(); expect(screen.getByText("Small")).toBeTruthy();
  expect(screen.getByText(/当前状态：/)).toBeTruthy();
  const details = document.querySelector("details")!; expect(details.open).toBe(false);
  fireEvent.click(screen.getByText("查看详情")); expect(details.open).toBe(true);
  expect(operations).toEqual([]);
});
it("keeps Product cards local and fills missing data only after an explicit click", async () => {
  const { operations, onRefresh } = setup({ kind: GQL.AffiliateHistoryPartKind.ProductCard, productId: "p1", cardRefreshToken: "signed-reference" });
  expect(screen.getByText("商品卡片")).toBeTruthy(); expect(operations).toEqual([]);
  fireEvent.click(screen.getByText("加载缺失详情"));
  await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce());
  expect(operations).toEqual(["RefreshAffiliateMessageCards"]);
});
it("shows a translated unavailable historical Sample reason and keeps retry available", async () => {
  const { onRefresh } = setup({ kind: GQL.AffiliateHistoryPartKind.FreeSampleCard,
    platformSampleApplicationId: "old-apply", cardRefreshToken: "signed-reference" }, "SAMPLE_CARD_NOT_FOUND");
  fireEvent.click(screen.getByText("加载缺失详情"));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("平台未返回这条样品申请"));
  expect(onRefresh).not.toHaveBeenCalled(); expect(screen.getByText("加载缺失详情").hasAttribute("disabled")).toBe(false);
});
it("loads images through the signed attachment route only on click and releases a closed preview", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["image"], { type: "image/png" }) });
  vi.stubGlobal("fetch", fetcher); const revoke = vi.fn();
  URL.createObjectURL = vi.fn(() => "blob:preview"); URL.revokeObjectURL = revoke;
  render(<AffiliateMessageAttachmentCard creatorRelationshipId="rel-1" part={{ kind: GQL.AffiliateHistoryPartKind.Attachment,
    providerType: "EMOTICONS", mimeType: "image/png", attachmentRef: "signed-attachment" }} />);
  expect(screen.getByText("表情图片")).toBeTruthy(); expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("查看图片"));
  await waitFor(() => expect(screen.getByRole("img").getAttribute("src")).toBe("blob:preview"));
  expect(fetcher).toHaveBeenCalledWith("/api/cloud/ecommerce/affiliate/read-message-attachment", expect.objectContaining({
    body: JSON.stringify({ attachmentRef: "signed-attachment" }), headers: expect.objectContaining({ "X-Creator-Relationship-Id": "rel-1" }),
  }));
  fireEvent.click(screen.getByText("关闭")); expect(screen.queryByRole("img")).toBeNull(); expect(revoke).toHaveBeenCalledWith("blob:preview");
});
