/**
 * ChatEventBridge — subscribes to the shared Panel event bus and converts
 * Desktop-emitted events into RunTracker actions for the chat UI.
 *
 * Event types consumed (all multiplex over the unified `/api/events` SSE):
 *  - "inbound"        — an external user message arrived (e.g. WeChat)
 *  - "chat-mirror"    — agent event mirrored from the gateway
 *  - "session-reset"  — gateway asked us to clear run state for a session
 *
 * Historically the bridge also listened for a "tool" event; that event is
 * no longer emitted anywhere on the Desktop side — tool start/result arrive
 * via the gateway WebSocket and flow through ChatGatewayController — so the
 * handler was removed during the SSE consolidation.
 *
 * See ADR-022 for the original design rationale.
 */

import type { RunAction } from "./run-tracker.js";
import { panelEventBus } from "../../lib/event-bus.js";

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
  private unsubscribers: Array<() => void> = [];
  private callbacks: ChatEventBridgeCallbacks;

  constructor(callbacks: ChatEventBridgeCallbacks) {
    this.callbacks = callbacks;
  }

  connect(): void {
    if (this.unsubscribers.length > 0) return;

    this.unsubscribers.push(
      panelEventBus.subscribe("inbound", (raw) => {
        const data = raw as InboundSSEPayload;
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
      }),
    );

    this.unsubscribers.push(
      panelEventBus.subscribe("session-reset", (raw) => {
        const data = raw as { sessionKey?: string };
        if (data.sessionKey) {
          this.callbacks.onSessionReset?.(data.sessionKey);
        }
      }),
    );

    this.unsubscribers.push(
      panelEventBus.subscribe("chat-mirror", (raw) => {
        this.callbacks.onMirrorEvent?.(raw as ChatMirrorSSEPayload);
      }),
    );
  }

  disconnect(): void {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
  }

  get connected(): boolean {
    return this.unsubscribers.length > 0;
  }
}
