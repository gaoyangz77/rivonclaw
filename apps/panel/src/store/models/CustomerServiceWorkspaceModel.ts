import { translationIdentity } from "../../lib/message-translation.js";
import { flow, getEnv, getRoot, types } from "mobx-state-tree";
import { GQL } from "@rivonclaw/core";
import { API, CLOUD_REST, clientPath } from "@rivonclaw/core/api-contract";
import { fetchJson, fetchVoid } from "../../api/client.js";
import { graphQLErrorCode } from "../../lib/graphql-error-code.js";
import {
  CS_DISMISS_CONVERSATION_ESCALATIONS_MUTATION,
  CS_DISMISS_ESCALATION_MUTATION,
  CS_END_CUSTOMER_SERVICE_SESSION_MUTATION,
  CS_ESCALATION_BY_ID_QUERY,
  CS_CONVERSATION_INBOX_COUNTS_QUERY,
  CS_CONVERSATION_INBOX_QUERY,
  CS_CONVERSATION_MESSAGES_QUERY,
  CS_CONVERSATION_ORDER_CONTEXT_QUERY,
  CS_CONVERSATION_ORDER_CANCELLATIONS_QUERY,
  CS_CONVERSATION_ORDER_IDS_QUERY,
  CS_COUPONS_QUERY,
  CS_CONVERSATION_PACKAGE_DETAIL_QUERY,
  CS_CONVERSATION_ORDER_TRACKING_QUERY,
  CS_CONVERSATION_RETURN_RECORDS_QUERY,
  CS_SEND_CARD_MUTATION,
  CS_SEND_COUPON_MUTATION,
  CS_SEND_MANUAL_TEXT_REPLY_MUTATION,
  CS_SET_CONVERSATION_AI_ENABLED_MUTATION,
  CS_START_CONVERSATION_FROM_ORDER_MUTATION,
  CS_TRANSLATE_MESSAGES_MUTATION,
} from "../../api/shops-queries.js";
import type { PanelStoreEnv } from "../types.js";

/** Inbox tabs. Categories overlap: an escalated conversation is also pending or resolved. */
export type ConversationCategory = "all" | "escalated" | "pending" | "resolved";
export interface ConversationCounts {
  all: number;
  escalated: number;
  pending: number;
  resolved: number;
}
export type ConversationAiFilter = "all" | "enabled" | "disabled";
export type ConversationBadReviewFilter = "all" | "hasBadReview";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export interface OrderCardSendInput {
  shopId: string;
  conversationId: string;
  orderId: string;
  type: GQL.EcomCustomerServiceCardType;
  /** Required for a logistics card: one card is sent per package. */
  packageIds?: readonly string[];
}

function orderCardKey(input: OrderCardSendInput): string {
  return `${input.shopId}:${input.conversationId}:${input.orderId}:${input.type}`;
}

export interface CouponSendInput {
  shopId: string;
  conversationId: string;
  couponId: string;
}

/** A shop's ongoing coupons as the backend returned them (plain data, never MST nodes). */
export interface ShopCouponList {
  coupons: GQL.CustomerServiceCoupon[];
  truncated: boolean;
}

function couponSendKey(input: CouponSendInput): string {
  return `${input.shopId}:${input.conversationId}:${input.couponId}`;
}

/** ADR-109: the backend accepts 1..50 messages and at most 6 read-only context messages per call. */
const TRANSLATION_BATCH_SIZE = 50;
const TRANSLATION_CONTEXT_SIZE = 6;
const TRANSLATION_MAX_TEXT_LENGTH = 4000;
/** Local failure code for errors the backend did not classify. */
export const MESSAGE_TRANSLATION_FAILED = "CS_MESSAGE_TRANSLATION_FAILED";

export interface MessageTranslation {
  sameLanguage: boolean;
  translatedText: string | null;
}

/** Panel UI language (`zh`, `en`, `zh-CN`, ...) as the backend's target language enum, or null when unsupported. */
function translationTargetLanguage(language: string): GQL.BadReviewMessageLanguage | null {
  const code = language.split(/[-_]/)[0].toUpperCase();
  return (Object.values(GQL.BadReviewMessageLanguage) as string[]).includes(code)
    ? (code as GQL.BadReviewMessageLanguage)
    : null;
}

/** Plain buyer / AI / human text: no summary, system notice, card, image or video. */
function isTranslatableMessage(message: Record<string, any>): boolean {
  if (message.isSummaryMessage || message.isSystemMessage) return false;
  if (!message.messageId) return false;
  if (String(message.type ?? "TEXT").toUpperCase() !== "TEXT") return false;
  const text = typeof message.text === "string" ? message.text.trim() : "";
  return text.length > 0 && text.length <= TRANSLATION_MAX_TEXT_LENGTH;
}

function translationInput(message: Record<string, any>) {
  return {
    messageId: String(message.messageId),
    senderRole: String(message.sender?.role ?? ""),
    text: String(message.text),
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed";
}

function emitCsTelemetry(eventType: string, metadata: Record<string, unknown>): void {
  fetchVoid(clientPath(API["telemetry.cs.track"]), {
    method: "POST",
    body: JSON.stringify({ eventType, metadata }),
  });
}

function conversationTelemetryContext(
  item: Partial<GQL.CustomerServiceConversationInboxItem> | null | undefined,
): Record<string, unknown> {
  return {
    shopId: item?.shopId ?? "",
    platformShopId: item?.platformShopId ?? "",
    conversationId: item?.conversationId ?? "",
    buyerUserId: item?.buyerUserId ?? "",
    orderId: item?.orderId ?? "",
    platform: "",
  };
}

function normalizedSearch(value: string): string {
  return value.trim().toLowerCase();
}

function matchesText(search: string, values: Array<string | number | null | undefined>): boolean {
  if (!search) return true;
  return values.some((value) =>
    String(value ?? "")
      .toLowerCase()
      .includes(search),
  );
}

function normalizedMessageText(message: Record<string, any>): string {
  return String(message.text ?? message.type ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isCustomerServiceMessage(message: Record<string, any>): boolean {
  return String(message.sender?.role ?? "").toUpperCase() === "CUSTOMER_SERVICE";
}

function isRoutineServiceMessage(
  message: Record<string, any>,
  seenServiceTexts: Set<string>,
): boolean {
  if (isCustomerServiceRichMessage(message)) return false;
  if (!isCustomerServiceMessage(message)) return false;
  const text = normalizedMessageText(message);
  if (!text) return false;
  if (seenServiceTexts.has(text)) return true;
  seenServiceTexts.add(text);
  return [
    "hi, this is",
    "thanks for supporting",
    "we'll get back to you",
    "view full details at: https://seller-us.tiktok.com/order/detail",
    "current order status:",
    "order payment amount:",
    "the chat has been assigned to",
  ].some((snippet) => text.includes(snippet));
}

function isCustomerServiceRichMessage(message: Record<string, any>): boolean {
  return [
    "IMAGE",
    "VIDEO",
    "PRODUCT_CARD",
    "ORDER_CARD",
    "LOGISTICS_CARD",
    "COUPON_CARD",
    "BUYER_ENTER_FROM_PRODUCT",
    "BUYER_ENTER_FROM_ORDER",
  ].includes(String(message.type ?? "").toUpperCase());
}

function isSideAlignedConversationMessage(message: Record<string, any>): boolean {
  const role = String(message.sender?.role ?? "").toUpperCase();
  return (
    isCustomerServiceRichMessage(message) ||
    role === "BUYER" ||
    role === "CUSTOMER_SERVICE" ||
    role === "ROBOT" ||
    role === "SHOP" ||
    role === "SELLER"
  );
}

function messageTimeKey(message: Record<string, any>): number {
  const raw = message.createTime;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
  }
  return Number.POSITIVE_INFINITY;
}

function compareOpaqueIndex(a: unknown, b: unknown): number {
  const left = String(a ?? "");
  const right = String(b ?? "");
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
    if (left.length !== right.length) return left.length - right.length;
    return left.localeCompare(right);
  }
  return left.localeCompare(right);
}

function sortMessagesChronologically(messages: Record<string, any>[]): Record<string, any>[] {
  return messages
    .map((message, originalIndex) => ({ message, originalIndex }))
    .sort(
      (a, b) =>
        messageTimeKey(a.message) - messageTimeKey(b.message) ||
        compareOpaqueIndex(a.message.index, b.message.index) ||
        Number(Boolean(a.message.isSummaryMessage)) - Number(Boolean(b.message.isSummaryMessage)) ||
        compareOpaqueIndex(a.message.messageId, b.message.messageId) ||
        a.originalIndex - b.originalIndex,
    )
    .map(({ message }) => message);
}

function summaryToMessage(
  summary: Record<string, any> | null | undefined,
): Record<string, any> | null {
  if (!summary?.summary) return null;
  return {
    messageId: `summary:${summary.updatedAt ?? summary.messageId ?? ""}`,
    type: "SUMMARY",
    text: summary.summary,
    createTime: summary.createTime ?? null,
    index: summary.messageIndex ?? null,
    sender: { role: "SYSTEM", nickname: "AI summary" },
    isSummaryMessage: true,
    summaryUpdatedAt: summary.updatedAt ?? null,
    summaryMessageCount: summary.messageCount ?? null,
  };
}

function statusForConversationCategory(
  category: ConversationCategory,
): GQL.CustomerServiceConversationStatus | undefined {
  if (category === "pending") return GQL.CustomerServiceConversationStatus.Pending;
  if (category === "resolved") return GQL.CustomerServiceConversationStatus.Resolved;
  return undefined;
}

function aiEnabledForFilter(filter: ConversationAiFilter): boolean | undefined {
  if (filter === "enabled") return true;
  if (filter === "disabled") return false;
  return undefined;
}

function escalationForConversationCategory(
  category: ConversationCategory,
): GQL.CustomerServiceConversationEscalationFilter | undefined {
  return category === "escalated"
    ? GQL.CustomerServiceConversationEscalationFilter.Open
    : undefined;
}

function readConversationChanged(raw: unknown): GQL.CustomerServiceConversation | null {
  const payload = raw as { conversation?: GQL.CustomerServiceConversation };
  return payload.conversation ?? null;
}

function conversationSnapshotToInboxItem(
  conversation: GQL.CustomerServiceConversation,
): GQL.CustomerServiceConversationInboxItem | null {
  if (!conversation.shopId || !conversation.replyStatus) return null;
  const buyer =
    conversation.participants?.find((participant) => participant?.role === "BUYER") ??
    conversation.participants?.find(Boolean);
  return {
    shopId: conversation.shopId,
    platformShopId: conversation.platformShopId ?? null,
    conversationId: conversation.conversationId,
    status: conversation.replyStatus,
    isOpen: conversation.isOpen ?? true,
    platformConversationStatus: conversation.platformConversationStatus ?? null,
    aiEnabled: conversation.aiEnabled ?? true,
    buyerUserId: buyer?.userId ?? null,
    buyerImUserId: buyer?.imUserId ?? null,
    buyerNickname: buyer?.nickname ?? null,
    orderId: conversation.orderId ?? null,
    latestMessageTime:
      conversation.latestMessageTime ?? conversation.latestMessage?.createTime ?? null,
    latestMessageId: conversation.latestMessage?.messageId ?? null,
    latestMessageIndex: conversation.latestMessage?.index ?? null,
    latestMessageType: conversation.latestMessage?.type ?? null,
    latestSenderRole: conversation.latestMessage?.sender?.role ?? null,
    latestMessagePreview:
      conversation.latestMessagePreview ?? conversation.latestMessage?.content ?? null,
    lastPendingAt: conversation.lastPendingAt ?? null,
    resolvedAt: conversation.resolvedAt ?? null,
    updatedAt: conversation.updatedAt ?? null,
    openEscalationCount: conversation.openEscalationCount ?? 0,
    latestOpenEscalationId: conversation.latestOpenEscalationId ?? null,
    latestOpenEscalationStatus: conversation.latestOpenEscalationStatus ?? null,
    latestOpenEscalationUpdatedAt: conversation.latestOpenEscalationUpdatedAt ?? null,
    recentBadReviews: conversation.recentBadReviews ?? [],
  };
}

export function conversationOrderDetailKey(
  kind: "tracking" | "packages" | "returnRecords" | "cancellations",
  shopId: string,
  orderId: string,
  returnId?: string,
): string {
  return [kind, shopId, orderId, returnId].filter(Boolean).join(":");
}

export const CustomerServiceWorkspaceModel = types
  .model("CustomerServiceWorkspace", {

    conversationShopId: types.optional(types.string, ""),
    conversationCategory: types.optional(
      types.enumeration<ConversationCategory>("ConversationCategory", [
        "all",
        "escalated",
        "pending",
        "resolved",
      ]),
      "all",
    ),
    /** Tab counts for the current shop/AI/review/search filters; null until first loaded. */
    conversationCounts: types.optional(types.maybeNull(types.frozen<ConversationCounts>()), null),
    conversationCountsError: types.maybeNull(types.string),
    conversationAiFilter: types.optional(
      types.enumeration<ConversationAiFilter>("ConversationAiFilter", [
        "all",
        "enabled",
        "disabled",
      ]),
      "all",
    ),
    conversationBadReviewFilter: types.optional(
      types.enumeration<ConversationBadReviewFilter>("ConversationBadReviewFilter", [
        "all",
        "hasBadReview",
      ]),
      "all",
    ),
    conversationSearchDraft: types.optional(types.string, ""),
    conversationSearch: types.optional(types.string, ""),
    conversationPage: types.optional(types.number, 1),
    conversationPageSize: types.optional(types.number, 50),
    conversationTotal: types.optional(types.number, 0),
    conversationsLoading: types.optional(types.boolean, false),
    conversationsError: types.maybeNull(types.string),
    conversationsErrorCode: types.maybeNull(types.string),
    conversationItems: types.optional(types.array(types.frozen<Record<string, any>>()), []),
    // Order-ID search hits whose buyer has no conversation yet (plain data, replaced per fetch).
    // They are listed like conversations; opening one creates the conversation first.
    ordersWithoutConversation: types.optional(types.array(types.frozen<Record<string, any>>()), []),
    // Orders whose conversation is being created, and the one the operator last asked to open
    // (cleared by any other selection so a late response cannot steal it back).
    startingOrderKeys: types.optional(types.array(types.string), []),
    /** `shopId:conversationId:orderId:cardType` of order/logistics cards being sent by a person. */
    sendingCardKeys: types.optional(types.array(types.string), []),
    /** `shopId:conversationId:couponId` of coupon cards being sent by a person. */
    sendingCouponKeys: types.optional(types.array(types.string), []),
    /** Ongoing coupons per shop id, loaded while the coupon picker is open. */
    shopCoupons: types.optional(types.map(types.frozen<ShopCouponList>()), {}),
    couponsLoadingShopIds: types.optional(types.array(types.string), []),
    couponsErrors: types.optional(types.map(types.string), {}),
    openingOrderKey: types.maybeNull(types.string),
    /** An order another page asked to show: its conversation opens when the search returns. */
    pendingFocusOrderId: types.maybeNull(types.string),
    startOrderErrors: types.optional(types.map(types.string), {}),
    selectedConversationId: types.maybeNull(types.string),
    conversationMessagesLoading: types.optional(types.boolean, false),
    conversationMessagesLoadingMore: types.optional(types.boolean, false),
    conversationMessagesError: types.maybeNull(types.string),
    conversationMessagesNextPageToken: types.maybeNull(types.string),
    conversationMessages: types.optional(types.array(types.frozen<Record<string, any>>()), []),
    updatingConversationAiIds: types.optional(types.array(types.string), []),
    startingConversationIds: types.optional(types.array(types.string), []),
    clearingConversationEscalationIds: types.optional(types.array(types.string), []),
    endingConversationSessionIds: types.optional(types.array(types.string), []),
    selectedConversationShopId: types.maybeNull(types.string),
    conversationListWidth: types.maybeNull(types.number),
    manualReplyDraft: types.optional(types.string, ""),
    sendingManualReply: types.optional(types.boolean, false),
    conversationSummary: types.maybeNull(types.frozen<Record<string, any>>()),
    conversationSummaryLoading: types.optional(types.boolean, false),
    conversationSummaryGenerating: types.optional(types.boolean, false),
    conversationSummaryError: types.maybeNull(types.string),
    conversationOrderContexts: types.optional(types.map(types.frozen<Record<string, any>>()), {}),
    conversationOrderIds: types.optional(types.map(types.frozen<string[]>()), {}),
    conversationOrderIdsLoadingKeys: types.optional(types.array(types.string), []),
    conversationOrderIdsErrors: types.optional(types.map(types.string), {}),
    expandedConversationOrderId: types.maybeNull(types.string),
    conversationOrderContextLoadingKeys: types.optional(types.array(types.string), []),
    conversationOrderContextErrors: types.optional(types.map(types.string), {}),
    /** Live per-order extras (logistics timeline, return negotiation history), keyed by `conversationOrderDetailKey`. */
    conversationOrderDetails: types.optional(types.map(types.frozen<Record<string, any>>()), {}),
    conversationOrderDetailLoadingKeys: types.optional(types.array(types.string), []),
    conversationOrderDetailErrors: types.optional(types.map(types.string), {}),

    /** The escalation open in the detail modal; always loaded from a conversation, never from a list. */
    selectedEscalation: types.maybeNull(types.frozen<Record<string, any>>()),
    escalationGuidance: types.optional(types.string, ""),
    escalationResolved: types.optional(types.boolean, true),
    respondingEscalation: types.optional(types.boolean, false),
    dismissingEscalation: types.optional(types.boolean, false),
    copiedMeta: types.maybeNull(types.string),

    /** ADR-109: translations of the selected conversation's loaded messages, by messageId. */
    messageTranslations: types.optional(types.map(types.frozen<MessageTranslation>()), {}),
    /** Panel language the entries in `messageTranslations` were made in. */
    messageTranslationLanguage: types.maybeNull(types.string),
    /** Per-conversation (`shopId:conversationId`) choice: true = translate, false = auto-translation turned off. */
    messageTranslationOverrides: types.optional(types.map(types.boolean), {}),
    /** Ids of messages with a translation request in flight. */
    pendingTranslationMessageIds: types.optional(types.array(types.string), []),
    messageTranslationErrorCode: types.maybeNull(types.string),
  })
  .views((self) => ({
    get pageSizeOptions() {
      return PAGE_SIZE_OPTIONS;
    },
    get filteredConversationItems() {
      // Backend search can match buyer orders absent from the conversation projection.
      return self.conversationItems.slice();
    },
    get orderDraftsOnPage(): Record<string, any>[] {
      // Order-search hits are not paginated; show them with the first page of results only.
      return self.conversationPage === 1 ? self.ordersWithoutConversation.slice() : [];
    },
    get selectedConversation() {
      return (
        self.conversationItems.find(
          (item) =>
            item.conversationId === self.selectedConversationId &&
            (!self.selectedConversationShopId || item.shopId === self.selectedConversationShopId),
        ) ?? null
      );
    },
    get selectedConversationOrderContext() {
      const selected = (self as any)
        .selectedConversation as GQL.CustomerServiceConversationInboxItem | null;
      const orderId = (self as any).selectedConversationExpandedOrderId as string | null;
      const key = selected && orderId ? `${selected.shopId}:${orderId}` : null;
      return key ? (self.conversationOrderContexts.get(key) ?? null) : null;
    },
    get selectedConversationOrderContextLoading() {
      const selected = (self as any)
        .selectedConversation as GQL.CustomerServiceConversationInboxItem | null;
      const orderId = (self as any).selectedConversationExpandedOrderId as string | null;
      const key = selected && orderId ? `${selected.shopId}:${orderId}` : null;
      return Boolean(key && self.conversationOrderContextLoadingKeys.includes(key));
    },
    get selectedConversationOrderContextError() {
      const selected = (self as any)
        .selectedConversation as GQL.CustomerServiceConversationInboxItem | null;
      const orderId = (self as any).selectedConversationExpandedOrderId as string | null;
      const key = selected && orderId ? `${selected.shopId}:${orderId}` : null;
      return key ? (self.conversationOrderContextErrors.get(key) ?? null) : null;
    },
    orderDetail(key: string) {
      return self.conversationOrderDetails.get(key) ?? null;
    },
    orderDetailLoading(key: string) {
      return self.conversationOrderDetailLoadingKeys.includes(key);
    },
    orderDetailError(key: string) {
      return self.conversationOrderDetailErrors.get(key) ?? null;
    },
    get selectedConversationOrderIds(): string[] {
      const selected = (self as any)
        .selectedConversation as GQL.CustomerServiceConversationInboxItem | null;
      if (!selected) return [];
      const ids =
        self.conversationOrderIds.get(`${selected.shopId}:${selected.conversationId}`) ?? [];
      return [...new Set([...ids, ...(selected.orderId ? [selected.orderId] : [])])];
    },
    get selectedConversationExpandedOrderId(): string | null {
      const ids = (self as any).selectedConversationOrderIds as string[];
      if (self.expandedConversationOrderId === "") return null;
      return self.expandedConversationOrderId && ids.includes(self.expandedConversationOrderId)
        ? self.expandedConversationOrderId
        : (ids[0] ?? null);
    },
    get selectedConversationOrderIdsLoading(): boolean {
      return self.conversationOrderIdsLoadingKeys.includes(
        `${self.selectedConversationShopId}:${self.selectedConversationId}`,
      );
    },
    get selectedConversationOrderIdsError(): string | null {
      return (
        self.conversationOrderIdsErrors.get(
          `${self.selectedConversationShopId}:${self.selectedConversationId}`,
        ) ?? null
      );
    },
    get displayConversationMessages() {
      const seenServiceTexts = new Set<string>();
      const summaryMessage = summaryToMessage(
        self.conversationSummary as Record<string, any> | null,
      );
      const loadedMessages = self.conversationMessages as unknown as Record<string, any>[];
      const messages = summaryMessage ? [...loadedMessages, summaryMessage] : loadedMessages;
      return sortMessagesChronologically(messages).map((message) => ({
        ...message,
        isRoutineServiceMessage: isRoutineServiceMessage(message, seenServiceTexts),
        isSystemMessage:
          Boolean(message.isSummaryMessage) || !isSideAlignedConversationMessage(message),
      }));
    },
    /** Loaded messages that can be translated, oldest first. */
    get translatableConversationMessages(): Record<string, any>[] {
      return (self as any).displayConversationMessages.filter(isTranslatableMessage);
    },
    get canLoadOlderConversationMessages() {
      return (
        Boolean(self.conversationMessagesNextPageToken) &&
        !self.conversationMessagesLoading &&
        !self.conversationMessagesLoadingMore
      );
    },
    get conversationPageCount() {
      return Math.max(1, Math.ceil(self.conversationTotal / self.conversationPageSize));
    },
    get conversationPageStart() {
      return self.conversationTotal === 0
        ? 0
        : (self.conversationPage - 1) * self.conversationPageSize + 1;
    },
    get conversationPageEnd() {
      return Math.min(
        self.conversationTotal,
        (self.conversationPage - 1) * self.conversationPageSize +
          (self as any).filteredConversationItems.length,
      );
    },
    isCardSending(input: OrderCardSendInput) {
      return self.sendingCardKeys.includes(orderCardKey(input));
    },
    isCouponSending(input: CouponSendInput) {
      return self.sendingCouponKeys.includes(couponSendKey(input));
    },
    isCouponsLoading(shopId: string) {
      return self.couponsLoadingShopIds.includes(shopId);
    },
    isOrderStarting(shopId: string, orderId: string) {
      return self.startingOrderKeys.includes(`${shopId}:${orderId}`);
    },
    startOrderError(shopId: string, orderId: string): string | null {
      return self.startOrderErrors.get(`${shopId}:${orderId}`) ?? null;
    },
    isConversationAiUpdating(conversationId: string) {
      return self.updatingConversationAiIds.includes(conversationId);
    },
    isConversationStarting(conversationId: string) {
      return self.startingConversationIds.includes(conversationId);
    },
    isConversationEscalationClearing(conversationId: string) {
      return self.clearingConversationEscalationIds.includes(conversationId);
    },
    isConversationSessionEnding(conversationId: string) {
      return self.endingConversationSessionIds.includes(conversationId);
    },
  }))
  .views((self) => ({
    /** ADR-109: whether the selected conversation shows translations (manual choice, else the shop's setting). */
    get messageTranslationActive(): boolean {
      const selected = (self as any)
        .selectedConversation as GQL.CustomerServiceConversationInboxItem | null;
      if (!selected) return false;
      const override = self.messageTranslationOverrides.get(
        `${selected.shopId}:${selected.conversationId}`,
      );
      if (override !== undefined) return override;
      const shop = (
        getRoot(self) as {
          shops?: ReadonlyArray<{
            id: string;
            services?: { customerService?: { messageAutoTranslation?: string | null } | null } | null;
          }>;
        }
      ).shops?.find((candidate) => candidate.id === selected.shopId);
      const level = shop?.services?.customerService?.messageAutoTranslation;
      return (
        level === GQL.CustomerServiceMessageAutoTranslation.All ||
        (level === GQL.CustomerServiceMessageAutoTranslation.Escalated &&
          selected.openEscalationCount > 0)
      );
    },
    get messageTranslationLoading(): boolean {
      return self.pendingTranslationMessageIds.length > 0;
    },
    /** The translation of a message made in `language`, or undefined. */
    messageTranslationFor(messageId: string, language: string): MessageTranslation | undefined {
      return self.messageTranslationLanguage === language
        ? self.messageTranslations.get(messageId)
        : undefined;
    },
  }))
  .actions((self) => {
    const client = () => getEnv<PanelStoreEnv>(self).apolloClient;
    /** Bumped whenever translation state is dropped, so an in-flight request can tell its result is stale. */
    let translationEpoch = 0;
    /** Bumped per counts request, so only the latest response is ingested. */
    let countsEpoch = 0;
    function clearMessageTranslations() {
      translationEpoch += 1;
      self.messageTranslations.clear();
      self.messageTranslationLanguage = null;
      self.pendingTranslationMessageIds.clear();
      self.messageTranslationErrorCode = null;
    }

    function pushUnique(list: string[], value: string) {
      if (!list.includes(value)) list.push(value);
    }

    function removeValue(list: string[], value: string) {
      const index = list.indexOf(value);
      if (index >= 0) list.splice(index, 1);
    }

    function resultGuidance(result: GQL.CsEscalation["result"]): string {
      if (!result) return "";
      const decision = result.decision?.trim() ?? "";
      const instructions = result.instructions?.trim() ?? "";
      if (!decision) return instructions;
      if (!instructions || instructions === decision) return decision;
      return `${decision}\n\n${instructions}`;
    }

    function setEscalationDraftFromSelection() {
      const selected = self.selectedEscalation as unknown as GQL.CsEscalation | null;
      if (!selected) {
        self.escalationGuidance = "";
        self.escalationResolved = true;
        return;
      }
      self.escalationGuidance = resultGuidance(selected.result);
      self.escalationResolved = selected.status !== GQL.CsEscalationStatus.InProgress;
    }

    const queryData = async (
      query: unknown,
      variables: Record<string, unknown>,
    ): Promise<any> =>
      (await client().query({ query: query as any, variables, fetchPolicy: "network-only" })).data;

    /** Loads one live order extra into `conversationOrderDetails`; only the key and variables cross the await. */
    const loadOrderDetail = flow(function* (
      key: string,
      request: () => Promise<any>,
      pick: (data: any) => Record<string, any>,
      force: boolean,
    ) {
      if (!force && self.conversationOrderDetails.has(key)) return;
      if (self.conversationOrderDetailLoadingKeys.includes(key)) return;
      pushUnique(self.conversationOrderDetailLoadingKeys, key);
      self.conversationOrderDetailErrors.delete(key);
      try {
        const data = yield request();
        self.conversationOrderDetails.set(key, pick(data));
      } catch (err) {
        self.conversationOrderDetailErrors.set(key, errorMessage(err));
      } finally {
        removeValue(self.conversationOrderDetailLoadingKeys, key);
      }
    });

    function clearSelection() {
      self.selectedConversationId = null;
      self.selectedConversationShopId = null;
      self.openingOrderKey = null;
      clearMessageTranslations();
    }
    /** Drops everything loaded for the previously selected conversation. */
    function resetSelectedThread() {
      self.expandedConversationOrderId = null;
      self.conversationMessages.replace([]);
      self.conversationMessagesError = null;
      self.conversationMessagesNextPageToken = null;
      self.conversationMessagesLoadingMore = false;
      self.manualReplyDraft = "";
      clearMessageTranslations();
      self.conversationSummary = null;
      self.conversationSummaryError = null;
      self.conversationSummaryLoading = false;
      self.conversationSummaryGenerating = false;
    }
    function replaceConversation(item: GQL.CustomerServiceConversationInboxItem) {
      const next = self.conversationItems.filter(
        (candidate) =>
          candidate.shopId !== item.shopId || candidate.conversationId !== item.conversationId,
      );
      next.unshift(item);
      self.conversationItems.replace(next as any);
    }

    function removeConversation(item: GQL.CustomerServiceConversationInboxItem) {
      self.conversationItems.replace(
        self.conversationItems.filter(
          (candidate) =>
            candidate.shopId !== item.shopId || candidate.conversationId !== item.conversationId,
        ) as any,
      );
    }

    function messageIdentity(message: Record<string, any>): string {
      return String(
        message.messageId ??
          `${message.createTime ?? ""}:${message.index ?? ""}:${message.text ?? ""}`,
      );
    }

    function mergeConversationMessages(
      existing: Record<string, any>[],
      incoming: Record<string, any>[],
    ): Record<string, any>[] {
      const byKey = new Map<string, Record<string, any>>();
      for (const message of existing) byKey.set(messageIdentity(message), message);
      for (const message of incoming) byKey.set(messageIdentity(message), message);
      return sortMessagesChronologically([...byKey.values()]);
    }

    function shouldShowConversation(item: GQL.CustomerServiceConversationInboxItem): boolean {
      const search = normalizedSearch(self.conversationSearch);
      if (!item.isOpen && !search) return false;
      if (self.conversationShopId && item.shopId !== self.conversationShopId) return false;
      const status = statusForConversationCategory(self.conversationCategory);
      if (status && item.status !== status) return false;
      const aiEnabled = aiEnabledForFilter(self.conversationAiFilter);
      if (aiEnabled != null && item.aiEnabled !== aiEnabled) return false;
      if (self.conversationCategory === "escalated" && !(item.openEscalationCount > 0))
        return false;
      if (self.conversationBadReviewFilter === "hasBadReview" && !item.recentBadReviews?.length)
        return false;
      const matchesExistingResult = !!search && self.conversationItems.some(
        (candidate) => candidate.shopId === item.shopId && candidate.conversationId === item.conversationId,
      );
      return matchesExistingResult || matchesText(search, [
        item.conversationId,
        item.buyerNickname,
        item.buyerUserId,
        item.buyerImUserId,
        item.orderId,
        item.latestMessagePreview,
        item.platformShopId,
      ]);
    }

    return {
      setConversationShopId(value: string) {
        self.conversationShopId = value;
        self.conversationPage = 1;
        clearSelection();
      },
      setConversationCategory(value: ConversationCategory) {
        self.conversationCategory = value;
        self.conversationPage = 1;
        clearSelection();
      },
      setConversationAiFilter(value: ConversationAiFilter) {
        self.conversationAiFilter = value;
        self.conversationPage = 1;
        clearSelection();
      },
      setConversationBadReviewFilter(value: ConversationBadReviewFilter) {
        self.conversationBadReviewFilter = value;
        self.conversationPage = 1;
        clearSelection();
      },
      setConversationSearchDraft(value: string) {
        self.conversationSearchDraft = value;
      },
      applyConversationSearch() {
        self.conversationSearch = self.conversationSearchDraft.trim();
        self.conversationPage = 1;
        self.ordersWithoutConversation.clear();
        self.openingOrderKey = null;
        self.startOrderErrors.clear();
      },
      clearConversationSearch() {
        self.conversationSearchDraft = "";
        self.conversationSearch = "";
        self.conversationPage = 1;
        self.ordersWithoutConversation.clear();
        self.openingOrderKey = null;
        self.startOrderErrors.clear();
      },
      setConversationPage(value: number) {
        self.conversationPage = Math.max(1, Math.min((self as any).conversationPageCount, value));
      },
      setConversationPageSize(value: number) {
        self.conversationPageSize = value;
        self.conversationPage = 1;
      },
      ingestConversationChanged(raw: unknown) {
        const snapshot = readConversationChanged(raw);
        const incoming = snapshot ? conversationSnapshotToInboxItem(snapshot) : null;
        if (!incoming) return;
        const existing = self.conversationItems.find(
          (candidate) =>
            candidate.shopId === incoming.shopId && candidate.conversationId === incoming.conversationId,
        );
        // Message events can omit the review enrichment supplied by the inbox query.
        const item = {
          ...incoming,
          recentBadReviews: snapshot?.recentBadReviews ?? existing?.recentBadReviews ?? [],
        };
        const existed = Boolean(existing);
        if (!shouldShowConversation(item)) {
          if (existed) {
            removeConversation(item);
            self.conversationTotal = Math.max(0, self.conversationTotal - 1);
          }
          if (
            self.selectedConversationId === item.conversationId &&
            self.selectedConversationShopId === item.shopId
          ) {
            self.selectedConversationId = null;
            self.selectedConversationShopId = null;
          }
          return;
        }
        replaceConversation(item);
        if (!existed) self.conversationTotal += 1;
      },
      /**
       * Shows an order from another page through the order search, which only reads: the buyer's
       * conversation opens if there is one, otherwise the order is listed as a draft row and no
       * conversation is created until an operator opens it.
       */
      focusConversationOrder(orderId: string) {
        self.conversationShopId = "";
        self.conversationCategory = "all";
        self.conversationAiFilter = "all";
        self.conversationBadReviewFilter = "all";
        self.conversationSearchDraft = orderId;
        self.conversationSearch = orderId;
        self.conversationPage = 1;
        self.ordersWithoutConversation.clear();
        self.openingOrderKey = null;
        self.startOrderErrors.clear();
        self.pendingFocusOrderId = orderId;
        void (self as any).fetchConversations();
      },
      /** Shows a conversation another page just opened, such as Start follow-up on a bad review. */
      showConversation(item: GQL.CustomerServiceConversationInboxItem) {
        const existed = self.conversationItems.some(
          (candidate) =>
            candidate.shopId === item.shopId && candidate.conversationId === item.conversationId,
        );
        replaceConversation(item);
        if (!existed) self.conversationTotal += 1;
        (self as any).selectConversation(item.shopId, item.conversationId);
      },
      selectConversation(shopId: string | null, conversationId?: string | null) {
        const nextConversationId = conversationId ?? null;
        self.openingOrderKey = null;
        if (
          self.selectedConversationId === nextConversationId &&
          self.selectedConversationShopId === shopId
        )
          return;
        self.selectedConversationShopId = shopId;
        self.selectedConversationId = nextConversationId;
        resetSelectedThread();
      },
      /** Flips translation for the selected conversation; the choice overrides the shop's setting. */
      toggleMessageTranslation() {
        const selected = (self as any)
          .selectedConversation as GQL.CustomerServiceConversationInboxItem | null;
        if (!selected) return;
        self.messageTranslationErrorCode = null;
        self.messageTranslationOverrides.set(
          `${selected.shopId}:${selected.conversationId}`,
          !(self as any).messageTranslationActive,
        );
      },
      /**
       * Translates the loaded messages of the selected conversation that have no translation yet
       * (ADR-109), in batches of at most 50, each with the preceding messages as read-only context.
       * Stops at the first failure and keeps its code in `messageTranslationErrorCode`.
       */
      translateLoadedMessages: flow(function* (language: string) {
        const selected = (self as any)
          .selectedConversation as GQL.CustomerServiceConversationInboxItem | null;
        if (!selected) return;
        if (self.messageTranslationLanguage !== language) {
          clearMessageTranslations();
          self.messageTranslationLanguage = language;
        }
        const targetLanguage = translationTargetLanguage(language);
        if (!targetLanguage) {
          self.messageTranslationErrorCode = MESSAGE_TRANSLATION_FAILED;
          return;
        }
        const loaded = (self as any).translatableConversationMessages as Record<string, any>[];
        const missing = loaded.filter(
          (message) =>
            !self.messageTranslations.has(message.messageId) &&
            !self.pendingTranslationMessageIds.includes(message.messageId),
        );
        if (missing.length === 0) return;
        self.messageTranslationErrorCode = null;
        const { shopId, conversationId } = selected;
        const epoch = translationEpoch;
        for (let start = 0; start < missing.length; start += TRANSLATION_BATCH_SIZE) {
          const batch = missing.slice(start, start + TRANSLATION_BATCH_SIZE);
          const firstIndex = loaded.indexOf(batch[0]);
          const context = loaded.slice(Math.max(0, firstIndex - TRANSLATION_CONTEXT_SIZE), firstIndex);
          const batchIds = batch.map((message) => message.messageId as string);
          self.pendingTranslationMessageIds.push(...batchIds);
          try {
            const result = yield client().mutate({
              mutation: CS_TRANSLATE_MESSAGES_MUTATION,
              variables: {
                input: {
                  shopId,
                  conversationId,
                  targetLanguage,
                  messages: batch.map(translationInput),
                  context: context.map(translationInput),
                },
              },
            });
            if (epoch !== translationEpoch) return;
            for (const item of (result.data?.translateCustomerServiceMessages ??
              []) as GQL.CustomerServiceMessageTranslation[]) {
              self.messageTranslations.set(item.messageId, {
                sameLanguage: item.sameLanguage,
                translatedText: item.translatedText ?? null,
              });
            }
          } catch (err) {
            if (epoch !== translationEpoch) return;
            self.messageTranslationErrorCode = graphQLErrorCode(err) ?? MESSAGE_TRANSLATION_FAILED;
            return;
          } finally {
            if (epoch === translationEpoch) {
              for (const id of batchIds) removeValue(self.pendingTranslationMessageIds as unknown as string[], id);
            }
          }
        }
      }),
      setConversationListWidth(value: number) {
        self.conversationListWidth = Math.max(240, Math.min(620, Math.round(value)));
      },
      setManualReplyDraft(value: string) {
        self.manualReplyDraft = value;
      },
      closeEscalationModal() {
        self.selectedEscalation = null;
        setEscalationDraftFromSelection();
      },
      openConversationEscalation: flow(function* (item: any) {
        const escalationId = item.latestOpenEscalationId;
        if (!escalationId) return null;
        const result = yield client().query({
          query: CS_ESCALATION_BY_ID_QUERY,
          variables: {
            filter: {
              shopIds: [item.shopId],
              statuses: [GQL.CsEscalationStatus.Pending, GQL.CsEscalationStatus.InProgress],
              search: escalationId,
              limit: 5,
              offset: 0,
            },
          },
          fetchPolicy: "network-only",
        });
        const page = result.data?.csOpenEscalationsPage as GQL.CsOpenEscalationPage | undefined;
        const escalation =
          page?.items?.find((candidate) => candidate.id === escalationId) ??
          page?.items?.[0] ??
          null;
        if (!escalation) return null;
        self.selectedEscalation = escalation as any;
        setEscalationDraftFromSelection();
        return true;
      }),
      setEscalationGuidance(value: string) {
        self.escalationGuidance = value;
      },
      setEscalationResolved(value: boolean) {
        self.escalationResolved = value;
      },
      setCopiedMeta(value: string | null) {
        self.copiedMeta = value;
      },
      fetchConversationCounts: flow(function* () {
        countsEpoch += 1;
        const epoch = countsEpoch;
        try {
          const result = yield client().query({
            query: CS_CONVERSATION_INBOX_COUNTS_QUERY,
            variables: {
              shopIds: self.conversationShopId ? [self.conversationShopId] : undefined,
              aiEnabled: aiEnabledForFilter(self.conversationAiFilter),
              hasBadReview: self.conversationBadReviewFilter === "hasBadReview" ? true : undefined,
              search: self.conversationSearch || undefined,
            },
            fetchPolicy: "network-only",
          });
          if (epoch !== countsEpoch) return;
          const counts = result.data?.ecommerceGetCustomerServiceInboxCounts as
            | GQL.CustomerServiceConversationInboxCounts
            | undefined;
          if (!counts) throw new Error("Inbox counts response was empty");
          self.conversationCounts = {
            all: counts.all,
            escalated: counts.escalated,
            pending: counts.pending,
            resolved: counts.resolved,
          };
          self.conversationCountsError = null;
        } catch (err) {
          if (epoch !== countsEpoch) return;
          // Keep the previous counts; the list itself is unaffected.
          self.conversationCountsError = errorMessage(err);
        }
      }),
      fetchConversations: flow(function* () {
        self.conversationsLoading = true;
        self.conversationsError = null;
        self.conversationsErrorCode = null;
        try {
          const request = client().query({
            query: CS_CONVERSATION_INBOX_QUERY,
            variables: {
              shopIds: self.conversationShopId ? [self.conversationShopId] : undefined,
              status: statusForConversationCategory(self.conversationCategory),
              aiEnabled: aiEnabledForFilter(self.conversationAiFilter),
              escalation: escalationForConversationCategory(self.conversationCategory),
              hasBadReview: self.conversationBadReviewFilter === "hasBadReview" ? true : undefined,
              search: self.conversationSearch || undefined,
              limit: self.conversationPageSize,
              offset: (self.conversationPage - 1) * self.conversationPageSize,
            },
            fetchPolicy: "network-only",
          });
          // Tab counts share the list's filters, so they refresh whenever the list does.
          void (self as any).fetchConversationCounts();
          const result = yield request;
          const page = result.data?.ecommerceGetCustomerServiceInbox as
            | GQL.CustomerServiceConversationInboxPage
            | undefined;
          self.conversationItems.replace((page?.items ?? []) as any);
          self.ordersWithoutConversation.replace((page?.ordersWithoutConversation ?? []) as any);
          self.conversationTotal = page?.totalCount ?? 0;
          if (self.pendingFocusOrderId && self.pendingFocusOrderId === self.conversationSearch) {
            const orderId = self.pendingFocusOrderId;
            self.pendingFocusOrderId = null;
            const items = (page?.items ?? []) as GQL.CustomerServiceConversationInboxItem[];
            const focused = items.find((item) => item.orderId === orderId) ?? items[0];
            (self as any).selectConversation(focused?.shopId ?? null, focused?.conversationId ?? null);
          }
          if (
            self.selectedConversationId &&
            !self.conversationItems.some(
              (item) =>
                item.conversationId === self.selectedConversationId &&
                (!self.selectedConversationShopId ||
                  item.shopId === self.selectedConversationShopId),
            )
          ) {
            self.selectedConversationId = null;
            self.selectedConversationShopId = null;
          }
        } catch (err) {
          self.conversationsError = errorMessage(err);
          self.conversationsErrorCode = graphQLErrorCode(err);
        } finally {
          self.conversationsLoading = false;
        }
      }),
      fetchConversationMessages: flow(function* (locale?: string) {
        const selected = (self as any)
          .selectedConversation as GQL.CustomerServiceConversationInboxItem | null;
        if (!selected) return;
        self.conversationMessagesLoading = true;
        self.conversationMessagesLoadingMore = false;
        self.conversationMessagesError = null;
        try {
          const result = yield client().query({
            query: CS_CONVERSATION_MESSAGES_QUERY,
            variables: {
              shopId: selected.shopId,
              conversationId: selected.conversationId,
              pageSize: 10,
              pageToken: undefined,
              locale,
            },
            fetchPolicy: "network-only",
          });
          const page = result.data?.ecommerceGetConversationMessages as
            | GQL.CustomerServiceMessageSummaryPage
            | undefined;
          self.conversationMessages.replace((page?.items ?? []) as any);
          self.conversationMessagesNextPageToken = page?.nextPageToken ?? null;
        } catch (err) {
          self.conversationMessagesError = errorMessage(err);
        } finally {
          self.conversationMessagesLoading = false;
        }
      }),
      /**
       * Live update for the open conversation: merges its newest page into what is loaded.
       * Older pages the operator scrolled back to, and the cursor for loading further back, stay
       * as they are, and no loading state is shown. Changes to other conversations are ignored.
       */
      refreshMessagesAfterConversationChanged: flow(function* (raw: unknown, locale?: string) {
        const changed = readConversationChanged(raw);
        const shopId = self.selectedConversationShopId;
        const conversationId = self.selectedConversationId;
        if (
          !changed ||
          !conversationId ||
          changed.conversationId !== conversationId ||
          (shopId && changed.shopId !== shopId) ||
          // The initial load already fetches the newest page.
          self.conversationMessagesLoading
        )
          return;
        try {
          const result = yield client().query({
            query: CS_CONVERSATION_MESSAGES_QUERY,
            variables: {
              shopId: changed.shopId ?? shopId,
              conversationId,
              pageSize: 10,
              pageToken: undefined,
              locale,
            },
            fetchPolicy: "network-only",
          });
          if (
            self.selectedConversationId !== conversationId ||
            self.selectedConversationShopId !== shopId ||
            self.conversationMessagesLoading
          )
            return;
          const page = result.data?.ecommerceGetConversationMessages as
            | GQL.CustomerServiceMessageSummaryPage
            | undefined;
          self.conversationMessages.replace(
            mergeConversationMessages(
              self.conversationMessages as unknown as Record<string, any>[],
              (page?.items ?? []) as Record<string, any>[],
            ) as any,
          );
        } catch (err) {
          if (self.selectedConversationId !== conversationId) return;
          self.conversationMessagesError = errorMessage(err);
        }
      }),
      toggleConversationOrder(orderId: string) {
        const ids = (self as any).selectedConversationOrderIds as string[];
        if (!ids.includes(orderId)) return;
        self.expandedConversationOrderId =
          (self as any).selectedConversationExpandedOrderId === orderId ? "" : orderId;
      },
      fetchSelectedConversationOrderIds: flow(function* () {
        const selected = (self as any)
          .selectedConversation as GQL.CustomerServiceConversationInboxItem | null;
        if (!selected) return;
        const { shopId, conversationId } = selected;
        const key = `${shopId}:${conversationId}`;
        if (self.conversationOrderIdsLoadingKeys.includes(key)) return;
        pushUnique(self.conversationOrderIdsLoadingKeys, key);
        self.conversationOrderIdsErrors.delete(key);
        try {
          const result = yield client().query({
            query: CS_CONVERSATION_ORDER_IDS_QUERY,
            variables: { shopId, conversationId },
            fetchPolicy: "network-only",
          });
          self.conversationOrderIds.set(key, result.data.ecommerceGetConversationOrderIds);
        } catch (err) {
          self.conversationOrderIdsErrors.set(key, errorMessage(err));
        } finally {
          removeValue(self.conversationOrderIdsLoadingKeys, key);
        }
      }),
      fetchSelectedConversationOrderContext: flow(function* (force = false) {
        const selected = (self as any)
          .selectedConversation as GQL.CustomerServiceConversationInboxItem | null;
        const orderId = (self as any).selectedConversationExpandedOrderId as string | null;
        if (!selected || !orderId) return null;
        const { shopId, buyerUserId } = selected;
        const key = `${shopId}:${orderId}`;
        if (!force && self.conversationOrderContexts.has(key)) {
          return self.conversationOrderContexts.get(key) ?? null;
        }
        if (self.conversationOrderContextLoadingKeys.includes(key)) return null;

        pushUnique(self.conversationOrderContextLoadingKeys, key);
        self.conversationOrderContextErrors.delete(key);
        try {
          const result = yield client().query({
            query: CS_CONVERSATION_ORDER_CONTEXT_QUERY,
            variables: {
              shopId,
              orderId,
              buyerUserId: buyerUserId ?? undefined,
            },
            fetchPolicy: "network-only",
          });
          const context = {
            orderId,
            order: (result.data?.order as GQL.EcomOrder | null | undefined) ?? null,
            returns: (result.data?.returns as GQL.EcomReturn[] | null | undefined) ?? [],
          };
          self.conversationOrderContexts.set(key, context as any);
          return context;
        } catch (err) {
          self.conversationOrderContextErrors.set(key, errorMessage(err));
          return null;
        } finally {
          removeValue(self.conversationOrderContextLoadingKeys, key);
        }
      }),
      fetchSelectedConversationOrderTracking: flow(function* (force = false) {
        const selected = (self as any)
          .selectedConversation as GQL.CustomerServiceConversationInboxItem | null;
        const orderId = (self as any).selectedConversationExpandedOrderId as string | null;
        if (!selected || !orderId) return;
        const { shopId, buyerUserId } = selected;
        yield loadOrderDetail(
          conversationOrderDetailKey("tracking", shopId, orderId),
          () => queryData(CS_CONVERSATION_ORDER_TRACKING_QUERY, { shopId, orderId, buyerUserId: buyerUserId ?? undefined }),
          (data) => data?.tracking ?? { events: [] },
          force,
        );
      }),
      fetchSelectedConversationOrderCancellations: flow(function* (force = false) {
        const selected = (self as any)
          .selectedConversation as GQL.CustomerServiceConversationInboxItem | null;
        const orderId = (self as any).selectedConversationExpandedOrderId as string | null;
        if (!selected || !orderId) return;
        const { shopId } = selected;
        yield loadOrderDetail(
          conversationOrderDetailKey("cancellations", shopId, orderId),
          () => queryData(CS_CONVERSATION_ORDER_CANCELLATIONS_QUERY, { shopId, orderId }),
          (data) => ({ cancellations: data?.cancellations ?? [] }),
          force,
        );
      }),
      fetchSelectedConversationOrderPackages: flow(function* (packageIds: string[], force = false) {
        const selected = (self as any)
          .selectedConversation as GQL.CustomerServiceConversationInboxItem | null;
        const orderId = (self as any).selectedConversationExpandedOrderId as string | null;
        if (!selected || !orderId) return;
        const { shopId, buyerUserId } = selected;
        const ids = [...new Set(packageIds)].slice(0, 5);
        yield loadOrderDetail(
          conversationOrderDetailKey("packages", shopId, orderId),
          async () => ({
            packages: (
              await Promise.all(
                ids.map(
                  async (packageId) =>
                    (
                      await queryData(CS_CONVERSATION_PACKAGE_DETAIL_QUERY, {
                        shopId,
                        packageId,
                        buyerUserId: buyerUserId ?? undefined,
                      })
                    )?.package,
                ),
              )
            ).filter(Boolean),
          }),
          (data) => ({ packages: data.packages }),
          force,
        );
      }),
      fetchSelectedConversationReturnRecords: flow(function* (returnId: string, force = false) {
        const selected = (self as any)
          .selectedConversation as GQL.CustomerServiceConversationInboxItem | null;
        const orderId = (self as any).selectedConversationExpandedOrderId as string | null;
        if (!selected || !orderId) return;
        const { shopId, buyerUserId } = selected;
        yield loadOrderDetail(
          conversationOrderDetailKey("returnRecords", shopId, orderId, returnId),
          () => queryData(CS_CONVERSATION_RETURN_RECORDS_QUERY, { shopId, returnId, buyerUserId: buyerUserId ?? undefined }),
          (data) => ({ records: data?.records ?? [] }),
          force,
        );
      }),
      fetchOlderConversationMessages: flow(function* (locale?: string) {
        const selected = (self as any)
          .selectedConversation as GQL.CustomerServiceConversationInboxItem | null;
        const pageToken = self.conversationMessagesNextPageToken;
        if (
          !selected ||
          !pageToken ||
          self.conversationMessagesLoading ||
          self.conversationMessagesLoadingMore
        )
          return false;
        self.conversationMessagesLoadingMore = true;
        self.conversationMessagesError = null;
        try {
          const result = yield client().query({
            query: CS_CONVERSATION_MESSAGES_QUERY,
            variables: {
              shopId: selected.shopId,
              conversationId: selected.conversationId,
              pageSize: 10,
              pageToken,
              locale,
            },
            fetchPolicy: "network-only",
          });
          const page = result.data?.ecommerceGetConversationMessages as
            | GQL.CustomerServiceMessageSummaryPage
            | undefined;
          self.conversationMessages.replace(
            mergeConversationMessages(
              self.conversationMessages as unknown as Record<string, any>[],
              (page?.items ?? []) as Record<string, any>[],
            ) as any,
          );
          self.conversationMessagesNextPageToken = page?.nextPageToken ?? null;
          return true;
        } catch (err) {
          self.conversationMessagesError = errorMessage(err);
          return false;
        } finally {
          self.conversationMessagesLoadingMore = false;
        }
      }),
      fetchConversationSummary: flow(function* () {
        const selected = (self as any)
          .selectedConversation as GQL.CustomerServiceConversationInboxItem | null;
        if (!selected) return null;
        const shopId = selected.shopId;
        const conversationId = selected.conversationId;
        self.conversationSummaryLoading = true;
        self.conversationSummaryError = null;
        try {
          const query = new URLSearchParams({ shopId, conversationId }).toString();
          const result = yield fetchJson<{ summary?: Record<string, any> | null }>(
            `${clientPath(API["csBridge.conversationSummary.get"])}?${query}`,
          );
          if (
            self.selectedConversationId === conversationId &&
            self.selectedConversationShopId === shopId
          ) {
            self.conversationSummary = result.summary ?? null;
          }
          return result.summary ?? null;
        } catch (err) {
          self.conversationSummaryError = errorMessage(err);
          return null;
        } finally {
          self.conversationSummaryLoading = false;
        }
      }),
      generateConversationSummary: flow(function* (locale?: string) {
        const selected = (self as any)
          .selectedConversation as GQL.CustomerServiceConversationInboxItem | null;
        if (!selected) return null;
        const shopId = selected.shopId;
        const conversationId = selected.conversationId;
        self.conversationSummaryGenerating = true;
        self.conversationSummaryError = null;
        try {
          const result = yield fetchJson<{ summary?: Record<string, any> | null }>(
            clientPath(API["csBridge.conversationSummary.create"]),
            {
              method: "POST",
              body: JSON.stringify({ shopId, conversationId, locale }),
            },
          );
          if (
            self.selectedConversationId === conversationId &&
            self.selectedConversationShopId === shopId
          ) {
            self.conversationSummary = result.summary ?? null;
          }
          return result.summary ?? null;
        } catch (err) {
          self.conversationSummaryError = errorMessage(err);
          throw err;
        } finally {
          self.conversationSummaryGenerating = false;
        }
      }),
      setConversationAiEnabled: flow(function* (item: any, aiEnabled: boolean) {
        const key = `${item.shopId}:${item.conversationId}`;
        pushUnique(self.updatingConversationAiIds as unknown as string[], item.conversationId);
        try {
          const result = yield client().mutate({
            mutation: CS_SET_CONVERSATION_AI_ENABLED_MUTATION,
            variables: {
              shopId: item.shopId,
              conversationId: item.conversationId,
              aiEnabled,
            },
          });
          const updated = result.data?.ecommerceSetCustomerServiceConversationAiEnabled as
            | GQL.CustomerServiceConversationInboxItem
            | undefined;
          if (updated) replaceConversation(updated);
        } finally {
          removeValue(self.updatingConversationAiIds as unknown as string[], item.conversationId);
        }
        return key;
      }),
      startConversationAiRun: flow(function* (item: any, operatorInstruction?: string) {
        pushUnique(self.startingConversationIds as unknown as string[], item.conversationId);
        try {
          const result = yield fetchJson<{ ok?: boolean; error?: string }>(
            clientPath(API["csBridge.startConversation"]),
            {
              method: "POST",
              body: JSON.stringify({
                shopId: item.shopId,
                conversationId: item.conversationId,
                buyerUserId: item.buyerUserId ?? item.buyerImUserId ?? undefined,
                orderId: item.orderId ?? undefined,
                operatorInstruction,
              }),
            },
          );
          if (result.ok === false)
            throw new Error(result.error ?? "Failed to start customer-service run");
          return result;
        } finally {
          removeValue(self.startingConversationIds as unknown as string[], item.conversationId);
        }
      }),
      /**
       * Opens an order-search hit that has no conversation: creates (or reopens) the platform
       * conversation, ingests it and, if the operator has not picked anything else meanwhile,
       * selects it so the page renders the normal conversation view. Does not start an AI run:
       * AI only takes over once the buyer replies. On failure the order stays listed with the
       * backend error.
       */
      openOrderDraft: flow(function* (shopId: string, orderId: string) {
        const key = `${shopId}:${orderId}`;
        self.openingOrderKey = key;
        // The detail pane shows its loading state instead of the previous conversation.
        self.selectedConversationId = null;
        self.selectedConversationShopId = null;
        resetSelectedThread();
        if (self.startingOrderKeys.includes(key)) return false;
        pushUnique(self.startingOrderKeys as unknown as string[], key);
        self.startOrderErrors.delete(key);
        try {
          const result = yield client().mutate({
            mutation: CS_START_CONVERSATION_FROM_ORDER_MUTATION,
            variables: { shopId, orderId },
          });
          const item = result.data?.ecommerceStartCustomerServiceConversationFromOrder as
            | GQL.CustomerServiceConversationInboxItem
            | undefined;
          if (!item) throw new Error("Failed to start the conversation");
          const existed = self.conversationItems.some(
            (candidate) =>
              candidate.shopId === item.shopId && candidate.conversationId === item.conversationId,
          );
          replaceConversation(item);
          if (!existed) self.conversationTotal += 1;
          self.ordersWithoutConversation.replace(
            self.ordersWithoutConversation.filter(
              (order) => order.shopId !== shopId || order.orderId !== orderId,
            ) as any,
          );
          if (self.openingOrderKey === key) {
            (self as any).selectConversation(item.shopId, item.conversationId);
          }
          return true;
        } catch (err) {
          self.startOrderErrors.set(key, errorMessage(err));
          if (self.openingOrderKey === key) self.openingOrderKey = null;
          return false;
        } finally {
          removeValue(self.startingOrderKeys as unknown as string[], key);
        }
      }),
      sendManualImageReply: flow(function* (input: {
        shopId: string; conversationId: string; file: File; idempotencyKey: string;
      }) {
        return yield fetchJson<{ ok: boolean; messageId?: string }>(
          clientPath(CLOUD_REST["ecommerce.csManualImageReply"]), {
            method: "POST",
            headers: {
              "Content-Type": input.file.type, "X-Shop-Id": input.shopId,
              "X-Conversation-Id": input.conversationId, "X-Idempotency-Key": input.idempotencyKey,
            },
            body: input.file,
          },
        );
      }),
      /**
       * Sends the buyer an order card, or one logistics card per package of the
       * order, from a person in the conversation. Each click gets its own
       * idempotency key, so a retried request cannot deliver a card twice.
       */
      sendOrderCard: flow(function* (input: OrderCardSendInput, locale?: string) {
        const key = orderCardKey(input);
        if (self.sendingCardKeys.includes(key)) return false;
        const cards =
          input.type === GQL.EcomCustomerServiceCardType.OrderCard
            ? [{ order_id: input.orderId }]
            : (input.packageIds ?? []).map((packageId) => ({
                order_id: input.orderId,
                package_id: packageId,
              }));
        if (cards.length === 0) throw new Error("This order has no package to send a logistics card for");
        pushUnique(self.sendingCardKeys as unknown as string[], key);
        const clickId = crypto.randomUUID();
        const telemetry = {
          shopId: input.shopId,
          conversationId: input.conversationId,
          orderId: input.orderId,
          action: "manual_card_send",
          source: "panel",
          cardType: input.type,
        };
        try {
          const startedAt = Date.now();
          const messageIds: string[] = [];
          for (const content of cards) {
            const result = yield client().mutate({
              mutation: CS_SEND_CARD_MUTATION,
              variables: {
                shopId: input.shopId,
                conversationId: input.conversationId,
                type: input.type,
                content: JSON.stringify(content),
                idempotencyKey: `human-cs-card:${clickId}:${"package_id" in content ? content.package_id : content.order_id}`,
              },
            });
            const messageId = result.data?.ecommerceSendCustomerServiceCard?.messageId;
            if (!messageId) throw new Error("TikTok did not confirm the card was sent");
            messageIds.push(messageId);
          }
          emitCsTelemetry("cs.session_event", {
            ...telemetry,
            outcome: "ok",
            cardCount: messageIds.length,
            durationMs: Date.now() - startedAt,
          });
          if (
            self.selectedConversationId === input.conversationId &&
            self.selectedConversationShopId === input.shopId
          ) {
            yield (self as any).fetchConversationMessages(locale);
          }
          return true;
        } catch (err) {
          emitCsTelemetry("cs.session_event", {
            ...telemetry,
            outcome: "failed",
            errorMessage: errorMessage(err),
          });
          throw err;
        } finally {
          removeValue(self.sendingCardKeys as unknown as string[], key);
        }
      }),
      /** Loads the shop's ongoing coupons for the picker; a loaded list is reused unless `force`. */
      fetchCoupons: flow(function* (shopId: string, force = false) {
        if (!force && self.shopCoupons.has(shopId)) return;
        if (self.couponsLoadingShopIds.includes(shopId)) return;
        pushUnique(self.couponsLoadingShopIds, shopId);
        self.couponsErrors.delete(shopId);
        try {
          const result = yield client().query({
            query: CS_COUPONS_QUERY,
            variables: { shopId },
            fetchPolicy: "network-only",
          });
          const list = result.data.ecommerceCustomerServiceCoupons as GQL.CustomerServiceCouponList;
          self.shopCoupons.set(shopId, { coupons: list.coupons, truncated: list.truncated });
        } catch (err) {
          self.couponsErrors.set(shopId, errorMessage(err));
        } finally {
          removeValue(self.couponsLoadingShopIds, shopId);
        }
      }),
      /** Drops the loaded list so the next picker session reads live coupon state. */
      discardCoupons(shopId: string) {
        self.shopCoupons.delete(shopId);
        self.couponsErrors.delete(shopId);
      },
      /**
       * Sends the buyer one of the shop's coupons as a coupon card from a person in the
       * conversation. Each click gets its own idempotency key, so a retried request cannot
       * deliver the card twice. The backend re-checks the coupon live and rejects it with
       * a readable error when it can no longer be sent.
       */
      sendCoupon: flow(function* (input: CouponSendInput, locale?: string) {
        const key = couponSendKey(input);
        if (self.sendingCouponKeys.includes(key)) return false;
        pushUnique(self.sendingCouponKeys as unknown as string[], key);
        const telemetry = {
          shopId: input.shopId,
          conversationId: input.conversationId,
          couponId: input.couponId,
          action: "manual_coupon_send",
          source: "panel",
        };
        try {
          const startedAt = Date.now();
          const result = yield client().mutate({
            mutation: CS_SEND_COUPON_MUTATION,
            variables: {
              shopId: input.shopId,
              conversationId: input.conversationId,
              couponId: input.couponId,
              idempotencyKey: `human-cs-coupon:${crypto.randomUUID()}`,
            },
          });
          const messageId = result.data?.ecommerceSendCustomerServiceCoupon?.messageId;
          if (!messageId) throw new Error("TikTok did not confirm the coupon was sent");
          emitCsTelemetry("cs.session_event", {
            ...telemetry,
            outcome: "ok",
            durationMs: Date.now() - startedAt,
          });
          if (
            self.selectedConversationId === input.conversationId &&
            self.selectedConversationShopId === input.shopId
          ) {
            yield (self as any).fetchConversationMessages(locale);
          }
          return true;
        } catch (err) {
          emitCsTelemetry("cs.session_event", {
            ...telemetry,
            outcome: "failed",
            errorMessage: errorMessage(err),
          });
          throw err;
        } finally {
          removeValue(self.sendingCouponKeys as unknown as string[], key);
        }
      }),
      sendManualReply: flow(function* (locale?: string, refresh = true, draft?: { message: string; original: string }) {
        if (self.sendingManualReply) return null;
        const selected = (self as any)
          .selectedConversation as GQL.CustomerServiceConversationInboxItem | null;
        const readIdentity = () => translationIdentity((getRoot(self) as { currentUser?: { userId: string; accountId?: string } | null }).currentUser);
        const identity = readIdentity();
        const original = draft?.original ?? self.manualReplyDraft;
        const message = (draft?.message ?? original).trim();
        if (!selected || !message || self.manualReplyDraft !== original) return null;
        self.sendingManualReply = true;
        try {
          const startedAt = Date.now();
          const result = yield client().mutate({
            mutation: CS_SEND_MANUAL_TEXT_REPLY_MUTATION,
            variables: {
              shopId: selected.shopId,
              conversationId: selected.conversationId,
              message,
            },
          });
          const messageId = result.data?.ecommerceSendCustomerServiceTextReply?.messageId;
          const sameIdentity = readIdentity() === identity;
          if (sameIdentity && messageId && self.selectedConversationId === selected.conversationId &&
            self.selectedConversationShopId === selected.shopId && self.manualReplyDraft === original) {
            self.manualReplyDraft = "";
          }
          if (refresh && sameIdentity) {
            yield (self as any).fetchConversationMessages(locale);
            yield (self as any).fetchConversations();
          }
          emitCsTelemetry("cs.session_event", {
            ...conversationTelemetryContext(selected),
            action: "manual_reply_send",
            source: "panel",
            outcome: messageId ? "ok" : "empty",
            messageId: messageId ?? "",
            durationMs: Date.now() - startedAt,
            textLength: message.length,
          });
          if (messageId) {
            emitCsTelemetry("cs.message", {
              ...conversationTelemetryContext(selected),
              buyerUserId: selected.buyerUserId ?? selected.buyerImUserId ?? "",
              direction: "outbound",
              messageId,
              contentLength: message.length,
              runId: "",
              source: "manual_panel_reply",
            });
          }
          return Boolean(messageId);
        } catch (err) {
          emitCsTelemetry("cs.session_event", {
            ...conversationTelemetryContext(selected),
            action: "manual_reply_send",
            source: "panel",
            outcome: "failed",
            textLength: message.length,
            errorMessage: errorMessage(err),
          });
          throw err;
        } finally {
          self.sendingManualReply = false;
        }
      }),
      endConversationSession: flow(function* (item: any) {
        const key = item.conversationId;
        pushUnique(self.endingConversationSessionIds as unknown as string[], key);
        try {
          const startedAt = Date.now();
          const result = yield client().mutate({
            mutation: CS_END_CUSTOMER_SERVICE_SESSION_MUTATION,
            variables: {
              shopId: item.shopId,
              conversationId: item.conversationId,
            },
          });
          if (!result.data?.csEndCustomerServiceSession) return false;
          emitCsTelemetry("cs.session_event", {
            ...conversationTelemetryContext(item),
            action: "end_session",
            source: "panel",
            outcome: "ok",
            durationMs: Date.now() - startedAt,
          });
          removeConversation(item);
          self.conversationTotal = Math.max(0, self.conversationTotal - 1);
          if (
            self.selectedConversationId === item.conversationId &&
            self.selectedConversationShopId === item.shopId
          ) {
            self.selectedConversationId = null;
            self.selectedConversationShopId = null;
            self.conversationMessages.replace([]);
            self.conversationMessagesNextPageToken = null;
            self.conversationSummary = null;
            self.manualReplyDraft = "";
          }
          return true;
        } catch (err) {
          emitCsTelemetry("cs.session_event", {
            ...conversationTelemetryContext(item),
            action: "end_session",
            source: "panel",
            outcome: "failed",
            errorMessage: errorMessage(err),
          });
          throw err;
        } finally {
          removeValue(self.endingConversationSessionIds as unknown as string[], key);
        }
      }),
      dismissConversationEscalations: flow(function* (item: any) {
        pushUnique(
          self.clearingConversationEscalationIds as unknown as string[],
          item.conversationId,
        );
        try {
          const startedAt = Date.now();
          const result = yield client().mutate({
            mutation: CS_DISMISS_CONVERSATION_ESCALATIONS_MUTATION,
            variables: {
              shopId: item.shopId,
              conversationId: item.conversationId,
            },
          });
          const updated = result.data?.csDismissConversationEscalations as
            | GQL.CustomerServiceConversationInboxItem
            | undefined;
          if (updated) replaceConversation(updated);
          emitCsTelemetry("cs.escalation_event", {
            ...conversationTelemetryContext(item),
            escalationId: item.latestOpenEscalationId ?? "",
            action: "dismiss_conversation",
            source: "panel",
            outcome: "ok",
            status: updated?.latestOpenEscalationStatus ?? "",
            count: Number(item.openEscalationCount ?? 0),
            durationMs: Date.now() - startedAt,
          });
          const selected = self.selectedEscalation as unknown as GQL.CsEscalation | null;
          if (
            selected &&
            selected.shopId === item.shopId &&
            selected.conversationId === item.conversationId
          ) {
            self.selectedEscalation = null;
            setEscalationDraftFromSelection();
          }
          return true;
        } catch (err) {
          emitCsTelemetry("cs.escalation_event", {
            ...conversationTelemetryContext(item),
            escalationId: item.latestOpenEscalationId ?? "",
            action: "dismiss_conversation",
            source: "panel",
            outcome: "failed",
            count: Number(item.openEscalationCount ?? 0),
            errorMessage: errorMessage(err),
          });
          throw err;
        } finally {
          removeValue(
            self.clearingConversationEscalationIds as unknown as string[],
            item.conversationId,
          );
        }
      }),
      respondToSelectedEscalation: flow(function* () {
        const selected = self.selectedEscalation as unknown as GQL.CsEscalation | null;
        const guidance = self.escalationGuidance.trim();
        if (!selected || !guidance) return null;
        self.respondingEscalation = true;
        try {
          const startedAt = Date.now();
          const result = yield fetchJson<{
            ok: boolean;
            escalationId?: string | null;
            status?: GQL.CsEscalationStatus | null;
            version?: number | null;
            error?: string | null;
          }>(clientPath(API["csBridge.escalationResult"]), {
            method: "POST",
            body: JSON.stringify({
              escalationId: selected.id,
              decision: guidance,
              instructions: "",
              resolved: self.escalationResolved,
            }),
          });
          if (!result.ok) throw new Error(result.error ?? "Escalation response failed");
          emitCsTelemetry("cs.escalation_event", {
            shopId: selected.shopId,
            conversationId: selected.conversationId,
            buyerUserId: selected.buyerUserId ?? "",
            orderId: selected.orderId ?? "",
            escalationId: selected.id,
            action: self.escalationResolved ? "respond_resolve" : "respond_update",
            source: "panel",
            outcome: "ok",
            status: result.status ?? "",
            resolved: self.escalationResolved,
            version: result.version ?? 0,
            durationMs: Date.now() - startedAt,
          });
          if (self.escalationResolved) {
            self.selectedEscalation = null;
            setEscalationDraftFromSelection();
          }
          return result;
        } catch (err) {
          emitCsTelemetry("cs.escalation_event", {
            shopId: selected.shopId,
            conversationId: selected.conversationId,
            buyerUserId: selected.buyerUserId ?? "",
            orderId: selected.orderId ?? "",
            escalationId: selected.id,
            action: self.escalationResolved ? "respond_resolve" : "respond_update",
            source: "panel",
            outcome: "failed",
            resolved: self.escalationResolved,
            errorMessage: errorMessage(err),
          });
          throw err;
        } finally {
          self.respondingEscalation = false;
        }
      }),
      dismissSelectedEscalation: flow(function* () {
        const selected = self.selectedEscalation as unknown as GQL.CsEscalation | null;
        if (!selected) return null;
        self.dismissingEscalation = true;
        try {
          const startedAt = Date.now();
          const result = yield client().mutate({
            mutation: CS_DISMISS_ESCALATION_MUTATION,
            variables: { escalationId: selected.id },
          });
          const payload = result.data?.csDismissEscalation as
            | {
                ok?: boolean;
                error?: string | null;
              }
            | undefined;
          if (!payload?.ok) throw new Error(payload?.error ?? "Escalation dismiss failed");
          emitCsTelemetry("cs.escalation_event", {
            shopId: selected.shopId,
            conversationId: selected.conversationId,
            buyerUserId: selected.buyerUserId ?? "",
            orderId: selected.orderId ?? "",
            escalationId: selected.id,
            action: "dismiss",
            source: "panel",
            outcome: "ok",
            durationMs: Date.now() - startedAt,
          });
          self.selectedEscalation = null;
          setEscalationDraftFromSelection();
          yield (self as any).fetchConversations();
          return true;
        } catch (err) {
          emitCsTelemetry("cs.escalation_event", {
            shopId: selected.shopId,
            conversationId: selected.conversationId,
            buyerUserId: selected.buyerUserId ?? "",
            orderId: selected.orderId ?? "",
            escalationId: selected.id,
            action: "dismiss",
            source: "panel",
            outcome: "failed",
            errorMessage: errorMessage(err),
          });
          throw err;
        } finally {
          self.dismissingEscalation = false;
        }
      }),
    };
  });
