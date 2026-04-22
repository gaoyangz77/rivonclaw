import { describe, expect, it } from "vitest";
import { ChatGatewayController } from "../../src/pages/chat/controllers/ChatGatewayController.js";
import { createChatStore } from "../../src/pages/chat/store/chat-store.js";

describe("ChatGatewayController tool events", () => {
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
});
