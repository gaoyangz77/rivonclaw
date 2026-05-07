import { randomUUID } from "node:crypto";
import type { GatewayEventFrame } from "@rivonclaw/gateway";

/** Dependencies injected from main.ts */
export interface GatewayEventDispatcherDeps {
  /** Broadcast an event to every Panel SSE client (unified `/api/events` bus). */
  broadcastEvent: (event: string, data: unknown) => void;
  chatSessions: {
    getByKey(key: string): { archivedAt: number | null } | undefined;
    upsert(key: string, data: { archivedAt: null }): void;
  };
  onRecipientSeen?: (params: { channelId: string; accountId?: string; recipientId: string }) => {
    inserted: boolean;
    membershipChanged: boolean;
  };
}

export type GatewayEventHandler = (evt: GatewayEventFrame) => void;

/**
 * Create a handler that routes Gateway WebSocket events to Panel SSE.
 * Keeps main.ts clean by centralizing event dispatch logic.
 */
export function createGatewayEventDispatcher(deps: GatewayEventDispatcherDeps): GatewayEventHandler {
  const { broadcastEvent, chatSessions, onRecipientSeen } = deps;

  return (evt: GatewayEventFrame): void => {
    if (evt.event === "mobile.session-reset") {
      const payload = evt.payload as { sessionKey?: string } | undefined;
      if (payload?.sessionKey) {
        broadcastEvent("session-reset", { sessionKey: payload.sessionKey });
      }
    }

    if (evt.event === "rivonclaw.chat-mirror") {
      const p = evt.payload as {
        runId: string;
        sessionKey: string;
        stream: string;  // "assistant" | "lifecycle" | "tool"
        data: unknown;
        seq?: number;
      };
      broadcastEvent("chat-mirror", p);
    }

    if (evt.event === "rivonclaw.channel-inbound") {
      const p = evt.payload as { sessionKey?: string; message?: string; timestamp?: number; channel?: string } | undefined;
      if (p?.sessionKey && p?.message) {
        const session = chatSessions.getByKey(p.sessionKey);
        if (!session || session.archivedAt) {
          chatSessions.upsert(p.sessionKey, { archivedAt: null });
        }
        broadcastEvent("inbound", {
          runId: randomUUID(),
          sessionKey: p.sessionKey,
          channel: p.channel || "unknown",
          message: p.message,
          timestamp: p.timestamp || Date.now(),
        });
      }
    }

    // Persist inbound recipients through the injected domain action so channels
    // without a pairing flow can retain labels/owner metadata. Account-scoped
    // membership is also handled there when the channel supplies an accountId.
    // Fires for every inbound message except mobile/webchat (filtered in the
    // event-bridge extension). Emits `recipient-added` SSE only for brand-new
    // rows so the Panel can live-refresh without redundant traffic.
    if (
      evt.event === "plugin.rivonclaw.recipient-seen"
      || evt.event === "rivonclaw.recipient-seen"
    ) {
      const p = evt.payload as { channelId?: string; accountId?: string; recipientId?: string } | undefined;
      if (!p?.channelId || !p.recipientId) return;

      const result = onRecipientSeen?.({
        channelId: p.channelId,
        accountId: p.accountId,
        recipientId: p.recipientId,
      }) ?? { inserted: false, membershipChanged: false };

      if (result.inserted || result.membershipChanged) {
        broadcastEvent("recipient-added", {
          channelId: p.channelId,
          accountId: p.accountId,
          recipientId: p.recipientId,
        });
      }
    }

    if (evt.event === "mobile.inbound") {
      const p = evt.payload as { sessionKey?: string; message?: string; timestamp?: number; channel?: string; mediaPaths?: string[] } | undefined;
      if (p?.sessionKey && p?.message) {
        // Auto-unarchive the session so it appears in Active sessions,
        // even when the Panel UI is closed.
        const session = chatSessions.getByKey(p.sessionKey);
        if (session?.archivedAt) {
          chatSessions.upsert(p.sessionKey, { archivedAt: null });
        }
        // Convert absolute media file paths to panel-server /api/media/ URLs.
        const MEDIA_DIR_SEG = "/openclaw/media/";
        const mediaUrls: string[] = [];
        if (Array.isArray(p.mediaPaths)) {
          for (const fp of p.mediaPaths) {
            const idx = fp.indexOf(MEDIA_DIR_SEG);
            if (idx >= 0) {
              mediaUrls.push(`/api/media/${fp.slice(idx + MEDIA_DIR_SEG.length)}`);
            }
          }
        }
        broadcastEvent("inbound", {
          runId: randomUUID(),
          sessionKey: p.sessionKey,
          channel: p.channel || "mobile",
          message: p.message,
          timestamp: p.timestamp || Date.now(),
          ...(mediaUrls.length > 0 ? { mediaUrls } : {}),
        });
      }
    }
  };
}
