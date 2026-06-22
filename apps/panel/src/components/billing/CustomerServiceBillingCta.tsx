import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { GQL } from "@rivonclaw/core";
import type { BillingEntitlementStatus, BillingPlanDefinition } from "@rivonclaw/core/models";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { BillingIcon, CloseIcon } from "../icons.js";
import { ConfirmDialog } from "../modals/ConfirmDialog.js";
import { ShopServiceCheckoutModal } from "./ShopServiceCheckoutModal.js";
import {
  billingEnumLabel,
  billingPlanDisplayName,
  checkoutProviderFromBillingProvider,
  customerServicePlan,
  entitlementStatusLabel,
  shouldShowRenewalReminder,
} from "./billing-labels.js";

interface CustomerServiceBillingCtaProps {
  shopId: string;
  shopName?: string | null;
  entitlement: BillingEntitlementStatus | null;
  variant?: "card" | "inline";
}

function formatDateTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function formatMoneyFromMajor(value: string | null | undefined, currency: string): string {
  if (!value) return "-";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${currency} ${value}`;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
  }).format(amount);
}

function planPriceLine(plan: BillingPlanDefinition | null, monthLabel: string): string {
  if (!plan) return "-";
  return `${formatMoneyFromMajor(plan.priceMonthly, plan.priceCurrency)}/${monthLabel}`;
}

export const CustomerServiceBillingCta = observer(function CustomerServiceBillingCta({
  shopId,
  shopName,
  entitlement,
  variant = "card",
}: CustomerServiceBillingCtaProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const plan = customerServicePlan(entityStore.billingPlanDefinitions);
  const allowed = entitlement?.allowed ?? false;
  const monthLabel = t("subscription.month");
  const subscription = entitlement?.subscription ?? null;
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [prepaidCheckout, setPrepaidCheckout] = useState(false);
  const [portalPending, setPortalPending] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const showRenewalReminder = shouldShowRenewalReminder(entitlement);
  const canResumeSubscription = !!subscription
    && subscription.renewalMode !== GQL.BillingRenewalMode.Prepaid
    && (subscription.cancelAtPeriodEnd || subscription.renewalMode === GQL.BillingRenewalMode.NonRenewing);
  const canCancelSubscription = !!subscription
    && subscription.renewalMode === GQL.BillingRenewalMode.AutoRenews
    && !subscription.cancelAtPeriodEnd;
  const canManagePaymentMethod = canCancelSubscription;
  const canExtendPrepaid = !!subscription
    && subscription.renewalMode === GQL.BillingRenewalMode.Prepaid;
  const isEndingAtPeriodEnd = !!subscription
    && (subscription.cancelAtPeriodEnd || subscription.renewalMode === GQL.BillingRenewalMode.NonRenewing);

  useEffect(() => {
    entityStore.refreshPlanDefinitions().catch(() => {});
  }, [entityStore]);

  async function confirmCancelSubscription() {
    if (!entitlement) return;
    await entityStore.cancelBillingSubscriptionAtPeriodEnd({
      product: entitlement.product,
      scopeType: entitlement.scopeType,
      scopeId: entitlement.scopeId,
    });
    setCancelConfirmOpen(false);
  }

  async function managePaymentMethod() {
    if (!entitlement) return;
    setPortalPending(true);
    setPortalError(null);
    try {
      const url = await entityStore.createStripeBillingPortalSession({
        product: entitlement.product,
        scopeType: entitlement.scopeType,
        scopeId: entitlement.scopeId,
      });
      if (!url) throw new Error(t("billing.errors.missingBillingPortalUrl"));
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : String(err));
    } finally {
      setPortalPending(false);
    }
  }

  if (allowed) {
    return (
      <>
        <div className="cs-billing-access-card cs-billing-access-active">
          <div className="cs-billing-access-head">
            <span>{t("billing.customerService")}</span>
            <div className="cs-billing-status-badges">
              <span className="badge badge-active">{t("billing.active")}</span>
              {isEndingAtPeriodEnd && (
                <span className="badge badge-warning">{t("billing.cancelAtPeriodEnd")}</span>
              )}
            </div>
          </div>
          <div className="cs-billing-access-meta">
            <div className="cs-billing-metric">
              <span>{t("billing.source")}</span>
              <strong>{billingEnumLabel(t, "entitlementSource", entitlement?.source)}</strong>
            </div>
            {subscription && (
              <>
                <div className="cs-billing-metric">
                  <span>{t("billing.renewalMode")}</span>
                  <strong>{billingEnumLabel(t, "renewalMode", subscription.renewalMode)}</strong>
                </div>
                <div className="cs-billing-metric">
                  <span>{t("billing.startsAt")}</span>
                  <strong>{formatDateTime(subscription.currentPeriodStart)}</strong>
                </div>
              </>
            )}
            <div className="cs-billing-metric">
              <span>{t("billing.validUntil")}</span>
              <strong>{formatDateTime(entitlement?.validUntil)}</strong>
            </div>
          </div>
          {showRenewalReminder && (
            <div className="billing-renewal-warning">
              {t("billing.renewalReminder", {
                date: formatDateTime(subscription?.currentPeriodEnd),
              })}
            </div>
          )}
          {(canExtendPrepaid || showRenewalReminder || canResumeSubscription || canCancelSubscription) && (
            <div className="cs-billing-payment-actions cs-billing-access-actions">
              {canResumeSubscription && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setPrepaidCheckout(true);
                    setCheckoutModalOpen(true);
                  }}
                  disabled={!plan}
                >
                  {t("billing.renewSubscription")}
                </button>
              )}
              {canExtendPrepaid && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setPrepaidCheckout(true);
                    setCheckoutModalOpen(true);
                  }}
                  disabled={!plan}
                >
                  {t("billing.extendPrepaid")}
                </button>
              )}
              {showRenewalReminder && !canResumeSubscription && !canExtendPrepaid && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setPrepaidCheckout(true);
                    setCheckoutModalOpen(true);
                  }}
                  disabled={!plan}
                >
                  {t("billing.renewSubscription")}
                </button>
              )}
              {canManagePaymentMethod && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm cs-billing-action-btn cs-billing-action-card"
                  onClick={() => managePaymentMethod().catch(() => {})}
                  disabled={portalPending}
                >
                  <BillingIcon size={15} />
                  {portalPending ? t("common.loading") : t("billing.changePaymentMethod")}
                </button>
              )}
              {canCancelSubscription && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm cs-billing-action-btn cs-billing-action-cancel"
                  onClick={() => setCancelConfirmOpen(true)}
                >
                  <CloseIcon size={15} />
                  {t("billing.cancelSubscription")}
                </button>
              )}
            </div>
          )}
          {portalError && (
            <div className="modal-error-box">{t("billing.errors.checkoutFailed", { message: portalError })}</div>
          )}
          <ShopServiceCheckoutModal
            isOpen={checkoutModalOpen}
            onClose={() => setCheckoutModalOpen(false)}
            title={prepaidCheckout ? t("billing.extendPrepaidTitle") : t("billing.subscribeCustomerService")}
            plans={plan ? [plan] : []}
            shops={[{ shopId, shopName: shopName ?? shopId }]}
            initialShopId={shopId}
            initialPlanId={plan?.planId}
            initialProvider={prepaidCheckout ? checkoutProviderFromBillingProvider(subscription?.provider) : undefined}
          />
        </div>
        <ConfirmDialog
          isOpen={cancelConfirmOpen}
          title={t("billing.cancelSubscriptionTitle")}
          message={t("billing.cancelSubscriptionMessage", {
            date: formatDateTime(subscription?.currentPeriodEnd),
          })}
          confirmLabel={t("billing.cancelSubscriptionConfirm")}
          cancelLabel={t("common.cancel")}
          onCancel={() => setCancelConfirmOpen(false)}
          onConfirm={() => {
            confirmCancelSubscription().catch(() => setCancelConfirmOpen(false));
          }}
        />
      </>
    );
  }

  const checkoutModal = (
    <ShopServiceCheckoutModal
      isOpen={checkoutModalOpen}
      onClose={() => setCheckoutModalOpen(false)}
      title={prepaidCheckout ? t("billing.extendPrepaidTitle") : t("billing.subscribeCustomerService")}
      plans={plan ? [plan] : []}
      shops={[{ shopId, shopName: shopName ?? shopId }]}
      initialShopId={shopId}
      initialPlanId={plan?.planId}
      initialProvider={prepaidCheckout ? checkoutProviderFromBillingProvider(subscription?.provider) : undefined}
    />
  );

  if (variant === "inline") {
    return (
      <>
        <div className="cs-billing-inline">
          <div className="cs-billing-inline-head">
            <span>{plan ? billingPlanDisplayName(t, plan) : t("billing.customerServiceUnlimited")}</span>
            <span className="badge badge-warning">{entitlementStatusLabel(t, entitlement)}</span>
          </div>
          <p className="cs-billing-access-copy">
            {t("billing.customerServiceUpgrade", {
              price: planPriceLine(plan, monthLabel),
            })}
          </p>
          {!plan && (
            <div className="modal-error-box">{t("billing.planDefinitionsUnavailable")}</div>
          )}
          <div className="cs-billing-payment-actions cs-billing-payment-actions-inline">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setPrepaidCheckout(false);
                setCheckoutModalOpen(true);
              }}
              disabled={!plan}
            >
              {t("billing.subscribeCustomerService")}
            </button>
          </div>
        </div>
        {checkoutModal}
      </>
    );
  }

  return (
    <>
      <div className="cs-billing-access-card">
        <div className="cs-billing-access-head">
          <span>{plan ? billingPlanDisplayName(t, plan) : t("billing.customerServiceUnlimited")}</span>
          <span className="badge badge-warning">{entitlementStatusLabel(t, entitlement)}</span>
        </div>
        <p className="cs-billing-access-copy">
          {t("billing.customerServiceUpgrade", {
            price: planPriceLine(plan, monthLabel),
          })}
        </p>
        {!plan && (
          <div className="modal-error-box">{t("billing.planDefinitionsUnavailable")}</div>
        )}
        <div className="cs-billing-payment-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              setPrepaidCheckout(false);
              setCheckoutModalOpen(true);
            }}
            disabled={!plan}
          >
            {t("billing.subscribeCustomerService")}
          </button>
        </div>
      </div>
      {checkoutModal}
    </>
  );
});
