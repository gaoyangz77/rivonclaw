// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { types } from "mobx-state-tree";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { CustomerServiceWorkspaceModel } from "../../store/models/CustomerServiceWorkspaceModel.js";
import { CS_CONVERSATION_INBOX_COUNTS_QUERY } from "../../api/shops-queries.js";
import { CustomerServiceConversationsPage } from "./CustomerServiceConversationsPage.js";

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

function setup(counts: unknown) {
  const query = vi.fn(async ({ query: document }: { query: unknown }) => {
    if (document === CS_CONVERSATION_INBOX_COUNTS_QUERY) {
      return { data: { ecommerceGetCustomerServiceInboxCounts: counts } };
    }
    return { data: { ecommerceGetCustomerServiceInbox: { items: [], totalCount: 0 } } };
  });
  const Root = types
    .model({
      shops: types.frozen<unknown[]>([]),
      customerServiceWorkspace: CustomerServiceWorkspaceModel,
    })
    .volatile(() => ({
      currentUser: { id: "user-1" },
      providerKeys: [] as unknown[],
      fetchShops: vi.fn().mockResolvedValue(undefined),
    }));
  const root = Root.create(
    { shops: [], customerServiceWorkspace: {} },
    { apolloClient: { query, mutate: vi.fn() } as any },
  );
  mocks.store = root as unknown as Record<string, unknown>;
  return { root, query };
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("CS conversation category tabs", () => {
  it("shows the four tabs with their counts", async () => {
    setup({ all: 9, escalated: 2, pending: 4, resolved: 5 });
    render(<CustomerServiceConversationsPage />);
    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      `${key("conversationTabAll")}`,
      `${key("conversationTabEscalated")}`,
      `${key("conversationTabPending")}`,
      `${key("conversationTabResolved")}`,
    ].map((label, index) => `${label}${[9, 2, 4, 5][index]}`));
  });

  it("dims the list with a spinner while it reloads", async () => {
    const { query } = setup({ all: 9, escalated: 2, pending: 4, resolved: 5 });
    query.mockImplementation(() => new Promise(() => {}));
    const { container } = render(<CustomerServiceConversationsPage />);
    expect((await screen.findByRole("status")).textContent).toBe("common.loading");
    expect(container.querySelector(".cs-conversation-list")?.getAttribute("aria-busy")).toBe("true");
  });

  it("says so when the counts fail to load", async () => {
    setup(null);
    render(<CustomerServiceConversationsPage />);
    expect(await screen.findByText(key("conversationCountsLoadFailed"))).toBeTruthy();
  });

  it("switches the category and refetches the list when a tab is clicked", async () => {
    const { root, query } = setup({ all: 9, escalated: 2, pending: 4, resolved: 5 });
    render(<CustomerServiceConversationsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: new RegExp(key("conversationTabEscalated")) }));
    await waitFor(() =>
      expect((root as any).customerServiceWorkspace.conversationCategory).toBe("escalated"),
    );
    await waitFor(() =>
      expect(
        query.mock.calls.some(
          ([options]) =>
            (options as any).variables?.escalation === GQL.CustomerServiceConversationEscalationFilter.Open,
        ),
      ).toBe(true),
    );
  });
});
