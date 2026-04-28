import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import type { InventoryGood } from "@rivonclaw/core/models";
import { CloseIcon, EcommerceIcon, RefreshIcon } from "../../../components/icons.js";
import { ImageAssetPreview } from "../../../components/images/ImageAssetPreview.js";
import { ConfirmDialog } from "../../../components/modals/ConfirmDialog.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { inventoryGoodImageUrl } from "../../../store/models/InventoryGoodModel.js";

function imageUrl(good: InventoryGood) {
  return inventoryGoodImageUrl(good.imageUri);
}

function currencySymbol(currency?: string | null) {
  if (currency === "USD") return "$";
  if (currency === "CNY") return "\u00A5";
  return currency ? `${currency} ` : "";
}

function formatMoney(good: InventoryGood) {
  if (good.declaredValue == null) return "\u2014";
  return `${currencySymbol(good.declaredValueCurrency)}${good.declaredValue}`;
}

function formatDimensions(good: InventoryGood) {
  const values = [good.lengthValue, good.widthValue, good.heightValue].filter((v) => v != null);
  if (values.length === 0) return "\u2014";
  return `${[good.lengthValue ?? "-", good.widthValue ?? "-", good.heightValue ?? "-"].join(" x ")} ${good.dimensionUnit ?? ""}`.trim();
}

export const InventoryGoodsDrawer = observer(function InventoryGoodsDrawer() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const inventory = entityStore.ecommerceInventory;
  const goods = inventory.pagedInventoryGoods as InventoryGood[];
  const pageCount = inventory.inventoryGoodsPageCount;
  const filteredCount = inventory.inventoryGoodsFilteredCount;
  const [deleteOneId, setDeleteOneId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [pageInput, setPageInput] = useState(String(inventory.inventoryGoodsPage));
  const deleteOne = deleteOneId ? goods.find((good) => good.id === deleteOneId) : null;
  const allSelected = goods.length > 0 && goods.every((good) => inventory.isInventoryGoodSelected(good.id));
  const hasInventoryGoodsFilters = inventory.inventoryGoodsSearch.trim() !== "";
  const columnOptions = [
    { key: "image", label: t("ecommerce.inventory.image") },
    { key: "good", label: t("ecommerce.inventory.inventoryGoodColumn") },
    { key: "barcodeGtin", label: t("ecommerce.inventory.barcodeGtin") },
    { key: "measurements", label: t("ecommerce.inventory.measurements") },
    { key: "declaredValue", label: t("ecommerce.inventory.declaredValueShort") },
    { key: "flags", label: t("ecommerce.inventory.flags") },
  ];
  const showColumn = (column: string) => inventory.isInventoryGoodsColumnVisible(column);

  useEffect(() => {
    setPageInput(String(inventory.inventoryGoodsPage));
  }, [inventory.inventoryGoodsPage, pageCount]);

  return (
    <>
      <div
        className={`drawer-overlay${inventory.inventoryGoodsDrawerOpen ? " drawer-overlay-visible" : ""}`}
        onClick={() => inventory.setInventoryGoodsDrawerOpen(false)}
      />
      <div className={`drawer-panel inventory-goods-drawer${inventory.inventoryGoodsDrawerOpen ? " drawer-panel-open" : ""}`}>
        <div className="drawer-header">
          <div className="drawer-header-left">
            <span className="drawer-header-icon">
              <EcommerceIcon size={20} />
            </span>
            <div className="drawer-header-info">
              <h3 className="drawer-header-title">{t("ecommerce.inventory.inventoryGoods")}</h3>
              <span className="td-meta">{t("ecommerce.inventory.inventoryGoodsSubtitle")}</span>
            </div>
          </div>
          <button className="drawer-close-btn" onClick={() => inventory.setInventoryGoodsDrawerOpen(false)}>
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="drawer-body inventory-goods-drawer-body">
          <div className="inventory-goods-toolbar">
            <div className="inventory-goods-toolbar-left">
              <button
                className="btn-icon-inline"
                onClick={() => inventory.fetchInventoryGoods().catch(() => {})}
                disabled={inventory.inventoryGoodsLoading}
                aria-label={t("ecommerce.inventory.refreshInventoryGoods")}
                title={t("ecommerce.inventory.refreshInventoryGoods")}
              >
                <RefreshIcon className={inventory.inventoryGoodsLoading ? "spin" : ""} />
              </button>
              {inventory.selectedInventoryGoodIds.length > 0 && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setConfirmBulkDelete(true)}
                  disabled={inventory.deletingInventoryGoodIds.length > 0}
                >
                  {t("ecommerce.inventory.deleteSelectedInventoryGoods", { count: inventory.selectedInventoryGoodIds.length })}
                </button>
              )}
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => inventory.openAddInventoryGoodModal()}>
              {t("ecommerce.inventory.addInventoryGood")}
            </button>
          </div>

          <form
            className="inventory-goods-filter-bar"
            onSubmit={(e) => {
              e.preventDefault();
              inventory.applyInventoryGoodsFilters().catch(() => {});
            }}
          >
            <label className="inventory-goods-filter-field">
              <span>{t("ecommerce.inventory.searchInventoryGoods")}</span>
              <input
                className="form-input"
                value={inventory.inventoryGoodsSearch}
                onChange={(e) => inventory.setInventoryGoodsSearch(e.target.value)}
                placeholder={t("ecommerce.inventory.searchInventoryGoodsPlaceholder")}
                disabled={inventory.inventoryGoodsLoading}
              />
            </label>
            <div className="inventory-goods-filter-actions">
              <button className="btn btn-secondary btn-sm" type="submit" disabled={inventory.inventoryGoodsLoading}>
                {t("ecommerce.inventory.applyInventoryGoodsFilters")}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => inventory.resetInventoryGoodsFilters().catch(() => {})}
                disabled={inventory.inventoryGoodsLoading}
              >
                {t("ecommerce.inventory.resetInventoryGoodsFilters")}
              </button>
              <details className="inventory-goods-column-selector">
                <summary className="btn btn-secondary btn-sm">
                  {t("ecommerce.inventory.columns")}
                </summary>
                <div className="inventory-goods-column-menu">
                  {columnOptions.map((column) => (
                    <label className="checkbox-row" key={column.key}>
                      <input
                        type="checkbox"
                        checked={showColumn(column.key)}
                        onChange={() => inventory.toggleInventoryGoodsColumn(column.key)}
                      />
                      <span>{column.label}</span>
                    </label>
                  ))}
                </div>
              </details>
            </div>
          </form>

          {inventory.inventoryGoodsError && (
            <div className="form-hint form-hint-error">{inventory.inventoryGoodsError}</div>
          )}

          {inventory.inventoryGoodsLoading && goods.length === 0 ? (
            <div className="empty-cell">{t("common.loading")}</div>
          ) : goods.length === 0 ? (
            <div className="empty-cell">
              {t(hasInventoryGoodsFilters ? "ecommerce.inventory.noInventoryGoodsForFilters" : "ecommerce.inventory.noInventoryGoods")}
            </div>
          ) : (
            <div className="table-scroll-wrap inventory-goods-table-wrap">
              <table className="shop-table inventory-goods-table">
                <thead>
                  <tr>
                    <th className="inventory-goods-select-cell">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => inventory.setAllInventoryGoodsSelected(goods.map((good) => good.id), e.target.checked)}
                        aria-label={t("ecommerce.inventory.selectAllInventoryGoods")}
                      />
                    </th>
                    {showColumn("image") && <th className="inventory-goods-image-cell">{t("ecommerce.inventory.image")}</th>}
                    {showColumn("good") && <th className="inventory-goods-good-cell">{t("ecommerce.inventory.inventoryGoodColumn")}</th>}
                    {showColumn("barcodeGtin") && <th className="inventory-goods-barcode-cell">{t("ecommerce.inventory.barcodeGtin")}</th>}
                    {showColumn("measurements") && <th className="inventory-goods-measurements-cell">{t("ecommerce.inventory.measurements")}</th>}
                    {showColumn("declaredValue") && <th className="inventory-goods-value-cell">{t("ecommerce.inventory.declaredValueShort")}</th>}
                    {showColumn("flags") && <th className="inventory-goods-flags-cell">{t("ecommerce.inventory.flags")}</th>}
                    <th className="text-right">{t("ecommerce.table.headers.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {goods.map((good) => {
                    const src = imageUrl(good);
                    return (
                      <tr key={good.id}>
                        <td className="inventory-goods-select-cell">
                          <input
                            type="checkbox"
                            checked={inventory.isInventoryGoodSelected(good.id)}
                            onChange={() => inventory.toggleInventoryGoodSelected(good.id)}
                            aria-label={t("ecommerce.inventory.selectInventoryGood", { sku: good.sku })}
                          />
                        </td>
                        {showColumn("image") && (
                        <td className="inventory-goods-image-cell">
                          <ImageAssetPreview
                            src={src}
                            alt={good.name}
                            className="inventory-good-thumb"
                            emptyLabel={t("ecommerce.inventory.noImage")}
                            failedLabel={t("ecommerce.inventory.imageLoadFailed")}
                            labelMode="hidden"
                          />
                        </td>
                        )}
                        {showColumn("good") && (
                        <td className="inventory-goods-good-cell">
                          <div className="inventory-good-main">
                            <div className="shop-table-name" title={good.name}>{good.name}</div>
                            <div className="td-meta input-mono" title={good.sku}>{good.sku}</div>
                          </div>
                        </td>
                        )}
                        {showColumn("barcodeGtin") && (
                        <td className="inventory-goods-barcode-cell">
                          <div className="inventory-good-identifiers">
                            <span title={good.barcode ?? undefined}>{good.barcode || "\u2014"}</span>
                            {good.gtin && <span title={good.gtin}>GTIN {good.gtin}</span>}
                            {good.hsCode && <span title={good.hsCode}>HS {good.hsCode}</span>}
                          </div>
                        </td>
                        )}
                        {showColumn("measurements") && (
                        <td className="inventory-goods-measurements-cell">
                          <div>{good.weightValue == null ? "\u2014" : `${good.weightValue} ${good.weightUnit ?? ""}`}</div>
                          <div className="td-meta">{formatDimensions(good)}</div>
                        </td>
                        )}
                        {showColumn("declaredValue") && (
                        <td className="inventory-goods-value-cell">{formatMoney(good)}</td>
                        )}
                        {showColumn("flags") && (
                        <td className="inventory-goods-flags-cell">
                          <div className="inventory-good-flag-list">
                            {good.isBattery && <span className="inventory-chip inventory-chip-blue">{t("ecommerce.inventory.isBattery")}</span>}
                            {good.isHazmat && <span className="inventory-chip inventory-chip-warning">{t("ecommerce.inventory.isHazmat")}</span>}
                            {!good.isBattery && !good.isHazmat && <span className="td-meta">{"\u2014"}</span>}
                          </div>
                        </td>
                        )}
                        <td className="text-right">
                          <div className="td-actions shop-table-actions">
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => inventory.openEditInventoryGoodModal(good)}
                              disabled={inventory.isInventoryGoodDeleting(good.id)}
                            >
                              {t("common.edit")}
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => setDeleteOneId(good.id)}
                              disabled={inventory.isInventoryGoodDeleting(good.id)}
                            >
                              {inventory.isInventoryGoodDeleting(good.id) ? t("common.loading") : t("common.delete")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="inventory-goods-pagination">
            <div className="inventory-goods-pagination-summary">
              {t("ecommerce.inventory.inventoryGoodsPageSummary", {
                page: inventory.inventoryGoodsPage,
                pages: pageCount,
                count: filteredCount,
              })}
            </div>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => inventory.previousInventoryGoodsPage().catch(() => {})}
              disabled={inventory.inventoryGoodsLoading || inventory.inventoryGoodsPage <= 1}
            >
              {t("ecommerce.inventory.previousInventoryGoodsPage")}
            </button>
            <span className="inventory-goods-page-label">
              {t("ecommerce.inventory.inventoryGoodsPage", { page: inventory.inventoryGoodsPage })}
            </span>
            <form
              className="inventory-goods-page-jump"
              onSubmit={(e) => {
                e.preventDefault();
                const nextPage = Number(pageInput);
                if (Number.isFinite(nextPage)) {
                  inventory.goToInventoryGoodsPage(nextPage).catch(() => {});
                }
              }}
            >
              <span>{t("ecommerce.inventory.inventoryGoodsGoToPage")}</span>
              <input
                type="number"
                min={1}
                max={pageCount}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                disabled={inventory.inventoryGoodsLoading}
              />
              <button className="btn btn-secondary btn-sm" type="submit" disabled={inventory.inventoryGoodsLoading}>
                {t("ecommerce.inventory.inventoryGoodsGo")}
              </button>
            </form>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => inventory.nextInventoryGoodsPage().catch(() => {})}
              disabled={inventory.inventoryGoodsLoading || !inventory.inventoryGoodsHasNextPage}
            >
              {t("ecommerce.inventory.nextInventoryGoodsPage")}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(deleteOne)}
        title={t("ecommerce.inventory.deleteInventoryGood")}
        message={t("ecommerce.inventory.confirmDeleteInventoryGood", { sku: deleteOne?.sku ?? "" })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        confirmVariant="danger"
        onCancel={() => setDeleteOneId(null)}
        onConfirm={() => {
          if (!deleteOne) return;
          inventory.archiveInventoryGood(deleteOne.id)
            .then(() => setDeleteOneId(null))
            .catch(() => {});
        }}
      />
      <ConfirmDialog
        isOpen={confirmBulkDelete}
        title={t("ecommerce.inventory.deleteSelectedInventoryGoodsTitle")}
        message={t("ecommerce.inventory.confirmDeleteSelectedInventoryGoods", { count: inventory.selectedInventoryGoodIds.length })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        confirmVariant="danger"
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={() => {
          inventory.archiveSelectedInventoryGoods()
            .then(() => setConfirmBulkDelete(false))
            .catch(() => {});
        }}
      />
    </>
  );
});
