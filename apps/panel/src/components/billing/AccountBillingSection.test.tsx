// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { applyPatch, types, type IJsonPatch, type SnapshotIn } from "mobx-state-tree";
import { describe, expect, it, vi } from "vitest";
import { PaymentModel, RootStoreModel } from "@rivonclaw/core/models";
import { AccountBillingSection } from "./AccountBillingSection.js";

/**
 * Payment history reaches the Panel incrementally: Desktop ingests the
 * `readPayments` response into its own MST store and the Panel receives the
 * resulting `entity-patch` frames, which `connectEntityStore` applies with
 * `applyPatch`. On the first visit to the billing page the Panel's `payments`
 * array is still empty when the section mounts, so the rows only ever exist as
 * those patches - a full reload, which replays a snapshot that already holds
 * them, never exercises this path. These tests pin the incremental path.
 */

const mockState = vi.hoisted(() => ({
  store: null as any,
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

vi.mock("../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => mockState.store,
}));

type PaymentSnapshot = SnapshotIn<typeof PaymentModel>;

/** The core root store plus the checkout state the billing section reads. */
const TestStore = RootStoreModel.props({
  activeCheckout: types.maybeNull(PaymentModel),
  checkoutScopeId: types.maybeNull(types.string),
  paymentInFlight: types.optional(types.boolean, false),
  checkoutError: types.maybeNull(types.string),
  checkoutNotice: types.maybeNull(types.string),
}).actions(() => ({
  clearActiveCheckout() {},
  cancelBillingSubscriptionAtPeriodEnd() {
    return Promise.resolve();
  },
  createStripeBillingPortalSession() {
    return Promise.resolve(null);
  },
}));

/** A payment exactly as Desktop's `onPatch` serializes it: every nullable field present as null. */
function payment(id: string, subject: string, overrides: Partial<PaymentSnapshot> = {}): PaymentSnapshot {
  return {
    id,
    userId: "user_1",
    provider: "STRIPE",
    method: "CARD",
    status: "SUCCEEDED",
    currency: "USD",
    amountMinor: 2900,
    billingActivatedAt: null,
    billingPlanId: "LLM_PRO_MONTHLY",
    billingProduct: "LLM_USAGE",
    billingScopeId: "user_1",
    billingScopeType: "ACCOUNT",
    subject,
    description: null,
    merchantOrderId: `order_${id}`,
    providerPaymentId: null,
    providerOrderId: null,
    providerSubscriptionId: null,
    checkoutUrl: null,
    qrCode: null,
    lastError: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    paidAt: "2026-08-01T00:00:00.000Z",
    expiresAt: null,
    lastProviderEventAt: null,
    ...overrides,
  };
}

/** The frame Desktop broadcasts after `applySnapshot(rootStore.payments, list)` on an empty array. */
function addPatches(payments: PaymentSnapshot[]): IJsonPatch[] {
  return payments.map((value, index) => ({ op: "add", path: `/payments/${index}`, value }));
}

function renderSection() {
  mockState.store = TestStore.create({});
  render(<AccountBillingSection />);
  return mockState.store;
}

describe("AccountBillingSection payment records", () => {
  it("renders payments that arrive as entity-patch adds after the section mounted", () => {
    const store = renderSection();
    expect(screen.getByText("billing.noCompletedPayments")).toBeTruthy();

    act(() => {
      applyPatch(
        store,
        addPatches([
          payment("pay_1", "AI Pro — August"),
          payment("pay_2", "Customer Service — Brightloom"),
          payment("pay_3", "AI Pro — September"),
        ]),
      );
    });

    // The store side of the pipeline is not in question - the frames land.
    expect(store.payments.length).toBe(3);
    // The table must follow the store without any unrelated re-render.
    expect(screen.queryByText("billing.noCompletedPayments")).toBeNull();
    expect(screen.getByText("AI Pro — August")).toBeTruthy();
    expect(screen.getByText("Customer Service — Brightloom")).toBeTruthy();
    expect(screen.getByText("AI Pro — September")).toBeTruthy();
  });

  it("shows a payment once a field-level patch moves it from pending to succeeded", () => {
    const store = renderSection();
    act(() => {
      applyPatch(store, addPatches([payment("pay_1", "Awaiting card", { status: "PENDING", paidAt: null })]));
    });
    // A pending payment is not a completed record and must stay out of the table.
    expect(screen.getByText("billing.noCompletedPayments")).toBeTruthy();

    act(() => {
      applyPatch(store, [
        { op: "replace", path: "/payments/0/status", value: "SUCCEEDED" },
        { op: "replace", path: "/payments/0/paidAt", value: "2026-08-02T00:00:00.000Z" },
      ]);
    });

    expect(screen.queryByText("billing.noCompletedPayments")).toBeNull();
    expect(screen.getByText("Awaiting card")).toBeTruthy();
  });
});
