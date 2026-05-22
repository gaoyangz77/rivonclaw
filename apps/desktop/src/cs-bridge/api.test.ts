import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiContext } from "../app/api-context.js";
import { RouteRegistry } from "../infra/api/route-registry.js";
import { registerCsBridgeHandlers } from "./api.js";

const bridgeState = vi.hoisted(() => ({
  bridge: {
    getOrCreateSession: vi.fn(),
    dispatchCatchUp: vi.fn(),
  },
  summary: {
    getLocalConversationSummary: vi.fn(),
    generateConversationSummary: vi.fn(),
  },
}));

vi.mock("../gateway/connection.js", () => ({
  getCsBridge: () => bridgeState.bridge,
}));

vi.mock("./cs-conversation-summary-service.js", () => ({
  getLocalConversationSummary: (...args: unknown[]) => bridgeState.summary.getLocalConversationSummary(...args),
  generateConversationSummary: (...args: unknown[]) => bridgeState.summary.generateConversationSummary(...args),
}));

let registry: RouteRegistry;

beforeEach(() => {
  registry = new RouteRegistry();
  registerCsBridgeHandlers(registry);
  bridgeState.bridge.getOrCreateSession.mockReset();
  bridgeState.bridge.dispatchCatchUp.mockReset();
  bridgeState.summary.getLocalConversationSummary.mockReset();
  bridgeState.summary.generateConversationSummary.mockReset();
});

async function dispatch(method: string, path: string, body?: unknown, ctx: Partial<ApiContext> = {}) {
  const req = makeReq(method, body);
  const res = makeRes();
  const url = new URL(`http://localhost${path}`);
  const handled = await registry.dispatch(req, res, url, url.pathname, ctx as ApiContext);
  return { handled, res };
}

function makeReq(method: string, body?: unknown): IncomingMessage {
  const readable = new Readable({ read() {} });
  if (body !== undefined) readable.push(JSON.stringify(body));
  readable.push(null);
  (readable as any).method = method;
  (readable as any).headers = {};
  return readable as unknown as IncomingMessage;
}

function makeRes(): ServerResponse & { _status: number; _body: unknown } {
  const res = {
    _status: 0,
    _body: null as unknown,
    writeHead(status: number) {
      res._status = status;
      return res;
    },
    end(data?: string) {
      if (data) res._body = JSON.parse(data);
    },
  } as unknown as ServerResponse & { _status: number; _body: unknown };
  return res;
}

describe("POST /api/cs-bridge/start-conversation", () => {
  it("starts a session without requiring buyerUserId", async () => {
    bridgeState.bridge.dispatchCatchUp.mockResolvedValue({ ok: true });

    const { handled, res } = await dispatch("POST", "/api/cs-bridge/start-conversation", {
      shopId: "shop-1",
      conversationId: "conv-1",
      orderId: "order-1",
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(bridgeState.bridge.dispatchCatchUp).toHaveBeenCalledWith({
      shopObjectId: "shop-1",
      conversationId: "conv-1",
      buyerUserId: undefined,
      orderId: "order-1",
      operatorInstruction: undefined,
    });
  });

  it("still accepts buyerUserId when it is provided", async () => {
    bridgeState.bridge.dispatchCatchUp.mockResolvedValue({ ok: true });

    const { handled, res } = await dispatch("POST", "/api/cs-bridge/start-conversation", {
      shopId: "shop-1",
      conversationId: "conv-1",
      buyerUserId: "buyer-1",
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(bridgeState.bridge.dispatchCatchUp).toHaveBeenCalledWith({
      shopObjectId: "shop-1",
      conversationId: "conv-1",
      buyerUserId: "buyer-1",
      orderId: undefined,
      operatorInstruction: undefined,
    });
  });

  it("passes operatorInstruction through to catch-up dispatch", async () => {
    bridgeState.bridge.dispatchCatchUp.mockResolvedValue({ ok: true });

    const { handled, res } = await dispatch("POST", "/api/cs-bridge/start-conversation", {
      shopId: "shop-1",
      conversationId: "conv-1",
      operatorInstruction: "This refund request looks suspicious. Review carefully before offering any compensation.",
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(bridgeState.bridge.dispatchCatchUp).toHaveBeenCalledWith({
      shopObjectId: "shop-1",
      conversationId: "conv-1",
      buyerUserId: undefined,
      orderId: undefined,
      operatorInstruction: "This refund request looks suspicious. Review carefully before offering any compensation.",
    });
  });
});

describe("/api/cs-bridge/conversation-summary", () => {
  it("reads a local summary by shop and conversation", async () => {
    bridgeState.summary.getLocalConversationSummary.mockResolvedValue({
      summary: "Buyer asked about delivery.",
      messageId: "m-1",
      updatedAt: "2026-05-21T00:00:00.000Z",
      messageCount: 4,
    });

    const { handled, res } = await dispatch(
      "GET",
      "/api/cs-bridge/conversation-summary?shopId=shop-1&conversationId=conv-1",
    );

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({
      summary: expect.objectContaining({ summary: "Buyer asked about delivery." }),
    });
    expect(bridgeState.summary.getLocalConversationSummary).toHaveBeenCalledWith({
      shopId: "shop-1",
      conversationId: "conv-1",
    });
  });

  it("generates a summary through the authenticated desktop context", async () => {
    const authSession = { graphqlFetch: vi.fn() };
    bridgeState.summary.generateConversationSummary.mockResolvedValue({
      summary: "Customer wants a replacement.",
      messageId: "m-2",
      updatedAt: "2026-05-21T00:00:00.000Z",
      messageCount: 7,
    });

    const { handled, res } = await dispatch(
      "POST",
      "/api/cs-bridge/conversation-summary",
      { shopId: "shop-1", conversationId: "conv-1", locale: "en" },
      { authSession } as unknown as Partial<ApiContext>,
    );

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(bridgeState.summary.generateConversationSummary).toHaveBeenCalledWith({
      authSession,
      shopId: "shop-1",
      conversationId: "conv-1",
      locale: "en",
    });
    expect(res._body).toEqual({
      summary: expect.objectContaining({ summary: "Customer wants a replacement." }),
    });
  });
});
