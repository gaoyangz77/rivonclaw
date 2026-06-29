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
  ownerType: types.string,
  advertiserId: types.string,
  advertiserName: types.maybeNull(types.string),
  advertiserRole: types.maybeNull(types.string),
  platformStatus: types.maybeNull(types.string),
  currency: types.maybeNull(types.string),
  timezone: types.maybeNull(types.string),
  biSyncStatus: types.maybeNull(types.string),
  lastBiSyncError: types.maybeNull(types.string),
  lastContextSyncedAt: types.maybeNull(types.string),
  lastStoreAccessSyncedAt: types.maybeNull(types.string),
  lastAdsObjectSyncedAt: types.maybeNull(types.string),
  lastReportSyncedAt: types.maybeNull(types.string),
  syncHealthStatus: types.optional(types.string, "HEALTHY"),
  syncIssueCode: types.maybeNull(types.string),
  syncIssueMessage: types.maybeNull(types.string),
  syncIssueDetectedAt: types.maybeNull(types.string),
  syncHealthCheckedAt: types.maybeNull(types.string),
  auth: AdsAdvertiserAuthModel,
  createdAt: types.string,
  updatedAt: types.string,
});

export interface AdsAdvertiser extends Instance<typeof AdsAdvertiserModel> {}
export interface AdsAdvertiserAuth extends Instance<typeof AdsAdvertiserAuthModel> {}
