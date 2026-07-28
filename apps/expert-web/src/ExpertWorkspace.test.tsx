import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apolloClient } from "./api/client.js";
import { ExpertWorkspace } from "./ExpertWorkspace.js";
import { I18nProvider } from "./i18n.js";
import { ExpertStoreProvider } from "./store/context.js";
import { ExpertStore } from "./store/expert-store.js";

const conversation = {
  id: "conversation-1",
  title: "美国市场计划",
  lastMessageAt: "2026-07-28T00:00:00.000Z",
};

function renderWorkspace(store = ExpertStore.create()) {
  render(
    <I18nProvider>
      <ExpertStoreProvider store={store}>
        <ExpertWorkspace
          reloadBootstrap={vi.fn(async () => {})}
          logout={vi.fn(async () => {})}
          showOnboarding={false}
        />
      </ExpertStoreProvider>
    </I18nProvider>,
  );
  return store;
}

describe("ExpertWorkspace chat interactions", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.history.replaceState({}, "", "/?lang=zh");
    vi.restoreAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    vi.spyOn(apolloClient, "query").mockResolvedValue({
      data: {
        expertConversation: {
          messages: [],
        },
      },
    } as never);
  });

  it("keeps repeated new-conversation clicks local until the first question", async () => {
    const mutate = vi.spyOn(apolloClient, "mutate");
    const store = ExpertStore.create();
    store.applyBootstrap({ profile: {}, conversations: [conversation] });
    renderWorkspace(store);

    const newConversation = screen.getByRole("button", { name: "新对话" });
    fireEvent.click(newConversation);
    fireEvent.click(newConversation);

    expect(store.isNewConversationDraft).toBe(true);
    expect(store.selectedConversationId).toBeUndefined();
    expect(store.conversations).toHaveLength(1);
    expect(mutate).not.toHaveBeenCalled();
    expect((newConversation as HTMLButtonElement).disabled).toBe(true);
  });

  it("always presents an explicit waiting state before the first answer event", () => {
    const store = ExpertStore.create();
    store.startNewConversation();
    store.prepareRun("美国本土店适合我吗？");
    renderWorkspace(store);

    expect(screen.getByText("美国本土店适合我吗？")).not.toBeNull();
    expect(screen.getByText("正在开始对话…")).not.toBeNull();
    expect((screen.getByRole("button", { name: "发送中…" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("renders persisted answers as structured Markdown", () => {
    const store = ExpertStore.create();
    store.startNewConversation();
    store.replaceMessages([
      {
        id: "answer-1",
        role: "ASSISTANT",
        content:
          "## 我的判断\n\n**先验证美国市场。**\n\n- 检查主体资格\n- 核算履约成本\n\n| 项目 | 结论 |\n| --- | --- |\n| 市场 | 美国 |",
        createdAt: "2026-07-28T00:00:00.000Z",
      },
    ]);
    const { container } = render(
      <I18nProvider>
        <ExpertStoreProvider store={store}>
          <ExpertWorkspace
            reloadBootstrap={vi.fn(async () => {})}
            logout={vi.fn(async () => {})}
            showOnboarding={false}
          />
        </ExpertStoreProvider>
      </I18nProvider>,
    );

    expect(screen.getByRole("heading", { name: "我的判断" })).not.toBeNull();
    expect(container.querySelectorAll(".markdown li")).toHaveLength(2);
    expect(container.querySelector(".markdown strong")?.textContent).toBe("先验证美国市场。");
    expect(container.querySelector(".markdown table")).not.toBeNull();
    expect(screen.getByRole("button", { name: "提交" })).not.toBeNull();
  });

  it("renames a conversation through the sidebar action menu", async () => {
    const store = ExpertStore.create();
    store.applyBootstrap({ profile: {}, conversations: [conversation] });
    vi.spyOn(apolloClient, "mutate").mockResolvedValue({
      data: {
        renameExpertConversation: {
          id: conversation.id,
          title: "美国市场启动计划",
        },
      },
    } as never);
    renderWorkspace(store);

    fireEvent.click(
      screen.getByRole("button", {
        name: "“美国市场计划”的操作",
      }),
    );
    const menu = screen.getByRole("menu");
    expect(menu.parentElement).toBe(document.body);
    expect(document.querySelector(".conversation-sidebar nav")?.contains(menu)).toBe(false);
    fireEvent.click(screen.getByRole("menuitem", { name: "重命名" }));
    const input = screen.getByRole("textbox", { name: "重命名" });
    fireEvent.change(input, { target: { value: "美国市场启动计划" } });
    fireEvent.click(screen.getByRole("button", { name: "保存名称" }));

    await waitFor(() => {
      expect(store.selectedConversation?.title).toBe("美国市场启动计划");
    });
  });

  it("persists an edited assistant answer", async () => {
    const store = ExpertStore.create();
    store.startNewConversation();
    store.replaceMessages([
      {
        id: "answer-1",
        role: "ASSISTANT",
        content: "Original answer",
        createdAt: "2026-07-28T00:00:00.000Z",
      },
    ]);
    vi.spyOn(apolloClient, "mutate").mockResolvedValue({
      data: {
        updateExpertMessage: {
          id: "answer-1",
          content: "Updated expert answer",
          editedAt: "2026-07-28T01:00:00.000Z",
        },
      },
    } as never);
    renderWorkspace(store);

    fireEvent.click(screen.getByRole("button", { name: "修改消息" }));
    fireEvent.change(screen.getByRole("textbox", { name: "修改消息" }), {
      target: { value: "Updated expert answer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(store.messages[0]?.content).toBe("Updated expert answer");
      expect(screen.getByText("已修改")).not.toBeNull();
    });
  });

  it("only offers editing for a user question when it is the final message", () => {
    const store = ExpertStore.create();
    store.startNewConversation();
    store.replaceMessages([
      {
        id: "question-1",
        role: "USER",
        content: "Original question",
        createdAt: "2026-07-28T00:00:00.000Z",
      },
      {
        id: "answer-1",
        role: "ASSISTANT",
        content: "Answer",
        createdAt: "2026-07-28T00:01:00.000Z",
      },
    ]);
    renderWorkspace(store);

    expect(screen.getAllByRole("button", { name: "修改消息" })).toHaveLength(1);

    cleanup();
    const cancelledStore = ExpertStore.create();
    cancelledStore.startNewConversation();
    cancelledStore.replaceMessages([
      {
        id: "question-2",
        role: "USER",
        content: "Question after cancellation",
        createdAt: "2026-07-28T00:02:00.000Z",
      },
    ]);
    renderWorkspace(cancelledStore);
    expect(screen.getByRole("button", { name: "修改消息" })).not.toBeNull();
  });
});
