import { randomUUID } from "node:crypto";
import type { GatewayEventFrame } from "@rivonclaw/gateway";

/** Dependencies injected from main.ts */
export interface GatewayEventDispatcherDeps {
  pushChatSSE: (event: string, data: unknown) => void;
  chatSessions: {
    getByKey(key: string): { archivedAt: number | null } | undefined;
    upsert(key: string, data: { archivedAt: null }): void;
  };
}

export type GatewayEventHandler = (evt: GatewayEventFrame) => void;

/**
 * Create a handler that routes Gateway WebSocket events to Panel SSE.
 * Keeps main.ts clean by centralizing event dispatch logic.
 */
export function createGatewayEventDispatcher(deps: GatewayEventDispatcherDeps): GatewayEventHandler {
  const { pushChatSSE, chatSessions } = deps;

  return (evt: GatewayEventFrame): void => {
    if (evt.event === "mobile.session-reset") {
      const payload = evt.payload as { sessionKey?: string } | undefined;
      if (payload?.sessionKey) {
        pushChatSSE("session-reset", { sessionKey: payload.sessionKey });
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
      pushChatSSE("chat-mirror", p);
    }

    if (evt.event === "rivonclaw.channel-inbound") {
      const p = evt.payload as { sessionKey?: string; message?: string; timestamp?: number; channel?: string } | undefined;
      if (p?.sessionKey && p?.message) {
        const session = chatSessions.getByKey(p.sessionKey);
        if (session?.archivedAt) {
          chatSessions.upsert(p.sessionKey, { archivedAt: null });
        }
        pushChatSSE("inbound", {
          runId: randomUUID(),
          sessionKey: p.sessionKey,
          channel: p.channel || "unknown",
          message: p.message,
          timestamp: p.timestamp || Date.now(),
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
        pushChatSSE("inbound", {
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
