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
 *    sessionKey and broadcasts via `plugin.rivonclaw.chat-mirror`.
 * 4. Broadcasts `plugin.rivonclaw.channel-inbound` for external channel user
 *    messages so they appear on the Chat Page in real time (not only after history sync).
 *    Uses a two-phase approach: `message_received` captures the message text,
 *    then `llm_input` resolves the sessionKey and broadcasts. `before_agent_start`
 *    is kept as a fallback for vendor hook ordering differences.
 */

import { defineRivonClawPlugin } from "@rivonclaw/plugin-sdk";

const RUN_SESSION_CLEANUP_DELAY_MS = 5 * 60_000;

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

type TimerHandle = ReturnType<typeof setTimeout>;

export function createRunSessionTracker(cleanupDelayMs = RUN_SESSION_CLEANUP_DELAY_MS) {
  const sessions = new Map<string, string>();
  const cleanupTimers = new Map<string, TimerHandle>();

  const clearCleanupTimer = (runId: string): void => {
    const timer = cleanupTimers.get(runId);
    if (timer) {
      clearTimeout(timer);
      cleanupTimers.delete(runId);
    }
  };

  return {
    set(runId: string, sessionKey: string): void {
      clearCleanupTimer(runId);
      sessions.set(runId, sessionKey);
    },
    get(runId: string): string | undefined {
      return sessions.get(runId);
    },
    get size(): number {
      return sessions.size;
    },
    clear(): void {
      for (const timer of cleanupTimers.values()) clearTimeout(timer);
      cleanupTimers.clear();
      sessions.clear();
    },
    scheduleCleanup(runId: string): void {
      clearCleanupTimer(runId);
      cleanupTimers.set(
        runId,
        setTimeout(() => {
          sessions.delete(runId);
          cleanupTimers.delete(runId);
        }, cleanupDelayMs),
      );
    },
  };
}

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

export function shouldMirrorExternalSession(sessionKey?: string): boolean {
  const channelId = resolveChannelIdFromSessionKey(sessionKey);
  if (!channelId) return false;
  return (
    channelId !== "main" &&
    channelId !== "cs" &&
    channelId !== "affiliate" &&
    !channelId.startsWith("panel-") &&
    !shouldSkipChannelInbound(channelId)
  );
}

// ── Module-level state ───────────────────────────────────────────────
// State lives at module level so it survives across setup() calls
// (OpenClaw may call register→activate, invoking setup twice, and may
// reuse cached registries on gateway restart without calling setup again).
const runSessionTracker = createRunSessionTracker();
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
    runSessionTracker.clear();
    pendingInboundMessages.clear();
    eventCount = 0;
    // Keep gatewayBroadcast — it will be recaptured via event_bridge_init if null.

    const broadcastPendingInboundForSession = (
      sessionKey: string,
      channelHint?: string,
      source = "unknown",
    ): boolean => {
      if (!gatewayBroadcast) return false;
      const sessionChannelId = resolveChannelIdFromSessionKey(sessionKey);
      const channelId = sessionChannelId ?? channelHint;
      if (!channelId) {
        api.logger.warn(`[event-bridge] channel-inbound: cannot resolve channel for sessionKey=${sessionKey}`);
        return false;
      }
      if (shouldSkipChannelInbound(channelId)) return false;

      const queue = pendingInboundMessages.get(channelId);
      if (!queue || queue.length === 0) return false;

      const pending = queue.shift()!;
      if (queue.length === 0) pendingInboundMessages.delete(channelId);

      api.logger.info(
        `[event-bridge] channel-inbound: broadcasting source=${source} channel=${channelId} sessionKey=${sessionKey}`,
      );
      gatewayBroadcast("plugin.rivonclaw.channel-inbound", {
        sessionKey,
        message: pending.content,
        timestamp: pending.timestamp,
        channel: pending.channelId,
      });
      return true;
    };

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
      (evt: { runId?: string }, ctx: { sessionKey?: string; channelId?: string }) => {
        if (evt.runId && ctx?.sessionKey) {
          runSessionTracker.set(evt.runId, ctx.sessionKey);
          api.logger.info(`[event-bridge] llm_input mapped runId=${evt.runId} → sessionKey=${ctx.sessionKey}`);
          broadcastPendingInboundForSession(ctx.sessionKey, ctx.channelId, "llm_input");
        } else {
          api.logger.warn(`[event-bridge] llm_input missing: runId=${evt.runId ?? "undefined"} sessionKey=${ctx?.sessionKey ?? "undefined"}`);
        }
      },
    );

    // ── Capture inbound user messages from external channels ────────
    // The `message_received` hook fires for ALL channels when a user message
    // arrives, but its context only has { channelId, conversationId } — no
    // sessionKey. We store the message in a per-channelId FIFO queue so a later
    // routing hook with sessionKey (`llm_input`, with `before_agent_start` as
    // fallback) can consume it and broadcast to the Chat Page.
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
    // Fallback for vendor hook ordering differences. The primary path is
    // `llm_input`, which is known to include sessionKey in current OpenClaw.
    api.on(
      "before_agent_start",
      (
        _evt: { prompt?: string },
        ctx: { sessionKey?: string; channelId?: string; trigger?: string },
      ) => {
        if (!ctx?.sessionKey) return;
        broadcastPendingInboundForSession(ctx.sessionKey, ctx.channelId, "before_agent_start");
      },
    );

    // ── Cleanup map entries after agent_end with a delay ────────────
    // External channels (Telegram, WeChat, etc.) reuse the same sessionKey
    // across many runs. Cleanup must therefore be scoped to the ended runId;
    // deleting every mapping for the sessionKey can make later assistant
    // chunks from overlapping runs disappear from the Chat Page.
    api.on(
      "agent_end",
      (evt: { runId?: string }) => {
        if (!evt?.runId) return;
        runSessionTracker.scheduleCleanup(evt.runId);
      },
    );

    // ── Mirror suppressed agent events to Chat Page ─────────────────
    const unsubscribe = (api as any).runtime.events.onAgentEvent((evt: AgentEventPayload) => {
      eventCount++;
      const shouldLog = eventCount <= 5 || eventCount % 50 === 0;

      const mappedSessionKey = runSessionTracker.get(evt.runId);
      const sessionKey = mappedSessionKey ?? evt.sessionKey;

      // If sessionKey is present for a non-external run, server-chat.ts is
      // already broadcasting to the Control UI. External channel runs are the
      // exception: OpenClaw may attach sessionKey to lifecycle terminal events
      // while still suppressing Control UI broadcasts via isControlUiVisible.
      // Mirror those too so the Chat Page can clear the streaming run state.
      if (evt.sessionKey && !shouldMirrorExternalSession(sessionKey)) {
        if (shouldLog) api.logger.debug?.(`[event-bridge] skip: vendor-broadcasted (stream=${evt.stream} runId=${evt.runId} seq=${evt.seq})`);
        return;
      }

      if (!gatewayBroadcast) {
        if (shouldLog) api.logger.warn(`[event-bridge] drop: no broadcast fn (stream=${evt.stream} runId=${evt.runId})`);
        return;
      }

      if (!sessionKey) {
        if (shouldLog) api.logger.warn(`[event-bridge] drop: no sessionKey in map (stream=${evt.stream} runId=${evt.runId} mapSize=${runSessionTracker.size})`);
        return;
      }

      // Only mirror streams the Chat Page cares about.
      if (evt.stream !== "assistant" && evt.stream !== "lifecycle" && evt.stream !== "tool") {
        if (shouldLog) api.logger.info(`[event-bridge] skip: unneeded stream=${evt.stream} runId=${evt.runId}`);
        return;
      }

      if (shouldLog) api.logger.info(`[event-bridge] mirror: stream=${evt.stream} runId=${evt.runId} seq=${evt.seq}`);
      gatewayBroadcast("plugin.rivonclaw.chat-mirror", {
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
      runSessionTracker.clear();
      gatewayBroadcast = null;
      eventCount = 0;
    });
  },
});
