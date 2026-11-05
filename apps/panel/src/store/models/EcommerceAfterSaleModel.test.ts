import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APPROVE_AFTER_SALE_CANCELLATION_MUTATION,
  APPROVE_AFTER_SALE_REFUND_MUTATION,
  APPROVE_AFTER_SALE_RETURN_MUTATION,
  READ_AFTER_SALE_ORDER_QUERY,
  READ_AFTER_SALE_ORDER_TRACKING_QUERY,
  READ_AFTER_SALE_REJECT_REASONS_QUERY,
  READ_AFTER_SALE_REQUEST_QUERY,
  READ_AFTER_SALE_REQUESTS_QUERY,
  READ_AFTER_SALE_RETURN_RECORDS_QUERY,
} from "../../api/after-sale-queries.js";
import { EcommerceAfterSaleModel } from "./EcommerceAfterSaleModel.js";

function dto(overrides: Record<string, unknown> = {}) {
  return {
    kind: "REFUND",
    requestId: "r1",
    shopId: "shop-1",
    shopName: "Shop One",
    orderId: "order-1",
    status: "RETURN_OR_REFUND_REQUEST_PENDING",
    requestType: "REFUND",
    role: "BUYER",
    reason: null,
    reasonText: "Damaged",
    currency: "USD",
    refundTotal: "12.50",
    isQuickRefund: false,
    sellerNextAction: "SELLER_RESPOND_REFUND",
    sellerActionDeadline: "2026-11-05T00:00:00Z",
    createTime: "2026-11-03T00:00:00Z",
    updateTime: "2026-11-03T01:00:00Z",
    lines: [{ lineItemId: "l1", productName: "Mug", refundTotal: "12.50", currency: "USD" }],
    needsReview: true,
    sellerDecision: null,
    sellerDecidedAt: null,
    decisionAwaitingPlatform: false,
    ...overrides,
  };
}

function setup(handlers: { query?: (opts: any) => unknown; mutate?: (opts: any) => unknown }) {
  const query = vi.fn(async (opts: any) => handlers.query?.(opts));
  const mutate = vi.fn(async (opts: any) => handlers.mutate?.(opts) ?? { data: {} });
  const store = EcommerceAfterSaleModel.create({}, { apolloClient: { query, mutate } as any });
  return { store, query, mutate };
}

const page = (items: unknown[], nextCursor: string | null = null, totalCount = items.length) => ({
  data: { page: { items, nextCursor, totalCount } },
});

afterEach(() => vi.unstubAllGlobals());

describe("EcommerceAfterSaleModel list", () => {
  it("keeps the order the backend returned and sends only the shop scope in TO_REVIEW", async () => {
    const items = [
      dto({ requestId: "b" }),
      dto({ requestId: "a" }),
      dto({ requestId: "c", kind: "CANCELLATION" }),
    ];
    const { store, query } = setup({ query: () => page(items, "cur-1", 7) });
    store.setShopScope(["shop-1"], 3);
    await store.fetchRequests();
    expect(store.requests.map((r) => r.requestId)).toEqual(["b", "a", "c"]);
    expect(store.totalCount).toBe(7);
    expect(store.hasMore).toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: READ_AFTER_SALE_REQUESTS_QUERY,
        variables: { input: { view: "TO_REVIEW", shopIds: ["shop-1"] } },
      }),
    );
  });

  it("narrows TO_REVIEW by kind, but sends no status or action filter there", async () => {
    const { store, query } = setup({ query: () => page([dto()]) });
    const before = store.querySignature;
    store.setKinds(["REFUND", "CANCELLATION"]);
    store.setStatuses(["RETURN_OR_REFUND_REQUEST_PENDING"]);
    expect(store.querySignature).not.toBe(before);
    await store.fetchRequests();
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({
        variables: { input: { view: "TO_REVIEW", kinds: ["REFUND", "CANCELLATION"] } },
      }),
    );
    // The kind selection carries over to the history view.
    store.setView("ALL");
    await store.fetchRequests();
    expect(query.mock.calls.at(-1)![0].variables.input).toMatchObject({
      view: "ALL",
      kinds: ["REFUND", "CANCELLATION"],
      statuses: ["RETURN_OR_REFUND_REQUEST_PENDING"],
    });
  });

  it("appends the next page by cursor without duplicating rows", async () => {
    const first = [dto({ requestId: "a" }), dto({ requestId: "b" })];
    const second = [dto({ requestId: "b" }), dto({ requestId: "c" })];
    const { store, query } = setup({
      query: ({ variables }) =>
        variables.input.cursor ? page(second, null, 3) : page(first, "cur-1", 3),
    });
    await store.fetchRequests();
    await store.fetchMore();
    expect(store.requests.map((r) => r.requestId)).toEqual(["a", "b", "c"]);
    expect(store.hasMore).toBe(false);
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({ variables: { input: { view: "TO_REVIEW", cursor: "cur-1" } } }),
    );
  });

  it("sends the ALL window as local-day bounds with the filters, and skips the request on a bad window", async () => {
    const { store, query } = setup({ query: () => page([]) });
    store.setView("ALL");
    expect(store.windowFrom).not.toBe("");
    store.setKinds(["REFUND"]);
    store.setStatuses(["BUYER_SHIPPED_ITEM"]);
    store.setSellerActions(["SELLER_RESPOND_RETURN"]);
    store.setWindow("2026-10-01", "2026-10-31");
    await store.fetchRequests();
    const input = query.mock.calls[0][0].variables.input;
    expect(input).toMatchObject({
      view: "ALL",
      kinds: ["REFUND"],
      statuses: ["BUYER_SHIPPED_ITEM"],
      sellerActions: ["SELLER_RESPOND_RETURN"],
    });
    expect(Date.parse(input.createdTo) - Date.parse(input.createdFrom)).toBeGreaterThanOrEqual(
      31 * 23 * 3_600_000,
    );

    store.setWindow("2026-01-01", "2026-11-01");
    expect(store.windowIssue).toBe("tooLong");
    store.setWindow("2026-11-02", "2026-11-01");
    expect(store.windowIssue).toBe("reversed");
    await store.fetchRequests();
    expect(query).toHaveBeenCalledTimes(1);
    expect(store.requests.length).toBe(0);
  });

  it("surfaces a list failure as state and rethrows", async () => {
    const { store } = setup({
      query: () => {
        throw new Error("warehouse down");
      },
    });
    await expect(store.fetchRequests()).rejects.toThrow("warehouse down");
    expect(store.error).toBe("warehouse down");
    expect(store.loading).toBe(false);
  });

  it("collapses a selection of every shop back to all shops", () => {
    const { store } = setup({});
    store.setShopScope(["s1"], 2);
    expect(store.allShops).toBe(false);
    store.setShopScope(["s1", "s2"], 2);
    expect(store.allShops).toBe(true);
    expect(store.shopIds.length).toBe(0);
  });
});

describe("EcommerceAfterSaleModel background refresh", () => {
  it("re-reads the loaded rows without a loading state and replaces them", async () => {
    let items = [dto({ requestId: "a" }), dto({ requestId: "b" })];
    const { store, query } = setup({ query: () => page(items, null, items.length) });
    await store.fetchRequests();
    items = [dto({ requestId: "b" })];
    const refresh = store.refreshInBackground();
    expect(store.refreshing).toBe(true);
    expect(store.loading).toBe(false);
    await refresh;
    expect(store.refreshing).toBe(false);
    expect(store.requests.map((r) => r.requestId)).toEqual(["b"]);
    expect(store.totalCount).toBe(1);
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({ variables: { input: { view: "TO_REVIEW", limit: 50 } } }),
    );
  });

  it("asks for every loaded row once the seller loaded more than one page", async () => {
    const first = Array.from({ length: 50 }, (_, i) => dto({ requestId: `a${i}` }));
    const second = Array.from({ length: 10 }, (_, i) => dto({ requestId: `b${i}` }));
    const { store, query } = setup({
      query: ({ variables }) =>
        variables.input.cursor ? page(second, null, 60) : page(first, "cur-1", 60),
    });
    await store.fetchRequests();
    await store.fetchMore();
    await store.refreshInBackground();
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({ variables: { input: { view: "TO_REVIEW", limit: 60 } } }),
    );
  });

  it("does nothing while a detail is open or before the first load", async () => {
    const { store, query } = setup({ query: () => page([dto()]) });
    await store.refreshInBackground();
    expect(query).not.toHaveBeenCalled();
    await store.fetchRequests();
    await store.openDetail("shop-1:REFUND:r1");
    const calls = query.mock.calls.length;
    await store.refreshInBackground();
    expect(query.mock.calls.length).toBe(calls);
  });

  it("drops its answer when the seller changed the query meanwhile", async () => {
    let resolveRefresh!: (value: unknown) => void;
    let calls = 0;
    const { store } = setup({
      query: () => {
        calls += 1;
        if (calls === 2)
          return new Promise((resolve) => {
            resolveRefresh = resolve;
          });
        return page([dto({ requestId: calls === 1 ? "old" : "new" })]);
      },
    });
    await store.fetchRequests();
    const refresh = store.refreshInBackground();
    store.setView("ALL");
    await store.fetchRequests();
    resolveRefresh(page([dto({ requestId: "stale" })]));
    await refresh;
    expect(store.requests.map((r) => r.requestId)).toEqual(["new"]);
  });
});

describe("EcommerceAfterSaleModel detail", () => {
  const record = {
    event: "ORDER_RETURN",
    role: "BUYER",
    images: [{ url: "https://x/a.jpg" }],
    videos: [],
  };

  const order = {
    orderId: "order-1",
    status: "DELIVERED",
    totalAmount: "25.98",
    currency: "EUR",
    trackingNumber: "TRACK-1",
    lineItems: [],
  };
  const tracking = {
    trackingNumber: "TRACK-1",
    events: [{ description: "Delivered", updateTimeMillis: 1 }],
  };

  function detailSetup(orderOverride: Record<string, unknown> | null = order) {
    return setup({
      query: ({ query: doc }) => {
        if (doc === READ_AFTER_SALE_REQUESTS_QUERY) {
          return page([dto(), dto({ kind: "CANCELLATION", requestId: "c1" })]);
        }
        if (doc === READ_AFTER_SALE_ORDER_QUERY) return { data: { order: orderOverride } };
        if (doc === READ_AFTER_SALE_ORDER_TRACKING_QUERY) return { data: { tracking } };
        return { data: { records: [record] } };
      },
    });
  }

  it("loads the live order with its carrier events and the records of a return", async () => {
    const { store, query } = detailSetup();
    await store.fetchRequests();
    await store.openDetail("shop-1:REFUND:r1");
    expect(store.detail.recordsStatus).toBe("loaded");
    expect(store.detail.records).toEqual([record]);
    expect(store.detail.orderStatus).toBe("loaded");
    expect(store.detail.order).toEqual(order);
    expect(store.detail.trackingStatus).toBe("loaded");
    expect(store.detail.tracking).toEqual(tracking);
    const docs = query.mock.calls.map(([opts]) => opts.query);
    expect(docs).toContain(READ_AFTER_SALE_RETURN_RECORDS_QUERY);
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: READ_AFTER_SALE_ORDER_QUERY,
        variables: { shopId: "shop-1", orderId: "order-1" },
      }),
    );
  });

  it("reads no records for a cancellation, and no tracking for an order without a tracking number", async () => {
    const { store, query } = detailSetup({ ...order, trackingNumber: null });
    await store.fetchRequests();
    await store.openDetail("shop-1:CANCELLATION:c1");
    const docs = query.mock.calls.map(([opts]) => opts.query);
    expect(docs).not.toContain(READ_AFTER_SALE_RETURN_RECORDS_QUERY);
    expect(docs).not.toContain(READ_AFTER_SALE_ORDER_TRACKING_QUERY);
    expect(store.detail.recordsStatus).toBe("idle");
    expect(store.detail.orderStatus).toBe("loaded");
    expect(store.detail.trackingStatus).toBe("idle");
    expect(store.selectedRequest?.requestId).toBe("c1");
  });

  it("shows an order failure in its own section and still loads the records", async () => {
    const { store } = setup({
      query: ({ query: doc }) => {
        if (doc === READ_AFTER_SALE_REQUESTS_QUERY) return page([dto()]);
        if (doc === READ_AFTER_SALE_ORDER_QUERY) throw new Error("order unavailable");
        return { data: { records: [record] } };
      },
    });
    await store.fetchRequests();
    await expect(store.openDetail("shop-1:REFUND:r1")).rejects.toThrow("order unavailable");
    expect(store.detail.orderStatus).toBe("error");
    expect(store.detail.orderError).toBe("order unavailable");
    expect(store.detail.recordsStatus).toBe("loaded");
  });

  it("shows a records failure instead of swallowing it", async () => {
    const { store } = setup({
      query: ({ query: doc }) => {
        if (doc === READ_AFTER_SALE_REQUESTS_QUERY) return page([dto()]);
        if (doc === READ_AFTER_SALE_ORDER_QUERY) return { data: { order: null } };
        throw new Error("records unavailable");
      },
    });
    await store.fetchRequests();
    await expect(store.openDetail("shop-1:REFUND:r1")).rejects.toThrow("records unavailable");
    expect(store.detail.recordsStatus).toBe("error");
    expect(store.detail.recordsError).toBe("records unavailable");
  });
});

describe("EcommerceAfterSaleModel decisions", () => {
  function decisionSetup(row: Record<string, unknown>, fresh: Record<string, unknown> | null) {
    return setup({
      query: ({ query: doc }) => {
        if (doc === READ_AFTER_SALE_REQUESTS_QUERY)
          return page([dto(row), dto({ requestId: "other" })], null, 2);
        if (doc === READ_AFTER_SALE_REQUEST_QUERY) return { data: { request: fresh } };
        if (doc === READ_AFTER_SALE_REJECT_REASONS_QUERY) {
          return { data: { reasons: [{ reasonId: "why-1", reasonText: "Not eligible" }] } };
        }
        return { data: { records: [] } };
      },
    });
  }

  it("approves a refund, re-reads the row by id and drops it from TO_REVIEW", async () => {
    // TikTok's index still shows the pending state; the backend's decision record takes it out of review.
    const { store, mutate, query } = decisionSetup(
      {},
      dto({
        needsReview: false,
        sellerDecision: "APPROVED",
        sellerDecidedAt: "2026-11-03T02:00:00Z",
        decisionAwaitingPlatform: true,
      }),
    );
    await store.fetchRequests();
    await store.openDetail("shop-1:REFUND:r1");
    await store.approve();

    expect(mutate).toHaveBeenCalledWith({
      mutation: APPROVE_AFTER_SALE_REFUND_MUTATION,
      variables: { shopId: "shop-1", returnId: "r1" },
    });
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: READ_AFTER_SALE_REQUEST_QUERY,
        variables: { shopId: "shop-1", kind: "REFUND", requestId: "r1" },
      }),
    );
    expect(store.requests.map((r) => r.requestId)).toEqual(["other"]);
    expect(store.totalCount).toBe(1);
    expect(store.detail.key).toBeNull();
    expect(store.notice).toEqual({ outcome: "approved", requestId: "r1", kind: "REFUND" });
  });

  it("keeps the updated row in the ALL view", async () => {
    const { store } = decisionSetup(
      {},
      dto({
        status: "RETURN_OR_REFUND_REQUEST_SUCCESS",
        sellerNextAction: null,
        needsReview: false,
      }),
    );
    store.setView("ALL");
    await store.fetchRequests();
    await store.openDetail("shop-1:REFUND:r1");
    await store.approve();
    expect(store.requests.map((r) => r.requestId)).toEqual(["r1", "other"]);
    expect(store.requests[0].status).toBe("RETURN_OR_REFUND_REQUEST_SUCCESS");
    expect(store.requests[0].needsReview).toBe(false);
  });

  it("sends the mapped return decision and the cancellation mutation", async () => {
    const received = decisionSetup(
      {
        kind: "RETURN_AND_REFUND",
        sellerNextAction: "SELLER_RESPOND_RECEIVE_PACKAGE",
        status: "BUYER_SHIPPED_ITEM",
      },
      null,
    );
    await received.store.fetchRequests();
    await received.store.openDetail("shop-1:RETURN_AND_REFUND:r1");
    await received.store.approve();
    expect(received.mutate).toHaveBeenCalledWith({
      mutation: APPROVE_AFTER_SALE_RETURN_MUTATION,
      variables: { shopId: "shop-1", returnId: "r1", decision: "APPROVE_RECEIVED_PACKAGE" },
    });

    const cancel = decisionSetup(
      {
        kind: "CANCELLATION",
        sellerNextAction: "SELLER_RESPOND_BUYER_CANCEL",
        status: "CANCELLATION_REQUEST_PENDING",
      },
      null,
    );
    await cancel.store.fetchRequests();
    await cancel.store.openDetail("shop-1:CANCELLATION:r1");
    await cancel.store.approve();
    expect(cancel.mutate).toHaveBeenCalledWith({
      mutation: APPROVE_AFTER_SALE_CANCELLATION_MUTATION,
      variables: { shopId: "shop-1", cancelId: "r1" },
    });
  });

  it("keeps a request TikTok still asks the seller to act on in TO_REVIEW", async () => {
    const { store } = decisionSetup(
      { kind: "RETURN_AND_REFUND", sellerNextAction: "SELLER_RESPOND_RETURN" },
      dto({
        kind: "RETURN_AND_REFUND",
        status: "BUYER_SHIPPED_ITEM",
        sellerNextAction: "SELLER_RESPOND_RECEIVE_PACKAGE",
        sellerDecision: "APPROVED",
      }),
    );
    await store.fetchRequests();
    await store.openDetail("shop-1:RETURN_AND_REFUND:r1");
    await store.approve();
    expect(store.requests.map((r) => r.requestId)).toEqual(["r1", "other"]);
    expect(store.requests[0].sellerNextAction).toBe("SELLER_RESPOND_RECEIVE_PACKAGE");
  });

  it("reloads the list when the workspace has no row for the decided request yet", async () => {
    const { store, query } = decisionSetup({}, null);
    await store.fetchRequests();
    await store.openDetail("shop-1:REFUND:r1");
    await store.approve();
    const listCalls = query.mock.calls.filter(
      ([opts]) => opts.query === READ_AFTER_SALE_REQUESTS_QUERY,
    );
    expect(listCalls.length).toBe(2);
  });

  it("approves from the list after the confirmation and drops the row from TO_REVIEW", async () => {
    const { store, mutate } = decisionSetup(
      {},
      dto({ needsReview: false, sellerDecision: "APPROVED", decisionAwaitingPlatform: true }),
    );
    await store.fetchRequests();
    store.beginRowApprove("shop-1:REFUND:r1");
    expect(store.rowApproveRequest?.requestId).toBe("r1");
    expect(mutate).not.toHaveBeenCalled();
    const approving = store.approveFromList();
    expect(store.rowApproveKey).toBeNull();
    expect(store.rowDecidingKey).toBe("shop-1:REFUND:r1");
    await approving;
    expect(mutate).toHaveBeenCalledWith({
      mutation: APPROVE_AFTER_SALE_REFUND_MUTATION,
      variables: { shopId: "shop-1", returnId: "r1" },
    });
    expect(store.rowDecidingKey).toBeNull();
    expect(store.requests.map((r) => r.requestId)).toEqual(["other"]);
    expect(store.notice).toEqual({ outcome: "approved", requestId: "r1", kind: "REFUND" });
  });

  it("shows a failed approval from the list against its request and keeps the row", async () => {
    const { store } = setup({
      query: () => page([dto()]),
      mutate: () => {
        throw new Error("TikTok refused");
      },
    });
    await store.fetchRequests();
    store.beginRowApprove("shop-1:REFUND:r1");
    await expect(store.approveFromList()).rejects.toThrow("TikTok refused");
    expect(store.rowDecisionError).toEqual({ requestId: "r1", message: "TikTok refused" });
    expect(store.rowDecidingKey).toBeNull();
    expect(store.requests.length).toBe(1);
  });

  it("opens a request from the list straight on its reject form", async () => {
    const { store } = decisionSetup({}, null);
    await store.fetchRequests();
    await store.openDetailForReject("shop-1:REFUND:r1");
    expect(store.detail.key).toBe("shop-1:REFUND:r1");
    expect(store.detail.decisionMode).toBe("reject");
    expect(store.detail.rejectReasons).toEqual([{ reasonId: "why-1", reasonText: "Not eligible" }]);
  });

  it("shows a TikTok approval error and keeps the request open", async () => {
    const { store } = setup({
      query: () => page([dto()]),
      mutate: () => {
        throw new Error("TikTok refused");
      },
    });
    await store.fetchRequests();
    await store.openDetail("shop-1:REFUND:r1");
    await expect(store.approve()).rejects.toThrow("TikTok refused");
    expect(store.detail.decisionError).toBe("TikTok refused");
    expect(store.detail.deciding).toBe(false);
    expect(store.detail.key).toBe("shop-1:REFUND:r1");
    expect(store.requests.length).toBe(1);
  });

  it("loads reject reasons when the reject flow starts and posts the reject with the shop header", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { store, query } = decisionSetup(
      { kind: "RETURN_AND_REFUND", sellerNextAction: "SELLER_RESPOND_RETURN" },
      dto({
        kind: "RETURN_AND_REFUND",
        status: "REFUND_OR_RETURN_REQUEST_REJECT",
        sellerNextAction: null,
        needsReview: false,
      }),
    );
    await store.fetchRequests();
    await store.openDetail("shop-1:RETURN_AND_REFUND:r1");
    await store.beginReject();
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: READ_AFTER_SALE_REJECT_REASONS_QUERY,
        variables: { shopId: "shop-1", returnOrCancelId: "r1" },
      }),
    );
    expect(store.detail.rejectReasons).toEqual([{ reasonId: "why-1", reasonText: "Not eligible" }]);

    // Nothing is sent without a reason.
    await store.reject();
    expect(fetchMock).not.toHaveBeenCalled();

    store.setRejectReason("why-1");
    store.setRejectComment("  out of policy  ");
    await store.reject();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/cloud/ecommerce/reject-return");
    expect(init.headers).toMatchObject({ "x-shop-id": "shop-1" });
    expect(JSON.parse(init.body as string)).toEqual({
      returnId: "r1",
      decision: "REJECT_RETURN",
      rejectReason: "why-1",
      comment: "out of policy",
    });
    expect(store.requests.map((r) => r.requestId)).toEqual(["other"]);
    expect(store.notice).toMatchObject({ outcome: "rejected" });
  });

  it("rejects a cancellation through the cancellation endpoint", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { store } = decisionSetup(
      {
        kind: "CANCELLATION",
        sellerNextAction: "SELLER_RESPOND_BUYER_CANCEL",
        status: "CANCELLATION_REQUEST_PENDING",
      },
      null,
    );
    await store.fetchRequests();
    await store.openDetail("shop-1:CANCELLATION:r1");
    await store.beginReject();
    store.setRejectReason("why-1");
    await store.reject();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/cloud/ecommerce/reject-cancellation");
    expect(JSON.parse(init.body as string)).toEqual({ cancelId: "r1", rejectReason: "why-1" });
  });

  it("sends evidence images with a rejection as base64 snapshots", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { store } = decisionSetup(
      {
        kind: "CANCELLATION",
        sellerNextAction: "SELLER_RESPOND_BUYER_CANCEL",
        status: "CANCELLATION_REQUEST_PENDING",
      },
      null,
    );
    await store.fetchRequests();
    await store.openDetail("shop-1:CANCELLATION:r1");
    await store.beginReject();
    store.setRejectReason("why-1");
    await store.reject([{ data: "aGVsbG8=", mime: "image/png" }]);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      cancelId: "r1",
      rejectReason: "why-1",
      imagesBase64: [{ data: "aGVsbG8=", mime: "image/png" }],
    });
  });

  it("shows the server error of a failed reject", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ error: "Reason not allowed" }), { status: 500 }),
      ),
    );
    const { store } = decisionSetup({}, null);
    await store.fetchRequests();
    await store.openDetail("shop-1:REFUND:r1");
    await store.beginReject();
    store.setRejectReason("why-1");
    await expect(store.reject()).rejects.toThrow("Reason not allowed");
    expect(store.detail.decisionError).toBe("Reason not allowed");
    expect(store.requests.length).toBe(2);
  });
});
