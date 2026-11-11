import { applySnapshot, flow, getEnv, types, type Instance } from "mobx-state-tree";
import { GQL } from "@rivonclaw/core";
import { CLOUD_REST, clientPath } from "@rivonclaw/core/api-contract";
import { fetchJson } from "../../api/client.js";
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
import {
  afterSaleKey,
  resolveAfterSaleDecision,
  type AfterSaleDecision,
  type AfterSaleKind,
  type AfterSaleRejectImage,
} from "../../lib/after-sale.js";
import { MAX_ORDER_SEARCH_IDS, parseOrderSearch } from "../../lib/order-search.js";
import type { PanelStoreEnv } from "../types.js";

const MS_PER_DAY = 86_400_000;
/** Longest created-at window the backend's ALL view accepts. */
export const AFTER_SALE_MAX_WINDOW_DAYS = 92;
const DEFAULT_WINDOW_DAYS = 30;
/** The backend's page size and the most rows one page may hold. */
const PAGE_LIMIT = 50;
export const AFTER_SALE_MAX_PAGE_LIMIT = 100;
const MAX_PAGE_LIMIT = AFTER_SALE_MAX_PAGE_LIMIT;

const AfterSaleLineModel = types.model("AfterSaleRequestLine", {
  lineItemId: types.string,
  orderLineItemId: types.maybeNull(types.string),
  productId: types.maybeNull(types.string),
  productName: types.maybeNull(types.string),
  skuId: types.maybeNull(types.string),
  skuName: types.maybeNull(types.string),
  sellerSku: types.maybeNull(types.string),
  productImageUrl: types.maybeNull(types.string),
  currency: types.maybeNull(types.string),
  refundTotal: types.maybeNull(types.string),
});

export const AfterSaleRequestModel = types
  .model("AfterSaleRequest", {
    /** `shopId:kind:requestId` — a platform request id is only unique inside its shop and table. */
    key: types.identifier,
    kind: types.enumeration<AfterSaleKind>(
      "AfterSaleKind",
      Object.values(GQL.EcomAfterSaleRequestKind),
    ),
    requestId: types.string,
    shopId: types.string,
    shopName: types.maybeNull(types.string),
    orderId: types.maybeNull(types.string),
    status: types.maybeNull(types.string),
    requestType: types.maybeNull(types.string),
    role: types.maybeNull(types.string),
    reason: types.maybeNull(types.string),
    reasonText: types.maybeNull(types.string),
    currency: types.maybeNull(types.string),
    refundTotal: types.maybeNull(types.string),
    isQuickRefund: types.maybeNull(types.boolean),
    sellerNextAction: types.maybeNull(types.string),
    sellerActionDeadline: types.maybeNull(types.string),
    createTime: types.string,
    updateTime: types.string,
    lines: types.array(AfterSaleLineModel),
    /** The backend's "To review" rule, including a decision that waits for TikTok (ADR-099). */
    needsReview: types.boolean,
    sellerDecision: types.maybeNull(
      types.enumeration<GQL.EcomAfterSaleSellerDecision>(
        "AfterSaleSellerDecision",
        Object.values(GQL.EcomAfterSaleSellerDecision),
      ),
    ),
    sellerDecidedAt: types.maybeNull(types.string),
    decisionAwaitingPlatform: types.boolean,
  })
  .views((self) => ({
    get decision() {
      return resolveAfterSaleDecision(self);
    },
  }))
  .actions((self) => ({
    replaceWith(snapshot: AfterSaleRequestSnapshot) {
      const { lines, key: _key, ...fields } = snapshot;
      Object.assign(self, fields);
      applySnapshot(self.lines, lines);
    },
  }));

export type AfterSaleRequestNode = Instance<typeof AfterSaleRequestModel>;

type AfterSaleRequestSnapshot = ReturnType<typeof toRequestSnapshot>;

function toRequestSnapshot(dto: GQL.EcomAfterSaleRequest) {
  return {
    key: afterSaleKey(dto.shopId, dto.kind, dto.requestId),
    kind: dto.kind,
    requestId: dto.requestId,
    shopId: dto.shopId,
    shopName: dto.shopName ?? null,
    orderId: dto.orderId ?? null,
    status: dto.status ?? null,
    requestType: dto.requestType ?? null,
    role: dto.role ?? null,
    reason: dto.reason ?? null,
    reasonText: dto.reasonText ?? null,
    currency: dto.currency ?? null,
    refundTotal: dto.refundTotal ?? null,
    isQuickRefund: dto.isQuickRefund ?? null,
    sellerNextAction: dto.sellerNextAction ?? null,
    sellerActionDeadline: dto.sellerActionDeadline ?? null,
    createTime: dto.createTime,
    updateTime: dto.updateTime,
    lines: dto.lines.map((line) => ({
      lineItemId: line.lineItemId,
      orderLineItemId: line.orderLineItemId ?? null,
      productId: line.productId ?? null,
      productName: line.productName ?? null,
      skuId: line.skuId ?? null,
      skuName: line.skuName ?? null,
      sellerSku: line.sellerSku ?? null,
      productImageUrl: line.productImageUrl ?? null,
      currency: line.currency ?? null,
      refundTotal: line.refundTotal ?? null,
    })),
    needsReview: dto.needsReview,
    sellerDecision: dto.sellerDecision ?? null,
    sellerDecidedAt: dto.sellerDecidedAt ?? null,
    decisionAwaitingPlatform: dto.decisionAwaitingPlatform,
  };
}

/** One return-records entry, kept as a plain frozen snapshot (signed evidence URLs expire). */
export type AfterSaleRecord = Pick<
  GQL.EcomReturnRecord,
  "event" | "role" | "description" | "reasonText" | "note" | "createTime" | "images" | "videos"
>;

export type AfterSaleRejectReason = Pick<GQL.EcomRejectReason, "reasonId" | "reasonText">;

/** The order behind the open request, as a plain frozen snapshot read live from TikTok. */
export type AfterSaleOrder = Pick<
  GQL.EcomOrder,
  | "orderId"
  | "status"
  | "createTime"
  | "paidTime"
  | "deliveryTime"
  | "totalAmount"
  | "currency"
  | "paymentMethodName"
  | "shippingProvider"
  | "trackingNumber"
> & {
  recipientAddress?: Pick<GQL.EcomRecipientAddress, "name" | "fullAddress" | "phone"> | null;
  lineItems?: Array<
    Pick<
      GQL.EcomOrderLineItem,
      | "orderLineItemId"
      | "productName"
      | "quantity"
      | "sellerSku"
      | "skuName"
      | "skuImage"
      | "salePrice"
      | "currency"
      | "displayStatus"
      | "trackingNumber"
    >
  > | null;
};

export interface AfterSaleTracking {
  shippingProvider?: string | null;
  trackingNumber?: string | null;
  events?: Array<{ description?: string | null; updateTimeMillis?: number | null }> | null;
}

const LoadStatus = types.enumeration("AfterSaleLoadStatus", ["idle", "loading", "loaded", "error"]);

/** Tracking numbers of an order: the order's own, else its line items'. */
export function orderTrackingNumbers(order: AfterSaleOrder): string[] {
  const numbers = order.trackingNumber
    ? [order.trackingNumber]
    : (order.lineItems ?? []).map((item) => item.trackingNumber);
  return [...new Set(numbers.map((value) => value?.trim()).filter((v): v is string => Boolean(v)))];
}

export interface AfterSaleNotice {
  outcome: "approved" | "rejected";
  requestId: string;
  kind: AfterSaleKind;
}

export type AfterSaleView = "TO_REVIEW" | "ALL";

const AfterSaleDetailModel = types.model("AfterSaleDetail", {
  /** Key of the request the detail view is open for; null when closed. */
  key: types.maybeNull(types.string),
  recordsStatus: types.optional(
    types.enumeration("AfterSaleRecordsStatus", ["idle", "loading", "loaded", "error"]),
    "idle",
  ),
  records: types.optional(types.frozen<readonly AfterSaleRecord[]>(), []),
  recordsError: types.maybeNull(types.string),
  orderStatus: types.optional(LoadStatus, "idle"),
  order: types.maybeNull(types.frozen<AfterSaleOrder>()),
  orderError: types.maybeNull(types.string),
  trackingStatus: types.optional(LoadStatus, "idle"),
  tracking: types.maybeNull(types.frozen<AfterSaleTracking>()),
  trackingError: types.maybeNull(types.string),
  decisionMode: types.optional(
    types.enumeration("AfterSaleDecisionMode", ["none", "confirmApprove", "reject"]),
    "none",
  ),
  rejectReasons: types.optional(types.frozen<readonly AfterSaleRejectReason[]>(), []),
  reasonsLoading: types.optional(types.boolean, false),
  reasonsError: types.maybeNull(types.string),
  /** Unsaved reject form input. */
  rejectReasonDraft: types.optional(types.string, ""),
  rejectCommentDraft: types.optional(types.string, ""),
  deciding: types.optional(types.boolean, false),
  decisionError: types.maybeNull(types.string),
});

function formatLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfLocalDay(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export const EcommerceAfterSaleModel = types
  .model("EcommerceAfterSale", {
    view: types.optional(
      types.enumeration<AfterSaleView>("AfterSaleView", ["TO_REVIEW", "ALL"]),
      "TO_REVIEW",
    ),
    kinds: types.optional(types.array(types.string), []),
    statuses: types.optional(types.array(types.string), []),
    sellerActions: types.optional(types.array(types.string), []),
    /** True while the shop filter is "all of my shops"; `shopIds` is then ignored. */
    allShops: types.optional(types.boolean, true),
    shopIds: types.optional(types.array(types.string), []),
    /** ALL view created-at window as local dates, both ends inclusive; empty until the ALL view opens. */
    windowFrom: types.optional(types.string, ""),
    windowTo: types.optional(types.string, ""),
    /** What the order box holds; it searches only on Enter. */
    orderSearchDraft: types.optional(types.string, ""),
    /** Order numbers of the search in effect, in both views; empty when there is none. */
    orderIds: types.optional(types.array(types.string), []),
    requests: types.optional(types.array(AfterSaleRequestModel), []),
    nextCursor: types.maybeNull(types.string),
    totalCount: types.optional(types.number, 0),
    loaded: types.optional(types.boolean, false),
    loading: types.optional(types.boolean, false),
    loadingMore: types.optional(types.boolean, false),
    /** A background re-read of the loaded rows is in flight; it shows no loading state. */
    refreshing: types.optional(types.boolean, false),
    error: types.maybeNull(types.string),
    notice: types.maybeNull(types.frozen<AfterSaleNotice>()),
    detail: types.optional(AfterSaleDetailModel, {}),
    /** Request whose approval from the list waits for the seller's confirmation. */
    rowApproveKey: types.maybeNull(types.string),
    /** Request being approved from the list. */
    rowDecidingKey: types.maybeNull(types.string),
    rowDecisionError: types.maybeNull(types.frozen<{ requestId: string; message: string }>()),
  })
  .views((self) => ({
    /** An order search finds requests of any age: the ALL window is not sent while it runs. */
    get windowApplies() {
      return self.view === "ALL" && self.orderIds.length === 0;
    },
    get orderSearchTooMany() {
      return parseOrderSearch(self.orderSearchDraft).length > MAX_ORDER_SEARCH_IDS;
    },
  }))
  .views((self) => ({
    /** Everything that changes the query, as one primitive for effect dependencies. */
    get querySignature() {
      return JSON.stringify([
        self.view,
        self.allShops ? null : [...self.shopIds],
        // The kind and order filters apply to both views; status, action and window to ALL only.
        [...self.kinds],
        [...self.orderIds],
        self.view === "ALL" ? [[...self.statuses], [...self.sellerActions]] : null,
        self.windowApplies ? [self.windowFrom, self.windowTo] : null,
      ]);
    },
    /** Why the ALL window cannot be queried, if it cannot. */
    get windowIssue(): "missing" | "reversed" | "tooLong" | null {
      if (!self.windowApplies) return null;
      if (!self.windowFrom || !self.windowTo) return "missing";
      const days = Math.round(
        (startOfLocalDay(self.windowTo).getTime() - startOfLocalDay(self.windowFrom).getTime()) /
          MS_PER_DAY,
      );
      if (days < 0) return "reversed";
      return days + 1 > AFTER_SALE_MAX_WINDOW_DAYS ? "tooLong" : null;
    },
    get rowApproveRequest() {
      const key = self.rowApproveKey;
      return key ? (self.requests.find((request) => request.key === key) ?? null) : null;
    },
    get selectedRequest() {
      const key = self.detail.key;
      return key ? (self.requests.find((request) => request.key === key) ?? null) : null;
    },
    get hasMore() {
      return self.nextCursor != null;
    },
    /** The current filters can be queried: a valid ALL window and at least one shop. */
    get queryable() {
      return !this.windowIssue && (self.allShops || self.shopIds.length > 0);
    },
    /**
     * The current filters as one page request without a cursor, a fresh plain object per read.
     * The list and the download (which pages through every match) both build on it.
     */
    get queryInput(): GQL.EcomAfterSaleRequestsInput {
      const input: GQL.EcomAfterSaleRequestsInput = { view: self.view };
      if (!self.allShops) input.shopIds = [...self.shopIds];
      if (self.kinds.length) input.kinds = [...self.kinds] as AfterSaleKind[];
      if (self.orderIds.length) input.orderIds = [...self.orderIds];
      if (self.view === "ALL") {
        if (self.statuses.length) input.statuses = [...self.statuses];
        if (self.sellerActions.length) input.sellerActions = [...self.sellerActions];
      }
      if (self.windowApplies) {
        const to = startOfLocalDay(self.windowTo);
        to.setDate(to.getDate() + 1);
        input.createdFrom = startOfLocalDay(self.windowFrom).toISOString();
        input.createdTo = to.toISOString();
      }
      return input;
    },
  }))
  .actions((self) => {
    const client = () => getEnv<PanelStoreEnv>(self).apolloClient;
    // Responses of superseded queries are dropped; only the newest generation may write state.
    let listGeneration = 0;
    let recordsGeneration = 0;
    let reasonsGeneration = 0;
    let orderGeneration = 0;

    function messageFromError(err: unknown) {
      return err instanceof Error ? err.message : "Request failed";
    }

    function buildInput(cursor: string | null): GQL.EcomAfterSaleRequestsInput {
      const input = self.queryInput;
      if (cursor) input.cursor = cursor;
      return input;
    }

    function clearList() {
      applySnapshot(self.requests, []);
      self.nextCursor = null;
      self.totalCount = 0;
    }

    function resetDetail() {
      recordsGeneration += 1;
      reasonsGeneration += 1;
      orderGeneration += 1;
      applySnapshot(self.detail, {});
    }

    /** The order, then its carrier events when it has a tracking number. Both are live TikTok reads. */
    const loadOrder = flow(function* (key: string, shopId: string, orderId: string) {
      const generation = ++orderGeneration;
      const current = () => generation === orderGeneration && self.detail.key === key;
      self.detail.orderStatus = "loading";
      self.detail.orderError = null;
      self.detail.trackingStatus = "idle";
      self.detail.tracking = null;
      self.detail.trackingError = null;
      let order: AfterSaleOrder | null;
      try {
        const result = yield client().query<{ order: AfterSaleOrder | null }>({
          query: READ_AFTER_SALE_ORDER_QUERY,
          variables: { shopId, orderId },
          fetchPolicy: "network-only",
        });
        if (!current()) return;
        order = result.data.order ?? null;
        self.detail.order = order;
        self.detail.orderStatus = "loaded";
      } catch (err) {
        if (!current()) return;
        self.detail.orderStatus = "error";
        self.detail.orderError = messageFromError(err);
        throw err;
      }
      if (!order || orderTrackingNumbers(order).length === 0) return;
      self.detail.trackingStatus = "loading";
      try {
        const result = yield client().query<{ tracking: AfterSaleTracking | null }>({
          query: READ_AFTER_SALE_ORDER_TRACKING_QUERY,
          variables: { shopId, orderId },
          fetchPolicy: "network-only",
        });
        if (!current()) return;
        self.detail.tracking = result.data.tracking ?? null;
        self.detail.trackingStatus = "loaded";
      } catch (err) {
        if (!current()) return;
        self.detail.trackingStatus = "error";
        self.detail.trackingError = messageFromError(err);
        throw err;
      }
    });

    const fetchRequests = flow(function* () {
      const generation = ++listGeneration;
      self.loading = true;
      self.loadingMore = false;
      self.error = null;
      try {
        if (!self.queryable) {
          clearList();
          self.loaded = true;
          return;
        }
        const result = yield client().query<{ page: GQL.EcomAfterSaleRequestPage }>({
          query: READ_AFTER_SALE_REQUESTS_QUERY,
          variables: { input: buildInput(null) },
          fetchPolicy: "network-only",
        });
        if (generation !== listGeneration) return;
        const page = result.data.page;
        applySnapshot(self.requests, page.items.map(toRequestSnapshot));
        self.nextCursor = page.nextCursor ?? null;
        self.totalCount = page.totalCount;
        self.loaded = true;
      } catch (err) {
        if (generation === listGeneration) self.error = messageFromError(err);
        throw err;
      } finally {
        if (generation === listGeneration) self.loading = false;
      }
    });

    /** Re-reads one row by id after a decision and folds it into the list. */
    const refreshRequest = flow(function* (
      key: string,
      shopId: string,
      kind: AfterSaleKind,
      requestId: string,
    ) {
      const result = yield client().query<{ request: GQL.EcomAfterSaleRequest | null }>({
        query: READ_AFTER_SALE_REQUEST_QUERY,
        variables: { shopId, kind, requestId },
        fetchPolicy: "network-only",
      });
      const fresh = result.data?.request ?? null;
      const current = self.requests.find((request) => request.key === key);
      if (!current) return;
      if (!fresh) {
        // The decision succeeded but the workspace has no document yet: show the authoritative list.
        yield fetchRequests();
        return;
      }
      const snapshot = toRequestSnapshot(fresh);
      if (self.view === "TO_REVIEW" && !snapshot.needsReview) {
        self.requests.remove(current);
        self.totalCount = Math.max(0, self.totalCount - 1);
        return;
      }
      current.replaceWith(snapshot);
    });

    /** Opens a request and reads its order and negotiation history live, side by side. */
    const openDetail = flow(function* (key: string) {
      const request = self.requests.find((row) => row.key === key);
      if (!request) return;
      resetDetail();
      self.detail.key = key;
      const { shopId, requestId, orderId } = request;
      const reads: Promise<unknown>[] = [];
      if (orderId) reads.push(loadOrder(key, shopId, orderId));
      if (request.kind !== GQL.EcomAfterSaleRequestKind.Cancellation) {
        reads.push(loadRecords(shopId, requestId));
      }
      const results: PromiseSettledResult<unknown>[] = yield Promise.allSettled(reads);
      // Each failure is already shown in its own section; the first one is rethrown.
      const failure = results.find((result) => result.status === "rejected");
      if (failure) throw (failure as PromiseRejectedResult).reason;
    });

    /** Opens the reject form and loads the reasons TikTok allows for this request. */
    const beginReject = flow(function* () {
      const request = self.selectedRequest;
      if (!request) return;
      const { shopId, requestId } = request;
      const key = request.key;
      const generation = ++reasonsGeneration;
      self.detail.decisionError = null;
      self.detail.decisionMode = "reject";
      self.detail.rejectReasonDraft = "";
      self.detail.rejectCommentDraft = "";
      self.detail.reasonsLoading = true;
      self.detail.reasonsError = null;
      try {
        const result = yield client().query<{ reasons: AfterSaleRejectReason[] }>({
          query: READ_AFTER_SALE_REJECT_REASONS_QUERY,
          variables: { shopId, returnOrCancelId: requestId },
          fetchPolicy: "network-only",
        });
        if (generation !== reasonsGeneration || self.detail.key !== key) return;
        self.detail.rejectReasons = result.data.reasons;
      } catch (err) {
        if (generation === reasonsGeneration && self.detail.key === key) {
          self.detail.reasonsError = messageFromError(err);
        }
        throw err;
      } finally {
        if (generation === reasonsGeneration) self.detail.reasonsLoading = false;
      }
    });

    /** Sends one approval to the backend mutation its decision maps to. */
    function sendApproval(shopId: string, requestId: string, decision: AfterSaleDecision) {
      if (decision.route === "refund") {
        return client().mutate({
          mutation: APPROVE_AFTER_SALE_REFUND_MUTATION,
          variables: { shopId, returnId: requestId },
        });
      }
      if (decision.route === "return") {
        return client().mutate({
          mutation: APPROVE_AFTER_SALE_RETURN_MUTATION,
          variables: { shopId, returnId: requestId, decision: decision.approveDecision },
        });
      }
      return client().mutate({
        mutation: APPROVE_AFTER_SALE_CANCELLATION_MUTATION,
        variables: { shopId, cancelId: requestId },
      });
    }

    /** The negotiation history of a return; cancellations have no records API. */
    const loadRecords = flow(function* (shopId: string, requestId: string) {
      const generation = ++recordsGeneration;
      self.detail.recordsStatus = "loading";
      try {
        const result = yield client().query<{ records: AfterSaleRecord[] }>({
          query: READ_AFTER_SALE_RETURN_RECORDS_QUERY,
          variables: { shopId, returnId: requestId },
          fetchPolicy: "network-only",
        });
        if (generation !== recordsGeneration) return;
        self.detail.records = result.data.records;
        self.detail.recordsStatus = "loaded";
      } catch (err) {
        if (generation !== recordsGeneration) return;
        self.detail.recordsStatus = "error";
        self.detail.recordsError = messageFromError(err);
        throw err;
      }
    });

    /** The decision already went through; a failed re-read is surfaced as the list error. */
    const settleDecision = flow(function* (
      key: string,
      shopId: string,
      kind: AfterSaleKind,
      requestId: string,
      outcome: AfterSaleNotice["outcome"],
    ) {
      resetDetail();
      self.notice = { outcome, requestId, kind };
      try {
        yield refreshRequest(key, shopId, kind, requestId);
      } catch (err) {
        self.error = messageFromError(err);
        throw err;
      }
    });

    return {
      fetchRequests,
      setView(view: AfterSaleView) {
        if (self.view === view) return;
        self.view = view;
        if (view === "ALL" && !self.windowFrom) {
          const today = new Date();
          const from = new Date(today);
          from.setDate(from.getDate() - (DEFAULT_WINDOW_DAYS - 1));
          self.windowFrom = formatLocalDate(from);
          self.windowTo = formatLocalDate(today);
        }
      },
      setKinds(kinds: string[]) {
        applySnapshot(self.kinds, kinds);
      },
      setStatuses(statuses: string[]) {
        applySnapshot(self.statuses, statuses);
      },
      setSellerActions(actions: string[]) {
        applySnapshot(self.sellerActions, actions);
      },
      /** `totalShopCount` lets a selection of every shop collapse back to "all shops". */
      setShopScope(shopIds: string[], totalShopCount: number) {
        const everything = shopIds.length === totalShopCount;
        self.allShops = everything;
        applySnapshot(self.shopIds, everything ? [] : shopIds);
      },
      setWindow(from: string, to: string) {
        self.windowFrom = from;
        self.windowTo = to;
      },
      /** Typing only edits the box; emptying it ends the search at once. */
      setOrderSearchDraft(value: string) {
        self.orderSearchDraft = value;
        if (self.orderIds.length && !parseOrderSearch(value).length) applySnapshot(self.orderIds, []);
      },
      /** Searches the orders in the box. A list the backend would refuse is left unapplied. */
      applyOrderSearch() {
        const orderIds = parseOrderSearch(self.orderSearchDraft);
        if (orderIds.length > MAX_ORDER_SEARCH_IDS) return;
        applySnapshot(self.orderIds, orderIds);
      },
      dismissNotice() {
        self.notice = null;
      },
      /** Drops every loaded row and open detail, e.g. on logout. */
      reset() {
        listGeneration += 1;
        resetDetail();
        clearList();
        self.loaded = false;
        self.loading = false;
        self.loadingMore = false;
        self.refreshing = false;
        self.error = null;
        self.notice = null;
        self.rowApproveKey = null;
        self.rowDecidingKey = null;
        self.rowDecisionError = null;
      },

      /**
       * Re-reads the rows the seller has loaded, without a loading state, so webhook and sync
       * changes appear on their own (ADR-099 Decision 12). Skipped while a detail is open (its row
       * must not be replaced under it), while another read runs, or once the seller paged past
       * what one page can hold.
       */
      refreshInBackground: flow(function* () {
        if (!self.loaded || self.loading || self.loadingMore || self.refreshing) return;
        if (self.detail.key || self.rowApproveKey || self.rowDecidingKey) return;
        if (self.requests.length > MAX_PAGE_LIMIT) return;
        if (!self.queryable) return;
        const generation = listGeneration;
        self.refreshing = true;
        try {
          const input = buildInput(null);
          input.limit = Math.max(PAGE_LIMIT, self.requests.length);
          const result = yield client().query<{ page: GQL.EcomAfterSaleRequestPage }>({
            query: READ_AFTER_SALE_REQUESTS_QUERY,
            variables: { input },
            fetchPolicy: "network-only",
          });
          // A new query, an opened detail or a decision from the list supersedes this read.
          if (
            generation !== listGeneration ||
            self.detail.key ||
            self.rowApproveKey ||
            self.rowDecidingKey
          )
            return;
          const page = result.data.page;
          applySnapshot(self.requests, page.items.map(toRequestSnapshot));
          self.nextCursor = page.nextCursor ?? null;
          self.totalCount = page.totalCount;
          self.error = null;
        } catch (err) {
          if (generation === listGeneration) self.error = messageFromError(err);
          throw err;
        } finally {
          self.refreshing = false;
        }
      }),

      /**
       * Reads one page of an export walk. The rows are returned, never stored: the download holds
       * them only until its file is written, and they stay out of the Apollo cache.
       */
      readExportPage(input: GQL.EcomAfterSaleRequestsInput, signal: AbortSignal) {
        return client()
          .query<{ page: GQL.EcomAfterSaleRequestPage }>({
            query: READ_AFTER_SALE_REQUESTS_QUERY,
            variables: { input },
            fetchPolicy: "no-cache",
            context: { fetchOptions: { signal } },
          })
          .then((result) => {
            if (!result.data?.page) throw result.error ?? new Error("After-sale page returned no data");
            return result.data.page;
          });
      },

      fetchMore: flow(function* () {
        const cursor = self.nextCursor;
        if (!cursor || self.loading || self.loadingMore || self.refreshing) return;
        const generation = listGeneration;
        self.loadingMore = true;
        self.error = null;
        try {
          const result = yield client().query<{ page: GQL.EcomAfterSaleRequestPage }>({
            query: READ_AFTER_SALE_REQUESTS_QUERY,
            variables: { input: buildInput(cursor) },
            fetchPolicy: "network-only",
          });
          if (generation !== listGeneration) return;
          const page = result.data.page;
          const known = new Set(self.requests.map((request) => request.key));
          for (const dto of page.items) {
            const snapshot = toRequestSnapshot(dto);
            if (!known.has(snapshot.key)) self.requests.push(snapshot);
          }
          self.nextCursor = page.nextCursor ?? null;
          self.totalCount = page.totalCount;
        } catch (err) {
          if (generation === listGeneration) self.error = messageFromError(err);
          throw err;
        } finally {
          if (generation === listGeneration) self.loadingMore = false;
        }
      }),

      openDetail,
      beginReject,

      /** Opens a request straight on its reject form (TikTok requires a reason). */
      openDetailForReject(key: string) {
        const opened = openDetail(key);
        const reasons = beginReject();
        return Promise.all([opened, reasons]);
      },

      /** Asks the seller to confirm an approval started from the list. */
      beginRowApprove(key: string) {
        self.rowDecisionError = null;
        self.rowApproveKey = key;
      },

      cancelRowApprove() {
        self.rowApproveKey = null;
      },

      dismissRowDecisionError() {
        self.rowDecisionError = null;
      },

      /** Approves the confirmed request from the list, then settles it like a decision in the detail. */
      approveFromList: flow(function* () {
        const request = self.rowApproveRequest;
        const decision = request?.decision;
        self.rowApproveKey = null;
        if (!request || !decision || self.rowDecidingKey) return;
        const { key, shopId, kind, requestId } = request;
        self.rowDecidingKey = key;
        self.rowDecisionError = null;
        try {
          yield sendApproval(shopId, requestId, decision);
        } catch (err) {
          self.rowDecisionError = { requestId, message: messageFromError(err) };
          throw err;
        } finally {
          self.rowDecidingKey = null;
        }
        yield settleDecision(key, shopId, kind, requestId, "approved");
      }),

      retryOrder: flow(function* () {
        const request = self.selectedRequest;
        if (!request?.orderId) return;
        yield loadOrder(request.key, request.shopId, request.orderId);
      }),

      closeDetail() {
        resetDetail();
      },

      beginApprove() {
        self.detail.decisionError = null;
        self.detail.decisionMode = "confirmApprove";
      },

      cancelDecision() {
        reasonsGeneration += 1;
        self.detail.decisionMode = "none";
        self.detail.decisionError = null;
        self.detail.reasonsLoading = false;
      },

      setRejectReason(reasonId: string) {
        self.detail.rejectReasonDraft = reasonId;
      },

      setRejectComment(comment: string) {
        self.detail.rejectCommentDraft = comment;
      },

      approve: flow(function* () {
        const request = self.selectedRequest;
        const decision = request?.decision;
        if (!request || !decision || self.detail.deciding) return;
        const { key, shopId, kind, requestId } = request;
        self.detail.deciding = true;
        self.detail.decisionError = null;
        try {
          yield sendApproval(shopId, requestId, decision);
        } catch (err) {
          if (self.detail.key === key) self.detail.decisionError = messageFromError(err);
          throw err;
        } finally {
          if (self.detail.key === key) self.detail.deciding = false;
        }
        yield settleDecision(key, shopId, kind, requestId, "approved");
      }),

      /** `images` are primitive base64 snapshots taken by the caller; no File crosses into MST. */
      reject: flow(function* (images: readonly AfterSaleRejectImage[] = []) {
        const request = self.selectedRequest;
        const decision = request?.decision;
        const reasonId = self.detail.rejectReasonDraft;
        if (!request || !decision || !reasonId || self.detail.deciding) return;
        const { key, shopId, kind, requestId } = request;
        const comment = self.detail.rejectCommentDraft.trim() || undefined;
        self.detail.deciding = true;
        self.detail.decisionError = null;
        try {
          const headers = { "Content-Type": "application/json", "x-shop-id": shopId };
          if (decision.route === "cancellation") {
            yield fetchJson(clientPath(CLOUD_REST["ecommerce.rejectCancellation"]), {
              method: "POST",
              headers,
              body: JSON.stringify({
                cancelId: requestId,
                rejectReason: reasonId,
                comment,
                imagesBase64: images.length ? images : undefined,
              }),
            });
          } else {
            yield fetchJson(clientPath(CLOUD_REST["ecommerce.rejectReturn"]), {
              method: "POST",
              headers,
              body: JSON.stringify({
                returnId: requestId,
                decision: decision.rejectDecision,
                rejectReason: reasonId,
                comment,
                imagesBase64: images.length ? images : undefined,
              }),
            });
          }
        } catch (err) {
          if (self.detail.key === key) self.detail.decisionError = messageFromError(err);
          throw err;
        } finally {
          if (self.detail.key === key) self.detail.deciding = false;
        }
        yield settleDecision(key, shopId, kind, requestId, "rejected");
      }),
    };
  });
