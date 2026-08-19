import { describe, expect, it, vi } from "vitest";
import {
  CsEscalationResponseProcessor,
  type CsEscalationResponseSubmission,
} from "./cs-escalation-response.js";

vi.mock("@rivonclaw/logger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rivonclaw/logger")>()),
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("../telemetry/cs-telemetry-ref.js", () => ({ emitCsEscalationEvent: vi.fn() }));

function createHistory() {
  const entries: any[] = [];
  return {
    entries,
    append(entry: any) {
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
    },
    hasCallback(ownerId: string, channelId: string, callbackId: string) {
      return entries.some(
        (entry) =>
          entry.ownerId === ownerId &&
          entry.channelId === channelId &&
          entry.callbackId === callbackId,
      );
    },
    listByEscalationId(ownerId: string, escalationId: string, limit = 5) {
      return entries
        .filter((entry) => entry.ownerId === ownerId && entry.escalationId === escalationId)
        .slice(-limit);
    },
    countByEscalationId(ownerId: string, escalationId: string) {
      return entries.filter(
        (entry) => entry.ownerId === ownerId && entry.escalationId === escalationId,
      ).length;
    },
  };
}

const submission: CsEscalationResponseSubmission = {
  schemaVersion: 1,
  callbackId: "telegram-update-1",
  channelId: "telegram",
  accountId: "telegram-account",
  operatorId: "telegram-user-1",
  chatId: "telegram-chat",
  messageId: "telegram-message",
  escalationId: "M1DG8V",
  decision: "Ask the warehouse for an update",
  resolved: false,
  submittedAt: 1_750_000_000_000,
};

function createAdapter(overrides: Partial<Record<string, any>> = {}) {
  return {
    telemetrySource: "telegram_controls",
    updateMessage: vi.fn().mockResolvedValue(undefined),
    acknowledgeSubmission: vi.fn().mockResolvedValue(undefined),
    sendFailure: vi.fn().mockResolvedValue(undefined),
    sendUncertain: vi.fn().mockResolvedValue(undefined),
    sendSuccessFallback: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("CsEscalationResponseProcessor", () => {
  it("keeps channel workflow in the adapter and supports a Telegram-shaped submission", async () => {
    const graphqlFetch = vi
      .fn()
      .mockResolvedValueOnce({
        csGetEscalationResult: {
          id: submission.escalationId,
          shopId: "shop-1",
          conversationId: "conversation-1",
          buyerNickname: "buyer-1",
          reason: "Replacement delayed",
          status: "PENDING",
          version: 1,
          result: null,
        },
      })
      .mockResolvedValueOnce({ csRespond: { ok: true, status: "PENDING", version: 2 } });
    const adapter = createAdapter();
    const updateMessage = adapter.updateMessage;
    const history = createHistory();
    const processor = new CsEscalationResponseProcessor({
      getAuth: () => ({
        graphqlFetch,
        getCachedUser: () => ({ userId: "owner-1" }),
      }),
      adapter,
      history: history as any,
      resolveShopName: () => "Test Shop",
    });

    await processor.handle(submission);

    expect(graphqlFetch).toHaveBeenNthCalledWith(2, expect.stringContaining("mutation CsRespond"), {
      escalationId: "M1DG8V",
      decision: "Ask the warehouse for an update",
      instructions: "",
      resolved: false,
    });
    expect(updateMessage).toHaveBeenCalledWith(
      submission,
      expect.objectContaining({
        escalationId: "M1DG8V",
        shop: "Test Shop",
        resolved: false,
        feedback: [
          expect.objectContaining({
            decision: "Ask the warehouse for an update",
            resolved: false,
          }),
        ],
      }),
    );
    expect(history.entries[0]).toEqual(
      expect.objectContaining({ ownerId: "owner-1", channelId: "telegram" }),
    );
    // The freeze carries the escalation details, and lands between the preflight that
    // produced them and the mutation whose latency it covers.
    expect(adapter.acknowledgeSubmission).toHaveBeenCalledWith(
      submission,
      expect.objectContaining({ escalationId: "M1DG8V", shop: "Test Shop", buyer: "buyer-1" }),
    );
    const acknowledgedAt = adapter.acknowledgeSubmission.mock.invocationCallOrder[0];
    expect(acknowledgedAt).toBeGreaterThan(graphqlFetch.mock.invocationCallOrder[0]);
    expect(acknowledgedAt).toBeLessThan(graphqlFetch.mock.invocationCallOrder[1]);
  });

  it("never freezes a card on the paths that run before the preflight", async () => {
    const missingAuth = createAdapter();
    await new CsEscalationResponseProcessor({
      getAuth: () => null,
      adapter: missingAuth,
      history: createHistory() as any,
      resolveShopName: () => "Test Shop",
    }).handle(submission);

    expect(missingAuth.acknowledgeSubmission).not.toHaveBeenCalled();
    expect(missingAuth.sendFailure).toHaveBeenCalledWith(submission);

    const preflightFailed = createAdapter();
    await new CsEscalationResponseProcessor({
      getAuth: () => ({ graphqlFetch: vi.fn().mockRejectedValue(new Error("offline")) }),
      adapter: preflightFailed,
      history: createHistory() as any,
      resolveShopName: () => "Test Shop",
    }).handle(submission);

    expect(preflightFailed.acknowledgeSubmission).not.toHaveBeenCalled();
    expect(preflightFailed.sendFailure).toHaveBeenCalledWith(submission);

    const notFound = createAdapter();
    await new CsEscalationResponseProcessor({
      getAuth: () => ({ graphqlFetch: vi.fn().mockResolvedValue({ csGetEscalationResult: null }) }),
      adapter: notFound,
      history: createHistory() as any,
      resolveShopName: () => "Test Shop",
    }).handle(submission);

    expect(notFound.acknowledgeSubmission).not.toHaveBeenCalled();
    expect(notFound.sendFailure).toHaveBeenCalledWith(submission);
  });

  it("rejects at the inflight limit without freezing anything", async () => {
    const adapter = createAdapter();
    const processor = new CsEscalationResponseProcessor({
      getAuth: () => ({ graphqlFetch: vi.fn().mockImplementation(() => new Promise(() => {})) }),
      adapter,
      history: createHistory() as any,
      resolveShopName: () => "Test Shop",
    });
    // Saturate the inflight set with distinct, permanently pending callbacks.
    for (let index = 0; index < 256; index += 1) {
      void processor.handle({ ...submission, messageId: `pending-${index}` });
    }

    await processor.handle({ ...submission, messageId: "one-too-many" });

    expect(adapter.acknowledgeSubmission).not.toHaveBeenCalled();
    expect(adapter.sendFailure).toHaveBeenCalledWith({
      ...submission,
      messageId: "one-too-many",
    });
  });

  it("carries the escalation details into a definite rejection", async () => {
    const graphqlFetch = vi
      .fn()
      .mockResolvedValueOnce({
        csGetEscalationResult: {
          id: submission.escalationId,
          shopId: "shop-1",
          conversationId: "conversation-1",
          buyerNickname: "buyer-1",
          reason: "Replacement delayed",
          status: "PENDING",
          version: 1,
          result: null,
        },
      })
      .mockResolvedValueOnce({ csRespond: { ok: false, error: "rejected" } });
    const adapter = createAdapter();
    await new CsEscalationResponseProcessor({
      getAuth: () => ({ graphqlFetch }),
      adapter,
      history: createHistory() as any,
      resolveShopName: () => "Test Shop",
    }).handle(submission);

    expect(adapter.sendFailure).toHaveBeenCalledWith(
      submission,
      expect.objectContaining({ shop: "Test Shop", reason: "Replacement delayed" }),
    );
  });

  it("still runs the mutation when the acknowledgement transport fails", async () => {
    const graphqlFetch = vi
      .fn()
      .mockResolvedValueOnce({
        csGetEscalationResult: {
          id: submission.escalationId,
          shopId: "shop-1",
          status: "PENDING",
          version: 1,
          result: null,
        },
      })
      .mockResolvedValueOnce({ csRespond: { ok: true, status: "PENDING", version: 2 } });
    const adapter = createAdapter({
      acknowledgeSubmission: vi.fn().mockRejectedValue(new Error("card patch rejected")),
    });
    const processor = new CsEscalationResponseProcessor({
      getAuth: () => ({ graphqlFetch }),
      adapter,
      history: createHistory() as any,
      resolveShopName: () => "Test Shop",
    });

    await processor.handle(submission);

    expect(graphqlFetch).toHaveBeenCalledTimes(2);
    expect(adapter.updateMessage).toHaveBeenCalledTimes(1);
    expect(adapter.sendFailure).not.toHaveBeenCalled();
    expect(adapter.sendUncertain).not.toHaveBeenCalled();
  });

  it("reports an unrecovered mutation timeout as uncertain, never as a failure", async () => {
    const graphqlFetch = vi
      .fn()
      .mockResolvedValueOnce({
        csGetEscalationResult: {
          id: submission.escalationId,
          shopId: "shop-1",
          status: "PENDING",
          version: 1,
          result: null,
        },
      })
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce({ csGetEscalationResult: null });
    const adapter = createAdapter();
    const processor = new CsEscalationResponseProcessor({
      getAuth: () => ({ graphqlFetch }),
      adapter,
      history: createHistory() as any,
      resolveShopName: () => "Test Shop",
      mutationTimeoutMs: 20,
    });

    await processor.handle(submission);

    expect(adapter.sendUncertain).toHaveBeenCalledWith(
      submission,
      expect.objectContaining({ escalationId: "M1DG8V", shop: "Test Shop" }),
    );
    expect(adapter.sendFailure).not.toHaveBeenCalled();
  });
});
