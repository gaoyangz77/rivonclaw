import { types } from "mobx-state-tree";
import { describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import {
  CS_CONVERSATION_SUMMARY_QUERY,
  CS_GENERATE_CONVERSATION_SUMMARY_MUTATION,
} from "../../api/shops-queries.js";
import { CustomerServiceWorkspaceModel } from "./CustomerServiceWorkspaceModel.js";

vi.mock("../../api/client.js", () => ({ fetchJson: vi.fn(), fetchVoid: vi.fn() }));

const summary = {
  shopId: "shop",
  conversationId: "chat",
  summary: "Buyer asked about delivery.",
  messageCount: 12,
  messageId: "m12",
  messageIndex: "1012",
  createTime: 1767225600,
  updatedAt: "2026-03-01T08:00:00.000Z",
};

function fixture(env: { query?: ReturnType<typeof vi.fn>; mutate?: ReturnType<typeof vi.fn> }) {
  const Root = types.model({ workspace: CustomerServiceWorkspaceModel });
  const root = Root.create(
    {
      workspace: {
        conversationItems: [
          {
            shopId: "shop",
            conversationId: "chat",
            status: GQL.CustomerServiceConversationStatus.Pending,
            isOpen: true,
            aiEnabled: true,
            openEscalationCount: 0,
          },
        ],
      },
    },
    { apolloClient: { query: env.query ?? vi.fn(), mutate: env.mutate ?? vi.fn() } },
  );
  root.workspace.selectConversation("shop", "chat");
  return root.workspace;
}

describe("conversation summary (backend, ADR-123)", () => {
  it("reads the stored summary through GraphQL and shows it for the selected conversation", async () => {
    const query = vi.fn(async () => ({ data: { csConversationSummary: summary } }));
    const workspace = fixture({ query });
    expect(await workspace.fetchConversationSummary()).toEqual(summary);
    expect(query).toHaveBeenCalledWith({
      query: CS_CONVERSATION_SUMMARY_QUERY,
      variables: { shopId: "shop", conversationId: "chat" },
      fetchPolicy: "network-only",
    });
    expect(workspace.conversationSummary).toEqual(summary);
    expect(workspace.conversationSummaryErrorCode).toBeNull();
  });

  it("treats a conversation without a stored summary as having none", async () => {
    const workspace = fixture({ query: vi.fn(async () => ({ data: { csConversationSummary: null } })) });
    expect(await workspace.fetchConversationSummary()).toBeNull();
    expect(workspace.conversationSummary).toBeNull();
  });

  it("generates a summary with the UI locale and replaces the shown one", async () => {
    const mutate = vi.fn(async () => ({ data: { csGenerateConversationSummary: summary } }));
    const workspace = fixture({ mutate });
    await workspace.generateConversationSummary("zh");
    expect(mutate).toHaveBeenCalledWith({
      mutation: CS_GENERATE_CONVERSATION_SUMMARY_MUTATION,
      variables: { shopId: "shop", conversationId: "chat", locale: "zh" },
    });
    expect(workspace.conversationSummary).toEqual(summary);
    expect(workspace.conversationSummaryGenerating).toBe(false);
  });

  it("surfaces a generation failure and keeps the previous summary", async () => {
    const mutate = vi.fn(async () => {
      throw Object.assign(new Error("raw backend text"), {
        errors: [{ extensions: { code: "CS_ONE_SHOT_QUOTA_EXHAUSTED" } }],
      });
    });
    const workspace = fixture({ mutate });
    await expect(workspace.generateConversationSummary("en")).rejects.toThrow();
    expect(workspace.conversationSummaryErrorCode).toBe("CS_ONE_SHOT_QUOTA_EXHAUSTED");
    expect(workspace.conversationSummary).toBeNull();
    expect(workspace.conversationSummaryGenerating).toBe(false);
  });
});
