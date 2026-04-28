import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { Modal } from "../../../components/modals/Modal.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";

function formatCount(value: number | undefined) {
  return Number.isFinite(value) ? String(value) : "0";
}

function reasonKey(reason: string) {
  return reason === "No active InventoryGood exists with this SKU"
    ? "ecommerce.inventory.wmsCoverageReasons.noActiveInventoryGood"
    : "";
}

export const WmsInventoryGoodsSyncModal = observer(function WmsInventoryGoodsSyncModal() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const inventory = entityStore.ecommerceInventory;
  const [detailView, setDetailView] = useState<"summary" | "matched" | "needsSync">("summary");
  const account = inventory.wmsInventoryGoodsSyncAccountId
    ? entityStore.getWmsAccount(inventory.wmsInventoryGoodsSyncAccountId)
    : null;
  const coverage = inventory.wmsInventoryGoodsCoverage;
  const result = inventory.wmsInventoryGoodsSyncResult;
  const unrecognized = coverage?.unrecognizedWmsInventoryGoods ?? [];
  const recognizedCount = coverage?.recognizedWmsGoodsCount ?? 0;
  const busy = inventory.wmsInventoryGoodsCoverageLoading || inventory.wmsInventoryGoodsSyncing;
  const allMatched = Boolean(coverage) && unrecognized.length === 0;
  const hasWmsInventoryGoods = Boolean(coverage) && recognizedCount + unrecognized.length > 0;

  useEffect(() => {
    if (!inventory.wmsInventoryGoodsSyncModalOpen || result || inventory.wmsInventoryGoodsCoverageLoading) {
      setDetailView("summary");
    }
  }, [inventory.wmsInventoryGoodsSyncModalOpen, inventory.wmsInventoryGoodsCoverageLoading, result]);

  return (
    <Modal
      isOpen={inventory.wmsInventoryGoodsSyncModalOpen}
      onClose={() => inventory.closeWmsInventoryGoodsSyncModal()}
      title={t("ecommerce.inventory.syncInventoryGoodsTitle")}
      maxWidth={720}
      preventBackdropClose={busy}
    >
      <div className="modal-form-col">
        <div className="inventory-sync-modal-account">
          {account?.label ?? inventory.wmsInventoryGoodsSyncAccountId ?? "\u2014"}
        </div>

        {inventory.wmsInventoryGoodsCoverageLoading && (
          <div className="empty-cell">{t("ecommerce.inventory.checkingInventoryGoodsCoverage")}</div>
        )}

        {!inventory.wmsInventoryGoodsCoverageLoading && inventory.wmsInventoryGoodsSyncError && (
          <div className="form-hint form-hint-error">{inventory.wmsInventoryGoodsSyncError}</div>
        )}

        {!inventory.wmsInventoryGoodsCoverageLoading && !result && coverage && detailView === "summary" && (
          <>
            <div className="inventory-coverage-summary">
              <button
                type="button"
                className="inventory-coverage-stat inventory-coverage-stat-clickable"
                onClick={() => setDetailView("matched")}
              >
                <span>{t("ecommerce.inventory.recognizedInventoryGoods")}</span>
                <strong>{formatCount(recognizedCount)}</strong>
                <em>{t("ecommerce.inventory.viewDetails")}</em>
              </button>
              <button
                type="button"
                className="inventory-coverage-stat inventory-coverage-stat-clickable"
                onClick={() => setDetailView("needsSync")}
              >
                <span>{t("ecommerce.inventory.unrecognizedInventoryGoods")}</span>
                <strong>{formatCount(unrecognized.length)}</strong>
                <em>{t("ecommerce.inventory.viewDetails")}</em>
              </button>
            </div>

            {allMatched && (
              <div className="info-box info-box-blue">
                {recognizedCount > 0
                  ? t("ecommerce.inventory.allInventoryGoodsMatched")
                  : t("ecommerce.inventory.noWmsInventoryGoodsFound")}
              </div>
            )}
          </>
        )}

        {!inventory.wmsInventoryGoodsCoverageLoading && !result && coverage && detailView === "matched" && (
          <div className="inventory-coverage-detail">
            <div className="inventory-coverage-detail-header">
              <div>
                <div className="inventory-coverage-list-title inventory-coverage-list-title-inline">
                  {t("ecommerce.inventory.recognizedInventoryGoods")}
                </div>
                <div className="td-meta">
                  {t("ecommerce.inventory.matchedInventoryGoodsCount", { count: recognizedCount })}
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDetailView("summary")}>
                {t("common.back")}
              </button>
            </div>
            <div className="info-box info-box-blue">
              {t("ecommerce.inventory.matchedInventoryGoodsDetailsUnavailable")}
            </div>
          </div>
        )}

        {!inventory.wmsInventoryGoodsCoverageLoading && !result && coverage && detailView === "needsSync" && (
          <div className="inventory-coverage-detail">
            <div className="inventory-coverage-detail-header">
              <div>
                <div className="inventory-coverage-list-title inventory-coverage-list-title-inline">
                  {t("ecommerce.inventory.unrecognizedInventoryGoodsList")}
                </div>
                <div className="td-meta">
                  {t("ecommerce.inventory.needSyncInventoryGoodsCount", { count: unrecognized.length })}
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDetailView("summary")}>
                {t("common.back")}
              </button>
            </div>
            {unrecognized.length === 0 ? (
              <div className="info-box info-box-blue">{t("ecommerce.inventory.noInventoryGoodsNeedSync")}</div>
            ) : (
              <div className="inventory-coverage-list inventory-coverage-list-scroll">
                {unrecognized.map((good, index) => (
                  <div className="inventory-coverage-row" key={`${good.sku}-${index}`}>
                    <div>
                      <div className="shop-table-name">{good.name}</div>
                      <div className="td-meta">{good.sku}</div>
                    </div>
                    <span className="badge badge-warning">
                      {reasonKey(good.reason)
                        ? t(reasonKey(good.reason))
                        : good.reason}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="inventory-sync-result">
            <div className="info-box info-box-blue">
              {t("ecommerce.inventory.syncInventoryGoodsDone", {
                created: result.created,
                updated: result.updated,
                skipped: result.skippedExisting,
                failed: result.failed,
              })}
            </div>
            {result.errors.length > 0 && (
              <div className="inventory-coverage-list">
                <div className="inventory-coverage-list-title">{t("ecommerce.inventory.syncInventoryGoodsErrors")}</div>
                {result.errors.slice(0, 5).map((err, index) => (
                  <div className="inventory-coverage-row" key={`${err.sku ?? "row"}-${index}`}>
                    <div className="td-meta">{err.sku ?? "\u2014"}</div>
                    <div>{err.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(result || detailView === "summary") && (
          <div className="modal-actions">
            {result ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => inventory.closeWmsInventoryGoodsSyncModal()}
                disabled={busy}
              >
                {t("common.done")}
              </button>
            ) : (
              <>
                {!allMatched && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => inventory.closeWmsInventoryGoodsSyncModal()}
                    disabled={busy}
                  >
                    {t("common.cancel")}
                  </button>
                )}
                {hasWmsInventoryGoods && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => inventory.syncWmsInventoryGoods(true).catch(() => {})}
                    disabled={busy}
                  >
                    {inventory.wmsInventoryGoodsSyncing
                      ? t("common.loading")
                      : t("ecommerce.inventory.syncAllInventoryGoods")}
                  </button>
                )}
                {unrecognized.length > 0 ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => inventory.syncWmsInventoryGoods(false).catch(() => {})}
                    disabled={busy}
                  >
                    {inventory.wmsInventoryGoodsSyncing
                      ? t("common.loading")
                      : t("ecommerce.inventory.syncNewInventoryGoods")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => inventory.closeWmsInventoryGoodsSyncModal()}
                    disabled={busy}
                  >
                    {t("ecommerce.inventory.confirmInventoryGoodsSync")}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
});
