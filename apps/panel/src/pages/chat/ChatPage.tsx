import { useState, useEffect, useRef, useCallback, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { trackEvent } from "../../api/index.js";
import { useRuntimeStatus } from "../../store/RuntimeStatusProvider.js";
import { formatError } from "@rivonclaw/core";
import type { ChatImage } from "./chat-utils.js";
import type { SessionsListResult } from "./chat-utils.js";
import { localizeError } from "./chat-utils.js";
import { saveImages, clearImages } from "./image-cache.js";
import { Modal } from "../../components/modals/Modal.js";
import { useSessionManager } from "./useSessionManager.js";
import { SessionTabBar } from "./SessionTabBar.js";
import type { GatewaySessionInfo } from "./SessionTabBar.js";
import { ChatInputArea } from "./ChatInputArea.js";
import { observer } from "mobx-react-lite";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { setRunProfileForScope } from "../../api/tool-registry.js";
import type { GatewayChatClient } from "../../lib/gateway-client.js";
import { SessionTrackerMap } from "./run-tracker.js";
import { useChatExamples } from "./hooks/useChatExamples.js";
import { useChatTranscript } from "./hooks/useChatTranscript.js";
import { useChatRunLifecycle } from "./hooks/useChatRunLifecycle.js";
import { useChatModelControls } from "./hooks/useChatModelControls.js";
import { useChatConnection } from "./hooks/useChatConnection.js";
import type { ConnectionState } from "./hooks/useChatConnection.js";
import { ChatMessageList } from "./components/ChatMessageList.js";
import { ChatStatusBar } from "./components/ChatStatusBar.js";
import { ChatExamples } from "./components/ChatExamples.js";
import { ChatResetModal } from "./components/ChatResetModal.js";
import { ChatContextOverflowModal } from "./components/ChatContextOverflowModal.js";
import "./ChatPage.css";

export const ChatPage = observer(function ChatPage({ onAgentNameChange }: { onAgentNameChange?: (name: string | null) => void }) {
  const { t } = useTranslation();
  const runtimeStatus = useRuntimeStatus();
  const tRef = useRef(t);
  tRef.current = t;
  const entityStore = useEntityStore();
  const runProfiles = entityStore.allRunProfiles;

  // Chat display settings -- read reactively from MST store (populated via SSE)
  const showAgentEvents = runtimeStatus.appSettings.chatShowAgentEvents;
  const preserveToolEvents = runtimeStatus.appSettings.chatPreserveToolEvents;
  const collapseMessages = runtimeStatus.appSettings.chatCollapseMessages;

  // --- Shared state (owned by ChatPage, passed to hooks) ---
  const [draft, setDraft] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [selectedRunProfileId, setSelectedRunProfileId] = useState("");
  const selectedRunProfileIdRef = useRef(selectedRunProfileId);
  const [renderTick, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [agentName, setAgentName] = useState<string | null>(null);

  // Shared refs created at ChatPage level -- passed to multiple hooks
  const clientRef = useRef<GatewayChatClient | null>(null);
  const trackerMapRef = useRef(new SessionTrackerMap(forceUpdate));
  const trackerRef = useRef(trackerMapRef.current.get("agent:main:main"));
  const sessionKeyRef = useRef("agent:main:main");

  // --- Chat examples ---
  const examples = useChatExamples();

  // --- Transcript (messages, scroll, history loading) ---
  const transcript = useChatTranscript({
    clientRef,
    sessionKeyRef,
    renderTick,
  });

  // --- Run lifecycle (handleEvent, watchdog, external pending) ---
  // Stable refs for sessionManager callbacks (updated each render below)
  const markUnreadRef = useRef<(key: string) => void>(() => {});
  const refreshSessionsRef = useRef<() => void>(() => {});
  const sessionKeysRef = useRef<Set<string>>(new Set());

  const lifecycle = useChatRunLifecycle({
    sessionKeyRef,
    clientRef,
    trackerMapRef,
    trackerRef,
    setMessages: transcript.setMessages,
    loadHistory: transcript.loadHistory,
    markUnreadRef,
    refreshSessionsRef,
    sessionKeysRef,
    tRef,
  });

  // --- Session manager -- event-driven refresh of session tabs, handles switching + caching ---
  const sessionManager = useSessionManager({
    clientRef,
    connected: connectionState === "connected",
    getState: () => ({
      messages: transcript.messages,
      draft,
      pendingImages: transcript.pendingImages,
      visibleCount: transcript.visibleCount,
      allFetched: transcript.allFetched,
      selectedRunProfileId: selectedRunProfileIdRef.current,
    }),
    setState: (state) => {
      transcript.resetForSessionSwitch({
        messages: state.messages,
        pendingImages: state.pendingImages,
        visibleCount: state.visibleCount,
        allFetched: state.allFetched,
      });
      setDraft(state.draft);
      const restoredProfileId = state.selectedRunProfileId ?? "";
      setSelectedRunProfileId(restoredProfileId);
      selectedRunProfileIdRef.current = restoredProfileId;
      lifecycle.resetExternalPending();
    },
  });

  // Wire session manager refs for lifecycle hook (updated every render to stay fresh)
  markUnreadRef.current = sessionManager.markUnread;
  refreshSessionsRef.current = sessionManager.refreshSessions;
  sessionKeysRef.current = new Set(sessionManager.sessions.map((s) => s.key));

  // Keep sessionKeyRef in sync with session manager
  sessionKeyRef.current = sessionManager.activeSessionKey;

  // Point trackerRef at the active session's tracker (per-session isolation)
  trackerRef.current = trackerMapRef.current.get(sessionManager.activeSessionKey);

  // Derive run lifecycle state from the ACTIVE session's tracker
  const view = trackerMapRef.current.getView(sessionManager.activeSessionKey);
  const runId = view.localRunId;
  const streaming = view.displayStreaming;

  // --- Connection (WebSocket + SSE bridge) ---
  useChatConnection({
    loadHistory: transcript.loadHistory,
    handleEvent: lifecycle.handleEvent,
    clientRef,
    setConnectionState,
    setAgentName,
    setMessages: transcript.setMessages,
    setExternalPending: lifecycle.setExternalPendingValue,
    externalPendingRef: lifecycle.externalPendingRef,
    trackerRef,
    trackerMapRef,
    lastAgentStreamRef: lifecycle.lastAgentStreamRef,
    sessionKeyRef,
    markUnreadRef,
    tRef,
    setActiveSessionKey: sessionManager.setActiveSessionKey,
    onAgentNameChange,
    loadExamples: examples.loadFromSettings,
  });

  // --- Model controls ---
  const modelControls = useChatModelControls({
    sessionKeyRef,
    clientRef,
    trackerRef,
    lastAgentStreamRef: lifecycle.lastAgentStreamRef,
    connectionState,
    setMessages: transcript.setMessages,
    sessions: sessionManager.sessions,
    activeSessionKey: sessionManager.activeSessionKey,
  });

  // Background history refresh on session switch
  const activeKey = sessionManager.activeSessionKey;
  const prevActiveKeyRef = useRef(activeKey);
  useEffect(() => {
    if (activeKey === prevActiveKeyRef.current) return;
    prevActiveKeyRef.current = activeKey;
    const client = clientRef.current;
    if (!client || connectionState !== "connected") return;
    transcript.loadHistory(client);
    // Refresh model info for the new session (may have per-session override)
    modelControls.refreshModel(activeKey);
  }, [activeKey, connectionState, transcript.loadHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Handlers ---

  function handleSend() {
    const text = draft.trim();
    const files = transcript.pendingImages;
    if ((!text && files.length === 0) || connectionState !== "connected" || !clientRef.current) return;

    // Pre-flight: check if any provider key is configured (read from MST store)
    if (entityStore.providerKeys.length === 0) {
      transcript.setMessages((prev) => [
        ...prev,
        { role: "user", text, timestamp: Date.now() },
        { role: "assistant", text: `\u26A0 ${t("chat.noProviderError")}`, timestamp: Date.now() },
      ]);
      setDraft("");
      transcript.setPendingImages([]);
      return;
    }

    const idempotencyKey = crypto.randomUUID();

    // Optimistic: show user message immediately
    const optimisticImages: ChatImage[] | undefined = files.length > 0
      ? files.map((img) => ({ data: img.base64, mimeType: img.mimeType }))
      : undefined;
    const sentAt = Date.now();
    transcript.setMessages((prev) => [...prev, { role: "user", text, timestamp: sentAt, images: optimisticImages, idempotencyKey }]);
    if (optimisticImages) {
      saveImages(sessionKeyRef.current, idempotencyKey, sentAt, optimisticImages).catch(() => { });
    }
    transcript.shouldInstantScrollRef.current = true; transcript.stickyRef.current = true;
    setDraft("");
    transcript.setPendingImages([]);
    trackerRef.current.dispatch({ type: "LOCAL_SEND", runId: idempotencyKey, sessionKey: sessionKeyRef.current });
    lifecycle.lastActivityRef.current = Date.now();
    lifecycle.lastAgentStreamRef.current = null;
    lifecycle.sendTimeRef.current = Date.now();
    trackEvent("chat.message_sent", { hasAttachment: files.length > 0 });

    // Build RPC params -- images sent as base64 attachments.
    const params: Record<string, unknown> = {
      sessionKey: sessionKeyRef.current,
      message: text || (files.length > 0 ? t("chat.imageOnlyPlaceholder") : ""),
      idempotencyKey,
    };
    if (files.length > 0) {
      params.attachments = files.map((f) => ({
        type: "image" as const,
        mimeType: f.mimeType,
        content: f.base64,
      }));
    }
    if (modelControls.thinkingLevel) params.thinking = modelControls.thinkingLevel;

    clientRef.current.request("chat.send", params).catch((err) => {
      // RPC-level failure -- transition run to error so UI doesn't get stuck
      const raw = formatError(err) || t("chat.sendError");
      const errText = localizeError(raw, t);
      transcript.setMessages((prev) => [...prev, { role: "assistant", text: `\u26A0 ${errText}`, timestamp: Date.now() }]);
      trackerRef.current.dispatch({ type: "CHAT_ERROR", runId: idempotencyKey });
      trackerRef.current.cleanup();
    });

    // Refresh session tabs so the tab bar appears on first message
    refreshSessionsRef.current();
  }

  function handleStop() {
    if (!clientRef.current) return;
    const targetRunId = trackerRef.current.getView().abortTargetRunId;
    if (!targetRunId) return;
    trackEvent("chat.generation_stopped");
    clientRef.current.request("chat.abort", {
      sessionKey: sessionKeyRef.current,
      runId: targetRunId,
    }).catch(() => { });
    transcript.setMessages((prev) => [...prev, { role: "assistant", text: `\u23F9 ${t("chat.stopCommandFeedback")}`, timestamp: Date.now() }]);
  }

  function handleReset() {
    if (!clientRef.current || connectionState !== "connected") return;
    setShowResetConfirm(true);
  }

  function confirmReset() {
    setShowResetConfirm(false);
    if (!clientRef.current) return;
    // Abort any active run first
    const targetRunId = trackerRef.current.getView().abortTargetRunId;
    if (targetRunId) {
      clientRef.current.request("chat.abort", {
        sessionKey: sessionKeyRef.current,
        runId: targetRunId,
      }).catch(() => { });
    }
    // Reset session on gateway
    clientRef.current.request("sessions.reset", {
      key: sessionKeyRef.current,
    }).then(() => {
      transcript.setMessages([{ role: "assistant", text: `\uD83D\uDD04 ${t("chat.resetCommandFeedback")}`, timestamp: Date.now() }]);
      clearImages(sessionKeyRef.current).catch(() => { });
      trackerRef.current.reset();
      lifecycle.lastAgentStreamRef.current = null;
    }).catch((err) => {
      const errText = formatError(err) || t("chat.unknownError");
      transcript.setMessages((prev) => [...prev, { role: "assistant", text: `\u26A0 ${errText}`, timestamp: Date.now() }]);
    });
  }

  // Fetch gateway sessions with previews for archived dropdown content search
  const fetchGatewaySessions = useCallback(async (): Promise<GatewaySessionInfo[]> => {
    const client = clientRef.current;
    if (!client) return [];
    try {
      const result = await client.request<SessionsListResult>("sessions.list", {
        includeDerivedTitles: true,
        includeLastMessage: true,
      });
      if (!result?.sessions) return [];
      return result.sessions.map((s) => ({
        key: s.key,
        derivedTitle: s.derivedTitle,
        lastMessagePreview: s.lastMessagePreview,
      }));
    } catch {
      return [];
    }
  }, []);

  function pushRunProfileToScope(profileId: string, scopeKey: string) {
    if (!profileId || !runProfiles.find((p) => p.id === profileId)) {
      setRunProfileForScope(scopeKey, null).catch(() => {});
      return;
    }
    setRunProfileForScope(scopeKey, profileId).catch(() => {});
  }

  function handleRunProfileChange(profileId: string) {
    setSelectedRunProfileId(profileId);
    selectedRunProfileIdRef.current = profileId;
    pushRunProfileToScope(profileId, activeKey);
  }

  // --- Derived render state ---
  const visibleMessages = transcript.messages.slice(Math.max(0, transcript.messages.length - transcript.visibleCount));
  const showHistoryEnd = transcript.allFetched && transcript.visibleCount >= transcript.messages.length && transcript.messages.length > 0;
  const isStreaming = runId !== null;
  const activeSessionTab = sessionManager.sessions.find((s) => s.key === activeKey);
  const totalTokens = activeSessionTab?.totalTokens ?? 0;
  const contextWindow = modelControls.activeModel?.contextWindow ?? null;

  return (
    <div className="chat-container">
      <SessionTabBar
        sessions={sessionManager.sessions}
        activeSessionKey={sessionManager.activeSessionKey}
        unreadKeys={sessionManager.unreadKeys}
        onSwitchSession={sessionManager.switchSession}
        onNewChat={sessionManager.createNewChat}
        onArchiveSession={sessionManager.archiveSession}
        onRenameSession={sessionManager.renameSession}
        onRestoreSession={sessionManager.restoreSession}
        onReorderSession={sessionManager.reorderSessions}
        fetchGatewaySessions={fetchGatewaySessions}
      />
      {transcript.messages.length === 0 && !streaming ? (
        <div className="chat-empty">
          <div>{t("chat.emptyState")}</div>
        </div>
      ) : (
        <ChatMessageList
          visibleMessages={visibleMessages}
          streaming={streaming}
          runId={runId}
          externalPending={lifecycle.externalPending}
          trackerRef={trackerRef}
          showAgentEvents={showAgentEvents}
          preserveToolEvents={preserveToolEvents}
          collapseMessages={collapseMessages}
          showHistoryEnd={showHistoryEnd}
          messagesContainerRef={transcript.messagesContainerRef}
          messagesEndRef={transcript.messagesEndRef}
          onScroll={transcript.handleScroll}
        />
      )}
      {transcript.showScrollBtn && (
        <button className="chat-scroll-bottom" onClick={transcript.scrollToBottom}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      <ChatExamples
        chatExamplesExpanded={examples.chatExamplesExpanded}
        customExamples={examples.customExamples}
        onToggleExpanded={examples.toggleExpanded}
        onSelectExample={(text) => setDraft(text)}
        onEditExample={(key, currentText) => {
          examples.setEditingExample(key);
          examples.setEditingExampleDraft(currentText);
        }}
      />

      <ChatStatusBar
        connectionState={connectionState}
        agentName={agentName}
        activeModel={modelControls.activeModel}
        thinkingLevel={modelControls.thinkingLevel}
        onThinkingLevelChange={modelControls.setThinkingLevel}
        totalTokens={totalTokens}
        contextWindow={contextWindow}
        selectedRunProfileId={selectedRunProfileId}
        onRunProfileChange={handleRunProfileChange}
        onKeyModelChange={modelControls.handleKeyModelChange}
        onReset={handleReset}
      />

      <ChatInputArea
        draft={draft}
        pendingImages={transcript.pendingImages}
        isStreaming={isStreaming}
        canAbort={trackerRef.current.getView().canAbort}
        connectionState={connectionState}
        hasProviderKeys={modelControls.hasProviderKeys}
        onDraftChange={setDraft}
        onPendingImagesChange={transcript.setPendingImages}
        onSend={handleSend}
        onStop={handleStop}
      />
      <ChatResetModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={confirmReset}
      />
      <ChatContextOverflowModal
        isOpen={modelControls.pendingModelSwitch !== null}
        pendingModelSwitch={modelControls.pendingModelSwitch}
        onClose={() => modelControls.setPendingModelSwitch(null)}
        onContinue={modelControls.handleOverflowContinue}
        onClear={modelControls.handleOverflowClear}
      />
      <Modal
        isOpen={examples.editingExample !== null}
        onClose={() => examples.setEditingExample(null)}
        title={t("chat.editExample")}
        maxWidth={480}
      >
        {examples.editingExample && (
          <>
            <textarea
              className="chat-example-edit-textarea"
              value={examples.editingExampleDraft}
              onChange={(e) => examples.setEditingExampleDraft(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="modal-actions">
              {examples.customExamples[examples.editingExample] && (
                <button
                  className="btn btn-secondary"
                  onClick={() => examples.restoreDefault(examples.editingExample!)}
                >
                  {t("chat.restoreDefault")}
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => examples.setEditingExample(null)}>
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-primary"
                disabled={!examples.editingExampleDraft.trim()}
                onClick={() => examples.saveExample(examples.editingExample!, examples.editingExampleDraft)}
              >
                {t("common.save")}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
});
