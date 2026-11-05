import { applySnapshot, flow, getEnv, types, type Instance } from "mobx-state-tree";
import { GQL } from "@rivonclaw/core";
import { CLOUD_REST, clientPath } from "@rivonclaw/core/api-contract";
import { fetchJson } from "../../api/client.js";
import {
  APPROVE_AFTER_SALE_CANCELLATION_MUTATION,
  APPROVE_AFTER_SALE_REFUND_MUTATION,
  APPROVE_AFTER_SALE_RETURN_MUTATION,
  READ_AFTER_SALE_REJECT_REASONS_QUERY,
  READ_AFTER_SALE_REQUEST_QUERY,
  READ_AFTER_SALE_REQUESTS_QUERY,
  READ_AFTER_SALE_RETURN_RECORDS_QUERY,
} from "../../api/after-sale-queries.js";
import {
  afterSaleKey,
  needsSellerReview,
  resolveAfterSaleDecision,
  type AfterSaleKind,
  type AfterSaleRejectImage,
} from "../../lib/after-sale.js";
import type { PanelStoreEnv } from "../types.js";

const MS_PER_DAY = 86_400_000;
/** Longest created-at window the backend's ALL view accepts. */
export const AFTER_SALE_MAX_WINDOW_DAYS = 92;
const DEFAULT_WINDOW_DAYS = 30;

const AfterSaleLineModel = types.model("AfterSaleRequestLine", {
  lineItemId: types.string,
  orderLineItemId: types.maybeNull(types.string),
  productId: types.maybeNull(types.string),
  productName: types.maybeNull(types.string),
  skuId: types.maybeNull(types.string),
  skuName: types.maybeNull(types.string),
  sellerSku: types.maybeNull(types.string),
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
  })
  .views((self) => ({
    get needsReview() {
      return needsSellerReview(self);
    },
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
      currency: line.currency ?? null,
      refundTotal: line.refundTotal ?? null,
    })),
  };
}

/** One return-records entry, kept as a plain frozen snapshot (signed evidence URLs expire). */
export type AfterSaleRecord = Pick<
  GQL.EcomReturnRecord,
  "event" | "role" | "description" | "reasonText" | "note" | "createTime" | "images" | "videos"
>;

export type AfterSaleRejectReason = Pick<GQL.EcomRejectReason, "reasonId" | "reasonText">;

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
    requests: types.optional(types.array(AfterSaleRequestModel), []),
    nextCursor: types.maybeNull(types.string),
    totalCount: types.optional(types.number, 0),
    loaded: types.optional(types.boolean, false),
    loading: types.optional(types.boolean, false),
    loadingMore: types.optional(types.boolean, false),
    error: types.maybeNull(types.string),
    notice: types.maybeNull(types.frozen<AfterSaleNotice>()),
    detail: types.optional(AfterSaleDetailModel, {}),
  })
  .views((self) => ({
    /** Everything that changes the query, as one primitive for effect dependencies. */
    get querySignature() {
      return JSON.stringify([
        self.view,
        self.allShops ? null : [...self.shopIds],
        self.view === "ALL"
          ? [
              [...self.kinds],
              [...self.statuses],
              [...self.sellerActions],
              self.windowFrom,
              self.windowTo,
            ]
          : null,
      ]);
    },
    /** Why the ALL window cannot be queried, if it cannot. */
    get windowIssue(): "missing" | "reversed" | "tooLong" | null {
      if (self.view !== "ALL") return null;
      if (!self.windowFrom || !self.windowTo) return "missing";
      const days = Math.round(
        (startOfLocalDay(self.windowTo).getTime() - startOfLocalDay(self.windowFrom).getTime()) /
          MS_PER_DAY,
      );
      if (days < 0) return "reversed";
      return days + 1 > AFTER_SALE_MAX_WINDOW_DAYS ? "tooLong" : null;
    },
    get selectedRequest() {
      const key = self.detail.key;
      return key ? (self.requests.find((request) => request.key === key) ?? null) : null;
    },
    get hasMore() {
      return self.nextCursor != null;
    },
  }))
  .actions((self) => {
    const client = () => getEnv<PanelStoreEnv>(self).apolloClient;
    // Responses of superseded queries are dropped; only the newest generation may write state.
    let listGeneration = 0;
    let recordsGeneration = 0;
    let reasonsGeneration = 0;

    function messageFromError(err: unknown) {
      return err instanceof Error ? err.message : "Request failed";
    }

    function buildInput(cursor: string | null): GQL.EcomAfterSaleRequestsInput {
      const input: GQL.EcomAfterSaleRequestsInput = { view: self.view };
      if (!self.allShops) input.shopIds = [...self.shopIds];
      if (cursor) input.cursor = cursor;
      if (self.view === "ALL") {
        if (self.kinds.length) input.kinds = [...self.kinds] as AfterSaleKind[];
        if (self.statuses.length) input.statuses = [...self.statuses];
        if (self.sellerActions.length) input.sellerActions = [...self.sellerActions];
        const to = startOfLocalDay(self.windowTo);
        to.setDate(to.getDate() + 1);
        input.createdFrom = startOfLocalDay(self.windowFrom).toISOString();
        input.createdTo = to.toISOString();
      }
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
      applySnapshot(self.detail, {});
    }

    const fetchRequests = flow(function* () {
      const generation = ++listGeneration;
      self.loading = true;
      self.loadingMore = false;
      self.error = null;
      try {
        if (self.windowIssue || (!self.allShops && self.shopIds.length === 0)) {
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
        // The decision succeeded but the warehouse has no row yet: show the authoritative list.
        yield fetchRequests();
        return;
      }
      const snapshot = toRequestSnapshot(fresh);
      if (self.view === "TO_REVIEW" && !needsSellerReview(snapshot)) {
        self.requests.remove(current);
        self.totalCount = Math.max(0, self.totalCount - 1);
        return;
      }
      current.replaceWith(snapshot);
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
        self.error = null;
        self.notice = null;
      },

      fetchMore: flow(function* () {
        const cursor = self.nextCursor;
        if (!cursor || self.loading || self.loadingMore) return;
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

      openDetail: flow(function* (key: string) {
        const request = self.requests.find((row) => row.key === key);
        if (!request) return;
        resetDetail();
        self.detail.key = key;
        // Cancellations have no records API; the request itself is the whole detail.
        if (request.kind === GQL.EcomAfterSaleRequestKind.Cancellation) return;
        const { shopId, requestId } = request;
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

      /** Opens the reject form and loads the reasons TikTok allows for this request. */
      beginReject: flow(function* () {
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
      }),

      approve: flow(function* () {
        const request = self.selectedRequest;
        const decision = request?.decision;
        if (!request || !decision || self.detail.deciding) return;
        const { key, shopId, kind, requestId } = request;
        self.detail.deciding = true;
        self.detail.decisionError = null;
        try {
          if (decision.route === "refund") {
            yield client().mutate({
              mutation: APPROVE_AFTER_SALE_REFUND_MUTATION,
              variables: { shopId, returnId: requestId },
            });
          } else if (decision.route === "return") {
            yield client().mutate({
              mutation: APPROVE_AFTER_SALE_RETURN_MUTATION,
              variables: { shopId, returnId: requestId, decision: decision.approveDecision },
            });
          } else {
            yield client().mutate({
              mutation: APPROVE_AFTER_SALE_CANCELLATION_MUTATION,
              variables: { shopId, cancelId: requestId },
            });
          }
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
