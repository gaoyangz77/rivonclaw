import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FeishuEscalationResponseProcessor,
  type CsEscalationResponseGatewayPayload,
} from "./feishu-escalation-response.js";

vi.mock("@rivonclaw/logger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rivonclaw/logger")>()),
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("../telemetry/cs-telemetry-ref.js", () => ({ emitCsEscalationEvent: vi.fn() }));

const payload: CsEscalationResponseGatewayPayload = {
  schemaVersion: 1,
  callbackId: "callback-1",
  accountId: "account-1",
  operatorOpenId: "ou_staff",
  chatId: "oc_chat",
  messageId: "om_card",
  escalationId: "M1DG8V",
  decision: "Approve the full refund",
  resolved: true,
  submittedAt: 1_750_000_000_000,
};

function pendingEscalation() {
  return {
    csGetEscalationResult: {
      id: payload.escalationId,
      shopId: "shop-1",
      conversationId: "conv-1",
      buyerUserId: "buyer-1",
      buyerNickname: "mayracastrocabrer",
      orderId: "576924518065478202",
      reason: "Refund requested",
      context: "Buyer contacted support",
      status: "PENDING",
      version: 1,
      result: null,
    },
  };
}

function processedEscalation() {
  return {
    csGetEscalationResult: {
      ...pendingEscalation().csGetEscalationResult,
      id: payload.escalationId,
      status: "RESOLVED",
      version: 2,
      result: {
        decision: "Approve the full refund",
        resolved: true,
        resolvedAt: "2026-07-20T12:00:00.000Z",
      },
    },
  };
}

function unresolvedEscalation() {
  return {
    csGetEscalationResult: {
      ...pendingEscalation().csGetEscalationResult,
      status: "PENDING",
      version: 2,
      result: {
        decision: "Ask the warehouse for an update",
        resolved: false,
        resolvedAt: "2026-07-20T12:00:00.000Z",
      },
    },
  };
}

function createHistory() {
  const entries: any[] = [];
  return {
    entries,
    append: vi.fn((entry: any) => {
      if (
        entries.some(
          (candidate) =>
            candidate.ownerId === entry.ownerId &&
            candidate.channelId === entry.channelId &&
            candidate.callbackId === entry.callbackId,
        )
      ) {
        return false;
      }
      entries.push(entry);
      return true;
    }),
    hasCallback: vi.fn((ownerId: string, channelId: string, callbackId: string) =>
      entries.some(
        (entry) =>
          entry.ownerId === ownerId &&
          entry.channelId === channelId &&
          entry.callbackId === callbackId,
      ),
    ),
    listByEscalationId: vi.fn((ownerId: string, escalationId: string, limit = 5) =>
      entries
        .filter((entry) => entry.ownerId === ownerId && entry.escalationId === escalationId)
        .slice(-limit),
    ),
    countByEscalationId: vi.fn(
      (ownerId: string, escalationId: string) =>
        entries.filter((entry) => entry.ownerId === ownerId && entry.escalationId === escalationId)
          .length,
    ),
  };
}

function createMessenger() {
  return {
    patchCard: vi.fn().mockResolvedValue(undefined),
    sendText: vi.fn().mockResolvedValue(undefined),
  };
}

/** The card handed to the write-back call at `index`; negative counts from the end. */
function patchedCard(messenger: ReturnType<typeof createMessenger>, index = -1): any {
  return messenger.patchCard.mock.calls.at(index)![0].card;
}

/** The submit button of the form in `card`, or undefined when the form is gone. */
function submitButton(card: any): any {
  const form = card.body.elements.find((element: any) => element.tag === "form");
  return form?.elements.find((element: any) => element.tag === "button");
}

function createHarness(graphqlFetch = vi.fn(), history = createHistory()) {
  const messenger = createMessenger();
  const auth = { graphqlFetch } as any;
  const processor = new FeishuEscalationResponseProcessor({
    locale: () => "en",
    getAuth: () => auth,
    messenger,
    history: history as any,
    resolveShopName: () => "Test Shop",
    mutationTimeoutMs: 20,
  });
  return { processor, graphqlFetch, messenger, auth, history };
}

describe("FeishuEscalationResponseProcessor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preflights and calls CS_RESPOND_MUTATION with the exact form values without agent dispatch", async () => {
    const graphqlFetch = vi
      .fn()
      .mockResolvedValueOnce(pendingEscalation())
      .mockResolvedValueOnce({
        csRespond: { ok: true, escalationId: payload.escalationId, status: "RESOLVED", version: 2 },
      });
    const { processor, messenger } = createHarness(graphqlFetch);

    await processor.handle(payload);

    expect(graphqlFetch).toHaveBeenNthCalledWith(2, expect.stringContaining("mutation CsRespond"), {
      escalationId: "M1DG8V",
      decision: "Approve the full refund",
      instructions: "",
      resolved: true,
    });
    expect(messenger.patchCard).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "account-1", messageId: "om_card" }),
    );
    // One freeze card up front, then the result card.
    expect(messenger.patchCard).toHaveBeenCalledTimes(2);
    expect(submitButton(patchedCard(messenger, 0))).toEqual(
      expect.objectContaining({ disabled: true }),
    );
    const editedCard = patchedCard(messenger);
    const serializedCard = JSON.stringify(editedCard);
    expect(editedCard.header.template).toBe("green");
    expect(serializedCard).toContain("Test Shop");
    expect(serializedCard).toContain("mayracastrocabrer");
    expect(serializedCard).toContain("576924518065478202");
    expect(serializedCard).toContain("Approve the full refund");
    expect(serializedCard).toContain("Resolution");
    expect(serializedCard).not.toContain("Feedback history");
    expect(serializedCard).not.toContain('"tag":"form"');
    expect(serializedCard).not.toContain('"tag":"button"');
    // The write-back is the only outbound call: no agent dispatch, no text fallback.
    expect(messenger.sendText).not.toHaveBeenCalled();
  });

  it("keeps unresolved feedback orange and actionable", async () => {
    const graphqlFetch = vi
      .fn()
      .mockResolvedValueOnce(pendingEscalation())
      .mockResolvedValueOnce({ csRespond: { ok: true, status: "PENDING", version: 2 } });
    const { processor, messenger, history } = createHarness(graphqlFetch);

    await processor.handle({ ...payload, resolved: false });

    expect(graphqlFetch.mock.calls[1][1]).toEqual(expect.objectContaining({ resolved: false }));
    expect(history.entries).toEqual([
      expect.objectContaining({ decision: payload.decision, resolved: false, channelId: "feishu" }),
    ]);
    const card = patchedCard(messenger);
    const serialized = JSON.stringify(card);
    expect(card.header.template).toBe("orange");
    expect(serialized).toContain("Feedback history");
    expect(serialized).toContain('"tag":"form"');
    expect(serialized).toContain('"tag":"button"');
  });

  it("skips mutation and renders already processed when the escalation is resolved", async () => {
    const graphqlFetch = vi.fn().mockResolvedValueOnce(processedEscalation());
    const { processor, messenger } = createHarness(graphqlFetch);

    await processor.handle({
      ...payload,
      decision: "A stale second-click decision",
      resolved: false,
    });

    expect(graphqlFetch).toHaveBeenCalledTimes(1);
    expect(messenger.patchCard).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: "om_card", card: expect.any(Object) }),
    );
    const card = patchedCard(messenger);
    const serialized = JSON.stringify(card);
    expect(serialized).toContain("Approve the full refund");
    expect(serialized).toContain("Resolved");
    expect(serialized).not.toContain("A stale second-click decision");
  });

  it("allows a new response after an unresolved result, then closes with both history entries", async () => {
    const graphqlFetch = vi
      .fn()
      .mockResolvedValueOnce(unresolvedEscalation())
      .mockResolvedValueOnce({ csRespond: { ok: true, status: "RESOLVED", version: 3 } });
    const history = createHistory();
    history.append({
      ownerId: "unknown",
      channelId: "feishu",
      callbackId: "callback-previous",
      escalationId: payload.escalationId,
      accountId: payload.accountId,
      messageId: payload.messageId,
      operatorId: payload.operatorOpenId,
      decision: "Ask the warehouse for an update",
      resolved: false,
      submittedAt: payload.submittedAt - 60_000,
      version: 2,
    });
    const { processor, messenger } = createHarness(graphqlFetch, history);

    await processor.handle({
      ...payload,
      callbackId: "callback-final",
      decision: "Warehouse confirmed the replacement; close the case",
      resolved: true,
    });

    expect(graphqlFetch).toHaveBeenCalledTimes(2);
    const card = patchedCard(messenger);
    const serialized = JSON.stringify(card);
    expect(card.header.template).toBe("green");
    expect(serialized).toContain("Feedback history");
    expect(serialized).toContain("Ask the warehouse for an update");
    expect(serialized).toContain("Resolution");
    expect(serialized).toContain("Warehouse confirmed the replacement; close the case");
    expect(serialized).not.toContain('"tag":"form"');
    expect(serialized).not.toContain('"tag":"button"');
  });

  it("deduplicates a completed callback without blocking a distinct unresolved update", async () => {
    const history = createHistory();
    history.append({
      ownerId: "unknown",
      channelId: "feishu",
      callbackId: payload.callbackId,
      escalationId: payload.escalationId,
      accountId: payload.accountId,
      messageId: payload.messageId,
      operatorId: payload.operatorOpenId,
      decision: "Ask the warehouse for an update",
      resolved: false,
      submittedAt: payload.submittedAt,
      version: 2,
    });
    const duplicateFetch = vi.fn().mockResolvedValueOnce(unresolvedEscalation());
    const { processor, messenger } = createHarness(duplicateFetch, history);

    await processor.handle({ ...payload, resolved: false });

    expect(duplicateFetch).toHaveBeenCalledTimes(1);
    expect(patchedCard(messenger).header.template).toBe("orange");
    expect(JSON.stringify(patchedCard(messenger))).toContain('"tag":"form"');
  });

  it("deduplicates concurrent callbacks for the same account and card", async () => {
    let release!: (value: unknown) => void;
    const preflight = new Promise((resolve) => {
      release = resolve;
    });
    const graphqlFetch = vi
      .fn()
      .mockReturnValueOnce(preflight)
      .mockResolvedValueOnce({ csRespond: { ok: true, status: "RESOLVED", version: 2 } });
    const { processor } = createHarness(graphqlFetch);

    const first = processor.handle(payload);
    const second = processor.handle({ ...payload, callbackId: "callback-2" });
    await Promise.resolve();
    expect(graphqlFetch).toHaveBeenCalledTimes(1);
    release(pendingEscalation());
    await Promise.all([first, second]);

    expect(graphqlFetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["preflight query failure", () => vi.fn().mockRejectedValueOnce(new Error("offline"))],
    [
      "escalation not found",
      () => vi.fn().mockResolvedValueOnce({ csGetEscalationResult: null }),
    ],
  ])("leaves the card untouched on %s and sends a failure reply", async (_name, makeFetch) => {
    const { processor, messenger } = createHarness(makeFetch());

    await processor.handle(payload);

    // These paths run before the freeze, so there is no frozen card to repaint.
    expect(messenger.patchCard).not.toHaveBeenCalled();
    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "account-1", receiveId: "oc_chat" }),
    );
  });

  it("unfreezes the card with a failure notice when the mutation is rejected", async () => {
    const graphqlFetch = vi
      .fn()
      .mockResolvedValueOnce(pendingEscalation())
      .mockResolvedValueOnce({ csRespond: { ok: false, error: "rejected" } });
    const { processor, messenger } = createHarness(graphqlFetch);

    await processor.handle(payload);

    expect(messenger.patchCard).toHaveBeenCalledTimes(2);
    const card = patchedCard(messenger);
    const serialized = JSON.stringify(card);
    expect(serialized).toContain("Could not submit the response.");
    expect(serialized).toContain("Test Shop");
    expect(serialized).toContain("mayracastrocabrer");
    expect(serialized).toContain("Refund requested");
    expect(submitButton(card)).not.toHaveProperty("disabled");
    expect(messenger.sendText).not.toHaveBeenCalled();
  });

  it("falls back to a text reply when the failure card cannot be patched", async () => {
    const graphqlFetch = vi
      .fn()
      .mockResolvedValueOnce(pendingEscalation())
      .mockResolvedValueOnce({ csRespond: { ok: false, error: "rejected" } });
    const { processor, messenger } = createHarness(graphqlFetch);
    messenger.patchCard
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("card update rejected"));

    await processor.handle(payload);

    expect(messenger.sendText).toHaveBeenCalledWith({
      accountId: "account-1",
      receiveId: "oc_chat",
      text: "Could not submit the response. Please try again.",
    });
  });

  it("fails closed when Desktop authentication is missing", async () => {
    const messenger = createMessenger();
    const processor = new FeishuEscalationResponseProcessor({
      locale: () => "en",
      getAuth: () => null,
      messenger,
      history: createHistory() as any,
      resolveShopName: () => undefined,
    });

    await processor.handle(payload);

    expect(messenger.sendText).toHaveBeenCalledTimes(1);
    expect(messenger.patchCard).not.toHaveBeenCalled();
  });

  it("freezes the submit button between the preflight and the mutation", async () => {
    const graphqlFetch = vi
      .fn()
      .mockResolvedValueOnce(pendingEscalation())
      .mockResolvedValueOnce({ csRespond: { ok: true, status: "RESOLVED", version: 2 } });
    const { processor, messenger } = createHarness(graphqlFetch);

    await processor.handle(payload);

    const frozenAt = messenger.patchCard.mock.invocationCallOrder[0];
    expect(frozenAt).toBeGreaterThan(graphqlFetch.mock.invocationCallOrder[0]);
    expect(frozenAt).toBeLessThan(graphqlFetch.mock.invocationCallOrder[1]);
    const freezeCard = patchedCard(messenger, 0);
    const frozenSerialized = JSON.stringify(freezeCard);
    expect(frozenSerialized).toContain("Submitting your response, please wait…");
    // The freeze keeps the case on screen instead of blanking it to placeholders.
    expect(frozenSerialized).toContain("Test Shop");
    expect(frozenSerialized).toContain("mayracastrocabrer");
    expect(frozenSerialized).toContain("576924518065478202");
    expect(frozenSerialized).toContain("Refund requested");
    expect(frozenSerialized).toContain("conv-1");
    expect(submitButton(freezeCard)).toEqual(
      expect.objectContaining({
        disabled: true,
        disabled_tips: { tag: "plain_text", content: "Processing — please do not submit again." },
      }),
    );
  });

  it("does not abort the mutation when the freeze card cannot be patched", async () => {
    const graphqlFetch = vi
      .fn()
      .mockResolvedValueOnce(pendingEscalation())
      .mockResolvedValueOnce({ csRespond: { ok: true, status: "RESOLVED", version: 2 } });
    const { processor, messenger } = createHarness(graphqlFetch);
    messenger.patchCard.mockRejectedValueOnce(new Error("card patch rejected"));

    await processor.handle(payload);

    expect(graphqlFetch).toHaveBeenCalledTimes(2);
    expect(patchedCard(messenger).header.template).toBe("green");
  });

  it("rechecks an uncertain mutation before showing success", async () => {
    const graphqlFetch = vi
      .fn()
      .mockResolvedValueOnce(pendingEscalation())
      .mockRejectedValueOnce(new Error("network disconnected after send"))
      .mockResolvedValueOnce(processedEscalation());
    const { processor, messenger } = createHarness(graphqlFetch);

    await processor.handle(payload);

    expect(graphqlFetch).toHaveBeenCalledTimes(3);
    expect(messenger.patchCard).toHaveBeenCalledTimes(2);
    expect(patchedCard(messenger).header.template).toBe("green");
  });

  it("does not mistake an unchanged unresolved result for a successful timed-out update", async () => {
    const graphqlFetch = vi
      .fn()
      .mockResolvedValueOnce(unresolvedEscalation())
      .mockRejectedValueOnce(new Error("network disconnected after send"))
      .mockResolvedValueOnce(unresolvedEscalation());
    const { processor, messenger } = createHarness(graphqlFetch);

    await processor.handle({
      ...payload,
      callbackId: "callback-new-update",
      decision: "A newer instruction that may not have reached the backend",
      resolved: false,
    });

    // The backend may still be processing, so the card stays frozen and says so.
    expect(messenger.patchCard).toHaveBeenCalledTimes(2);
    const card = patchedCard(messenger);
    const serialized = JSON.stringify(card);
    expect(serialized).toContain(
      "The result could not be confirmed. Please refresh later to check.",
    );
    expect(serialized).toContain("Test Shop");
    expect(serialized).toContain("mayracastrocabrer");
    expect(submitButton(card)).toEqual(expect.objectContaining({ disabled: true }));
    expect(messenger.sendText).not.toHaveBeenCalled();
  });

  it("uses a success reply when mutation succeeded but the card edit fails", async () => {
    const graphqlFetch = vi
      .fn()
      .mockResolvedValueOnce(pendingEscalation())
      .mockResolvedValueOnce({ csRespond: { ok: true, status: "RESOLVED", version: 2 } });
    const { processor, messenger } = createHarness(graphqlFetch);
    // The first patch is the freeze card; only the result patch fails.
    messenger.patchCard
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("card update rejected"));

    await processor.handle(payload);

    expect(messenger.sendText).toHaveBeenCalledWith({
      accountId: "account-1",
      receiveId: "oc_chat",
      text: "Response submitted successfully.",
    });
  });
});
