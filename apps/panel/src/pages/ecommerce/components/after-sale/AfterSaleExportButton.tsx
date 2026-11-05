import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { TkButton } from "../../../../components/design-system/index.js";
import { DownloadIcon } from "../../../../components/icons.js";
import { useToast } from "../../../../components/Toast.js";
import { shopDisplayLabel } from "../../../../lib/shop-display.js";
import { useEntityStore } from "../../../../store/EntityStoreProvider.js";
import { AFTER_SALE_MAX_PAGE_LIMIT } from "../../../../store/models/EcommerceAfterSaleModel.js";
import {
  afterSaleKindLabel,
  afterSaleSellerActionLabel,
  afterSaleSellerDecisionLabel,
  afterSaleStatusLabel,
} from "../../after-sale-labels.js";
import {
  buildAfterSaleWorkbook,
  collectAfterSaleExportRows,
  downloadAfterSaleWorkbook,
  type AfterSaleExportText,
} from "../../after-sale-export.js";
import { humanizePlatformValue, platformValueLabel } from "../../customer-service-order-utils.js";

const PREFIX = "ecommerce.afterSale.export";

/**
 * Downloads every request matching the current filters as .xlsx, not only the loaded pages. The
 * filters are frozen when the download starts; the rows never enter the Apollo cache or the
 * list's store.
 */
export const AfterSaleExportButton = observer(function AfterSaleExportButton() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const afterSale = entityStore.ecommerceAfterSale;
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function download() {
    const input = afterSale.queryInput;
    const view = afterSale.view;
    // Shop aliases as they are now, as plain strings: no store node crosses the awaits below.
    const aliases = new Map(entityStore.shops.map((shop) => [shop.id, shop.alias ?? null]));
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ done: 0, total: afterSale.totalCount });
    try {
      const rows = await collectAfterSaleExportRows({
        input,
        pageSize: AFTER_SALE_MAX_PAGE_LIMIT,
        readPage: (pageInput) =>
          entityStore.ecommerceAfterSale.readExportPage(pageInput, controller.signal),
        onProgress: (done, total) => {
          if (!controller.signal.aborted) setProgress({ done, total });
        },
      });
      if (rows.length === 0) {
        showToast(t(`${PREFIX}.empty`), "warning");
        return;
      }
      const { default: ExcelJS } = await import("exceljs");
      if (controller.signal.aborted) return;
      const text: AfterSaleExportText = {
        header: (column) => t(`${PREFIX}.columns.${column}`),
        kind: (kind) => afterSaleKindLabel(t, kind),
        status: (status) => afterSaleStatusLabel(t, status),
        sellerAction: (action) => afterSaleSellerActionLabel(t, action),
        sellerDecision: (decision) => afterSaleSellerDecisionLabel(t, decision),
        role: (role) => platformValueLabel(t, "recordRole", role),
        requestType: (requestType) => humanizePlatformValue(requestType),
        shop: (request) =>
          shopDisplayLabel({
            id: request.shopId,
            alias: aliases.get(request.shopId) ?? null,
            shopName: request.shopName,
          }).text,
        yes: t("common.yes"),
        no: t("common.no"),
      };
      const workbook = buildAfterSaleWorkbook(ExcelJS, {
        sheetName: t(`${PREFIX}.sheetName`),
        rows,
        text,
      });
      const day = new Date().toISOString().slice(0, 10);
      await downloadAfterSaleWorkbook(
        workbook,
        `after-sale-requests-${view === "ALL" ? "all" : "to-review"}-${day}.xlsx`,
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        showToast(
          `${t(`${PREFIX}.failed`)} ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setProgress(null);
      }
    }
  }

  const disabled =
    progress !== null ||
    !afterSale.loaded ||
    afterSale.loading ||
    !afterSale.queryable ||
    afterSale.totalCount === 0;

  return (
    <TkButton
      variant="secondary"
      leadingIcon={<DownloadIcon />}
      disabled={disabled}
      aria-busy={progress !== null || undefined}
      onClick={() => void download()}
    >
      {progress === null
        ? t(`${PREFIX}.download`)
        : t(`${PREFIX}.progress`, { done: progress.done, total: progress.total })}
    </TkButton>
  );
});
