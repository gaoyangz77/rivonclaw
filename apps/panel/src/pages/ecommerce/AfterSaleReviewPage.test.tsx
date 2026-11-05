// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n/index.js";
import {
  READ_AFTER_SALE_ORDER_QUERY,
  READ_AFTER_SALE_ORDER_TRACKING_QUERY,
  READ_AFTER_SALE_REJECT_REASONS_QUERY,
  READ_AFTER_SALE_REQUEST_QUERY,
  READ_AFTER_SALE_REQUESTS_QUERY,
} from "../../api/after-sale-queries.js";
import { EcommerceAfterSaleModel } from "../../store/models/EcommerceAfterSaleModel.js";
import { AfterSaleReviewPage } from "./AfterSaleReviewPage.js";

const mocks = vi.hoisted(() => ({ store: {} as Record<string, unknown>, showToast: vi.fn() }));
vi.mock("../../components/Toast.js", () => ({ useToast: () => ({ showToast: mocks.showToast }) }));
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
      {
        lineItemId: "l1",
        productName: "Ceramic mug",
        sellerSku: "MUG-01",
        productImageUrl: "https://example.test/mug.jpg",
        refundTotal: "12.50",
        currency: "USD",
      },
      {
        lineItemId: "l2",
        productName: "Saucer",
        sellerSku: "SAUCER-01",
        refundTotal: "0",
        currency: "USD",
      },
    ],
    needsReview: true,
    sellerDecision: null,
    sellerDecidedAt: null,
    decisionAwaitingPlatform: false,
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
    if (doc === READ_AFTER_SALE_REJECT_REASONS_QUERY) {
      return { data: { reasons: [{ reasonId: "why-1", reasonText: "Damaged by the buyer" }] } };
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
    // The product is the dense work-queue field: seller SKU first, the other lines counted.
    expect(within(bodyRows[0]).getByText("MUG-01")).toBeTruthy();
    expect(within(bodyRows[0]).getByText("+1")).toBeTruthy();
    // Each decidable row carries its suggested action; the exchange has none.
    expect(within(bodyRows[0]).getByRole("button", { name: "Approve refund" })).toBeTruthy();
    expect(within(bodyRows[0]).getByRole("button", { name: "Reject refund" })).toBeTruthy();
    expect(within(bodyRows[2]).queryByRole("button", { name: /Approve/ })).toBeNull();
    expect(within(bodyRows[3]).getByRole("button", { name: "Approve cancellation" })).toBeTruthy();
    expect(within(bodyRows[1]).getByText("Overdue").className).toContain(
      "after-sale-deadline-urgent",
    );
    expect(within(bodyRows[2]).getByText("No platform deadline")).toBeTruthy();
    expect(within(bodyRows[2]).getByText("Waiting 2d 0h")).toBeTruthy();
    expect(within(bodyRows[3]).getByText("2d 0h").className).not.toContain("urgent");
    expect(screen.getByText("4 requests")).toBeTruthy();
    // The request-type filter is offered in "To review" too, as a dropdown like the shop filter.
    expect(screen.getByRole("button", { name: "Request type" }).textContent).toBe("All types");
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
    expect(within(dialog).getByRole("button", { name: "Approve refund" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Reject refund" })).toBeTruthy();
    expect(afterSale.detail.key).toBe("shop-1:REFUND:r1");
    const bar = dialog.querySelector(".after-sale-action-bar")!;
    expect(within(bar as HTMLElement).getByText("Respond to refund")).toBeTruthy();
    expect(within(bar as HTMLElement).getByRole("button", { name: "Approve refund" })).toBeTruthy();
  });

  it("rejects with a reason, a comment and evidence images", async () => {
    const { afterSale } = setup();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:evidence", revokeObjectURL: () => {} }));
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AfterSaleReviewPage />);
    fireEvent.click(await screen.findByText("Ceramic mug"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject refund" }));
    await waitFor(() => expect(afterSale.detail.rejectReasons).toHaveLength(1));
    afterSale.setRejectReason("why-1");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Seal is broken" } });

    const image = new File([new Uint8Array([104, 105])], "evidence.png", { type: "image/png" });
    const gif = new File([new Uint8Array([1])], "anim.gif", { type: "image/gif" });
    fireEvent.change(within(dialog).getByLabelText("Add images"), { target: { files: [image, gif] } });
    await within(dialog).findByAltText("evidence.png");
    // TikTok's image upload takes no GIF: it is refused before it is attached.
    expect(within(dialog).queryByAltText("anim.gif")).toBeNull();
    expect(mocks.showToast).toHaveBeenCalledWith(expect.any(String), "error");

    fireEvent.click(within(dialog).getByRole("button", { name: "Reject request" }));
    // Product thumbnails resolve through the media cache; only the reject call matters here.
    const rejectCall = () =>
      (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>).find(
        ([url]) => url === "/api/cloud/ecommerce/reject-return",
      );
    await waitFor(() => expect(rejectCall()).toBeDefined());
    const [, init] = rejectCall()!;
    expect(JSON.parse(init.body as string)).toMatchObject({
      returnId: "r1",
      rejectReason: "why-1",
      comment: "Seal is broken",
      imagesBase64: [{ data: "aGk=", mime: "image/png" }],
    });
  });

  it("asks for confirmation before approving and removes the decided row", async () => {
    const { afterSale, mutate, query } = setup();
    query.mockImplementation(async ({ query: doc }: { query: unknown }) => {
      if (doc === READ_AFTER_SALE_REQUESTS_QUERY) {
        return { data: { page: { items: rows, nextCursor: null, totalCount: 4 } } };
      }
      if (doc === READ_AFTER_SALE_REQUEST_QUERY) {
        // TikTok's index still returns the pending state; the backend's decision record says done.
        return {
          data: {
            request: dto({
              needsReview: false,
              sellerDecision: "APPROVED",
              sellerDecidedAt: "2026-11-04T12:00:00Z",
              decisionAwaitingPlatform: true,
            }),
          },
        };
      }
      return { data: { records: [] } };
    });
    render(<AfterSaleReviewPage />);
    fireEvent.click(await screen.findByText("Ceramic mug"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(await within(dialog).findByRole("button", { name: "Approve refund" }));

    expect(mutate).not.toHaveBeenCalled();
    const confirm = (await screen.findAllByRole("dialog")).find((el) =>
      within(el).queryByText("Approve refund?"),
    )!;
    fireEvent.click(within(confirm).getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText("Ceramic mug")).toBeNull());
    expect(screen.getByText("Approved the Refund request r1.")).toBeTruthy();
    expect(afterSale.requests.length).toBe(3);
  });

  it("shows a recorded decision waiting for TikTok without offering it again", async () => {
    const { afterSale, query } = setup();
    query.mockImplementation(async () => ({
      data: {
        page: {
          items: [
            dto({
              needsReview: false,
              sellerDecision: "REJECTED",
              sellerDecidedAt: "2026-11-04T11:30:00Z",
              decisionAwaitingPlatform: true,
            }),
          ],
          nextCursor: null,
          totalCount: 1,
        },
        records: [],
      },
    }));
    afterSale.setView("ALL");
    render(<AfterSaleReviewPage />);
    const row = (await screen.findByText("Ceramic mug")).closest("tr")!;
    expect(within(row).getByText("Waiting for TikTok")).toBeTruthy();
    fireEvent.click(within(row).getByText("Ceramic mug"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Your decision")).toBeTruthy();
    expect(within(dialog).getByText(/^Rejected/)).toBeTruthy();
    expect(
      within(dialog).getByText(
        "Your decision (Rejected) was accepted by TikTok. This request updates when TikTok sends its new status.",
      ),
    ).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: /Approve/ })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /Reject/ })).toBeNull();
  });

  it("shows an exchange read-only and a cancellation without a history", async () => {
    setup();
    render(<AfterSaleReviewPage />);
    fireEvent.click(await screen.findByText("Swap item"));
    let dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("This request cannot be decided here. Use TikTok Seller Center."),
    ).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: /Approve/ })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByText("Cancelled item"));
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("TikTok provides no history for cancellations.")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Approve cancellation" })).toBeTruthy();
  });

  it("approves from the list after a confirmation, without opening the detail", async () => {
    const { mutate } = setup();
    render(<AfterSaleReviewPage />);
    const row = (await screen.findByText("Ceramic mug")).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Approve refund" }));
    expect(mutate).not.toHaveBeenCalled();
    const confirm = await screen.findByRole("dialog");
    expect(within(confirm).getByText("Approve refund?")).toBeTruthy();
    expect(within(confirm).getByText(/Refund request \(r1\)/)).toBeTruthy();
    fireEvent.click(within(confirm).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect((mutate.mock.calls as unknown as Array<[unknown]>)[0]![0]).toMatchObject({ variables: { shopId: "shop-1", returnId: "r1" } });
  });

  it("opens the detail on the reject form from the list", async () => {
    const { afterSale } = setup();
    render(<AfterSaleReviewPage />);
    const row = (await screen.findByText("Ceramic mug")).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Reject refund" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(afterSale.detail.rejectReasons).toHaveLength(1));
    expect(afterSale.detail.decisionMode).toBe("reject");
    expect(within(dialog).getByRole("button", { name: "Reject request" })).toBeTruthy();
    // The form expands in the action bar pinned under the preview, not inside the scrolling preview.
    const bar = dialog.querySelector(".after-sale-action-bar")!;
    expect(bar.querySelector(".after-sale-reject-form")).toBeTruthy();
    expect(dialog.querySelector(".after-sale-detail-scroll .after-sale-reject-form")).toBeNull();
    expect(bar.closest(".after-sale-detail-scroll")).toBeNull();
  });

  it("copies the order id from the list without opening the row", async () => {
    const { afterSale } = setup();
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<AfterSaleReviewPage />);
    const row = (await screen.findByText("Ceramic mug")).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: /order ID: order-1/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("order-1"));
    expect(afterSale.detail.key).toBeNull();
  });

  it("shows the live order with its shipping and recipient in the detail", async () => {
    const { query } = setup();
    const base = query.getMockImplementation()!;
    query.mockImplementation(async (opts: { query: unknown }) => {
      if (opts.query === READ_AFTER_SALE_ORDER_QUERY) {
        return {
          data: {
            order: {
              orderId: "order-1",
              status: "DELIVERED",
              createTime: 1_793_000_000,
              totalAmount: "25.98",
              currency: "USD",
              paymentMethodName: "Card",
              shippingProvider: "DHL",
              trackingNumber: "TRK-9",
              recipientAddress: { name: "Ada", phone: "+49 1", fullAddress: "Berlin" },
              lineItems: [{ orderLineItemId: "o1", productName: "Ceramic mug", quantity: 2, salePrice: "12.99", currency: "USD" }],
            },
          },
        };
      }
      if (opts.query === READ_AFTER_SALE_ORDER_TRACKING_QUERY) {
        return {
          data: {
            tracking: {
              shippingProvider: "DHL",
              trackingNumber: "TRK-9",
              events: [
                { description: "Picked up", updateTimeMillis: 1_793_000_000_000 },
                { description: "Delivered to the buyer", updateTimeMillis: 1_793_100_000_000 },
              ],
            },
          },
        };
      }
      return base(opts as never);
    });
    render(<AfterSaleReviewPage />);
    fireEvent.click(await screen.findByText("Ceramic mug"));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("DHL")).toBeTruthy();
    expect(within(dialog).getByText("Card")).toBeTruthy();
    expect(within(dialog).getByText("Ada")).toBeTruthy();
    expect(within(dialog).getByText("Order items (1)")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /tracking number: TRK-9/ })).toBeTruthy();
    // Only the latest carrier event shows until the seller expands the list.
    expect(await within(dialog).findByText("Delivered to the buyer")).toBeTruthy();
    expect(within(dialog).queryByText("Picked up")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Show all 2 updates" }));
    expect(within(dialog).getByText("Picked up")).toBeTruthy();
  });

  it("narrows the list by request type from the dropdown, where no selection means every type", async () => {
    const { afterSale, query } = setup();
    render(<AfterSaleReviewPage />);
    await screen.findByText("Ceramic mug");
    fireEvent.click(screen.getByRole("button", { name: "Request type" }));
    const panel = await screen.findByRole("dialog", { name: "Request type" });
    // Nothing selected is "every type": every box is checked.
    const boxes = within(panel).getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.map((box) => box.checked)).toEqual([true, true, true, true, true]);
    fireEvent.click(within(panel).getByRole("button", { name: "Only this: Refund" }));
    expect([...afterSale.kinds]).toEqual(["REFUND"]);
    // Changing the filter re-queries the list with it.
    await waitFor(() =>
      expect(query).toHaveBeenLastCalledWith(
        expect.objectContaining({ variables: { input: { view: "TO_REVIEW", kinds: ["REFUND"] } } }),
      ),
    );
    expect(screen.getByRole("button", { name: "Request type" }).textContent).toBe("Refund");
    // The last checked type cannot be unchecked: the filter never becomes empty.
    expect((within(panel).getByLabelText("Refund") as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(within(panel).getByLabelText("Cancellation"));
    expect([...afterSale.kinds]).toEqual(["REFUND", "CANCELLATION"]);
    expect(screen.getByRole("button", { name: "Request type" }).textContent).toBe("2 selected");
    // Checking every type again is "every type".
    fireEvent.click(within(panel).getByRole("button", { name: "Select all" }));
    expect([...afterSale.kinds]).toEqual([]);
    expect(screen.getByRole("button", { name: "Request type" }).textContent).toBe("All types");
  });

  it("shows a list error instead of an empty table", async () => {
    const { query } = setup();
    query.mockRejectedValue(new Error("warehouse unavailable"));
    render(<AfterSaleReviewPage />);
    expect(await screen.findByText("warehouse unavailable")).toBeTruthy();
    expect(screen.getByText("Could not load after-sale requests.")).toBeTruthy();
  });
});
