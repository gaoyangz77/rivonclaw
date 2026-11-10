import { applySnapshot, flow, getEnv, types, type Instance } from "mobx-state-tree";
import { GQL } from "@rivonclaw/core";
import {
  APPLY_BAD_REVIEW_IMPORT_MUTATION,
  PREVIEW_BAD_REVIEW_BULK_FOLLOW_UP_QUERY,
  PREVIEW_BAD_REVIEW_IMPORT_MUTATION,
  READ_BAD_REVIEW_BULK_FOLLOW_UP_QUERY,
  READ_BAD_REVIEWS_QUERY,
  START_BAD_REVIEW_BULK_FOLLOW_UP_MUTATION,
  START_BAD_REVIEW_FOLLOW_UP_MUTATION,
  TRANSLATE_BAD_REVIEW_BULK_MESSAGE_MUTATION,
  UPDATE_BAD_REVIEW_FOLLOW_UP_STATUS_MUTATION,
} from "../../api/bad-review-queries.js";
import { canBulkSendReview, type BadReviewHandlingStatus } from "../../lib/bad-review.js";
import type { PanelStoreEnv } from "../types.js";

/** Rows per page the operator can pick; the backend caps a page at 100. */
export const BAD_REVIEW_PAGE_SIZES = [20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 50;

const handlingStatusType = types.enumeration<GQL.ProductReviewHandlingStatus>(
  "ProductReviewHandlingStatus",
  Object.values(GQL.ProductReviewHandlingStatus),
);

const replyStateType = types.enumeration<GQL.ProductReviewReplyState>(
  "ProductReviewReplyState",
  Object.values(GQL.ProductReviewReplyState),
);

const BadReviewHandlingEventModel = types.model("BadReviewHandlingEvent", {
  from: types.maybeNull(handlingStatusType),
  to: handlingStatusType,
  note: types.maybeNull(types.string),
  source: types.enumeration<GQL.ProductReviewHandlingEventSource>(
    "ProductReviewHandlingEventSource",
    Object.values(GQL.ProductReviewHandlingEventSource),
  ),
  at: types.string,
});

export const BadReviewRowModel = types
  .model("BadReviewRow", {
    id: types.identifier,
    shopId: types.string,
    shopName: types.string,
    platformReviewId: types.string,
    orderId: types.maybeNull(types.string),
    hasBuyer: types.boolean,
    rating: types.maybeNull(types.number),
    title: types.maybeNull(types.string),
    content: types.maybeNull(types.string),
    reviewTime: types.maybeNull(types.string),
    source: types.enumeration<GQL.ProductReviewSource>(
      "ProductReviewSource",
      Object.values(GQL.ProductReviewSource),
    ),
    importBatchId: types.maybeNull(types.string),
    shopFollowUpMode: types.maybeNull(
      types.enumeration<GQL.BadReviewFollowUpMode>(
        "BadReviewFollowUpMode",
        Object.values(GQL.BadReviewFollowUpMode),
      ),
    ),
    handlingStatus: types.maybeNull(handlingStatusType),
    handlingChangedAt: types.maybeNull(types.string),
    replyState: types.maybeNull(replyStateType),
    replyCheckedAt: types.maybeNull(types.string),
    handlingEvents: types.array(BadReviewHandlingEventModel),
    aiFollowUpStatus: types.enumeration<GQL.ProductReviewFollowUpStatus>(
      "ProductReviewFollowUpStatus",
      Object.values(GQL.ProductReviewFollowUpStatus),
    ),
    conversationId: types.maybeNull(types.string),
    conversationAiEnabled: types.maybeNull(types.boolean),
    reachoutState: types.maybeNull(
      types.enumeration<GQL.BadReviewReachoutState>(
        "BadReviewReachoutState",
        Object.values(GQL.BadReviewReachoutState),
      ),
    ),
    reachoutSentCount: types.maybeNull(types.number),
    reachoutMaxAttempts: types.maybeNull(types.number),
    reachoutNextAt: types.maybeNull(types.string),
  })
  .actions((self) => ({
    replaceWith(snapshot: BadReviewRowSnapshot) {
      const { handlingEvents, id: _id, ...fields } = snapshot;
      Object.assign(self, fields);
      applySnapshot(self.handlingEvents, handlingEvents);
    },
  }));

export type BadReviewRowNode = Instance<typeof BadReviewRowModel>;

type BadReviewRowSnapshot = ReturnType<typeof toRowSnapshot>;

function toRowSnapshot(dto: GQL.EcomBadReview) {
  return {
    id: dto.id,
    shopId: dto.shopId,
    shopName: dto.shopName,
    platformReviewId: dto.platformReviewId,
    orderId: dto.orderId ?? null,
    hasBuyer: dto.hasBuyer,
    rating: dto.rating ?? null,
    title: dto.title ?? null,
    content: dto.content ?? null,
    reviewTime: dto.reviewTime ?? null,
    source: dto.source,
    importBatchId: dto.importBatchId ?? null,
    shopFollowUpMode: dto.shopFollowUpMode ?? null,
    handlingStatus: dto.handlingStatus ?? null,
    handlingChangedAt: dto.handlingChangedAt ?? null,
    replyState: dto.replyState ?? null,
    replyCheckedAt: dto.replyCheckedAt ?? null,
    handlingEvents: dto.handlingEvents.map((event) => ({
      from: event.from ?? null,
      to: event.to,
      note: event.note ?? null,
      source: event.source,
      at: event.at,
    })),
    aiFollowUpStatus: dto.aiFollowUpStatus,
    conversationId: dto.conversationId ?? null,
    conversationAiEnabled: dto.conversationAiEnabled ?? null,
    reachoutState: dto.reachoutState ?? null,
    reachoutSentCount: dto.reachoutSentCount ?? null,
    reachoutMaxAttempts: dto.reachoutMaxAttempts ?? null,
    reachoutNextAt: dto.reachoutNextAt ?? null,
  };
}

function startOfLocalDay(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export const EcommerceBadReviewModel = types
  .model("EcommerceBadReview", {
    allShops: types.optional(types.boolean, true),
    shopIds: types.array(types.string),
    rating: types.maybeNull(types.number),
    handlingStatus: types.maybeNull(handlingStatusType),
    replyState: types.maybeNull(replyStateType),
    source: types.maybeNull(
      types.enumeration<GQL.ProductReviewSource>(
        "ProductReviewSource",
        Object.values(GQL.ProductReviewSource),
      ),
    ),
    reviewFrom: types.optional(types.string, ""),
    reviewTo: types.optional(types.string, ""),
    inProgressOverDays: types.maybeNull(types.number),
    rows: types.array(BadReviewRowModel),
    /** 1-based. Any filter change returns to the first page. */
    page: types.optional(types.number, 1),
    pageSize: types.optional(types.number, DEFAULT_PAGE_SIZE),
    totalCount: types.optional(types.number, 0),
    loaded: types.optional(types.boolean, false),
    loading: types.optional(types.boolean, false),
    error: types.maybeNull(types.string),
    selectedReviewId: types.maybeNull(types.string),
    /** Rows ticked for bulk follow-up: ids on the current page only. */
    bulkSelectedIds: types.array(types.string),
    /** Reviews with an action running: Start follow-up or a status update. */
    busyReviewIds: types.array(types.string),
    actionError: types.maybeNull(types.string),
  })
  .views((self) => ({
    get selectedReview() {
      const id = self.selectedReviewId;
      return id ? (self.rows.find((row) => row.id === id) ?? null) : null;
    },
    /** Rows of this page that can be ticked, as ids. */
    get bulkSelectableIds(): string[] {
      return self.rows.filter(canBulkSendReview).map((row) => row.id);
    },
    get pageCount() {
      return Math.max(1, Math.ceil(self.totalCount / self.pageSize));
    },
    /** A fresh plain object per read: the filters, without the page being read. */
    get queryInput(): GQL.EcomBadReviewsInput {
      const input: GQL.EcomBadReviewsInput = {};
      if (!self.allShops) input.shopIds = [...self.shopIds];
      if (self.rating != null) input.ratings = [self.rating];
      if (self.handlingStatus) input.handlingStatuses = [self.handlingStatus];
      if (self.replyState) input.replyStates = [self.replyState];
      if (self.source) input.sources = [self.source];
      if (self.reviewFrom) input.reviewFrom = startOfLocalDay(self.reviewFrom).toISOString();
      if (self.reviewTo) {
        const to = startOfLocalDay(self.reviewTo);
        to.setDate(to.getDate() + 1);
        input.reviewTo = to.toISOString();
      }
      if (self.inProgressOverDays != null) input.inProgressOverDays = self.inProgressOverDays;
      return input;
    },
    /** One value that changes with every filter and page, for the page's fetch effect. */
    get querySignature() {
      return JSON.stringify({ ...this.queryInput, page: self.page, pageSize: self.pageSize });
    },
    get queryable() {
      return self.allShops || self.shopIds.length > 0;
    },
  }))
  .actions((self) => {
    const client = () => getEnv<PanelStoreEnv>(self).apolloClient;
    /** Only the newest list read may write the list. */
    let listGeneration = 0;

    function messageFromError(err: unknown) {
      return err instanceof Error ? err.message : String(err);
    }

    function clearList() {
      applySnapshot(self.rows, []);
      self.totalCount = 0;
    }

    /** A row that left the page or started meanwhile cannot stay ticked out of sight. */
    function dropUnavailableBulkSelection() {
      const selectable = new Set(self.rows.filter(canBulkSendReview).map((row) => row.id));
      self.bulkSelectedIds.replace(self.bulkSelectedIds.filter((id) => selectable.has(id)));
    }

    /** Any change of what is listed: back to the first page, with nothing ticked. */
    function listChanged() {
      self.page = 1;
      self.bulkSelectedIds.clear();
    }

    function pageVariables() {
      return {
        input: {
          ...self.queryInput,
          limit: self.pageSize,
          offset: (self.page - 1) * self.pageSize,
        },
      };
    }

    /**
     * Shows a page of results. The list can shrink under the current page (a filter on status, a
     * closed review); returns false then, after moving to the new last page for the page's fetch
     * effect to read.
     */
    function showPage(page: GQL.EcomBadReviewPage): boolean {
      self.totalCount = page.totalCount;
      const lastPage = Math.max(1, Math.ceil(page.totalCount / self.pageSize));
      if (self.page > lastPage) {
        self.page = lastPage;
        return false;
      }
      applySnapshot(self.rows, page.items.map(toRowSnapshot));
      if (self.selectedReviewId && !self.rows.some((row) => row.id === self.selectedReviewId)) {
        self.selectedReviewId = null;
      }
      dropUnavailableBulkSelection();
      return true;
    }

    function foldIn(dto: GQL.EcomBadReview) {
      self.rows.find((row) => row.id === dto.id)?.replaceWith(toRowSnapshot(dto));
    }

    const fetchReviews = flow(function* () {
      const generation = ++listGeneration;
      self.loading = true;
      self.error = null;
      try {
        if (!self.queryable) {
          clearList();
          self.loaded = true;
          return;
        }
        const result = yield client().query<{ page: GQL.EcomBadReviewPage }>({
          query: READ_BAD_REVIEWS_QUERY,
          variables: pageVariables(),
          fetchPolicy: "network-only",
        });
        if (generation !== listGeneration) return;
        if (showPage(result.data.page)) self.loaded = true;
      } catch (err) {
        if (generation === listGeneration) self.error = messageFromError(err);
        throw err;
      } finally {
        if (generation === listGeneration) self.loading = false;
      }
    });

    return {
      fetchReviews,
      setShopScope(shopIds: string[], totalShopCount: number) {
        self.allShops = shopIds.length === totalShopCount;
        self.shopIds.replace(self.allShops ? [] : shopIds);
        listChanged();
      },
      setRating(value: number | null) {
        self.rating = value;
        listChanged();
      },
      setHandlingStatus(value: BadReviewHandlingStatus | null) {
        self.handlingStatus = value;
        listChanged();
      },
      setReplyState(value: GQL.ProductReviewReplyState | null) {
        self.replyState = value;
        listChanged();
      },
      setSource(value: GQL.ProductReviewSource | null) {
        self.source = value;
        listChanged();
      },
      setReviewFrom(value: string) {
        self.reviewFrom = value;
        listChanged();
      },
      setReviewTo(value: string) {
        self.reviewTo = value;
        listChanged();
      },
      setInProgressOverDays(value: number | null) {
        self.inProgressOverDays = value;
        listChanged();
      },
      setPage(value: number) {
        self.page = Math.min(Math.max(1, value), Math.max(1, Math.ceil(self.totalCount / self.pageSize)));
        self.bulkSelectedIds.clear();
      },
      toggleBulkSelection(reviewId: string) {
        if (self.bulkSelectedIds.includes(reviewId)) self.bulkSelectedIds.remove(reviewId);
        else self.bulkSelectedIds.push(reviewId);
      },
      /** Ticks every selectable row of this page, or clears them all if they already are. */
      toggleBulkSelectionOfPage() {
        const selectable = self.rows.filter(canBulkSendReview).map((row) => row.id);
        self.bulkSelectedIds.replace(self.bulkSelectedIds.length === selectable.length ? [] : selectable);
      },
      setPageSize(value: number) {
        self.pageSize = value;
        listChanged();
      },
      selectReview(reviewId: string | null) {
        self.selectedReviewId = reviewId;
        self.actionError = null;
      },
      dismissActionError() {
        self.actionError = null;
      },
      reset() {
        listGeneration += 1;
        clearList();
        listChanged();
        self.loaded = false;
        self.loading = false;
        self.error = null;
        self.selectedReviewId = null;
        self.actionError = null;
      },
      /** Re-reads the page on screen without the loading state, so a failed tick changes nothing. */
      refreshInBackground: flow(function* () {
        if (self.loading || !self.queryable) return;
        const generation = listGeneration;
        const result = yield client().query<{ page: GQL.EcomBadReviewPage }>({
          query: READ_BAD_REVIEWS_QUERY,
          variables: pageVariables(),
          fetchPolicy: "network-only",
        });
        if (generation !== listGeneration || self.loading) return;
        showPage(result.data.page);
      }),
      /** Returns the conversation to open. A refusal from TikTok changes nothing, so it only throws. */
      startFollowUp: flow(function* (shopId: string, reviewId: string) {
        self.actionError = null;
        self.busyReviewIds.push(reviewId);
        try {
          const result = yield client().mutate({
            mutation: START_BAD_REVIEW_FOLLOW_UP_MUTATION,
            variables: { shopId, reviewId },
          });
          const started = result.data.result as GQL.EcomBadReviewFollowUpStart;
          foldIn(started.review);
          return started.conversation;
        } catch (err) {
          self.actionError = messageFromError(err);
          throw err;
        } finally {
          self.busyReviewIds.remove(reviewId);
        }
      }),
      updateFollowUpStatus: flow(function* (
        shopId: string,
        reviewId: string,
        status: BadReviewHandlingStatus,
        note: string,
      ) {
        self.actionError = null;
        self.busyReviewIds.push(reviewId);
        try {
          const result = yield client().mutate({
            mutation: UPDATE_BAD_REVIEW_FOLLOW_UP_STATUS_MUTATION,
            variables: { shopId, reviewId, status, note: note.trim() || null },
          });
          foldIn(result.data.review as GQL.EcomBadReview);
        } catch (err) {
          self.actionError = messageFromError(err);
          throw err;
        } finally {
          self.busyReviewIds.remove(reviewId);
        }
      }),
      /** Plain results below: they describe one modal's run, not business state. */
      previewBulkFollowUp: flow(function* (reviewIds: string[]) {
        const result = yield client().query({
          query: PREVIEW_BAD_REVIEW_BULK_FOLLOW_UP_QUERY,
          variables: { reviewIds },
          fetchPolicy: "network-only",
        });
        return result.data.preview as GQL.EcomBadReviewBulkPreview;
      }),
      translateBulkMessage: flow(function* (
        message: string,
        languages: GQL.BadReviewMessageLanguage[],
      ) {
        const result = yield client().mutate({
          mutation: TRANSLATE_BAD_REVIEW_BULK_MESSAGE_MUTATION,
          variables: { message, languages },
        });
        return result.data.messages as GQL.EcomBadReviewBulkMessage[];
      }),
      startBulkFollowUp: flow(function* (
        reviewIds: string[],
        messages: GQL.EcomBadReviewBulkMessageInput[],
      ) {
        const result = yield client().mutate({
          mutation: START_BAD_REVIEW_BULK_FOLLOW_UP_MUTATION,
          // Edited translations come from a query result and carry `__typename`, which an input type rejects.
          variables: {
            reviewIds,
            messages: messages.map(({ language, text }) => ({ language, text })),
          },
        });
        return result.data.batch as GQL.EcomBadReviewBulkFollowUp;
      }),
      readBulkFollowUp: flow(function* (batchId: string) {
        const result = yield client().query({
          query: READ_BAD_REVIEW_BULK_FOLLOW_UP_QUERY,
          variables: { batchId },
          fetchPolicy: "network-only",
        });
        return result.data.batch as GQL.EcomBadReviewBulkFollowUp;
      }),
      /** Classifies rows. Returns a plain result: it describes a file, not business state. */
      previewImport: flow(function* (rows: GQL.EcomBadReviewImportRowInput[]) {
        const result = yield client().mutate({
          mutation: PREVIEW_BAD_REVIEW_IMPORT_MUTATION,
          variables: { rows },
        });
        return result.data.result as GQL.EcomBadReviewImportResult;
      }),
      applyImport: flow(function* (rows: GQL.EcomBadReviewImportRowInput[]) {
        const result = yield client().mutate({
          mutation: APPLY_BAD_REVIEW_IMPORT_MUTATION,
          variables: { rows },
        });
        yield fetchReviews();
        return result.data.result as GQL.EcomBadReviewImportResult;
      }),
    };
  });
