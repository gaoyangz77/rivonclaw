import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n/index.js";
import { ConversationOrderList } from "./ConversationOrderList.js";

afterEach(cleanup);
beforeEach(async () => {
  await i18n.changeLanguage("en");
});

function props() {
  return {
    orderIds: ["577123456789012345", "577000000000000001"],
    expandedOrderId: "577123456789012345",
    loadingIds: false,
    idsError: null,
    loadingDetail: false,
    detailError: null,
    onToggle: vi.fn(),
    onRetryIds: vi.fn(),
    onRefresh: vi.fn(),
    children: <div>Latest order details</div>,
  };
}

describe("conversation order accordion", () => {
  it("shows full IDs, expands only the selected order, and requests a toggle for older orders", () => {
    const input = props();
    const view = render(<ConversationOrderList {...input} />);
    expect(screen.getByText("Orders · 2")).toBeTruthy();
    const latest = screen.getByRole("button", { name: input.orderIds[0] });
    const older = screen.getByRole("button", { name: input.orderIds[1] });
    expect(latest.getAttribute("aria-expanded")).toBe("true");
    expect(older.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(older.getAttribute("aria-controls")!)?.hidden).toBe(true);
    fireEvent.click(older);
    expect(input.onToggle).toHaveBeenCalledWith(input.orderIds[1]);
    view.rerender(
      <ConversationOrderList {...input} expandedOrderId={input.orderIds[1]}>
        Older order details
      </ConversationOrderList>,
    );
    expect(screen.queryByText("Latest order details")).toBeNull();
    expect(screen.getByText("Older order details")).toBeTruthy();
  });

  it("shows loading and retry states without hiding the order IDs", () => {
    const input = props();
    const view = render(<ConversationOrderList {...input} loadingDetail children={null} />);
    expect(screen.getByRole("status")).toBeTruthy();
    view.rerender(<ConversationOrderList {...input} detailError="failed" children={null} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(input.onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: input.orderIds[1] })).toBeTruthy();
  });

  it("supports retrying an ID lookup failure and an empty order list", () => {
    const input = props();
    const view = render(<ConversationOrderList {...input} orderIds={[]} idsError="failed" />);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(input.onRetryIds).toHaveBeenCalledTimes(1);
    view.rerender(<ConversationOrderList {...input} orderIds={[]} />);
    expect(screen.getByText("No orders found.")).toBeTruthy();
  });

  it("renders Chinese labels", async () => {
    await i18n.changeLanguage("zh");
    render(<ConversationOrderList {...props()} />);
    expect(screen.getByText("订单 · 2")).toBeTruthy();
  });
});
