import { useState } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { GQL } from "@rivonclaw/core";
import type {
  AccountLlmBillingStatus,
  BillingEntitlementStatus,
  BillingOverview,
  BillingPlanDefinition,
  Payment,
  Shop,
  ShopBillingStatus,
} from "@rivonclaw/core/models";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { ShopServiceCheckoutModal } from "../../../components/billing/ShopServiceCheckoutModal.js";
import { ConfirmDialog } from "../../../components/modals/ConfirmDialog.js";
import { Modal } from "../../../components/modals/Modal.js";
import {
  billingEnumLabel,
  billingPlanDisplayName,
  checkoutProviderFromBillingProvider,
  entitlementStatusLabel,
  findPlanDefinition,
  isHighestAccountPlan,
  shouldShowRenewalReminder,
  sortUsageWindows,
  upgradeableAccountPlans,
  type CheckoutProvider,
  usagePercentLabel,
} from "../../../components/billing/billing-labels.js";

interface AccountBillingSectionProps {
  billingOverview: BillingOverview | null;
  planDefinitions: readonly BillingPlanDefinition[];
  payments: readonly Payment[];
}

type ShopServiceKey = "customerService" | "inventory" | "affiliate";

interface ShopServiceBillingRow {
  shop: Shop;
  billing: ShopBillingStatus | null;
}

function shopDisplayName(shop: { alias?: string | null; shopName?: string | null; platformShopId?: string | null; id?: string | null } | null | undefined, fallback: string): string {
  return shop?.alias || shop?.shopName || shop?.platformShopId || shop?.id || fallback;
}

function enabledShopServiceKeys(shop: { services?: {
  customerService?: { enabled?: boolean } | null;
  wms?: { enabled?: boolean | null } | null;
  affiliateService?: { enabled?: boolean } | null;
} | null } | null | undefined): ShopServiceKey[] {
  const keys: ShopServiceKey[] = [];
  if (shop?.services?.customerService?.enabled) keys.push("customerService");
  if (shop?.services?.wms?.enabled) keys.push("inventory");
  if (shop?.services?.affiliateService?.enabled) keys.push("affiliate");
  return keys;
}

function serviceProduct(key: ShopServiceKey): string {
  if (key === "customerService") return GQL.BillableProduct.EcomCustomerService;
  if (key === "inventory") return GQL.BillableProduct.EcomInventory;
  return GQL.BillableProduct.EcomAffiliate;
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

function formatMoneyFromMinor(amountMinor: number, currency: string): string {
  const amount = amountMinor / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
  }).format(amount);
}

function subscriptionAmount(subscription: BillingEntitlementStatus["subscription"]): string | null {
  return subscription ? formatMoneyFromMinor(subscription.amountMinor, subscription.currency) : null;
}

function entitlementBadgeClass(entitlement: BillingEntitlementStatus | null): string {
  if (entitlement?.allowed) return "badge badge-active";
  if (entitlement?.code === "PAYMENT_REQUIRED") return "badge badge-warning";
  return "badge badge-muted";
}

function paymentBadgeClass(status: string): string {
  if (status === "SUCCEEDED") return "badge badge-success";
  if (status === "PENDING" || status === "REQUIRES_PAYMENT") return "badge badge-warning";
  if (status === "FAILED" || status === "CANCELED") return "badge badge-danger";
  return "badge badge-muted";
}

function UsageList({ entitlement }: { entitlement: BillingEntitlementStatus | null }) {
  const { t } = useTranslation();
  if (!entitlement?.usage.length) {
    return <span className="billing-muted">{t("billing.noUsage")}</span>;
  }

  return (
    <div className="billing-usage-list">
      {sortUsageWindows(entitlement.usage).map((usage) => (
        <div key={`${usage.metric}:${usage.window}`} className="billing-usage-card">
          <div className="billing-usage-card-head">
            <span className="billing-usage-name">{billingEnumLabel(t, "usageMetric", usage.metric)}</span>
            <span className="badge badge-muted">{billingEnumLabel(t, "usageWindow", usage.window)}</span>
          </div>
          <div className="billing-usage-progress-row">
            <progress
              className={`quota-bar billing-usage-progress${usage.remainingPercent <= 20 ? " quota-bar-low" : ""}`}
              value={usage.remainingPercent}
              max={100}
            />
            <span className="billing-usage-percent">
              {t("billing.usageRemainingPercent", { percent: usagePercentLabel(usage.remainingPercent) })}
            </span>
          </div>
          <div className="billing-muted">
            {t("account.quotaRefreshAt", { time: formatDateTime(usage.refreshAt) })}
          </div>
        </div>
      ))}
    </div>
  );
}

function BillingMetaItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="billing-meta-item">
      <span className="billing-meta-label">{label}</span>
      <span className="billing-meta-value">{value || "-"}</span>
    </div>
  );
}

function AccountSubscriptionDetailModal({
  isOpen,
  title,
  entitlement,
  onClose,
  onExtendPrepaid,
  onManagePaymentMethod,
  onCancelSubscription,
}: {
  isOpen: boolean;
  title: string;
  entitlement: BillingEntitlementStatus | null;
  onClose: () => void;
  onExtendPrepaid?: () => void;
  onManagePaymentMethod?: () => Promise<void>;
  onCancelSubscription?: () => void;
}) {
  const { t } = useTranslation();
  const subscription = entitlement?.subscription ?? null;
  const [portalPending, setPortalPending] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  async function handleManagePaymentMethod() {
    if (!onManagePaymentMethod) return;
    setPortalPending(true);
    setPortalError(null);
    try {
      await onManagePaymentMethod();
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : String(err));
    } finally {
      setPortalPending(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth={560}>
      <div className="service-detail-body">
        <div className="billing-meta-grid">
          <BillingMetaItem label={t("billing.subscriptionStatus")} value={entitlementStatusLabel(t, entitlement)} />
          <BillingMetaItem label={t("billing.source")} value={billingEnumLabel(t, "entitlementSource", entitlement?.source)} />
          <BillingMetaItem label={t("billing.validUntil")} value={formatDateTime(entitlement?.validUntil)} />
          {subscription && (
            <>
              <BillingMetaItem label={t("billing.renewalMode")} value={billingEnumLabel(t, "renewalMode", subscription.renewalMode)} />
              <BillingMetaItem label={t("billing.subscriptionAmount")} value={subscriptionAmount(subscription)} />
              <BillingMetaItem label={t("billing.startsAt")} value={formatDateTime(subscription.currentPeriodStart)} />
              {subscription.graceUntil && (
                <BillingMetaItem label={t("billing.graceUntil")} value={formatDateTime(subscription.graceUntil)} />
              )}
            </>
          )}
        </div>
        {(subscription?.cancelAtPeriodEnd || subscription?.renewalMode === GQL.BillingRenewalMode.NonRenewing) && (
          <div className="billing-renewal-warning">{t("billing.cancelAtPeriodEnd")}</div>
        )}
        {onExtendPrepaid && (
          <div className="billing-action-zone">
            <div>
              <strong>{t("billing.extendPrepaidTitle")}</strong>
              <span>{t("billing.renewSubscriptionMessage", {
                date: formatDateTime(subscription?.currentPeriodEnd),
              })}</span>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onExtendPrepaid}
            >
              {t("billing.extendPrepaid")}
            </button>
          </div>
        )}
        {onManagePaymentMethod && (
          <div className="billing-action-zone">
            <div>
              <strong>{t("billing.managePaymentMethod")}</strong>
              <span>{t("billing.managePaymentMethodMessage")}</span>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleManagePaymentMethod().catch(() => {})}
              disabled={portalPending}
            >
              {portalPending ? t("common.loading") : t("billing.changePaymentMethod")}
            </button>
          </div>
        )}
        {portalError && (
          <div className="modal-error-box">{t("billing.errors.checkoutFailed", { message: portalError })}</div>
        )}
        {onCancelSubscription && (
          <div className="billing-danger-zone">
            <div>
              <strong>{t("billing.cancelSubscriptionTitle")}</strong>
              <span>{t("billing.cancelSubscriptionMessage", {
                date: formatDateTime(subscription?.currentPeriodEnd),
              })}</span>
            </div>
            <button
              type="button"
              className="btn btn-danger"
              onClick={onCancelSubscription}
            >
              {t("billing.cancelSubscription")}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function EntitlementSummary({
  title,
  entitlement,
  accountLlm,
  planDefinitions,
}: {
  title: string;
  entitlement: BillingEntitlementStatus | null;
  accountLlm?: AccountLlmBillingStatus | null;
  planDefinitions?: readonly BillingPlanDefinition[];
}) {
  const { t } = useTranslation();
  const subscription = entitlement?.subscription ?? null;
  const entityStore = useEntityStore();
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [checkoutInitialProvider, setCheckoutInitialProvider] = useState<CheckoutProvider | undefined>(undefined);
  const [checkoutIsRenewal, setCheckoutIsRenewal] = useState(false);
  const accountScopeId = entitlement?.scopeId || entityStore.currentUser?.userId || null;
  const hasAccountSubscription = !!subscription;
  const showRenewalReminder = shouldShowRenewalReminder(entitlement);
  const currentAccountPlan = findPlanDefinition(planDefinitions ?? [], accountLlm?.planId, entitlement?.product);
  const canResumeAccountSubscription = !!subscription
    && subscription.renewalMode !== GQL.BillingRenewalMode.Prepaid
    && (subscription.cancelAtPeriodEnd || subscription.renewalMode === GQL.BillingRenewalMode.NonRenewing);
  const canRenewOrResumeAccountPlan = !!subscription
    && (canResumeAccountSubscription || showRenewalReminder);
  const upgradeAccountPlans = upgradeableAccountPlans(planDefinitions ?? [], accountLlm?.planId);
  const accountPlans = [
    ...(canRenewOrResumeAccountPlan && currentAccountPlan ? [currentAccountPlan] : []),
    ...upgradeAccountPlans,
  ].filter((plan, index, plans) => plans.findIndex((item) => item.planId === plan.planId) === index);
  const isHighestPlan = isHighestAccountPlan(accountLlm?.planId);
  const canCancelSubscription = !!subscription
    && subscription.renewalMode === GQL.BillingRenewalMode.AutoRenews
    && !subscription.cancelAtPeriodEnd;
  const canManagePaymentMethod = canCancelSubscription;
  const canExtendPrepaid = !!subscription
    && subscription.renewalMode === GQL.BillingRenewalMode.Prepaid
    && !!currentAccountPlan
    && !!accountScopeId;
  const canOpenAccountPlanPicker = !isHighestPlan || canRenewOrResumeAccountPlan || canExtendPrepaid || !hasAccountSubscription;

  async function confirmCancelSubscription() {
    if (!entitlement) return;
    await entityStore.cancelBillingSubscriptionAtPeriodEnd({
      product: entitlement.product,
      scopeType: entitlement.scopeType,
      scopeId: entitlement.scopeId,
    });
    setCancelConfirmOpen(false);
    setDetailModalOpen(false);
  }

  async function manageAccountPaymentMethod() {
    if (!entitlement || !accountScopeId) return;
    const url = await entityStore.createStripeBillingPortalSession({
      product: entitlement.product,
      scopeType: entitlement.scopeType,
      scopeId: accountScopeId,
    });
    if (!url) throw new Error(t("billing.errors.missingBillingPortalUrl"));
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openAccountCheckout(options?: { renewal?: boolean; preferredProvider?: CheckoutProvider }) {
    setCheckoutIsRenewal(!!options?.renewal);
    setCheckoutInitialProvider(options?.preferredProvider);
    setCheckoutModalOpen(true);
  }

  return (
    <div className={`billing-entitlement-tile${hasAccountSubscription ? "" : " billing-entitlement-tile-compact"}`}>
      <div className="billing-tile-head">
        <div className="billing-tile-copy">
          <span className="billing-tile-title">{title}</span>
          <div className="billing-tile-subtitle">
            {subscription?.planId
              ? billingEnumLabel(t, "subscriptionStatus", subscription.status)
              : t("billing.accountAiDescription")}
          </div>
        </div>
        <div className="billing-tile-status">
          <span className={hasAccountSubscription ? entitlementBadgeClass(entitlement) : "badge badge-muted"}>
            {hasAccountSubscription ? entitlementStatusLabel(t, entitlement) : t("billing.notSubscribed")}
          </span>
        </div>
      </div>
      {hasAccountSubscription && (
        <div className="billing-meta-grid">
          <BillingMetaItem label={t("billing.source")} value={billingEnumLabel(t, "entitlementSource", entitlement?.source)} />
          <BillingMetaItem label={t("billing.renewalMode")} value={billingEnumLabel(t, "renewalMode", subscription.renewalMode)} />
          <BillingMetaItem label={t("billing.subscriptionAmount")} value={subscriptionAmount(subscription)} />
          {subscription.graceUntil && (
            <BillingMetaItem label={t("billing.graceUntil")} value={formatDateTime(subscription.graceUntil)} />
          )}
          <BillingMetaItem label={t("billing.startsAt")} value={formatDateTime(subscription.currentPeriodStart)} />
          <BillingMetaItem label={t("billing.validUntil")} value={formatDateTime(entitlement?.validUntil)} />
        </div>
      )}
      {showRenewalReminder && (
        <div className="billing-renewal-warning">
          {t("billing.renewalReminder", {
            date: formatDateTime(subscription?.currentPeriodEnd),
          })}
        </div>
      )}
      {hasAccountSubscription && <UsageList entitlement={entitlement} />}
      {accountLlm && (
        <div className="billing-account-actions">
          {(subscription?.cancelAtPeriodEnd || subscription?.renewalMode === GQL.BillingRenewalMode.NonRenewing) && (
            <span className="billing-warning-text">{t("billing.cancelAtPeriodEnd")}</span>
          )}
          {hasAccountSubscription && !canExtendPrepaid && (
            <button
              className="btn btn-secondary"
              onClick={() => setDetailModalOpen(true)}
            >
              {t("billing.manageSubscription")}
            </button>
          )}
          {!canOpenAccountPlanPicker ? (
            <span className="badge badge-muted">{t("billing.highestPlan")}</span>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => {
                if (canResumeAccountSubscription) {
                  openAccountCheckout({
                    renewal: true,
                    preferredProvider: checkoutProviderFromBillingProvider(subscription?.provider),
                  });
                  return;
                }
                if (canExtendPrepaid) {
                  openAccountCheckout({
                    renewal: true,
                    preferredProvider: checkoutProviderFromBillingProvider(subscription?.provider),
                  });
                  return;
                }
                openAccountCheckout();
              }}
              disabled={!accountScopeId}
            >
              {!hasAccountSubscription
                ? t("billing.subscribeAccountPlan")
                : canResumeAccountSubscription
                  ? t("billing.renewSubscription")
                  : canExtendPrepaid
                    ? t("billing.extendPrepaid")
                  : canRenewOrResumeAccountPlan && isHighestPlan
                    ? t("billing.renewSubscription")
                    : t("billing.upgradeAccountPlan")}
            </button>
          )}
        </div>
      )}
      {accountLlm && (
        <>
          <ShopServiceCheckoutModal
            isOpen={checkoutModalOpen}
            onClose={() => setCheckoutModalOpen(false)}
            title={checkoutIsRenewal ? t("billing.extendPrepaidTitle") : hasAccountSubscription ? t("billing.changeAccountPlan") : t("billing.subscribeAccountPlan")}
            plans={checkoutIsRenewal && currentAccountPlan
              ? [currentAccountPlan]
              : accountPlans}
            shops={[]}
            scopeType={GQL.BillingScopeType.Account}
            scopeId={accountScopeId}
            initialPlanId={checkoutIsRenewal && currentAccountPlan
              ? currentAccountPlan.planId
              : accountPlans[0]?.planId}
            initialProvider={checkoutInitialProvider}
            planLabel={t("billing.chooseAccountPlan")}
            priceNotice={t("billing.upgradeProrationHint")}
            priceNoticePlanIds={upgradeAccountPlans.map((plan) => plan.planId)}
          />
          <AccountSubscriptionDetailModal
            isOpen={detailModalOpen}
            title={title}
            entitlement={entitlement}
            onClose={() => setDetailModalOpen(false)}
            onManagePaymentMethod={canManagePaymentMethod ? manageAccountPaymentMethod : undefined}
            onCancelSubscription={canCancelSubscription ? () => setCancelConfirmOpen(true) : undefined}
            onExtendPrepaid={canExtendPrepaid || canResumeAccountSubscription ? () => {
              setDetailModalOpen(false);
              openAccountCheckout({
                renewal: true,
                preferredProvider: checkoutProviderFromBillingProvider(subscription?.provider),
              });
            } : undefined}
          />
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
      )}
    </div>
  );
}

function ShopServiceDetailModal({
  row,
  serviceKey,
  onClose,
  onExtendPrepaid,
  onManagePaymentMethod,
  onCancelSubscription,
}: {
  row: ShopServiceBillingRow;
  serviceKey: ShopServiceKey | null;
  onClose: () => void;
  onExtendPrepaid?: (serviceKey: ShopServiceKey, entitlement: BillingEntitlementStatus) => void;
  onManagePaymentMethod?: (entitlement: BillingEntitlementStatus) => Promise<void>;
  onCancelSubscription?: (entitlement: BillingEntitlementStatus) => void;
}) {
  const { t } = useTranslation();
  const entitlement = serviceKey ? row.billing?.[serviceKey] ?? null : null;
  const subscription = entitlement?.subscription ?? null;
  const canCancelSubscription = !!entitlement
    && !!subscription
    && subscription.renewalMode === GQL.BillingRenewalMode.AutoRenews
    && !subscription.cancelAtPeriodEnd;
  const canManagePaymentMethod = canCancelSubscription;
  const canExtendPrepaid = !!entitlement
    && !!subscription
    && subscription.renewalMode === GQL.BillingRenewalMode.Prepaid;
  const canResumeSubscription = !!entitlement
    && !!subscription
    && subscription.renewalMode !== GQL.BillingRenewalMode.Prepaid
    && (subscription.cancelAtPeriodEnd || subscription.renewalMode === GQL.BillingRenewalMode.NonRenewing);
  const [portalPending, setPortalPending] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const title = serviceKey
    ? `${shopDisplayName(row.shop, row.billing?.shopName ?? row.shop.shopName)} · ${t(`billing.services.${serviceKey}`)}`
    : t("billing.shopServices");

  async function handleManagePaymentMethod() {
    if (!entitlement || !onManagePaymentMethod) return;
    setPortalPending(true);
    setPortalError(null);
    try {
      await onManagePaymentMethod(entitlement);
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : String(err));
    } finally {
      setPortalPending(false);
    }
  }

  return (
    <Modal isOpen={serviceKey !== null} onClose={onClose} title={title} maxWidth={560}>
      <div className="service-detail-body">
        <div className="billing-meta-grid">
          <BillingMetaItem label={t("billing.subscriptionStatus")} value={entitlementStatusLabel(t, entitlement)} />
          <BillingMetaItem label={t("billing.source")} value={billingEnumLabel(t, "entitlementSource", entitlement?.source)} />
          <BillingMetaItem label={t("billing.validUntil")} value={formatDateTime(entitlement?.validUntil)} />
          {subscription && (
            <>
              <BillingMetaItem label={t("billing.renewalMode")} value={billingEnumLabel(t, "renewalMode", subscription.renewalMode)} />
              <BillingMetaItem label={t("billing.subscriptionAmount")} value={subscriptionAmount(subscription)} />
              <BillingMetaItem label={t("billing.startsAt")} value={formatDateTime(subscription.currentPeriodStart)} />
              <BillingMetaItem label={t("billing.subscriptionStatus")} value={billingEnumLabel(t, "subscriptionStatus", subscription.status)} />
              {subscription.graceUntil && (
                <BillingMetaItem label={t("billing.graceUntil")} value={formatDateTime(subscription.graceUntil)} />
              )}
            </>
          )}
        </div>
        {(subscription?.cancelAtPeriodEnd || subscription?.renewalMode === GQL.BillingRenewalMode.NonRenewing) && (
          <div className="billing-renewal-warning">{t("billing.cancelAtPeriodEnd")}</div>
        )}
        {(canExtendPrepaid || canResumeSubscription) && serviceKey && entitlement && onExtendPrepaid && (
          <div className="billing-action-zone">
            <div>
              <strong>{t("billing.extendPrepaidTitle")}</strong>
              <span>{t("billing.renewSubscriptionMessage", {
                date: formatDateTime(subscription.currentPeriodEnd),
              })}</span>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onExtendPrepaid(serviceKey, entitlement)}
            >
              {t("billing.extendPrepaid")}
            </button>
          </div>
        )}
        {canManagePaymentMethod && onManagePaymentMethod && (
          <div className="billing-action-zone">
            <div>
              <strong>{t("billing.managePaymentMethod")}</strong>
              <span>{t("billing.managePaymentMethodMessage")}</span>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleManagePaymentMethod().catch(() => {})}
              disabled={portalPending}
            >
              {portalPending ? t("common.loading") : t("billing.changePaymentMethod")}
            </button>
          </div>
        )}
        {portalError && (
          <div className="modal-error-box">{t("billing.errors.checkoutFailed", { message: portalError })}</div>
        )}
        {canCancelSubscription && onCancelSubscription && (
          <div className="billing-danger-zone">
            <div>
              <strong>{t("billing.cancelSubscriptionTitle")}</strong>
              <span>{t("billing.cancelSubscriptionMessage", {
                date: formatDateTime(subscription.currentPeriodEnd),
              })}</span>
            </div>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => onCancelSubscription(entitlement)}
            >
              {t("billing.cancelSubscription")}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ShopServiceRow({
  row,
  planDefinitions,
}: {
  row: ShopServiceBillingRow;
  planDefinitions: readonly BillingPlanDefinition[];
}) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const [cancelTarget, setCancelTarget] = useState<BillingEntitlementStatus | null>(null);
  const [detailServiceKey, setDetailServiceKey] = useState<ShopServiceKey | null>(null);
  const [checkoutServiceKey, setCheckoutServiceKey] = useState<ShopServiceKey | null>(null);
  const [checkoutProviderOptions, setCheckoutProviderOptions] = useState<readonly CheckoutProvider[] | undefined>(undefined);
  const [checkoutInitialProvider, setCheckoutInitialProvider] = useState<CheckoutProvider | undefined>(undefined);
  const [checkoutIsRenewal, setCheckoutIsRenewal] = useState(false);
  const serviceKeys = enabledShopServiceKeys(row.shop);

  async function confirmCancelService() {
    if (!cancelTarget) return;
    await entityStore.cancelBillingSubscriptionAtPeriodEnd({
      product: cancelTarget.product,
      scopeType: cancelTarget.scopeType,
      scopeId: cancelTarget.scopeId,
    });
    setCancelTarget(null);
    setDetailServiceKey(null);
  }

  async function manageServicePaymentMethod(target: BillingEntitlementStatus) {
    const url = await entityStore.createStripeBillingPortalSession({
      product: target.product,
      scopeType: target.scopeType,
      scopeId: target.scopeId,
    });
    if (!url) throw new Error(t("billing.errors.missingBillingPortalUrl"));
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function servicePlans(key: ShopServiceKey): BillingPlanDefinition[] {
    return planDefinitions.filter((plan) => plan.product === serviceProduct(key));
  }

  function handleServiceClick(key: ShopServiceKey, entitlement: BillingEntitlementStatus | null) {
    if (entitlement?.allowed) {
      setDetailServiceKey(key);
      return;
    }
    if (servicePlans(key).length) {
      setCheckoutIsRenewal(false);
      setCheckoutProviderOptions(undefined);
      setCheckoutInitialProvider(undefined);
      setCheckoutServiceKey(key);
      return;
    }
    setDetailServiceKey(key);
  }

  function openPrepaidExtension(key: ShopServiceKey) {
    setDetailServiceKey(null);
    setCheckoutIsRenewal(true);
    setCheckoutProviderOptions(undefined);
    setCheckoutInitialProvider(checkoutProviderFromBillingProvider(row.billing?.[key]?.subscription?.provider));
    setCheckoutServiceKey(key);
  }

  const checkoutPlans = checkoutServiceKey ? servicePlans(checkoutServiceKey) : [];
  const checkoutInitialPlanId = checkoutServiceKey
    ? row.billing?.[checkoutServiceKey]?.subscription?.planId ?? checkoutPlans[0]?.planId
    : checkoutPlans[0]?.planId;

  return (
    <>
      <div className="billing-shop-row">
        <div className="billing-shop-name">{shopDisplayName(row.shop, row.billing?.shopName ?? row.shop.shopName)}</div>
        <div className="billing-shop-services">
          {serviceKeys.length ? serviceKeys.map((key) => {
            const entitlement = row.billing?.[key] ?? null;
            const subscription = entitlement?.subscription ?? null;
            const showRenewalReminder = shouldShowRenewalReminder(entitlement);
	            return (
	              <div
	                key={key}
	                className={`billing-shop-service billing-shop-service-clickable ${entitlement?.allowed ? "billing-shop-service-active" : "billing-shop-service-action"}`}
	                role="button"
	                tabIndex={0}
	                onClick={() => handleServiceClick(key, entitlement)}
	                onKeyDown={(event) => {
	                  if (event.key === "Enter" || event.key === " ") {
	                    event.preventDefault();
	                    handleServiceClick(key, entitlement);
	                  }
	                }}
	              >
                <div className="billing-shop-service-main">
                  <span className="billing-shop-service-label">{t(`billing.services.${key}`)}</span>
                  <span className={entitlementBadgeClass(entitlement)}>
                    {entitlementStatusLabel(t, entitlement)}
                  </span>
                </div>
                {subscription && (
                  <div className="billing-shop-service-foot">
                    {showRenewalReminder && (
                      <span className="billing-warning-text">
                        {t("billing.renewBefore", { date: formatDateTime(subscription.currentPeriodEnd) })}
                      </span>
                    )}
                    {subscription.cancelAtPeriodEnd || subscription.renewalMode === GQL.BillingRenewalMode.NonRenewing ? (
                      <span className="billing-warning-text">{t("billing.cancelAtPeriodEnd")}</span>
                    ) : null}
                  </div>
                )}
              </div>
            );
          }) : (
            <span className="billing-muted">{t("billing.noEnabledShopServices")}</span>
          )}
        </div>
      </div>
      <ShopServiceDetailModal
        row={row}
        serviceKey={detailServiceKey}
        onClose={() => setDetailServiceKey(null)}
        onExtendPrepaid={(key) => openPrepaidExtension(key)}
        onManagePaymentMethod={manageServicePaymentMethod}
        onCancelSubscription={(target) => setCancelTarget(target)}
      />
      <ShopServiceCheckoutModal
        isOpen={checkoutServiceKey !== null}
        onClose={() => setCheckoutServiceKey(null)}
        title={checkoutIsRenewal ? t("billing.extendPrepaidTitle") : checkoutServiceKey ? t(`billing.subscribeService.${checkoutServiceKey}`) : t("billing.subscribeShopServices")}
        plans={checkoutPlans}
        shops={[{
          shopId: row.shop.id,
          shopName: shopDisplayName(row.shop, row.billing?.shopName ?? row.shop.shopName),
        }]}
        initialShopId={row.shop.id}
        initialPlanId={checkoutInitialPlanId}
        providerOptions={checkoutProviderOptions}
        initialProvider={checkoutInitialProvider}
      />
      <ConfirmDialog
        isOpen={cancelTarget !== null}
        title={t("billing.cancelSubscriptionTitle")}
        message={t("billing.cancelSubscriptionMessage", {
          date: formatDateTime(cancelTarget?.subscription?.currentPeriodEnd),
        })}
        confirmLabel={t("billing.cancelSubscriptionConfirm")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => {
          confirmCancelService().catch(() => setCancelTarget(null));
        }}
      />
    </>
  );
}

const ShopServiceSubscriptionFlow = observer(function ShopServiceSubscriptionFlow({
  rows,
  planDefinitions,
}: {
  rows: readonly ShopServiceBillingRow[];
  planDefinitions: readonly BillingPlanDefinition[];
}) {
  const { t } = useTranslation();
  const servicePlans = planDefinitions.filter((plan) => plan.product === GQL.BillableProduct.EcomCustomerService);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const candidateShops = rows
    .filter(({ billing, shop }) => (
      shop.services?.customerService?.enabled
      && (
        !billing?.customerService.allowed
        || shouldShowRenewalReminder(billing.customerService)
      )
    ))
    .map(({ billing, shop }) => ({
      shopId: shop.id,
      shopName: shopDisplayName(shop, billing?.shopName ?? shop.shopName),
    }));

  return (
    <div className="billing-shop-subscribe-flow">
      <div className="billing-flow-head">
        <div>
          <h5>{t("billing.subscribeShopServices")}</h5>
          <p>{t("billing.shopSubscriptionHint")}</p>
        </div>
      </div>

      {!servicePlans.length ? (
        <div className="modal-error-box">{t("billing.planDefinitionsUnavailable")}</div>
      ) : !candidateShops.length ? (
        <div className="billing-empty">{t("billing.noShopsNeedService")}</div>
      ) : (
        <div className="billing-flow-cta">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCheckoutModalOpen(true)}
          >
            {t("billing.openServiceCheckout")}
          </button>
        </div>
      )}
      <ShopServiceCheckoutModal
        isOpen={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        title={t("billing.subscribeCustomerService")}
        plans={servicePlans}
        shops={candidateShops}
        initialPlanId={servicePlans[0]?.planId}
      />
    </div>
  );
});

function PaymentRecords({
  payments,
}: {
  payments: readonly Payment[];
}) {
  const { t } = useTranslation();

  const displayPayments = payments
    .filter((payment) => (
      payment.status === GQL.PaymentStatus.Succeeded
      || payment.status === GQL.PaymentStatus.Failed
      || payment.status === GQL.PaymentStatus.Canceled
    ))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (!displayPayments.length) {
    return <div className="billing-empty">{t("billing.noCompletedPayments")}</div>;
  }

  return (
    <div className="billing-table-wrap">
      <table className="billing-table">
        <thead>
          <tr>
            <th>{t("billing.payment.provider")}</th>
            <th>{t("billing.payment.method")}</th>
            <th>{t("billing.payment.status")}</th>
            <th>{t("billing.payment.currency")}</th>
            <th>{t("billing.payment.amount")}</th>
            <th>{t("billing.payment.subject")}</th>
            <th>{t("billing.payment.createdUpdated")}</th>
            <th>{t("billing.payment.paidAt")}</th>
          </tr>
        </thead>
        <tbody>
          {displayPayments.map((payment) => (
            <tr key={payment.id}>
              <td>{billingEnumLabel(t, "provider", payment.provider)}</td>
              <td>{billingEnumLabel(t, "paymentMethod", payment.method)}</td>
              <td><span className={paymentBadgeClass(payment.status)}>{billingEnumLabel(t, "paymentStatus", payment.status)}</span></td>
              <td>{payment.currency}</td>
              <td>{formatMoneyFromMinor(payment.amountMinor, payment.currency)}</td>
              <td>{payment.subject}</td>
              <td>
                <div>{formatDateTime(payment.createdAt)}</div>
                <div className="billing-muted">{formatDateTime(payment.updatedAt)}</div>
              </td>
              <td>{formatDateTime(payment.paidAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const AccountBillingSection = observer(function AccountBillingSection({
  billingOverview,
  planDefinitions,
  payments,
}: AccountBillingSectionProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const accountLlm = billingOverview?.accountLlm ?? null;
  const accountPlan = findPlanDefinition(
    planDefinitions,
    accountLlm?.planId,
    accountLlm?.entitlement.product,
  );
  const billingShopById = new Map((billingOverview?.shops ?? []).map((shop) => [shop.shopId, shop]));
  const visibleShopBillingRows: ShopServiceBillingRow[] = entityStore.shops.map((shop) => ({
    shop,
    billing: billingShopById.get(shop.id) ?? null,
  }));

  return (
    <div className="section-card account-billing-section">
      <div className="account-section-header">
        <div>
          <h3>{t("billing.title")}</h3>
          <p>{t("billing.description")}</p>
        </div>
      </div>

      <div className="billing-dashboard-grid">
        <EntitlementSummary
          title={accountPlan ? billingPlanDisplayName(t, accountPlan) : t("billing.accountAi")}
          entitlement={accountLlm?.entitlement ?? null}
          accountLlm={accountLlm}
          planDefinitions={planDefinitions}
        />
      </div>

      <div className="billing-subsection">
        <h4>{t("billing.shopServices")}</h4>
        <ShopServiceSubscriptionFlow
          rows={visibleShopBillingRows}
          planDefinitions={planDefinitions}
        />
        <div className="billing-shop-list">
          {visibleShopBillingRows.length
            ? visibleShopBillingRows.map((row) => (
                <ShopServiceRow
                  key={row.shop.id}
                  row={row}
                  planDefinitions={planDefinitions}
                />
              ))
            : <div className="billing-empty">{t("billing.noShopBilling")}</div>}
        </div>
      </div>

      <div className="billing-subsection">
        <h4>{t("billing.paymentRecords")}</h4>
        <PaymentRecords payments={payments} />
      </div>
    </div>
  );
});
