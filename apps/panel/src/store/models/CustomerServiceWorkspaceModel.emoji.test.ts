import { describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { CustomerServiceWorkspaceModel } from "./CustomerServiceWorkspaceModel.js";
import { CS_SEND_MANUAL_TEXT_REPLY_MUTATION } from "../../api/shops-queries.js";

vi.mock("../../api/client.js", () => ({
  fetchJson: vi.fn(),
  fetchVoid: vi.fn().mockResolvedValue(undefined),
}));

describe("customer service emoji replies", () => {
  it.each(["Hola 😊, gracias 🙏", "👩🏽‍💻❤️", "😊"])(
    "preserves Unicode in the text mutation: %s",
    async (message) => {
      const conversation = {
        shopId: "shop-1",
        platformShopId: "platform-shop-1",
        conversationId: "conversation-1",
        status: GQL.CustomerServiceConversationStatus.Pending,
        isOpen: true,
        aiEnabled: true,
        buyerUserId: "buyer-1",
        openEscalationCount: 0,
      };
      const mutate = vi.fn().mockResolvedValue({
        data: { ecommerceSendCustomerServiceTextReply: { messageId: "sent-1" } },
      });
      const query = vi.fn().mockResolvedValue({
        data: {
          ecommerceGetCustomerServiceInbox: { items: [conversation], totalCount: 1 },
          ecommerceGetConversationMessages: { items: [], nextPageToken: null },
        },
      });
      const store = CustomerServiceWorkspaceModel.create(
        { conversationItems: [conversation] },
        {
          apolloClient: { mutate, query } as any,
        },
      );
      store.selectConversation("shop-1", "conversation-1");
      store.setManualReplyDraft(message);
      expect(mutate).not.toHaveBeenCalled();
      await store.sendManualReply("zh");
      expect(mutate).toHaveBeenCalledExactlyOnceWith({
        mutation: CS_SEND_MANUAL_TEXT_REPLY_MUTATION,
        variables: { shopId: "shop-1", conversationId: "conversation-1", message },
      });
      expect(store.manualReplyDraft).toBe("");
      expect(store.sendingManualReply).toBe(false);
    },
  );
});
