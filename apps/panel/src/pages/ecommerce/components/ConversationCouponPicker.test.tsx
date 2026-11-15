// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { GQL } from "@rivonclaw/core";
import i18n from "../../../i18n/index.js";
import { CustomerServiceWorkspaceModel } from "../../../store/models/CustomerServiceWorkspaceModel.js";
import { CS_COUPONS_QUERY } from "../../../api/shops-queries.js";
import { ConversationCouponPicker } from "./ConversationCouponPicker.js";

vi.mock("../../../api/client.js", () => ({
  fetchJson: vi.fn(),
  fetchVoid: vi.fn().mockResolvedValue(undefined),
}));
const mocks = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("../../../components/Toast.js", () => ({ useToast: () => ({ showToast: mocks.toast }) }));

function coupon(overrides: Record<string, unknown>) {
  return {
    id: "coupon-1",
    title: "Welcome",
    displayType: GQL.CouponDisplayType.Chat,
    status: "ONGOING",
    targetBuyerSegment: GQL.CouponTargetBuyerSegment.All,
    productScope: GQL.CouponProductScope.FullShop,
    discount: {
      type: GQL.CouponDiscountType.AmountOff,
      percentage: null,
      reductionAmount: { amount: "5", currency: "USD" },
      maxDiscount: null,
    },
    threshold: { type: GQL.CouponThresholdType.None, minSpend: null },
    claimStartTime: "2026-11-01T00:00:00.000Z",
    claimEndTime: "2026-12-31T00:00:00.000Z",
    singleBuyerClaimLimit: null,
    sendable: true,
    notSendableReason: null,
    ...overrides,
  };
}

const coupons = [
  coupon({ id: "late", title: "Late coupon", claimEndTime: "2027-03-01T00:00:00.000Z" }),
  coupon({
    id: "live-only",
    title: "Live coupon",
    displayType: GQL.CouponDisplayType.Live,
    sendable: false,
    notSendableReason: GQL.CouponNotSendableReason.DisplayTypeNotChatOrRegular,
    claimEndTime: "2026-11-20T00:00:00.000Z",
  }),
  coupon({
    id: "soon",
    title: "Ending soon",
    displayType: GQL.CouponDisplayType.Regular,
    targetBuyerSegment: GQL.CouponTargetBuyerSegment.New,
    discount: {
      type: GQL.CouponDiscountType.PercentOff,
      percentage: "10",
      reductionAmount: null,
      maxDiscount: { amount: "20", currency: "USD" },
    },
    threshold: { type: GQL.CouponThresholdType.MinSpend, minSpend: { amount: "50", currency: "USD" } },
    singleBuyerClaimLimit: 2,
    claimEndTime: "2026-12-01T00:00:00.000Z",
  }),
];

function setup(list: unknown = { coupons, truncated: false }) {
  const query = vi.fn(async ({ query: document }: { query: unknown }) => {
    if (document === CS_COUPONS_QUERY) return { data: { ecommerceCustomerServiceCoupons: list } };
    return { data: { ecommerceGetConversationMessages: { items: [], nextPageToken: null } } };
  });
  const mutate = vi.fn().mockResolvedValue({
    data: { ecommerceSendCustomerServiceCoupon: { messageId: "message-1" } },
  });
  const workspace = CustomerServiceWorkspaceModel.create(
    {},
    { apolloClient: { query, mutate } as any },
  );
  const view = (open: boolean) => (
    <ConversationCouponPicker
      workspace={workspace}
      shopId="shop-1"
      conversationId="conversation-1"
      open={open}
    />
  );
  return { workspace, query, mutate, view };
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);

function rows() {
  return Array.from(document.querySelectorAll(".cs-coupon-row")) as HTMLElement[];
}

describe("ConversationCouponPicker", () => {
  it("loads only while open, lists sendable coupons first by claim end, and never shows raw enums", async () => {
    const { query, view } = setup();
    const { rerender } = render(view(false));
    expect(query).not.toHaveBeenCalled();

    rerender(view(true));
    await screen.findByText("Ending soon");
    expect(rows().map((row) => within(row).getByText(/^(Ending soon|Late coupon|Live coupon)$/).textContent)).toEqual([
      "Ending soon",
      "Late coupon",
      "Live coupon",
    ]);

    const soon = rows()[0];
    expect(within(soon).getByText("10% 折扣，最高减 20 USD")).toBeTruthy();
    expect(within(soon).getByText("满 50 USD 可用")).toBeTruthy();
    expect(within(soon).getByText("仅限新客")).toBeTruthy();
    expect(within(soon).getByText("通用")).toBeTruthy();
    expect(within(soon).getByText("每位买家限领 2 张")).toBeTruthy();
    expect(within(rows()[1]).getByText("立减 5 USD")).toBeTruthy();
    expect(within(rows()[1]).getByText("无门槛")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/AMOUNT_OFF|PERCENT_OFF|MIN_SPEND|DISPLAY_TYPE|UNKNOWN/);
  });

  it("filters client-side by title or coupon id", async () => {
    const { query, view } = setup();
    render(view(true));
    await screen.findByText("Ending soon");
    const callsAfterLoad = query.mock.calls.length;

    const search = screen.getByRole("textbox", { name: "搜索优惠券" });
    fireEvent.change(search, { target: { value: "LATE" } });
    expect(rows()).toHaveLength(1);
    expect(screen.getByText("Late coupon")).toBeTruthy();

    fireEvent.change(search, { target: { value: "live-only" } });
    expect(screen.getByText("Live coupon")).toBeTruthy();

    fireEvent.change(search, { target: { value: "nothing" } });
    expect(screen.getByText("没有符合搜索条件的优惠券。")).toBeTruthy();
    expect(query.mock.calls.length).toBe(callsAfterLoad);
  });

  it("lists a non-sendable coupon with a disabled button and its reason", async () => {
    const { mutate, view } = setup();
    render(view(true));
    await screen.findByText("Live coupon");
    const live = rows()[2];
    expect(within(live).getByText("仅客服专属或通用优惠券可以发送")).toBeTruthy();
    const button = within(live).getByRole("button", { name: "发送" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("sends the clicked coupon and confirms with a toast", async () => {
    const { mutate, view } = setup();
    render(view(true));
    await screen.findByText("Ending soon");
    fireEvent.click(within(rows()[0]).getByRole("button", { name: "发送" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("优惠券已发送", "success"));
    expect(mutate.mock.calls[0][0].variables).toMatchObject({
      shopId: "shop-1",
      conversationId: "conversation-1",
      couponId: "soon",
    });
  });

  it("shows the backend error when a send is rejected", async () => {
    const { mutate, view } = setup();
    mutate.mockRejectedValue(new Error("优惠券领取次数已达上限"));
    render(view(true));
    await screen.findByText("Ending soon");
    fireEvent.click(within(rows()[0]).getByRole("button", { name: "发送" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("优惠券领取次数已达上限", "error"));
  });

  it("hints when the list is truncated and when the shop has no coupons", async () => {
    const truncated = setup({ coupons, truncated: true });
    render(truncated.view(true));
    await screen.findByText("Ending soon");
    expect(screen.getByRole("note").textContent).toContain("3");
    cleanup();

    const empty = setup({ coupons: [], truncated: false });
    render(empty.view(true));
    expect(await screen.findByText("该店铺暂无进行中的优惠券。")).toBeTruthy();
  });

  it("reloads on refresh and drops the list when closed", async () => {
    const { workspace, query, view } = setup();
    const { rerender } = render(view(true));
    await screen.findByText("Ending soon");
    const couponCalls = () => query.mock.calls.filter(([o]) => o.query === CS_COUPONS_QUERY).length;
    expect(couponCalls()).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "刷新" }));
    await waitFor(() => expect(couponCalls()).toBe(2));

    rerender(view(false));
    expect(workspace.shopCoupons.has("shop-1")).toBe(false);
  });

  it("shows a load error with a retry", async () => {
    const { query, view } = setup();
    query.mockRejectedValueOnce(new Error("boom"));
    render(view(true));
    expect((await screen.findByRole("alert")).textContent).toContain("无法加载店铺的优惠券。");
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await screen.findByText("Ending soon");
  });
});
