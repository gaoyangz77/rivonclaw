import { describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { CustomerServiceWorkspaceModel } from "./CustomerServiceWorkspaceModel.js";
import { CS_SEND_CARD_MUTATION } from "../../api/shops-queries.js";

vi.mock("../../api/client.js", () => ({
  fetchJson: vi.fn(),
  fetchVoid: vi.fn().mockResolvedValue(undefined),
}));

const conversation = {
  shopId: "shop-1",
  platformShopId: "platform-shop-1",
  conversationId: "conversation-1",
  status: GQL.CustomerServiceConversationStatus.Pending,
  isOpen: true,
  aiEnabled: false,
  buyerUserId: "buyer-1",
  openEscalationCount: 0,
};

function createStore(mutate: ReturnType<typeof vi.fn>) {
  const query = vi.fn().mockResolvedValue({
    data: {
      ecommerceGetCustomerServiceInbox: { items: [conversation], totalCount: 1 },
      ecommerceGetConversationMessages: { items: [], nextPageToken: null },
    },
  });
  const store = CustomerServiceWorkspaceModel.create(
    { conversationItems: [conversation] },
    { apolloClient: { mutate, query } as any },
  );
  store.selectConversation("shop-1", "conversation-1");
  return { store, query };
}

function sentCards(mutate: ReturnType<typeof vi.fn>) {
  return mutate.mock.calls.map(([options]) => {
    expect(options.mutation).toBe(CS_SEND_CARD_MUTATION);
    return {
      type: options.variables.type,
      content: JSON.parse(options.variables.content),
      idempotencyKey: options.variables.idempotencyKey as string,
    };
  });
}

describe("customer service order and logistics cards", () => {
  it("sends one order card with the order id and refreshes the open conversation", async () => {
    const mutate = vi.fn().mockResolvedValue({
      data: { ecommerceSendCustomerServiceCard: { messageId: "card-1" } },
    });
    const { store, query } = createStore(mutate);
    const input = {
      shopId: "shop-1",
      conversationId: "conversation-1",
      orderId: "order-1",
      type: GQL.EcomCustomerServiceCardType.OrderCard,
    };

    const pending = store.sendOrderCard(input, "zh");
    expect(store.isCardSending(input)).toBe(true);
    await expect(pending).resolves.toBe(true);

    expect(store.isCardSending(input)).toBe(false);
    const [card] = sentCards(mutate);
    expect(card.type).toBe("ORDER_CARD");
    expect(card.content).toEqual({ order_id: "order-1" });
    expect(card.idempotencyKey).toMatch(/^human-cs-card:/);
    expect(query).toHaveBeenCalled();
  });

  it("sends one logistics card per package, each with its own idempotency key", async () => {
    const mutate = vi
      .fn()
      .mockResolvedValueOnce({ data: { ecommerceSendCustomerServiceCard: { messageId: "a" } } })
      .mockResolvedValueOnce({ data: { ecommerceSendCustomerServiceCard: { messageId: "b" } } });
    const { store } = createStore(mutate);

    await store.sendOrderCard({
      shopId: "shop-1",
      conversationId: "conversation-1",
      orderId: "order-1",
      type: GQL.EcomCustomerServiceCardType.LogisticsCard,
      packageIds: ["pkg-1", "pkg-2"],
    });

    const cards = sentCards(mutate);
    expect(cards.map((card) => card.content)).toEqual([
      { order_id: "order-1", package_id: "pkg-1" },
      { order_id: "order-1", package_id: "pkg-2" },
    ]);
    expect(new Set(cards.map((card) => card.idempotencyKey)).size).toBe(2);
  });

  it("refuses a logistics card for an order without packages", async () => {
    const mutate = vi.fn();
    const { store } = createStore(mutate);
    await expect(
      store.sendOrderCard({
        shopId: "shop-1",
        conversationId: "conversation-1",
        orderId: "order-1",
        type: GQL.EcomCustomerServiceCardType.LogisticsCard,
        packageIds: [],
      }),
    ).rejects.toThrow(/no package/);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("ignores a second click while the same card is sending", async () => {
    let resolve!: (value: unknown) => void;
    const mutate = vi.fn().mockReturnValue(new Promise((r) => (resolve = r)));
    const { store } = createStore(mutate);
    const input = {
      shopId: "shop-1",
      conversationId: "conversation-1",
      orderId: "order-1",
      type: GQL.EcomCustomerServiceCardType.OrderCard,
    };
    const first = store.sendOrderCard(input);
    await expect(store.sendOrderCard(input)).resolves.toBe(false);
    resolve({ data: { ecommerceSendCustomerServiceCard: { messageId: "card-1" } } });
    await expect(first).resolves.toBe(true);
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failed send and releases the button", async () => {
    const mutate = vi.fn().mockRejectedValue(new Error("not materialized"));
    const { store } = createStore(mutate);
    const input = {
      shopId: "shop-1",
      conversationId: "conversation-1",
      orderId: "order-1",
      type: GQL.EcomCustomerServiceCardType.OrderCard,
    };
    await expect(store.sendOrderCard(input)).rejects.toThrow("not materialized");
    expect(store.isCardSending(input)).toBe(false);
  });
});
