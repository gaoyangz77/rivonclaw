import { types } from "mobx-state-tree";
import { describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { CustomerServiceWorkspaceModel } from "./CustomerServiceWorkspaceModel.js";

vi.mock("../../api/client.js", () => ({ fetchJson: vi.fn(), fetchVoid: vi.fn() }));

function message(n: number) {
  return {
    messageId: `m${n}`,
    index: String(n),
    type: "TEXT",
    text: `text ${n}`,
    createTime: String(1000 + n),
    sender: { role: n % 2 ? "BUYER" : "CUSTOMER_SERVICE", nickname: "x" },
  };
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => message(from + i));

function changed(shopId: string, conversationId: string) {
  return { conversation: { shopId, conversationId } };
}

/** Pages keyed by page token; `undefined` is the newest page. */
async function fixture() {
  const pages = new Map<string | undefined, { items: unknown[]; nextPageToken: string | null }>([
    [undefined, { items: range(21, 30), nextPageToken: "older-1" }],
    ["older-1", { items: range(11, 20), nextPageToken: "older-2" }],
  ]);
  const query = vi.fn(async ({ variables }: { variables: { pageToken?: string } }) => ({
    data: { ecommerceGetConversationMessages: pages.get(variables.pageToken) },
  }));
  const inboxItem = (conversationId: string) => ({
    shopId: "shop",
    conversationId,
    status: GQL.CustomerServiceConversationStatus.Pending,
    isOpen: true,
    aiEnabled: true,
    openEscalationCount: 0,
  });
  const Root = types.model({
    shops: types.frozen<unknown[]>([]),
    workspace: CustomerServiceWorkspaceModel,
  });
  const root = Root.create(
    { shops: [], workspace: { conversationItems: [inboxItem("chat"), inboxItem("other")] } },
    { apolloClient: { query, mutate: vi.fn() } },
  );
  const workspace = root.workspace;
  workspace.selectConversation("shop", "chat");
  await workspace.fetchConversationMessages("en");
  await workspace.fetchOlderConversationMessages("en");
  query.mockClear();
  const loadedIds = () =>
    (workspace.conversationMessages as unknown as Array<{ messageId: string }>).map(
      (m) => m.messageId,
    );
  return { workspace, query, pages, loadedIds };
}

describe("refreshMessagesAfterConversationChanged", () => {
  it("ignores changes to other conversations", async () => {
    const { workspace, query, loadedIds } = await fixture();
    await workspace.refreshMessagesAfterConversationChanged(changed("shop", "other"), "en");
    await workspace.refreshMessagesAfterConversationChanged(changed("other-shop", "chat"), "en");
    expect(query).not.toHaveBeenCalled();
    expect(loadedIds()).toHaveLength(20);
  });

  it("merges the newest page and keeps older pages and the older-page cursor", async () => {
    const { workspace, query, pages, loadedIds } = await fixture();
    pages.set(undefined, { items: range(23, 32), nextPageToken: "older-1-shifted" });

    await workspace.refreshMessagesAfterConversationChanged(changed("shop", "chat"), "en");

    expect(query).toHaveBeenCalledTimes(1);
    expect(loadedIds()).toEqual(range(11, 32).map((m) => m.messageId));
    expect(workspace.conversationMessagesNextPageToken).toBe("older-2");
    expect(workspace.conversationMessagesLoading).toBe(false);
  });

  it("drops the result when the operator switched conversations meanwhile", async () => {
    const { workspace, query, loadedIds } = await fixture();
    let release: (value: any) => void = () => {};
    query.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const refresh = workspace.refreshMessagesAfterConversationChanged(
      changed("shop", "chat"),
      "en",
    );
    workspace.selectConversation("shop", "other");
    release({ data: { ecommerceGetConversationMessages: { items: range(40, 41), nextPageToken: null } } });
    await refresh;
    expect(loadedIds()).not.toContain("m40");
  });

  it("leaves a running initial load alone", async () => {
    const { workspace, query } = await fixture();
    let release: (value: any) => void = () => {};
    query.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const initial = workspace.fetchConversationMessages("en");
    await workspace.refreshMessagesAfterConversationChanged(changed("shop", "chat"), "en");
    expect(query).toHaveBeenCalledTimes(1);
    release({ data: { ecommerceGetConversationMessages: { items: range(21, 30), nextPageToken: "older-1" } } });
    await initial;
  });
});
