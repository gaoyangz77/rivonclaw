// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { types, type SnapshotIn } from "mobx-state-tree";
import { describe, expect, it, vi } from "vitest";
import { PaymentModel } from "@rivonclaw/core/models";
import { PaymentPendingModal } from "./PaymentPendingModal.js";

const mockState = vi.hoisted(() => ({
  store: null as any,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,mock"),
  },
}));

vi.mock("../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => mockState.store,
}));

type PaymentSnapshot = SnapshotIn<typeof PaymentModel>;

const TestStore = types
  .model("PaymentPendingModalTestStore", {
    activeCheckout: types.maybeNull(PaymentModel),
    checkoutError: types.maybeNull(types.string),
  })
  .actions((self) => ({
    replaceActiveCheckout(payment: PaymentSnapshot | null) {
      self.activeCheckout = payment as any;
    },
    refreshBillingAfterPayment() {
      return Promise.resolve();
    },
    refreshPayment() {
      return Promise.resolve(null);
    },
    setCheckoutError(message: string | null) {
      self.checkoutError = message;
    },
  }));

function paymentSnapshot(overrides: Partial<PaymentSnapshot> = {}): PaymentSnapshot {
  return {
    id: "pay_1",
    userId: "user_1",
    provider: "STRIPE",
    method: "CARD",
    status: "FAILED",
    currency: "CNY",
    amountMinor: 1200,
    billingActivatedAt: null,
    billingPlanId: "ECOM_CS_MONTHLY",
    billingProduct: "ECOM_CUSTOMER_SERVICE",
    billingScopeId: "shop_1",
    billingScopeType: "SHOP",
    subject: "Original checkout",
    description: null,
    merchantOrderId: "order_1",
    providerPaymentId: null,
    providerOrderId: null,
    providerSubscriptionId: null,
    checkoutUrl: "https://pay.example/checkout",
    qrCode: null,
    lastError: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    paidAt: null,
    expiresAt: null,
    lastProviderEventAt: null,
    ...overrides,
  };
}

describe("PaymentPendingModal", () => {
  it("looks up the live active checkout by id after replacement or clear", () => {
    mockState.store = TestStore.create({
      activeCheckout: paymentSnapshot(),
      checkoutError: null,
    });

    const { rerender } = render(
      <PaymentPendingModal
        paymentId="pay_1"
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("Original checkout")).toBeTruthy();

    mockState.store.replaceActiveCheckout(paymentSnapshot({
      subject: "Replacement checkout",
      updatedAt: "2026-01-01T00:01:00.000Z",
      lastProviderEventAt: "2026-01-01T00:01:00.000Z",
    }));
    rerender(
      <PaymentPendingModal
        paymentId="pay_1"
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("Replacement checkout")).toBeTruthy();

    mockState.store.replaceActiveCheckout(null);
    rerender(
      <PaymentPendingModal
        paymentId="pay_1"
        onClose={() => {}}
      />,
    );

    expect(screen.queryByText("Replacement checkout")).toBeNull();
  });
});
