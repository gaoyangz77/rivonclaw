import { describe, expect, it, vi } from "vitest";
import { ChatGatewayController } from "../../src/pages/chat/controllers/ChatGatewayController.js";
import { createChatStore } from "../../src/pages/chat/store/chat-store.js";

describe("ChatGatewayController tool events", () => {
  it("ignores heartbeat agent events from the gateway", () => {
    const store = createChatStore();
    const controller = new ChatGatewayController(store);
    const session = store.getOrCreateSession(store.activeSessionKey);
    session.runState.beginLocalRun("heartbeat-run", store.activeSessionKey);

    (controller as any).handleEvent({
      event: "agent",
      payload: {
        runId: "heartbeat-run",
        sessionKey: store.activeSessionKey,
        isHeartbeat: true,
        stream: "tool",
        data: { phase: "start", name: "read" },
      },
    });

    expect(session.messages).toEqual([]);
    expect(session.runState.displayToolName).toBeNull();
  });

  it("hydrates a switched tab even when realtime inbound already added one message", async () => {
    const store = createChatStore();
    const controller = new ChatGatewayController(store);
    const sessionKey = "agent:main:telegram:acct:direct:123";
    const session = store.getOrCreateSession(sessionKey);
    session.appendMessage({
      role: "user",
      text: "latest realtime message",
      timestamp: Date.now(),
      isExternal: true,
      channel: "telegram",
    });

    const request = vi.fn().mockResolvedValue({
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "older message" }],
          timestamp: 1,
        },
        {
          role: "assistant",
          content: [{ type: "text", text: "older reply" }],
          timestamp: 2,
        },
        {
          role: "user",
          content: [{ type: "text", text: "latest realtime message" }],
          timestamp: session.messages[0].timestamp,
          provenance: { kind: "external_user", sourceChannel: "telegram" },
        },
      ],
    });
    (controller as any).client = { request };

    await controller.switchSession(sessionKey);

    expect(request).toHaveBeenCalledWith(
      "chat.history",
      expect.objectContaining({
        sessionKey,
      }),
    );
    expect(session.historyHydrated).toBe(true);
    expect(session.messages.map((msg) => msg.text)).toEqual([
      "older message",
      "older reply",
      "latest realtime message",
    ]);
  });

  it("tracks mirrored assistant deltas for background external sessions", () => {
    const store = createChatStore();
    const controller = new ChatGatewayController(store);
    const sessionKey = "agent:main:telegram:acct:direct:123";

    (controller as any).handleEvent({
      event: "chat",
      payload: {
        runId: "run-background",
        sessionKey,
        state: "delta",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "background reply" }],
          timestamp: Date.now(),
        },
      },
    });

    const session = store.sessions.get(sessionKey)!;
    expect(session.runState.getRun("run-background")?.streaming).toBe("background reply");
    expect(session.unread).toBe(true);
  });

  it("clears active mirrored external streaming on final without duplicating history bubbles", () => {
    const store = createChatStore();
    const controller = new ChatGatewayController(store);
    const sessionKey = "agent:main:telegram:acct:direct:123";
    store.setActiveSessionKey(sessionKey);
    const session = store.getOrCreateSession(sessionKey);
    session.appendMessage({
      role: "assistant",
      text: "already persisted reply",
      timestamp: 1,
    });

    (controller as any).handleEvent({
      event: "chat",
      payload: {
        runId: "run-external",
        sessionKey,
        state: "delta",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "already persisted reply" }],
          timestamp: Date.now(),
        },
      },
    });
    expect(session.runState.displayStreaming).toBe("already persisted reply");

    (controller as any).handleEvent({
      event: "chat",
      payload: {
        runId: "run-external",
        sessionKey,
        state: "final",
      },
    });

    expect(session.runState.isActive).toBe(false);
    expect(session.messages.map((msg) => msg.text)).toEqual(["already persisted reply"]);
  });

  it("records tool events when agent payload uses toolName", () => {
    const store = createChatStore();
    const controller = new ChatGatewayController(store);
    const session = store.getOrCreateSession(store.activeSessionKey);

    session.runState.beginLocalRun("run-tool-name", store.activeSessionKey);

    (controller as any).handleEvent({
      event: "agent",
      payload: {
        runId: "run-tool-name",
        sessionKey: store.activeSessionKey,
        stream: "tool",
        data: {
          phase: "start",
          toolName: "search",
          toolCallId: "call-search-live",
          args: { query: "failed order" },
        },
      },
    });

    expect(session.messages).toEqual([
      expect.objectContaining({
        role: "tool-event",
        toolName: "search",
        toolCallId: "call-search-live",
        toolArgs: { query: "failed order" },
        toolStatus: "running",
      }),
    ]);
    expect(session.runState.displayToolName).toBe("search");
  });

  it("does not duplicate a live tool event when history is reloaded", async () => {
    const store = createChatStore();
    const controller = new ChatGatewayController(store);
    const session = store.getOrCreateSession(store.activeSessionKey);
    session.runState.beginLocalRun("run-order", store.activeSessionKey);

    (controller as any).handleEvent({
      event: "agent",
      payload: {
        runId: "run-order",
        sessionKey: store.activeSessionKey,
        stream: "tool",
        data: {
          phase: "start",
          name: "ecom_get_order",
          toolCallId: "call-order",
          args: { orderId: "577341290410316286" },
        },
      },
    });

    (controller as any).client = {
      request: vi.fn().mockResolvedValue({
        messages: [
          {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                id: "call-order",
                name: "ecom_get_order",
                arguments: { orderId: "577341290410316286" },
              },
            ],
            timestamp: 10_000,
          },
        ],
      }),
    };

    await controller.loadHistory();

    expect(session.messages).toEqual([
      expect.objectContaining({
        role: "tool-event",
        toolName: "ecom_get_order",
        toolCallId: "call-order",
        toolRunId: "run-order",
      }),
    ]);
  });

  it("marks the active tool event as failed when the run errors during tooling", () => {
    const store = createChatStore();
    const controller = new ChatGatewayController(store);
    controller.setTranslation(((key: string) => key) as any);
    const session = store.getOrCreateSession(store.activeSessionKey);

    session.runState.beginLocalRun("run-tool-error", store.activeSessionKey);

    (controller as any).handleEvent({
      event: "agent",
      payload: {
        runId: "run-tool-error",
        sessionKey: store.activeSessionKey,
        stream: "tool",
        data: {
          phase: "start",
          toolName: "search",
          args: { query: "failed order" },
        },
      },
    });

    (controller as any).handleEvent({
      event: "chat",
      payload: {
        runId: "run-tool-error",
        sessionKey: store.activeSessionKey,
        state: "error",
        errorMessage: "search backend timeout",
      },
    });

    expect(session.messages[0]).toEqual(
      expect.objectContaining({
        role: "tool-event",
        toolName: "search",
        toolStatus: "failed",
        toolError: "search backend timeout",
      }),
    );
    expect(session.messages[1]).toEqual(
      expect.objectContaining({
        role: "assistant",
        text: "\u26A0 chat.errorTimeout",
      }),
    );
  });

  it("shows generation stopped after the truncated assistant text for aborted local runs", () => {
    const store = createChatStore();
    const controller = new ChatGatewayController(store);
    controller.setTranslation(((key: string) => key) as any);
    const session = store.getOrCreateSession(store.activeSessionKey);

    session.runState.beginLocalRun("run-stop-order", store.activeSessionKey);
    session.runState.appendDelta("run-stop-order", "我现在能直接用的主要工具有这些：");

    (controller as any).client = {
      request: vi.fn().mockResolvedValue({ ok: true, aborted: true }),
    };

    controller.stopRun();

    expect(session.messages).toEqual([]);

    (controller as any).handleEvent({
      event: "chat",
      payload: {
        runId: "run-stop-order",
        sessionKey: store.activeSessionKey,
        state: "aborted",
      },
    });

    expect(session.messages).toEqual([
      expect.objectContaining({
        role: "assistant",
        text: "我现在能直接用的主要工具有这些：",
      }),
      expect.objectContaining({
        role: "assistant",
        text: "\u23F9 chat.stopCommandFeedback",
      }),
    ]);
  });

  describe("first tool call history patch", () => {
    // On the first tool start the Panel flushes whatever streamed text it has, which can
    // be short of what the gateway's throttle buffer held. It then re-reads
    // `chat.history` and replaces the flushed bubble with the full persisted text,
    // anchored on this run's user turn.
    const RUN_ID = "ce3bfd34-d3b6-466c-930f-7c735fe6044f";
    const PREVIOUS_RUN_ID = "0b1c7e0e-0000-4000-8000-000000000002";
    const TRUNCATED = "我先查一下这个订单的";
    const FULL = "我先查一下这个订单的物流状态，稍等。";

    // `chat.history` shape from the pinned gateway (OpenClaw 2026.9.3) while a run is
    // tooling: a sent user turn is persisted as `<clientRunId>:user`
    // (buildRunUserTurnIdempotencyKey) and a settled final reply under the bare run id.
    function gatewayHistory(currentUserTurnRunId: string) {
      return {
        messages: [
          {
            role: "user",
            content: "订单 577341290410316286 发货了吗",
            timestamp: 1795592200000,
            idempotencyKey: `${PREVIOUS_RUN_ID}:user`,
            __openclaw: { senderIsOwner: true, idempotencyKey: `${PREVIOUS_RUN_ID}:user`, seq: 1 },
          },
          {
            role: "assistant",
            content: [{ type: "text", text: "请稍等，我帮你看看。" }],
            timestamp: 1795592201000,
            idempotencyKey: PREVIOUS_RUN_ID,
          },
          {
            role: "user",
            content: "帮我查一下它的物流",
            timestamp: 1795592248888,
            idempotencyKey: `${currentUserTurnRunId}:user`,
            __openclaw: {
              senderIsOwner: true,
              idempotencyKey: `${currentUserTurnRunId}:user`,
              seq: 3,
            },
          },
          {
            role: "assistant",
            content: [
              { type: "text", text: FULL },
              {
                type: "toolCall",
                id: "call-order",
                name: "ecom_get_order",
                arguments: { orderId: "577341290410316286" },
              },
            ],
            timestamp: 1795592250000,
          },
        ],
      };
    }

    function startStreamedRunAndTool(history: ReturnType<typeof gatewayHistory>) {
      const store = createChatStore();
      const controller = new ChatGatewayController(store);
      const sessionKey = store.activeSessionKey;
      const session = store.getOrCreateSession(sessionKey);
      session.runState.beginLocalRun(RUN_ID, sessionKey);
      session.runState.appendDelta(RUN_ID, TRUNCATED);
      const request = vi.fn().mockResolvedValue(history);
      (controller as any).client = { request };

      (controller as any).handleEvent({
        event: "agent",
        payload: {
          runId: RUN_ID,
          sessionKey,
          stream: "tool",
          data: {
            phase: "start",
            name: "ecom_get_order",
            toolCallId: "call-order",
            args: { orderId: "577341290410316286" },
          },
        },
      });

      expect(request).toHaveBeenCalledWith("chat.history", { sessionKey, limit: 100 });
      return session;
    }

    const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));
    const assistantTexts = (session: ReturnType<typeof startStreamedRunAndTool>) =>
      session.messages.filter((msg) => msg.role === "assistant").map((msg) => msg.text);

    it("restores the full text when the run's user turn is keyed `<runId>:user`", async () => {
      const session = startStreamedRunAndTool(gatewayHistory(RUN_ID));
      expect(assistantTexts(session)).toEqual([TRUNCATED]);

      await flushPromises();

      expect(assistantTexts(session)).toEqual([FULL]);
      expect(session.runState.getRun(RUN_ID)?.flushedOffset).toBe(FULL.length);
    });

    it("keeps the streamed text when history does not yet hold this run's user turn", async () => {
      const session = startStreamedRunAndTool(
        gatewayHistory("ffffffff-0000-4000-8000-000000000003"),
      );

      await flushPromises();

      expect(assistantTexts(session)).toEqual([TRUNCATED]);
      expect(session.runState.getRun(RUN_ID)?.flushedOffset).toBe(TRUNCATED.length);
    });
  });
});
