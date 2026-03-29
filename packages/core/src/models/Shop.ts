import { types, type Instance } from "mobx-state-tree";

export const CustomerServiceConfigModel = types.model("CustomerServiceConfig", {
  enabled: types.optional(types.boolean, false),
  businessPrompt: types.optional(types.string, ""),
  csDeviceId: types.maybeNull(types.string),
  csModelOverride: types.maybeNull(types.string),
  runProfileId: types.maybeNull(types.string),
  assembledPrompt: types.maybeNull(types.string),
});

export const CustomerServiceBillingModel = types.model("CustomerServiceBilling", {
  balance: types.optional(types.integer, 0),
  balanceExpiresAt: types.maybeNull(types.string),
  periodEnd: types.maybeNull(types.string),
  tier: types.maybeNull(types.string),
});

export const ShopServiceConfigModel = types.model("ShopServiceConfig", {
  customerService: types.maybeNull(CustomerServiceConfigModel),
  customerServiceBilling: types.maybeNull(CustomerServiceBillingModel),
});

export const ShopModel = types.model("Shop", {
  id: types.identifier,
  platform: types.string,
  platformAppId: types.optional(types.string, ""),
  platformShopId: types.string,
  shopName: types.string,
  authStatus: types.optional(types.string, ""),
  region: types.optional(types.string, ""),
  accessTokenExpiresAt: types.maybeNull(types.string),
  refreshTokenExpiresAt: types.maybeNull(types.string),
  services: types.maybeNull(ShopServiceConfigModel),
});

export interface Shop extends Instance<typeof ShopModel> {}
export interface CustomerServiceConfig extends Instance<typeof CustomerServiceConfigModel> {}
export interface CustomerServiceBilling extends Instance<typeof CustomerServiceBillingModel> {}
export interface ShopServiceConfig extends Instance<typeof ShopServiceConfigModel> {}
