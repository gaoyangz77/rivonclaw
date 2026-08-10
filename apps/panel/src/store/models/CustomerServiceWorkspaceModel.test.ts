import { describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { CustomerServiceWorkspaceModel } from "./CustomerServiceWorkspaceModel.js";

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
        returns: [{
          returnId: "return-1",
          orderId: "order-1",
          returnType: "REFUND_ONLY",
          returnStatus: "RETURN_OR_REFUND_REQUEST_PENDING",
        }],
      },
    });
    const store = CustomerServiceWorkspaceModel.create(
      { conversationItems: [conversation()] },
      { apolloClient: { query } as any },
    );
    store.selectConversation("shop-1", "conversation-1");

    await store.fetchSelectedConversationOrderContext();

    expect(query).toHaveBeenCalledWith(expect.objectContaining({
      variables: {
        shopId: "shop-1",
        orderId: "order-1",
        buyerUserId: "buyer-1",
      },
      fetchPolicy: "network-only",
    }));
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
});

describe("CustomerServiceWorkspaceModel conversation search", () => {
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
});
