// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { CustomerServiceConversationRow } from "./CustomerServiceConversationRow.js";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const ESCALATION_BADGE = "ecommerce.customerServiceWorkspace.escalationBadge";
const BAD_REVIEW_BADGE = "ecommerce.customerServiceWorkspace.badReviewBadge";
const STATUS_PENDING = "ecommerce.customerServiceWorkspace.conversationStatusPending";

/**
 * jsdom does not lay out, so the guard is the CSS contract that the layout
 * depends on: `.cs-conversation-row-head` wraps and `.cs-conversation-badges`
 * yields (shrinks and wraps) instead of the buyer name. Load the real
 * stylesheet so the assertions track the file the Panel ships, not a copy.
 */
const WORKSPACE_STYLESHEET = readFileSync(
  resolve(process.cwd(), "src/pages/ecommerce/CustomerServiceWorkspace.css"),
  "utf8",
);

let styleElement: HTMLStyleElement;

beforeAll(() => {
  styleElement = document.createElement("style");
  styleElement.textContent = WORKSPACE_STYLESHEET;
  document.head.append(styleElement);
});

afterAll(() => {
  styleElement.remove();
});

afterEach(cleanup);

function conversation(
  overrides: Partial<GQL.CustomerServiceConversationInboxItem> = {},
): GQL.CustomerServiceConversationInboxItem {
  return {
    aiEnabled: true,
    conversationId: "conversation-1",
    shopId: "shop-1",
    isOpen: true,
    openEscalationCount: 0,
    status: GQL.CustomerServiceConversationStatus.Pending,
    buyerNickname: "Alexandra Featherstonehaugh-Worthington",
    latestMessagePreview: "Where is my order?",
    ...overrides,
  };
}

function conversationWithThreeBadges(): GQL.CustomerServiceConversationInboxItem {
  return conversation({
    openEscalationCount: 2,
    recentBadReviews: [
      { reviewId: "review-1" } as unknown as GQL.CustomerServiceProductReviewSummary,
    ],
  });
}

function renderRow(
  item: GQL.CustomerServiceConversationInboxItem,
  handlers: { onSelect?: () => void; onOpenBadReviews?: () => void } = {},
) {
  return render(
    <CustomerServiceConversationRow
      item={item}
      active={false}
      buyerName={item.buyerNickname ?? item.conversationId}
      shopLabel={{ text: "Holylegend", sensitive: true }}
      timeLabel="Sep 5, 10:15"
      onSelect={handlers.onSelect ?? (() => {})}
      onOpenBadReviews={handlers.onOpenBadReviews ?? (() => {})}
    />,
  );
}

describe("CustomerServiceConversationRow", () => {
  it("keeps the buyer name legible beside escalation, bad review and status badges", () => {
    const item = conversationWithThreeBadges();
    const { container } = renderRow(item);

    const head = container.querySelector<HTMLElement>(".cs-conversation-row-head");
    const name = head?.querySelector<HTMLElement>("strong");
    const badges = head?.querySelector<HTMLElement>(".cs-conversation-badges");
    expect(head).not.toBeNull();
    expect(name).not.toBeNull();
    expect(badges).not.toBeNull();

    // All three badges are on the row at once - the case that used to squeeze the name.
    expect(badges?.querySelectorAll(".badge")).toHaveLength(3);
    expect(screen.getByText(ESCALATION_BADGE).classList.contains("cs-open-escalation-badge")).toBe(
      true,
    );
    expect(screen.getByText(BAD_REVIEW_BADGE).classList.contains("cs-bad-review-badge")).toBe(true);
    expect(screen.getByText(STATUS_PENDING).classList.contains("badge-warning")).toBe(true);

    // The name renders in full and keeps a tooltip for the day it does truncate.
    expect(name?.textContent).toBe(item.buyerNickname);
    expect(name?.getAttribute("title")).toBe(item.buyerNickname);
    expect(getComputedStyle(name as HTMLElement).textOverflow).toBe("ellipsis");

    // The head wraps, so a badge group that does not fit drops beneath the
    // name instead of taking the name's width.
    expect(getComputedStyle(head as HTMLElement).display).toBe("flex");
    expect(getComputedStyle(head as HTMLElement).flexWrap).toBe("wrap");

    // The badge group is the part that yields: it may shrink (the original bug
    // was `flex: 0 0 auto`, which pinned it) and wraps its badges internally.
    const badgeStyle = getComputedStyle(badges as HTMLElement);
    expect(badgeStyle.display).toBe("flex");
    expect(badgeStyle.flexWrap).toBe("wrap");
    expect(badgeStyle.flexShrink).not.toBe("0");
  });

  it("renders only the status badge when the conversation has no escalation or bad review", () => {
    const { container } = renderRow(conversation());

    const badges = container.querySelector(".cs-conversation-badges");
    expect(badges?.querySelectorAll(".badge")).toHaveLength(1);
    expect(screen.queryByText(ESCALATION_BADGE)).toBeNull();
    expect(screen.queryByText(BAD_REVIEW_BADGE)).toBeNull();
    expect(screen.getByText(STATUS_PENDING)).not.toBeNull();
  });

  it("selects the conversation on click, but opens bad reviews without selecting", () => {
    const onSelect = vi.fn();
    const onOpenBadReviews = vi.fn();
    renderRow(conversationWithThreeBadges(), { onSelect, onOpenBadReviews });

    fireEvent.click(screen.getByText(STATUS_PENDING));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onOpenBadReviews).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText(BAD_REVIEW_BADGE));
    expect(onOpenBadReviews).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
