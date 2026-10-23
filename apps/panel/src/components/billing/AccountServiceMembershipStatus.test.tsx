// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applySnapshot } from "mobx-state-tree";
import { observer } from "mobx-react-lite";
import { BillingOverviewModel, RootStoreModel } from "@rivonclaw/core/models";
import { CustomerServiceBillingCta } from "./CustomerServiceBillingCta.js";
import { isAccountServiceEntitlement, entitlementStatusLabel } from "./billing-labels.js";

const state = vi.hoisted(() => ({ store: null as any }));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
vi.mock("../../store/EntityStoreProvider.js", () => ({ useEntityStore: () => state.store }));
afterEach(cleanup);

function entitlement(allowed = true) {
  return {
    scopeType: "SELLER",
    scopeId: "seller-1",
    coverageScopeType: "ACCOUNT",
    coverageScopeId: "user-1",
    product: "ECOM_CUSTOMER_SERVICE",
    allowed,
    code: allowed ? "ALLOWED" : "PAYMENT_REQUIRED",
    source: "SUBSCRIPTION",
    validUntil: "2026-11-23T02:47:40.826Z",
    usage: [],
    subscription: {
      planId: "ECOM_CUSTOMER_SERVICE_ACCOUNT_MONTHLY",
      provider: "MANUAL",
      status: allowed ? "ACTIVE" : "CANCELED",
      currency: "USD",
      amountMinor: 0,
      currentPeriodStart: "2026-10-23T02:47:40.826Z",
      currentPeriodEnd: "2026-11-23T02:47:40.826Z",
      renewalMode: "PREPAID",
      cancelAtPeriodEnd: true,
    },
  };
}
function overview(allowed = true) {
  return {
    accountLlm: {
      entitlement: {
        scopeType: "ACCOUNT",
        scopeId: "user-1",
        product: "LLM_USAGE",
        allowed: false,
        code: "PAYMENT_REQUIRED",
        usage: [],
      },
    },
    accountServices: [{ product: "ECOM_CUSTOMER_SERVICE", entitlement: entitlement(allowed) }],
    shops: [],
  };
}
const Harness = observer(() => (
  <CustomerServiceBillingCta
    shopId="shop-1"
    shopNameSensitive={false}
    entitlement={state.store.billingOverview.accountServices[0].entitlement}
  />
));

describe("account service membership presentation", () => {
  it("has no online purchase, cancel, free label or placeholder price and updates after snapshot replacement", () => {
    state.store = RootStoreModel.create({ billingOverview: overview() });
    render(<Harness />);
    expect(screen.getByText("billing.accountCoverage")).toBeTruthy();
    expect(screen.getByText("billing.offlineSettlement")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/\$0|0\.00|limitedTimeFree|cancelAtPeriodEnd/);
    act(() => applySnapshot(state.store.billingOverview, overview(false)));
    expect(screen.getByText("billing.contactAdminRenewal")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    act(() => applySnapshot(state.store.billingOverview, overview(true)));
    expect(screen.getByText("billing.accountCoverage")).toBeTruthy();
  });

  it("accepts old snapshots without account services and coverage fields", () => {
    const old = overview();
    const { accountServices: _accountServices, ...legacy } = old;
    const model = BillingOverviewModel.create(legacy);
    expect(model.accountServices.length).toBe(0);
    expect(model.accountLlm.entitlement.coverageScopeType).toBeNull();
  });

  it("distinguishes account service coverage from LLM and ordinary seller trials", () => {
    state.store = RootStoreModel.create({ billingOverview: overview() });
    const value = state.store.billingOverview.accountServices[0].entitlement;
    expect(isAccountServiceEntitlement(value)).toBe(true);
    expect(entitlementStatusLabel(((key: string) => key) as any, value)).toBe(
      "billing.accountCoverage",
    );
    expect(isAccountServiceEntitlement(state.store.billingOverview.accountLlm.entitlement)).toBe(
      false,
    );
  });
});
