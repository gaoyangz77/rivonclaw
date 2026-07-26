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

interface ConversationData {
  expertConversation: {
    messages: Array<{
      id: string;
      role: "USER" | "ASSISTANT" | "SYSTEM";
      content: string;
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
    errorCode?: string;
  };
}

export const ExpertWorkspace = observer(function ExpertWorkspace({
  reloadBootstrap,
  logout,
}: {
  reloadBootstrap: () => Promise<void>;
  logout: () => Promise<void>;
}) {
  const store = useExpertStore();
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const subscriptionRef = useRef<{ unsubscribe(): void } | null>(null);

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
      ? `${store.usage.freeRemaining ?? 0} of ${store.usage.freeLimit ?? 5} questions left today`
      : `${Math.min(
          store.usage?.weeklyTokenRemaining ?? 0,
          store.usage?.fiveHourTokenRemaining ?? 0,
        ).toLocaleString()} tokens available`;

  return (
    <main className="workspace">
      <aside className="conversation-sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark small">R</div>
          <div>
            <strong>Expert</strong>
            <span>by RivonClaw</span>
          </div>
        </div>
        <button className="new-conversation" disabled={creating} onClick={() => void createConversation()}>
          <span>＋</span> New conversation
        </button>
        <nav aria-label="Conversations">
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
          <button onClick={() => void logout()}>Sign out</button>
        </div>
      </aside>

      <section className="chat-column">
        <header className="chat-header">
          <div>
            <p className="eyebrow">TikTok Shop Expert</p>
            <h2>{store.selectedConversation?.title ?? "Start a decision"}</h2>
          </div>
          <div className="knowledge-chip">
            <span className="live-dot" />
            Knowledge {store.knowledgeVersion ?? "local preview"}
          </div>
        </header>

        <div className="message-scroll">
          {store.messages.length === 0 && !store.streamingAnswer ? (
            <div className="empty-state">
              <p className="eyebrow">Ask for a decision, not a definition</p>
              <h1>What are you trying to make true?</h1>
              <p>
                Share your market, constraints, timeline, and what you have already ruled out. The
                Expert will take a position and show you how to validate it.
              </p>
              <div className="starter-grid">
                {[
                  "Which market fits my capital and operating constraints?",
                  "What must be true before I commit inventory?",
                  "Design a 30-day validation plan for my first product.",
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
              <span className="message-role">{message.role === "USER" ? "You" : "Expert"}</span>
              <div className="markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              </div>
            </article>
          ))}

          {store.streamingAnswer ? (
            <article className="message assistant streaming">
              <span className="message-role">Expert</span>
              <div className="markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{store.streamingAnswer}</ReactMarkdown>
              </div>
            </article>
          ) : null}
          {store.runningTool ? (
            <p className="run-status">Consulting {store.runningTool.replaceAll("_", " ")}…</p>
          ) : null}
          {store.error ? <p className="chat-error">{store.error}</p> : null}
        </div>

        <footer className="composer-shell">
          <form className="composer" onSubmit={submit}>
            <textarea
              value={draft}
              maxLength={8000}
              placeholder="Describe the decision, your context, and constraints…"
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
                Stop
              </button>
            ) : (
              <button className="send-button" disabled={!draft.trim()} type="submit">
                Ask
              </button>
            )}
          </form>
          <div className="composer-meta">
            <span>{quotaText}</span>
            <span>Enter to send · Shift + Enter for a new line</span>
          </div>
        </footer>
      </section>
    </main>
  );
});
