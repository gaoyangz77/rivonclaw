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
const focusConversationOrder = vi.fn();
const openedRoutes: string[] = [];
const recordRoute = (event: Event) => openedRoutes.push((event as CustomEvent<{ path: string }>).detail.path);
const CONVERSATIONS = "/commerce/customer-service/conversations";

function mount(items: GQL.EcomBadReview[], mutate = vi.fn(), totalCount = items.length) {
  const query = vi.fn().mockResolvedValue({ data: { page: { items, totalCount } } });
  const ecommerceBadReview = EcommerceBadReviewModel.create({}, { apolloClient: { query, mutate } });
  mocks.store = {
    currentUser: { userId: "user-1" },
    shops: [{ id: "shop-1", shopName: "Shop One", alias: null, region: "US" }],
    ecommerceBadReview,
    customerServiceWorkspace: { focusConversationOrder },
  };
  // Rendered as App renders it: with no props.
  render(<BadReviewManagementPage />);
  return { ecommerceBadReview, mutate, query };
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  vi.clearAllMocks();
  openedRoutes.length = 0;
  window.addEventListener("rivonclaw:open-route", recordRoute);
});
afterEach(() => {
  window.removeEventListener("rivonclaw:open-route", recordRoute);
  cleanup();
});

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
    mount([dto()], mutate);
    fireEvent.click(await screen.findByRole("button", { name: "Start follow-up" }));
    await waitFor(() => expect(openedRoutes).toEqual([CONVERSATIONS]));
    expect(focusConversationOrder).toHaveBeenCalledWith("576000000000000001");
    expect(await screen.findByText("In follow-up")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start follow-up" })).toBeNull();
  });

  it("searches a pasted column of order numbers on Enter, and lists everything again when the box is emptied", async () => {
    const { query } = mount([dto()]);
    const box = await screen.findByLabelText("Order number");
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1));
    fireEvent.paste(box, {
      clipboardData: { getData: () => "576000000000000001\r\n576000000000000002\r\n" },
    });
    // Typing alone does not search.
    expect(query).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2));
    expect(query.mock.calls[1]![0].variables.input.orderIds).toEqual([
      "576000000000000001",
      "576000000000000002",
    ]);
    fireEvent.change(box, { target: { value: "" } });
    await waitFor(() => expect(query).toHaveBeenCalledTimes(3));
    expect(query.mock.calls[2]![0].variables.input.orderIds).toBeUndefined();
  });

  it("stays on the page and shows TikTok's refusal", async () => {
    const mutate = vi.fn().mockRejectedValue(new Error("TikTok refused the conversation"));
    mount([dto()], mutate);
    fireEvent.click(await screen.findByRole("button", { name: "Start follow-up" }));
    expect(await screen.findByText("TikTok refused the conversation")).toBeTruthy();
    expect(openedRoutes).toEqual([]);
    expect(focusConversationOrder).not.toHaveBeenCalled();
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

  it("opens the conversation through the order search, calling nothing that writes", async () => {
    const { mutate } = mount([dto()]);
    fireEvent.click(await screen.findByRole("button", { name: "Open conversation" }));
    expect(openedRoutes).toEqual([CONVERSATIONS]);
    expect(focusConversationOrder).toHaveBeenCalledWith("576000000000000001");
    expect(mutate).not.toHaveBeenCalled();
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

  it("shows that a review in follow-up needs a reply", async () => {
    mount([
      dto({
        handlingStatus: GQL.ProductReviewHandlingStatus.InProgress,
        replyState: GQL.ProductReviewReplyState.AwaitingSeller,
      }),
    ]);
    expect(await screen.findByText("Needs a reply")).toBeTruthy();
  });

  describe("bulk start follow-up", () => {
    const preview: GQL.EcomBadReviewBulkPreview = {
      reviews: 3,
      buyers: 2,
      skippedUnavailable: 1,
      skippedNoBuyer: 0,
      skippedNotManual: 0,
      languages: [
        { language: GQL.BadReviewMessageLanguage.En, buyers: 1 },
        { language: GQL.BadReviewMessageLanguage.De, buyers: 1 },
      ],
    };
    const translated = [
      { language: GQL.BadReviewMessageLanguage.En, text: "Sorry" },
      { language: GQL.BadReviewMessageLanguage.De, text: "Es tut uns leid" },
    ];
    const open = async (mutate: ReturnType<typeof vi.fn>, shown = preview) => {
      const query = vi.fn(async ({ variables }: { variables: { reviewIds?: string[] } }) =>
        variables.reviewIds
          ? { data: { preview: shown } }
          : { data: { page: { items: [dto(), dto({ id: "review-2", orderId: "576000000000000002" })], totalCount: 2 } } },
      );
      const ecommerceBadReview = EcommerceBadReviewModel.create({}, { apolloClient: { query, mutate } });
      mocks.store = {
        currentUser: { userId: "user-1" },
        shops: [],
        ecommerceBadReview,
        customerServiceWorkspace: {},
      };
      render(<BadReviewManagementPage />);
      fireEvent.click(await screen.findByRole("checkbox", { name: "Select all on this page" }));
      fireEvent.click(await screen.findByRole("button", { name: "Bulk start follow-up (2)" }));
      return { dialog: await screen.findByRole("dialog"), query };
    };

    it("needs at least one ticked row", async () => {
      mount([dto()]);
      const button = (await screen.findByRole("button", { name: "Bulk start follow-up (0)" })) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      fireEvent.click(await screen.findByRole("checkbox", { name: "Select order 576000000000000001" }));
      expect(((await screen.findByRole("button", { name: "Bulk start follow-up (1)" })) as HTMLButtonElement).disabled).toBe(false);
    });

    it("names a language whose code is not a browser language tag", async () => {
      const { dialog } = await open(vi.fn(), {
        ...preview,
        languages: [{ language: GQL.BadReviewMessageLanguage.ZhHant, buyers: 2 }],
      });
      expect(await within(dialog).findByText(/Traditional Chinese/)).toBeTruthy();
    });

    it("can tick a review already in follow-up, to write again", async () => {
      mount([dto({ handlingStatus: GQL.ProductReviewHandlingStatus.InProgress })]);
      expect(await screen.findByRole("checkbox", { name: "Select order 576000000000000001" })).toBeTruthy();
    });

    it("has no tick box for a closed review", async () => {
      mount([dto({ handlingStatus: GQL.ProductReviewHandlingStatus.Closed })]);
      await screen.findByText("Arrived broken");
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    });

    it("sends the ticked reviews, and nothing until the translated messages are confirmed", async () => {
      const mutate = vi.fn(async (options: { variables: { message?: string } }) =>
        options.variables.message
          ? { data: { messages: translated } }
          : {
              data: {
                batch: {
                  id: "batch-1", total: 2, waiting: 2, sent: 0, failed: 0, skipped: 0,
                  finished: false, problems: [],
                },
              },
            },
      );
      const { dialog, query } = await open(mutate);
      expect(await within(dialog).findByText(/one message to 2 buyers, covering 3 reviews/)).toBeTruthy();
      expect(within(dialog).getByText(/1 chosen reviews that cannot take a message/)).toBeTruthy();
      expect(query.mock.calls.at(-1)![0].variables).toEqual({ reviewIds: ["review-1", "review-2"] });
      const action = within(dialog).getByRole("button", { name: "Translate and send" }) as HTMLButtonElement;
      expect(action.disabled).toBe(true);

      fireEvent.change(within(dialog).getByLabelText("Message"), { target: { value: "Sorry" } });
      fireEvent.click(action);
      expect(await screen.findByText("Send this message?")).toBeTruthy();
      expect(mutate).toHaveBeenCalledTimes(1);

      const confirm = (await screen.findAllByRole("button", { name: "Send to 2 buyers" })).at(-1)!;
      fireEvent.click(confirm);
      await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
      expect(mutate.mock.calls[1]![0].variables).toMatchObject({
        reviewIds: ["review-1", "review-2"],
        messages: translated,
      });
      expect(await screen.findByText("Sending: 0 of 2 finished.")).toBeTruthy();
    });

    it("lets the seller back out of the confirmation and edit a translation", async () => {
      const mutate = vi.fn().mockResolvedValue({ data: { messages: translated } });
      const { dialog } = await open(mutate);
      await within(dialog).findByText(/one message to 2 buyers/);
      fireEvent.change(within(dialog).getByLabelText("Message"), { target: { value: "Sorry" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Translate and send" }));
      await screen.findByText("Send this message?");
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      const german = await within(dialog).findByDisplayValue("Es tut uns leid");
      fireEvent.change(german, { target: { value: "" } });
      expect(
        (within(dialog).getByRole("button", { name: "Send to 2 buyers" }) as HTMLButtonElement).disabled,
      ).toBe(true);
      expect(mutate).toHaveBeenCalledTimes(1);
    });

    it("translates again after the message changes", async () => {
      const mutate = vi.fn().mockResolvedValue({ data: { messages: translated } });
      const { dialog } = await open(mutate);
      await within(dialog).findByText(/one message to 2 buyers/);
      const message = within(dialog).getByLabelText("Message");
      fireEvent.change(message, { target: { value: "Sorry" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Translate and send" }));
      await screen.findByText("Send this message?");
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      fireEvent.change(message, { target: { value: "Sorry again" } });
      expect(within(dialog).getByRole("button", { name: "Translate and send" })).toBeTruthy();
      expect(within(dialog).queryByDisplayValue("Es tut uns leid")).toBeNull();
    });
  });

  it("shows no reply state outside follow-up", async () => {
    mount([dto({ replyState: GQL.ProductReviewReplyState.AwaitingSeller })]);
    await screen.findByText("Arrived broken");
    expect(screen.queryByText("Needs a reply")).toBeNull();
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
