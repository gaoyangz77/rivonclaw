import { describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { CustomerServiceWorkspaceModel } from "./CustomerServiceWorkspaceModel.js";
import { CS_COUPONS_QUERY, CS_SEND_COUPON_MUTATION } from "../../api/shops-queries.js";

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

const couponList = {
  truncated: true,
  coupons: [{ id: "coupon-1", title: "10 off", sendable: true }],
};

function createStore(options: { mutate?: ReturnType<typeof vi.fn>; couponQuery?: unknown } = {}) {
  const query = vi.fn(async ({ query: document }: { query: unknown; variables?: unknown }) => {
    if (document === CS_COUPONS_QUERY) {
      if (options.couponQuery instanceof Error) throw options.couponQuery;
      return { data: { ecommerceCustomerServiceCoupons: options.couponQuery ?? couponList } };
    }
    return {
      data: {
        ecommerceGetCustomerServiceInbox: { items: [conversation], totalCount: 1 },
        ecommerceGetConversationMessages: { items: [], nextPageToken: null },
      },
    };
  });
  const mutate = options.mutate ?? vi.fn();
  const store = CustomerServiceWorkspaceModel.create(
    { conversationItems: [conversation] },
    { apolloClient: { mutate, query } as any },
  );
  store.selectConversation("shop-1", "conversation-1");
  return { store, query, mutate };
}

const couponInput = { shopId: "shop-1", conversationId: "conversation-1", couponId: "coupon-1" };

describe("customer service coupon list", () => {
  it("loads the shop's coupons as plain data and reuses them until forced or discarded", async () => {
    const { store, query } = createStore();
    const couponCalls = () =>
      query.mock.calls.filter(([options]) => options.query === CS_COUPONS_QUERY);

    const pending = store.fetchCoupons("shop-1");
    expect(store.isCouponsLoading("shop-1")).toBe(true);
    await pending;
    expect(store.isCouponsLoading("shop-1")).toBe(false);
    expect(store.shopCoupons.get("shop-1")).toEqual(couponList);
    expect(couponCalls()[0][0].variables).toEqual({ shopId: "shop-1" });

    await store.fetchCoupons("shop-1");
    expect(couponCalls()).toHaveLength(1);
    await store.fetchCoupons("shop-1", true);
    expect(couponCalls()).toHaveLength(2);

    store.discardCoupons("shop-1");
    expect(store.shopCoupons.has("shop-1")).toBe(false);
    await store.fetchCoupons("shop-1");
    expect(couponCalls()).toHaveLength(3);
  });

  it("records a load failure and clears it on the next successful load", async () => {
    const { store } = createStore({ couponQuery: new Error("TikTok is busy") });
    await store.fetchCoupons("shop-1");
    expect(store.couponsErrors.get("shop-1")).toBe("TikTok is busy");
    expect(store.shopCoupons.has("shop-1")).toBe(false);
    expect(store.isCouponsLoading("shop-1")).toBe(false);
  });
});

describe("customer service coupon cards", () => {
  it("sends the coupon with a per-click idempotency key and refreshes the open conversation", async () => {
    const mutate = vi.fn().mockResolvedValue({
      data: { ecommerceSendCustomerServiceCoupon: { messageId: "message-1" } },
    });
    const { store, query } = createStore({ mutate });

    const pending = store.sendCoupon(couponInput, "zh");
    expect(store.isCouponSending(couponInput)).toBe(true);
    await expect(pending).resolves.toBe(true);
    expect(store.isCouponSending(couponInput)).toBe(false);

    const [options] = mutate.mock.calls[0];
    expect(options.mutation).toBe(CS_SEND_COUPON_MUTATION);
    expect(options.variables).toMatchObject(couponInput);
    expect(options.variables.idempotencyKey).toMatch(/^human-cs-coupon:/);
    expect(
      query.mock.calls.some(([queryOptions]) => queryOptions.query !== CS_COUPONS_QUERY),
    ).toBe(true);

    await store.sendCoupon(couponInput);
    expect(mutate.mock.calls[1][0].variables.idempotencyKey).not.toBe(options.variables.idempotencyKey);
  });

  it("ignores a second click while the same coupon is sending", async () => {
    let resolve!: (value: unknown) => void;
    const mutate = vi.fn().mockReturnValue(new Promise((r) => (resolve = r)));
    const { store } = createStore({ mutate });
    const first = store.sendCoupon(couponInput);
    await expect(store.sendCoupon(couponInput)).resolves.toBe(false);
    resolve({ data: { ecommerceSendCustomerServiceCoupon: { messageId: "message-1" } } });
    await expect(first).resolves.toBe(true);
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("surfaces the backend error and releases the button", async () => {
    const mutate = vi.fn().mockRejectedValue(new Error("Coupon claim limit reached"));
    const { store } = createStore({ mutate });
    await expect(store.sendCoupon(couponInput)).rejects.toThrow("Coupon claim limit reached");
    expect(store.isCouponSending(couponInput)).toBe(false);
  });

  it("fails when the platform does not confirm the send", async () => {
    const mutate = vi.fn().mockResolvedValue({
      data: { ecommerceSendCustomerServiceCoupon: { messageId: null } },
    });
    const { store } = createStore({ mutate });
    await expect(store.sendCoupon(couponInput)).rejects.toThrow(/did not confirm/);
  });
});
