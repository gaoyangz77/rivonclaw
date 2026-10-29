import { applyPatch, types } from "mobx-state-tree";
import { describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { CustomerServiceWorkspaceModel } from "./CustomerServiceWorkspaceModel.js";
vi.mock("../../api/client.js", () => ({
  fetchJson: vi.fn(),
  fetchVoid: vi.fn().mockResolvedValue(undefined),
}));
function fixture(mutate: ReturnType<typeof vi.fn>) {
  const Root = types.model({
    currentUser: types.frozen<{ userId: string; accountId: string }>(),
    workspace: CustomerServiceWorkspaceModel,
  });
  const root = Root.create(
    {
      currentUser: { userId: "owner", accountId: "owner" },
      workspace: {
        conversationItems: [
          {
            shopId: "shop",
            conversationId: "chat",
            status: GQL.CustomerServiceConversationStatus.Pending,
            isOpen: true,
            aiEnabled: false,
            openEscalationCount: 0,
          },
        ],
      },
    },
    { apolloClient: { mutate } },
  );
  root.workspace.selectConversation("shop", "chat");
  root.workspace.setManualReplyDraft("你好");
  return root;
}
describe("explicit translated CS text", () => {
  it("does not replace the draft before acknowledgement and does not clear another actor's draft on late receipt", async () => {
    let finish!: (value: unknown) => void;
    const mutate = vi.fn(
      (_input: { variables: { message: string } }) =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const root = fixture(mutate);
    const pending = root.workspace.sendManualReply("zh", false, {
      message: "Hola",
      original: "你好",
    });
    expect(root.workspace.manualReplyDraft).toBe("你好");
    expect(mutate.mock.calls[0]![0].variables.message).toBe("Hola");
    applyPatch(root, {
      op: "replace",
      path: "/currentUser",
      value: { userId: "member", accountId: "owner" },
    });
    root.workspace.setManualReplyDraft("你好");
    finish({ data: { ecommerceSendCustomerServiceTextReply: { messageId: "sent" } } });
    expect(await pending).toBe(true);
    expect(root.workspace.manualReplyDraft).toBe("你好");
  });
  it("retains original for empty receipts and changed drafts", async () => {
    const mutate = vi.fn().mockResolvedValue({ data: {} });
    const root = fixture(mutate);
    expect(
      await root.workspace.sendManualReply("zh", false, { message: "Hola", original: "你好" }),
    ).toBe(false);
    expect(root.workspace.manualReplyDraft).toBe("你好");
    root.workspace.setManualReplyDraft("新草稿");
    await root.workspace.sendManualReply("zh", false, { message: "Hola", original: "你好" });
    expect(mutate).toHaveBeenCalledOnce();
    expect(root.workspace.manualReplyDraft).toBe("新草稿");
  });
});
