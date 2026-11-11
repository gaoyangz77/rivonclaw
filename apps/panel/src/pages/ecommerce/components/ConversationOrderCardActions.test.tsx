import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GQL } from "@rivonclaw/core";
import i18n from "../../../i18n/index.js";
import { ConversationOrderCardActions } from "./ConversationOrderCardActions.js";

const mocks = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("../../../components/Toast.js", () => ({ useToast: () => ({ showToast: mocks.toast }) }));

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);

function workspace(sendOrderCard: ReturnType<typeof vi.fn>) {
  return { sendOrderCard, isCardSending: () => false } as any;
}

it("hides the logistics button until the order has a package", () => {
  render(
    <ConversationOrderCardActions
      workspace={workspace(vi.fn())}
      shopId="shop-1"
      conversationId="conversation-1"
      orderId="order-1"
      packageIds={[]}
    />,
  );
  expect(screen.getByRole("button", { name: "发送订单卡片" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "发送物流卡片" })).toBeNull();
});

it("sends the expanded order's cards and confirms each send", async () => {
  const sendOrderCard = vi.fn().mockResolvedValue(true);
  render(
    <ConversationOrderCardActions
      workspace={workspace(sendOrderCard)}
      shopId="shop-1"
      conversationId="conversation-1"
      orderId="order-1"
      packageIds={["pkg-1"]}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "发送订单卡片" }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("订单卡片已发送", "success"));
  expect(sendOrderCard).toHaveBeenLastCalledWith(
    {
      shopId: "shop-1",
      conversationId: "conversation-1",
      orderId: "order-1",
      type: GQL.EcomCustomerServiceCardType.OrderCard,
    },
    "zh",
  );

  fireEvent.click(screen.getByRole("button", { name: "发送物流卡片" }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("物流卡片已发送", "success"));
  expect(sendOrderCard).toHaveBeenLastCalledWith(
    expect.objectContaining({
      type: GQL.EcomCustomerServiceCardType.LogisticsCard,
      packageIds: ["pkg-1"],
    }),
    "zh",
  );
});

it("shows the failure reason when a send fails", async () => {
  const sendOrderCard = vi.fn().mockRejectedValue(new Error("店铺未开通客服"));
  render(
    <ConversationOrderCardActions
      workspace={workspace(sendOrderCard)}
      shopId="shop-1"
      conversationId="conversation-1"
      orderId="order-1"
      packageIds={[]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "发送订单卡片" }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("店铺未开通客服", "error"));
});
