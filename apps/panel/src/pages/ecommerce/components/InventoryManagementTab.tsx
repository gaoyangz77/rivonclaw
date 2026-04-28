import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import type { Shop, ShopWarehouse, Warehouse } from "@rivonclaw/core/models";
import { Select } from "../../../components/inputs/Select.js";
import { RefreshIcon } from "../../../components/icons.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";

interface InventoryManagementTabProps {
  shop: Shop;
}

function formatWarehouseOption(warehouse: Warehouse) {
  const code = warehouse.code || warehouse.externalWarehouseId;
  const suffix = [code, warehouse.regionCode].filter(Boolean).join(" · ");
  return suffix ? `${warehouse.name} (${suffix})` : warehouse.name;
}

function platformWarehouseCode(shopWarehouse: ShopWarehouse) {
  return shopWarehouse.platformEntityId || shopWarehouse.platformWarehouseId;
}

function shopWarehouseMappingState(shopWarehouse: ShopWarehouse) {
  return shopWarehouse.warehouseId ? "MAPPED" : "UNMAPPED";
}

function shopWarehouseRoleDirection(type: string) {
  if (type === "RETURN") return "\u2190";
  if (type === "SALES") return "\u2192";
  return "";
}

function shopWarehouseRoleClass(type: string) {
  if (type === "RETURN") return "inventory-role-chip-warning";
  if (type === "SALES") return "inventory-role-chip-primary";
  return "inventory-role-chip-muted";
}

interface ShopWarehouseRow {
  shopWarehouse: ShopWarehouse;
  mappedWarehouse: Warehouse | null;
  isReadOnlyMapping: boolean;
}

export const InventoryManagementTab = observer(function InventoryManagementTab({ shop }: InventoryManagementTabProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const inventory = entityStore.ecommerceInventory;

  const shopWarehouses = entityStore.shopWarehouses.filter((warehouse) => warehouse.shopId === shop.id);
  const canonicalWarehouses = entityStore.warehouses.filter((warehouse) => warehouse.status === "ACTIVE");
  const manuallyMappableWarehouses = canonicalWarehouses.filter((warehouse) => warehouse.warehouseType !== "OFFICIAL_PLATFORM");
  const activeShopWarehouseTab = inventory.getShopWarehouseTab(shop.id);

  useEffect(() => {
    inventory.fetchShopInventory(shop.id).catch(() => {});
  }, [inventory, shop.id]);

  const shopWarehouseRows: ShopWarehouseRow[] = shopWarehouses.map((shopWarehouse) => {
    const mappedWarehouse = shopWarehouse.warehouseId
      ? canonicalWarehouses.find((warehouse) => warehouse.id === shopWarehouse.warehouseId) ?? null
      : null;
    const isOfficialMapping = mappedWarehouse?.warehouseType === "OFFICIAL_PLATFORM";

    return {
      shopWarehouse,
      mappedWarehouse,
      isReadOnlyMapping: isOfficialMapping,
    };
  });
  const readOnlyWarehouseRows = shopWarehouseRows.filter((row) => row.isReadOnlyMapping);
  const editableWarehouseRows = shopWarehouseRows.filter((row) => !row.isReadOnlyMapping);
  const activeWarehouseRows = activeShopWarehouseTab === "official" ? readOnlyWarehouseRows : editableWarehouseRows;

  const warehouseOptions = manuallyMappableWarehouses.map((warehouse) => ({
    value: warehouse.id,
    label: formatWarehouseOption(warehouse),
    description: t(`ecommerce.inventory.warehouseProviders.${warehouse.provider}`, { defaultValue: warehouse.provider }),
  }));

  return (
    <div className="shop-detail-section inventory-management-tab">
      <div className="inventory-tab-toolbar">
        <div>
          <div className="drawer-section-label">{t("ecommerce.inventory.shopWarehouses")}</div>
          <div className="form-hint">{t("ecommerce.inventory.shopWarehousesHint")}</div>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => inventory.syncShopWarehouses(shop.id).catch(() => {})}
          disabled={inventory.isShopSyncing(shop.id)}
        >
          <RefreshIcon className={inventory.isShopSyncing(shop.id) ? "spin" : ""} />
          {inventory.isShopSyncing(shop.id) ? t("common.loading") : t("ecommerce.inventory.syncShopWarehouses")}
        </button>
      </div>

      {inventory.shopInventoryError && (
        <div className="form-hint form-hint-error">{inventory.shopInventoryError}</div>
      )}

      {inventory.isShopInventoryLoading(shop.id) && shopWarehouses.length === 0 ? (
        <div className="loading-state">{t("common.loading")}</div>
      ) : shopWarehouses.length === 0 ? (
        <div className="shop-info-card">
          <div className="shop-info-card-hint">{t("ecommerce.inventory.noShopWarehouses")}</div>
          <div className="modal-actions inventory-empty-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => inventory.syncShopWarehouses(shop.id).catch(() => {})}
              disabled={inventory.isShopSyncing(shop.id)}
            >
              {inventory.isShopSyncing(shop.id) ? t("common.loading") : t("ecommerce.inventory.syncShopWarehouses")}
            </button>
          </div>
        </div>
      ) : (
        <div className="shop-info-card inventory-mapping-list">
          <div className="inventory-shop-warehouse-tabs">
            <button
              type="button"
              className={`inventory-shop-warehouse-tab${activeShopWarehouseTab === "thirdParty" ? " inventory-shop-warehouse-tab-active" : ""}`}
              onClick={() => inventory.setShopWarehouseTab(shop.id, "thirdParty")}
            >
              <span>{t("ecommerce.inventory.thirdPartyWarehouseTab")}</span>
              <span className="badge badge-muted">{editableWarehouseRows.length}</span>
            </button>
            <button
              type="button"
              className={`inventory-shop-warehouse-tab${activeShopWarehouseTab === "official" ? " inventory-shop-warehouse-tab-active" : ""}`}
              onClick={() => inventory.setShopWarehouseTab(shop.id, "official")}
            >
              <span>{t("ecommerce.inventory.officialWarehouseTab")}</span>
              <span className="badge badge-muted">{readOnlyWarehouseRows.length}</span>
            </button>
          </div>

          {activeWarehouseRows.length === 0 ? (
            <div className="shop-info-card-hint inventory-tab-empty">
              {activeShopWarehouseTab === "official"
                ? t("ecommerce.inventory.noOfficialShopWarehouses")
                : t("ecommerce.inventory.noThirdPartyShopWarehouses")}
            </div>
          ) : (
            <>
              <div className="inventory-mapping-header">
                <span>{t("ecommerce.inventory.shopWarehouseColumn")}</span>
                <span>{t("ecommerce.inventory.warehouseStatusColumn")}</span>
                <span>{t("ecommerce.inventory.canonicalWarehouseColumn")}</span>
              </div>
              {activeWarehouseRows.map(({ shopWarehouse, mappedWarehouse, isReadOnlyMapping }) => {
            const saving = inventory.isShopWarehouseMappingSaving(shopWarehouse.id);
            const mappingState = shopWarehouseMappingState(shopWarehouse);

            return (
              <div
                className={`inventory-mapping-row${isReadOnlyMapping ? " inventory-mapping-row-readonly" : ""}`}
                key={shopWarehouse.id}
              >
                <div className="inventory-shop-warehouse">
                  <div className="inventory-row-title">
                    <span>{shopWarehouse.name}</span>
                    {shopWarehouse.isDefault && (
                      <span className="inventory-default-mark">{t("ecommerce.inventory.defaultWarehouse")}</span>
                    )}
                    <span className={`inventory-role-chip ${shopWarehouseRoleClass(shopWarehouse.warehouseType)}`}>
                      <span className="inventory-role-arrow">{shopWarehouseRoleDirection(shopWarehouse.warehouseType)}</span>
                      {t(`ecommerce.inventory.shopWarehouseTypes.${shopWarehouse.warehouseType}`, { defaultValue: shopWarehouse.warehouseType })}
                    </span>
                  </div>
                  <div className="inventory-row-meta">
                    <span className="inventory-platform-id">{platformWarehouseCode(shopWarehouse)}</span>
                  </div>
                </div>
                <div className="inventory-row-state">
                  <div className="inventory-status-line">
                    <span className={shopWarehouse.warehouseId ? "inventory-chip inventory-chip-green" : "inventory-chip inventory-chip-muted"}>
                      {t(`ecommerce.inventory.mappingState.${mappingState}`, { defaultValue: mappingState })}
                    </span>
                  </div>
                </div>
                {isReadOnlyMapping ? (
                  <div className="inventory-readonly-mapping">
                    <div className="inventory-readonly-mapping-main">
                      {mappedWarehouse ? formatWarehouseOption(mappedWarehouse) : "\u2014"}
                    </div>
                    <div className="td-meta">{t("ecommerce.inventory.managedByPlatform")}</div>
                  </div>
                ) : (
                  <div className="inventory-mapping-control">
                    <Select
                      value={shopWarehouse.warehouseId ?? ""}
                      onChange={(warehouseId) => {
                        inventory.writeShopWarehouseMapping(shop.id, shopWarehouse.id, warehouseId || null).catch(() => {});
                      }}
                      options={warehouseOptions}
                      disabled={saving}
                      searchable
                      className="input-full"
                    />
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => inventory.writeShopWarehouseMapping(shop.id, shopWarehouse.id, null).catch(() => {})}
                      disabled={saving || !shopWarehouse.warehouseId}
                    >
                      {saving ? t("common.loading") : t("ecommerce.inventory.clearMapping")}
                    </button>
                  </div>
                )}
              </div>
            );
              })}
            </>
          )}
        </div>
      )}

    </div>
  );
});
