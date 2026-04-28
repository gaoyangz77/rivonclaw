import {
  WmsAccountModel as WmsAccountModelBase,
  WarehouseModel as WarehouseModelBase,
  ShopWarehouseModel as ShopWarehouseModelBase,
} from "@rivonclaw/core/models";

export const WmsAccountModel = WmsAccountModelBase.views((self) => ({
  get displayLabel() {
    return self.label || self.provider;
  },
  get hasSyncError() {
    return Boolean(self.lastSyncError);
  },
}));

export const WarehouseModel = WarehouseModelBase.views((self) => ({
  get displayCode() {
    return self.code || self.externalWarehouseId || self.id;
  },
  get isThirdPartyWms() {
    return self.warehouseType === "THIRD_PARTY_WMS";
  },
  get isOfficialPlatform() {
    return self.warehouseType === "OFFICIAL_PLATFORM";
  },
}));

export const ShopWarehouseModel = ShopWarehouseModelBase.views((self) => ({
  get platformDisplayId() {
    return self.platformEntityId || self.platformWarehouseId;
  },
  get isMapped() {
    return Boolean(self.warehouseId);
  },
}));
