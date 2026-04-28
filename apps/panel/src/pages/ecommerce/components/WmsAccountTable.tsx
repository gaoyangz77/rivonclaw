import { Fragment, useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import type { Warehouse, WmsAccount } from "@rivonclaw/core/models";
import { ChevronRightIcon, RefreshIcon } from "../../../components/icons.js";
import { ConfirmDialog } from "../../../components/modals/ConfirmDialog.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";

interface WmsAccountTableProps {
  accounts: WmsAccount[];
  warehouses: Warehouse[];
  onAddAccount: () => void;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "\u2014";
}

function warehouseCode(warehouse: Warehouse) {
  return warehouse.code || warehouse.externalWarehouseId || "\u2014";
}

function currencyLabel(t: (key: string, options?: any) => string, currency?: string | null) {
  return currency ? t(`ecommerce.inventory.currencies.${currency}`, { defaultValue: currency }) : "\u2014";
}

export const WmsAccountTable = observer(function WmsAccountTable({
  accounts,
  warehouses,
  onAddAccount,
}: WmsAccountTableProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const inventory = entityStore.ecommerceInventory;
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
  const deleteAccount = deleteAccountId ? accounts.find((account) => account.id === deleteAccountId) : null;

  return (
    <div className="section-card ecommerce-inventory-section">
      <div className="ecommerce-section-header">
        <div>
          <h3>{t("ecommerce.inventory.wmsAccounts")}</h3>
          <p className="ecommerce-section-subtitle">{t("ecommerce.inventory.wmsAccountsSubtitle")}</p>
        </div>
        <div className="ecommerce-section-actions">
          <button
            className="btn-icon-inline"
            onClick={() => inventory.fetchWmsInventory().catch(() => {})}
            disabled={inventory.wmsInventoryLoading}
            aria-label={t("ecommerce.inventory.refreshInventory")}
            title={t("ecommerce.inventory.refreshInventory")}
          >
            <RefreshIcon className={inventory.wmsInventoryLoading ? "spin" : ""} />
          </button>
          <button className="btn btn-primary btn-sm" onClick={onAddAccount}>
            {t("ecommerce.inventory.addWmsAccount")}
          </button>
        </div>
      </div>

      {inventory.wmsInventoryError && (
        <div className="form-hint form-hint-error">{inventory.wmsInventoryError}</div>
      )}

      {accounts.length === 0 ? (
        <div className="empty-cell">{t("ecommerce.inventory.noWmsAccounts")}</div>
      ) : (
        <div className="table-scroll-wrap wms-table-wrap">
          <table className="shop-table wms-account-table">
            <thead>
              <tr>
                <th />
                <th>{t("ecommerce.inventory.label")}</th>
                <th>{t("ecommerce.inventory.provider")}</th>
                <th>{t("ecommerce.inventory.currency")}</th>
                <th>{t("ecommerce.inventory.endpoint")}</th>
                <th>{t("ecommerce.inventory.syncedWarehouses")}</th>
                <th>{t("ecommerce.inventory.lastSyncedAt")}</th>
                <th className="text-right">{t("ecommerce.table.headers.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const accountWarehouses = warehouses.filter((warehouse) => warehouse.sourceId === account.id);
                const expanded = inventory.isWmsAccountExpanded(account.id);
                const syncing = inventory.isWmsAccountSyncing(account.id);
                const syncingGoods = inventory.isWmsInventoryGoodsWorkflowBusy(account.id);
                const deleting = inventory.isWmsAccountDeleting(account.id);

                return (
                  <Fragment key={account.id}>
                    <tr>
                      <td className="wms-expand-cell">
                        <button
                          className={`wms-expand-btn${expanded ? " wms-expand-btn-open" : ""}`}
                          onClick={() => inventory.toggleWmsAccountExpanded(account.id)}
                          aria-label={expanded ? t("ecommerce.inventory.collapse") : t("ecommerce.inventory.expand")}
                        >
                          <ChevronRightIcon />
                        </button>
                      </td>
                      <td>
                        <div className="wms-account-label">
                          <span className="shop-table-name">{account.label}</span>
                          {account.lastSyncError && <span className="badge badge-danger">{t("ecommerce.inventory.syncError")}</span>}
                        </div>
                      </td>
                      <td>{t(`ecommerce.inventory.providers.${account.provider}`, { defaultValue: account.provider })}</td>
                      <td>{currencyLabel(t, account.declaredValueCurrency)}</td>
                      <td className="td-meta wms-endpoint-cell">{account.endpoint}</td>
                      <td>{accountWarehouses.length}</td>
                      <td className="td-date">{formatDate(account.lastSyncedAt)}</td>
                      <td className="text-right">
                        <div className="td-actions shop-table-actions wms-account-actions">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => inventory.syncWmsWarehouses(account.id).catch(() => {})}
                            disabled={syncing || syncingGoods || deleting}
                          >
                            {syncing ? t("common.loading") : t("ecommerce.inventory.syncWarehouses")}
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => inventory.openEditWmsAccountModal(account)}
                            disabled={syncing || syncingGoods || deleting}
                          >
                            {t("common.edit")}
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => inventory.startWmsInventoryGoodsSyncWorkflow(account.id).catch(() => {})}
                            disabled={syncing || syncingGoods || deleting}
                          >
                            {syncingGoods ? t("common.loading") : t("ecommerce.inventory.syncInventoryGoods")}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setDeleteAccountId(account.id)}
                            disabled={syncing || syncingGoods || deleting}
                          >
                            {deleting ? t("common.loading") : t("common.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="wms-expanded-row">
                        <td />
                        <td colSpan={7}>
                          {account.lastSyncError && (
                            <div className="form-hint form-hint-error">{account.lastSyncError}</div>
                          )}
                          {accountWarehouses.length === 0 ? (
                            <div className="empty-cell">{t("ecommerce.inventory.noSyncedWarehouses")}</div>
                          ) : (
                            <div className="wms-warehouse-list">
                              <div className="wms-warehouse-list-header">
                                <span>{t("ecommerce.inventory.warehouseName")}</span>
                                <span>{t("ecommerce.inventory.warehouseCode")}</span>
                                <span>{t("ecommerce.inventory.warehouseType")}</span>
                                <span>{t("ecommerce.inventory.region")}</span>
                              </div>
                              {accountWarehouses.map((warehouse) => (
                                <div className="wms-warehouse-row" key={warehouse.id}>
                                  <div className="shop-table-name">{warehouse.name}</div>
                                  <div className="td-meta">{warehouseCode(warehouse)}</div>
                                  <div>
                                    {t(`ecommerce.inventory.warehouseTypes.${warehouse.warehouseType}`, { defaultValue: warehouse.warehouseType })}
                                  </div>
                                  <div>{warehouse.regionCode || "\u2014"}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="wms-card-footer-actions">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => inventory.setInventoryGoodsDrawerOpen(true)}
        >
          {t("ecommerce.inventory.inventoryGoods")}
        </button>
      </div>

      <ConfirmDialog
        isOpen={Boolean(deleteAccount)}
        title={t("ecommerce.inventory.deleteWmsAccount")}
        message={t("ecommerce.inventory.confirmDeleteWmsAccount", { label: deleteAccount?.label ?? "" })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        confirmVariant="danger"
        onCancel={() => setDeleteAccountId(null)}
        onConfirm={() => {
          if (!deleteAccount) return;
          inventory.archiveWmsAccount(deleteAccount.id)
            .then(() => setDeleteAccountId(null))
            .catch(() => {});
        }}
      />
    </div>
  );
});
