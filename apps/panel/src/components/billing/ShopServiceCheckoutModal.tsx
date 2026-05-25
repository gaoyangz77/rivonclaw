import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { GQL } from "@rivonclaw/core";
import type { BillingPlanDefinition } from "@rivonclaw/core/models";
import { Select } from "../inputs/Select.js";
import { Modal } from "../modals/Modal.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { PaymentPendingModal } from "./PaymentPendingModal.js";
import {
  billingPlanDisplayName,
  checkoutProviderLabelKey,
  checkoutProviderOptions,
  type CheckoutProvider,
} from "./billing-labels.js";
import { startBillingCheckout } from "./start-billing-checkout.js";

interface ShopCheckoutOption {
  shopId: string;
  shopName: string;
}

interface ShopServiceCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  plans: readonly BillingPlanDefinition[];
  shops: readonly ShopCheckoutOption[];
  scopeType?: string;
  scopeId?: string | null;
  initialShopId?: string | null;
  initialPlanId?: string | null;
  providerOptions?: readonly CheckoutProvider[];
  initialProvider?: CheckoutProvider;
  planLabel?: string;
  priceNotice?: string;
  priceNoticePlanIds?: readonly string[];
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

function formatMoneyFromMinor(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function cnyPriceLine(plan: BillingPlanDefinition | null): string | null {
  if (!plan) return null;
  if (plan.priceMonthlyCnyMinor != null) return formatMoneyFromMinor(plan.priceMonthlyCnyMinor, "CNY");
  if (plan.priceMonthlyCny) return formatMoneyFromMajor(plan.priceMonthlyCny, "CNY");
  return null;
}

function checkoutPriceLine(plan: BillingPlanDefinition | null, provider: CheckoutProvider): string | null {
  if (!plan) return null;
  if (provider === "LAKALA") return cnyPriceLine(plan) ?? formatMoneyFromMajor(plan.priceMonthly, plan.priceCurrency);
  return formatMoneyFromMajor(plan.priceMonthly, plan.priceCurrency);
}

function planDescription(t: ReturnType<typeof useTranslation>["t"], plan: BillingPlanDefinition): string | null {
  const key = `billing.planDescriptions.${plan.planId}`;
  const translated = t(key, { defaultValue: "" });
  return translated || null;
}

export const ShopServiceCheckoutModal = observer(function ShopServiceCheckoutModal({
  isOpen,
  onClose,
  title,
  plans,
  shops,
  scopeType,
  scopeId,
  initialShopId,
  initialPlanId,
  providerOptions,
  initialProvider,
  planLabel,
  priceNotice,
  priceNoticePlanIds,
}: ShopServiceCheckoutModalProps) {
  const { t, i18n } = useTranslation();
  const entityStore = useEntityStore();
  const providers = useMemo(
    () => providerOptions?.length ? [...providerOptions] : checkoutProviderOptions(i18n.language),
    [i18n.language, providerOptions],
  );
  const [selectedShopId, setSelectedShopId] = useState(initialShopId ?? "");
  const [selectedPlanId, setSelectedPlanId] = useState(initialPlanId ?? "");
  const [selectedProvider, setSelectedProvider] = useState<CheckoutProvider>(initialProvider ?? providers[0] ?? "STRIPE");
  const firstPlanId = plans[0]?.planId ?? "";
  const firstShopId = shops[0]?.shopId ?? "";

  const selectedPlan = plans.find((plan) => plan.planId === selectedPlanId) ?? plans[0] ?? null;
  const selectedShop = shops.find((shop) => shop.shopId === selectedShopId) ?? null;
  const targetScopeType = scopeType ?? GQL.BillingScopeType.Shop;
  const targetScopeId = scopeId ?? selectedShop?.shopId ?? "";
  const isAccountScope = targetScopeType === GQL.BillingScopeType.Account;
  const targetCheckoutActive = !!targetScopeId && (
    entityStore.checkoutScopeId === targetScopeId
    || (isAccountScope && entityStore.activeCheckout?.billingScopeType === targetScopeType)
  );
  const activeCheckout = targetCheckoutActive
    ? entityStore.activeCheckout
    : null;
  const checkoutError = targetCheckoutActive || (!!targetScopeId && entityStore.checkoutScopeId === targetScopeId)
    ? entityStore.checkoutError
    : null;
  const checkoutNotice = !!targetScopeId && entityStore.checkoutScopeId === targetScopeId
    ? entityStore.checkoutNotice
    : null;
  const showPriceNotice = !!priceNotice
    && !!selectedPlan
    && (!priceNoticePlanIds?.length || priceNoticePlanIds.includes(selectedPlan.planId));
  useEffect(() => {
    if (!isOpen) return;
    setSelectedShopId(initialShopId ?? firstShopId);
    setSelectedPlanId(initialPlanId ?? firstPlanId);
    setSelectedProvider(initialProvider ?? providers[0] ?? "STRIPE");
  }, [firstPlanId, firstShopId, initialPlanId, initialProvider, initialShopId, isOpen, providers]);

  async function startCheckout() {
    if (!selectedPlan || !targetScopeId) return null;
    return startBillingCheckout({
      entityStore,
      t,
      planId: selectedPlan.planId,
      scopeType: targetScopeType,
      scopeId: targetScopeId,
      provider: selectedProvider,
    });
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth={560}>
        <div className="service-checkout-form">
          <div className="service-checkout-field">
            <span className="service-checkout-label">{planLabel ?? t("billing.chooseShopServicePlan")}</span>
            <div className="service-checkout-option-list">
              {plans.map((plan) => (
                <button
                  key={plan.planId}
                  type="button"
                  className={`service-checkout-choice${selectedPlan?.planId === plan.planId ? " is-selected" : ""}`}
                  onClick={() => setSelectedPlanId(plan.planId)}
                >
                  <span>{billingPlanDisplayName(t, plan)}</span>
                  {planDescription(t, plan) && (
                    <small>{planDescription(t, plan)}</small>
                  )}
                </button>
              ))}
            </div>
          </div>

          {!scopeId && (
            <div className="service-checkout-field">
              <span className="service-checkout-label">{t("billing.selectShop")}</span>
              {!shops.length ? (
                <div className="service-checkout-empty">{t("billing.noShopsNeedService")}</div>
              ) : (
                <Select
                  value={selectedShopId}
                  onChange={setSelectedShopId}
                  options={shops.map((shop) => ({ value: shop.shopId, label: shop.shopName }))}
                  placeholder={t("billing.selectShopPlaceholder")}
                  disabled={!!initialShopId}
                  searchable={shops.length > 8}
                />
              )}
            </div>
          )}

          {providers.length > 1 ? (
            <div className="service-checkout-field">
              <span className="service-checkout-label">{t("billing.paymentMethod")}</span>
              <div className="service-checkout-payment-options">
                {providers.map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    className={`service-checkout-payment-option${selectedProvider === provider ? " is-selected" : ""}`}
                    onClick={() => setSelectedProvider(provider)}
                  >
                    {t(checkoutProviderLabelKey(provider))}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="service-checkout-field">
              <span className="service-checkout-label">{t("billing.paymentMethod")}</span>
              <div className="service-checkout-single-method">
                {t(checkoutProviderLabelKey(selectedProvider))}
              </div>
            </div>
          )}

          {selectedPlan && (
            <div className="service-checkout-summary">
              <div>
                <span>{showPriceNotice ? t("billing.monthlyPlanPrice") : t("billing.subscriptionAmount")}</span>
                <strong>
                  {checkoutPriceLine(selectedPlan, selectedProvider)}
                  <small>/{t("subscription.month")}</small>
                </strong>
                {showPriceNotice && (
                  <p>{priceNotice}</p>
                )}
              </div>
            </div>
          )}

          {!plans.length && (
            <div className="modal-error-box">{t("billing.planDefinitionsUnavailable")}</div>
          )}
          {checkoutError && (
            <div className="modal-error-box">{t("billing.errors.checkoutFailed", { message: checkoutError })}</div>
          )}
          {checkoutNotice && (
            <div className="info-box info-box-blue">{t(`billing.subscriptionStartAction.${checkoutNotice}`)}</div>
          )}

          <div className="modal-actions">
            <button className="btn btn-secondary" type="button" onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => startCheckout().catch(() => {})}
              disabled={!selectedPlan || !targetScopeId || entityStore.paymentInFlight}
            >
              {entityStore.paymentInFlight ? t("common.loading") : t("billing.continueToPayment")}
            </button>
          </div>
        </div>
      </Modal>
      <PaymentPendingModal
        payment={activeCheckout}
        onClose={() => entityStore.clearActiveCheckout()}
        onSuccessComplete={onClose}
      />
    </>
  );
});
