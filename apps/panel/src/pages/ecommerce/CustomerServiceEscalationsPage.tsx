import { useEffect, useMemo } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { Select } from "../../components/inputs/Select.js";
import { Modal } from "../../components/modals/Modal.js";
import { useToast } from "../../components/Toast.js";
import { CheckIcon, CopyIcon, InfoIcon } from "../../components/icons.js";
import { panelEventBus } from "../../lib/event-bus.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import type {
  ConversationAiFilter,
  ConversationStatusFilter,
  EscalationStatusFilter,
} from "../../store/models/CustomerServiceWorkspaceModel.js";

type Conversation = GQL.CustomerServiceConversationInboxItem;
type ConversationMessage = GQL.CustomerServiceMessageSummary & { isRoutineServiceMessage?: boolean };
type Escalation = GQL.CsEscalation;

export const CustomerServiceEscalationsPage = observer(function CustomerServiceWorkspacePage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const workspace = entityStore.customerServiceWorkspace;
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
    workspace.fetchConversationMessages(i18n.language);
  }, [workspace, workspace.selectedConversationId, i18n.language]);

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

  const conversationItems = workspace.filteredConversationItems as Conversation[];
  const conversationMessages = workspace.displayConversationMessages as ConversationMessage[];
  const selectedConversation = workspace.selectedConversation as Conversation | null;
  const selectedEscalation = workspace.selectedEscalation as Escalation | null;

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
                { value: "pending", label: t("ecommerce.customerServiceWorkspace.statusPending") },
                { value: "resolved", label: t("ecommerce.customerServiceWorkspace.statusResolved") },
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

          <div className="cs-conversation-shell">
            <div className="cs-conversation-list">
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
                      className={selectedConversation?.conversationId === item.conversationId ? "cs-conversation-row active" : "cs-conversation-row"}
                      key={`${item.shopId}:${item.conversationId}`}
                      type="button"
                      onClick={() => workspace.selectConversation(item.conversationId)}
                    >
                      <span className="cs-conversation-meta">
                        <span>{shopLabel(item.shopId)}</span>
                        <span>{item.latestMessageTime ? formatCompactDateTime(item.latestMessageTime) : "-"}</span>
                      </span>
                      <span className="cs-conversation-row-head">
                        <strong>{buyerLabel(item)}</strong>
                        <span className={item.status === GQL.CustomerServiceConversationStatus.Pending ? "badge badge-warning" : "badge badge-info"}>
                          {conversationStatusLabel(item.status, t)}
                        </span>
                      </span>
                      <span className="cs-conversation-preview">{item.latestMessagePreview || t("ecommerce.customerServiceWorkspace.noPreview")}</span>
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

            <div className="cs-conversation-detail">
              {selectedConversation ? (
                <>
                  <div className="cs-conversation-summary">
                    <div className="cs-conversation-detail-head">
                      <div>
                        <h2>{buyerLabel(selectedConversation)}</h2>
                        <p>{shopLabel(selectedConversation.shopId)}</p>
                      </div>
                    </div>
                    <div className="cs-conversation-tools">
                      <span className={selectedConversation.aiEnabled ? "badge badge-success" : "badge badge-muted"}>
                        {selectedConversation.aiEnabled ? t("ecommerce.customerServiceWorkspace.aiEnabled") : t("ecommerce.customerServiceWorkspace.aiDisabled")}
                      </span>
                      <div className="cs-conversation-more">
                        <button className="btn btn-secondary btn-sm cs-conversation-more-trigger" type="button">
                          {t("ecommerce.customerServiceWorkspace.details")}
                        </button>
                        <div className="cs-conversation-popover">
                          <div className="cs-conversation-popover-actions">
                            <button
                              className="btn btn-secondary btn-sm"
                              type="button"
                              onClick={() => void toggleConversationAi(selectedConversation)}
                              disabled={workspace.isConversationAiUpdating(selectedConversation.conversationId)}
                            >
                              {selectedConversation.aiEnabled
                                ? t("ecommerce.customerServiceWorkspace.disableAi")
                                : t("ecommerce.customerServiceWorkspace.enableAi")}
                            </button>
                            <button
                              className="btn btn-primary btn-sm"
                              type="button"
                              onClick={() => void startConversation(selectedConversation)}
                              disabled={workspace.isConversationStarting(selectedConversation.conversationId)}
                            >
                              {workspace.isConversationStarting(selectedConversation.conversationId)
                                ? t("common.loading")
                                : t("ecommerce.customerServiceWorkspace.startAi")}
                            </button>
                          </div>
                          <div className="cs-conversation-facts">
                            <CopyMetaButton label={t("ecommerce.customerServiceWorkspace.conversation")} value={selectedConversation.conversationId} copied={workspace.copiedMeta === `${t("ecommerce.customerServiceWorkspace.conversation")}:${selectedConversation.conversationId}`} onCopy={copyMeta} />
                            {selectedConversation.buyerUserId && <CopyMetaButton label={t("ecommerce.customerServiceWorkspace.buyer")} value={selectedConversation.buyerUserId} copied={workspace.copiedMeta === `${t("ecommerce.customerServiceWorkspace.buyer")}:${selectedConversation.buyerUserId}`} onCopy={copyMeta} />}
                            {selectedConversation.buyerImUserId && <CopyMetaButton label={t("ecommerce.customerServiceWorkspace.buyerIm")} value={selectedConversation.buyerImUserId} copied={workspace.copiedMeta === `${t("ecommerce.customerServiceWorkspace.buyerIm")}:${selectedConversation.buyerImUserId}`} onCopy={copyMeta} />}
                            {selectedConversation.buyerNickname && <CopyMetaButton label={t("ecommerce.customerServiceWorkspace.buyerAlias")} value={selectedConversation.buyerNickname} copied={workspace.copiedMeta === `${t("ecommerce.customerServiceWorkspace.buyerAlias")}:${selectedConversation.buyerNickname}`} onCopy={copyMeta} />}
                            {selectedConversation.orderId && <CopyMetaButton label={t("ecommerce.customerServiceWorkspace.order")} value={selectedConversation.orderId} copied={workspace.copiedMeta === `${t("ecommerce.customerServiceWorkspace.order")}:${selectedConversation.orderId}`} onCopy={copyMeta} />}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="cs-message-panel">
                    <div className="cs-message-panel-head">
                      <strong>{t("ecommerce.customerServiceWorkspace.messages")}</strong>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => workspace.fetchConversationMessages(i18n.language)} disabled={workspace.conversationMessagesLoading}>
                        {t("ecommerce.customerServiceWorkspace.refresh")}
                      </button>
                    </div>
                    {workspace.conversationMessagesError && <div className="form-error">{workspace.conversationMessagesError}</div>}
                    {workspace.conversationMessagesLoading && workspace.conversationMessages.length === 0 ? (
                      <div className="affiliate-proposal-empty">{t("common.loading")}</div>
                    ) : workspace.conversationMessages.length === 0 ? (
                      <div className="affiliate-proposal-empty">{t("ecommerce.customerServiceWorkspace.noMessages")}</div>
                    ) : (
                      <div className="cs-message-list">
                        {conversationMessages.map((message) => (
                          <div className={messageClassName(message)} key={message.messageId ?? `${message.createTime}-${message.text}`}>
                            <div className="cs-message-meta">
                              <span>{message.sender?.nickname || message.sender?.role || "-"}</span>
                              <span>{message.createTime ? formatCompactDateTime(message.createTime) : ""}</span>
                            </div>
                            <p>{message.text || message.type || "-"}</p>
                          </div>
                        ))}
                      </div>
                    )}
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
        onClose={() => workspace.selectEscalation(null)}
        title={selectedEscalation ? selectedEscalation.id : t("ecommerce.customerServiceWorkspace.title")}
        maxWidth={920}
      >
        {selectedEscalation && (
          <EscalationDetailModal
            selected={selectedEscalation}
            shopLabel={shopLabel}
            copyMeta={copyMeta}
            respondToEscalation={respondToEscalation}
          />
        )}
      </Modal>
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
}: {
  selected: Escalation;
  shopLabel: (shopId: string) => string;
  copyMeta: (label: string, value: string) => Promise<void>;
  respondToEscalation: () => Promise<void>;
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
            <div className="cs-escalation-modal-nav">
              <button className="btn btn-secondary" type="button" onClick={() => workspace.goToPreviousEscalation()} disabled={!workspace.hasPreviousEscalation || workspace.respondingEscalation}>
                {t("ecommerce.customerServiceWorkspace.previousEscalation")}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => workspace.goToNextEscalation()} disabled={!workspace.hasNextEscalation || workspace.respondingEscalation}>
                {t("ecommerce.customerServiceWorkspace.nextEscalation")}
              </button>
            </div>
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
  if (status === GQL.CustomerServiceConversationStatus.Resolved) return t("ecommerce.customerServiceWorkspace.statusResolved");
  return t("ecommerce.customerServiceWorkspace.statusPending");
}

function messageClassName(message: ConversationMessage): string {
  const classes = ["cs-message"];
  classes.push(message.sender?.role === "BUYER" ? "buyer" : "service");
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
