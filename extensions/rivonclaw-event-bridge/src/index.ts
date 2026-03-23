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
    api.on(
      "message_received",
      (
        evt: { content?: string; from?: string; timestamp?: number },
        ctx: { channelId?: string; conversationId?: string },
      ) => {
        if (!gatewayBroadcast || !ctx?.channelId || !evt?.content) return;
        // Skip mobile channel — it has its own dedicated mobile.inbound mechanism.
        if (ctx.channelId === "mobile") return;

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
        if (!gatewayBroadcast || !ctx?.sessionKey || !ctx?.channelId) return;
        // Only process external channels (skip mobile — handled separately).
        if (ctx.channelId === "mobile") return;

        const queue = pendingInboundMessages.get(ctx.channelId);
        if (!queue || queue.length === 0) return;

        const pending = queue.shift()!;
        if (queue.length === 0) pendingInboundMessages.delete(ctx.channelId);

        api.logger.info(
          `[event-bridge] channel-inbound: broadcasting for channel=${ctx.channelId} sessionKey=${ctx.sessionKey}`,
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
        if (shouldLog) api.logger.info(`[event-bridge] skip: vendor-broadcasted (stream=${evt.stream} runId=${evt.runId} seq=${evt.seq})`);
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
