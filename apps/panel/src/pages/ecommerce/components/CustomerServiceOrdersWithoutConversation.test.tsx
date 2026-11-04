// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CustomerServiceOrdersWithoutConversation,
  type OrderWithoutConversationRow,
} from "./CustomerServiceOrdersWithoutConversation.js";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../../components/design-system/index.js", () => ({
  TkPrivate: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

afterEach(cleanup);

const START = "ecommerce.customerServiceWorkspace.startConversation";

function row(overrides: Partial<OrderWithoutConversationRow> = {}): OrderWithoutConversationRow {
  return {
    shopId: "shop-1",
    orderId: "order-9",
    shop: { text: "Shop One", sensitive: false },
    statusLabel: "Awaiting Shipment",
    createdLabel: "Nov 4, 10:00",
    amountLabel: "$12.50",
    pending: false,
    error: null,
    ...overrides,
  } as OrderWithoutConversationRow;
}

describe("CustomerServiceOrdersWithoutConversation", () => {
  it("renders nothing without orders", () => {
    const { container } = render(
      <CustomerServiceOrdersWithoutConversation rows={[]} onStart={vi.fn()} />,
    );
    expect(container.childElementCount).toBe(0);
  });

  it("shows the order details and starts the conversation for that order", () => {
    const onStart = vi.fn();
    render(<CustomerServiceOrdersWithoutConversation rows={[row()]} onStart={onStart} />);
    expect(screen.getByText("order-9")).toBeTruthy();
    expect(screen.getByText("Shop One")).toBeTruthy();
    expect(screen.getByText("Awaiting Shipment · Nov 4, 10:00 · $12.50")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: START }));
    expect(onStart).toHaveBeenCalledWith("shop-1", "order-9");
  });

  it("disables the button while pending and shows the error", () => {
    render(
      <CustomerServiceOrdersWithoutConversation
        rows={[row({ pending: true, error: "CS_ORDER_NOT_FOUND" })]}
        onStart={vi.fn()}
      />,
    );
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe("CS_ORDER_NOT_FOUND");
  });
});
