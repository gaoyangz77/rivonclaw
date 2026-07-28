import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apolloClient } from "./api/client.js";
import {
  CANCEL_EXPERT_RUN,
  CREATE_EXPERT_CONVERSATION,
  DISPATCH_EXPERT_MESSAGE,
  EXPERT_CONVERSATION,
  EXPERT_RUN_EVENTS,
} from "./api/operations.js";
import { useExpertStore } from "./store/context.js";
import { errorMessage } from "./error.js";
import { BrandLogo } from "./BrandLogo.js";
import { LanguageSwitcher, useI18n } from "./i18n.js";
import { Onboarding } from "./Onboarding.js";

interface ConversationData {
  expertConversation: {
    messages: Array<{
      id: string;
      role: "USER" | "ASSISTANT" | "SYSTEM";
      content: string;
      suggestedQuestions: string[];
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
  const subscriptionRef = useRef<{ unsubscribe(): void } | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const loadConversation = useCallback(async (id: string) => {
    const result = await apolloClient.query<ConversationData>({
      query: EXPERT_CONVERSATION,
      variables: { id },
      fetchPolicy: "network-only",
    });
    if (result.data?.expertConversation) {
      store.replaceMessages(result.data.expertConversation.messages);
    }
  }, [store]);

  useEffect(() => {
    if (store.selectedConversationId) void loadConversation(store.selectedConversationId);
  }, [loadConversation, store.selectedConversationId]);

  useEffect(
    () => () => {
      subscriptionRef.current?.unsubscribe();
    },
    [],
  );

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
    await Promise.all([loadConversation(conversationId), reloadBootstrap()]);
    store.finishRun();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || store.activeRunId) return;
    setDraft("");
    store.setError(undefined);
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
      store.beginRun(runId, question);
      let lastSequence = 0;
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
              subscriptionRef.current?.unsubscribe();
              void refreshAfterRun(conversationId);
            }
            if (item.type === "FAILED" || item.type === "CANCELLED") {
              subscriptionRef.current?.unsubscribe();
              store.failRun(item.errorCode ?? item.type);
              void reloadBootstrap();
            }
          },
          error: (error) => store.failRun(errorMessage(error)),
        });
    } catch (error) {
      store.failRun(errorMessage(error));
      setDraft(question);
    }
  }

  async function cancel() {
    if (!store.activeRunId) return;
    await apolloClient.mutate({
      mutation: CANCEL_EXPERT_RUN,
      variables: { runId: store.activeRunId },
    });
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
        <button className="new-conversation" disabled={creating} onClick={() => void createConversation()}>
          <span>＋</span> {t("workspace.new")}
        </button>
        <nav aria-label={t("workspace.conversations")}>
          {store.conversations.map((conversation) => (
            <button
              className={conversation.id === store.selectedConversationId ? "selected" : ""}
              key={conversation.id}
              onClick={() => store.selectConversation(conversation.id)}
            >
              {conversation.title}
            </button>
          ))}
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
            <div className="knowledge-chip">
              <span className="live-dot" />
              {t("workspace.knowledge")} {store.knowledgeVersion ?? "local preview"}
            </div>
            <LanguageSwitcher compact />
          </div>
        </header>

        <div className="message-scroll">
          {store.messages.length === 0 && !store.streamingAnswer ? (
            <div className="empty-state">
              <p className="eyebrow">{t("workspace.askKicker")}</p>
              <h1>{t("workspace.emptyTitle")}</h1>
              <p>{t("workspace.emptyBody")}</p>
              <div className="starter-grid">
                {[
                  t("workspace.starter1"),
                  t("workspace.starter2"),
                  t("workspace.starter3"),
                ].map((question) => (
                  <button key={question} onClick={() => setDraft(question)}>
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {store.messages.map((message) => (
            <article className={`message ${message.role.toLowerCase()}`} key={message.id}>
              <span className="message-role">
                {message.role === "USER" ? t("workspace.you") : t("workspace.expert")}
              </span>
              <div className="markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              </div>
              {message.role === "ASSISTANT"
                ? suggestedQuestions(message.suggestedQuestions)
                : null}
            </article>
          ))}

          {store.streamingAnswer ? (
            <article className="message assistant streaming">
              <span className="message-role">{t("workspace.expert")}</span>
              <div className="markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{store.streamingAnswer}</ReactMarkdown>
              </div>
              {suggestedQuestions(store.pendingSuggestedQuestions)}
            </article>
          ) : null}
          {store.runningTool ? (
            <p className="run-status">
              {store.runningTool === "deliver_expert_response"
                ? t("workspace.preparing")
                : t("workspace.consulting", {
                    tool: store.runningTool.replaceAll("_", " "),
                  })}
            </p>
          ) : null}
          {store.error ? <p className="chat-error">{store.error}</p> : null}
        </div>

        <footer className="composer-shell">
          <form className="composer" onSubmit={submit}>
            <textarea
              ref={composerRef}
              value={draft}
              maxLength={8000}
              placeholder={t("workspace.placeholder")}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            {store.activeRunId ? (
              <button className="stop-button" type="button" onClick={() => void cancel()}>
                {t("workspace.stop")}
              </button>
            ) : (
              <button className="send-button" disabled={!draft.trim()} type="submit">
                {t("workspace.ask")}
              </button>
            )}
          </form>
          <div className="composer-meta">
            <span>{quotaText}</span>
            <span>{t("workspace.enterHint")}</span>
          </div>
        </footer>
      </section>
      {showOnboarding ? <Onboarding onComplete={reloadBootstrap} /> : null}
    </main>
  );
});
