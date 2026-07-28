import { describe, expect, it } from "vitest";
import { ExpertStore } from "./expert-store.js";

const conversations = [
  {
    id: "conversation-1",
    title: "First conversation",
    lastMessageAt: "2026-07-28T00:00:00.000Z",
  },
  {
    id: "conversation-2",
    title: "Second conversation",
    lastMessageAt: "2026-07-27T00:00:00.000Z",
  },
];

describe("ExpertStore conversation lifecycle", () => {
  it("uses one local blank draft until the first question is dispatched", () => {
    const store = ExpertStore.create();
    store.applyBootstrap({ profile: {}, conversations });
    expect(store.selectedConversationId).toBe("conversation-1");

    store.startNewConversation();
    store.startNewConversation();

    expect(store.isNewConversationDraft).toBe(true);
    expect(store.selectedConversationId).toBeUndefined();
    expect(store.conversations).toHaveLength(2);

    store.applyBootstrap({ profile: {}, conversations });
    expect(store.selectedConversationId).toBeUndefined();
  });

  it("renames and removes conversations without selecting an unrelated thread", () => {
    const store = ExpertStore.create();
    store.applyBootstrap({ profile: {}, conversations });

    store.renameConversation("conversation-1", "US launch plan");
    expect(store.selectedConversation?.title).toBe("US launch plan");

    store.removeConversation("conversation-1");
    expect(store.selectedConversationId).toBeUndefined();
    expect(store.isNewConversationDraft).toBe(true);
    expect(store.conversations.map((item) => item.id)).toEqual(["conversation-2"]);
  });
});

describe("ExpertStore run lifecycle", () => {
  it("optimistically consumes and reconciles free daily quota", () => {
    const store = ExpertStore.create();
    store.applyBootstrap({
      profile: {},
      conversations,
      usage: {
        mode: "FREE_DAILY",
        freeRemaining: 5,
        freeLimit: 5,
        resetsAt: "2026-07-29T00:00:00.000Z",
      },
    });

    expect(store.optimisticallyConsumeFreeQuestion()).toBe(true);
    expect(store.usage?.freeRemaining).toBe(4);
    store.restoreOptimisticFreeQuestion();
    expect(store.usage?.freeRemaining).toBe(5);
    store.applyUsage({
      mode: "FREE_DAILY",
      freeRemaining: 3,
      freeLimit: 5,
      resetsAt: "2026-07-29T00:00:00.000Z",
    });
    expect(store.usage?.freeRemaining).toBe(3);
  });

  it("shows a starting state before a run id exists and fully resets after cancellation", () => {
    const store = ExpertStore.create();
    store.applyBootstrap({ profile: {}, conversations: [conversations[0]!] });
    store.prepareRun("Which market should I enter?");
    expect(store.isBusy).toBe(true);
    expect(store.runPhase).toBe("STARTING");
    expect(store.pendingQuestion).toBe("Which market should I enter?");

    store.beginRun("run-1", "conversation-1");
    expect(store.runPhase).toBe("WAITING");
    expect(store.messages[0]?.content).toBe("Which market should I enter?");

    store.appendDelta("Start with ");
    expect(store.runPhase).toBe("STREAMING");
    store.markCancelling();
    expect(store.runPhase).toBe("CANCELLING");

    store.cancelRun("Answer stopped.");
    expect(store.runPhase).toBe("IDLE");
    expect(store.activeRunId).toBeUndefined();
    expect(store.streamingAnswer).toBe("");
    expect(store.notice).toBe("Answer stopped.");

    store.prepareRun("What should I validate first?");
    expect(store.runPhase).toBe("STARTING");
    expect(store.notice).toBeUndefined();
  });

  it("clears partial output after a failed run", () => {
    const store = ExpertStore.create();
    store.prepareRun("Question");
    store.beginRun("run-1", "conversation-1");
    store.appendDelta("Partial answer");
    store.failRun("Please try again");

    expect(store.runPhase).toBe("IDLE");
    expect(store.streamingAnswer).toBe("");
    expect(store.error).toBe("Please try again");
  });

  it("removes the previous answer before rerunning an edited user question", () => {
    const store = ExpertStore.create();
    store.applyBootstrap({ profile: {}, conversations: [conversations[0]!] });
    store.replaceMessages([
      {
        id: "question-1",
        role: "USER",
        content: "Original question",
        createdAt: "2026-07-28T00:00:00.000Z",
      },
      {
        id: "answer-1",
        role: "ASSISTANT",
        content: "Original answer",
        createdAt: "2026-07-28T00:01:00.000Z",
      },
    ]);

    store.prepareRerun("question-1", "Revised question");
    expect(store.messages).toHaveLength(0);
    expect(store.pendingQuestion).toBe("Revised question");
    expect(store.runPhase).toBe("STARTING");

    store.beginRun("rerun-1", "conversation-1");
    expect(store.messages).toHaveLength(1);
    expect(store.messages[0]?.content).toBe("Revised question");
  });

  it("keeps a run bound to its conversation while the user navigates elsewhere", () => {
    const store = ExpertStore.create();
    store.applyBootstrap({ profile: {}, conversations });
    store.prepareRun("Question in the first conversation");
    store.bindRunConversation("conversation-1");
    store.beginRun("run-1", "conversation-1");
    store.appendDelta("First delta");

    store.startNewConversation();
    expect(store.isNewConversationDraft).toBe(true);
    expect(store.activeRunConversationId).toBe("conversation-1");
    expect(store.streamingAnswer).toBe("First delta");

    store.selectConversation("conversation-2");
    store.appendDelta(" and second delta");
    expect(store.selectedConversationId).toBe("conversation-2");
    expect(store.activeRunConversationId).toBe("conversation-1");
    expect(store.streamingAnswer).toBe("First delta and second delta");

    store.finishRun();
    expect(store.selectedConversationId).toBe("conversation-2");
    expect(store.activeRunConversationId).toBeUndefined();
  });
});
