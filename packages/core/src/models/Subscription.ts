import { types, type Instance } from "mobx-state-tree";

export const BillingUsageStatusModel = types.model("BillingUsageStatus", {
  metric: types.string,
  window: types.string,
  used: types.integer,
  limit: types.integer,
  remaining: types.integer,
  refreshAt: types.string,
});

export const BillingEntitlementStatusModel = types.model("BillingEntitlementStatus", {
  scopeType: types.string,
  scopeId: types.string,
  product: types.string,
  allowed: types.boolean,
  code: types.string,
  source: types.maybeNull(types.string),
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
});

export const BillingOverviewModel = types.model("BillingOverview", {
  accountLlm: AccountLlmBillingStatusModel,
  shops: types.optional(types.array(ShopBillingStatusModel), []),
});

export interface BillingUsageStatus extends Instance<typeof BillingUsageStatusModel> {}
export interface BillingEntitlementStatus extends Instance<typeof BillingEntitlementStatusModel> {}
export interface AccountLlmBillingStatus extends Instance<typeof AccountLlmBillingStatusModel> {}
export interface ShopBillingStatus extends Instance<typeof ShopBillingStatusModel> {}
export interface BillingOverview extends Instance<typeof BillingOverviewModel> {}
