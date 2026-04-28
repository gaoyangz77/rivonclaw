import { types, type Instance } from "mobx-state-tree";

export const InventoryGoodModel = types.model("InventoryGood", {
  id: types.identifier,
  userId: types.string,
  sku: types.string,
  name: types.string,
  status: types.string,
  gtin: types.maybeNull(types.string),
  barcode: types.maybeNull(types.string),
  hsCode: types.maybeNull(types.string),
  countryOfOrigin: types.maybeNull(types.string),
  weightValue: types.maybeNull(types.number),
  weightUnit: types.maybeNull(types.string),
  lengthValue: types.maybeNull(types.number),
  widthValue: types.maybeNull(types.number),
  heightValue: types.maybeNull(types.number),
  dimensionUnit: types.maybeNull(types.string),
  declaredValue: types.maybeNull(types.number),
  declaredValueCurrency: types.maybeNull(types.string),
  isBattery: types.maybeNull(types.boolean),
  isHazmat: types.maybeNull(types.boolean),
  imageAssetId: types.maybeNull(types.string),
  imageUri: types.maybeNull(types.string),
  createdAt: types.string,
  updatedAt: types.string,
});

export interface InventoryGood extends Instance<typeof InventoryGoodModel> {}
