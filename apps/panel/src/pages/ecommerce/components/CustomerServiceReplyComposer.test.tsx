import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  mutate: vi.fn(),
  query: vi.fn(),
}));
vi.mock("../../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => ({ customerServiceWorkspace: state.workspace }),
}));
vi.mock("../../../api/client.js", () => ({
  fetchJson: (...args: unknown[]) => state.sendImage(...args),
  fetchVoid: vi.fn().mockResolvedValue(undefined),
}));
let urls: ReturnType<typeof mockObjectUrls>;
beforeEach(async () => {
  await i18n.changeLanguage("zh");
  urls = mockObjectUrls();
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
