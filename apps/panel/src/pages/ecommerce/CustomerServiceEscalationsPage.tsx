import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { Select } from "../../components/inputs/Select.js";
import { Modal } from "../../components/modals/Modal.js";
import { useToast } from "../../components/Toast.js";
import { CheckIcon, CopyIcon, InfoIcon } from "../../components/icons.js";
import { panelEventBus } from "../../lib/event-bus.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { MarkdownMessage } from "../../components/MarkdownMessage.js";
import type {
  ConversationAiFilter,
  ConversationEscalationFilter,
  ConversationStatusFilter,
  EscalationStatusFilter,
} from "../../store/models/CustomerServiceWorkspaceModel.js";

type Conversation = GQL.CustomerServiceConversationInboxItem;
type ConversationMessage = GQL.CustomerServiceMessageSummary & {
  isRoutineServiceMessage?: boolean;
  isSystemMessage?: boolean;
  isSummaryMessage?: boolean;
  summaryUpdatedAt?: string | null;
  summaryMessageCount?: number | null;
};
type Escalation = GQL.CsEscalation;
type ParsedRichMessage =
  | { kind: "image"; url: string; width?: string | number; height?: string | number }
  | { kind: "video"; url: string; cover?: string; width?: string | number; height?: string | number; duration?: string | number }
  | { kind: "product"; ids: Array<{ labelKey: string; value: string }> }
  | { kind: "order"; ids: Array<{ labelKey: string; value: string }> }
  | { kind: "logistics"; ids: Array<{ labelKey: string; value: string }> };
type DismissEscalationConfirm =
  | { kind: "conversation"; conversation: Conversation }
  | { kind: "single" };

const mediaElementStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "contain",
};

export const CustomerServiceEscalationsPage = observer(function CustomerServiceWorkspacePage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const workspace = entityStore.customerServiceWorkspace;
  const [conversationDetailsOpen, setConversationDetailsOpen] = useState(false);
  const [dismissEscalationConfirm, setDismissEscalationConfirm] = useState<DismissEscalationConfirm | null>(null);
  const conversationDetailsRef = useRef<HTMLDivElement | null>(null);
  const conversationListRef = useRef<HTMLDivElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const olderMessagesScrollRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const shops = entityStore.shops;

  useEffect(() => {
    if (user) entityStore.fetchShops().catch(() => {});
  }, [entityStore, user]);

  useEffect(() => {
    if (!user || workspace.activeTab !== "conversations") return;
    workspace.fetchConversations();
  }, [
    user,
    workspace,
    workspace.activeTab,
    workspace.conversationShopId,
    workspace.conversationStatusFilter,
    workspace.conversationAiFilter,
    workspace.conversationEscalationFilter,
    workspace.conversationPage,
    workspace.conversationPageSize,
  ]);

  useEffect(() => {
    if (!user || workspace.activeTab !== "escalations") return;
    workspace.fetchEscalations();
  }, [
    user,
    workspace,
    workspace.activeTab,
    workspace.escalationShopId,
    workspace.escalationStatusFilter,
    workspace.escalationSearch,
    workspace.escalationPage,
    workspace.escalationPageSize,
  ]);

  useEffect(() => {
    if (!workspace.selectedConversationId) return;
    setConversationDetailsOpen(false);
    workspace.fetchConversationMessages(i18n.language);
    workspace.fetchConversationSummary();
  }, [workspace, workspace.selectedConversationId, i18n.language]);

  const conversationItems = workspace.filteredConversationItems as Conversation[];
  const conversationMessages = workspace.displayConversationMessages as ConversationMessage[];
  const selectedConversation = workspace.selectedConversation as Conversation | null;
  const selectedEscalation = workspace.selectedEscalation as Escalation | null;

  useLayoutEffect(() => {
    if (!selectedConversation || workspace.conversationMessagesLoading) return;
    const frame = window.requestAnimationFrame(() => {
      const list = messageListRef.current;
      if (!list) return;
      const olderSnapshot = olderMessagesScrollRef.current;
      if (olderSnapshot) {
        olderMessagesScrollRef.current = null;
        list.scrollTop = list.scrollHeight - olderSnapshot.scrollHeight + olderSnapshot.scrollTop;
        return;
      }
      list.scrollTop = list.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    selectedConversation?.shopId,
    selectedConversation?.conversationId,
    workspace.conversationMessagesLoading,
    workspace.conversationMessagesLoadingMore,
    conversationMessages.length,
  ]);

  useEffect(() => {
    if (!conversationDetailsOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (conversationDetailsRef.current?.contains(event.target as Node)) return;
      setConversationDetailsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [conversationDetailsOpen]);

  useEffect(() => {
    return panelEventBus.subscribe("cs-escalation-event", (raw) => {
      workspace.ingestEscalationEvent(raw);
      if (workspace.activeTab === "escalations") workspace.fetchEscalations();
    });
  }, [workspace]);

  useEffect(() => {
    return panelEventBus.subscribe("cs-conversation-signal", () => {
      if (workspace.activeTab === "conversations") workspace.fetchConversations();
    });
  }, [workspace]);

  useEffect(() => {
    return panelEventBus.subscribe("cs-conversation-changed", (raw) => {
      workspace.ingestConversationChanged(raw);
      if (workspace.activeTab === "conversations" && workspace.selectedConversationId) {
        workspace.fetchConversationMessages(i18n.language);
      }
    });
  }, [workspace, i18n.language]);

  const shopOptions = useMemo(
    () => [
      { value: "", label: t("ecommerce.customerServiceWorkspace.allShops") },
      ...shops
        .filter((shop) => shop.services?.customerService?.enabled)
        .map((shop) => ({
          value: shop.id,
          label: shop.alias || shop.shopName || shop.platformShopId || shop.id,
        })),
    ],
    [shops, t],
  );

  function shopLabel(shopId: string): string {
    const shop = shops.find((candidate) => candidate.id === shopId);
    return shop?.alias || shop?.shopName || shop?.platformShopId || shopId;
  }

  async function copyMeta(label: string, value: string) {
    try {
      await copyTextToClipboard(value);
      workspace.setCopiedMeta(`${label}:${value}`);
      window.setTimeout(() => {
        if (workspace.copiedMeta === `${label}:${value}`) workspace.setCopiedMeta(null);
      }, 1400);
    } catch {
      showToast(t("ecommerce.customerServiceWorkspace.copyFailed"), "error");
    }
  }

  async function toggleConversationAi(item: Conversation) {
    try {
      await workspace.setConversationAiEnabled(item, !item.aiEnabled);
      showToast(
        item.aiEnabled
          ? t("ecommerce.customerServiceWorkspace.aiDisabledToast")
          : t("ecommerce.customerServiceWorkspace.aiEnabledToast"),
        "success",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function startConversation(item: Conversation) {
    try {
      await workspace.startConversationAiRun(item);
      showToast(t("ecommerce.customerServiceWorkspace.startAiSuccess"), "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.customerServiceWorkspace.startAiFailed"), "error");
    }
  }

  async function summarizeConversation() {
    if (!selectedConversation || workspace.conversationSummaryGenerating) return;
    try {
      await workspace.generateConversationSummary(i18n.language);
      showToast(t("ecommerce.customerServiceWorkspace.summaryCreated"), "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.customerServiceWorkspace.summaryFailed"), "error");
    }
  }

  async function dismissConversationEscalations(item: Conversation) {
    try {
      await workspace.dismissConversationEscalations(item);
      setDismissEscalationConfirm(null);
      showToast(t("ecommerce.customerServiceWorkspace.dismissConversationEscalationsSuccess"), "success");
      workspace.fetchEscalations();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function respondToEscalation() {
    try {
      const result = await workspace.respondToSelectedEscalation();
      if (!result) return;
      showToast(t("ecommerce.customerServiceWorkspace.respondSuccess"), "success");
      workspace.fetchEscalations();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function dismissEscalation() {
    try {
      const result = await workspace.dismissSelectedEscalation();
      if (!result) return;
      setDismissEscalationConfirm(null);
      showToast(t("ecommerce.customerServiceWorkspace.dismissEscalationSuccess"), "success");
      workspace.fetchEscalations();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  if (authChecking) {
    return (
      <div className="page-enter">
        <div className="section-card">
          <p>{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-enter">
        <div className="section-card">
          <h2>{t("auth.loginRequired")}</h2>
          <p>{t("auth.loginFromSidebar")}</p>
        </div>
      </div>
    );
  }

  const conversationShellStyle = workspace.conversationListWidth == null
    ? undefined
    : ({
        "--cs-conversation-list-width": `${workspace.conversationListWidth}px`,
      } as CSSProperties);

  function startConversationResize(event: ReactPointerEvent<HTMLDivElement>) {
    const startX = event.clientX;
    const startWidth = conversationListRef.current?.getBoundingClientRect().width ?? workspace.conversationListWidth ?? 300;
    event.currentTarget.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) => {
      workspace.setConversationListWidth(startWidth + moveEvent.clientX - startX);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  async function openConversationEscalation(item: Conversation) {
    try {
      const escalation = await workspace.openConversationEscalation(item);
      if (!escalation) showToast(t("ecommerce.customerServiceWorkspace.escalationUnavailable"), "error");
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function sendManualReply(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!workspace.manualReplyDraft.trim() || workspace.sendingManualReply) return;
    try {
      const result = await workspace.sendManualReply(i18n.language);
      if (!result) return;
      showToast(t("ecommerce.customerServiceWorkspace.manualReplySent"), "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.customerServiceWorkspace.manualReplyFailed"), "error");
    }
  }

  async function loadOlderConversationMessages() {
    const list = messageListRef.current;
    if (!list || !workspace.canLoadOlderConversationMessages) return;
    olderMessagesScrollRef.current = {
      scrollHeight: list.scrollHeight,
      scrollTop: list.scrollTop,
    };
    const loaded = await workspace.fetchOlderConversationMessages(i18n.language);
    if (!loaded) olderMessagesScrollRef.current = null;
  }

  function handleMessageListScroll() {
    const list = messageListRef.current;
    if (!list || list.scrollTop > 36 || !workspace.canLoadOlderConversationMessages) return;
    void loadOlderConversationMessages();
  }

  function renderMessageContent(message: ConversationMessage) {
    const rich = parseRichMessage(message);
    if (!rich) return <p>{message.text || message.type || "-"}</p>;

    if (rich.kind === "image") {
      return (
        <a
          className="cs-message-image-link"
          href={rich.url}
          rel="noreferrer"
          target="_blank"
        >
          <span className="cs-message-media-frame" style={mediaFrameStyle(rich)}>
            <img
              alt={t("ecommerce.customerServiceWorkspace.imageMessage")}
              className="cs-message-image"
              height={rich.height}
              loading="lazy"
              src={rich.url}
              style={mediaElementStyle}
              width={rich.width}
            />
          </span>
        </a>
      );
    }

    if (rich.kind === "video") {
      return (
        <div className="cs-message-media-frame" style={mediaFrameStyle(rich)}>
          <video
            className="cs-message-video"
            controls
            height={rich.height}
            playsInline
            preload="metadata"
            poster={rich.cover}
            src={rich.url}
            style={mediaElementStyle}
            title={t("ecommerce.customerServiceWorkspace.videoMessage")}
            width={rich.width}
          />
        </div>
      );
    }

    const titleKey = rich.kind === "product"
      ? "productCard"
      : rich.kind === "order"
        ? "orderCard"
        : "logisticsCard";
    return (
      <div className="cs-message-card-body">
        <div className="cs-message-card-title">{t(`ecommerce.customerServiceWorkspace.${titleKey}`)}</div>
        <div className="cs-message-card-ids">
          {rich.ids.map((id) => (
            <button
              className="cs-message-card-id"
              key={`${id.labelKey}:${id.value}`}
              type="button"
              onClick={() => void copyMeta(t(`ecommerce.customerServiceWorkspace.${id.labelKey}`), id.value)}
            >
              <span>{t(`ecommerce.customerServiceWorkspace.${id.labelKey}`)}</span>
              <code>{id.value}</code>
              <CopyIcon size={13} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter cs-workspace-page">
      <div className="ecommerce-page-header">
        <div>
          <h1>{t("ecommerce.customerServiceWorkspace.title")}</h1>
          <p className="ecommerce-page-subtitle">{t("ecommerce.customerServiceWorkspace.subtitle")}</p>
        </div>
        <div className="cs-workspace-tabs" role="tablist">
          <button
            className={workspace.activeTab === "conversations" ? "cs-workspace-tab active" : "cs-workspace-tab"}
            type="button"
            onClick={() => workspace.setActiveTab("conversations")}
          >
            {t("ecommerce.customerServiceWorkspace.conversationsTab")}
            <span>{workspace.conversationTotal}</span>
          </button>
          <button
            className={workspace.activeTab === "escalations" ? "cs-workspace-tab active" : "cs-workspace-tab"}
            type="button"
            onClick={() => workspace.setActiveTab("escalations")}
          >
            {t("ecommerce.customerServiceWorkspace.escalationsTab")}
            <span>{workspace.escalationTotal}</span>
          </button>
        </div>
      </div>

      {workspace.activeTab === "conversations" ? (
        <section className="cs-workspace-panel">
          <div className="cs-workspace-filter-grid cs-conversation-filter-grid">
            <Select value={workspace.conversationShopId} onChange={(value) => workspace.setConversationShopId(value)} options={shopOptions} />
            <Select
              value={workspace.conversationStatusFilter}
              onChange={(value) => workspace.setConversationStatusFilter(value as ConversationStatusFilter)}
              options={[
                { value: "pending", label: t("ecommerce.customerServiceWorkspace.conversationStatusPending") },
                { value: "resolved", label: t("ecommerce.customerServiceWorkspace.conversationStatusReplied") },
                { value: "all", label: t("ecommerce.customerServiceWorkspace.statusAll") },
              ]}
            />
            <Select
              value={workspace.conversationAiFilter}
              onChange={(value) => workspace.setConversationAiFilter(value as ConversationAiFilter)}
              options={[
                { value: "all", label: t("ecommerce.customerServiceWorkspace.aiAll") },
                { value: "enabled", label: t("ecommerce.customerServiceWorkspace.aiEnabled") },
                { value: "disabled", label: t("ecommerce.customerServiceWorkspace.aiDisabled") },
              ]}
            />
            <Select
              value={workspace.conversationEscalationFilter}
              onChange={(value) => workspace.setConversationEscalationFilter(value as ConversationEscalationFilter)}
              options={[
                { value: "all", label: t("ecommerce.customerServiceWorkspace.escalationAll") },
                { value: "open", label: t("ecommerce.customerServiceWorkspace.escalationOpen") },
                { value: "none", label: t("ecommerce.customerServiceWorkspace.escalationNone") },
              ]}
            />
            <div className="cs-workspace-search">
              <input
                className="input-full"
                value={workspace.conversationSearchDraft}
                onChange={(event) => workspace.setConversationSearchDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") workspace.applyConversationSearch();
                }}
                placeholder={t("ecommerce.customerServiceWorkspace.conversationSearchPlaceholder")}
              />
              <button className="btn btn-secondary" type="button" onClick={() => workspace.applyConversationSearch()}>
                {t("ecommerce.customerServiceWorkspace.search")}
              </button>
            </div>
            <button className="btn btn-secondary cs-refresh-button" type="button" onClick={() => workspace.fetchConversations()} disabled={workspace.conversationsLoading}>
              {workspace.conversationsLoading ? t("common.loading") : t("ecommerce.customerServiceWorkspace.refresh")}
            </button>
          </div>

          {workspace.conversationSearch && (
            <button className="cs-escalation-search-chip" type="button" onClick={() => workspace.clearConversationSearch()}>
              {workspace.conversationSearch} x
            </button>
          )}

          <div className="cs-conversation-shell" style={conversationShellStyle}>
            <div className="cs-conversation-list" ref={conversationListRef}>
              <div className="cs-conversation-list-head">
                <PageSummary
                  start={workspace.conversationPageStart}
                  end={workspace.conversationPageEnd}
                  total={workspace.conversationTotal}
                  page={workspace.conversationPage}
                  pages={workspace.conversationPageCount}
                />
              </div>
              <div className="cs-conversation-list-scroll">
                {workspace.conversationsError && <div className="form-error">{workspace.conversationsError}</div>}
                {workspace.conversationsLoading && conversationItems.length === 0 ? (
                  <div className="affiliate-proposal-empty">{t("common.loading")}</div>
                ) : conversationItems.length === 0 ? (
                  <div className="affiliate-proposal-empty">{t("ecommerce.customerServiceWorkspace.conversationEmpty")}</div>
                ) : (
                  conversationItems.map((item) => (
                    <button
                      className={selectedConversation?.conversationId === item.conversationId && selectedConversation?.shopId === item.shopId ? "cs-conversation-row active" : "cs-conversation-row"}
                      key={`${item.shopId}:${item.conversationId}`}
                      type="button"
                      onClick={() => workspace.selectConversation(item.shopId, item.conversationId)}
                    >
                      <span className="cs-conversation-meta">
                        <span>{shopLabel(item.shopId)}</span>
                        <span>{item.latestMessageTime ? formatCompactDateTime(item.latestMessageTime) : "-"}</span>
                      </span>
                      <span className="cs-conversation-row-head">
                        <strong>{buyerLabel(item)}</strong>
                        <span className="cs-conversation-badges">
                          {item.openEscalationCount > 0 && (
                            <EscalationStateBadge conversation={item} onClick={() => void openConversationEscalation(item)} />
                          )}
                          <span className={item.status === GQL.CustomerServiceConversationStatus.Pending ? "badge badge-warning" : "badge badge-info"}>
                            {conversationStatusLabel(item.status, t)}
                          </span>
                        </span>
                      </span>
                      <span className="cs-conversation-preview">{conversationPreview(item, t)}</span>
                    </button>
                  ))
                )}
              </div>
              <div className="cs-escalation-pagination">
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => workspace.setConversationPage(workspace.conversationPage - 1)} disabled={workspace.conversationPage <= 1 || workspace.conversationsLoading}>
                  {t("ecommerce.customerServiceWorkspace.previous")}
                </button>
                <span>{t("ecommerce.customerServiceWorkspace.page", { page: workspace.conversationPage, pages: workspace.conversationPageCount })}</span>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => workspace.setConversationPage(workspace.conversationPage + 1)} disabled={workspace.conversationPage >= workspace.conversationPageCount || workspace.conversationsLoading}>
                  {t("ecommerce.customerServiceWorkspace.next")}
                </button>
              </div>
            </div>

            <div
              className="cs-conversation-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label={t("ecommerce.customerServiceWorkspace.resizeConversationList")}
              onPointerDown={startConversationResize}
            />

            <div className="cs-conversation-detail">
              {selectedConversation ? (
                <>
                  <div className="cs-conversation-summary">
                    <div className="cs-conversation-detail-head">
                      <div>
                        <div className="cs-conversation-title-row">
                          <h2>{buyerLabel(selectedConversation)}</h2>
                          {selectedConversation.openEscalationCount > 0 && (
                            <EscalationStateBadge conversation={selectedConversation} onClick={() => void openConversationEscalation(selectedConversation)} />
                          )}
                        </div>
                        <p>{shopLabel(selectedConversation.shopId)}</p>
                      </div>
                    </div>
                      <div className="cs-conversation-tools">
                        <button
                          className="btn btn-secondary btn-sm cs-summary-button"
                          type="button"
                          onClick={() => void summarizeConversation()}
                          disabled={workspace.conversationSummaryGenerating || workspace.conversationMessagesLoading}
                        >
                          {workspace.conversationSummaryGenerating
                            ? t("common.loading")
                            : t("ecommerce.customerServiceWorkspace.summarize")}
                        </button>
                        {selectedConversation.openEscalationCount > 0 && (
                          <span
                            className="has-tooltip cs-dismiss-escalation-action"
                            data-tooltip={t("ecommerce.customerServiceWorkspace.dismissEscalationTooltip")}
                          >
                            <button
                              className="btn btn-secondary btn-sm cs-clear-escalations-button"
                              type="button"
                              onClick={() => setDismissEscalationConfirm({ kind: "conversation", conversation: selectedConversation })}
                              disabled={workspace.isConversationEscalationClearing(selectedConversation.conversationId)}
                            >
                              {workspace.isConversationEscalationClearing(selectedConversation.conversationId)
                                ? t("common.loading")
                                : t("ecommerce.customerServiceWorkspace.dismissEscalation")}
                            </button>
                          </span>
                      )}
                      <button
                        className={selectedConversation.aiEnabled ? "cs-ai-switch enabled" : "cs-ai-switch"}
                        type="button"
                        role="switch"
                        aria-checked={selectedConversation.aiEnabled}
                        onClick={() => void toggleConversationAi(selectedConversation)}
                        disabled={workspace.isConversationAiUpdating(selectedConversation.conversationId)}
                      >
                        <span className="cs-ai-switch-track" aria-hidden="true">
                          <span className="cs-ai-switch-thumb" />
                        </span>
                        <span>{selectedConversation.aiEnabled ? t("ecommerce.customerServiceWorkspace.aiEnabled") : t("ecommerce.customerServiceWorkspace.aiDisabled")}</span>
                      </button>
                      <div className={conversationDetailsOpen ? "cs-conversation-more open" : "cs-conversation-more"} ref={conversationDetailsRef}>
                        <button
                          className={conversationDetailsOpen ? "btn btn-secondary btn-sm cs-conversation-more-trigger active" : "btn btn-secondary btn-sm cs-conversation-more-trigger"}
                          type="button"
                          aria-expanded={conversationDetailsOpen}
                          onClick={() => setConversationDetailsOpen((open) => !open)}
                        >
                          {t("ecommerce.customerServiceWorkspace.details")}
                        </button>
                        <div className="cs-conversation-popover">
                          <div className="cs-conversation-popover-head">
                            <span>{t("ecommerce.customerServiceWorkspace.conversationDetails")}</span>
                            {selectedConversation.openEscalationCount > 0 && (
                              <EscalationStateBadge conversation={selectedConversation} onClick={() => void openConversationEscalation(selectedConversation)} />
                            )}
                          </div>
                          <div className="cs-conversation-facts">
                            <CopyMetaButton label={t("ecommerce.customerServiceWorkspace.conversation")} value={selectedConversation.conversationId} copied={workspace.copiedMeta === `${t("ecommerce.customerServiceWorkspace.conversation")}:${selectedConversation.conversationId}`} onCopy={copyMeta} />
                            {selectedConversation.buyerUserId && <CopyMetaButton label={t("ecommerce.customerServiceWorkspace.buyer")} value={selectedConversation.buyerUserId} copied={workspace.copiedMeta === `${t("ecommerce.customerServiceWorkspace.buyer")}:${selectedConversation.buyerUserId}`} onCopy={copyMeta} />}
                            {selectedConversation.buyerImUserId && <CopyMetaButton label={t("ecommerce.customerServiceWorkspace.buyerIm")} value={selectedConversation.buyerImUserId} copied={workspace.copiedMeta === `${t("ecommerce.customerServiceWorkspace.buyerIm")}:${selectedConversation.buyerImUserId}`} onCopy={copyMeta} />}
                            {selectedConversation.buyerNickname && <CopyMetaButton label={t("ecommerce.customerServiceWorkspace.buyerAlias")} value={selectedConversation.buyerNickname} copied={workspace.copiedMeta === `${t("ecommerce.customerServiceWorkspace.buyerAlias")}:${selectedConversation.buyerNickname}`} onCopy={copyMeta} />}
                            {selectedConversation.orderId && <CopyMetaButton label={t("ecommerce.customerServiceWorkspace.order")} value={selectedConversation.orderId} copied={workspace.copiedMeta === `${t("ecommerce.customerServiceWorkspace.order")}:${selectedConversation.orderId}`} onCopy={copyMeta} />}
                          </div>
                          <div className="cs-conversation-popover-footer">
                            <button
                              className="btn btn-primary btn-sm cs-run-ai-button"
                              type="button"
                              onClick={() => void startConversation(selectedConversation)}
                              disabled={workspace.isConversationStarting(selectedConversation.conversationId)}
                            >
                              {workspace.isConversationStarting(selectedConversation.conversationId)
                                ? t("common.loading")
                                : t("ecommerce.customerServiceWorkspace.startAi")}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="cs-message-panel" aria-label={t("ecommerce.customerServiceWorkspace.messages")}>
                    {workspace.conversationMessagesError && <div className="form-error">{workspace.conversationMessagesError}</div>}
                    {workspace.conversationSummaryError && <div className="form-error">{workspace.conversationSummaryError}</div>}
                    {workspace.conversationSummaryGenerating && (
                      <div className="cs-message-working-overlay" role="status" aria-live="polite">
                        <div className="cs-message-working-card">
                          <span className="cs-message-working-spinner" aria-hidden="true" />
                          <div>
                            <strong>{t("ecommerce.customerServiceWorkspace.summaryGenerating")}</strong>
                            <p>{t("ecommerce.customerServiceWorkspace.summaryGeneratingHint")}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {workspace.conversationMessagesLoading && workspace.conversationMessages.length === 0 ? (
                      <div className="affiliate-proposal-empty">{t("common.loading")}</div>
                    ) : workspace.conversationMessages.length === 0 && !workspace.conversationSummary ? (
                      <div className="affiliate-proposal-empty">{t("ecommerce.customerServiceWorkspace.noMessages")}</div>
                    ) : (
                      <div className="cs-message-list" ref={messageListRef} onScroll={handleMessageListScroll}>
                        {workspace.conversationMessagesLoadingMore && (
                          <div className="cs-message-loading-older">{t("common.loading")}</div>
                        )}
                        {conversationMessages.map((message) => (
                          <div className={messageClassName(message)} key={message.messageId ?? `${message.createTime}-${message.text}`}>
                            {message.isSummaryMessage ? (
                              <>
                                <div className="cs-summary-message-title">
                                  <span>{t("ecommerce.customerServiceWorkspace.summaryTitle")}</span>
                                  <small>
                                    {message.summaryUpdatedAt
                                      ? formatCompactDateTime(message.summaryUpdatedAt)
                                      : ""}
                                  </small>
                                </div>
                                <div className="cs-summary-markdown">
                                  <MarkdownMessage text={message.text || "-"} />
                                </div>
                                {message.summaryMessageCount ? (
                                  <div className="cs-summary-message-foot">
                                    {t("ecommerce.customerServiceWorkspace.summaryMessageCount", { count: message.summaryMessageCount })}
                                  </div>
                                ) : null}
                              </>
                            ) : message.isSystemMessage ? (
                              <p>{message.text || message.type || t("ecommerce.customerServiceWorkspace.systemMessage")}</p>
                            ) : (
                              <>
                                <div className="cs-message-meta">
                                  <span>{message.sender?.nickname || message.sender?.role || "-"}</span>
                                  <span>{message.createTime ? formatCompactDateTime(message.createTime) : ""}</span>
                                </div>
                                {renderMessageContent(message)}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <form className="cs-manual-reply-form" onSubmit={(event) => void sendManualReply(event)}>
                      <textarea
                        value={workspace.manualReplyDraft}
                        onChange={(event) => workspace.setManualReplyDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            void sendManualReply();
                          }
                        }}
                        placeholder={t("ecommerce.customerServiceWorkspace.manualReplyPlaceholder")}
                        disabled={workspace.sendingManualReply}
                        rows={2}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        type="submit"
                        disabled={!workspace.manualReplyDraft.trim() || workspace.sendingManualReply}
                      >
                        {workspace.sendingManualReply
                          ? t("common.loading")
                          : t("ecommerce.customerServiceWorkspace.manualReplySend")}
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="cs-conversation-detail-empty">
                  {t("ecommerce.customerServiceWorkspace.selectConversation")}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <EscalationsTab
          shopOptions={shopOptions}
          shopLabel={shopLabel}
        />
      )}

      <Modal
        isOpen={Boolean(selectedEscalation)}
        onClose={() => workspace.closeEscalationModal()}
        title={selectedEscalation ? selectedEscalation.id : t("ecommerce.customerServiceWorkspace.title")}
        maxWidth={720}
      >
        {selectedEscalation && (
          <EscalationDetailModal
            selected={selectedEscalation}
            shopLabel={shopLabel}
            copyMeta={copyMeta}
            respondToEscalation={respondToEscalation}
            dismissEscalation={dismissEscalation}
            requestDismissEscalation={() => setDismissEscalationConfirm({ kind: "single" })}
            showNavigation={!workspace.selectedEscalationFromConversation}
          />
        )}
      </Modal>
      <DismissEscalationConfirmModal
        confirm={dismissEscalationConfirm}
        isBusy={dismissEscalationConfirm?.kind === "conversation"
          ? workspace.isConversationEscalationClearing(dismissEscalationConfirm.conversation.conversationId)
          : workspace.dismissingEscalation}
        onClose={() => setDismissEscalationConfirm(null)}
        onConfirm={() => {
          if (!dismissEscalationConfirm) return;
          if (dismissEscalationConfirm.kind === "conversation") {
            void dismissConversationEscalations(dismissEscalationConfirm.conversation);
            return;
          }
          void dismissEscalation();
        }}
      />
    </div>
  );
});

const EscalationsTab = observer(function EscalationsTab({
  shopOptions,
  shopLabel,
}: {
  shopOptions: Array<{ value: string; label: string }>;
  shopLabel: (shopId: string) => string;
}) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const workspace = entityStore.customerServiceWorkspace;
  const items = workspace.escalationItems as unknown as Escalation[];

  return (
    <section className="cs-workspace-panel">
      <div className="cs-workspace-toolbar">
        <div>
          <div className="cs-workspace-count">
            {t("ecommerce.customerServiceWorkspace.openCount", { count: workspace.escalationTotal })}
          </div>
          <div className="form-hint">{t("ecommerce.customerServiceWorkspace.escalationQueueHint")}</div>
        </div>
        <button className="btn btn-secondary" type="button" onClick={() => workspace.fetchEscalations()} disabled={workspace.escalationsLoading}>
          {workspace.escalationsLoading ? t("common.loading") : t("ecommerce.customerServiceWorkspace.refresh")}
        </button>
      </div>

      <div className="cs-workspace-filter-grid">
        <Select value={workspace.escalationShopId} onChange={(value) => workspace.setEscalationShopId(value)} options={shopOptions} />
        <Select
          value={workspace.escalationStatusFilter}
          onChange={(value) => workspace.setEscalationStatusFilter(value as EscalationStatusFilter)}
          options={[
            { value: "open", label: t("ecommerce.customerServiceWorkspace.statusOpen") },
            { value: "pending", label: t("ecommerce.customerServiceWorkspace.statusPending") },
            { value: "inProgress", label: t("ecommerce.customerServiceWorkspace.statusInProgress") },
            { value: "resolved", label: t("ecommerce.customerServiceWorkspace.statusResolved") },
            { value: "closed", label: t("ecommerce.customerServiceWorkspace.statusClosed") },
            { value: "all", label: t("ecommerce.customerServiceWorkspace.statusAll") },
          ]}
        />
        <div className="cs-workspace-search">
          <input
            className="input-full"
            value={workspace.escalationSearchDraft}
            onChange={(event) => workspace.setEscalationSearchDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") workspace.applyEscalationSearch();
            }}
            placeholder={t("ecommerce.customerServiceWorkspace.searchPlaceholder")}
          />
          <button className="btn btn-secondary" type="button" onClick={() => workspace.applyEscalationSearch()}>
            {t("ecommerce.customerServiceWorkspace.search")}
          </button>
        </div>
        <Select
          value={String(workspace.escalationPageSize)}
          onChange={(value) => workspace.setEscalationPageSize(Number(value))}
          options={workspace.pageSizeOptions.map((value: number) => ({
            value: String(value),
            label: t("ecommerce.customerServiceWorkspace.pageSize", { count: value }),
          }))}
        />
      </div>

      {workspace.escalationSearch && (
        <button className="cs-escalation-search-chip" type="button" onClick={() => workspace.clearEscalationSearch()}>
          {workspace.escalationSearch} x
        </button>
      )}

      {workspace.escalationsError && <div className="form-error">{workspace.escalationsError}</div>}
      {workspace.escalationsLoading && items.length === 0 ? (
        <div className="affiliate-proposal-empty">{t("common.loading")}</div>
      ) : items.length === 0 ? (
        <div className="affiliate-proposal-empty">{t("ecommerce.customerServiceWorkspace.empty")}</div>
      ) : (
        <div className="cs-escalation-listing">
          <PageSummary
            start={workspace.escalationPageStart}
            end={workspace.escalationPageEnd}
            total={workspace.escalationTotal}
            page={workspace.escalationPage}
            pages={workspace.escalationPageCount}
          />
          <div className="cs-escalation-table" role="table">
            <div className="cs-escalation-table-head" role="row">
              <span>{t("ecommerce.customerServiceWorkspace.reason")}</span>
              <span>{t("ecommerce.customerServiceWorkspace.statusOpen")}</span>
              <span>{t("ecommerce.customerServiceWorkspace.updatedAt")}</span>
            </div>
            {items.map((item) => (
              <button className="cs-escalation-row" key={item.id} type="button" onClick={() => workspace.selectEscalation(item.id)}>
                <span className="cs-escalation-row-main">
                  <strong>{item.id}</strong>
                  <span>{item.reason}</span>
                  <small>{shopLabel(item.shopId)} - {escalationBuyerLabel(item)}</small>
                </span>
                <span>
                  <span className={item.status === GQL.CsEscalationStatus.Pending ? "badge badge-warning" : "badge badge-info"}>
                    {escalationStatusLabel(item.status, t)}
                  </span>
                </span>
                <span>{formatCompactDateTime(item.updatedAt)}</span>
              </button>
            ))}
          </div>
          <div className="cs-escalation-pagination">
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => workspace.setEscalationPage(workspace.escalationPage - 1)} disabled={workspace.escalationPage <= 1 || workspace.escalationsLoading}>
              {t("ecommerce.customerServiceWorkspace.previous")}
            </button>
            <span>{t("ecommerce.customerServiceWorkspace.page", { page: workspace.escalationPage, pages: workspace.escalationPageCount })}</span>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => workspace.setEscalationPage(workspace.escalationPage + 1)} disabled={workspace.escalationPage >= workspace.escalationPageCount || workspace.escalationsLoading}>
              {t("ecommerce.customerServiceWorkspace.next")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
});

const EscalationDetailModal = observer(function EscalationDetailModal({
  selected,
  shopLabel,
  copyMeta,
  respondToEscalation,
  dismissEscalation,
  requestDismissEscalation,
  showNavigation,
}: {
  selected: Escalation;
  shopLabel: (shopId: string) => string;
  copyMeta: (label: string, value: string) => Promise<void>;
  respondToEscalation: () => Promise<void>;
  dismissEscalation: () => Promise<void>;
  requestDismissEscalation: () => void;
  showNavigation: boolean;
}) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const workspace = entityStore.customerServiceWorkspace;

  return (
    <div className="cs-escalation-modal">
      <section className="cs-escalation-detail">
        <div className="cs-escalation-detail-head">
          <div>
            <div className="cs-escalation-detail-title">{selected.id}</div>
            <div className="cs-escalation-detail-subtitle">
              <span>{shopLabel(selected.shopId)}</span>
              <span>{escalationBuyerLabel(selected)}</span>
              <span>{t("ecommerce.customerServiceWorkspace.version", { version: selected.version })}</span>
              <span>{formatCompactDateTime(selected.updatedAt)}</span>
            </div>
          </div>
          <span className={selected.status === GQL.CsEscalationStatus.Pending ? "badge badge-warning" : "badge badge-info"}>
            {escalationStatusLabel(selected.status, t)}
          </span>
        </div>

        <div className="cs-escalation-block">
          <div className="drawer-section-label">{t("ecommerce.customerServiceWorkspace.reason")}</div>
          <p>{selected.reason}</p>
        </div>
        {selected.context && (
          <div className="cs-escalation-block">
            <div className="drawer-section-label">{t("ecommerce.customerServiceWorkspace.context")}</div>
            <pre>{selected.context}</pre>
          </div>
        )}

        <div className="cs-escalation-meta-actions">
          <CopyMetaButton label={t("ecommerce.customerServiceWorkspace.conversation")} value={selected.conversationId} copied={workspace.copiedMeta === `${t("ecommerce.customerServiceWorkspace.conversation")}:${selected.conversationId}`} onCopy={copyMeta} />
          <CopyMetaButton label={t("ecommerce.customerServiceWorkspace.buyer")} value={selected.buyerUserId} copied={workspace.copiedMeta === `${t("ecommerce.customerServiceWorkspace.buyer")}:${selected.buyerUserId}`} onCopy={copyMeta} />
          {selected.orderId && <CopyMetaButton label={t("ecommerce.customerServiceWorkspace.order")} value={selected.orderId} copied={workspace.copiedMeta === `${t("ecommerce.customerServiceWorkspace.order")}:${selected.orderId}`} onCopy={copyMeta} />}
          <span className="cs-escalation-created-at">
            {t("ecommerce.customerServiceWorkspace.createdAt")} {formatDateTime(selected.createdAt)}
          </span>
        </div>

        <div className="cs-response-form">
          <label className="form-label-block">{t("ecommerce.customerServiceWorkspace.managerGuidance")}</label>
          <textarea
            className="input-full textarea-resize-vertical"
            rows={6}
            value={workspace.escalationGuidance}
            onChange={(event) => workspace.setEscalationGuidance(event.target.value)}
            placeholder={t("ecommerce.customerServiceWorkspace.managerGuidancePlaceholder")}
          />
          <label className="form-checkbox-row cs-resolved-toggle">
            <input type="checkbox" checked={workspace.escalationResolved} onChange={(event) => workspace.setEscalationResolved(event.target.checked)} />
            <span className="form-checkbox-label">{t("ecommerce.customerServiceWorkspace.markResolved")}</span>
            <span
              className="has-tooltip cs-final-decision-help"
              data-tooltip={t("ecommerce.customerServiceWorkspace.finalDecisionTooltip")}
              aria-label={t("ecommerce.customerServiceWorkspace.finalDecisionTooltip")}
            >
              <InfoIcon size={14} />
            </span>
          </label>
          <div className="cs-escalation-actions">
            <span
              className="has-tooltip cs-dismiss-escalation-action"
              data-tooltip={t("ecommerce.customerServiceWorkspace.dismissEscalationTooltip")}
            >
              <button
                className="btn btn-secondary"
                type="button"
                onClick={requestDismissEscalation}
                disabled={workspace.dismissingEscalation || workspace.respondingEscalation}
              >
                {workspace.dismissingEscalation ? t("common.loading") : t("ecommerce.customerServiceWorkspace.dismissEscalation")}
              </button>
            </span>
            {showNavigation ? (
              <div className="cs-escalation-modal-nav">
                <button className="btn btn-secondary" type="button" onClick={() => workspace.goToPreviousEscalation()} disabled={!workspace.hasPreviousEscalation || workspace.respondingEscalation}>
                  {t("ecommerce.customerServiceWorkspace.previousEscalation")}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => workspace.goToNextEscalation()} disabled={!workspace.hasNextEscalation || workspace.respondingEscalation}>
                  {t("ecommerce.customerServiceWorkspace.nextEscalation")}
                </button>
              </div>
            ) : <span />}
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => void respondToEscalation()}
              disabled={workspace.respondingEscalation || !workspace.escalationGuidance.trim()}
            >
              {workspace.respondingEscalation ? t("common.loading") : t("ecommerce.customerServiceWorkspace.sendResponse")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
});

const DismissEscalationConfirmModal = observer(function DismissEscalationConfirmModal({
  confirm,
  isBusy,
  onClose,
  onConfirm,
}: {
  confirm: DismissEscalationConfirm | null;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const count = confirm?.kind === "conversation" ? Number(confirm.conversation.openEscalationCount ?? 0) : 1;

  return (
    <Modal
      isOpen={Boolean(confirm)}
      onClose={onClose}
      title={t("ecommerce.customerServiceWorkspace.dismissEscalation")}
      maxWidth={460}
      preventBackdropClose={isBusy}
    >
      <div className="cs-dismiss-escalation-modal">
        <div className="cs-dismiss-escalation-icon">
          <InfoIcon size={18} />
        </div>
        <div>
          <p className="cs-dismiss-escalation-copy">
            {confirm?.kind === "conversation"
              ? t("ecommerce.customerServiceWorkspace.dismissConversationEscalationsConfirm", { count })
              : t("ecommerce.customerServiceWorkspace.confirmDismissEscalation")}
          </p>
          <p className="cs-dismiss-escalation-hint">
            {t("ecommerce.customerServiceWorkspace.dismissEscalationTooltip")}
          </p>
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn btn-secondary" type="button" onClick={onClose} disabled={isBusy}>
          {t("common.cancel")}
        </button>
        <button className="btn btn-danger" type="button" onClick={onConfirm} disabled={isBusy}>
          {isBusy ? t("common.loading") : t("ecommerce.customerServiceWorkspace.dismissEscalation")}
        </button>
      </div>
    </Modal>
  );
});

function PageSummary({ start, end, total, page, pages }: { start: number; end: number; total: number; page: number; pages: number }) {
  const { t } = useTranslation();
  return (
    <div className="cs-escalation-page-summary">
      <span>{t("ecommerce.customerServiceWorkspace.pageSummary", { start, end, total, page, pages })}</span>
    </div>
  );
}

function CopyMetaButton({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: (label: string, value: string) => Promise<void>;
}) {
  return (
    <button
      className={`cs-meta-copy${copied ? " cs-meta-copy-copied" : ""}`}
      type="button"
      title={`${label}: ${value}`}
      aria-label={`${label}: ${value}`}
      onClick={() => void onCopy(label, value)}
    >
      <span>{label}</span>
      <code>{shortId(value)}</code>
      {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
    </button>
  );
}

function buyerLabel(item: Conversation): string {
  const nickname = item.buyerNickname?.trim();
  if (nickname) return nickname;
  return shortId(item.buyerUserId || item.buyerImUserId || item.conversationId);
}

function escalationBuyerLabel(escalation: Escalation): string {
  return escalation.buyerNickname?.trim() || escalation.buyerUserId;
}

function conversationStatusLabel(status: GQL.CustomerServiceConversationStatus, t: (key: string) => string): string {
  if (status === GQL.CustomerServiceConversationStatus.Resolved) return t("ecommerce.customerServiceWorkspace.conversationStatusReplied");
  return t("ecommerce.customerServiceWorkspace.conversationStatusPending");
}

function EscalationStateBadge({
  conversation,
  onClick,
}: {
  conversation: Conversation;
  onClick?: () => void;
}) {
  const { t } = useTranslation();
  if (!(conversation.openEscalationCount > 0)) return null;
  const label = t("ecommerce.customerServiceWorkspace.escalationBadge");
  if (!onClick) {
    return <span className="badge badge-warning cs-open-escalation-badge">{label}</span>;
  }
  return (
    <button
      className="badge badge-warning cs-open-escalation-badge cs-open-escalation-button"
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {label}
    </button>
  );
}

function conversationPreview(item: Conversation, t: (key: string) => string): string {
  if (item.latestMessageType === "ESCALATION") return t("ecommerce.customerServiceWorkspace.noPreview");
  return item.latestMessagePreview || t("ecommerce.customerServiceWorkspace.noPreview");
}

function normalizeMessageType(message: Pick<ConversationMessage, "type">): string {
  return String(message.type ?? "").toUpperCase();
}

function readJsonPayload(text: string | null | undefined): Record<string, any> | null {
  if (!text?.trim()) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readStringPayload(payload: Record<string, any> | null, keys: string[]): string | undefined {
  if (!payload) return undefined;
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function readTextId(text: string | null | undefined, patterns: RegExp[]): string | undefined {
  if (!text) return undefined;
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim().replace(/[.;,，。]+$/u, "");
    if (value) return value;
  }
  return undefined;
}

function uniqueIds(ids: Array<{ labelKey: string; value?: string }>): Array<{ labelKey: string; value: string }> {
  const seen = new Set<string>();
  const result: Array<{ labelKey: string; value: string }> = [];
  for (const id of ids) {
    const value = id.value?.trim();
    if (!value) continue;
    const key = `${id.labelKey}:${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ labelKey: id.labelKey, value });
  }
  return result;
}

function mediaFrameStyle(media: { width?: string | number; height?: string | number }): CSSProperties | undefined {
  const width = Number(media.width);
  const height = Number(media.height);
  const base: CSSProperties = {
    display: "block",
    overflow: "hidden",
    borderRadius: 6,
    lineHeight: 0,
    marginTop: 6,
  };
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return {
      ...base,
      width: 220,
      height: 220,
    };
  }
  const maxWidth = 320;
  const maxHeight = 360;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  const displayWidth = Math.round(Math.max(96, width * scale));
  const displayHeight = Math.round(Math.max(96, height * scale));
  return {
    ...base,
    aspectRatio: `${width} / ${height}`,
    width: displayWidth,
    height: displayHeight,
  };
}

function parseRichMessage(message: ConversationMessage): ParsedRichMessage | null {
  const type = normalizeMessageType(message);
  const payload = readJsonPayload(message.text);
  const isVideoPayload = Boolean(payload && (
    typeof payload.cover === "string" ||
    typeof payload.vid === "string" ||
    typeof payload.duration === "string" ||
    String(payload.format ?? "").toLowerCase() === "mp4" ||
    String(payload.mime_type ?? "").toLowerCase().startsWith("video/")
  ));

  if (type === "VIDEO" || isVideoPayload) {
    const url = readStringPayload(payload, ["url"]);
    const cover = readStringPayload(payload, ["cover"]);
    return url ? {
      kind: "video",
      url,
      cover,
      width: payload?.width,
      height: payload?.height,
      duration: payload?.duration,
    } : null;
  }

  if (type === "IMAGE" || Boolean(payload?.url && !isVideoPayload && type === "")) {
    const url = readStringPayload(payload, ["url"]);
    return url ? { kind: "image", url, width: payload?.width, height: payload?.height } : null;
  }

  if (type === "PRODUCT_CARD" || type === "BUYER_ENTER_FROM_PRODUCT") {
    const ids = uniqueIds([
      {
        labelKey: "productIdLabel",
        value: readStringPayload(payload, ["product_id", "productId"]) ??
          readTextId(message.text, [/Product ID:\s*([^\n;]+)/i]),
      },
    ]);
    return ids.length > 0 ? { kind: "product", ids } : null;
  }

  if (type === "ORDER_CARD" || type === "BUYER_ENTER_FROM_ORDER") {
    const ids = uniqueIds([
      {
        labelKey: "orderIdLabel",
        value: readStringPayload(payload, ["order_id", "orderId"]) ??
          readTextId(message.text, [/Order ID:\s*([^\n;]+)/i, /order_no=([^&\s]+)/i]),
      },
    ]);
    return ids.length > 0 ? { kind: "order", ids } : null;
  }

  if (type === "LOGISTICS_CARD") {
    const ids = uniqueIds([
      {
        labelKey: "orderIdLabel",
        value: readStringPayload(payload, ["order_id", "orderId"]) ??
          readTextId(message.text, [/Order ID:\s*([^\n;]+)/i, /order_no=([^&\s]+)/i]),
      },
      {
        labelKey: "packageIdLabel",
        value: readStringPayload(payload, ["package_id", "packageId"]) ??
          readTextId(message.text, [/Package ID:\s*([^\n;]+)/i]),
      },
      {
        labelKey: "trackingIdLabel",
        value: readTextId(message.text, [/Tracking ID:\s*([^\n;]+)/i]),
      },
    ]);
    return ids.length > 0 ? { kind: "logistics", ids } : null;
  }

  return null;
}

function messageClassName(message: ConversationMessage): string {
  const classes = ["cs-message"];
  if (message.isSummaryMessage) {
    classes.push("system", "summary");
    return classes.join(" ");
  }
  const rich = parseRichMessage(message);
  if (message.isSystemMessage && !rich) {
    classes.push("system");
    return classes.join(" ");
  }
  classes.push(message.sender?.role === "BUYER" ? "buyer" : "service");
  if (rich) classes.push("rich", rich.kind === "image" || rich.kind === "video" ? "media" : "card");
  if (message.isRoutineServiceMessage) classes.push("routine");
  return classes.join(" ");
}

function escalationStatusLabel(status: GQL.CsEscalationStatus, t: (key: string) => string): string {
  if (status === GQL.CsEscalationStatus.InProgress) return t("ecommerce.customerServiceWorkspace.statusInProgress");
  if (status === GQL.CsEscalationStatus.Resolved) return t("ecommerce.customerServiceWorkspace.statusResolved");
  if (status === GQL.CsEscalationStatus.Closed) return t("ecommerce.customerServiceWorkspace.statusClosed");
  return t("ecommerce.customerServiceWorkspace.statusPending");
}

function formatCompactDateTime(value?: string | number | null): string {
  if (value == null) return "-";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function shortId(value: string): string {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-5)}`;
}

async function copyTextToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) throw new Error("copy failed");
}
