/**
 * ChatEventBridge — SSE client that connects to panel-server's
 * `GET /api/chat/events` endpoint and converts server-sent events
 * into RunTracker actions.
 *
 * Two event types are handled:
 *  - "inbound"  — an external user message arrived (e.g. WeChat)
 *  - "tool"     — an agent tool event forwarded from the gateway
 *
 * See ADR-022 for design rationale.
 */

import type { RunAction } from "./run-tracker.js";

// ---------------------------------------------------------------------------
// SSE payload types
// ---------------------------------------------------------------------------

export interface InboundSSEPayload {
  runId: string;
  sessionKey: string;
  channel: string;
  message: string;
  timestamp: number;
}

export interface ToolSSEPayload {
  runId: string;
  phase: "start" | "result";
  toolName?: string;
}

/** Mirrors agent events for non-webchat channels (Telegram, Feishu, Mobile, etc.) */
export interface ChatMirrorSSEPayload {
  runId: string;
  sessionKey: string;
  stream: "assistant" | "lifecycle" | "tool";
  data: unknown;
  seq?: number;
}

// ---------------------------------------------------------------------------
// ChatEventBridge
// ---------------------------------------------------------------------------

export type ChatEventBridgeCallbacks = {
  onAction: (action: RunAction) => void;
  onUserMessage: (msg: { text: string; timestamp: number; channel: string; sessionKey: string }) => void;
  onSessionReset?: (sessionKey: string) => void;
  /** Called when a chat-mirror event arrives for a non-webchat channel.
   *  The consumer should feed this into the same handleEvent logic used for
   *  WebSocket agent events so rendering is identical. */
  onMirrorEvent?: (payload: ChatMirrorSSEPayload) => void;
};

export class ChatEventBridge {
  private sse: EventSource | null = null;
  private url: string;
  private callbacks: ChatEventBridgeCallbacks;

  constructor(url: string, callbacks: ChatEventBridgeCallbacks) {
    this.url = url;
    this.callbacks = callbacks;
  }

  connect(): void {
    if (this.sse) return;

    const sse = new EventSource(this.url);
    this.sse = sse;

    sse.addEventListener("inbound", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as InboundSSEPayload;
        this.callbacks.onUserMessage({
          text: data.message,
          timestamp: data.timestamp,
          channel: data.channel,
          sessionKey: data.sessionKey,
        });
        // NOTE: We intentionally do NOT dispatch EXTERNAL_INBOUND here.
        // The gateway's own chat.delta event auto-registers the run with
        // the correct runId (see ChatPage.tsx ~line 441). Dispatching here
        // with a potentially mismatched runId created phantom "queued" runs
        // that never completed.
      } catch (err) {
        console.warn("[chat-event-bridge] malformed inbound SSE data:", err);
      }
    });

    sse.addEventListener("tool", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as ToolSSEPayload;
        if (data.phase === "start" && data.toolName) {
          this.callbacks.onAction({
            type: "TOOL_START",
            runId: data.runId,
            toolName: data.toolName,
          });
        } else if (data.phase === "result") {
          this.callbacks.onAction({
            type: "TOOL_RESULT",
            runId: data.runId,
          });
        }
      } catch (err) {
        console.warn("[chat-event-bridge] malformed tool SSE data:", err);
      }
    });

    sse.addEventListener("session-reset", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { sessionKey?: string };
        if (data.sessionKey) {
          this.callbacks.onSessionReset?.(data.sessionKey);
        }
      } catch (err) {
        console.warn("[chat-event-bridge] malformed session-reset SSE data:", err);
      }
    });

    sse.addEventListener("chat-mirror", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as ChatMirrorSSEPayload;
        this.callbacks.onMirrorEvent?.(data);
      } catch (err) {
        console.warn("[chat-event-bridge] malformed chat-mirror SSE data:", err);
      }
    });

    sse.addEventListener("error", () => {
      // EventSource auto-reconnects on transient errors. Log for debugging
      // but don't take action — readyState tells us if it's fatal (CLOSED).
      if (sse.readyState === EventSource.CLOSED) {
        console.warn("[chat-event-bridge] SSE connection closed permanently");
      }
    });
  }

  disconnect(): void {
    if (this.sse) {
      this.sse.close();
      this.sse = null;
    }
  }

  get connected(): boolean {
    return this.sse !== null && this.sse.readyState !== EventSource.CLOSED;
  }
}
