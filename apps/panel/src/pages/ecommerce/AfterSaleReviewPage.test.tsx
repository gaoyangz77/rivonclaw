// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n/index.js";
import {
  READ_AFTER_SALE_REQUEST_QUERY,
  READ_AFTER_SALE_REQUESTS_QUERY,
} from "../../api/after-sale-queries.js";
import { EcommerceAfterSaleModel } from "../../store/models/EcommerceAfterSaleModel.js";
import { AfterSaleReviewPage } from "./AfterSaleReviewPage.js";

const mocks = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock("../../store/EntityStoreProvider.js", () => ({ useEntityStore: () => mocks.store }));

const NOW = Date.parse("2026-11-04T12:00:00Z");

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
    sellerActionDeadline: "2026-11-04T17:12:00Z",
    createTime: "2026-11-03T00:00:00Z",
    updateTime: "2026-11-03T01:00:00Z",
    lines: [
      { lineItemId: "l1", productName: "Ceramic mug", refundTotal: "12.50", currency: "USD" },
      { lineItemId: "l2", productName: "Saucer", refundTotal: "0", currency: "USD" },
    ],
    ...overrides,
  };
}

const rows = [
  dto(),
  dto({
    requestId: "r2",
    sellerActionDeadline: "2026-11-04T11:00:00Z",
    lines: [{ lineItemId: "l3", productName: "Late item" }],
  }),
  dto({
    requestId: "r3",
    kind: "EXCHANGE",
    status: "EXCHANGE_REQUEST_PENDING",
    sellerNextAction: null,
    sellerActionDeadline: null,
    createTime: "2026-11-02T12:00:00Z",
    lines: [{ lineItemId: "l4", productName: "Swap item" }],
  }),
  dto({
    requestId: "c1",
    kind: "CANCELLATION",
    status: "CANCELLATION_REQUEST_PENDING",
    sellerNextAction: "SELLER_RESPOND_BUYER_CANCEL",
    sellerActionDeadline: "2026-11-06T12:00:00Z",
    lines: [{ lineItemId: "l5", productName: "Cancelled item" }],
  }),
];

const evidence = {
  event: "ORDER_RETURN",
  role: "BUYER",
  createTime: 1_793_000_000,
  reasonText: "Item arrived broken",
  images: [{ url: "https://example.test/evidence.jpg", width: 10, height: 10 }],
  videos: [],
};

function setup() {
  const query = vi.fn(async ({ query: doc }: { query: unknown }): Promise<{ data: object }> => {
    if (doc === READ_AFTER_SALE_REQUESTS_QUERY) {
      return { data: { page: { items: rows, nextCursor: null, totalCount: 4 } } };
    }
    return { data: { records: [evidence] } };
  });
  const mutate = vi.fn(async () => ({ data: {} }));
  const afterSale = EcommerceAfterSaleModel.create({}, { apolloClient: { query, mutate } as any });
  mocks.store = {
    ecommerceAfterSale: afterSale,
    currentUser: { userId: "user-1" },
    shops: [{ id: "shop-1", shopName: "Shop One", alias: null, region: "US" }],
  };
  return { afterSale, query, mutate };
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  await i18n.changeLanguage("en");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AfterSaleReviewPage", () => {
  it("lists requests in the returned order with time left, overdue and age", async () => {
    setup();
    render(<AfterSaleReviewPage />);
    await screen.findByText("Ceramic mug");

    const bodyRows = screen.getAllByRole("row").slice(1);
    // Columns: kind, time left, shop, order, ...
    expect(within(bodyRows[0]).getAllByRole("cell")[1].textContent).toBe("5h 12m");
    expect(bodyRows.map((row) => within(row).getAllByRole("cell")[3].textContent)).toEqual([
      "order-1",
      "order-1",
      "order-1",
      "order-1",
    ]);
    expect(within(bodyRows[0]).getByText("5h 12m").className).toContain(
      "after-sale-deadline-urgent",
    );
    expect(within(bodyRows[0]).getByText("+1 more")).toBeTruthy();
    expect(within(bodyRows[1]).getByText("Overdue").className).toContain(
      "after-sale-deadline-urgent",
    );
    expect(within(bodyRows[2]).getByText("No platform deadline")).toBeTruthy();
    expect(within(bodyRows[2]).getByText("Waiting 2d 0h")).toBeTruthy();
    expect(within(bodyRows[3]).getByText("2d 0h").className).not.toContain("urgent");
    expect(screen.getByText("4 requests")).toBeTruthy();
  });

  it("opens a return with its buyer evidence and offers approve and reject", async () => {
    const { afterSale } = setup();
    render(<AfterSaleReviewPage />);
    fireEvent.click(await screen.findByText("Ceramic mug"));

    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Item arrived broken");
    expect(within(dialog).getByRole("link", { name: "Evidence image" }).getAttribute("href")).toBe(
      "https://example.test/evidence.jpg",
    );
    expect(within(dialog).getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Reject" })).toBeTruthy();
    expect(afterSale.detail.key).toBe("shop-1:REFUND:r1");
  });

  it("asks for confirmation before approving and removes the decided row", async () => {
    const { afterSale, mutate, query } = setup();
    query.mockImplementation(async ({ query: doc }: { query: unknown }) => {
      if (doc === READ_AFTER_SALE_REQUESTS_QUERY) {
        return { data: { page: { items: rows, nextCursor: null, totalCount: 4 } } };
      }
      if (doc === READ_AFTER_SALE_REQUEST_QUERY) {
        return {
          data: {
            request: dto({ status: "RETURN_OR_REFUND_REQUEST_SUCCESS", sellerNextAction: null }),
          },
        };
      }
      return { data: { records: [] } };
    });
    render(<AfterSaleReviewPage />);
    fireEvent.click(await screen.findByText("Ceramic mug"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(await within(dialog).findByRole("button", { name: "Approve" }));

    expect(mutate).not.toHaveBeenCalled();
    const confirm = (await screen.findAllByRole("dialog")).find((el) =>
      within(el).queryByText("Approve this request?"),
    )!;
    fireEvent.click(within(confirm).getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText("Ceramic mug")).toBeNull());
    expect(screen.getByText("Approved the Refund request r1.")).toBeTruthy();
    expect(afterSale.requests.length).toBe(3);
  });

  it("shows an exchange read-only and a cancellation without a history", async () => {
    setup();
    render(<AfterSaleReviewPage />);
    fireEvent.click(await screen.findByText("Swap item"));
    let dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("This request cannot be decided here. Use TikTok Seller Center."),
    ).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: "Approve" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByText("Cancelled item"));
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("TikTok provides no history for cancellations.")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Approve" })).toBeTruthy();
  });

  it("shows a list error instead of an empty table", async () => {
    const { query } = setup();
    query.mockRejectedValue(new Error("warehouse unavailable"));
    render(<AfterSaleReviewPage />);
    expect(await screen.findByText("warehouse unavailable")).toBeTruthy();
    expect(screen.getByText("Could not load after-sale requests.")).toBeTruthy();
  });
});
