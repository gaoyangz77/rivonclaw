import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import { GQL } from "@rivonclaw/core";
import i18n from "../../../i18n/index.js";
import { ToastProvider } from "../../../components/Toast.js";
import { AFFILIATE_WORKBENCH_PENDING_CONVERSATION_PAGE_QUERY as query } from "../../../api/shops-queries.js";
import { AffiliateWorkbenchEntityTabs } from "./AffiliateWorkbenchEntityTabs.js";

beforeEach(async () => {
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);
const State = GQL.AffiliateChannelConversationStatus;
const baseInput = {
  shopId: null,
  businessDeveloperId: null,
  protected: null,
  sortOrder: "ASC",
  limit: 25,
  channel: null,
  cursor: null,
};
function row(id: string, conversationStatus: GQL.AffiliateChannelConversationStatus) {
  return {
    id,
    conversationStatus,
    creatorRelationshipId: id,
    channel: "EMAIL",
    lastPendingAt: "2026-09-01T00:00:00Z",
    sourceLabel: "Email",
    sourceShopId: null,
    replyToLifecycleEventId: `event-${id}`,
    hasPendingAgentProposal: false,
    creatorName: id,
    creatorUsername: id,
    creatorAvatarUrl: null,
    shopName: null,
    businessDeveloperName: null,
    protected: false,
    humanOnly: false,
    sampleTier: null,
    systemTags: [],
    manualTags: [],
    proposal: null,
  };
}
function mock(
  input: object,
  items: ReturnType<typeof row>[],
  cursor: string | null = null,
  delay = 0,
) {
  const result = vi.fn(() => ({
    data: {
      affiliateWorkbenchPendingConversationPage: {
        items,
        hasMore: Boolean(cursor),
        nextCursor: cursor,
        totalCount: items.length,
        platformCount: 0,
        whatsappCount: 0,
        emailCount: items.length,
        waitingOver24hCount: 0,
      },
    },
  }));
  return { request: { query, variables: { input: { ...baseInput, ...input } } }, result, delay };
}
function renderMessages(mocks: ReturnType<typeof mock>[], onOpen = vi.fn()) {
  render(
    <MockedProvider mocks={mocks}>
      <ToastProvider>
        <AffiliateWorkbenchEntityTabs
          tab="MESSAGES"
          selectedShopIds={null}
          shops={[]}
          onSelectShops={vi.fn()}
          businessDeveloperOptions={[]}
          selectedBusinessDeveloperId=""
          onSelectBusinessDeveloper={vi.fn()}
          refreshRevision={0}
          onOpen={onOpen}
        />
      </ToastProvider>
    </MockedProvider>,
  );
  return onOpen;
}
function selectStatus(label: string) {
  fireEvent.click(screen.getByRole("button", { name: "状态" }));
  const options = document.querySelectorAll(".custom-select-option");
  fireEvent.click(Array.from(options).find((option) => option.textContent?.trim() === label)!);
}

it("defaults to pending and offers handled/all views, message timestamps and safe history navigation", async () => {
  const pending = mock({}, [row("pending-creator", State.Pending)]);
  const handled = mock({ statusFilter: "RESOLVED" }, [row("handled-creator", State.Resolved)]);
  const all = mock({ statusFilter: "ALL" }, [
    row("pending-all", State.Pending),
    row("unactionable-all", State.Unactionable),
  ]);
  const open = renderMessages([pending, handled, all]);
  await waitFor(() => expect(pending.result).toHaveBeenCalledOnce());
  expect(screen.getByRole("columnheader", { name: "已等待" })).toBeTruthy();
  selectStatus("已处理");
  await waitFor(() => expect(handled.result).toHaveBeenCalledOnce());
  expect(screen.getByRole("columnheader", { name: "消息时间" })).toBeTruthy();
  expect(screen.queryByText("pending-creator")).toBeNull();
  expect(document.querySelector(".affiliate-workbench-cell-waiting")).toBeNull();
  fireEvent.click(screen.getByText("handled-creator"));
  expect(open).toHaveBeenCalledWith(
    expect.objectContaining({
      creatorRelationshipId: "handled-creator",
      replyToLifecycleEventId: undefined,
      hasPendingProposal: false,
    }),
  );
  selectStatus("全部");
  await waitFor(() => expect(all.result).toHaveBeenCalledOnce());
  expect(screen.getByText("不可处理")).toBeTruthy();
  fireEvent.click(screen.getByText("pending-all"));
  expect(open).toHaveBeenLastCalledWith(
    expect.objectContaining({ replyToLifecycleEventId: "event-pending-all" }),
  );
});

it("keeps the chosen status on pagination and discards a late page after switching status", async () => {
  const pending = mock({}, []);
  const handled = mock(
    { statusFilter: "RESOLVED" },
    [row("handled-first", State.Resolved)],
    "handled-cursor",
  );
  const more = mock(
    { statusFilter: "RESOLVED", cursor: "handled-cursor" },
    [row("handled-late", State.Resolved)],
    null,
    120,
  );
  const all = mock({ statusFilter: "ALL" }, [row("all-current", State.Unactionable)]);
  renderMessages([pending, handled, more, all]);
  await waitFor(() => expect(pending.result).toHaveBeenCalledOnce());
  selectStatus("已处理");
  await waitFor(() => expect(handled.result).toHaveBeenCalledOnce());
  fireEvent.click(
    screen.getByRole("button", { name: i18n.t("ecommerce.affiliateWorkspace.loadMoreProposals") }),
  );
  selectStatus("全部");
  await waitFor(() => expect(all.result).toHaveBeenCalledOnce());
  await waitFor(() => expect(more.result).toHaveBeenCalledOnce());
  expect(screen.getByText("all-current")).toBeTruthy();
  expect(screen.queryByText("handled-late")).toBeNull();
  expect(screen.queryByText("handled-first")).toBeNull();
});
