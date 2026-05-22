import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateConversationSummary } from "./cs-conversation-summary-service.js";

const summaryState = vi.hoisted(() => ({
  rpcRequest: vi.fn(),
  writeConversationSummary: vi.fn(),
}));

vi.mock("../openclaw/index.js", () => ({
  openClawConnector: {
    request: summaryState.rpcRequest,
  },
}));

vi.mock("./cs-session-cursor-store.js", () => ({
  readConversationSummary: vi.fn(),
  writeConversationSummary: (...args: unknown[]) => summaryState.writeConversationSummary(...args),
}));

describe("generateConversationSummary", () => {
  beforeEach(() => {
    summaryState.rpcRequest.mockReset();
    summaryState.writeConversationSummary.mockReset();
    summaryState.writeConversationSummary.mockImplementation(async (record: Record<string, unknown>) => ({
      ...record,
      updatedAt: "2026-05-21T00:00:00.000Z",
    }));
    summaryState.rpcRequest.mockImplementation(async (method: string) => {
      if (method === "agent") return { runId: "run-summary-1" };
      if (method === "agent.wait") return { status: "ok" };
      if (method === "chat.history") {
        return {
          messages: [
            { role: "user", content: "summarize" },
            { role: "assistant", content: "Buyer asked about delivery. Staff promised an update." },
          ],
        };
      }
      if (method === "sessions.delete") return {};
      throw new Error(`unexpected rpc method ${method}`);
    });
  });

  it("runs the summarizer as a raw model-only OpenClaw request", async () => {
    const authSession = {
      graphqlFetch: vi.fn().mockResolvedValue({
        ecommerceGetConversationMessages: {
          items: [
            {
              messageId: "m-1",
              index: "1",
              createTime: 100,
              type: "TEXT",
              text: "Where is my order?",
              sender: { role: "BUYER", nickname: "buyer" },
            },
            {
              messageId: "m-2",
              index: "2",
              createTime: 200,
              type: "TEXT",
              text: "I will check and update you.",
              sender: { role: "SELLER", nickname: "staff" },
            },
          ],
          nextPageToken: null,
        },
      }),
    };

    const summary = await generateConversationSummary({
      authSession: authSession as any,
      shopId: "shop-1",
      conversationId: "conv-1",
      locale: "en",
    });

    expect(summary.summary).toBe("Buyer asked about delivery. Staff promised an update.");
    expect(authSession.graphqlFetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      pageSize: 10,
      locale: "en",
    }));
    const agentCall = summaryState.rpcRequest.mock.calls.find((call) => call[0] === "agent");
    expect(agentCall).toBeDefined();
    const agentParams = agentCall?.[1] as Record<string, unknown>;
    expect(agentParams).toEqual(expect.objectContaining({
      modelRun: true,
      promptMode: "raw",
      deliver: false,
    }));
    expect(agentParams.message).toContain('current UI locale is "en"');
    expect(agentParams).not.toHaveProperty("runProfileId");
    expect(agentParams).not.toHaveProperty("tools");
  });
});
