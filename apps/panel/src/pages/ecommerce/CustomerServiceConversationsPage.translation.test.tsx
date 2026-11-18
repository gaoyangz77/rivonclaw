// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { types } from "mobx-state-tree";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { CustomerServiceWorkspaceModel } from "../../store/models/CustomerServiceWorkspaceModel.js";
import { CS_CONVERSATION_MESSAGES_QUERY } from "../../api/shops-queries.js";
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
const Level = GQL.CustomerServiceMessageAutoTranslation;
const messages = [
  { messageId: "m1", type: "TEXT", text: "Hola", createTime: 1, sender: { role: "BUYER", nickname: "buyer" } },
  { messageId: "m2", type: "TEXT", text: "Gracias", createTime: 2, sender: { role: "CUSTOMER_SERVICE", nickname: "shop" } },
];

function setup(options: { level: GQL.CustomerServiceMessageAutoTranslation; openEscalationCount: number; mutate?: ReturnType<typeof vi.fn> }) {
  const conversation = {
    shopId: "shop-1",
    conversationId: "conversation-1",
    buyerNickname: "translate-buyer",
    buyerUserId: "buyer-1",
    status: GQL.CustomerServiceConversationStatus.Pending,
    isOpen: true,
    aiEnabled: true,
    openEscalationCount: options.openEscalationCount,
    recentBadReviews: [],
  };
  const query = vi.fn(async ({ query: document }: { query: unknown }) => {
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
  const mutate =
    options.mutate ??
    vi.fn(async ({ variables }) => ({
      data: {
        translateCustomerServiceMessages: variables.input.messages.map((m: { messageId: string }) => ({
          messageId: m.messageId,
          sameLanguage: false,
          translatedText: `translated ${m.messageId}`,
        })),
      },
    }));
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
    {
      shops: [{ id: "shop-1", services: { customerService: { enabled: true, messageAutoTranslation: options.level } } }],
      customerServiceWorkspace: {},
    },
    { apolloClient: { query, mutate } as any },
  );
  mocks.store = root as unknown as Record<string, unknown>;
  return { mutate };
}

async function openConversation() {
  fireEvent.click(await screen.findByText("translate-buyer"));
  await screen.findByText("Hola");
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("CS conversation message translation", () => {
  it("translates on demand, shows the translation under each original and hides it again", async () => {
    const { mutate } = setup({ level: Level.Off, openEscalationCount: 0 });
    render(<CustomerServiceConversationsPage />);
    await openConversation();
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.queryByText("translated m1")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: key("translateMessages") }));
    expect(await screen.findByText("translated m1")).toBeTruthy();
    expect(screen.getByText("translated m2")).toBeTruthy();
    expect(screen.getByText("Hola")).toBeTruthy();
    expect(mutate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: key("showOriginalMessages") }));
    await waitFor(() => expect(screen.queryByText("translated m1")).toBeNull());
    expect(screen.getByRole("button", { name: key("translateMessages") })).toBeTruthy();
  });

  it("translates automatically when the shop translates escalated conversations and one is open", async () => {
    const { mutate } = setup({ level: Level.Escalated, openEscalationCount: 1 });
    render(<CustomerServiceConversationsPage />);
    await openConversation();
    expect(await screen.findByText("translated m1")).toBeTruthy();
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: key("showOriginalMessages") })).toBeTruthy();
  });

  it("does not translate an escalated-level shop's conversation without an open escalation", async () => {
    const { mutate } = setup({ level: Level.Escalated, openEscalationCount: 0 });
    render(<CustomerServiceConversationsPage />);
    await openConversation();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.queryByText("translated m1")).toBeNull();
  });

  it.each([
    ["CS_MESSAGE_TRANSLATION_SUBSCRIPTION_REQUIRED", "messageTranslationSubscriptionRequired"],
    ["CS_MESSAGE_TRANSLATION_QUOTA_EXHAUSTED", "messageTranslationQuotaExhausted"],
    ["SOMETHING_ELSE", "messageTranslationFailed"],
  ])("shows a localized message for %s", async (code, textKey) => {
    const mutate = vi.fn().mockRejectedValue(
      Object.assign(new Error("failed"), { errors: [{ extensions: { code } }] }),
    );
    setup({ level: Level.All, openEscalationCount: 0, mutate });
    render(<CustomerServiceConversationsPage />);
    await openConversation();
    expect(await screen.findByText(key(textKey))).toBeTruthy();
  });
});
