import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apolloClient } from "./api/client.js";
import * as imageUpload from "./api/image-upload.js";
import { ExpertWorkspace } from "./ExpertWorkspace.js";
import { I18nProvider } from "./i18n.js";
import { ExpertStoreProvider } from "./store/context.js";
import { ExpertStore } from "./store/expert-store.js";

const conversation = {
  id: "conversation-1",
  title: "美国市场计划",
  lastMessageAt: "2026-07-28T00:00:00.000Z",
};
const secondConversation = {
  id: "conversation-2",
  title: "东南亚市场计划",
  lastMessageAt: "2026-07-27T00:00:00.000Z",
};

function renderWorkspace(store = ExpertStore.create()) {
  return render(
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
}

describe("ExpertWorkspace chat interactions", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    window.history.replaceState({}, "", "/?lang=zh");
    window.localStorage.removeItem("tkcopilot-expert-theme");
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

  it("supports system, light, and dark themes and persists explicit choices", () => {
    let systemThemeListener: ((event: { matches: boolean }) => void) | undefined;
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        media: "(prefers-color-scheme: dark)",
        addEventListener: (event: string, listener: (event: { matches: boolean }) => void) => {
          if (event === "change") systemThemeListener = listener;
        },
        removeEventListener: vi.fn(),
      })),
    );

    const store = ExpertStore.create();
    store.startNewConversation();
    const { container, unmount } = renderWorkspace(store);
    const workspace = container.querySelector(".workspace");
    const systemButton = screen.getByRole("button", { name: "跟随系统" });
    const lightButton = screen.getByRole("button", { name: "浅色模式" });
    const darkButton = screen.getByRole("button", { name: "深色模式" });

    expect(workspace?.getAttribute("data-theme")).toBe("dark");
    expect(systemButton.getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.dataset.expertTheme).toBe("dark");

    fireEvent.click(lightButton);
    expect(workspace?.getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem("tkcopilot-expert-theme")).toBe("light");

    fireEvent.click(darkButton);
    expect(workspace?.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem("tkcopilot-expert-theme")).toBe("dark");

    fireEvent.click(systemButton);
    act(() => systemThemeListener?.({ matches: false }));
    expect(workspace?.getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem("tkcopilot-expert-theme")).toBeNull();

    unmount();
    expect(document.documentElement.dataset.expertTheme).toBeUndefined();
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

  it("uploads pasted images without intercepting ordinary text paste", async () => {
    const upload = vi.spyOn(imageUpload, "uploadExpertImage").mockResolvedValue({
      assetId: "asset-pasted",
      publicUrl: "data:image/webp;base64,cGFzdGVk",
      mimeType: "image/webp",
      sizeBytes: 128,
      width: 640,
      height: 480,
    });
    renderWorkspace();
    const composer = screen.getByPlaceholderText(/描述你的决策/);
    const textPaste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(textPaste, "clipboardData", {
      value: { files: [] },
    });
    fireEvent(composer, textPaste);
    expect(textPaste.defaultPrevented).toBe(false);

    const screenshot = new File(["screenshot"], "screenshot.png", { type: "image/png" });
    const imagePaste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(imagePaste, "clipboardData", {
      value: { files: [screenshot] },
    });
    fireEvent(composer, imagePaste);

    expect(imagePaste.defaultPrevented).toBe(true);
    await screen.findByRole("button", { name: "移除图片" });
    expect(upload).toHaveBeenCalledWith(screenshot);
  });

  it("loads persisted history with nullable edit timestamps after refresh", async () => {
    const store = ExpertStore.create();
    store.applyBootstrap({ profile: {}, conversations: [conversation] });
    vi.mocked(apolloClient.query).mockResolvedValueOnce({
      data: {
        expertConversation: {
          messages: [
            {
              id: "question-1",
              role: "USER",
              content: "刷新后仍应显示的问题",
              suggestedQuestions: [],
              editedAt: null,
              createdAt: "2026-07-28T00:00:00.000Z",
            },
            {
              id: "answer-1",
              role: "ASSISTANT",
              content: "刷新后仍应显示的回答",
              suggestedQuestions: [],
              editedAt: null,
              createdAt: "2026-07-28T00:01:00.000Z",
            },
          ],
        },
      },
    } as never);

    renderWorkspace(store);

    expect(screen.getByText("正在加载对话…")).not.toBeNull();
    await waitFor(() => {
      expect(screen.getByText("刷新后仍应显示的问题")).not.toBeNull();
      expect(screen.getByText("刷新后仍应显示的回答")).not.toBeNull();
    });
    expect(store.messages[0]?.editedAt).toBeUndefined();
  });

  it("reloads the currently selected conversation when it is clicked again", async () => {
    const store = ExpertStore.create();
    store.applyBootstrap({ profile: {}, conversations: [conversation] });
    vi.mocked(apolloClient.query)
      .mockResolvedValueOnce({
        data: {
          expertConversation: {
            messages: [
              {
                id: "answer-1",
                role: "ASSISTANT",
                content: "第一次加载",
                suggestedQuestions: [],
                editedAt: null,
                createdAt: "2026-07-28T00:01:00.000Z",
              },
            ],
          },
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          expertConversation: {
            messages: [
              {
                id: "answer-1",
                role: "ASSISTANT",
                content: "重新加载后的内容",
                suggestedQuestions: [],
                editedAt: null,
                createdAt: "2026-07-28T00:01:00.000Z",
              },
            ],
          },
        },
      } as never);

    renderWorkspace(store);
    await screen.findByText("第一次加载");
    fireEvent.click(screen.getByRole("button", { name: conversation.title }));

    await waitFor(() => {
      expect(screen.getByText("重新加载后的内容")).not.toBeNull();
    });
    expect(apolloClient.query).toHaveBeenCalledTimes(2);
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

  it("starts renaming on double click and uses a styled delete confirmation", () => {
    const store = ExpertStore.create();
    store.applyBootstrap({ profile: {}, conversations: [conversation] });
    const confirm = vi.spyOn(window, "confirm");
    renderWorkspace(store);

    fireEvent.doubleClick(screen.getByRole("button", { name: conversation.title }));
    const renameInput = screen.getByRole("textbox", { name: "重命名" });
    expect(renameInput).not.toBeNull();
    fireEvent.keyDown(renameInput, { key: "Escape" });

    fireEvent.click(
      screen.getByRole("button", {
        name: "“美国市场计划”的操作",
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "删除" }));
    const dialog = screen.getByRole("alertdialog", {
      name: "删除这个对话？",
    });
    expect(dialog.closest(".conversation-delete-backdrop")?.parentElement).toBe(document.body);
    expect(within(dialog).getByText(/美国市场计划/)).not.toBeNull();
    expect(within(dialog).getByRole("button", { name: "保留对话" })).not.toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("decrements free quota before dispatch resolves and reconciles the response", async () => {
    const store = ExpertStore.create();
    store.startNewConversation();
    store.applyBootstrap({
      profile: {},
      conversations: [],
      usage: {
        mode: "FREE_DAILY",
        freeRemaining: 5,
        freeLimit: 5,
        resetsAt: "2026-07-29T00:00:00.000Z",
      },
    });
    let resolveMutation:
      | ((value: {
          data: {
            createExpertConversation: {
              id: string;
              title: string;
              lastMessageAt: string;
            };
          };
        }) => void)
      | undefined;
    vi.spyOn(apolloClient, "mutate")
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveMutation = resolve as typeof resolveMutation;
          }) as never,
      )
      .mockResolvedValueOnce({
        data: {
          dispatchExpertMessage: {
            run: { id: "run-1" },
            usage: {
              mode: "FREE_DAILY",
              freeRemaining: 3,
              freeLimit: 5,
              resetsAt: "2026-07-29T00:00:00.000Z",
            },
          },
        },
      } as never);
    vi.spyOn(apolloClient, "subscribe").mockReturnValue({
      subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
    } as never);
    renderWorkspace(store);

    fireEvent.change(screen.getByPlaceholderText(/描述你的决策/), {
      target: { value: "我应该先做哪个市场？" },
    });
    fireEvent.click(screen.getByRole("button", { name: "提交" }));
    expect(screen.getByText("今天还可提问 4/5 次")).not.toBeNull();

    resolveMutation?.({
      data: {
        createExpertConversation: {
          id: "conversation-new",
          title: "New conversation",
          lastMessageAt: "2026-07-28T00:00:00.000Z",
        },
      },
    });
    await waitFor(() => {
      expect(screen.getByText("今天还可提问 3/5 次")).not.toBeNull();
    });
  });

  it("keeps the active session subscribed while browsing and editing the sidebar", async () => {
    const store = ExpertStore.create();
    store.applyBootstrap({
      profile: {},
      conversations: [conversation, secondConversation],
      usage: {
        mode: "FREE_DAILY",
        freeRemaining: 5,
        freeLimit: 5,
        resetsAt: "2026-07-29T00:00:00.000Z",
      },
    });
    vi.spyOn(apolloClient, "mutate").mockResolvedValue({
      data: {
        dispatchExpertMessage: {
          run: { id: "run-background" },
          usage: {
            mode: "FREE_DAILY",
            freeRemaining: 4,
            freeLimit: 5,
            resetsAt: "2026-07-29T00:00:00.000Z",
          },
        },
      },
    } as never);
    const unsubscribe = vi.fn();
    let subscriptionObserver:
      | {
          next(value: {
            data: {
              expertRunEvents: {
                sequence: number;
                type: string;
                text?: string;
              };
            };
          }): void;
        }
      | undefined;
    vi.spyOn(apolloClient, "subscribe").mockReturnValue({
      subscribe: vi.fn((observer) => {
        subscriptionObserver = observer as typeof subscriptionObserver;
        return { unsubscribe };
      }),
    } as never);
    renderWorkspace(store);

    fireEvent.change(screen.getByPlaceholderText(/描述你的决策/), {
      target: { value: "请分析美国市场" },
    });
    fireEvent.click(screen.getByRole("button", { name: "提交" }));
    await waitFor(() => expect(store.runPhase).toBe("WAITING"));
    expect(screen.getByRole("status", { name: "“美国市场计划”正在回答" })).not.toBeNull();

    const newConversationButton = screen.getByRole("button", { name: "新对话" });
    expect((newConversationButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(newConversationButton);
    expect(store.isNewConversationDraft).toBe(true);
    expect(unsubscribe).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: secondConversation.title }));
    await waitFor(() => expect(store.selectedConversationId).toBe(secondConversation.id));
    const actions = screen.getByRole("button", {
      name: "“东南亚市场计划”的操作",
    });
    expect((actions as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(actions);
    expect((screen.getByRole("menuitem", { name: "删除" }) as HTMLButtonElement).disabled).toBe(
      false,
    );

    act(() => {
      subscriptionObserver?.next({
        data: {
          expertRunEvents: {
            sequence: 1,
            type: "ANSWER_DELTA",
            text: "后台仍在流式回答",
          },
        },
      });
    });
    expect(store.streamingAnswer).toBe("后台仍在流式回答");
    expect(screen.queryByText("后台仍在流式回答")).toBeNull();
    expect(unsubscribe).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("menuitem", { name: "重命名" }));
    expect(screen.getByRole("textbox", { name: "重命名" })).not.toBeNull();

    fireEvent.keyDown(screen.getByRole("textbox", { name: "重命名" }), {
      key: "Escape",
    });
    fireEvent.click(screen.getByRole("button", { name: conversation.title }));
    expect(await screen.findByText("后台仍在流式回答")).not.toBeNull();
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it("stops auto-follow when the user scrolls upward and resumes at the bottom", async () => {
    const store = ExpertStore.create();
    store.applyBootstrap({ profile: {}, conversations: [conversation] });
    store.prepareRun("Question");
    store.bindRunConversation(conversation.id);
    store.beginRun("run-scroll", conversation.id);
    store.appendDelta("Initial answer");
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
    const scrollArea = container.querySelector(".message-scroll") as HTMLDivElement;
    let scrollHeight = 1_000;
    Object.defineProperty(scrollArea, "scrollHeight", {
      configurable: true,
      get: () => scrollHeight,
    });
    Object.defineProperty(scrollArea, "clientHeight", {
      configurable: true,
      value: 400,
    });
    await new Promise((resolve) => window.setTimeout(resolve, 20));

    scrollArea.scrollTop = 600;
    fireEvent.scroll(scrollArea);
    fireEvent.wheel(scrollArea, { deltaY: -120 });
    scrollArea.scrollTop = 300;
    fireEvent.scroll(scrollArea);
    act(() => store.appendDelta(" while reading above"));
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    expect(scrollArea.scrollTop).toBe(300);

    scrollArea.scrollTop = 600;
    fireEvent.scroll(scrollArea);
    scrollHeight = 1_100;
    act(() => store.appendDelta(" at the bottom"));
    await waitFor(() => expect(scrollArea.scrollTop).toBe(700));
  });

  it("resubmits an edited latest user question as a new Agent run", async () => {
    const store = ExpertStore.create();
    store.applyBootstrap({ profile: {}, conversations: [conversation] });
    const existingMessages = [
      {
        id: "question-1",
        role: "USER" as const,
        content: "Original question",
        suggestedQuestions: [],
        editedAt: null,
        createdAt: "2026-07-28T00:00:00.000Z",
      },
      {
        id: "answer-1",
        role: "ASSISTANT" as const,
        content: "Original answer",
        suggestedQuestions: [],
        editedAt: null,
        createdAt: "2026-07-28T00:01:00.000Z",
      },
    ];
    store.replaceMessages(existingMessages);
    vi.mocked(apolloClient.query).mockResolvedValueOnce({
      data: {
        expertConversation: {
          messages: existingMessages,
        },
      },
    } as never);
    vi.spyOn(apolloClient, "mutate").mockResolvedValue({
      data: {
        dispatchExpertMessage: {
          run: {
            id: "rerun-1",
          },
          usage: {
            mode: "FREE_DAILY",
            freeRemaining: 4,
            freeLimit: 5,
            resetsAt: "2026-07-29T00:00:00.000Z",
          },
        },
      },
    } as never);
    vi.spyOn(apolloClient, "subscribe").mockReturnValue({
      subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
    } as never);
    renderWorkspace(store);
    await screen.findByText("Original answer");

    fireEvent.click(screen.getByRole("button", { name: "修改消息" }));
    fireEvent.change(screen.getByRole("textbox", { name: "修改消息" }), {
      target: { value: "Updated question" },
    });
    fireEvent.click(screen.getByRole("button", { name: "重新提交" }));

    await waitFor(() => {
      expect(store.runPhase).toBe("WAITING");
      expect(store.messages).toHaveLength(1);
      expect(store.messages[0]?.content).toBe("Updated question");
    });
    expect(apolloClient.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          replaceMessageId: "question-1",
          text: "Updated question",
        }),
      }),
    );
    expect(screen.queryByText("Original answer")).toBeNull();
  });

  it("only offers editing on the latest user-authored message", () => {
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

    const userMessage = screen.getByRole("article", { name: "你" });
    const assistantMessage = screen.getByRole("article", { name: "专家" });
    const userCopyButton = within(userMessage).getByRole("button", { name: "复制消息" });
    expect(userMessage.querySelector(".user-message-bubble")?.contains(userCopyButton)).toBe(false);
    expect(within(userMessage).getByRole("button", { name: "修改消息" })).not.toBeNull();
    expect(within(assistantMessage).queryByRole("button", { name: "修改消息" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "修改消息" })).toHaveLength(1);

    cleanup();
    const multipleQuestionsStore = ExpertStore.create();
    multipleQuestionsStore.startNewConversation();
    multipleQuestionsStore.replaceMessages([
      {
        id: "question-2",
        role: "USER",
        content: "Earlier question",
        createdAt: "2026-07-28T00:02:00.000Z",
      },
      {
        id: "answer-2",
        role: "ASSISTANT",
        content: "Earlier answer",
        createdAt: "2026-07-28T00:03:00.000Z",
      },
      {
        id: "question-3",
        role: "USER",
        content: "Latest question",
        createdAt: "2026-07-28T00:04:00.000Z",
      },
    ]);
    renderWorkspace(multipleQuestionsStore);
    const userMessages = screen.getAllByRole("article", { name: "你" });
    expect(within(userMessages[0]!).queryByRole("button", { name: "修改消息" })).toBeNull();
    expect(within(userMessages[1]!).getByRole("button", { name: "修改消息" })).not.toBeNull();
  });
});
