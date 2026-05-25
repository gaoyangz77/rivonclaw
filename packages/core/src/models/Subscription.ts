import { types, type Instance } from "mobx-state-tree";

export const BillingUsageStatusModel = types.model("BillingUsageStatus", {
  metric: types.string,
  window: types.string,
  usedPercent: types.number,
  remainingPercent: types.number,
  refreshAt: types.string,
});

export const BillingSubscriptionSummaryModel = types.model("BillingSubscriptionSummary", {
  planId: types.string,
  provider: types.string,
  status: types.string,
  currency: types.string,
  amountMinor: types.integer,
  currentPeriodStart: types.string,
  currentPeriodEnd: types.string,
  graceUntil: types.maybeNull(types.string),
  renewalMode: types.maybeNull(types.string),
  cancelAtPeriodEnd: types.boolean,
});

export const BillingEntitlementStatusModel = types.model("BillingEntitlementStatus", {
  scopeType: types.string,
  scopeId: types.string,
  product: types.string,
  allowed: types.boolean,
  code: types.string,
  source: types.maybeNull(types.string),
  subscription: types.maybeNull(BillingSubscriptionSummaryModel),
  validUntil: types.maybeNull(types.string),
  usage: types.optional(types.array(BillingUsageStatusModel), []),
});

export const AccountLlmBillingStatusModel = types.model("AccountLlmBillingStatus", {
  planId: types.maybeNull(types.string),
  entitlement: BillingEntitlementStatusModel,
});

export const ShopBillingStatusModel = types.model("ShopBillingStatus", {
  shopId: types.identifier,
  shopName: types.string,
  customerService: BillingEntitlementStatusModel,
  inventory: BillingEntitlementStatusModel,
  affiliate: BillingEntitlementStatusModel,
});

export const BillingOverviewModel = types.model("BillingOverview", {
  accountLlm: AccountLlmBillingStatusModel,
  shops: types.optional(types.array(ShopBillingStatusModel), []),
});

export const BillingPlanDefinitionModel = types.model("BillingPlanDefinition", {
  planId: types.identifier,
  name: types.string,
  product: types.string,
  priceCurrency: types.string,
  priceMonthly: types.string,
  priceMonthlyCny: types.maybeNull(types.string),
  priceMonthlyCnyMinor: types.maybeNull(types.integer),
  usdToCnyRate: types.maybeNull(types.string),
  exchangeRateDate: types.maybeNull(types.string),
  metered: types.boolean,
});

export const PaymentModel = types.model("Payment", {
  id: types.identifier,
  userId: types.string,
  provider: types.string,
  method: types.string,
  status: types.string,
  currency: types.string,
  amountMinor: types.integer,
  billingActivatedAt: types.maybeNull(types.string),
  billingPlanId: types.maybeNull(types.string),
  billingProduct: types.maybeNull(types.string),
  billingScopeId: types.maybeNull(types.string),
  billingScopeType: types.maybeNull(types.string),
  subject: types.string,
  description: types.maybeNull(types.string),
  merchantOrderId: types.string,
  providerPaymentId: types.maybeNull(types.string),
  providerOrderId: types.maybeNull(types.string),
  providerSubscriptionId: types.maybeNull(types.string),
  checkoutUrl: types.maybeNull(types.string),
  qrCode: types.maybeNull(types.string),
  lastError: types.maybeNull(types.string),
  createdAt: types.string,
  updatedAt: types.string,
  paidAt: types.maybeNull(types.string),
  expiresAt: types.maybeNull(types.string),
  lastProviderEventAt: types.maybeNull(types.string),
});

export interface BillingUsageStatus extends Instance<typeof BillingUsageStatusModel> {}
export interface BillingSubscriptionSummary extends Instance<typeof BillingSubscriptionSummaryModel> {}
export interface BillingEntitlementStatus extends Instance<typeof BillingEntitlementStatusModel> {}
export interface AccountLlmBillingStatus extends Instance<typeof AccountLlmBillingStatusModel> {}
export interface ShopBillingStatus extends Instance<typeof ShopBillingStatusModel> {}
export interface BillingOverview extends Instance<typeof BillingOverviewModel> {}
export interface BillingPlanDefinition extends Instance<typeof BillingPlanDefinitionModel> {}
export interface Payment extends Instance<typeof PaymentModel> {}
