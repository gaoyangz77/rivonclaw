import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleCsConversationChanged } from "./cs-conversation-signal-actuator.js";
import type { CsConversationChangedPayload } from "../cloud/backend-subscription-client.js";

const state = vi.hoisted(() => ({
  bridge: {
    handleCsConversationSignal: vi.fn(),
  },
  shops: [] as any[],
}));

vi.mock("../gateway/connection.js", () => ({
  getCsBridge: () => state.bridge,
}));

vi.mock("../app/store/desktop-store.js", () => ({
  rootStore: {
    findShopByObjectOrPlatformId: (shopId?: string | null, platformShopId?: string | null) =>
      state.shops.find((shop: any) =>
        (!!shopId && shop.id === shopId) ||
        (!!platformShopId && shop.platformShopId === platformShopId),
      ),
  },
}));

function makeShop() {
  return {
    id: "shop-1",
    platformShopId: "platform-shop-1",
    services: {
      customerService: {
        enabled: true,
        csDeviceId: "device-1",
      },
    },
    handlesCustomerServiceOnDevice: vi.fn((deviceId: string) => deviceId === "device-1"),
  };
}

function makeConversation(reason: string): CsConversationChangedPayload {
  return {
    shopId: "shop-1",
    platformShopId: "platform-shop-1",
    conversationId: "conv-1",
    aiEnabled: true,
    latestMessagePreview: "hello",
    orderId: "order-1",
    participants: [{
      role: "BUYER",
      userId: "buyer-1",
      imUserId: "im-1",
      nickname: "buyer",
    }],
    latestMessage: {
      messageId: "msg-1",
      index: "idx-1",
      type: "TEXT",
      content: "hello",
      createTime: 1,
      sender: { role: "BUYER" },
    },
    dispatchHint: {
      reason,
      source: "AIRFLOW",
      messageId: "msg-1",
      messageIndex: "idx-1",
      eventTime: 1,
      operatorInstruction: "follow up with the buyer",
    },
  } as any;
}

function makeConversationWithoutHintCursor(): CsConversationChangedPayload {
  const conversation = makeConversation("PENDING_BUYER_MESSAGE") as any;
  conversation.dispatchHint = {
    reason: "PENDING_BUYER_MESSAGE",
    source: "AIRFLOW",
    eventTime: 1,
  };
  conversation.latestMessage = {
    messageId: "old-local-msg",
    index: "old-local-idx",
    type: "TEXT",
    content: "old local message",
    createTime: 1,
    sender: { role: "CUSTOMER_SERVICE" },
  };
  return conversation;
}

function makeConversationWithMessageIdOnlyHint(): CsConversationChangedPayload {
  const conversation = makeConversation("PENDING_BUYER_MESSAGE") as any;
  conversation.dispatchHint = {
    reason: "PENDING_BUYER_MESSAGE",
    source: "AIRFLOW",
    messageId: "msg-id-only",
    eventTime: 1,
  };
  conversation.latestMessage = {
    messageId: "old-local-msg",
    index: "old-local-idx",
    type: "TEXT",
    content: "old local message",
    createTime: 1,
    sender: { role: "CUSTOMER_SERVICE" },
  };
  return conversation;
}

function makeConversationWithIndexOnlyHint(): CsConversationChangedPayload {
  const conversation = makeConversation("PENDING_BUYER_MESSAGE") as any;
  conversation.dispatchHint = {
    reason: "PENDING_BUYER_MESSAGE",
    source: "AIRFLOW",
    messageIndex: "idx-only",
    eventTime: 1,
  };
  conversation.latestMessage = {
    messageId: "old-local-msg",
    index: "old-local-idx",
    type: "TEXT",
    content: "old local message",
    createTime: 1,
    sender: { role: "CUSTOMER_SERVICE" },
  };
  return conversation;
}

describe("handleCsConversationChanged", () => {
  beforeEach(() => {
    state.bridge.handleCsConversationSignal.mockReset();
    state.shops = [makeShop()];
  });

  it("dispatches recognized pending buyer message hints", async () => {
    await handleCsConversationChanged("device-1", makeConversation("PENDING_BUYER_MESSAGE"));

    expect(state.bridge.handleCsConversationSignal).toHaveBeenCalledWith(expect.objectContaining({
      type: "UNREAD_DETECTED",
      dispatchReason: "PENDING_BUYER_MESSAGE",
      useMessageDelta: true,
      source: "AIRFLOW",
      shopId: "shop-1",
      platformShopId: "platform-shop-1",
      conversationId: "conv-1",
      operatorInstruction: "follow up with the buyer",
    }));
  });

  it("dispatches recognized session-expiring hints", async () => {
    await handleCsConversationChanged("device-1", makeConversation("SESSION_EXPIRING_ESCALATION_FOLLOW_UP"));

    expect(state.bridge.handleCsConversationSignal).toHaveBeenCalledWith(expect.objectContaining({
      type: "UNREAD_DETECTED",
      dispatchReason: "SESSION_EXPIRING_ESCALATION_FOLLOW_UP",
      useMessageDelta: false,
      conversationId: "conv-1",
    }));
  });

  it("ignores unknown dispatch hints instead of defaulting to an agent run", async () => {
    await handleCsConversationChanged("device-1", makeConversation("FUTURE_REASON"));

    expect(state.bridge.handleCsConversationSignal).not.toHaveBeenCalled();
  });

  it("ignores pending buyer hints without backend cursor instead of falling back to local latest message", async () => {
    await handleCsConversationChanged("device-1", makeConversationWithoutHintCursor());

    expect(state.bridge.handleCsConversationSignal).not.toHaveBeenCalled();
  });

  it("ignores pending buyer hints without message id even when message index exists", async () => {
    await handleCsConversationChanged("device-1", makeConversationWithIndexOnlyHint());

    expect(state.bridge.handleCsConversationSignal).not.toHaveBeenCalled();
  });

  it("dispatches pending buyer hints anchored by message id without local latest fallback", async () => {
    await handleCsConversationChanged("device-1", makeConversationWithMessageIdOnlyHint());

    expect(state.bridge.handleCsConversationSignal).toHaveBeenCalledWith(expect.objectContaining({
      dispatchReason: "PENDING_BUYER_MESSAGE",
      messageId: "msg-id-only",
      messageIndex: undefined,
      messageType: undefined,
      senderRole: "BUYER",
      latestMessagePreview: undefined,
    }));
  });

  it("ignores dispatch when the shop is not present in the MST shop lifecycle cache", async () => {
    state.shops = [];

    await handleCsConversationChanged("device-1", makeConversation("PENDING_BUYER_MESSAGE"));

    expect(state.bridge.handleCsConversationSignal).not.toHaveBeenCalled();
  });
});
