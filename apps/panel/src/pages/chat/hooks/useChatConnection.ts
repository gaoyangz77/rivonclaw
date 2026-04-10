import { useEffect, useRef } from "react";
import type { ChatMessage } from "../chat-utils.js";
import type { GatewayEvent, GatewayHelloOk } from "../../../lib/gateway-client.js";
import { GatewayChatClient } from "../../../lib/gateway-client.js";
import { ChatEventBridge } from "../chat-event-bridge.js";
import type { ChatMirrorSSEPayload } from "../chat-event-bridge.js";
import { SSE } from "@rivonclaw/core/api-contract";
import { fetchGatewayInfo } from "../../../api/index.js";
import type { RunTracker } from "../run-tracker.js";
import type { SessionTrackerMap } from "../run-tracker.js";
import type { TFunction } from "i18next";
import { clearImages } from "../image-cache.js";

export type ConnectionState = "connecting" | "connected" | "disconnected";

export interface UseChatConnectionParams {
  loadHistory: (client: GatewayChatClient) => Promise<void>;
  handleEvent: (evt: GatewayEvent) => void;
  clientRef: React.MutableRefObject<GatewayChatClient | null>;
  setConnectionState: (state: ConnectionState) => void;
  setAgentName: (name: string | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setExternalPending: (v: boolean) => void;
  externalPendingRef: React.RefObject<boolean>;
  trackerRef: React.RefObject<RunTracker>;
  trackerMapRef: React.RefObject<SessionTrackerMap>;
  lastAgentStreamRef: React.MutableRefObject<string | null>;
  sessionKeyRef: React.RefObject<string>;
  markUnreadRef: React.RefObject<(key: string) => void>;
  tRef: React.RefObject<TFunction>;
  setActiveSessionKey: (key: string) => void;
  onAgentNameChange?: (name: string | null) => void;
  loadExamples: () => void;
}

export function useChatConnection({
  loadHistory,
  handleEvent,
  clientRef,
  setConnectionState,
  setAgentName,
  setMessages,
  setExternalPending,
  externalPendingRef,
  trackerRef,
  trackerMapRef,
  lastAgentStreamRef,
  sessionKeyRef,
  markUnreadRef,
  tRef,
  setActiveSessionKey,
  onAgentNameChange,
  loadExamples,
}: UseChatConnectionParams) {
  const bridgeRef = useRef<ChatEventBridge | null>(null);
  const initialConnectDoneRef = useRef(false);
  const needsDisconnectErrorRef = useRef(false);

  // Keep onAgentNameChange in a ref so the effect doesn't depend on it
  const onAgentNameChangeRef = useRef(onAgentNameChange);
  onAgentNameChangeRef.current = onAgentNameChange;
  // Keep setActiveSessionKey in a ref to avoid dependency on sessionManager
  const setActiveSessionKeyRef = useRef(setActiveSessionKey);
  setActiveSessionKeyRef.current = setActiveSessionKey;

  function refreshAgentName(client: GatewayChatClient, cancelled?: boolean) {
    client.request<{ name?: string }>("agent.identity.get", {
      sessionKey: sessionKeyRef.current,
    }).then((res) => {
      if (!cancelled && res?.name) {
        setAgentName(res.name);
        onAgentNameChangeRef.current?.(res.name);
      }
    }).catch(() => { });
  }

  // Initialize connection
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Load custom example prompts from settings
        loadExamples();

        const info = await fetchGatewayInfo();
        if (cancelled) return;

        const client = new GatewayChatClient({
          url: info.wsUrl,
          token: info.token,
          onConnected: (hello: GatewayHelloOk) => {
            if (cancelled) return;
            // Use session key from gateway snapshot ONLY on initial connect.
            // On reconnects (e.g. CDP mode switch, keepalive timeout) the user
            // may be viewing a different tab -- overriding it would cause
            // session data mixing.
            const mainKey = hello.snapshot?.sessionDefaults?.mainSessionKey;
            if (mainKey && !initialConnectDoneRef.current) {
              initialConnectDoneRef.current = true;
              setActiveSessionKeyRef.current(mainKey);
            }
            setConnectionState("connected");
            loadHistory(client).then(() => {
              // Show deferred disconnect error AFTER history is loaded,
              // otherwise loadHistory's setMessages would overwrite the error.
              if (needsDisconnectErrorRef.current) {
                needsDisconnectErrorRef.current = false;
                setMessages((prev) => [...prev, {
                  role: "assistant",
                  text: `\u26A0 ${tRef.current("chat.disconnectedError")}`,
                  timestamp: Date.now(),
                }]);
              }
            });
            // Fetch agent display name
            refreshAgentName(client, cancelled);
          },
          onDisconnected: () => {
            if (cancelled) return;
            setConnectionState("connecting");
            const localId = trackerRef.current.getLocalRunId();
            const wasWaiting = !!localId;
            // If streaming was in progress, save partial text.
            const disconnectText = localId ? (trackerRef.current.getRun(localId)?.streaming ?? null) : null;
            trackerMapRef.current.reset(); // WS disconnect -- reset all session trackers
            if (disconnectText) {
              setMessages((prev) => [...prev, { role: "assistant", text: disconnectText, timestamp: Date.now() }]);
            }
            lastAgentStreamRef.current = null;
            // Defer error display: auto-reconnect calls loadHistory which
            // overwrites messages. The ref is checked after loadHistory completes.
            if (wasWaiting) {
              needsDisconnectErrorRef.current = true;
            }
          },
          onEvent: handleEvent,
        });

        clientRef.current = client;
        client.start();

        // Connect SSE bridge for inbound messages and tool events (see ADR-022)
        // SSE endpoint is on the panel-server (same origin as the panel UI)
        const sseUrl = new URL(SSE["chat.events"].path, window.location.origin).href;
        const bridge = new ChatEventBridge(sseUrl, {
          onAction: (action) => {
            if (cancelled) return;
            trackerRef.current.dispatch(action);
          },
          onUserMessage: (msg) => {
            if (cancelled) return;
            // Only append to the currently viewed session
            if (msg.sessionKey !== sessionKeyRef.current) {
              markUnreadRef.current(msg.sessionKey);
              return;
            }
            setMessages((prev) => [...prev, {
              role: "user",
              text: msg.text,
              timestamp: msg.timestamp,
              isExternal: true,
              channel: msg.channel,
            }]);
            setExternalPending(true);
          },
          onSessionReset: (sessionKey) => {
            if (cancelled) return;
            if (sessionKey !== sessionKeyRef.current) return;
            setMessages([{ role: "assistant", text: `\uD83D\uDD04 ${tRef.current("chat.resetCommandFeedback")}`, timestamp: Date.now() }]);
            clearImages(sessionKeyRef.current).catch(() => { });
            trackerRef.current.reset();
            lastAgentStreamRef.current = null;
            setExternalPending(false);
          },
          onMirrorEvent: (mirror: ChatMirrorSSEPayload) => {
            if (cancelled) return;
            const isActiveMirror = mirror.sessionKey === sessionKeyRef.current;
            const data = mirror.data as Record<string, unknown>;

            if (mirror.stream === "assistant") {
              const text = data.text as string | undefined;
              if (text) {
                if (externalPendingRef.current && isActiveMirror) {
                  setExternalPending(false);
                }
                // Route delta to the correct session's tracker via handleEvent
                handleEvent({
                  type: "event",
                  event: "chat",
                  payload: {
                    runId: mirror.runId,
                    sessionKey: mirror.sessionKey,
                    state: "delta",
                    message: {
                      role: "assistant",
                      content: [{ type: "text", text }],
                      timestamp: Date.now(),
                    },
                  },
                });
              }
            } else if (mirror.stream === "lifecycle") {
              const phase = data.phase as string | undefined;
              if (phase === "start") {
                const mirrorTracker = trackerMapRef.current.get(mirror.sessionKey);
                mirrorTracker.dispatch({
                  type: "EXTERNAL_INBOUND",
                  runId: mirror.runId,
                  sessionKey: mirror.sessionKey,
                  channel: "unknown",
                });
                mirrorTracker.dispatch({ type: "LIFECYCLE_START", runId: mirror.runId });
              } else if (phase === "end" || phase === "error") {
                if (externalPendingRef.current && isActiveMirror) {
                  setExternalPending(false);
                }
                // Route terminal event to the correct session's tracker via handleEvent
                handleEvent({
                  type: "event",
                  event: "chat",
                  payload: {
                    runId: mirror.runId,
                    sessionKey: mirror.sessionKey,
                    state: phase === "error" ? "error" : "final",
                    ...(phase === "error" ? { errorMessage: data.error } : {}),
                  },
                });
              }
            } else if (mirror.stream === "tool") {
              const toolName = data.name as string | undefined;
              const toolPhase = data.phase as string | undefined;
              const toolArgs = data.args as Record<string, unknown> | undefined;
              // Route tool event to the correct session's tracker via handleEvent
              handleEvent({
                type: "event",
                event: "agent",
                payload: {
                  runId: mirror.runId,
                  sessionKey: mirror.sessionKey,
                  stream: "tool",
                  data,
                },
              });
              if (toolName === "message" && toolPhase === "start" && toolArgs && isActiveMirror) {
                const msgText = (toolArgs.message ?? toolArgs.text ?? toolArgs.content) as string | undefined;
                if (msgText) {
                  setMessages((prev) => [...prev, { role: "assistant", text: msgText, timestamp: Date.now() }]);
                }
              }
            }
          },
        });
        bridge.connect();
        bridgeRef.current = bridge;
      } catch {
        if (!cancelled) setConnectionState("disconnected");
      }
    }

    init();

    // Poll agent identity every 5 minutes so name changes show up without refresh
    const nameTimer = setInterval(() => {
      if (clientRef.current) refreshAgentName(clientRef.current);
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(nameTimer);
      clientRef.current?.stop();
      clientRef.current = null;
      bridgeRef.current?.disconnect();
      bridgeRef.current = null;
      initialConnectDoneRef.current = false;
    };
  }, [loadHistory, handleEvent]); // eslint-disable-line react-hooks/exhaustive-deps
}
