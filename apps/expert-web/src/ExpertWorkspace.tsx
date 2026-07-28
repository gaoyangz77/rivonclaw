import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { createPortal } from "react-dom";
import { apolloClient } from "./api/client.js";
import {
  CANCEL_EXPERT_RUN,
  CREATE_EXPERT_CONVERSATION,
  DELETE_EXPERT_CONVERSATION,
  DISPATCH_EXPERT_MESSAGE,
  EXPERT_CONVERSATION,
  EXPERT_RUN_EVENTS,
  RENAME_EXPERT_CONVERSATION,
  UPDATE_EXPERT_MESSAGE,
} from "./api/operations.js";
import { useExpertStore } from "./store/context.js";
import { errorMessage } from "./error.js";
import { BrandLogo } from "./BrandLogo.js";
import { LanguageSwitcher, useI18n } from "./i18n.js";
import { Onboarding } from "./Onboarding.js";
import { CheckIcon, CopyIcon, EditIcon, ExpertMarkdown } from "./ExpertMarkdown.js";

interface ConversationData {
  expertConversation: {
    messages: Array<{
      id: string;
      role: "USER" | "ASSISTANT" | "SYSTEM";
      content: string;
      suggestedQuestions: string[];
      editedAt?: string | null;
      createdAt: string;
    }>;
  };
}

interface DispatchData {
  dispatchExpertMessage: { run: { id: string } };
}

interface RunEventData {
  expertRunEvents: {
    sequence: number;
    type: string;
    text?: string;
    toolName?: string;
    suggestedQuestions?: string[];
    errorCode?: string;
  };
}

export const ExpertWorkspace = observer(function ExpertWorkspace({
  reloadBootstrap,
  logout,
  showOnboarding,
}: {
  reloadBootstrap: () => Promise<void>;
  logout: () => Promise<void>;
  showOnboarding: boolean;
}) {
  const store = useExpertStore();
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [conversationMenu, setConversationMenu] = useState<{
    id: string;
    title: string;
    anchor: HTMLButtonElement;
  }>();
  const [renamingConversationId, setRenamingConversationId] = useState<string>();
  const [renameDraft, setRenameDraft] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string>();
  const [messageEditDraft, setMessageEditDraft] = useState("");
  const [savingMessage, setSavingMessage] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string>();
  const [loadingConversationId, setLoadingConversationId] = useState<string>();
  const [loadedConversationId, setLoadedConversationId] = useState<string>();
  const subscriptionRef = useRef<{ unsubscribe(): void } | null>(null);
  const conversationLoadRequestRef = useRef(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const loadConversation = useCallback(
    async (id: string, force = false) => {
      const requestId = ++conversationLoadRequestRef.current;
      setLoadingConversationId(id);
      try {
        const result = await apolloClient.query<ConversationData>({
          query: EXPERT_CONVERSATION,
          variables: { id },
          fetchPolicy: "network-only",
        });
        if (!result.data?.expertConversation) {
          throw new Error("Expert conversation did not return any data");
        }
        if (
          requestId === conversationLoadRequestRef.current &&
          store.selectedConversationId === id &&
          (force || !store.isBusy)
        ) {
          store.replaceMessages(result.data.expertConversation.messages);
          store.setError(undefined);
          setLoadedConversationId(id);
        }
        return true;
      } catch (error) {
        console.error("Unable to load Expert conversation", errorMessage(error));
        if (
          requestId === conversationLoadRequestRef.current &&
          store.selectedConversationId === id
        ) {
          setLoadedConversationId(id);
          store.setError(t("workspace.historyLoadFailed"));
        }
        return false;
      } finally {
        if (requestId === conversationLoadRequestRef.current) {
          setLoadingConversationId(undefined);
        }
      }
    },
    [store, t],
  );

  const stopSubscription = useCallback(() => {
    subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = null;
  }, []);

  useEffect(() => {
    if (store.selectedConversationId && !store.isBusy) {
      void loadConversation(store.selectedConversationId);
    }
  }, [loadConversation, store.isBusy, store.selectedConversationId]);

  useEffect(
    () => () => {
      stopSubscription();
    },
    [stopSubscription],
  );

  useEffect(() => {
    if (!conversationMenu) return;
    function closeMenu(event: PointerEvent) {
      if (
        !(event.target as HTMLElement).closest(".conversation-actions, .conversation-menu-portal")
      ) {
        setConversationMenu(undefined);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setConversationMenu(undefined);
    }
    function closeOnViewportChange() {
      setConversationMenu(undefined);
    }
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    document.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      document.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [conversationMenu]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({
      behavior: store.runPhase === "STREAMING" ? "auto" : "smooth",
      block: "end",
    });
  }, [store.messages.length, store.pendingQuestion, store.runPhase, store.streamingAnswer]);

  useEffect(() => {
    if (!draft && composerRef.current) composerRef.current.style.height = "auto";
  }, [draft]);

  async function createConversation(): Promise<string> {
    setCreating(true);
    try {
      const result = await apolloClient.mutate<{
        createExpertConversation: { id: string; title: string; lastMessageAt: string };
      }>({ mutation: CREATE_EXPERT_CONVERSATION });
      const conversation = result.data?.createExpertConversation;
      if (!conversation) throw new Error("Unable to create a conversation");
      store.addConversation(conversation);
      return conversation.id;
    } finally {
      setCreating(false);
    }
  }

  async function refreshAfterRun(conversationId: string) {
    try {
      const [conversationLoaded] = await Promise.all([
        loadConversation(conversationId, true),
        reloadBootstrap(),
      ]);
      if (!conversationLoaded) store.setError(t("workspace.refreshFailed"));
    } catch (error) {
      console.error("Failed to refresh the completed Expert run", error);
      store.setError(t("workspace.refreshFailed"));
    } finally {
      store.finishRun();
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || store.isBusy) return;
    setDraft("");
    store.prepareRun(question);
    try {
      const conversationId = store.selectedConversationId ?? (await createConversation());
      const result = await apolloClient.mutate<DispatchData>({
        mutation: DISPATCH_EXPERT_MESSAGE,
        variables: {
          conversationId,
          text: question,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      const runId = result.data?.dispatchExpertMessage.run.id;
      if (!runId) throw new Error("The Expert run did not start");
      store.beginRun(runId);
      let lastSequence = 0;
      stopSubscription();
      subscriptionRef.current = apolloClient
        .subscribe<RunEventData>({
          query: EXPERT_RUN_EVENTS,
          variables: { runId, afterSequence: 0 },
        })
        .subscribe({
          next: (value) => {
            const item = value.data?.expertRunEvents;
            if (!item || item.sequence <= lastSequence) return;
            lastSequence = item.sequence;
            if (item.type === "ANSWER_DELTA" && item.text) store.appendDelta(item.text);
            if (item.type === "TOOL_STARTED") store.setRunningTool(item.toolName);
            if (item.type === "TOOL_COMPLETED") store.setRunningTool(undefined);
            if (item.type === "COMPLETED") {
              store.setSuggestedQuestions(item.suggestedQuestions ?? []);
              stopSubscription();
              void refreshAfterRun(conversationId);
            }
            if (item.type === "FAILED" || item.type === "CANCELLED") {
              stopSubscription();
              if (item.type === "CANCELLED" || item.errorCode === "USER_CANCELLED") {
                store.cancelRun(t("workspace.cancelled"));
                void loadConversation(conversationId, true);
              } else {
                console.error("Expert run failed", item.errorCode ?? item.type);
                store.failRun(t("workspace.runFailed"));
              }
              void reloadBootstrap();
            }
          },
          error: (error) => {
            stopSubscription();
            console.error("Expert run event subscription failed", error);
            store.failRun(t("workspace.connectionFailed"));
          },
        });
    } catch (error) {
      console.error("Unable to dispatch Expert question", errorMessage(error));
      store.failRun(t("workspace.startFailed"));
      setDraft(question);
    }
  }

  async function cancel() {
    const runId = store.activeRunId;
    if (!runId || store.runPhase === "CANCELLING") return;
    store.markCancelling();
    try {
      await apolloClient.mutate({
        mutation: CANCEL_EXPERT_RUN,
        variables: { runId },
      });
    } catch (error) {
      console.error("Unable to cancel Expert run", error);
      store.restoreWaitingAfterCancelFailure(t("workspace.cancelFailed"));
    }
  }

  function startNewConversation() {
    if (store.isBusy) return;
    conversationLoadRequestRef.current += 1;
    setLoadingConversationId(undefined);
    setLoadedConversationId(undefined);
    setConversationMenu(undefined);
    setRenamingConversationId(undefined);
    setEditingMessageId(undefined);
    setDraft("");
    store.startNewConversation();
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  function openConversation(id: string) {
    if (store.isBusy) return;
    setConversationMenu(undefined);
    setRenamingConversationId(undefined);
    setEditingMessageId(undefined);
    if (store.selectedConversationId === id) {
      void loadConversation(id, true);
      return;
    }
    setLoadedConversationId(undefined);
    store.selectConversation(id);
  }

  function beginRename(id: string, title: string) {
    setConversationMenu(undefined);
    setRenamingConversationId(id);
    setRenameDraft(title);
  }

  async function renameConversation(event: React.FormEvent, id: string) {
    event.preventDefault();
    const title = renameDraft.trim();
    if (!title) return;
    try {
      const result = await apolloClient.mutate<{
        renameExpertConversation: { id: string; title: string };
      }>({
        mutation: RENAME_EXPERT_CONVERSATION,
        variables: { id, title },
      });
      const conversation = result.data?.renameExpertConversation;
      if (!conversation) throw new Error("Conversation was not renamed");
      store.renameConversation(conversation.id, conversation.title);
      setRenamingConversationId(undefined);
    } catch (error) {
      console.error("Unable to rename Expert conversation", error);
      store.setError(t("workspace.renameFailed"));
    }
  }

  async function deleteConversation(id: string) {
    setConversationMenu(undefined);
    if (!window.confirm(t("workspace.deleteConfirm"))) return;
    try {
      const result = await apolloClient.mutate<{ deleteExpertConversation: boolean }>({
        mutation: DELETE_EXPERT_CONVERSATION,
        variables: { id },
      });
      if (!result.data?.deleteExpertConversation) throw new Error("Conversation was not deleted");
      store.removeConversation(id);
      await reloadBootstrap();
    } catch (error) {
      console.error("Unable to delete Expert conversation", error);
      store.setError(t("workspace.deleteFailed"));
    }
  }

  function beginMessageEdit(id: string, content: string) {
    setEditingMessageId(id);
    setMessageEditDraft(content);
    store.setError(undefined);
  }

  async function saveMessageEdit(event: React.FormEvent, id: string) {
    event.preventDefault();
    const content = messageEditDraft.trim();
    if (!content || savingMessage) return;
    setSavingMessage(true);
    try {
      const result = await apolloClient.mutate<{
        updateExpertMessage: { id: string; content: string; editedAt?: string };
      }>({
        mutation: UPDATE_EXPERT_MESSAGE,
        variables: { id, content },
      });
      const message = result.data?.updateExpertMessage;
      if (!message) throw new Error("Expert message was not updated");
      store.updateMessageContent(message.id, message.content, message.editedAt);
      setEditingMessageId(undefined);
      const latestMessage = store.messages[store.messages.length - 1];
      if (latestMessage?.id === id && latestMessage.role === "USER") {
        await reloadBootstrap();
      }
    } catch (error) {
      console.error("Unable to update Expert message", error);
      store.setError(t("workspace.messageEditFailed"));
    } finally {
      setSavingMessage(false);
    }
  }

  function copyMessage(id: string, content: string) {
    void navigator.clipboard
      .writeText(content)
      .then(() => {
        setCopiedMessageId(id);
        window.setTimeout(() => {
          setCopiedMessageId((current) => (current === id ? undefined : current));
        }, 1400);
      })
      .catch(() => store.setError(t("workspace.copyFailed")));
  }

  const quotaText =
    store.usage?.mode === "FREE_DAILY"
      ? t("workspace.freeQuota", {
          remaining: store.usage.freeRemaining ?? 0,
          limit: store.usage.freeLimit ?? 5,
        })
      : t("workspace.tokenQuota", {
          tokens: Math.min(
            store.usage?.weeklyTokenRemaining ?? 0,
            store.usage?.fiveHourTokenRemaining ?? 0,
          ).toLocaleString(),
        });

  function chooseSuggestedQuestion(question: string) {
    setDraft(question);
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  function suggestedQuestions(questions: readonly string[]) {
    if (questions.length === 0) return null;
    return (
      <div className="suggested-questions">
        <span>{t("workspace.nextQuestions")}</span>
        <div>
          {questions.map((question) => (
            <button key={question} type="button" onClick={() => chooseSuggestedQuestion(question)}>
              {question}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const lastMessage = store.messages[store.messages.length - 1];

  function canEditMessage(message: { id: string; role: "USER" | "ASSISTANT" | "SYSTEM" }) {
    if (store.isBusy || message.id.startsWith("local-") || message.role === "SYSTEM") return false;
    if (message.role === "ASSISTANT") return true;
    return lastMessage?.id === message.id;
  }

  function renderConversationMenu() {
    if (!conversationMenu || !conversationMenu.anchor.isConnected) return null;
    const rect = conversationMenu.anchor.getBoundingClientRect();
    const menuWidth = 152;
    const menuHeight = 94;
    const left = Math.min(Math.max(12, rect.right - menuWidth), window.innerWidth - menuWidth - 12);
    const top =
      rect.bottom + menuHeight + 8 <= window.innerHeight
        ? rect.bottom + 5
        : Math.max(12, rect.top - menuHeight - 5);
    return createPortal(
      <div className="conversation-menu-portal" role="menu" style={{ left, top, width: menuWidth }}>
        <button
          onClick={() => beginRename(conversationMenu.id, conversationMenu.title)}
          role="menuitem"
        >
          {t("workspace.rename")}
        </button>
        <button
          className="danger"
          onClick={() => void deleteConversation(conversationMenu.id)}
          role="menuitem"
        >
          {t("workspace.delete")}
        </button>
      </div>,
      document.body,
    );
  }

  return (
    <main className="workspace">
      <aside className="conversation-sidebar">
        <div className="sidebar-brand">
          <BrandLogo compact />
          <div>
            <strong>{t("brand.expert")}</strong>
            <span>{t("brand.by")}</span>
          </div>
        </div>
        <button
          className="new-conversation"
          disabled={creating || store.isBusy || store.isNewConversationDraft}
          onClick={startNewConversation}
        >
          <span>＋</span> {t("workspace.new")}
        </button>
        <nav aria-label={t("workspace.conversations")}>
          {store.conversations.map((conversation) => {
            const selected = conversation.id === store.selectedConversationId;
            return (
              <div
                className={`conversation-item${selected ? " selected" : ""}`}
                key={conversation.id}
              >
                {renamingConversationId === conversation.id ? (
                  <form
                    className="conversation-rename"
                    onSubmit={(event) => void renameConversation(event, conversation.id)}
                  >
                    <input
                      aria-label={t("workspace.rename")}
                      autoFocus
                      maxLength={120}
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setRenamingConversationId(undefined);
                      }}
                    />
                    <button
                      aria-label={t("workspace.saveRename")}
                      disabled={!renameDraft.trim()}
                      type="submit"
                    >
                      ✓
                    </button>
                    <button
                      aria-label={t("workspace.cancelRename")}
                      onClick={() => setRenamingConversationId(undefined)}
                      type="button"
                    >
                      ×
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      className="conversation-title"
                      disabled={store.isBusy}
                      onClick={() => openConversation(conversation.id)}
                    >
                      {conversation.title}
                    </button>
                    <div className="conversation-actions">
                      <button
                        aria-expanded={conversationMenu?.id === conversation.id}
                        aria-haspopup="menu"
                        aria-label={t("workspace.conversationActions", {
                          title: conversation.title,
                        })}
                        className="conversation-more"
                        disabled={store.isBusy}
                        onClick={(event) => {
                          const anchor = event.currentTarget;
                          setConversationMenu((current) =>
                            current?.id === conversation.id
                              ? undefined
                              : {
                                  id: conversation.id,
                                  title: conversation.title,
                                  anchor,
                                },
                          );
                        }}
                      >
                        ···
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <span>{store.userEmail}</span>
          <button onClick={() => void logout()}>{t("workspace.signOut")}</button>
        </div>
      </aside>

      <section className="chat-column">
        <header className="chat-header">
          <div>
            <p className="eyebrow">{t("brand.expert")}</p>
            <h2>{store.selectedConversation?.title ?? t("workspace.start")}</h2>
          </div>
          <div className="header-actions">
            <button
              aria-label={t("workspace.new")}
              className="mobile-new-conversation"
              disabled={store.isBusy || store.isNewConversationDraft}
              onClick={startNewConversation}
              type="button"
            >
              ＋
            </button>
            <div className="knowledge-chip">
              <span className="live-dot" />
              {t("workspace.knowledge")} {store.knowledgeVersion ?? "local preview"}
            </div>
            <LanguageSwitcher compact />
          </div>
        </header>

        <div
          aria-busy={loadingConversationId === store.selectedConversationId}
          className="message-scroll"
        >
          {store.selectedConversationId &&
          loadedConversationId !== store.selectedConversationId &&
          store.messages.length === 0 &&
          !store.pendingQuestion &&
          !store.streamingAnswer ? (
            <div className="conversation-loading" aria-live="polite">
              <span className="thinking-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>{t("workspace.loadingHistory")}</span>
            </div>
          ) : null}
          {store.messages.length === 0 &&
          !store.pendingQuestion &&
          !store.streamingAnswer &&
          (!store.selectedConversationId ||
            loadedConversationId === store.selectedConversationId) ? (
            <div className="empty-state">
              <p className="eyebrow">{t("workspace.askKicker")}</p>
              <h1>{t("workspace.emptyTitle")}</h1>
              <p>{t("workspace.emptyBody")}</p>
              <div className="starter-grid">
                {[t("workspace.starter1"), t("workspace.starter2"), t("workspace.starter3")].map(
                  (question) => (
                    <button key={question} onClick={() => setDraft(question)}>
                      {question}
                    </button>
                  ),
                )}
              </div>
            </div>
          ) : null}

          {store.messages.map((message) => {
            const editing = editingMessageId === message.id;
            return (
              <article
                aria-label={message.role === "USER" ? t("workspace.you") : t("workspace.expert")}
                className={`message ${message.role.toLowerCase()}${editing ? " editing" : ""}`}
                key={message.id}
              >
                {editing ? (
                  <form
                    className="message-edit-form"
                    onSubmit={(event) => void saveMessageEdit(event, message.id)}
                  >
                    <textarea
                      aria-label={t("workspace.editMessage")}
                      autoFocus
                      maxLength={message.role === "USER" ? 8000 : 64000}
                      onChange={(event) => setMessageEditDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setEditingMessageId(undefined);
                        if (
                          event.key === "Enter" &&
                          (event.metaKey || event.ctrlKey) &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                      value={messageEditDraft}
                    />
                    <div className="message-edit-actions">
                      <button onClick={() => setEditingMessageId(undefined)} type="button">
                        {t("workspace.cancelEdit")}
                      </button>
                      <button
                        className="primary"
                        disabled={!messageEditDraft.trim() || savingMessage}
                        type="submit"
                      >
                        {savingMessage ? t("workspace.savingEdit") : t("workspace.saveEdit")}
                      </button>
                    </div>
                  </form>
                ) : message.role === "USER" ? (
                  <div className="user-message-text">{message.content}</div>
                ) : (
                  <ExpertMarkdown>{message.content}</ExpertMarkdown>
                )}
                {!editing ? (
                  <div className="message-actions">
                    <button
                      aria-label={
                        copiedMessageId === message.id
                          ? t("workspace.copied")
                          : t("workspace.copyMessage")
                      }
                      onClick={() => copyMessage(message.id, message.content)}
                      title={
                        copiedMessageId === message.id
                          ? t("workspace.copied")
                          : t("workspace.copyMessage")
                      }
                      type="button"
                    >
                      {copiedMessageId === message.id ? <CheckIcon /> : <CopyIcon />}
                    </button>
                    {canEditMessage(message) ? (
                      <button
                        aria-label={t("workspace.editMessage")}
                        onClick={() => beginMessageEdit(message.id, message.content)}
                        title={t("workspace.editMessage")}
                        type="button"
                      >
                        <EditIcon />
                      </button>
                    ) : null}
                    {message.editedAt ? <span>{t("workspace.edited")}</span> : null}
                  </div>
                ) : null}
                {message.role === "ASSISTANT" && !editing
                  ? suggestedQuestions(message.suggestedQuestions)
                  : null}
              </article>
            );
          })}

          {store.pendingQuestion ? (
            <article className="message user pending-question">
              <div className="user-message-text">{store.pendingQuestion}</div>
            </article>
          ) : null}

          {store.streamingAnswer ? (
            <article className="message assistant streaming">
              <ExpertMarkdown>{store.streamingAnswer}</ExpertMarkdown>
              {suggestedQuestions(store.pendingSuggestedQuestions)}
            </article>
          ) : null}
          {store.isBusy && !store.streamingAnswer ? (
            <article className="message assistant waiting">
              <div className="thinking-row" aria-live="polite">
                <span className="thinking-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  {store.runPhase === "CANCELLING"
                    ? t("workspace.cancelling")
                    : store.runningTool === "deliver_expert_response"
                      ? t("workspace.preparing")
                      : store.runningTool
                        ? t("workspace.consulting", {
                            tool: store.runningTool.replaceAll("_", " "),
                          })
                        : store.runPhase === "STARTING"
                          ? t("workspace.starting")
                          : t("workspace.thinking")}
                </span>
              </div>
            </article>
          ) : null}
          {store.error ? <p className="chat-error">{store.error}</p> : null}
          {store.notice ? <p className="chat-notice">{store.notice}</p> : null}
          <div ref={messageEndRef} />
        </div>

        <footer className="composer-shell">
          <form className="composer" onSubmit={submit}>
            <textarea
              ref={composerRef}
              value={draft}
              maxLength={8000}
              placeholder={t("workspace.placeholder")}
              rows={1}
              onChange={(event) => {
                setDraft(event.target.value);
                event.currentTarget.style.height = "auto";
                event.currentTarget.style.height = `${Math.min(
                  event.currentTarget.scrollHeight,
                  180,
                )}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            {store.activeRunId ? (
              <button
                className="stop-button"
                disabled={store.runPhase === "CANCELLING"}
                type="button"
                onClick={() => void cancel()}
              >
                {store.runPhase === "CANCELLING"
                  ? t("workspace.cancellingShort")
                  : t("workspace.stop")}
              </button>
            ) : (
              <button
                className="send-button"
                disabled={store.isBusy || !draft.trim()}
                type="submit"
              >
                {store.runPhase === "STARTING"
                  ? t("workspace.startingShort")
                  : t("workspace.submit")}
              </button>
            )}
          </form>
          <div className="composer-meta">
            <span>{quotaText}</span>
            <span>{t("workspace.enterHint")}</span>
          </div>
        </footer>
      </section>
      {renderConversationMenu()}
      {showOnboarding ? <Onboarding onComplete={reloadBootstrap} /> : null}
    </main>
  );
});
