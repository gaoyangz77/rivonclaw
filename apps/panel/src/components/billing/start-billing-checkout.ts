import { GQL } from "@rivonclaw/core";
import type { TFunction } from "i18next";
import type { CheckoutProvider } from "./billing-labels.js";

interface BillingCheckoutStore {
  startBillingSubscription(input: {
    planId: string;
    scopeType: string;
    scopeId: string;
    provider: string;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<{
    action?: string | null;
    payment?: {
      checkoutUrl?: string | null;
      qrCode?: string | null;
    } | null;
  } | null | undefined>;
  setCheckoutError(message: string | null, scopeId?: string | null): void;
}

export async function startBillingCheckout({
  entityStore,
  t,
  planId,
  scopeType,
  scopeId,
  provider,
}: {
  entityStore: BillingCheckoutStore;
  t: TFunction;
  planId: string;
  scopeType: string;
  scopeId: string;
  provider: CheckoutProvider;
}) {
  const origin = window.location.origin;
  const result = await entityStore.startBillingSubscription({
    planId,
    scopeType,
    scopeId,
    provider,
    ...(provider === "STRIPE"
      ? {
          successUrl: `${origin}/billing/checkout/success`,
          cancelUrl: `${origin}/billing/checkout/cancel`,
        }
      : {}),
  });
  if (result?.action !== GQL.BillingSubscriptionStartAction.CheckoutCreated) return result;
  const payment = result.payment;
  if (provider === "STRIPE" && payment?.checkoutUrl) {
    window.open(payment.checkoutUrl, "_blank", "noopener,noreferrer");
  } else if (provider === "STRIPE") {
    entityStore.setCheckoutError(t("billing.errors.missingCheckoutUrl"), scopeId);
  } else if (provider === "LAKALA" && !payment?.qrCode) {
    entityStore.setCheckoutError(t("billing.errors.missingQrCode"), scopeId);
  }
  return result;
}

export async function resumeBillingSubscription({
  entityStore,
  t,
  planId,
  scopeType,
  scopeId,
}: {
  entityStore: BillingCheckoutStore;
  t: TFunction;
  planId: string;
  scopeType: string;
  scopeId: string;
}) {
  return startBillingCheckout({
    entityStore,
    t,
    planId,
    scopeType,
    scopeId,
    provider: "STRIPE",
  });
}
