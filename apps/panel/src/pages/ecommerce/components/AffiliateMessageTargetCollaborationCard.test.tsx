import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApolloClient, ApolloLink, InMemoryCache, Observable } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { GQL } from "@rivonclaw/core";
import i18n from "../../../i18n/index.js";
import { ToastProvider } from "../../../components/Toast.js";
import { AffiliateMessageTargetCollaborationCard } from "../AffiliateManagementPage.js";

beforeEach(async () => { await i18n.changeLanguage("zh"); });
afterEach(cleanup);

const collaboration: GQL.AffiliateMessageTargetCollaboration = {
  id: "collab-1", shopId: "shop-1", type: GQL.AffiliateCollaborationType.Target,
  status: GQL.AffiliateCollaborationStatus.Active, platformCollaborationId: "target-1",
  name: "October invitation", message: "We would love to work with you", productIds: ["p1"],
  lastObservedAt: "2026-10-21T12:00:00Z",
  platformUpdatedAt: null, startTime: "2026-10-20T12:00:00Z", endTime: "2026-11-01T12:00:00Z",
  sellerContactInfo: null, freeSampleRule: { hasFreeSample: true, isSampleApprovalExempt: false },
  products: [{ id: "p1", productId: "p1", title: "Probiotic capsules", mainImageUrl: "https://example.com/product.png", imageUrl: null, status: "ACTIVE", collaborationStatus: "ACTIVE", commission: { rate: 1500, shopAdsCommissionRate: 500 } }],
};

function setup(part: GQL.AffiliateHistoryPart, fail = false) {
  const operations: string[] = [];
  const onRefresh = vi.fn().mockResolvedValue(undefined);
  const client = new ApolloClient({ cache: new InMemoryCache(), link: new ApolloLink(operation => {
    operations.push(operation.operationName ?? "");
    return new Observable(observer => {
      if (operation.operationName !== "RefreshAffiliateMessageTargetCollaboration") {
        observer.error(new Error(`Unexpected query: ${operation.operationName}`));
      } else if (fail) observer.error(new Error("Platform quota exceeded"));
      else {
        expect(operation.variables).toEqual({ input: { creatorRelationshipId: "rel-1", referenceToken: "bound-reference" } });
        observer.next({ data: { refreshAffiliateMessageTargetCollaboration: { __typename: "AffiliateMessageTargetCollaboration", ...collaboration } } });
        observer.complete();
      }
    });
  }) });
  render(<ApolloProvider client={client}><ToastProvider>
    <AffiliateMessageTargetCollaborationCard part={part} creatorRelationshipId="rel-1"
      shopLabel={{ text: "MXTK-06", sensitive: false }} onRefresh={onRefresh} />
  </ToastProvider></ApolloProvider>);
  return { operations, onRefresh };
}

it("renders the existing collaboration/product card and invitation details with zero mount queries", async () => {
  const { operations } = setup({ kind: GQL.AffiliateHistoryPartKind.TargetCollaborationCard, targetCollaborationId: "target-1", targetCollaboration: collaboration });
  expect(screen.getAllByText("Probiotic capsules").length).toBeGreaterThan(0);
  expect(screen.getByText("October invitation")).toBeTruthy();
  expect(screen.getByText("We would love to work with you")).toBeTruthy();
  expect(document.querySelector(".affiliate-collaboration-card")).toBeTruthy();
  expect(document.querySelector(".affiliate-platform-collaboration-config-snapshot")).toBeTruthy();
  expect(screen.getAllByText(/15%/).length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: "从平台加载邀约详情" })).toBeNull();
  await waitFor(() => expect(operations).toEqual([]));
});

it("fetches missing details only after an explicit click, then refreshes the loaded message range", async () => {
  const { operations, onRefresh } = setup({ kind: GQL.AffiliateHistoryPartKind.TargetCollaborationCard,
    targetCollaborationId: "target-1", targetCollaboration: null, targetCollaborationRefreshToken: "bound-reference" });
  expect(operations).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "从平台加载邀约详情" }));
  await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce());
  expect(operations).toEqual(["RefreshAffiliateMessageTargetCollaboration"]);
});

it("keeps failed missing details retryable and does not refresh the page on a platform failure", async () => {
  const { operations, onRefresh } = setup({ kind: GQL.AffiliateHistoryPartKind.TargetCollaborationCard,
    targetCollaborationId: "target-1", targetCollaborationRefreshToken: "bound-reference" }, true);
  fireEvent.click(screen.getByRole("button", { name: "从平台加载邀约详情" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Platform quota exceeded"));
  expect(onRefresh).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "从平台加载邀约详情" }).hasAttribute("disabled")).toBe(false);
  expect(operations).toEqual(["RefreshAffiliateMessageTargetCollaboration"]);
});
