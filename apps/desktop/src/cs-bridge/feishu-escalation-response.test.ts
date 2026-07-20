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

function createHarness(graphqlFetch = vi.fn(), history = createHistory()) {
  const gatewayRequest = vi.fn().mockResolvedValue({ ok: true });
  const auth = { graphqlFetch } as any;
  const processor = new FeishuEscalationResponseProcessor({
    locale: () => "en",
    getAuth: () => auth,
    gatewayRequest: gatewayRequest as any,
    history: history as any,
    resolveShopName: () => "Test Shop",
    mutationTimeoutMs: 20,
  });
  return { processor, graphqlFetch, gatewayRequest, auth, history };
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
    const { processor, gatewayRequest } = createHarness(graphqlFetch);

    await processor.handle(payload);

    expect(graphqlFetch).toHaveBeenNthCalledWith(2, expect.stringContaining("mutation CsRespond"), {
      escalationId: "M1DG8V",
      decision: "Approve the full refund",
      instructions: "",
      resolved: true,
    });
    expect(gatewayRequest).toHaveBeenCalledWith(
      "message.action",
      expect.objectContaining({
        action: "edit",
        idempotencyKey: "feishu-cs-result:callback-1",
        params: expect.objectContaining({ messageId: "om_card" }),
      }),
    );
    const editedCard = gatewayRequest.mock.calls[0][1].params.card;
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
    expect(gatewayRequest.mock.calls.some((call) => call[0] === "agent")).toBe(false);
  });

  it("keeps unresolved feedback orange and actionable", async () => {
    const graphqlFetch = vi
      .fn()
      .mockResolvedValueOnce(pendingEscalation())
      .mockResolvedValueOnce({ csRespond: { ok: true, status: "PENDING", version: 2 } });
    const { processor, gatewayRequest, history } = createHarness(graphqlFetch);

    await processor.handle({ ...payload, resolved: false });

    expect(graphqlFetch.mock.calls[1][1]).toEqual(expect.objectContaining({ resolved: false }));
    expect(history.entries).toEqual([
      expect.objectContaining({ decision: payload.decision, resolved: false, channelId: "feishu" }),
    ]);
    const card = gatewayRequest.mock.calls[0][1].params.card;
    const serialized = JSON.stringify(card);
    expect(card.header.template).toBe("orange");
    expect(serialized).toContain("Feedback history");
    expect(serialized).toContain('"tag":"form"');
    expect(serialized).toContain('"tag":"button"');
  });

  it("skips mutation and renders already processed when the escalation is resolved", async () => {
    const graphqlFetch = vi.fn().mockResolvedValueOnce(processedEscalation());
    const { processor, gatewayRequest } = createHarness(graphqlFetch);

    await processor.handle({
      ...payload,
      decision: "A stale second-click decision",
      resolved: false,
    });

    expect(graphqlFetch).toHaveBeenCalledTimes(1);
    expect(gatewayRequest).toHaveBeenCalledWith(
      "message.action",
      expect.objectContaining({
        action: "edit",
        params: expect.objectContaining({ card: expect.any(Object) }),
      }),
    );
    const card = gatewayRequest.mock.calls[0][1].params.card;
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
    const { processor, gatewayRequest } = createHarness(graphqlFetch, history);

    await processor.handle({
      ...payload,
      callbackId: "callback-final",
      decision: "Warehouse confirmed the replacement; close the case",
      resolved: true,
    });

    expect(graphqlFetch).toHaveBeenCalledTimes(2);
    const card = gatewayRequest.mock.calls[0][1].params.card;
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
    const { processor, gatewayRequest } = createHarness(duplicateFetch, history);

    await processor.handle({ ...payload, resolved: false });

    expect(duplicateFetch).toHaveBeenCalledTimes(1);
    expect(gatewayRequest.mock.calls[0][1].params.card.header.template).toBe("orange");
    expect(JSON.stringify(gatewayRequest.mock.calls[0][1].params.card)).toContain('"tag":"form"');
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
      "mutation ok=false",
      () =>
        vi
          .fn()
          .mockResolvedValueOnce(pendingEscalation())
          .mockResolvedValueOnce({ csRespond: { ok: false, error: "rejected" } }),
    ],
  ])("keeps the form unchanged on %s and sends a failure reply", async (_name, makeFetch) => {
    const { processor, gatewayRequest } = createHarness(makeFetch());

    await processor.handle(payload);

    expect(gatewayRequest).not.toHaveBeenCalledWith(
      "message.action",
      expect.objectContaining({ action: "edit" }),
    );
    expect(gatewayRequest).toHaveBeenCalledWith(
      "message.action",
      expect.objectContaining({ action: "send" }),
    );
  });

  it("fails closed when Desktop authentication is missing", async () => {
    const gatewayRequest = vi.fn().mockResolvedValue({ ok: true });
    const processor = new FeishuEscalationResponseProcessor({
      locale: () => "en",
      getAuth: () => null,
      gatewayRequest: gatewayRequest as any,
      history: createHistory() as any,
      resolveShopName: () => undefined,
    });

    await processor.handle(payload);

    expect(gatewayRequest).toHaveBeenCalledWith(
      "message.action",
      expect.objectContaining({ action: "send" }),
    );
    expect(gatewayRequest).not.toHaveBeenCalledWith(
      "message.action",
      expect.objectContaining({ action: "edit" }),
    );
  });

  it("rechecks an uncertain mutation before showing success", async () => {
    const graphqlFetch = vi
      .fn()
      .mockResolvedValueOnce(pendingEscalation())
      .mockRejectedValueOnce(new Error("network disconnected after send"))
      .mockResolvedValueOnce(processedEscalation());
    const { processor, gatewayRequest } = createHarness(graphqlFetch);

    await processor.handle(payload);

    expect(graphqlFetch).toHaveBeenCalledTimes(3);
    expect(gatewayRequest).toHaveBeenCalledWith(
      "message.action",
      expect.objectContaining({ action: "edit" }),
    );
  });

  it("does not mistake an unchanged unresolved result for a successful timed-out update", async () => {
    const graphqlFetch = vi
      .fn()
      .mockResolvedValueOnce(unresolvedEscalation())
      .mockRejectedValueOnce(new Error("network disconnected after send"))
      .mockResolvedValueOnce(unresolvedEscalation());
    const { processor, gatewayRequest } = createHarness(graphqlFetch);

    await processor.handle({
      ...payload,
      callbackId: "callback-new-update",
      decision: "A newer instruction that may not have reached the backend",
      resolved: false,
    });

    expect(gatewayRequest).not.toHaveBeenCalledWith(
      "message.action",
      expect.objectContaining({ action: "edit" }),
    );
    expect(gatewayRequest).toHaveBeenCalledWith(
      "message.action",
      expect.objectContaining({ action: "send" }),
    );
  });

  it("uses a success reply when mutation succeeded but the card edit fails", async () => {
    const graphqlFetch = vi
      .fn()
      .mockResolvedValueOnce(pendingEscalation())
      .mockResolvedValueOnce({ csRespond: { ok: true, status: "RESOLVED", version: 2 } });
    const { processor, gatewayRequest } = createHarness(graphqlFetch);
    gatewayRequest
      .mockRejectedValueOnce(new Error("edit rejected"))
      .mockResolvedValueOnce({ ok: true });

    await processor.handle(payload);

    expect(gatewayRequest).toHaveBeenNthCalledWith(
      2,
      "message.action",
      expect.objectContaining({
        action: "send",
        idempotencyKey: "feishu-cs-fallback:callback-1",
        params: expect.objectContaining({ text: "Response submitted successfully." }),
      }),
    );
  });
});
