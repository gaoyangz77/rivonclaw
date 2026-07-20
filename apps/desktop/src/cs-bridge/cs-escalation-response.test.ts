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

describe("CsEscalationResponseProcessor", () => {
  it("keeps channel workflow in the adapter and supports a Telegram-shaped submission", async () => {
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
    const updateMessage = vi.fn().mockResolvedValue(undefined);
    const history = createHistory();
    const processor = new CsEscalationResponseProcessor({
      getAuth: () => ({
        graphqlFetch,
        getCachedUser: () => ({ userId: "owner-1" }),
      }),
      adapter: {
        telemetrySource: "telegram_controls",
        updateMessage,
        sendFailure: vi.fn(),
        sendSuccessFallback: vi.fn(),
      },
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
  });
});
