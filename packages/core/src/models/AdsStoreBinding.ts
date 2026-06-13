import { types, type Instance } from "mobx-state-tree";

export const AdsStoreBindingModel = types.model("AdsStoreBinding", {
  id: types.identifier,
  userId: types.string,
  platform: types.string,
  adsAdvertiserId: types.maybeNull(types.string),
  advertiserId: types.string,
  shopId: types.maybeNull(types.string),
  linkedShopId: types.optional(types.maybeNull(types.string), null),
  shopPlatformShopId: types.optional(types.maybeNull(types.string), null),
  linkedShopName: types.optional(types.maybeNull(types.string), null),
  linkedShopAuthStatus: types.optional(types.maybeNull(types.string), null),
  linkStatus: types.optional(types.string, "UNMATCHED"),
  isManagedByEasyClaw: types.optional(types.boolean, false),
  storeId: types.string,
  storeName: types.maybeNull(types.string),
  storeAuthorizedBcId: types.maybeNull(types.string),
  businessCenterId: types.maybeNull(types.string),
  storeRole: types.maybeNull(types.string),
  storeStatus: types.maybeNull(types.string),
  isGmvMaxAvailable: types.maybeNull(types.boolean),
  exclusiveAuthorizedAdvertiserId: types.maybeNull(types.string),
  exclusiveAuthorizationStatus: types.maybeNull(types.string),
  createdAt: types.string,
  updatedAt: types.string,
});

export interface AdsStoreBinding extends Instance<typeof AdsStoreBindingModel> {}
