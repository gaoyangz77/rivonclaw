import { describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { CustomerServiceWorkspaceModel } from "./CustomerServiceWorkspaceModel.js";
import {
  CS_CONVERSATION_INBOX_COUNTS_QUERY,
  CS_CONVERSATION_INBOX_QUERY,
} from "../../api/shops-queries.js";

const COUNTS = { all: 9, escalated: 2, pending: 4, resolved: 5 };

function countsResult(counts = COUNTS) {
  return { data: { ecommerceGetCustomerServiceInboxCounts: counts } };
}

const emptyList = { data: { ecommerceGetCustomerServiceInbox: { items: [], totalCount: 0 } } };

/** Routes the list and counts documents to separate handlers. */
function mockClient(handlers: {
  list?: () => unknown;
  counts?: () => unknown;
}) {
  return vi.fn(async (options: { query: unknown; variables?: Record<string, unknown> }) =>
    options.query === CS_CONVERSATION_INBOX_COUNTS_QUERY
      ? (handlers.counts ?? (() => countsResult()))()
      : (handlers.list ?? (() => emptyList))(),
  );
}

function callsFor(query: ReturnType<typeof mockClient>, document: unknown) {
  return query.mock.calls
    .filter(([options]) => options.query === document)
    .map(([options]) => options.variables!);
}

function inboxItem(overrides: Record<string, unknown> = {}) {
  return {
    shopId: "shop-1",
    conversationId: "conversation-1",
    status: GQL.CustomerServiceConversationStatus.Pending,
    isOpen: true,
    aiEnabled: true,
    openEscalationCount: 0,
    ...overrides,
  };
}

function changed(overrides: Record<string, unknown> = {}) {
  return {
    conversation: {
      shopId: "shop-1",
      conversationId: "conversation-1",
      replyStatus: GQL.CustomerServiceConversationStatus.Pending,
      isOpen: true,
      aiEnabled: true,
      participants: [{ role: "BUYER", userId: "buyer-1" }],
      openEscalationCount: 0,
      ...overrides,
    },
  };
}

describe("CustomerServiceWorkspaceModel inbox categories", () => {
  it.each([
    ["all", undefined, undefined],
    ["escalated", undefined, GQL.CustomerServiceConversationEscalationFilter.Open],
    ["pending", GQL.CustomerServiceConversationStatus.Pending, undefined],
    ["resolved", GQL.CustomerServiceConversationStatus.Resolved, undefined],
  ] as const)("maps the %s tab onto the inbox query", async (category, status, escalation) => {
    const query = mockClient({});
    const store = CustomerServiceWorkspaceModel.create({}, { apolloClient: { query } as any });
    store.setConversationCategory(category);
    await store.fetchConversations();
    const [variables] = callsFor(query, CS_CONVERSATION_INBOX_QUERY);
    expect(variables!.status).toBe(status);
    expect(variables!.escalation).toBe(escalation);
  });

  it("resets the page and selection when the tab changes", () => {
    const store = CustomerServiceWorkspaceModel.create(
      { conversationItems: [inboxItem()], conversationPage: 3 },
      { apolloClient: {} as any },
    );
    store.selectConversation("shop-1", "conversation-1");
    store.setConversationCategory("escalated");
    expect(store.conversationPage).toBe(1);
    expect(store.selectedConversationId).toBeNull();
  });

  it("filters live events per tab", () => {
    const store = CustomerServiceWorkspaceModel.create({}, { apolloClient: {} as any });
    store.setConversationCategory("escalated");
    store.ingestConversationChanged(changed());
    expect(store.conversationItems).toHaveLength(0);
    store.ingestConversationChanged(changed({ openEscalationCount: 1 }));
    expect(store.conversationItems).toHaveLength(1);

    store.setConversationCategory("resolved");
    store.ingestConversationChanged(changed({ openEscalationCount: 1 }));
    expect(store.conversationItems).toHaveLength(0);
    store.ingestConversationChanged(
      changed({ conversationId: "conversation-2", replyStatus: GQL.CustomerServiceConversationStatus.Resolved }),
    );
    expect(store.conversationItems).toHaveLength(1);

    store.setConversationCategory("all");
    store.ingestConversationChanged(changed({ conversationId: "conversation-3" }));
    expect(store.conversationItems).toHaveLength(2);
  });

  it("returns to the all tab when another page focuses an order", async () => {
    const query = mockClient({});
    const store = CustomerServiceWorkspaceModel.create(
      { conversationCategory: "escalated" },
      { apolloClient: { query } as any },
    );
    store.focusConversationOrder("order-1");
    expect(store.conversationCategory).toBe("all");
    await vi.waitFor(() => expect(callsFor(query, CS_CONVERSATION_INBOX_QUERY)).toHaveLength(1));
  });
});

describe("CustomerServiceWorkspaceModel inbox counts", () => {
  it("is null until loaded, then holds the server counts", async () => {
    const query = mockClient({});
    const store = CustomerServiceWorkspaceModel.create({}, { apolloClient: { query } as any });
    expect(store.conversationCounts).toBeNull();
    await store.fetchConversationCounts();
    expect(store.conversationCounts).toEqual(COUNTS);
    expect(store.conversationCountsError).toBeNull();
  });

  it("sends the list filters except status and escalation", async () => {
    const query = mockClient({});
    const store = CustomerServiceWorkspaceModel.create(
      {
        conversationShopId: "shop-1",
        conversationAiFilter: "enabled",
        conversationBadReviewFilter: "hasBadReview",
        conversationCategory: "escalated",
      },
      { apolloClient: { query } as any },
    );
    store.setConversationSearchDraft(" buyer ");
    store.applyConversationSearch();
    await store.fetchConversationCounts();
    expect(callsFor(query, CS_CONVERSATION_INBOX_COUNTS_QUERY)).toEqual([
      { shopIds: ["shop-1"], aiEnabled: true, hasBadReview: true, search: "buyer" },
    ]);
  });

  it("refreshes together with the list", async () => {
    const query = mockClient({});
    const store = CustomerServiceWorkspaceModel.create({}, { apolloClient: { query } as any });
    await store.fetchConversations();
    await vi.waitFor(() => expect(store.conversationCounts).toEqual(COUNTS));
  });

  it("drops a stale response that arrives after a newer request", async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    const query = mockClient({
      counts: () => new Promise((resolve) => resolvers.push(resolve)),
    });
    const store = CustomerServiceWorkspaceModel.create({}, { apolloClient: { query } as any });
    const first = store.fetchConversationCounts();
    const second = store.fetchConversationCounts();
    resolvers[1]!(countsResult({ all: 1, escalated: 0, pending: 1, resolved: 0 }));
    await second;
    resolvers[0]!(countsResult({ all: 99, escalated: 99, pending: 99, resolved: 99 }));
    await first;
    expect(store.conversationCounts).toEqual({ all: 1, escalated: 0, pending: 1, resolved: 0 });
  });

  it("surfaces a counts failure, keeps the previous counts and leaves the list alone", async () => {
    let fail = false;
    const query = mockClient({
      counts: () => {
        if (fail) throw new Error("counts unavailable");
        return countsResult();
      },
      list: () => ({
        data: { ecommerceGetCustomerServiceInbox: { items: [inboxItem()], totalCount: 1 } },
      }),
    });
    const store = CustomerServiceWorkspaceModel.create({}, { apolloClient: { query } as any });
    await store.fetchConversationCounts();
    fail = true;
    await store.fetchConversations();
    await vi.waitFor(() => expect(store.conversationCountsError).toBe("counts unavailable"));
    expect(store.conversationCounts).toEqual(COUNTS);
    expect(store.conversationItems).toHaveLength(1);
    expect(store.conversationsError).toBeNull();
  });
});
