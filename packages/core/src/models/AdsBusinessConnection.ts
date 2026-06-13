import { types, type Instance } from "mobx-state-tree";

export const AdsBusinessConnectionModel = types.model("AdsBusinessConnection", {
  id: types.identifier,
  userId: types.string,
  platform: types.string,
  authGrantId: types.string,
  authStatus: types.string,
  displayName: types.maybeNull(types.string),
  authorizedAt: types.maybeNull(types.string),
  accessTokenExpiresAt: types.maybeNull(types.string),
  refreshTokenExpiresAt: types.maybeNull(types.string),
  advertiserCount: types.number,
  managedShopCount: types.number,
  lastSyncedAt: types.maybeNull(types.string),
  lastError: types.maybeNull(types.string),
  createdAt: types.string,
  updatedAt: types.string,
});

export interface AdsBusinessConnection extends Instance<typeof AdsBusinessConnectionModel> {}
