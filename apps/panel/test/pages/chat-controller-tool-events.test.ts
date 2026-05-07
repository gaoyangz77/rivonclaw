import { describe, expect, it, vi } from "vitest";
import { ChatGatewayController } from "../../src/pages/chat/controllers/ChatGatewayController.js";
import { createChatStore } from "../../src/pages/chat/store/chat-store.js";

describe("ChatGatewayController tool events", () => {
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

    expect(request).toHaveBeenCalledWith("chat.history", expect.objectContaining({
      sessionKey,
    }));
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
          args: { query: "failed order" },
        },
      },
    });

    expect(session.messages).toEqual([
      expect.objectContaining({
        role: "tool-event",
        toolName: "search",
        toolArgs: { query: "failed order" },
        toolStatus: "running",
      }),
    ]);
    expect(session.runState.displayToolName).toBe("search");
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

    expect(session.messages[0]).toEqual(expect.objectContaining({
      role: "tool-event",
      toolName: "search",
      toolStatus: "failed",
      toolError: "search backend timeout",
    }));
    expect(session.messages[1]).toEqual(expect.objectContaining({
      role: "assistant",
      text: "\u26A0 chat.errorTimeout",
    }));
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
});
