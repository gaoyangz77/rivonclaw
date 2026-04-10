import { useState, useEffect, useRef, useCallback } from "react";
import type { GatewayChatClient, GatewayEvent } from "../../../lib/gateway-client.js";
import type { ChatMessage } from "../chat-utils.js";
import { extractText, localizeError } from "../chat-utils.js";
import type { SessionTrackerMap } from "../run-tracker.js";
import type { RunTracker } from "../run-tracker.js";
import { trackEvent } from "../../../api/index.js";
import type { TFunction } from "i18next";

export interface UseChatRunLifecycleParams {
  sessionKeyRef: React.RefObject<string>;
  clientRef: React.RefObject<GatewayChatClient | null>;
  trackerMapRef: React.RefObject<SessionTrackerMap>;
  trackerRef: React.MutableRefObject<RunTracker>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  loadHistory: (client: GatewayChatClient) => Promise<void>;
  markUnreadRef: React.RefObject<(key: string) => void>;
  refreshSessionsRef: React.RefObject<() => void>;
  sessionKeysRef: React.RefObject<Set<string>>;
  tRef: React.RefObject<TFunction>;
}

export function useChatRunLifecycle({
  sessionKeyRef,
  clientRef,
  trackerMapRef,
  trackerRef,
  setMessages,
  loadHistory,
  markUnreadRef,
  refreshSessionsRef,
  sessionKeysRef,
  tRef,
}: UseChatRunLifecycleParams) {
  const [externalPending, setExternalPending] = useState(false);
  const externalPendingRef = useRef(false);

  const lastActivityRef = useRef<number>(0);
  const lastAgentStreamRef = useRef<string | null>(null);
  const sendTimeRef = useRef<number>(0);

  // Handle chat events from gateway
  const handleEvent = useCallback((evt: GatewayEvent) => {
    const tracker = trackerRef.current;

    // Process agent events -- dispatch to RunTracker for phase tracking
    if (evt.event === "agent") {
      const agentPayload = evt.payload as {
        runId?: string;
        stream?: string;
        sessionKey?: string;
        data?: Record<string, unknown>;
      } | undefined;
      if (!agentPayload) return;
      const isBackground = agentPayload.sessionKey && agentPayload.sessionKey !== sessionKeyRef.current;

      if (isBackground) {
        markUnreadRef.current(agentPayload.sessionKey!);
        if (!sessionKeysRef.current.has(agentPayload.sessionKey!)) {
          refreshSessionsRef.current();
        }
        // Route lifecycle events to the background session's tracker so
        // terminal events (CHAT_FINAL etc.) are not lost.
        const bgTracker = trackerMapRef.current.get(agentPayload.sessionKey!);
        const bgRunId = agentPayload.runId;
        if (bgRunId && bgTracker.isTracked(bgRunId)) {
          const stream = agentPayload.stream;
          if (stream === "tool") {
            const phase = agentPayload.data?.phase;
            const name = agentPayload.data?.name as string | undefined;
            if (phase === "start" && name) bgTracker.dispatch({ type: "TOOL_START", runId: bgRunId, toolName: name });
            else if (phase === "result") bgTracker.dispatch({ type: "TOOL_RESULT", runId: bgRunId });
          } else if (stream === "lifecycle") {
            const phase = agentPayload.data?.phase;
            if (phase === "start") bgTracker.dispatch({ type: "LIFECYCLE_START", runId: bgRunId });
            else if (phase === "end") bgTracker.dispatch({ type: "LIFECYCLE_END", runId: bgRunId });
            else if (phase === "error") bgTracker.dispatch({ type: "LIFECYCLE_ERROR", runId: bgRunId });
          } else if (stream === "assistant") {
            bgTracker.dispatch({ type: "ASSISTANT_STREAM", runId: bgRunId });
          }
        }
        return;
      }

      const agentRunId = agentPayload.runId;

      // Only process events for tracked runs (replaces old runIdRef guard)
      if (!agentRunId || !tracker.isTracked(agentRunId)) {
        if (agentPayload.stream === "tool" || agentPayload.stream === "lifecycle") {
          console.warn("[chat] agent event dropped: stream=%s phase=%s runId=%s tracked=%s localRunId=%s",
            agentPayload.stream, agentPayload.data?.phase, agentRunId,
            agentRunId ? tracker.isTracked(agentRunId) : "no-id",
            tracker.getLocalRunId());
        }
        return;
      }

      // Only update watchdog activity and last-stream tracking for events
      // belonging to tracked runs.  Unrelated agent activity (cron jobs, other
      // runs) must NOT reset the watchdog, otherwise the stuck-run timer never
      // fires.
      lastAgentStreamRef.current = agentPayload.stream ?? null;
      lastActivityRef.current = Date.now();

      const stream = agentPayload.stream;

      // Always record tool call events inline; visibility controlled at render time
      if (stream === "tool") {
        const phase = agentPayload.data?.phase;
        const name = agentPayload.data?.name as string | undefined;
        if (phase === "start" && name) {
          // Flush current streaming text into a committed assistant bubble
          // before adding the tool event.  Read from tracker (single source of truth)
          // BEFORE dispatching TOOL_START which clears run.streaming.
          //
          // IMPORTANT: The gateway sends cumulative text across the entire turn,
          // so run.streaming contains ALL text from the start -- including text
          // that was already flushed into bubbles during earlier tool calls.
          // Slice off the already-flushed prefix to avoid duplication.
          const flushRun = tracker.getRun(agentRunId);
          const rawStreaming = flushRun?.streaming ?? null;
          const currentOffset = flushRun?.flushedOffset ?? 0;
          const flushedText = rawStreaming && currentOffset > 0 ? rawStreaming.slice(currentOffset) : rawStreaming;
          const args = agentPayload.data?.args as Record<string, unknown> | undefined;
          const toolEvt: ChatMessage = { role: "tool-event", text: name, toolName: name, toolArgs: args, timestamp: Date.now() };
          if (flushedText) {
            setMessages((prev) => [...prev, { role: "assistant", text: flushedText, timestamp: Date.now() }, toolEvt]);
            // The gateway throttles deltas at 150 ms.  The last few characters
            // before a tool_use may still be in the throttle buffer, never sent.
            // Fetch stored history (which has the complete text) and patch the
            // truncated bubble.  Use the run's idempotencyKey to precisely locate
            // the user message, then find the last assistant message after it.
            //
            // Only run this recovery for the FIRST tool call in a turn (offset 0).
            // For subsequent tool calls, the CHAT_DELTA text is cumulative across
            // the entire turn, so the sliced portion is already complete -- no
            // throttle-buffer gap to recover.
            const client = clientRef.current;
            if (client && currentOffset === 0) {
              const snap = flushedText;
              const runKey = agentRunId; // equals idempotencyKey for local runs
              client.request<{ messages?: Array<{ role?: string; content?: unknown; idempotencyKey?: string }> }>(
                "chat.history", { sessionKey: sessionKeyRef.current, limit: 100 },
              ).then((res) => {
                if (!res?.messages) return;
                // Find the user message by idempotencyKey, then scan backward
                // from the end of the array for the last assistant message.
                let anchor = -1;
                for (let i = 0; i < res.messages.length; i++) {
                  if ((res.messages[i] as { idempotencyKey?: string }).idempotencyKey === runKey) {
                    anchor = i;
                    break;
                  }
                }
                if (anchor === -1) return; // run not yet in history
                // The last assistant message after the anchor is the one we need.
                for (let i = res.messages.length - 1; i > anchor; i--) {
                  if (res.messages[i].role !== "assistant") continue;
                  const full = extractText(res.messages[i].content);
                  if (full && full.length > snap.length) {
                    setMessages((prev) => {
                      const idx = prev.findLastIndex((msg) => msg.role === "assistant" && msg.text === snap);
                      if (idx === -1) return prev;
                      const patched = [...prev];
                      patched[idx] = { ...patched[idx], text: full };
                      return patched;
                    });
                    // Keep flushedOffset in sync with the patched (longer) text
                    // so CHAT_FINAL slicing remains accurate.
                    tracker.updateFlushedOffset(runKey, full.length);
                    break;
                  }
                }
              }).catch((err) => { console.warn("[chat] history patch failed -- truncated text remains:", err); });
            }
          } else {
            setMessages((prev) => [...prev, toolEvt]);
          }
          tracker.dispatch({ type: "TOOL_START", runId: agentRunId, toolName: name });
        } else if (phase === "result") {
          tracker.dispatch({ type: "TOOL_RESULT", runId: agentRunId });
        }
      } else if (stream === "lifecycle") {
        const phase = agentPayload.data?.phase;
        if (phase === "start") tracker.dispatch({ type: "LIFECYCLE_START", runId: agentRunId });
        else if (phase === "end") tracker.dispatch({ type: "LIFECYCLE_END", runId: agentRunId });
        else if (phase === "error") tracker.dispatch({ type: "LIFECYCLE_ERROR", runId: agentRunId });
      } else if (stream === "assistant") {
        tracker.dispatch({ type: "ASSISTANT_STREAM", runId: agentRunId });
      }
      return;
    }

    // Heartbeat-triggered agent runs (including main-session cron jobs) bypass
    // the chat event pipeline -- they call getReplyFromConfig directly and store
    // the result in the session file without emitting chat delta/final events.
    // Reload history when a heartbeat produces meaningful output so cron results
    // and other heartbeat-driven responses appear in the chat in real time.
    //
    // We delay the reload slightly because the heartbeat event fires before the
    // transcript is guaranteed to be flushed to disk.  The cron "finished" event
    // below serves as a more reliable (later) fallback.
    if (evt.event === "heartbeat") {
      const hbPayload = evt.payload as { status?: string } | undefined;
      const st = hbPayload?.status;
      // "sent" = delivered to channel, "ok-token"/"ok-empty" = agent ran but
      // no external channel, "skipped" with reason might still mean the agent
      // ran for panel-only users.  Reload on any non-failed status.
      if (st && st !== "failed") {
        setTimeout(() => {
          const client = clientRef.current;
          if (client) loadHistory(client);
        }, 600);
        // Heartbeat may create new sessions -- refresh tab list
        refreshSessionsRef.current();
      }
      return;
    }

    // Cron "finished" event -- a more reliable signal that the agent run is
    // complete and the transcript is persisted.  Fires after the heartbeat
    // event, so the assistant's response should be in the session file by now.
    if (evt.event === "cron") {
      const cronPayload = evt.payload as { action?: string; status?: string } | undefined;
      if (cronPayload?.action === "finished" && cronPayload?.status === "ok") {
        setTimeout(() => {
          const client = clientRef.current;
          if (client) loadHistory(client);
        }, 300);
        // Cron may create new sessions -- refresh tab list
        refreshSessionsRef.current();
      }
      return;
    }

    if (evt.event !== "chat") return;

    const payload = evt.payload as {
      state?: string;
      runId?: string;
      sessionKey?: string;
      message?: { role?: string; content?: unknown; timestamp?: number };
      errorMessage?: string;
    } | undefined;

    if (!payload) return;

    // Background sessions: route terminal events to their tracker, mark unread.
    // Message/UI updates are only done for the active session (below).
    if (payload.sessionKey && payload.sessionKey !== sessionKeyRef.current) {
      markUnreadRef.current(payload.sessionKey);
      if (!sessionKeysRef.current.has(payload.sessionKey)) {
        refreshSessionsRef.current();
      }
      // Dispatch chat lifecycle events to the background tracker
      const bgTracker = trackerMapRef.current.get(payload.sessionKey);
      const bgRunId = payload.runId;
      if (bgRunId) {
        switch (payload.state) {
          case "delta": {
            const text = extractText(payload.message?.content);
            if (text) bgTracker.dispatch({ type: "CHAT_DELTA", runId: bgRunId, text });
            break;
          }
          case "final": bgTracker.dispatch({ type: "CHAT_FINAL", runId: bgRunId }); break;
          case "error": bgTracker.dispatch({ type: "CHAT_ERROR", runId: bgRunId }); break;
          case "aborted": bgTracker.dispatch({ type: "CHAT_ABORTED", runId: bgRunId }); break;
        }
      }
      return;
    }

    const chatRunId = payload.runId;
    const isOurLocalRun = tracker.getLocalRunId() && chatRunId === tracker.getLocalRunId();
    const isTrackedRun = chatRunId ? tracker.isTracked(chatRunId) : false;

    // If not tracked and not our local run, this may be an external run
    // we haven't seen yet (e.g. SSE inbound event arrived late or not at all).
    // Track it so we handle its lifecycle properly.
    if (chatRunId && !isTrackedRun && !isOurLocalRun && !tracker.isRecentlyCompleted(chatRunId)) {
      // Only track if it's on our session (delta/final/error from external channel)
      if (payload.state === "delta") {
        tracker.dispatch({
          type: "EXTERNAL_INBOUND",
          runId: chatRunId,
          sessionKey: payload.sessionKey ?? sessionKeyRef.current,
          channel: "unknown",
        });
      }
    }

    // Dispatch chat events to RunTracker
    if (chatRunId) {
      lastActivityRef.current = Date.now();
      switch (payload.state) {
        case "delta": {
          const text = extractText(payload.message?.content);
          if (text) {
            tracker.dispatch({ type: "CHAT_DELTA", runId: chatRunId, text });
          }
          break;
        }
        case "final":
          tracker.dispatch({ type: "CHAT_FINAL", runId: chatRunId });
          // Refresh sessions to pick up derived titles after completion
          refreshSessionsRef.current();
          break;
        case "error":
          tracker.dispatch({ type: "CHAT_ERROR", runId: chatRunId });
          break;
        case "aborted":
          tracker.dispatch({ type: "CHAT_ABORTED", runId: chatRunId });
          break;
      }
    }

    // Local run -- handle streaming text and messages
    if (isOurLocalRun) {
      switch (payload.state) {
        case "delta": {
          lastActivityRef.current = Date.now();
          // Streaming text is tracked by CHAT_DELTA dispatch above -- no separate state needed.
          break;
        }
        case "final": {
          const localRun = tracker.getRun(chatRunId!);
          const flushedOffset = localRun?.flushedOffset ?? 0;
          const finalText = extractText(payload.message?.content);
          if (finalText) {
            // When tool calls occurred during this run, pre-tool text was
            // already flushed into committed message bubbles. The gateway's
            // final message contains the FULL accumulated text for the entire
            // turn, so we must strip the already-committed prefix to avoid
            // duplicating it.
            const newText = flushedOffset > 0 ? finalText.slice(flushedOffset) : finalText;
            if (newText.trim()) {
              setMessages((prev) => [...prev, { role: "assistant", text: newText, timestamp: Date.now() }]);
            }
          } else if (!localRun?.streaming) {
            // No final text and no streaming text was produced -- the run
            // likely timed out or errored before generating any output.
            setMessages((prev) => [...prev, {
              role: "assistant",
              text: `\u26A0 ${tRef.current("chat.errorTimeout")}`,
              timestamp: Date.now(),
            }]);
          }
          if (sendTimeRef.current > 0) {
            trackEvent("chat.response_received", { durationMs: Date.now() - sendTimeRef.current });
            sendTimeRef.current = 0;
          }
          lastAgentStreamRef.current = null;
          if (externalPendingRef.current) {
            setExternalPendingValue(false);
          }
          tracker.cleanup();
          break;
        }
        case "error": {
          console.error("[chat] error event:", payload.errorMessage ?? "unknown error", "runId:", chatRunId);
          const raw = payload.errorMessage ?? tRef.current("chat.unknownError");
          const errText = localizeError(raw, tRef.current);
          setMessages((prev) => [...prev, { role: "assistant", text: `\u26A0 ${errText}`, timestamp: Date.now() }]);
          lastAgentStreamRef.current = null;
          if (externalPendingRef.current) {
            setExternalPendingValue(false);
          }
          tracker.cleanup();
          break;
        }
        case "aborted": {
          // If there was partial streaming text, keep it as a message.
          // Read from tracker BEFORE cleanup (which removes the run).
          const abortedRun = tracker.getRun(chatRunId!);
          const abortedRaw = abortedRun?.streaming ?? null;
          const abortedOffset = abortedRun?.flushedOffset ?? 0;
          const abortedText = abortedRaw && abortedOffset > 0 ? abortedRaw.slice(abortedOffset) : abortedRaw;
          if (abortedText?.trim()) {
            setMessages((prev) => [...prev, { role: "assistant", text: abortedText, timestamp: Date.now() }]);
          }
          lastAgentStreamRef.current = null;
          if (externalPendingRef.current) {
            setExternalPendingValue(false);
          }
          tracker.cleanup();
          break;
        }
      }
    } else if (chatRunId) {
      // External run -- handle completion.
      if (payload.state === "error") {
        console.error("[chat] external run error:", payload.errorMessage ?? "unknown error", "runId:", chatRunId);
      }
      if (payload.state === "final") {
        // Immediately commit the final text so the user sees it without waiting
        // for loadHistory. The subsequent loadHistory will replace all messages
        // with the canonical transcript, but this avoids a visible gap.
        const extRun = chatRunId ? tracker.getRun(chatRunId) : undefined;
        const extFlushedOffset = extRun?.flushedOffset ?? 0;
        const finalText = extractText(payload.message?.content);
        if (finalText) {
          const extNewText = extFlushedOffset > 0 ? finalText.slice(extFlushedOffset) : finalText;
          if (extNewText.trim()) {
            setMessages((prev) => [...prev, { role: "assistant", text: extNewText, timestamp: Date.now() }]);
          }
        }
        // External run finished -- reload history to show the full conversation
        const client = clientRef.current;
        if (client) loadHistory(client);
      }
      if (payload.state === "final" || payload.state === "error" || payload.state === "aborted") {
        tracker.cleanup();
        // Clear externalPending so the thinking bubble disappears even if
        // the SSE mirror lifecycle-end event is late or missing.
        if (externalPendingRef.current) {
          setExternalPending(false); externalPendingRef.current = false;
        }
      }
    }
  }, [loadHistory]);

  // Watchdog: if no gateway events arrive for 5 minutes while a run
  // appears active, force-reset to clear a permanently stuck indicator.
  useEffect(() => {
    const WATCHDOG_INTERVAL = 30_000;   // check every 30s
    const WATCHDOG_TIMEOUT = 5 * 60_000; // 5 minutes of silence
    const timer = setInterval(() => {
      const tracker = trackerRef.current;
      const view = tracker.getView();
      const stuck = view.isActive || externalPendingRef.current;
      if (stuck && Date.now() - lastActivityRef.current > WATCHDOG_TIMEOUT) {
        console.warn("[chat] watchdog: no events for 5 min -- force-resetting run state");
        tracker.reset();
        lastAgentStreamRef.current = null;
        if (externalPendingRef.current) {
          setExternalPending(false); externalPendingRef.current = false;
        }
      }
    }, WATCHDOG_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  function setExternalPendingValue(next: boolean) {
    externalPendingRef.current = next;
    setExternalPending(next);
  }

  function resetExternalPending() {
    setExternalPendingValue(false);
  }

  return {
    externalPending,
    externalPendingRef,
    lastAgentStreamRef,
    lastActivityRef,
    sendTimeRef,
    handleEvent,
    setExternalPendingValue,
    resetExternalPending,
  };
}
