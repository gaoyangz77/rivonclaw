import { types, type Instance } from "mobx-state-tree";

export const AdsAdvertiserAuthModel = types.model("AdsAdvertiserAuth", {
  status: types.string,
  accessTokenExpiresAt: types.maybeNull(types.string),
  refreshTokenExpiresAt: types.maybeNull(types.string),
  authorizedAt: types.maybeNull(types.string),
  lastRefreshedAt: types.maybeNull(types.string),
  lastError: types.maybeNull(types.string),
});

export const AdsAdvertiserModel = types.model("AdsAdvertiser", {
  id: types.identifier,
  userId: types.string,
  platform: types.string,
  businessConnectionId: types.optional(types.maybeNull(types.string), null),
  ownerType: types.string,
  advertiserId: types.string,
  advertiserName: types.maybeNull(types.string),
  advertiserRole: types.maybeNull(types.string),
  platformStatus: types.maybeNull(types.string),
  currency: types.maybeNull(types.string),
  timezone: types.maybeNull(types.string),
  auth: AdsAdvertiserAuthModel,
  createdAt: types.string,
  updatedAt: types.string,
});

export interface AdsAdvertiser extends Instance<typeof AdsAdvertiserModel> {}
export interface AdsAdvertiserAuth extends Instance<typeof AdsAdvertiserAuthModel> {}
