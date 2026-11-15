// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { CustomerServiceWorkspaceModel } from "../../store/models/CustomerServiceWorkspaceModel.js";
import { CS_COUPONS_QUERY, CS_CONVERSATION_MESSAGES_QUERY } from "../../api/shops-queries.js";
import { CustomerServiceConversationsPage } from "./CustomerServiceEscalationsPage.js";

const mocks = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock("../../api/client.js", () => ({
  fetchJson: vi.fn().mockResolvedValue({}),
  fetchVoid: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../store/EntityStoreProvider.js", () => ({ useEntityStore: () => mocks.store }));
vi.mock("../../components/Toast.js", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));

const key = (name: string) => `ecommerce.customerServiceWorkspace.${name}`;
const conversation = {
  shopId: "shop-1",
  conversationId: "conversation-1",
  buyerNickname: "coupon-buyer",
  buyerUserId: "buyer-1",
  status: GQL.CustomerServiceConversationStatus.Pending,
  isOpen: true,
  aiEnabled: true,
  openEscalationCount: 0,
  recentBadReviews: [],
};

function setup(messages: unknown[] = []) {
  const query = vi.fn(async ({ query: document }: { query: unknown }) => {
    if (document === CS_COUPONS_QUERY) {
      return {
        data: {
          ecommerceCustomerServiceCoupons: {
            truncated: false,
            coupons: [
              {
                id: "coupon-9",
                title: "Spring sale",
                displayType: GQL.CouponDisplayType.Chat,
                targetBuyerSegment: GQL.CouponTargetBuyerSegment.All,
                discount: { type: GQL.CouponDiscountType.Unknown },
                threshold: { type: GQL.CouponThresholdType.Unknown },
                sendable: true,
              },
            ],
          },
        },
      };
    }
    if (document === CS_CONVERSATION_MESSAGES_QUERY) {
      return { data: { ecommerceGetConversationMessages: { items: messages, nextPageToken: null } } };
    }
    return {
      data: {
        ecommerceGetCustomerServiceInbox: { items: [conversation], totalCount: 1 },
        ecommerceGetConversationOrderIds: [],
      },
    };
  });
  const workspace = CustomerServiceWorkspaceModel.create({}, { apolloClient: { query } as any });
  mocks.store = {
    customerServiceWorkspace: workspace,
    currentUser: { id: "user-1" },
    shops: [],
    providerKeys: [],
    fetchShops: vi.fn().mockResolvedValue(undefined),
  };
  return { workspace, query };
}

beforeEach(() => vi.clearAllMocks());

describe("CS conversation coupons", () => {
  it("offers the coupon button for a conversation without orders and opens the picker", async () => {
    const { workspace, query } = setup();
    render(<CustomerServiceConversationsPage />);
    fireEvent.click(await screen.findByText("coupon-buyer"));
    await waitFor(() => expect(workspace.selectedConversationId).toBe("conversation-1"));

    expect(screen.queryByRole("button", { name: key("order") })).toBeNull();
    const trigger = screen.getByRole("button", { name: key("coupon") });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(query.mock.calls.some(([o]) => o.query === CS_COUPONS_QUERY)).toBe(false);

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(await screen.findByText("Spring sale")).toBeTruthy();

    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(trigger.getAttribute("aria-expanded")).toBe("false"));
  });

  it("renders a sent coupon card instead of raw JSON", async () => {
    const { workspace } = setup([
      {
        messageId: "message-1",
        type: "COUPON_CARD",
        text: JSON.stringify({ coupon_id: "coupon-9" }),
        createTime: 1,
        sender: { role: "CUSTOMER_SERVICE" },
      },
    ]);
    render(<CustomerServiceConversationsPage />);
    fireEvent.click(await screen.findByText("coupon-buyer"));
    await waitFor(() => expect(workspace.selectedConversationId).toBe("conversation-1"));

    expect(await screen.findByText(key("couponCard"))).toBeTruthy();
    expect(screen.getByText(key("couponIdLabel"))).toBeTruthy();
    expect(screen.getByText("coupon-9")).toBeTruthy();
    expect(screen.queryByText(/coupon_id/)).toBeNull();
  });
});
