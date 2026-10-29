// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { CustomerServiceWorkspaceModel } from "../../store/models/CustomerServiceWorkspaceModel.js";
import { CustomerServiceConversationsPage } from "./CustomerServiceEscalationsPage.js";

const mocks = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock("../../store/EntityStoreProvider.js", () => ({ useEntityStore: () => mocks.store }));
vi.mock("../../components/Toast.js", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));

const key = (name: string) => `ecommerce.customerServiceWorkspace.${name}`;
const badReviewConversation = {
  shopId: "shop-1",
  conversationId: "conversation-1",
  buyerNickname: "bad-review-buyer",
  buyerUserId: "buyer-1",
  status: GQL.CustomerServiceConversationStatus.Pending,
  isOpen: true,
  aiEnabled: true,
  openEscalationCount: 0,
  recentBadReviews: [{ id: "review-1", rating: 1 }],
};
const regularConversation = {
  ...badReviewConversation,
  conversationId: "conversation-2",
  buyerNickname: "regular-buyer",
  recentBadReviews: [],
};

function setup(filter: "all" | "hasBadReview" = "all") {
  const query = vi.fn().mockImplementation(async ({ variables }) => {
    const items = variables.hasBadReview
      ? [badReviewConversation]
      : [badReviewConversation, regularConversation];
    return { data: { ecommerceGetCustomerServiceInbox: { items, totalCount: items.length } } };
  });
  const workspace = CustomerServiceWorkspaceModel.create(
    { conversationBadReviewFilter: filter },
    { apolloClient: { query } as any },
  );
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

describe("CS conversation bad review filter", () => {
  it("queries and displays only bad-review conversations, and can return to all", async () => {
    const { workspace, query } = setup();
    render(<CustomerServiceConversationsPage />);
    await screen.findByText("regular-buyer");
    fireEvent.click(screen.getByRole("button", { name: key("showAdvancedFilters") }));
    fireEvent.click(screen.getByRole("button", { name: key("filterBadReviewState") }));
    fireEvent.click(screen.getByText(key("hasBadReview")));

    await waitFor(() => expect(screen.queryByText("regular-buyer")).toBeNull());
    expect(screen.getByText("bad-review-buyer")).toBeTruthy();
    expect(workspace.conversationBadReviewFilter).toBe("hasBadReview");
    expect(query).toHaveBeenLastCalledWith(expect.objectContaining({
      variables: expect.objectContaining({ hasBadReview: true }),
    }));

    fireEvent.click(screen.getByRole("button", { name: key("filterBadReviewState") }));
    fireEvent.click(screen.getByText(key("badReviewAll")));
    await screen.findByText("regular-buyer");
    expect(workspace.conversationBadReviewFilter).toBe("all");
    expect(query).toHaveBeenLastCalledWith(expect.objectContaining({
      variables: expect.objectContaining({ hasBadReview: undefined }),
    }));
  });

  it("keeps advanced filters visible when returning with a saved bad-review filter", async () => {
    const { query } = setup("hasBadReview");
    render(<CustomerServiceConversationsPage />);
    expect(screen.getByRole("button", { name: key("filterBadReviewState") })).toBeTruthy();
    await screen.findByText("bad-review-buyer");
    expect(screen.queryByText("regular-buyer")).toBeNull();
    expect(query).toHaveBeenLastCalledWith(expect.objectContaining({
      variables: expect.objectContaining({ hasBadReview: true }),
    }));
  });
});

describe("CS bulk order search", () => {
  it("pastes newline-separated orders without losing their boundaries and submits the full list", async () => {
    const { workspace, query } = setup();
    render(<CustomerServiceConversationsPage />);
    await screen.findByText("regular-buyer");
    const input = screen.getByRole("textbox", { name: key("filterSearch") });
    fireEvent.paste(input, { clipboardData: { getData: () => "576833748427839658\r\n585467690218522028" } });
    expect(workspace.conversationSearchDraft).toBe("576833748427839658,585467690218522028");
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(query).toHaveBeenLastCalledWith(expect.objectContaining({
      variables: expect.objectContaining({ search: "576833748427839658,585467690218522028" }),
    })));
  });

  it.each([
    ["CS_ORDER_SEARCH_INVALID", "orderSearchInvalid"],
    ["CS_ORDER_SEARCH_LIMIT", "orderSearchTooMany"],
    ["CS_SEARCH_TOO_LONG", "conversationSearchTooLong"],
  ])("localizes the backend validation error %s", async (code, translationKey) => {
    const { query } = setup();
    const error = Object.assign(new Error("Backend validation message"), { errors: [{ extensions: { code } }] });
    query.mockRejectedValue(error);
    render(<CustomerServiceConversationsPage />);
    expect((await screen.findByRole("alert")).textContent).toBe(key(translationKey));
    expect(screen.queryByText("Backend validation message")).toBeNull();
  });
});
