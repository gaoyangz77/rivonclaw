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
  it("shows a starting state before a run id exists and fully resets after cancellation", () => {
    const store = ExpertStore.create();
    store.prepareRun("Which market should I enter?");
    expect(store.isBusy).toBe(true);
    expect(store.runPhase).toBe("STARTING");
    expect(store.pendingQuestion).toBe("Which market should I enter?");

    store.beginRun("run-1");
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
    store.beginRun("run-1");
    store.appendDelta("Partial answer");
    store.failRun("Please try again");

    expect(store.runPhase).toBe("IDLE");
    expect(store.streamingAnswer).toBe("");
    expect(store.error).toBe("Please try again");
  });
});
