import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
} from "./api/operations.js";
import { useExpertStore } from "./store/context.js";
import { errorMessage } from "./error.js";
import { BrandLogo } from "./BrandLogo.js";
import { LanguageSwitcher, useI18n } from "./i18n.js";
import { Onboarding } from "./Onboarding.js";
import { CheckIcon, CopyIcon, EditIcon, ExpertMarkdown } from "./ExpertMarkdown.js";
import {
  EXPERT_IMAGE_MAX_COUNT,
  getClipboardImageFiles,
  uploadExpertImage,
} from "./api/image-upload.js";
import type { ExpertImageSnapshot, ExpertUsageSnapshot } from "./store/expert-store.js";

interface ConversationData {
  expertConversation: {
    messages: Array<{
      id: string;
      role: "USER" | "ASSISTANT" | "SYSTEM";
      content: string;
      suggestedQuestions: string[];
      editedAt?: string | null;
      createdAt: string;
      imageAssets: ExpertImageSnapshot[];
    }>;
  };
}

interface DispatchData {
  dispatchExpertMessage: {
    run: { id: string };
    usage: ExpertUsageSnapshot;
  };
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

type WorkspaceThemePreference = "system" | "light" | "dark";
type ResolvedWorkspaceTheme = Exclude<WorkspaceThemePreference, "system">;

const WORKSPACE_THEME_STORAGE_KEY = "tkcopilot-expert-theme";
const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

function readThemePreference(): WorkspaceThemePreference {
  try {
    const stored = window.localStorage.getItem(WORKSPACE_THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
  return "system";
}

function ThemeIcon({ preference }: { preference: WorkspaceThemePreference }) {
  if (preference === "system") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect height="13" rx="2.5" width="18" x="3" y="4" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    );
  }
  if (preference === "light") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M20.2 15.3A8.8 8.8 0 0 1 8.7 3.8 8.8 8.8 0 1 0 20.2 15.3Z" />
    </svg>
  );
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
  const [pendingImages, setPendingImages] = useState<ExpertImageSnapshot[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [creating, setCreating] = useState(false);
  const [conversationMenu, setConversationMenu] = useState<{
    id: string;
    title: string;
    anchor: HTMLButtonElement;
  }>();
  const [renamingConversationId, setRenamingConversationId] = useState<string>();
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<{
    id: string;
    title: string;
  }>();
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string>();
  const [messageEditDraft, setMessageEditDraft] = useState("");
  const [savingMessage, setSavingMessage] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string>();
  const [loadingConversationId, setLoadingConversationId] = useState<string>();
  const [loadedConversationId, setLoadedConversationId] = useState<string>();
  const [themePreference, setThemePreference] =
    useState<WorkspaceThemePreference>(readThemePreference);
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia?.(DARK_SCHEME_QUERY).matches ?? false,
  );
  const subscriptionRef = useRef<{ unsubscribe(): void } | null>(null);
  const conversationLoadRequestRef = useRef(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const shouldFollowStreamRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const scrollFrameRef = useRef<number>();
  const isViewingActiveRun =
    store.isBusy &&
    (store.activeRunConversationId
      ? store.selectedConversationId === store.activeRunConversationId
      : store.isNewConversationDraft);
  const isAnotherConversationRunning = store.isBusy && !isViewingActiveRun;
  const visiblePendingQuestion = isViewingActiveRun ? store.pendingQuestion : "";
  const visibleStreamingAnswer = isViewingActiveRun ? store.streamingAnswer : "";
  const resolvedTheme: ResolvedWorkspaceTheme =
    themePreference === "system" ? (systemPrefersDark ? "dark" : "light") : themePreference;

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(DARK_SCHEME_QUERY);
    if (!mediaQuery) return;
    const updateSystemTheme = (event: MediaQueryListEvent | MediaQueryList) => {
      setSystemPrefersDark(event.matches);
    };
    updateSystemTheme(mediaQuery);
    mediaQuery.addEventListener?.("change", updateSystemTheme);
    return () => mediaQuery.removeEventListener?.("change", updateSystemTheme);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.expertTheme = resolvedTheme;
    return () => {
      delete document.documentElement.dataset.expertTheme;
    };
  }, [resolvedTheme]);

  function selectTheme(preference: WorkspaceThemePreference) {
    setThemePreference(preference);
    try {
      if (preference === "system") {
        window.localStorage.removeItem(WORKSPACE_THEME_STORAGE_KEY);
      } else {
        window.localStorage.setItem(WORKSPACE_THEME_STORAGE_KEY, preference);
      }
    } catch {
      // The active choice still applies for this session when storage is unavailable.
    }
  }

  const loadConversation = useCallback(
    async (id: string) => {
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
          store.selectedConversationId === id
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
    if (store.selectedConversationId) {
      void loadConversation(store.selectedConversationId);
    }
  }, [loadConversation, store.selectedConversationId]);

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
    function closeOnResize() {
      setConversationMenu(undefined);
    }
    function closeOnSidebarScroll(event: Event) {
      if (event.target instanceof Element && event.target.closest(".conversation-sidebar")) {
        setConversationMenu(undefined);
      }
    }
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnResize);
    document.addEventListener("scroll", closeOnSidebarScroll, true);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnResize);
      document.removeEventListener("scroll", closeOnSidebarScroll, true);
    };
  }, [conversationMenu]);

  useEffect(() => {
    if (!deleteCandidate) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !deletingConversation) {
        setDeleteCandidate(undefined);
      }
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [deleteCandidate, deletingConversation]);

  useEffect(() => {
    shouldFollowStreamRef.current = true;
    lastScrollTopRef.current = 0;
    if (scrollFrameRef.current !== undefined) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      const container = messageScrollRef.current;
      if (!container) return;
      container.scrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
      lastScrollTopRef.current = container.scrollTop;
      scrollFrameRef.current = undefined;
    });
    return () => {
      if (scrollFrameRef.current !== undefined) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = undefined;
      }
    };
  }, [loadedConversationId, store.selectedConversationId]);

  useEffect(() => {
    if (!isViewingActiveRun || !shouldFollowStreamRef.current) return;
    if (scrollFrameRef.current !== undefined) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      const container = messageScrollRef.current;
      if (!container || !shouldFollowStreamRef.current) return;
      const nextScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
      if (nextScrollTop > container.scrollTop) {
        container.scrollTop = nextScrollTop;
      }
      lastScrollTopRef.current = container.scrollTop;
      scrollFrameRef.current = undefined;
    });
    return () => {
      if (scrollFrameRef.current !== undefined) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = undefined;
      }
    };
  }, [isViewingActiveRun, store.messages.length, store.pendingQuestion, store.streamingAnswer]);

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
        store.selectedConversationId === conversationId
          ? loadConversation(conversationId)
          : Promise.resolve(true),
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

  async function startAgentRun(
    question: string,
    replaceMessageId?: string,
    imageAssets: ExpertImageSnapshot[] = [],
  ) {
    if (replaceMessageId) store.prepareRerun(replaceMessageId, question);
    else store.prepareRun(question, imageAssets);
    const optimisticallyDebited = store.optimisticallyConsumeFreeQuestion();
    const existingConversationId = store.selectedConversationId;
    try {
      const conversationId = existingConversationId ?? (await createConversation());
      store.bindRunConversation(conversationId);
      const result = await apolloClient.mutate<DispatchData>({
        mutation: DISPATCH_EXPERT_MESSAGE,
        variables: {
          conversationId,
          text: question,
          idempotencyKey: crypto.randomUUID(),
          replaceMessageId,
          imageAssetIds: imageAssets.map((image) => image.assetId),
        },
      });
      const dispatch = result.data?.dispatchExpertMessage;
      const runId = dispatch?.run.id;
      if (!runId) throw new Error("The Expert run did not start");
      store.applyUsage(dispatch.usage);
      store.beginRun(runId, conversationId);
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
                if (store.selectedConversationId === conversationId) {
                  void loadConversation(conversationId);
                }
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
      return true;
    } catch (error) {
      console.error("Unable to dispatch Expert question", errorMessage(error));
      if (optimisticallyDebited) store.restoreOptimisticFreeQuestion();
      try {
        await reloadBootstrap();
      } catch (reloadError) {
        console.error("Unable to reconcile Expert quota", reloadError);
      }
      store.failRun(t("workspace.startFailed"));
      if (replaceMessageId && existingConversationId) {
        await loadConversation(existingConversationId);
      } else {
        setDraft(question);
      }
      return false;
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || store.isBusy || uploadingImage) return;
    const images = pendingImages.map((image) => ({ ...image }));
    setDraft("");
    const started = await startAgentRun(question, undefined, images);
    if (started) setPendingImages([]);
  }

  async function addImages(files: readonly File[]) {
    if (files.length === 0 || uploadingImage) return;
    const remaining = EXPERT_IMAGE_MAX_COUNT - pendingImages.length;
    if (remaining <= 0 || files.length > remaining) {
      store.setError(t("workspace.imageLimit"));
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }

    setUploadingImage(true);
    store.setError(undefined);
    try {
      const uploaded = await Promise.all(files.map((file) => uploadExpertImage(file)));
      setPendingImages((current) => [...current, ...uploaded].slice(0, EXPERT_IMAGE_MAX_COUNT));
    } catch (error) {
      console.error("Unable to prepare Expert image", errorMessage(error));
      store.setError(t("workspace.imageUploadFailed"));
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
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
    conversationLoadRequestRef.current += 1;
    setLoadingConversationId(undefined);
    setLoadedConversationId(undefined);
    setConversationMenu(undefined);
    setRenamingConversationId(undefined);
    setEditingMessageId(undefined);
    setDraft("");
    setPendingImages([]);
    store.startNewConversation();
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  function openConversation(id: string) {
    setConversationMenu(undefined);
    setRenamingConversationId(undefined);
    setEditingMessageId(undefined);
    if (store.selectedConversationId === id) {
      void loadConversation(id);
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

  function requestDeleteConversation(id: string, title: string) {
    setConversationMenu(undefined);
    setDeleteCandidate({ id, title });
  }

  async function deleteConversation() {
    if (!deleteCandidate || deletingConversation) return;
    const { id } = deleteCandidate;
    setDeletingConversation(true);
    try {
      const result = await apolloClient.mutate<{ deleteExpertConversation: boolean }>({
        mutation: DELETE_EXPERT_CONVERSATION,
        variables: { id },
      });
      if (!result.data?.deleteExpertConversation) throw new Error("Conversation was not deleted");
      store.removeConversation(id);
      setDeleteCandidate(undefined);
      await reloadBootstrap();
    } catch (error) {
      console.error("Unable to delete Expert conversation", error);
      store.setError(t("workspace.deleteFailed"));
    } finally {
      setDeletingConversation(false);
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
      const started = await startAgentRun(content, id);
      if (started) setEditingMessageId(undefined);
    } catch (error) {
      console.error("Unable to resubmit Expert message", error);
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

  function imageGrid(images: readonly ExpertImageSnapshot[], removable = false) {
    const visibleImages = images.filter((image) => image.publicUrl);
    if (visibleImages.length === 0) return null;
    return (
      <div className="message-image-grid">
        {visibleImages.map((image) => (
          <figure key={image.assetId}>
            <img
              alt=""
              height={image.height}
              loading="lazy"
              src={image.publicUrl ?? undefined}
              width={image.width}
            />
            {removable ? (
              <button
                aria-label={t("workspace.removeImage")}
                onClick={() =>
                  setPendingImages((current) =>
                    current.filter((item) => item.assetId !== image.assetId),
                  )
                }
                type="button"
              >
                ×
              </button>
            ) : null}
          </figure>
        ))}
      </div>
    );
  }

  const lastUserMessage = [...store.messages].reverse().find((message) => message.role === "USER");

  function canEditMessage(message: { id: string; role: "USER" | "ASSISTANT" | "SYSTEM" }) {
    return (
      !store.isBusy &&
      message.role === "USER" &&
      !message.id.startsWith("local-") &&
      lastUserMessage?.id === message.id
    );
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
          disabled={conversationMenu.id === store.activeRunConversationId}
          onClick={() => requestDeleteConversation(conversationMenu.id, conversationMenu.title)}
          role="menuitem"
          title={
            conversationMenu.id === store.activeRunConversationId
              ? t("workspace.runningDeleteUnavailable")
              : undefined
          }
        >
          {t("workspace.delete")}
        </button>
      </div>,
      document.body,
    );
  }

  return (
    <main className="workspace" data-theme={resolvedTheme}>
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
          disabled={creating || store.isNewConversationDraft}
          onClick={startNewConversation}
        >
          <span>＋</span> {t("workspace.new")}
        </button>
        <nav aria-label={t("workspace.conversations")}>
          {store.conversations.map((conversation) => {
            const selected = conversation.id === store.selectedConversationId;
            const running = conversation.id === store.activeRunConversationId;
            return (
              <div
                className={`conversation-item${selected ? " selected" : ""}${
                  running ? " running" : ""
                }`}
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
                      aria-label={conversation.title}
                      className="conversation-title"
                      onClick={() => openConversation(conversation.id)}
                      onDoubleClick={() => beginRename(conversation.id, conversation.title)}
                    >
                      <span className="conversation-title-label">{conversation.title}</span>
                      {running ? (
                        <span
                          aria-label={t("workspace.conversationRunning", {
                            title: conversation.title,
                          })}
                          className="conversation-run-spinner"
                          role="status"
                        />
                      ) : null}
                    </button>
                    <div className="conversation-actions">
                      <button
                        aria-expanded={conversationMenu?.id === conversation.id}
                        aria-haspopup="menu"
                        aria-label={t("workspace.conversationActions", {
                          title: conversation.title,
                        })}
                        className="conversation-more"
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
              disabled={store.isNewConversationDraft}
              onClick={startNewConversation}
              type="button"
            >
              ＋
            </button>
            <div className="knowledge-chip">
              <span className="live-dot" />
              {t("workspace.knowledge")} {store.knowledgeVersion ?? "local preview"}
            </div>
            <div aria-label={t("workspace.theme")} className="theme-switcher" role="group">
              {(["system", "light", "dark"] as const).map((preference) => (
                <button
                  aria-label={t(`workspace.theme.${preference}`)}
                  aria-pressed={themePreference === preference}
                  key={preference}
                  onClick={() => selectTheme(preference)}
                  title={t(`workspace.theme.${preference}`)}
                  type="button"
                >
                  <ThemeIcon preference={preference} />
                </button>
              ))}
            </div>
            <LanguageSwitcher compact />
          </div>
        </header>

        <div
          aria-busy={loadingConversationId === store.selectedConversationId}
          className="message-scroll"
          onScroll={(event) => {
            const container = event.currentTarget;
            const movingUp = container.scrollTop < lastScrollTopRef.current - 2;
            const distanceFromBottom =
              container.scrollHeight - container.clientHeight - container.scrollTop;
            if (movingUp) {
              shouldFollowStreamRef.current = false;
              if (scrollFrameRef.current !== undefined) {
                window.cancelAnimationFrame(scrollFrameRef.current);
                scrollFrameRef.current = undefined;
              }
            }
            if (distanceFromBottom <= 72) {
              shouldFollowStreamRef.current = true;
            }
            lastScrollTopRef.current = container.scrollTop;
          }}
          onWheel={(event) => {
            if (event.deltaY < 0) {
              shouldFollowStreamRef.current = false;
              if (scrollFrameRef.current !== undefined) {
                window.cancelAnimationFrame(scrollFrameRef.current);
                scrollFrameRef.current = undefined;
              }
            }
          }}
          ref={messageScrollRef}
        >
          {store.selectedConversationId &&
          loadedConversationId !== store.selectedConversationId &&
          store.messages.length === 0 &&
          !visiblePendingQuestion &&
          !visibleStreamingAnswer ? (
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
          !visiblePendingQuestion &&
          !visibleStreamingAnswer &&
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
                      maxLength={8000}
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
                        {savingMessage ? t("workspace.resubmitting") : t("workspace.resubmit")}
                      </button>
                    </div>
                  </form>
                ) : message.role === "USER" ? (
                  <div className="user-message-bubble">
                    {imageGrid(message.imageAssets)}
                    <div className="user-message-text">{message.content}</div>
                  </div>
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

          {visiblePendingQuestion ? (
            <article className="message user pending-question">
              <div className="user-message-bubble">
                {imageGrid(store.pendingImageAssets)}
                <div className="user-message-text">{visiblePendingQuestion}</div>
              </div>
            </article>
          ) : null}

          {visibleStreamingAnswer ? (
            <article className="message assistant streaming">
              <ExpertMarkdown>{visibleStreamingAnswer}</ExpertMarkdown>
              {suggestedQuestions(store.pendingSuggestedQuestions)}
            </article>
          ) : null}
          {isViewingActiveRun && !visibleStreamingAnswer ? (
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
                    : store.runningTool === "set_expert_followups"
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
          <div />
        </div>

        <footer className="composer-shell">
          <form className="composer" onSubmit={submit}>
            {imageGrid(pendingImages, true)}
            <div className="composer-input-row">
              <input
                accept="image/jpeg,image/png,image/webp"
                aria-label={t("workspace.attachImage")}
                className="composer-file-input"
                multiple
                onChange={(event) => void addImages(Array.from(event.currentTarget.files ?? []))}
                ref={imageInputRef}
                type="file"
              />
              <button
                aria-label={t("workspace.attachImage")}
                className="attach-image-button"
                disabled={
                  store.isBusy || uploadingImage || pendingImages.length >= EXPERT_IMAGE_MAX_COUNT
                }
                onClick={() => imageInputRef.current?.click()}
                title={t("workspace.attachImage")}
                type="button"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M8.5 12.5 14.9 6a3.5 3.5 0 0 1 5 5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8-8" />
                </svg>
              </button>
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
                onPaste={(event) => {
                  const images = getClipboardImageFiles(event.clipboardData.files);
                  if (images.length === 0) return;
                  event.preventDefault();
                  void addImages(images);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              {isViewingActiveRun && store.activeRunId ? (
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
                  disabled={store.isBusy || uploadingImage || !draft.trim()}
                  type="submit"
                >
                  {isViewingActiveRun && store.runPhase === "STARTING"
                    ? t("workspace.startingShort")
                    : isAnotherConversationRunning
                      ? t("workspace.runningElsewhereShort")
                      : t("workspace.submit")}
                </button>
              )}
            </div>
          </form>
          <div className="composer-meta">
            <span>
              {uploadingImage
                ? t("workspace.imageUploading")
                : pendingImages.length > 0
                  ? t("workspace.imageHint")
                  : quotaText}
            </span>
            <span>
              {isAnotherConversationRunning
                ? t("workspace.runningElsewhere")
                : t("workspace.enterHint")}
            </span>
          </div>
        </footer>
      </section>
      {renderConversationMenu()}
      {deleteCandidate
        ? createPortal(
            <div
              className="conversation-delete-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !deletingConversation) {
                  setDeleteCandidate(undefined);
                }
              }}
            >
              <section
                aria-describedby="conversation-delete-description"
                aria-labelledby="conversation-delete-title"
                aria-modal="true"
                className="conversation-delete-dialog"
                role="alertdialog"
              >
                <div className="conversation-delete-mark" aria-hidden="true">
                  !
                </div>
                <div>
                  <h2 id="conversation-delete-title">{t("workspace.deleteTitle")}</h2>
                  <p id="conversation-delete-description">
                    {t("workspace.deleteBody", {
                      title: deleteCandidate.title,
                    })}
                  </p>
                </div>
                <div className="conversation-delete-actions">
                  <button
                    autoFocus
                    disabled={deletingConversation}
                    onClick={() => setDeleteCandidate(undefined)}
                    type="button"
                  >
                    {t("workspace.deleteCancel")}
                  </button>
                  <button
                    className="danger"
                    disabled={deletingConversation}
                    onClick={() => void deleteConversation()}
                    type="button"
                  >
                    {deletingConversation ? t("workspace.deleting") : t("workspace.delete")}
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
      {showOnboarding ? <Onboarding onComplete={reloadBootstrap} /> : null}
    </main>
  );
});
