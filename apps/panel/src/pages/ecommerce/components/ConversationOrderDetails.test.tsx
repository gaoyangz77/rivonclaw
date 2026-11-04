import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import i18n from "../../../i18n/index.js";
import { conversationOrderDetailKey } from "../../../store/models/CustomerServiceWorkspaceModel.js";
import {
  OrderAfterSalesSection,
  OrderLogisticsSection,
  OrderRecipientSection,
} from "./ConversationOrderDetails.js";

afterEach(cleanup);
beforeEach(async () => {
  await i18n.changeLanguage("en");
});

type Workspace = ComponentProps<typeof OrderLogisticsSection>["workspace"];

function workspaceWith(details: Record<string, unknown>): Workspace {
  return {
    orderDetail: (key: string) => details[key] ?? null,
    orderDetailLoading: () => false,
    orderDetailError: () => null,
    fetchSelectedConversationOrderTracking: vi.fn(),
    fetchSelectedConversationOrderPackages: vi.fn(),
    fetchSelectedConversationOrderCancellations: vi.fn(),
    fetchSelectedConversationReturnRecords: vi.fn(),
  } as unknown as Workspace;
}

function trackingFor(orderId: string, events: { description: string; updateTimeMillis: number }[]) {
  return {
    [conversationOrderDetailKey("tracking", "shop-1", orderId)]: {
      shippingProvider: "J&T",
      trackingNumber: "TRK-1",
      events,
    },
  };
}

const EVENTS = [
  { description: "Package picked up", updateTimeMillis: 1_700_000_000_000 },
  { description: "Arrived at the local hub", updateTimeMillis: 1_700_100_000_000 },
  { description: "Out for delivery", updateTimeMillis: 1_700_200_000_000 },
];

function logistics(workspace: Workspace, orderId = "order-1") {
  return (
    <OrderLogisticsSection
      workspace={workspace}
      shopId="shop-1"
      orderId={orderId}
      shippingProvider={null}
      trackingNumbers={[]}
      packageIds={[]}
      copiedMeta={null}
      onCopy={vi.fn()}
    />
  );
}

describe("order logistics section", () => {
  it("is collapsed to the latest event and expands to the full timeline", () => {
    const workspace = workspaceWith(trackingFor("order-1", EVENTS));
    render(logistics(workspace));
    expect(screen.getByText("Out for delivery")).toBeTruthy();
    expect(screen.queryByText("Package picked up")).toBeNull();
    expect(screen.queryByText("Arrived at the local hub")).toBeNull();
    const toggle = screen.getByRole("button", { name: "View tracking (3)" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);
    expect(screen.getByText("Package picked up")).toBeTruthy();
    expect(screen.getByText("Arrived at the local hub")).toBeTruthy();
    expect(screen.getByText("Out for delivery")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Hide tracking" }).getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("collapses again when another order is shown", () => {
    const workspace = workspaceWith({
      ...trackingFor("order-1", EVENTS),
      ...trackingFor("order-2", EVENTS),
    });
    const view = render(logistics(workspace, "order-1"));
    fireEvent.click(screen.getByRole("button", { name: "View tracking (3)" }));
    expect(screen.getByText("Package picked up")).toBeTruthy();
    view.rerender(logistics(workspace, "order-2"));
    expect(screen.queryByText("Package picked up")).toBeNull();
    expect(screen.getByRole("button", { name: "View tracking (3)" })).toBeTruthy();
  });
});

const RETURNS = [
  {
    returnId: "ret-1",
    returnType: "REFUND",
    returnStatus: "RETURN_OR_REFUND_REQUEST_PENDING",
    returnReasonText: "Item arrived damaged",
    refundAmount: { refundTotal: "12.50", currency: "USD" },
    createTime: 1_700_000_000,
    updateTime: 1_700_000_100,
  },
  {
    returnId: "ret-2",
    returnType: "RETURN_AND_REFUND",
    returnStatus: "RETURN_OR_REFUND_REQUEST_COMPLETE",
    returnReasonText: "Changed my mind",
    createTime: 1_690_000_000,
    updateTime: 1_690_000_100,
  },
] as never;

function afterSales(workspace: Workspace, orderId = "order-1") {
  return (
    <OrderAfterSalesSection
      workspace={workspace}
      shopId="shop-1"
      orderId={orderId}
      returns={RETURNS}
      currency="USD"
      locale="en"
    />
  );
}

describe("order after-sales section", () => {
  it("shows one summary line per request and the open count, details on demand", () => {
    const workspace = workspaceWith({
      [conversationOrderDetailKey("cancellations", "shop-1", "order-1")]: { cancellations: [] },
    });
    render(afterSales(workspace));
    expect(screen.getByText("After-sales (2)")).toBeTruthy();
    expect(screen.getByText("1 open")).toBeTruthy();
    expect(screen.getByText("Return/refund pending")).toBeTruthy();
    expect(screen.getByText("Return/refund completed")).toBeTruthy();
    expect(screen.queryByText("Item arrived damaged")).toBeNull();

    const [first] = screen.getAllByRole("button", { expanded: false });
    fireEvent.click(first!);
    expect(screen.getByText("Item arrived damaged")).toBeTruthy();
    expect(screen.queryByText("Changed my mind")).toBeNull();
    expect(screen.getByRole("button", { name: "Negotiation history" })).toBeTruthy();
  });

  it("collapses every request when another order is shown", () => {
    const workspace = workspaceWith({});
    const view = render(afterSales(workspace, "order-1"));
    fireEvent.click(screen.getAllByRole("button", { expanded: false })[0]!);
    expect(screen.getByText("Item arrived damaged")).toBeTruthy();
    view.rerender(afterSales(workspace, "order-2"));
    expect(screen.queryByText("Item arrived damaged")).toBeNull();
  });
});

describe("order recipient section", () => {
  const order = {
    orderId: "order-1",
    lineItems: [],
    recipientAddress: {
      name: "Ada Lovelace",
      city: "London",
      phone: "123",
      fullAddress: "1 Main St",
    },
  } as never;

  function recipient(orderId: string) {
    return (
      <OrderRecipientSection order={order} orderId={orderId} copiedMeta={null} onCopy={vi.fn()} />
    );
  }

  it("shows a one-line summary and reveals the fields on demand, per order", () => {
    const view = render(recipient("order-1"));
    expect(screen.getByText("Ada Lovelace · London")).toBeTruthy();
    expect(screen.queryByText("1 Main St")).toBeNull();
    expect(screen.getByRole("button", { name: /copy all/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Recipient details" }));
    expect(screen.getByText("1 Main St")).toBeTruthy();
    view.rerender(recipient("order-2"));
    expect(screen.queryByText("1 Main St")).toBeNull();
  });
});
