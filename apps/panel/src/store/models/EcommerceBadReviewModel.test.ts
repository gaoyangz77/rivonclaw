import { describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { EcommerceBadReviewModel } from "./EcommerceBadReviewModel.js";

function dto(overrides: Partial<GQL.EcomBadReview> = {}): GQL.EcomBadReview {
  return {
    id: "review-1",
    shopId: "shop-1",
    shopName: "Shop",
    platformReviewId: "import:576000000000000001",
    orderId: "576000000000000001",
    hasBuyer: true,
    rating: 1,
    source: GQL.ProductReviewSource.ManualImport,
    shopFollowUpMode: GQL.BadReviewFollowUpMode.Manual,
    handlingStatus: GQL.ProductReviewHandlingStatus.Pending,
    handlingEvents: [],
    aiFollowUpStatus: GQL.ProductReviewFollowUpStatus.NotRequired,
    ...overrides,
  };
}

function storeWith(apolloClient: { query?: unknown; mutate?: unknown }) {
  return EcommerceBadReviewModel.create({}, { apolloClient });
}

const page = (items: GQL.EcomBadReview[], totalCount = items.length) => ({
  data: { page: { items, totalCount } },
});

describe("EcommerceBadReviewModel", () => {
  it("turns the filters into one query and sends only what is set", () => {
    const store = storeWith({});
    expect(store.queryInput).toEqual({});
    store.setShopScope(["shop-1"], 3);
    store.setRating(2);
    store.setHandlingStatus(GQL.ProductReviewHandlingStatus.InProgress);
    store.setSource(GQL.ProductReviewSource.ManualImport);
    store.setInProgressOverDays(7);
    expect(store.queryInput).toEqual({
      shopIds: ["shop-1"],
      ratings: [2],
      handlingStatuses: ["IN_PROGRESS"],
      sources: ["MANUAL_IMPORT"],
      inProgressOverDays: 7,
    });
  });

  it("asks only for reviews needing a reply, from the first page", async () => {
    const store = storeWith({ query: vi.fn().mockResolvedValue(page([dto()], 120)) });
    await store.fetchReviews();
    store.setPage(2);
    store.setReplyState(GQL.ProductReviewReplyState.AwaitingSeller);
    expect(store.page).toBe(1);
    expect(store.queryInput.replyStates).toEqual(["AWAITING_SELLER"]);
  });

  it("selects every shop again when the whole list is chosen", () => {
    const store = storeWith({});
    store.setShopScope(["shop-1", "shop-2"], 2);
    expect(store.allShops).toBe(true);
    expect(store.queryInput.shopIds).toBeUndefined();
  });

  it("reads the chosen page, and returns to the first when a filter or page size changes", async () => {
    const query = vi.fn().mockResolvedValue(page([dto()], 120));
    const store = storeWith({ query });
    await store.fetchReviews();
    expect(store.pageCount).toBe(3);

    store.setPage(3);
    await store.fetchReviews();
    expect(query.mock.calls.at(-1)![0].variables.input).toMatchObject({ limit: 50, offset: 100 });

    store.setRating(1);
    expect(store.page).toBe(1);
    store.setPage(2);
    store.setPageSize(20);
    expect(store.page).toBe(1);
    await store.fetchReviews();
    expect(query.mock.calls.at(-1)![0].variables.input).toMatchObject({ limit: 20, offset: 0 });
  });

  it("never goes past the first or last page", async () => {
    const store = storeWith({ query: vi.fn().mockResolvedValue(page([dto()], 60)) });
    await store.fetchReviews();
    store.setPage(0);
    expect(store.page).toBe(1);
    store.setPage(9);
    expect(store.page).toBe(2);
  });

  it("changes the query signature with the page, so the page fetches it", () => {
    const store = storeWith({});
    const before = store.querySignature;
    store.setPageSize(20);
    expect(store.querySignature).not.toBe(before);
  });

  it("moves to the new last page when the list shrinks under the current one", async () => {
    const query = vi.fn().mockResolvedValueOnce(page([dto()], 120)).mockResolvedValueOnce(page([], 60));
    const store = storeWith({ query });
    await store.fetchReviews();
    store.setPage(3);
    await store.refreshInBackground();
    expect(store.page).toBe(2);
    expect(store.rows).toHaveLength(1);
  });

  it("keeps only the newest list read", async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    const query = vi.fn(() => new Promise((resolve) => resolvers.push(resolve)));
    const store = storeWith({ query });
    const first = store.fetchReviews();
    const second = store.fetchReviews();
    resolvers[1]!(page([dto({ id: "new" })]));
    await second;
    resolvers[0]!(page([dto({ id: "old" })]));
    await first;
    expect(store.rows.map((row) => row.id)).toEqual(["new"]);
  });

  it("folds the started review into the list and returns the conversation to open", async () => {
    const conversation = { shopId: "shop-1", conversationId: "conv-1" };
    const mutate = vi.fn().mockResolvedValue({
      data: {
        result: {
          review: dto({ handlingStatus: GQL.ProductReviewHandlingStatus.InProgress }),
          conversation,
        },
      },
    });
    const store = storeWith({ query: vi.fn().mockResolvedValue(page([dto()])), mutate });
    await store.fetchReviews();
    await expect(store.startFollowUp("shop-1", "review-1")).resolves.toBe(conversation);
    expect(store.rows[0]?.handlingStatus).toBe("IN_PROGRESS");
    expect(store.busyReviewIds).toHaveLength(0);
  });

  it("keeps the status and shows the error when TikTok refuses", async () => {
    const mutate = vi.fn().mockRejectedValue(new Error("TikTok refused the conversation"));
    const store = storeWith({ query: vi.fn().mockResolvedValue(page([dto()])), mutate });
    await store.fetchReviews();
    await expect(store.startFollowUp("shop-1", "review-1")).rejects.toThrow("refused");
    expect(store.rows[0]?.handlingStatus).toBe("PENDING");
    expect(store.actionError).toBe("TikTok refused the conversation");
    expect(store.busyReviewIds).toHaveLength(0);
  });

  it("clears the selection when a refresh no longer has the row", async () => {
    const query = vi.fn().mockResolvedValueOnce(page([dto()])).mockResolvedValueOnce(page([]));
    const store = storeWith({ query });
    await store.fetchReviews();
    store.selectReview("review-1");
    expect(store.selectedReview?.id).toBe("review-1");
    await store.refreshInBackground();
    expect(store.selectedReviewId).toBeNull();
  });

  it("previews and starts a bulk follow-up for exactly the ticked ids", async () => {
    const preview = { reviews: 1, buyers: 1, skippedUnavailable: 0, skippedNoBuyer: 0, skippedNotManual: 0, languages: [] };
    const query = vi.fn().mockResolvedValue({ data: { preview } });
    const mutate = vi.fn().mockResolvedValue({ data: { batch: { id: "batch-1" } } });
    const store = storeWith({ query, mutate });
    await expect(store.previewBulkFollowUp(["review-1"])).resolves.toBe(preview);
    expect(query.mock.calls[0]![0].variables).toEqual({ reviewIds: ["review-1"] });
    // As returned by the translation mutation, which Apollo tags with __typename.
    const translated = [
      { __typename: "EcomBadReviewBulkMessage" as const, language: GQL.BadReviewMessageLanguage.De, text: "Entschuldigung" },
    ];
    await store.startBulkFollowUp(["review-1"], translated);
    expect(mutate.mock.calls[0]![0].variables).toEqual({
      reviewIds: ["review-1"],
      messages: [{ language: GQL.BadReviewMessageLanguage.De, text: "Entschuldigung" }],
    });
  });

  describe("ticking rows", () => {
    const rows = [
      dto({ id: "a" }),
      dto({ id: "b", handlingStatus: null }),
      dto({ id: "started", handlingStatus: GQL.ProductReviewHandlingStatus.InProgress }),
      dto({ id: "closed", handlingStatus: GQL.ProductReviewHandlingStatus.Closed }),
      dto({ id: "no-buyer", hasBuyer: false }),
      dto({ id: "ai-shop", shopFollowUpMode: GQL.BadReviewFollowUpMode.Ai }),
    ];
    const loaded = async () => {
      const store = storeWith({ query: vi.fn().mockResolvedValue(page(rows, 120)) });
      await store.fetchReviews();
      return store;
    };

    it("offers only rows that can take a message, and ticks or clears the whole page", async () => {
      const store = await loaded();
      expect(store.bulkSelectableIds).toEqual(["a", "b", "started"]);
      store.toggleBulkSelectionOfPage();
      expect([...store.bulkSelectedIds]).toEqual(["a", "b", "started"]);
      store.toggleBulkSelectionOfPage();
      expect(store.bulkSelectedIds).toHaveLength(0);
    });

    it("clears the ticks when the page, the page size or a filter changes", async () => {
      const store = await loaded();
      for (const change of [
        () => store.setPage(2),
        () => store.setPageSize(20),
        () => store.setRating(1),
      ]) {
        store.toggleBulkSelection("a");
        change();
        expect(store.bulkSelectedIds).toHaveLength(0);
      }
    });

    it("drops a tick when its row was closed by the next refresh", async () => {
      const query = vi.fn()
        .mockResolvedValueOnce(page(rows))
        .mockResolvedValueOnce(page([
          dto({ id: "a", handlingStatus: GQL.ProductReviewHandlingStatus.Closed }),
          dto({ id: "b", handlingStatus: null }),
        ]));
      const store = storeWith({ query });
      await store.fetchReviews();
      store.toggleBulkSelectionOfPage();
      await store.refreshInBackground();
      expect([...store.bulkSelectedIds]).toEqual(["b"]);
    });
  });

  it("re-reads the list after an import", async () => {
    const query = vi.fn().mockResolvedValue(page([dto()]));
    const mutate = vi.fn().mockResolvedValue({ data: { result: { importBatchId: "b", rows: [] } } });
    const store = storeWith({ query, mutate });
    await store.applyImport([{ rowNumber: 2, orderId: "576000000000000001" }]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(store.rows).toHaveLength(1);
  });
});
