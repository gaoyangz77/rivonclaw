import { MessageTranslationModel } from "../../../store/models/MessageTranslationModel.js";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { CS_CONVERSATION_INBOX_QUERY } from "../../../api/shops-queries.js";
import i18n from "../../../i18n/index.js";
import { ToastProvider } from "../../../components/Toast.js";
import { CustomerServiceWorkspaceModel } from "../../../store/models/CustomerServiceWorkspaceModel.js";
import { mockObjectUrls } from "../../../../test/mock-object-urls.js";
import { CustomerServiceReplyComposer } from "./CustomerServiceReplyComposer.js";

const state = vi.hoisted(() => ({
  workspace: null as unknown as ReturnType<typeof CustomerServiceWorkspaceModel.create>,
  sendImage: vi.fn(),
  translate: vi.fn(),
  translation: null as unknown as ReturnType<typeof MessageTranslationModel.create>,
  mutate: vi.fn(),
  query: vi.fn(),
}));
vi.mock("../../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => ({
    customerServiceWorkspace: state.workspace,
    messageTranslation: state.translation,
    currentUser: { userId: "owner", accountId: "owner" },
    shops: [{ id: "shop-1", region: "MX" }],
  }),
}));
vi.mock("../../../api/client.js", () => ({
  fetchJson: (...args: unknown[]) =>
    String(args[0]).includes("messaging/translate")
      ? state.translate(...args)
      : state.sendImage(...args),
  fetchVoid: vi.fn().mockResolvedValue(undefined),
}));
let urls: ReturnType<typeof mockObjectUrls>;
beforeEach(async () => {
  await i18n.changeLanguage("zh");
  urls = mockObjectUrls();
  state.translation = MessageTranslationModel.create();
  state.translation.setIdentity(JSON.stringify(["owner", "owner"]));
  state.translate.mockReset().mockResolvedValue({ language: "es", source: "site", text: "Hola" });
  state.sendImage.mockReset().mockResolvedValue({ ok: true, messageId: "image-1" });
  state.mutate.mockReset().mockResolvedValue({
    data: { ecommerceSendCustomerServiceTextReply: { messageId: "text-1" } },
  });
  const conversation = {
    shopId: "shop-1",
    platformShopId: "shop-1",
    conversationId: "chat-1",
    status: GQL.CustomerServiceConversationStatus.Pending,
    isOpen: true,
    aiEnabled: false,
    openEscalationCount: 0,
  };
  state.query.mockReset().mockResolvedValue({
    data: {
      ecommerceGetCustomerServiceInbox: { items: [conversation], totalCount: 1 },
      ecommerceGetConversationMessages: { items: [] },
    },
  });
  state.workspace = CustomerServiceWorkspaceModel.create(
    { conversationItems: [conversation] },
    {
      apolloClient: { query: state.query, mutate: state.mutate } as any,
    },
  );
  state.workspace.selectConversation("shop-1", "chat-1");
});
afterEach(() => vi.unstubAllGlobals());
const view = (key = "chat-1") => (
  <ToastProvider>
    <CustomerServiceReplyComposer key={key} shopId="shop-1" conversationId={key} />
  </ToastProvider>
);
const image = (name = "capture.png") => new File(["image"], name, { type: "image/png" });
function paste(...files: File[]) {
  fireEvent.paste(screen.getByRole("textbox"), { clipboardData: { files } });
}
const send = () => fireEvent.click(screen.getByRole("button", { name: "发送" }));

describe("customer service pasted image reply", () => {
  it("does not upload or send on paste; previews, deletes, and sends retained binary images only after Send", async () => {
    render(view());
    paste(image());
    expect(screen.getByRole("img", { name: "capture.png" })).toBeTruthy();
    expect(state.sendImage).not.toHaveBeenCalled();
    expect(state.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "移除 capture.png" }));
    expect(urls.revoke).toHaveBeenCalledWith("blob:test-image-1");
    const retained = image("retained.png");
    paste(retained);
    send();
    await waitFor(() => expect(state.sendImage).toHaveBeenCalledOnce());
    expect(state.sendImage.mock.calls[0]).toEqual([
      "/cloud/ecommerce/customer-service/manual-image-reply",
      expect.objectContaining({
        method: "POST",
        body: retained,
        headers: expect.objectContaining({
          "Content-Type": "image/png",
          "X-Shop-Id": "shop-1",
          "X-Conversation-Id": "chat-1",
        }),
      }),
    ]);
    await waitFor(() => expect(screen.queryByRole("img")).toBeNull());
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("retains only failed images after partial success, preserves request keys on retry and suppresses double clicks", async () => {
    state.workspace.setManualReplyDraft("Hola");
    state.sendImage
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error("image failed"));
    render(view());
    paste(image("one.png"), image("two.png"));
    const button = screen.getByRole("button", { name: "发送" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText("image failed")).toBeTruthy());
    expect(state.mutate).toHaveBeenCalledOnce();
    expect(state.sendImage.mock.invocationCallOrder[0]).toBeLessThan(
      state.query.mock.invocationCallOrder[0],
    );
    expect(state.workspace.manualReplyDraft).toBe("");
    expect(screen.queryByRole("img", { name: "one.png" })).toBeNull();
    expect(screen.getByRole("img", { name: "two.png" })).toBeTruthy();
    expect(state.query).not.toHaveBeenCalledWith(
      expect.objectContaining({ query: CS_CONVERSATION_INBOX_QUERY }),
    );
    const key = state.sendImage.mock.calls[1][1].headers["X-Idempotency-Key"];
    send();
    await waitFor(() => expect(state.sendImage).toHaveBeenCalledTimes(3));
    expect(state.sendImage.mock.calls[2][1].headers["X-Idempotency-Key"]).toBe(key);
    await waitFor(() =>
      expect(state.query).toHaveBeenCalledWith(
        expect.objectContaining({ query: CS_CONVERSATION_INBOX_QUERY }),
      ),
    );
    expect(state.mutate).toHaveBeenCalledOnce();
  });
  it("drops unsent images when another conversation opens", () => {
    const { rerender } = render(view());
    paste(image());
    rerender(view("chat-2"));
    expect(screen.queryByRole("img")).toBeNull();
    expect(urls.revoke).toHaveBeenCalledWith("blob:test-image-1");
    expect(state.sendImage).not.toHaveBeenCalled();
  });
});

describe("customer service translation preview", () => {
  const translate = () => fireEvent.click(screen.getByRole("button", { name: "翻译并发送" }));
  const preview = () => screen.getByRole("dialog", { name: "确认译文" });
  async function ready() {
    await waitFor(() =>
      expect(within(preview()).getByRole("textbox", { name: "译文（可编辑）" })).toBeTruthy(),
    );
  }
  it("previews without sending, cancels without replacing original, and sends the edited translation", async () => {
    state.workspace.setManualReplyDraft("你好");
    render(view());
    paste(image());
    translate();
    await ready();
    expect(state.workspace.manualReplyDraft).toBe("你好");
    expect(state.mutate).not.toHaveBeenCalled();
    expect(state.sendImage).not.toHaveBeenCalled();
    expect(JSON.parse(state.translate.mock.calls[0][1].body).fallbackLanguage).toBe("es");
    fireEvent.click(within(preview()).getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(state.workspace.manualReplyDraft).toBe("你好");
    expect(screen.getByRole("img")).toBeTruthy();
    translate();
    await ready();
    fireEvent.change(within(preview()).getByRole("textbox", { name: "译文（可编辑）" }), {
      target: { value: "Hola, gracias 😊" },
    });
    const button = within(preview()).getByRole("button", { name: "发送译文" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(state.mutate).toHaveBeenCalledOnce();
    expect(state.mutate.mock.calls[0][0].variables.message).toBe("Hola, gracias 😊");
    expect(state.sendImage).toHaveBeenCalledOnce();
    expect(state.workspace.manualReplyDraft).toBe("");
  });
  it("retains preview on send failure and retries without sending acknowledged text twice", async () => {
    state.workspace.setManualReplyDraft("你好");
    state.sendImage.mockRejectedValueOnce(new Error("image failed"));
    render(view());
    paste(image());
    translate();
    await ready();
    fireEvent.click(within(preview()).getByRole("button", { name: "发送译文" }));
    await waitFor(() =>
      expect(within(preview()).getByText("正文已发送。重试只发送剩余附件。")).toBeTruthy(),
    );
    expect(state.mutate).toHaveBeenCalledOnce();
    expect(state.workspace.manualReplyDraft).toBe("");
    fireEvent.click(within(preview()).getByRole("button", { name: "发送剩余附件" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(state.mutate).toHaveBeenCalledOnce();
    expect(state.sendImage).toHaveBeenCalledTimes(2);
  });
  it("keeps original on generation errors and never sends it automatically", async () => {
    state.translate.mockRejectedValue(new Error("Model unavailable"));
    state.workspace.setManualReplyDraft("你好");
    render(view());
    translate();
    await waitFor(() => expect(within(preview()).getByText("Model unavailable")).toBeTruthy());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(state.workspace.manualReplyDraft).toBe("你好");
    expect(state.mutate).not.toHaveBeenCalled();
  });
});
