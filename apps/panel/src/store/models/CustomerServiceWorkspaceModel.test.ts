import { describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { CustomerServiceWorkspaceModel } from "./CustomerServiceWorkspaceModel.js";
import {
  CS_CONVERSATION_ORDER_IDS_QUERY,
  CS_CONVERSATION_ORDER_CONTEXT_QUERY,
  CS_CONVERSATION_INBOX_QUERY,
} from "../../api/shops-queries.js";

function conversation(orderId: string | null = "order-1") {
  return {
    shopId: "shop-1",
    platformShopId: "platform-shop-1",
    conversationId: "conversation-1",
    status: GQL.CustomerServiceConversationStatus.Pending,
    isOpen: true,
    aiEnabled: true,
    buyerUserId: "buyer-1",
    orderId,
    openEscalationCount: 0,
  };
}

describe("CustomerServiceWorkspaceModel bad review filter", () => {
  const reviews = [{ id: "review-1", rating: 1 }];

  function changed(recentBadReviews?: typeof reviews) {
    return {
      conversation: {
        ...conversation(),
        replyStatus: GQL.CustomerServiceConversationStatus.Pending,
        participants: [{ role: "BUYER", userId: "buyer-1" }],
        ...(recentBadReviews === undefined ? {} : { recentBadReviews }),
      },
    };
  }

  it("passes the filter to the server and resets page and selection when changed", async () => {
    const row = { ...conversation(), recentBadReviews: reviews };
    const query = vi.fn().mockResolvedValue({
      data: { ecommerceGetCustomerServiceInbox: { items: [row], totalCount: 73 } },
    });
    const store = CustomerServiceWorkspaceModel.create(
      { conversationItems: [row], conversationPage: 3, conversationShopId: "shop-1" },
      { apolloClient: { query } as any },
    );
    store.selectConversation("shop-1", "conversation-1");
    store.setConversationBadReviewFilter("hasBadReview");
    expect(store.conversationPage).toBe(1);
    expect(store.selectedConversationId).toBeNull();
    expect(store.selectedConversationShopId).toBeNull();

    await store.fetchConversations();
    expect(query).toHaveBeenLastCalledWith(expect.objectContaining({
      query: CS_CONVERSATION_INBOX_QUERY,
      variables: expect.objectContaining({ hasBadReview: true, shopIds: ["shop-1"], offset: 0 }),
    }));
    expect(store.filteredConversationItems).toEqual([row]);
    expect(store.conversationTotal).toBe(73);

    store.setConversationBadReviewFilter("all");
    await store.fetchConversations();
    expect(query).toHaveBeenLastCalledWith(expect.objectContaining({
      variables: expect.objectContaining({ hasBadReview: undefined }),
    }));
  });

  it("ignores unrelated live conversations but accepts events with bad reviews", () => {
    const store = CustomerServiceWorkspaceModel.create(
      { conversationBadReviewFilter: "hasBadReview" },
      { apolloClient: {} as any },
    );
    store.ingestConversationChanged(changed());
    expect(store.conversationTotal).toBe(0);
    expect(store.conversationItems).toHaveLength(0);
    store.ingestConversationChanged(changed(reviews));
    expect(store.conversationTotal).toBe(1);
    expect(store.conversationItems[0].recentBadReviews).toEqual(reviews);
  });

  it("preserves inbox review enrichment when message events omit it", () => {
    const store = CustomerServiceWorkspaceModel.create(
      {
        conversationBadReviewFilter: "hasBadReview",
        conversationItems: [{ ...conversation(), recentBadReviews: reviews }],
        conversationTotal: 1,
      },
      { apolloClient: {} as any },
    );
    store.selectConversation("shop-1", "conversation-1");
    store.ingestConversationChanged(changed());
    expect(store.conversationItems[0].recentBadReviews).toEqual(reviews);
    expect(store.conversationTotal).toBe(1);
    expect(store.selectedConversationId).toBe("conversation-1");

    store.ingestConversationChanged(changed([]));
    expect(store.conversationItems).toHaveLength(0);
    expect(store.conversationTotal).toBe(0);
    expect(store.selectedConversationId).toBeNull();
  });
});

describe("CustomerServiceWorkspaceModel order context", () => {
  it("loads and caches the selected conversation order with its returns", async () => {
    const query = vi.fn().mockResolvedValue({
      data: {
        order: {
          orderId: "order-1",
          buyerUserId: "buyer-1",
          status: "DELIVERED",
          totalAmount: "29.99",
          currency: "USD",
          lineItems: [],
        },
        returns: [
          {
            returnId: "return-1",
            orderId: "order-1",
            returnType: "REFUND_ONLY",
            returnStatus: "RETURN_OR_REFUND_REQUEST_PENDING",
          },
        ],
      },
    });
    const store = CustomerServiceWorkspaceModel.create(
      { conversationItems: [conversation()] },
      { apolloClient: { query } as any },
    );
    store.selectConversation("shop-1", "conversation-1");

    await store.fetchSelectedConversationOrderContext();

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          shopId: "shop-1",
          orderId: "order-1",
          buyerUserId: "buyer-1",
        },
        fetchPolicy: "network-only",
      }),
    );
    expect((store.selectedConversationOrderContext as any)?.order.orderId).toBe("order-1");
    expect((store.selectedConversationOrderContext as any)?.orderId).toBe("order-1");
    expect((store.selectedConversationOrderContext as any)?.returns[0].returnId).toBe("return-1");

    await store.fetchSelectedConversationOrderContext();
    expect(query).toHaveBeenCalledTimes(1);

    await store.fetchSelectedConversationOrderContext(true);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("does not query when the selected conversation has no order", async () => {
    const query = vi.fn();
    const store = CustomerServiceWorkspaceModel.create(
      { conversationItems: [conversation(null)] },
      { apolloClient: { query } as any },
    );
    store.selectConversation("shop-1", "conversation-1");

    await store.fetchSelectedConversationOrderContext();

    expect(query).not.toHaveBeenCalled();
    expect(store.selectedConversationOrderContext).toBeNull();
  });

  it("loads IDs for an unlinked conversation, then lazily loads and caches expanded orders", async () => {
    const query = vi.fn().mockImplementation(async ({ query: document, variables }) => {
      if (document === CS_CONVERSATION_ORDER_IDS_QUERY) {
        return { data: { ecommerceGetConversationOrderIds: ["newest", "older"] } };
      }
      return { data: { order: { orderId: variables.orderId }, returns: [] } };
    });
    const store = CustomerServiceWorkspaceModel.create(
      { conversationItems: [conversation(null)] },
      { apolloClient: { query } as any },
    );
    store.selectConversation("shop-1", "conversation-1");
    await store.fetchSelectedConversationOrderIds();
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: CS_CONVERSATION_ORDER_IDS_QUERY,
        variables: { shopId: "shop-1", conversationId: "conversation-1" },
      }),
    );
    expect(store.selectedConversationOrderIds).toEqual(["newest", "older"]);
    expect(store.selectedConversationExpandedOrderId).toBe("newest");
    expect(store.selectedConversation?.orderId).toBeNull();

    await store.fetchSelectedConversationOrderContext();
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: CS_CONVERSATION_ORDER_CONTEXT_QUERY,
        variables: { shopId: "shop-1", orderId: "newest", buyerUserId: "buyer-1" },
      }),
    );
    store.toggleConversationOrder("older");
    expect(query).toHaveBeenCalledTimes(2);
    await store.fetchSelectedConversationOrderContext();
    expect(store.selectedConversationOrderContext?.orderId).toBe("older");
    store.toggleConversationOrder("older");
    expect(store.selectedConversationExpandedOrderId).toBeNull();
    await store.fetchSelectedConversationOrderContext();
    expect(query).toHaveBeenCalledTimes(3);
    store.toggleConversationOrder("newest");
    await store.fetchSelectedConversationOrderContext();
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("keeps the existing linked order after recent IDs without overwriting it", async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ data: { ecommerceGetConversationOrderIds: ["newest", "newest"] } });
    const store = CustomerServiceWorkspaceModel.create(
      { conversationItems: [conversation("old-linked")] },
      { apolloClient: { query } as any },
    );
    store.selectConversation("shop-1", "conversation-1");
    await store.fetchSelectedConversationOrderIds();
    expect(store.selectedConversationOrderIds).toEqual(["newest", "old-linked"]);
    expect(store.selectedConversationExpandedOrderId).toBe("newest");
    expect(store.selectedConversation?.orderId).toBe("old-linked");
  });

  it("keeps a late ID lookup isolated when switching conversations, even with the same conversation ID", async () => {
    let resolve!: (value: unknown) => void;
    const query = vi.fn().mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const store = CustomerServiceWorkspaceModel.create(
      {
        conversationItems: [conversation(null), { ...conversation(null), shopId: "shop-2" }],
      },
      { apolloClient: { query } as any },
    );
    store.selectConversation("shop-1", "conversation-1");
    const loading = store.fetchSelectedConversationOrderIds();
    expect(store.selectedConversationOrderIdsLoading).toBe(true);
    await store.fetchSelectedConversationOrderIds();
    expect(query).toHaveBeenCalledTimes(1);
    store.selectConversation("shop-2", "conversation-1");
    resolve({ data: { ecommerceGetConversationOrderIds: ["shop-1-order"] } });
    await loading;
    expect(store.selectedConversationOrderIds).toEqual([]);
    expect(store.selectedConversationOrderIdsLoading).toBe(false);
    store.selectConversation("shop-1", "conversation-1");
    expect(store.selectedConversationOrderIds).toEqual(["shop-1-order"]);
  });

  it("keeps a late detail response isolated from the newly expanded order", async () => {
    let resolve!: (value: unknown) => void;
    const query = vi.fn().mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const store = CustomerServiceWorkspaceModel.create(
      {
        conversationItems: [conversation()],
        conversationOrderIds: { "shop-1:conversation-1": ["order-1", "order-2"] },
      },
      { apolloClient: { query } as any },
    );
    store.selectConversation("shop-1", "conversation-1");
    const loading = store.fetchSelectedConversationOrderContext();
    await store.fetchSelectedConversationOrderContext();
    expect(query).toHaveBeenCalledTimes(1);
    store.toggleConversationOrder("order-2");
    resolve({ data: { order: { orderId: "order-1" }, returns: [] } });
    await loading;
    expect(store.selectedConversationOrderContext).toBeNull();
    expect(store.selectedConversationOrderContextLoading).toBe(false);
    store.toggleConversationOrder("order-1");
    expect(store.selectedConversationOrderContext?.orderId).toBe("order-1");
  });

  it("reports and retries ID lookup errors independently of chat history", async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce(new Error("order service unavailable"))
      .mockResolvedValueOnce({ data: { ecommerceGetConversationOrderIds: [] } });
    const store = CustomerServiceWorkspaceModel.create(
      { conversationItems: [conversation(null)] },
      { apolloClient: { query } as any },
    );
    store.selectConversation("shop-1", "conversation-1");
    await store.fetchSelectedConversationOrderIds();
    expect(store.selectedConversationOrderIdsError).toBe("order service unavailable");
    expect(store.conversationMessagesError).toBeNull();
    expect(store.selectedConversationOrderIdsLoading).toBe(false);
    await store.fetchSelectedConversationOrderIds();
    expect(store.selectedConversationOrderIdsError).toBeNull();
    expect(store.selectedConversationOrderIds).toEqual([]);
  });
});

describe("CustomerServiceWorkspaceModel conversation search", () => {
  it("sends a complete 100-order search together with the existing filters and trusts server matches", async () => {
    const search = Array.from({ length: 100 }, (_, i) => `5${String(i).padStart(17, "0")}`).join(",");
    const row = { ...conversation(null), isOpen: false };
    const query = vi.fn().mockResolvedValue({ data: { ecommerceGetCustomerServiceInbox: { items: [row], totalCount: 1 } } });
    const store = CustomerServiceWorkspaceModel.create(
      { conversationShopId: "shop-1", conversationBadReviewFilter: "hasBadReview" },
      { apolloClient: { query } as any },
    );
    store.setConversationSearchDraft(search);
    store.applyConversationSearch();
    await store.fetchConversations();
    expect(query).toHaveBeenCalledWith(expect.objectContaining({
      variables: expect.objectContaining({ search, hasBadReview: true, shopIds: ["shop-1"], offset: 0 }),
    }));
    expect(store.filteredConversationItems).toEqual([row]);
  });

  it.each(["CS_ORDER_SEARCH_INVALID", "CS_ORDER_SEARCH_LIMIT", "CS_SEARCH_TOO_LONG"])(
    "keeps structured validation error %s and clears it after a successful retry", async (code) => {
      const error = Object.assign(new Error("Invalid search"), { errors: [{ extensions: { code } }] });
      const query = vi.fn().mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ data: { ecommerceGetCustomerServiceInbox: { items: [], totalCount: 0 } } });
      const store = CustomerServiceWorkspaceModel.create({}, { apolloClient: { query } as any });
      await store.fetchConversations();
      expect(store.conversationsErrorCode).toBe(code);
      expect(store.conversationsError).toBe("Invalid search");
      expect(store.conversationsLoading).toBe(false);
      await store.fetchConversations();
      expect(store.conversationsErrorCode).toBeNull();
      expect(store.conversationsError).toBeNull();
    },
  );

  function changedConversation(isOpen: boolean) {
    return {
      conversation: {
        shopId: "shop-1",
        platformShopId: "platform-shop-1",
        conversationId: "conversation-closed",
        replyStatus: GQL.CustomerServiceConversationStatus.Resolved,
        isOpen,
        aiEnabled: true,
        participants: [{ role: "BUYER", userId: "buyer-1", nickname: "jennediel" }],
        openEscalationCount: 0,
      },
    };
  }

  it("keeps a matching closed conversation while an exact search is active", () => {
    const store = CustomerServiceWorkspaceModel.create({}, { apolloClient: {} as any });
    store.setConversationSearchDraft("jennediel");
    store.applyConversationSearch();

    store.ingestConversationChanged(changedConversation(false));

    expect(store.conversationItems).toHaveLength(1);
    expect(store.conversationItems[0].conversationId).toBe("conversation-closed");
  });

  it("excludes a closed conversation when no search is active", () => {
    const store = CustomerServiceWorkspaceModel.create({}, { apolloClient: {} as any });

    store.ingestConversationChanged(changedConversation(false));

    expect(store.conversationItems).toHaveLength(0);
  });

  it("displays an order search hit without a linked order and retains it during live updates", async () => {
    const row = { ...conversation(null), conversationId: "conversation-closed", isOpen: false };
    const query = vi.fn().mockResolvedValue({ data: { ecommerceGetCustomerServiceInbox: { items: [row], totalCount: 1 } } });
    const store = CustomerServiceWorkspaceModel.create({}, { apolloClient: { query } as any });
    store.setConversationSearchDraft("576833748427839658");
    store.applyConversationSearch();
    await store.fetchConversations();
    expect(store.filteredConversationItems).toHaveLength(1);
    expect(store.filteredConversationItems[0].orderId).toBeNull();
    store.selectConversation("shop-1", "conversation-closed");
    store.ingestConversationChanged(changedConversation(false));
    expect(store.filteredConversationItems).toHaveLength(1);
    expect(store.conversationTotal).toBe(1);
    expect(store.selectedConversationId).toBe("conversation-closed");
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("does not add unrelated live events to order search results, including the same ID in another shop", () => {
    const store = CustomerServiceWorkspaceModel.create({ conversationItems: [{ ...conversation(null), conversationId: "conversation-closed" }] }, { apolloClient: {} as any });
    store.setConversationSearchDraft("576833748427839658");
    store.applyConversationSearch();
    const event = changedConversation(true);
    store.ingestConversationChanged({ conversation: { ...event.conversation, shopId: "other-shop" } });
    store.ingestConversationChanged({ conversation: { ...event.conversation, conversationId: "unrelated" } });
    expect(store.conversationItems).toHaveLength(1);
  });

  it("still removes an order search hit when its live status no longer matches the filters", () => {
    const store = CustomerServiceWorkspaceModel.create({ conversationItems: [{ ...conversation(null), conversationId: "conversation-closed" }], conversationTotal: 1 }, { apolloClient: {} as any });
    store.setConversationSearchDraft("576833748427839658");
    store.applyConversationSearch();
    store.setConversationStatusFilter("pending");
    store.ingestConversationChanged(changedConversation(false));
    expect(store.conversationItems).toHaveLength(0);
    expect(store.conversationTotal).toBe(0);
  });
});
