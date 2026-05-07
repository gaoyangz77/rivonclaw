/**
 * RivonClaw Event Bridge plugin.
 *
 * Mirrors agent events for ALL channels to the Chat Page by working around
 * the vendor's `isControlUiVisible` gate in server-chat.ts. External channel
 * runs (Telegram, Feishu, Mobile, etc.) normally have their sessionKey stripped
 * from enriched events, so server-chat never broadcasts them. This plugin:
 *
 * 1. Builds a runId -> sessionKey map via the `llm_input` hook.
 * 2. Listens to ALL agent events via `runtime.events.onAgentEvent()`.
 * 3. When an event's sessionKey is undefined (suppressed), looks up the real
 *    sessionKey and broadcasts via `gatewayBroadcast`.
 * 4. Broadcasts `rivonclaw.channel-inbound` for external channel user messages
 *    so they appear on the Chat Page in real time (not only after history sync).
 *    Uses a two-phase approach: `message_received` captures the message text,
 *    then `before_agent_start` resolves the sessionKey and broadcasts.
 */

import { defineRivonClawPlugin } from "@rivonclaw/plugin-sdk";

const CLEANUP_DELAY_MS = 30_000;

type AgentEventPayload = {
  runId: string;
  seq: number;
  stream: string;
  ts: number;
  data: Record<string, unknown>;
  sessionKey?: string;
};

type BroadcastFn = (event: string, payload: unknown) => void;

type PendingInbound = {
  content: string;
  timestamp: number;
  channelId: string;
};

const CHANNEL_INBOUND_SKIP = new Set(["mobile", "webchat", "openclaw-weixin"]);

function resolveChannelIdFromSessionKey(sessionKey?: string): string | null {
  if (!sessionKey) return null;
  const parts = sessionKey.split(":");
  // Expected external channel key shape:
  // agent:{agentId}:{channelId}:{accountId}:...
  const channelId = parts.length >= 3 && parts[0] === "agent" ? parts[2] : null;
  return channelId && channelId.length > 0 ? channelId : null;
}

function shouldSkipChannelInbound(channelId: string): boolean {
  return CHANNEL_INBOUND_SKIP.has(channelId);
}

// ── Module-level state ───────────────────────────────────────────────
// State lives at module level so it survives across setup() calls
// (OpenClaw may call register→activate, invoking setup twice, and may
// reuse cached registries on gateway restart without calling setup again).
const runSessionMap = new Map<string, string>();
// Pending inbound messages from external channels, keyed by channelId.
// Populated by `message_received`, consumed by `before_agent_start`.
// Each channelId holds a FIFO queue because multiple conversations on
// the same channel may overlap slightly.
const pendingInboundMessages = new Map<string, PendingInbound[]>();
let gatewayBroadcast: BroadcastFn | null = null;
let prevUnsubscribe: (() => void) | null = null;
let eventCount = 0;

export default defineRivonClawPlugin({
  id: "rivonclaw-event-bridge",
  name: "RivonClaw Event Bridge",

  setup(api) {
    // Tear down previous listener if setup is called again (double register/activate).
    if (prevUnsubscribe) {
      prevUnsubscribe();
      prevUnsubscribe = null;
    }
    runSessionMap.clear();
    pendingInboundMessages.clear();
    eventCount = 0;
    // Keep gatewayBroadcast — it will be recaptured via event_bridge_init if null.

    // ── Capture broadcast via a lightweight gateway method ──────────
    // The desktop panel calls "event_bridge_init" once after gateway start
    // to hand the broadcast function to this plugin.
    // registerGatewayMethod may fail silently if already registered (cached
    // registry), which is fine — the existing handler still points to our
    // module-level gatewayBroadcast variable.
    if (typeof api.registerGatewayMethod === "function") {
      api.registerGatewayMethod(
        "event_bridge_init",
        ({ respond, context }: { respond: (ok: boolean) => void; context?: { broadcast: BroadcastFn } }) => {
          if (context?.broadcast) {
            gatewayBroadcast = context.broadcast;
            api.logger.info("Gateway broadcast captured");
          }
          respond(true);
        },
      );
    }

    // ── Build runId -> sessionKey map from llm_input hook ───────────
    api.on(
      "llm_input",
      (evt: { runId?: string }, ctx: { sessionKey?: string }) => {
        if (evt.runId && ctx?.sessionKey) {
          runSessionMap.set(evt.runId, ctx.sessionKey);
          api.logger.info(`[event-bridge] llm_input mapped runId=${evt.runId} → sessionKey=${ctx.sessionKey}`);
        } else {
          api.logger.warn(`[event-bridge] llm_input missing: runId=${evt.runId ?? "undefined"} sessionKey=${ctx?.sessionKey ?? "undefined"}`);
        }
      },
    );

    // ── Capture inbound user messages from external channels ────────
    // The `message_received` hook fires for ALL channels when a user message
    // arrives, but its context only has { channelId, conversationId } — no
    // sessionKey. We store the message in a per-channelId FIFO queue so the
    // subsequent `before_agent_start` hook (which has sessionKey) can consume
    // it and broadcast to the Chat Page.
    //
    // Skip list: channels whose messages are already broadcast to the Chat
    // Page by the vendor's server-chat.ts (i.e. NOT suppressed by the
    // `isControlUiVisible` gate). Broadcasting them again here would cause
    // duplicates — the agent sees the same message twice and replies twice.
    //   - "mobile"          — has a dedicated mobile.inbound pathway
    //   - "webchat"         — browser-based chat, natively visible in the UI
    //   - "openclaw-weixin" — vendor broadcasts natively (confirmed: messages
    //                         still appear on Chat Page with this skip active)
    // Channels like Telegram / Feishu are suppressed by the vendor, so the
    // event bridge is their ONLY path to the Chat Page — they must NOT be
    // in this list.
    api.on(
      "message_received",
      (
        evt: { content?: string; from?: string; timestamp?: number },
        ctx: { channelId?: string; conversationId?: string },
      ) => {
        if (!gatewayBroadcast || !ctx?.channelId || !evt?.content) return;
        if (shouldSkipChannelInbound(ctx.channelId)) return;

        const queue = pendingInboundMessages.get(ctx.channelId) ?? [];
        queue.push({
          content: evt.content,
          timestamp: evt.timestamp ?? Date.now(),
          channelId: ctx.channelId,
        });
        pendingInboundMessages.set(ctx.channelId, queue);
        api.logger.info(
          `[event-bridge] message_received: queued for channel=${ctx.channelId} queueSize=${queue.length}`,
        );
      },
    );

    // ── Broadcast recipient-seen for Desktop-side persistence ───────
    // Separate from the `channel-inbound` broadcast above: this path exists
    // purely so Desktop can persist `{ channelId, recipientId }` into SQLite
    // `channel_recipients` for channels that have no pairing flow (primarily
    // WeChat). Consumers on Desktop treat the row as the source of truth for
    // the allowlist; pairing-flow channels (Telegram/Feishu) still populate
    // the same table via `approvePairing`, so everything converges.
    //
    // Skip list: `mobile` and `webchat` only. Unlike the `channel-inbound`
    // handler above, we DO include `openclaw-weixin` here — that is precisely
    // the channel this signal was added for. Mobile has its own pairing
    // plumbing via `mobile_pairings`; webchat is ephemeral and has no
    // recipient to persist.
    //
    // This event does NOT touch the Chat Page — it is a pure persistence
    // signal consumed only by Desktop's gateway event dispatcher.
    api.on(
      "message_received",
      (
        evt: { from?: string },
        ctx: { channelId?: string; accountId?: string },
      ) => {
        if (!gatewayBroadcast || !ctx?.channelId) return;
        if (ctx.channelId === "mobile" || ctx.channelId === "webchat") return;
        const recipientId = evt?.from;
        if (!recipientId) return;

        api.logger.info(
          `[event-bridge] recipient-seen: channel=${ctx.channelId} account=${ctx.accountId ?? "(none)"} recipient=${recipientId}`,
        );
        gatewayBroadcast("plugin.rivonclaw.recipient-seen", {
          channelId: ctx.channelId,
          accountId: ctx.accountId,
          recipientId,
        });
      },
    );

    // ── Resolve sessionKey and broadcast inbound messages ─────────────
    // `before_agent_start` fires after session routing, so ctx.sessionKey is
    // available. For external channel runs, consume the pending message and
    // broadcast `rivonclaw.channel-inbound`.
    api.on(
      "before_agent_start",
      (
        _evt: { prompt?: string },
        ctx: { sessionKey?: string; channelId?: string; trigger?: string },
      ) => {
        if (!gatewayBroadcast || !ctx?.sessionKey) return;
        const channelId = ctx.channelId ?? resolveChannelIdFromSessionKey(ctx.sessionKey);
        if (!channelId) {
          api.logger.warn(`[event-bridge] channel-inbound: cannot resolve channel for sessionKey=${ctx.sessionKey}`);
          return;
        }
        if (shouldSkipChannelInbound(channelId)) return;

        const queue = pendingInboundMessages.get(channelId);
        if (!queue || queue.length === 0) return;

        const pending = queue.shift()!;
        if (queue.length === 0) pendingInboundMessages.delete(channelId);

        api.logger.info(
          `[event-bridge] channel-inbound: broadcasting for channel=${channelId} sessionKey=${ctx.sessionKey}`,
        );
        gatewayBroadcast("rivonclaw.channel-inbound", {
          sessionKey: ctx.sessionKey,
          message: pending.content,
          timestamp: pending.timestamp,
          channel: pending.channelId,
        });
      },
    );

    // ── Cleanup map entries after agent_end with a delay ────────────
    api.on(
      "agent_end",
      (_evt: unknown, ctx: { sessionKey?: string }) => {
        if (!ctx?.sessionKey) return;
        const sessionKey = ctx.sessionKey;
        setTimeout(() => {
          for (const [runId, sk] of runSessionMap) {
            if (sk === sessionKey) {
              runSessionMap.delete(runId);
            }
          }
        }, CLEANUP_DELAY_MS);
      },
    );

    // ── Mirror suppressed agent events to Chat Page ─────────────────
    const unsubscribe = (api as any).runtime.events.onAgentEvent((evt: AgentEventPayload) => {
      eventCount++;
      const shouldLog = eventCount <= 5 || eventCount % 50 === 0;

      // If sessionKey is present, server-chat.ts is already broadcasting — skip.
      if (evt.sessionKey) {
        if (shouldLog) api.logger.debug?.(`[event-bridge] skip: vendor-broadcasted (stream=${evt.stream} runId=${evt.runId} seq=${evt.seq})`);
        return;
      }

      if (!gatewayBroadcast) {
        if (shouldLog) api.logger.warn(`[event-bridge] drop: no broadcast fn (stream=${evt.stream} runId=${evt.runId})`);
        return;
      }

      // Look up real sessionKey from our hook-built map.
      const sessionKey = runSessionMap.get(evt.runId);
      if (!sessionKey) {
        if (shouldLog) api.logger.warn(`[event-bridge] drop: no sessionKey in map (stream=${evt.stream} runId=${evt.runId} mapSize=${runSessionMap.size})`);
        return;
      }

      // Only mirror streams the Chat Page cares about.
      if (evt.stream !== "assistant" && evt.stream !== "lifecycle" && evt.stream !== "tool") {
        if (shouldLog) api.logger.info(`[event-bridge] skip: unneeded stream=${evt.stream} runId=${evt.runId}`);
        return;
      }

      if (shouldLog) api.logger.info(`[event-bridge] mirror: stream=${evt.stream} runId=${evt.runId} seq=${evt.seq}`);
      gatewayBroadcast("rivonclaw.chat-mirror", {
        runId: evt.runId,
        sessionKey,
        stream: evt.stream,
        data: evt.data,
        seq: evt.seq,
      });
    });
    prevUnsubscribe = unsubscribe;

    // Cleanup on gateway_stop.
    api.on("gateway_stop", () => {
      if (prevUnsubscribe) {
        prevUnsubscribe();
        prevUnsubscribe = null;
      }
      runSessionMap.clear();
      gatewayBroadcast = null;
      eventCount = 0;
    });
  },
});
