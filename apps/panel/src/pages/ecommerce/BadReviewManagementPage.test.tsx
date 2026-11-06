// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import i18n from "../../i18n/index.js";
import { EcommerceBadReviewModel } from "../../store/models/EcommerceBadReviewModel.js";
import { BadReviewManagementPage } from "./BadReviewManagementPage.js";

const mocks = vi.hoisted(() => ({ store: {} as Record<string, unknown>, showToast: vi.fn() }));
vi.mock("../../components/Toast.js", () => ({ useToast: () => ({ showToast: mocks.showToast }) }));
vi.mock("../../store/EntityStoreProvider.js", () => ({ useEntityStore: () => mocks.store }));

function dto(overrides: Partial<GQL.EcomBadReview> = {}): GQL.EcomBadReview {
  return {
    id: "review-1",
    shopId: "shop-1",
    shopName: "Shop One",
    platformReviewId: "import:576000000000000001",
    orderId: "576000000000000001",
    hasBuyer: true,
    rating: 1,
    content: "Arrived broken",
    reviewTime: "2026-11-01T17:00:00.000Z",
    source: GQL.ProductReviewSource.ManualImport,
    shopFollowUpMode: GQL.BadReviewFollowUpMode.Manual,
    handlingStatus: GQL.ProductReviewHandlingStatus.Pending,
    handlingChangedAt: "2026-11-01T17:00:00.000Z",
    handlingEvents: [],
    aiFollowUpStatus: GQL.ProductReviewFollowUpStatus.NotRequired,
    ...overrides,
  };
}

const conversation = { shopId: "shop-1", conversationId: "conv-1" };
const showConversation = vi.fn();
const openOrderDraft = vi.fn();

function mount(items: GQL.EcomBadReview[], mutate = vi.fn(), totalCount = items.length) {
  const query = vi.fn().mockResolvedValue({ data: { page: { items, totalCount } } });
  const ecommerceBadReview = EcommerceBadReviewModel.create({}, { apolloClient: { query, mutate } });
  mocks.store = {
    currentUser: { userId: "user-1" },
    shops: [{ id: "shop-1", shopName: "Shop One", alias: null, region: "US" }],
    ecommerceBadReview,
    customerServiceWorkspace: { showConversation, openOrderDraft, startOrderErrors: new Map() },
  };
  const onNavigate = vi.fn();
  render(<BadReviewManagementPage onNavigate={onNavigate} />);
  return { onNavigate, ecommerceBadReview, mutate, query };
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("BadReviewManagementPage", () => {
  it("says which shops sync through the API and which use the import", async () => {
    mount([dto()]);
    expect(await screen.findByText(/Only US local shops sync reviews through the API/)).toBeTruthy();
    expect(await screen.findByText("Arrived broken")).toBeTruthy();
  });

  it("starts follow-up, shows the conversation and goes to it", async () => {
    const mutate = vi.fn().mockResolvedValue({
      data: {
        result: {
          review: dto({ handlingStatus: GQL.ProductReviewHandlingStatus.InProgress }),
          conversation,
        },
      },
    });
    const { onNavigate } = mount([dto()], mutate);
    fireEvent.click(await screen.findByRole("button", { name: "Start follow-up" }));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("/commerce/customer-service"));
    expect(showConversation).toHaveBeenCalledWith(conversation);
    expect(await screen.findByText("In follow-up")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start follow-up" })).toBeNull();
  });

  it("stays on the page and shows TikTok's refusal", async () => {
    const mutate = vi.fn().mockRejectedValue(new Error("TikTok refused the conversation"));
    const { onNavigate } = mount([dto()], mutate);
    fireEvent.click(await screen.findByRole("button", { name: "Start follow-up" }));
    expect(await screen.findByText("TikTok refused the conversation")).toBeTruthy();
    expect(onNavigate).not.toHaveBeenCalled();
    expect(showConversation).not.toHaveBeenCalled();
  });

  it("offers Start follow-up only in manual shops", async () => {
    mount([dto({ shopFollowUpMode: GQL.BadReviewFollowUpMode.Ai })]);
    expect(await screen.findByRole("button", { name: "Open conversation" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start follow-up" })).toBeNull();
  });

  it("offers neither action without a buyer", async () => {
    mount([dto({ hasBuyer: false })]);
    expect(await screen.findByText("No buyer")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open conversation" })).toBeNull();
  });

  it("opens the conversation without touching AI or the status", async () => {
    openOrderDraft.mockResolvedValue(true);
    const { onNavigate, mutate } = mount([dto()]);
    fireEvent.click(await screen.findByRole("button", { name: "Open conversation" }));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("/commerce/customer-service"));
    expect(openOrderDraft).toHaveBeenCalledWith("shop-1", "576000000000000001");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("shows the paid-feature prompt, not the raw refusal, when the shop has no customer service plan", async () => {
    openOrderDraft.mockResolvedValue(false);
    const { onNavigate } = mount([dto()]);
    (mocks.store.customerServiceWorkspace as { startOrderErrors: Map<string, string> }).startOrderErrors.set(
      "shop-1:576000000000000001",
      'Upgrade required: your plan does not include entitlement "ECOM_CS_WRITE"',
    );
    fireEvent.click(await screen.findByRole("button", { name: "Open conversation" }));
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith(
        "This feature requires a subscription. Please upgrade your plan.",
        "error",
      ),
    );
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("shows any other refusal as it came", async () => {
    openOrderDraft.mockResolvedValue(false);
    mount([dto()]);
    (mocks.store.customerServiceWorkspace as { startOrderErrors: Map<string, string> }).startOrderErrors.set(
      "shop-1:576000000000000001",
      "TikTok refused the conversation",
    );
    fireEvent.click(await screen.findByRole("button", { name: "Open conversation" }));
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith("TikTok refused the conversation", "error"),
    );
  });

  it("turns the page and reads the next rows", async () => {
    const { query } = mount([dto()], vi.fn(), 120);
    expect(await screen.findByText("Page 1 of 3, 120 reviews")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page 2 of 3, 120 reviews")).toBeTruthy();
    await waitFor(() =>
      expect(query.mock.calls.at(-1)![0].variables.input).toMatchObject({ limit: 50, offset: 50 }),
    );
  });

  it("shows how long a review has been in follow-up", async () => {
    mount([
      dto({
        handlingStatus: GQL.ProductReviewHandlingStatus.InProgress,
        handlingChangedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      }),
    ]);
    expect(await screen.findByText("3 days in follow-up")).toBeTruthy();
  });

  it("updates the status from the detail modal, and never offers In follow-up there", async () => {
    const mutate = vi.fn().mockResolvedValue({
      data: {
        review: dto({
          handlingStatus: GQL.ProductReviewHandlingStatus.Closed,
          handlingEvents: [
            {
              from: GQL.ProductReviewHandlingStatus.Pending,
              to: GQL.ProductReviewHandlingStatus.Closed,
              note: "Done",
              source: GQL.ProductReviewHandlingEventSource.Manual,
              at: "2026-11-02T00:00:00.000Z",
            },
          ],
        }),
      },
    });
    const { ecommerceBadReview } = mount([dto()], mutate);
    await screen.findByText("Arrived broken");
    ecommerceBadReview.selectReview("review-1");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText("In follow-up")).toBeNull();
    fireEvent.change(within(dialog).getByLabelText("Note"), { target: { value: "Done" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0]![0].variables).toMatchObject({ reviewId: "review-1", note: "Done" });
    expect(await within(dialog).findByText("By hand", { exact: false })).toBeTruthy();
  });
});
