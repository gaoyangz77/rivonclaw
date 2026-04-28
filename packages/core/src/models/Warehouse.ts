import { types, type Instance } from "mobx-state-tree";

export const WarehouseAddressModel = types.model("WarehouseAddress", {
  addressLine1: types.maybeNull(types.string),
  addressLine2: types.maybeNull(types.string),
  city: types.maybeNull(types.string),
  district: types.maybeNull(types.string),
  fullAddress: types.maybeNull(types.string),
  postalCode: types.maybeNull(types.string),
  region: types.maybeNull(types.string),
  regionCode: types.maybeNull(types.string),
  state: types.maybeNull(types.string),
});

export const WmsAccountModel = types.model("WmsAccount", {
  id: types.identifier,
  userId: types.string,
  provider: types.string,
  label: types.string,
  endpoint: types.string,
  declaredValueCurrency: types.maybeNull(types.string),
  status: types.string,
  lastSyncedAt: types.maybeNull(types.string),
  lastSyncError: types.maybeNull(types.string),
  notes: types.maybeNull(types.string),
  createdAt: types.string,
  updatedAt: types.string,
});

export const WarehouseModel = types.model("Warehouse", {
  id: types.identifier,
  userId: types.string,
  provider: types.string,
  warehouseType: types.string,
  name: types.string,
  code: types.maybeNull(types.string),
  externalWarehouseId: types.maybeNull(types.string),
  sourceId: types.maybeNull(types.string),
  regionCode: types.maybeNull(types.string),
  address: types.maybeNull(WarehouseAddressModel),
  status: types.string,
  lastSyncedAt: types.maybeNull(types.string),
  notes: types.maybeNull(types.string),
  createdAt: types.string,
  updatedAt: types.string,
});

export const ShopWarehouseModel = types.model("ShopWarehouse", {
  id: types.identifier,
  userId: types.string,
  shopId: types.string,
  platformWarehouseId: types.string,
  platformEntityId: types.maybeNull(types.string),
  platformSubType: types.maybeNull(types.string),
  warehouseId: types.maybeNull(types.string),
  warehouseType: types.string,
  name: types.string,
  regionCode: types.maybeNull(types.string),
  address: types.maybeNull(WarehouseAddressModel),
  effectStatus: types.string,
  isDefault: types.boolean,
  status: types.string,
  lastSyncedAt: types.maybeNull(types.string),
  notes: types.maybeNull(types.string),
  createdAt: types.string,
  updatedAt: types.string,
});

export interface WarehouseAddress extends Instance<typeof WarehouseAddressModel> {}
export interface WmsAccount extends Instance<typeof WmsAccountModel> {}
export interface Warehouse extends Instance<typeof WarehouseModel> {}
export interface ShopWarehouse extends Instance<typeof ShopWarehouseModel> {}
