import { flow, getEnv, types } from "mobx-state-tree";
import { GQL } from "@rivonclaw/core";
import { API, clientPath } from "@rivonclaw/core/api-contract";
import { fetchJson } from "../../api/client.js";
import {
  CS_CONVERSATION_INBOX_QUERY,
  CS_CONVERSATION_MESSAGES_QUERY,
  CS_OPEN_ESCALATIONS_QUERY,
  CS_SET_CONVERSATION_AI_ENABLED_MUTATION,
} from "../../api/shops-queries.js";
import type { PanelStoreEnv } from "../types.js";

export type CustomerServiceWorkspaceTab = "conversations" | "escalations";
export type ConversationStatusFilter = "pending" | "resolved" | "all";
export type ConversationAiFilter = "all" | "enabled" | "disabled";
export type EscalationStatusFilter = "open" | "pending" | "inProgress" | "resolved" | "closed" | "all";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed";
}

function normalizedSearch(value: string): string {
  return value.trim().toLowerCase();
}

function matchesText(search: string, values: Array<string | number | null | undefined>): boolean {
  if (!search) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(search));
}

function normalizedMessageText(message: Record<string, any>): string {
  return String(message.text ?? message.type ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isBuyerMessage(message: Record<string, any>): boolean {
  return String(message.sender?.role ?? "").toUpperCase() === "BUYER";
}

function isRoutineServiceMessage(message: Record<string, any>, seenServiceTexts: Set<string>): boolean {
  if (isBuyerMessage(message)) return false;
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
    .sort((a, b) => (
      messageTimeKey(a.message) - messageTimeKey(b.message) ||
      compareOpaqueIndex(a.message.index, b.message.index) ||
      compareOpaqueIndex(a.message.messageId, b.message.messageId) ||
      a.originalIndex - b.originalIndex
    ))
    .map(({ message }) => message);
}

function sortEscalations(items: GQL.CsEscalation[]): GQL.CsEscalation[] {
  return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function statusesForEscalationFilter(filter: EscalationStatusFilter): GQL.CsEscalationStatus[] {
  switch (filter) {
    case "pending":
      return [GQL.CsEscalationStatus.Pending];
    case "inProgress":
      return [GQL.CsEscalationStatus.InProgress];
    case "resolved":
      return [GQL.CsEscalationStatus.Resolved];
    case "closed":
      return [GQL.CsEscalationStatus.Closed];
    case "all":
      return [
        GQL.CsEscalationStatus.Pending,
        GQL.CsEscalationStatus.InProgress,
        GQL.CsEscalationStatus.Resolved,
        GQL.CsEscalationStatus.Closed,
      ];
    case "open":
    default:
      return [GQL.CsEscalationStatus.Pending, GQL.CsEscalationStatus.InProgress];
  }
}

function statusForConversationFilter(filter: ConversationStatusFilter): GQL.CustomerServiceConversationStatus | undefined {
  if (filter === "pending") return GQL.CustomerServiceConversationStatus.Pending;
  if (filter === "resolved") return GQL.CustomerServiceConversationStatus.Resolved;
  return undefined;
}

function aiEnabledForFilter(filter: ConversationAiFilter): boolean | undefined {
  if (filter === "enabled") return true;
  if (filter === "disabled") return false;
  return undefined;
}

function readEscalation(raw: unknown): GQL.CsEscalation | null {
  const payload = raw as { delivery?: { escalation?: GQL.CsEscalation } };
  return payload.delivery?.escalation ?? null;
}

function readConversationChanged(raw: unknown): GQL.CustomerServiceConversation | null {
  const payload = raw as { conversation?: GQL.CustomerServiceConversation };
  return payload.conversation ?? null;
}

function conversationSnapshotToInboxItem(
  conversation: GQL.CustomerServiceConversation,
): GQL.CustomerServiceConversationInboxItem | null {
  if (!conversation.shopId || !conversation.replyStatus) return null;
  const buyer = conversation.participants?.find((participant) => participant?.role === "BUYER")
    ?? conversation.participants?.find(Boolean);
  return {
    shopId: conversation.shopId,
    platformShopId: conversation.platformShopId ?? null,
    conversationId: conversation.conversationId,
    status: conversation.replyStatus,
    isOpen: conversation.isOpen ?? true,
    platformConversationStatus: conversation.platformConversationStatus ?? conversation.status ?? null,
    aiEnabled: conversation.aiEnabled ?? true,
    buyerUserId: buyer?.userId ?? null,
    buyerImUserId: buyer?.imUserId ?? null,
    buyerNickname: buyer?.nickname ?? null,
    orderId: conversation.orderId ?? null,
    latestMessageTime: conversation.latestMessageTime ?? conversation.latestMessage?.createTime ?? null,
    latestMessageId: conversation.latestMessage?.messageId ?? null,
    latestMessageIndex: conversation.latestMessage?.index ?? null,
    latestMessageType: conversation.latestMessage?.type ?? null,
    latestSenderRole: conversation.latestMessage?.sender?.role ?? null,
    latestMessagePreview: conversation.latestMessagePreview ?? conversation.latestMessage?.content ?? null,
    lastPendingAt: conversation.lastPendingAt ?? null,
    resolvedAt: conversation.resolvedAt ?? null,
    updatedAt: conversation.updatedAt ?? null,
  };
}

export const CustomerServiceWorkspaceModel = types
  .model("CustomerServiceWorkspace", {
    activeTab: types.optional(types.enumeration<CustomerServiceWorkspaceTab>("CustomerServiceWorkspaceTab", ["conversations", "escalations"]), "conversations"),

    conversationShopId: types.optional(types.string, ""),
    conversationStatusFilter: types.optional(types.enumeration<ConversationStatusFilter>("ConversationStatusFilter", ["pending", "resolved", "all"]), "all"),
    conversationAiFilter: types.optional(types.enumeration<ConversationAiFilter>("ConversationAiFilter", ["all", "enabled", "disabled"]), "all"),
    conversationSearchDraft: types.optional(types.string, ""),
    conversationSearch: types.optional(types.string, ""),
    conversationPage: types.optional(types.number, 1),
    conversationPageSize: types.optional(types.number, 50),
    conversationTotal: types.optional(types.number, 0),
    conversationsLoading: types.optional(types.boolean, false),
    conversationsError: types.maybeNull(types.string),
    conversationItems: types.optional(types.array(types.frozen<Record<string, any>>()), []),
    selectedConversationId: types.maybeNull(types.string),
    conversationMessagesLoading: types.optional(types.boolean, false),
    conversationMessagesError: types.maybeNull(types.string),
    conversationMessages: types.optional(types.array(types.frozen<Record<string, any>>()), []),
    updatingConversationAiIds: types.optional(types.array(types.string), []),
    startingConversationIds: types.optional(types.array(types.string), []),

    escalationShopId: types.optional(types.string, ""),
    escalationStatusFilter: types.optional(types.enumeration<EscalationStatusFilter>("EscalationStatusFilter", ["open", "pending", "inProgress", "resolved", "closed", "all"]), "open"),
    escalationSearchDraft: types.optional(types.string, ""),
    escalationSearch: types.optional(types.string, ""),
    escalationPage: types.optional(types.number, 1),
    escalationPageSize: types.optional(types.number, 50),
    escalationTotal: types.optional(types.number, 0),
    escalationsLoading: types.optional(types.boolean, false),
    escalationsError: types.maybeNull(types.string),
    escalationItems: types.optional(types.array(types.frozen<Record<string, any>>()), []),
    selectedEscalationId: types.maybeNull(types.string),
    escalationGuidance: types.optional(types.string, ""),
    escalationResolved: types.optional(types.boolean, true),
    respondingEscalation: types.optional(types.boolean, false),
    copiedMeta: types.maybeNull(types.string),
  })
  .views((self) => ({
    get pageSizeOptions() {
      return PAGE_SIZE_OPTIONS;
    },
    get filteredConversationItems() {
      const search = normalizedSearch(self.conversationSearch);
      return self.conversationItems.filter((item) => matchesText(search, [
        item.conversationId,
        item.buyerNickname,
        item.buyerUserId,
        item.buyerImUserId,
        item.orderId,
        item.latestMessagePreview,
        item.platformShopId,
      ]));
    },
    get selectedConversation() {
      return self.conversationItems.find((item) => item.conversationId === self.selectedConversationId) ?? null;
    },
    get displayConversationMessages() {
      const seenServiceTexts = new Set<string>();
      return sortMessagesChronologically(self.conversationMessages as unknown as Record<string, any>[]).map((message) => ({
        ...message,
        isRoutineServiceMessage: isRoutineServiceMessage(message, seenServiceTexts),
      }));
    },
    get conversationPageCount() {
      return Math.max(1, Math.ceil(self.conversationTotal / self.conversationPageSize));
    },
    get conversationPageStart() {
      return self.conversationTotal === 0 ? 0 : (self.conversationPage - 1) * self.conversationPageSize + 1;
    },
    get conversationPageEnd() {
      return Math.min(self.conversationTotal, (self.conversationPage - 1) * self.conversationPageSize + (self as any).filteredConversationItems.length);
    },
    isConversationAiUpdating(conversationId: string) {
      return self.updatingConversationAiIds.includes(conversationId);
    },
    isConversationStarting(conversationId: string) {
      return self.startingConversationIds.includes(conversationId);
    },
    get escalationPageCount() {
      return Math.max(1, Math.ceil(self.escalationTotal / self.escalationPageSize));
    },
    get escalationPageStart() {
      return self.escalationTotal === 0 ? 0 : (self.escalationPage - 1) * self.escalationPageSize + 1;
    },
    get escalationPageEnd() {
      return Math.min(self.escalationTotal, (self.escalationPage - 1) * self.escalationPageSize + self.escalationItems.length);
    },
    get selectedEscalation() {
      return self.escalationItems.find((item) => item.id === self.selectedEscalationId) ?? null;
    },
    get selectedEscalationIndex() {
      return self.selectedEscalationId
        ? self.escalationItems.findIndex((item) => item.id === self.selectedEscalationId)
        : -1;
    },
    get hasPreviousEscalation() {
      return (self as any).selectedEscalationIndex > 0;
    },
    get hasNextEscalation() {
      const index = (self as any).selectedEscalationIndex;
      return index >= 0 && index < self.escalationItems.length - 1;
    },
  }))
  .actions((self) => {
    const client = () => getEnv<PanelStoreEnv>(self).apolloClient;

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
      const selected = (self as any).selectedEscalation as GQL.CsEscalation | null;
      if (!selected) {
        self.escalationGuidance = "";
        self.escalationResolved = true;
        return;
      }
      self.escalationGuidance = resultGuidance(selected.result);
      self.escalationResolved = selected.status !== GQL.CsEscalationStatus.InProgress;
    }

    function nextEscalationId(currentId: string): string | null {
      const index = self.escalationItems.findIndex((item) => item.id === currentId);
      if (index < 0) return null;
      return self.escalationItems[index + 1]?.id ?? self.escalationItems[index - 1]?.id ?? null;
    }

    function replaceConversation(item: GQL.CustomerServiceConversationInboxItem) {
      const next = self.conversationItems.filter((candidate) => (
        candidate.shopId !== item.shopId || candidate.conversationId !== item.conversationId
      ));
      next.unshift(item);
      self.conversationItems.replace(next as any);
    }

    function removeConversation(item: GQL.CustomerServiceConversationInboxItem) {
      self.conversationItems.replace(self.conversationItems.filter((candidate) => (
        candidate.shopId !== item.shopId || candidate.conversationId !== item.conversationId
      )) as any);
    }

    function shouldShowConversation(item: GQL.CustomerServiceConversationInboxItem): boolean {
      if (!item.isOpen) return false;
      if (self.conversationShopId && item.shopId !== self.conversationShopId) return false;
      const status = statusForConversationFilter(self.conversationStatusFilter);
      if (status && item.status !== status) return false;
      const aiEnabled = aiEnabledForFilter(self.conversationAiFilter);
      if (aiEnabled != null && item.aiEnabled !== aiEnabled) return false;
      const search = normalizedSearch(self.conversationSearch);
      return matchesText(search, [
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
      setActiveTab(tab: CustomerServiceWorkspaceTab) {
        self.activeTab = tab;
      },
      setConversationShopId(value: string) {
        self.conversationShopId = value;
        self.conversationPage = 1;
        self.selectedConversationId = null;
      },
      setConversationStatusFilter(value: ConversationStatusFilter) {
        self.conversationStatusFilter = value;
        self.conversationPage = 1;
        self.selectedConversationId = null;
      },
      setConversationAiFilter(value: ConversationAiFilter) {
        self.conversationAiFilter = value;
        self.conversationPage = 1;
        self.selectedConversationId = null;
      },
      setConversationSearchDraft(value: string) {
        self.conversationSearchDraft = value;
      },
      applyConversationSearch() {
        self.conversationSearch = self.conversationSearchDraft.trim();
        self.conversationPage = 1;
      },
      clearConversationSearch() {
        self.conversationSearchDraft = "";
        self.conversationSearch = "";
        self.conversationPage = 1;
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
        const item = snapshot ? conversationSnapshotToInboxItem(snapshot) : null;
        if (!item) return;
        const existed = self.conversationItems.some((candidate) => (
          candidate.shopId === item.shopId && candidate.conversationId === item.conversationId
        ));
        if (!shouldShowConversation(item)) {
          if (existed) {
            removeConversation(item);
            self.conversationTotal = Math.max(0, self.conversationTotal - 1);
          }
          if (self.selectedConversationId === item.conversationId) self.selectedConversationId = null;
          return;
        }
        replaceConversation(item);
        if (!existed) self.conversationTotal += 1;
      },
      selectConversation(conversationId: string | null) {
        self.selectedConversationId = conversationId;
        self.conversationMessages.replace([]);
        self.conversationMessagesError = null;
      },
      setEscalationShopId(value: string) {
        self.escalationShopId = value;
        self.escalationPage = 1;
        self.selectedEscalationId = null;
      },
      setEscalationStatusFilter(value: EscalationStatusFilter) {
        self.escalationStatusFilter = value;
        self.escalationPage = 1;
        self.selectedEscalationId = null;
      },
      setEscalationSearchDraft(value: string) {
        self.escalationSearchDraft = value;
      },
      applyEscalationSearch() {
        self.escalationSearch = self.escalationSearchDraft.trim();
        self.escalationPage = 1;
        self.selectedEscalationId = null;
      },
      clearEscalationSearch() {
        self.escalationSearchDraft = "";
        self.escalationSearch = "";
        self.escalationPage = 1;
        self.selectedEscalationId = null;
      },
      setEscalationPage(value: number) {
        self.escalationPage = Math.max(1, Math.min((self as any).escalationPageCount, value));
      },
      setEscalationPageSize(value: number) {
        self.escalationPageSize = value;
        self.escalationPage = 1;
        self.selectedEscalationId = null;
      },
      selectEscalation(id: string | null) {
        self.selectedEscalationId = id;
        setEscalationDraftFromSelection();
      },
      setEscalationGuidance(value: string) {
        self.escalationGuidance = value;
      },
      setEscalationResolved(value: boolean) {
        self.escalationResolved = value;
      },
      setCopiedMeta(value: string | null) {
        self.copiedMeta = value;
      },
      goToPreviousEscalation() {
        const index = (self as any).selectedEscalationIndex;
        if (index > 0) {
          self.selectedEscalationId = self.escalationItems[index - 1].id;
          setEscalationDraftFromSelection();
        }
      },
      goToNextEscalation() {
        const index = (self as any).selectedEscalationIndex;
        if (index >= 0 && index < self.escalationItems.length - 1) {
          self.selectedEscalationId = self.escalationItems[index + 1].id;
          setEscalationDraftFromSelection();
        }
      },
      fetchConversations: flow(function* () {
        self.conversationsLoading = true;
        self.conversationsError = null;
        try {
          const result = yield client().query({
            query: CS_CONVERSATION_INBOX_QUERY,
            variables: {
              shopIds: self.conversationShopId ? [self.conversationShopId] : undefined,
              status: statusForConversationFilter(self.conversationStatusFilter),
              aiEnabled: aiEnabledForFilter(self.conversationAiFilter),
              limit: self.conversationPageSize,
              offset: (self.conversationPage - 1) * self.conversationPageSize,
            },
            fetchPolicy: "network-only",
          });
          const page = result.data?.ecommerceGetCustomerServiceInbox as GQL.CustomerServiceConversationInboxPage | undefined;
          self.conversationItems.replace((page?.items ?? []) as any);
          self.conversationTotal = page?.totalCount ?? 0;
          if (self.selectedConversationId && !self.conversationItems.some((item) => item.conversationId === self.selectedConversationId)) {
            self.selectedConversationId = null;
          }
        } catch (err) {
          self.conversationsError = errorMessage(err);
        } finally {
          self.conversationsLoading = false;
        }
      }),
      fetchConversationMessages: flow(function* (locale?: string) {
        const selected = (self as any).selectedConversation as GQL.CustomerServiceConversationInboxItem | null;
        if (!selected) return;
        self.conversationMessagesLoading = true;
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
          const page = result.data?.ecommerceGetConversationMessages as GQL.CustomerServiceMessageSummaryPage | undefined;
          self.conversationMessages.replace((page?.items ?? []) as any);
        } catch (err) {
          self.conversationMessagesError = errorMessage(err);
        } finally {
          self.conversationMessagesLoading = false;
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
          const updated = result.data?.ecommerceSetCustomerServiceConversationAiEnabled as GQL.CustomerServiceConversationInboxItem | undefined;
          if (updated) replaceConversation(updated);
        } finally {
          removeValue(self.updatingConversationAiIds as unknown as string[], item.conversationId);
        }
        return key;
      }),
      startConversationAiRun: flow(function* (item: any, operatorInstruction?: string) {
        pushUnique(self.startingConversationIds as unknown as string[], item.conversationId);
        try {
          const result = yield fetchJson<{ ok?: boolean; error?: string }>(clientPath(API["csBridge.startConversation"]), {
            method: "POST",
            body: JSON.stringify({
              shopId: item.shopId,
              conversationId: item.conversationId,
              buyerUserId: item.buyerUserId ?? item.buyerImUserId ?? undefined,
              orderId: item.orderId ?? undefined,
              operatorInstruction,
            }),
          });
          if (result.ok === false) throw new Error(result.error ?? "Failed to start customer-service run");
          return result;
        } finally {
          removeValue(self.startingConversationIds as unknown as string[], item.conversationId);
        }
      }),
      fetchEscalations: flow(function* () {
        self.escalationsLoading = true;
        self.escalationsError = null;
        try {
          const result = yield client().query({
            query: CS_OPEN_ESCALATIONS_QUERY,
            variables: {
              filter: {
                shopIds: self.escalationShopId ? [self.escalationShopId] : undefined,
                statuses: statusesForEscalationFilter(self.escalationStatusFilter),
                search: self.escalationSearch || undefined,
                limit: self.escalationPageSize,
                offset: (self.escalationPage - 1) * self.escalationPageSize,
              },
            },
            fetchPolicy: "network-only",
          });
          const page = result.data?.csOpenEscalationsPage as GQL.CsOpenEscalationPage | undefined;
          self.escalationItems.replace(sortEscalations(page?.items ?? []) as any);
          self.escalationTotal = page?.total ?? 0;
          if (self.selectedEscalationId && !self.escalationItems.some((item) => item.id === self.selectedEscalationId)) {
            self.selectedEscalationId = null;
            setEscalationDraftFromSelection();
          }
        } catch (err) {
          self.escalationsError = errorMessage(err);
        } finally {
          self.escalationsLoading = false;
        }
      }),
      ingestEscalationEvent(raw: unknown) {
        const escalation = readEscalation(raw);
        if (!escalation) return;
        if (self.escalationPage !== 1) return;
        const search = normalizedSearch(self.escalationSearch);
        const matchesShop = !self.escalationShopId || escalation.shopId === self.escalationShopId;
        const matchesStatus = statusesForEscalationFilter(self.escalationStatusFilter).includes(escalation.status);
        const matchesSearch = matchesText(search, [
          escalation.id,
          escalation.reason,
          escalation.context,
          escalation.conversationId,
          escalation.buyerUserId,
          escalation.buyerNickname,
          escalation.orderId,
        ]);
        const next = (self.escalationItems as unknown as GQL.CsEscalation[]).filter((item) => item.id !== escalation.id);
        if (matchesShop && matchesStatus && matchesSearch) next.push(escalation);
        self.escalationItems.replace(sortEscalations(next).slice(0, self.escalationPageSize) as any);
      },
      respondToSelectedEscalation: flow(function* () {
        const selected = (self as any).selectedEscalation as GQL.CsEscalation | null;
        const guidance = self.escalationGuidance.trim();
        if (!selected || !guidance) return null;
        self.respondingEscalation = true;
        try {
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
          if (self.escalationResolved) {
            const nextId = nextEscalationId(selected.id);
            self.escalationItems.replace(self.escalationItems.filter((item) => item.id !== selected.id) as any);
            self.escalationTotal = Math.max(0, self.escalationTotal - 1);
            self.selectedEscalationId = nextId;
            setEscalationDraftFromSelection();
          }
          return result;
        } finally {
          self.respondingEscalation = false;
        }
      }),
    };
  });
