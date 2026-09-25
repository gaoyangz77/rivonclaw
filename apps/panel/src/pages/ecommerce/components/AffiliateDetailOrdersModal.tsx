import { useEffect, useRef } from "react";
import type { GQL } from "@rivonclaw/core";
import { useTranslation } from "react-i18next";
import {
  TkAlert,
  TkEmptyState,
  TkLoadingState,
  TkModal,
  TkTableFrame,
} from "../../../components/design-system/index.js";
import { isAffiliateDetailNumberField } from "../affiliate-detail-export.js";
import {
  AFFILIATE_ORDER_COLUMNS,
  affiliateDetailCell,
  affiliateDetailLabel,
  buildAffiliateOrderInput,
} from "../affiliate-detail-query.js";
import {
  AFFILIATE_DETAIL_PAGE_SIZE,
  useAffiliateDetailPages,
} from "../hooks/useAffiliateDetailPages.js";
import { useAffiliateDetailExport } from "../hooks/useAffiliateDetailExport.js";
import { AffiliateDetailPager, revealTableStart } from "./AffiliateDetailPager.js";
import {
  AffiliateDetailExportAlert,
  AffiliateDetailExportControl,
} from "./AffiliateDetailExportControl.js";

/**
 * Post-application orders and content of one Sample Application. Mounted per
 * application (keyed by the caller), so its pager and export start fresh and
 * closing the dialog aborts any export still running.
 */
export function AffiliateDetailOrdersModal({
  shopId,
  applicationId,
  search,
  onClose,
}: {
  shopId: string;
  applicationId: string;
  /** The frozen main search; its date window bounds the order lines. */
  search: Pick<GQL.EcomBiQueryInput, "startDateGe" | "endDateLt">;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const orders = useAffiliateDetailPages();
  const exporter = useAffiliateDetailExport();
  const tableRef = useRef<HTMLDivElement>(null);
  const label = (key: string) => affiliateDetailLabel(t, key, true);
  const cell = (row: Record<string, unknown>, key: string) =>
    affiliateDetailCell(t, i18n.language, row, key);

  useEffect(() => {
    void orders.search(buildAffiliateOrderInput({ shopId, applicationId, search }));
    // The dialog is keyed per application: this runs once for its frozen query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = async (pageIndex: number) => {
    if (await orders.goTo(pageIndex)) revealTableStart(tableRef.current);
  };

  return (
    <TkModal
      isOpen
      onClose={onClose}
      title={t("ecommerce.affiliateAnalytics.details.ordersAndVideos")}
      maxWidth={1080}
      className="affiliate-detail-order-modal"
      closeLabel={t("common.close")}
    >
      <div className="affiliate-detail-order-body">
        <p className="affiliate-detail-order-context">
          {t("ecommerce.affiliateAnalytics.details.applicationId")}: {applicationId}
        </p>
        <p className="affiliate-detail-note">{t("ecommerce.affiliateAnalytics.details.orderNote")}</p>
        {orders.error && (
          <TkAlert tone="danger" title={t("ecommerce.affiliateAnalytics.sectionErrorTitle")}>
            {orders.error}
          </TkAlert>
        )}
        <AffiliateDetailExportAlert error={exporter.error} />
        {!orders.rows.length ? (
          orders.loading ? (
            <TkLoadingState size="inline" label={t("ecommerce.affiliateAnalytics.loading")} />
          ) : orders.error ? null : (
            <TkEmptyState
              title={t("ecommerce.affiliateAnalytics.details.noPostApplicationOrders")}
            />
          )
        ) : (
          <>
            <TkTableFrame
              ref={tableRef}
              variant="embedded"
              className="affiliate-detail-table"
              aria-busy={orders.loading || undefined}
            >
              <table>
                <thead>
                  <tr>
                    {AFFILIATE_ORDER_COLUMNS.map((key) => (
                      <th
                        key={key}
                        className={isAffiliateDetailNumberField(key) ? "affiliate-detail-num" : undefined}
                      >
                        {label(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.rows.map((row, index) => (
                    <tr key={`${String(row.ORDER_ID)}:${String(row.CONTENT_ID)}:${index}`}>
                      {AFFILIATE_ORDER_COLUMNS.map((key) => (
                        <td
                          key={key}
                          className={isAffiliateDetailNumberField(key) ? "affiliate-detail-num" : undefined}
                        >
                          {cell(row, key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TkTableFrame>
            <div className="affiliate-detail-order-footer">
              {orders.totalRows !== null && (
                <AffiliateDetailPager
                  pageIndex={orders.pageIndex}
                  pageSize={AFFILIATE_DETAIL_PAGE_SIZE}
                  totalRows={orders.totalRows}
                  loading={orders.loading}
                  onPageChange={(pageIndex) => void goTo(pageIndex)}
                />
              )}
              {orders.input && orders.totalRows ? (
                <AffiliateDetailExportControl
                  totalRows={orders.totalRows}
                  exporter={exporter}
                  onStart={() => {
                    if (!orders.input) return;
                    void exporter.start({
                      input: orders.input,
                      columns: AFFILIATE_ORDER_COLUMNS,
                      sheetName: "Post-application orders",
                      filename: `affiliate-sample-orders-${applicationId}-${new Date().toISOString().slice(0, 10)}.xlsx`,
                      label,
                      displayText: (key, value) => cell({ [key]: value }, key),
                    });
                  }}
                />
              ) : null}
            </div>
          </>
        )}
      </div>
    </TkModal>
  );
}
