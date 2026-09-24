import { useRef, useState } from "react";
import { useLazyQuery } from "@apollo/client/react";
import type { GQL } from "@rivonclaw/core";
import { useTranslation } from "react-i18next";
import { AFFILIATE_BI_DATA_QUERY } from "../../../api/affiliate-analytics-queries.js";
import { Select } from "../../../components/inputs/Select.js";
import {
  TkPanel,
  TkPanelBody,
  TkPanelHeader,
  TkPrivate,
  TkTableFrame,
  TkModal,
} from "../../../components/design-system/index.js";
import { buildAffiliateDetailWorkbook } from "../affiliate-detail-export.js";
import {
  defaultAffiliateDateRange,
  endDateLtFromInclusive,
  formatInputEndDate,
} from "../affiliate-analytics.js";
import {
  reconcileShopSelection,
  type AffiliateAnalyticsShop,
} from "../affiliate-analytics-scope.js";
import { AffiliateShopScopeControl } from "./AffiliateShopScopeControl.js";
import {
  AffiliateFulfillmentFilters,
  AffiliateReviewFilters,
  type AffiliateDetailFilterDraft,
} from "./AffiliateDetailFilters.js";

type Entity = "REVIEW" | "FULFILLMENT";
type DataResult = { getEcommerceBiData: GQL.EcomBiQueryResult };
type Row = Record<string, unknown>;

const REVIEW_DATASET = "AFFILIATE_SAMPLE_REVIEW_DETAIL" as GQL.EcomBiDatasetId;
const FULFILLMENT_DATASET = "AFFILIATE_SAMPLE_FULFILLMENT_DETAIL" as GQL.EcomBiDatasetId;
const ORDER_DATASET = "AFFILIATE_SAMPLE_ORDER_DETAIL" as GQL.EcomBiDatasetId;

const REVIEW_DIMENSIONS = [
  "DATE",
  "SHOP_ID",
  "SHOP_NAME",
  "SHOP_ALIAS",
  "SAMPLE_APPLICATION_ID",
  "CREATOR_OPEN_ID",
  "CREATOR_USERNAME",
  "PRODUCT_ID",
  "PRODUCT_NAME",
  "AFFILIATE_DECIDED_BY",
  "SAMPLE_DECISION_BUCKET",
  "SAMPLE_APPLICATION_STATUS",
  "SAMPLE_ORDER_ID",
  "TRACKING_ID",
  "SAMPLE_SHIPPED_DATE",
  "AFFILIATE_CREATOR_30D_GMV_CURRENCY",
] as GQL.EcomBiDimension[];
const FULFILLMENT_DIMENSIONS = [
  ...REVIEW_DIMENSIONS,
  "SAMPLE_HAS_POST_APPLICATION_ORDER",
  "SAMPLE_HAS_SHIPMENT",
  "SAMPLE_HAS_CONTENT",
] as GQL.EcomBiDimension[];
const CREATOR_METRICS = [
  "AFFILIATE_CREATOR_FOLLOWERS_AT_APPLICATION",
  "AFFILIATE_CREATOR_30D_GMV_AT_APPLICATION",
  "AFFILIATE_CREATOR_30D_CONTENTS_AT_APPLICATION",
  "AFFILIATE_CREATOR_MEDIAN_VIDEO_VIEWS_AT_APPLICATION",
] as GQL.EcomBiMetric[];
const FULFILLMENT_METRICS = [
  "AFFILIATE_CONTENTS_CREATED",
  "AFFILIATE_ORDERS",
  "AFFILIATE_UNITS",
  ...CREATOR_METRICS,
] as GQL.EcomBiMetric[];
const ORDER_DIMENSIONS = [
  "DATE",
  "SHOP_ID",
  "SAMPLE_APPLICATION_ID",
  "ORDER_DATE",
  "ORDER_ID",
  "CONTENT_ID",
] as GQL.EcomBiDimension[];
const ORDER_METRICS = [
  "AFFILIATE_ORDER_LINES",
  "AFFILIATE_UNITS",
  "AFFILIATE_NET_GMV_USD",
] as GQL.EcomBiMetric[];
const ORDER_COLUMNS = ["ORDER_DATE", "ORDER_ID", "CONTENT_ID", ...ORDER_METRICS];

const initialFilters: AffiliateDetailFilterDraft = {
  origin: "",
  decision: "",
  creatorId: "",
  productId: "",
  shipped: "",
  hasContent: "",
  postApplicationOrder: "",
};

function filter(dimension: string, value: string): GQL.EcomBiFilterInput {
  return {
    dimension: dimension as GQL.EcomBiDimension,
    operator: "IN" as GQL.EcomBiFilterOperator,
    values: [value],
  };
}

function formatted(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export function AffiliateDetailsTab({ shops }: { shops: AffiliateAnalyticsShop[] }) {
  const { t, i18n } = useTranslation();
  const [entity, setEntity] = useState<Entity>("REVIEW");
  const [shopSelection, setShopSelection] = useState<string[]>(shops.map((shop) => shop.id));
  const shopIds = reconcileShopSelection(shopSelection, shops);
  const [range, setRange] = useState(defaultAffiliateDateRange);
  const [filters, setFilters] = useState<AffiliateDetailFilterDraft>(initialFilters);
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState<GQL.EcomBiPageInfo | null>(null);
  const [lastInput, setLastInput] = useState<GQL.EcomBiQueryInput | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<{
    shopId: string;
    applicationId: string;
  } | null>(null);
  const [orderRows, setOrderRows] = useState<Row[]>([]);
  const [orderPage, setOrderPage] = useState<GQL.EcomBiPageInfo | null>(null);
  const [lastOrderInput, setLastOrderInput] = useState<GQL.EcomBiQueryInput | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [orderExportError, setOrderExportError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const orderRequestSequence = useRef(0);
  const [queryData, dataState] = useLazyQuery<DataResult, { input: GQL.EcomBiQueryInput }>(
    AFFILIATE_BI_DATA_QUERY,
    { fetchPolicy: "network-only" },
  );
  const [queryOrders, ordersState] = useLazyQuery<DataResult, { input: GQL.EcomBiQueryInput }>(
    AFFILIATE_BI_DATA_QUERY,
    { fetchPolicy: "network-only" },
  );

  const baseFilters = () => [
    ...(filters.origin ? [filter("AFFILIATE_DECIDED_BY", filters.origin)] : []),
    ...(filters.creatorId.trim() ? [filter("CREATOR_OPEN_ID", filters.creatorId.trim())] : []),
    ...(filters.productId.trim() ? [filter("PRODUCT_ID", filters.productId.trim())] : []),
    ...(entity === "REVIEW" && filters.decision
      ? [filter("SAMPLE_DECISION_BUCKET", filters.decision)]
      : []),
    ...(entity === "FULFILLMENT" && filters.shipped
      ? [filter("SAMPLE_HAS_SHIPMENT", filters.shipped)]
      : []),
    ...(entity === "FULFILLMENT" && filters.hasContent
      ? [filter("SAMPLE_HAS_CONTENT", filters.hasContent)]
      : []),
    ...(entity === "FULFILLMENT" && filters.postApplicationOrder
      ? [filter("SAMPLE_HAS_POST_APPLICATION_ORDER", filters.postApplicationOrder)]
      : []),
  ];

  const closeOrders = () => {
    orderRequestSequence.current += 1;
    setSelectedApplication(null);
    setOrderRows([]);
    setOrderPage(null);
    setLastOrderInput(null);
    setOrderExportError(null);
  };

  const load = async (offset = 0) => {
    if (!shopIds.length || (!offset && range.startDateGe >= range.endDateLt)) return;
    if (
      offset &&
      (!lastInput || !lastInput.shopIds?.every((id) => shops.some((shop) => shop.id === id)))
    )
      return;
    const freshInput: GQL.EcomBiQueryInput = {
      datasetId: entity === "REVIEW" ? REVIEW_DATASET : FULFILLMENT_DATASET,
      shopIds,
      startDateGe: range.startDateGe,
      endDateLt: range.endDateLt,
      granularity: "DAILY" as GQL.EcomBiGranularity,
      dimensions: entity === "REVIEW" ? REVIEW_DIMENSIONS : FULFILLMENT_DIMENSIONS,
      metrics: entity === "REVIEW" ? CREATOR_METRICS : FULFILLMENT_METRICS,
      filters: baseFilters(),
      orderBy: [
        { dimension: "DATE" as GQL.EcomBiDimension, direction: "DESC" as GQL.EcomSortOrder },
      ],
      limit: 100,
      offset: 0,
    };
    const input = offset ? { ...lastInput!, offset } : freshInput;
    const request = ++requestSequence.current;
    if (!offset) {
      setExportError(null);
      setRows([]);
      setPage(null);
      setLastInput(input);
      closeOrders();
    }
    const response = await queryData({ variables: { input } });
    if (request !== requestSequence.current) return;
    const result = response.data?.getEcommerceBiData;
    if (!result) return;
    setRows((current) =>
      offset ? [...current, ...(result.rows as Row[])] : (result.rows as Row[]),
    );
    setPage(result.pageInfo);
  };

  const selectApplication = async (row: Row) => {
    const shopId = String(row.SHOP_ID ?? "");
    const applicationId = String(row.SAMPLE_APPLICATION_ID ?? "");
    if (!shopId || !applicationId) return;
    orderRequestSequence.current += 1;
    setSelectedApplication({ shopId, applicationId });
    setOrderRows([]);
    setOrderPage(null);
    const input: GQL.EcomBiQueryInput = {
      datasetId: ORDER_DATASET,
      shopIds: [shopId],
      startDateGe: lastInput?.startDateGe ?? range.startDateGe,
      endDateLt: lastInput?.endDateLt ?? range.endDateLt,
      granularity: "DAILY" as GQL.EcomBiGranularity,
      dimensions: ORDER_DIMENSIONS,
      metrics: ORDER_METRICS,
      filters: [filter("SAMPLE_APPLICATION_ID", applicationId)],
      orderBy: [
        { dimension: "ORDER_DATE" as GQL.EcomBiDimension, direction: "DESC" as GQL.EcomSortOrder },
      ],
      limit: 100,
    };
    setLastOrderInput(input);
    await loadOrders(input, false);
  };

  const loadOrders = async (input: GQL.EcomBiQueryInput, append: boolean) => {
    const request = ++orderRequestSequence.current;
    const response = await queryOrders({ variables: { input } });
    if (request !== orderRequestSequence.current) return;
    const result = response.data?.getEcommerceBiData;
    if (!result) return;
    setOrderRows((current) =>
      append ? [...current, ...(result.rows as Row[])] : (result.rows as Row[]),
    );
    setOrderPage(result.pageInfo);
  };

  const downloadExcel = async (
    exportRows: Row[],
    exportColumns: readonly string[],
    sheetName: string,
    filename: string,
    orderDetail = false,
  ) => {
    setExporting(true);
    if (orderDetail) setOrderExportError(null);
    else setExportError(null);
    try {
      const { default: ExcelJS } = await import("exceljs");
      const workbook = buildAffiliateDetailWorkbook(ExcelJS, {
        sheetName,
        columns: exportColumns,
        rows: exportRows,
        label: (key) => label(key, orderDetail),
        displayText: (key, value) => cell({ [key]: value }, key),
      });
      const bytes = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (orderDetail) setOrderExportError(message);
      else setExportError(message);
    } finally {
      setExporting(false);
    }
  };

  const columns =
    entity === "REVIEW"
      ? [
          "DATE",
          "SHOP_NAME",
          "SHOP_ALIAS",
          "CREATOR_USERNAME",
          "PRODUCT_NAME",
          "SAMPLE_DECISION_BUCKET",
          "SAMPLE_ORDER_ID",
          "TRACKING_ID",
          "SAMPLE_SHIPPED_DATE",
          "AFFILIATE_CREATOR_FOLLOWERS_AT_APPLICATION",
          "AFFILIATE_CREATOR_30D_GMV_AT_APPLICATION",
          "AFFILIATE_CREATOR_30D_GMV_CURRENCY",
          "AFFILIATE_CREATOR_MEDIAN_VIDEO_VIEWS_AT_APPLICATION",
        ]
      : [
          "DATE",
          "SHOP_NAME",
          "SHOP_ALIAS",
          "CREATOR_USERNAME",
          "PRODUCT_NAME",
          "SAMPLE_DECISION_BUCKET",
          "SAMPLE_SHIPPED_DATE",
          "SAMPLE_HAS_SHIPMENT",
          "SAMPLE_HAS_CONTENT",
          "SAMPLE_HAS_POST_APPLICATION_ORDER",
          "AFFILIATE_CONTENTS_CREATED",
          "AFFILIATE_ORDERS",
          "AFFILIATE_UNITS",
          "AFFILIATE_CREATOR_FOLLOWERS_AT_APPLICATION",
          "AFFILIATE_CREATOR_30D_GMV_AT_APPLICATION",
          "AFFILIATE_CREATOR_30D_GMV_CURRENCY",
        ];

  const label = (key: string, orderDetail = false) =>
    t(
      `ecommerce.affiliateAnalytics.details.fields.${orderDetail && key === "AFFILIATE_UNITS" ? "POST_APPLICATION_UNITS" : key}`,
    );
  const cell = (row: Row, key: string) => {
    const value = row[key];
    if (key === "SAMPLE_DECISION_BUCKET")
      return t(`ecommerce.affiliateAnalytics.details.decisions.${String(value)}`, {
        defaultValue: formatted(value),
      });
    if (
      key === "SAMPLE_HAS_POST_APPLICATION_ORDER" ||
      key === "SAMPLE_HAS_SHIPMENT" ||
      key === "SAMPLE_HAS_CONTENT"
    )
      return value === null || value === undefined
        ? t("ecommerce.affiliateAnalytics.details.unknown")
        : t(`ecommerce.affiliateAnalytics.details.${Number(value) ? "yes" : "no"}`);
    if (typeof value === "string" && /^-?\d+\.\d+$/.test(value))
      return new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(
        Number(value),
      );
    if (typeof value === "number") return new Intl.NumberFormat(i18n.language).format(value);
    return formatted(value);
  };

  return (
    <section className="affiliate-details">
      <TkPanel as="section" padding="none">
        <TkPanelHeader
          eyebrow={t("ecommerce.affiliateAnalytics.details.eyebrow")}
          title={t("ecommerce.affiliateAnalytics.details.title")}
          description={t("ecommerce.affiliateAnalytics.details.subtitle")}
        />
        <TkPanelBody>
          <div className="affiliate-detail-toolbar">
            <label>
              <span>{t("ecommerce.affiliateAnalytics.details.entity")}</span>
              <Select
                ariaLabel={t("ecommerce.affiliateAnalytics.details.entity")}
                value={entity}
                onChange={(next) => {
                  requestSequence.current += 1;
                  setEntity(next as Entity);
                  setRows([]);
                  setPage(null);
                  setLastInput(null);
                  closeOrders();
                  setExportError(null);
                  setFilters(initialFilters);
                }}
                options={[
                  { value: "REVIEW", label: t("ecommerce.affiliateAnalytics.details.review") },
                  {
                    value: "FULFILLMENT",
                    label: t("ecommerce.affiliateAnalytics.details.fulfillment"),
                  },
                ]}
              />
            </label>
            <AffiliateShopScopeControl
              shops={shops}
              selected={shopIds}
              onChange={setShopSelection}
            />
            <label>
              <span>{t("ecommerce.affiliateAnalytics.startDate")}</span>
              <input
                type="date"
                value={range.startDateGe}
                onChange={(event) => setRange({ ...range, startDateGe: event.target.value })}
              />
            </label>
            <label>
              <span>{t("ecommerce.affiliateAnalytics.endDate")}</span>
              <input
                type="date"
                value={formatInputEndDate(range.endDateLt)}
                onChange={(event) =>
                  setRange({ ...range, endDateLt: endDateLtFromInclusive(event.target.value) })
                }
              />
            </label>
          </div>
          <div className="affiliate-detail-filters">
            {entity === "REVIEW" ? (
              <AffiliateReviewFilters value={filters} onChange={setFilters} />
            ) : (
              <AffiliateFulfillmentFilters value={filters} onChange={setFilters} />
            )}
            <button
              className="btn-primary"
              type="button"
              disabled={
                !shopIds.length || range.startDateGe >= range.endDateLt || dataState.loading
              }
              onClick={() => void load()}
            >
              {dataState.loading
                ? t("ecommerce.affiliateAnalytics.refreshing")
                : t("ecommerce.affiliateAnalytics.details.search")}
            </button>
          </div>
          <p className="affiliate-detail-note">
            {t("ecommerce.affiliateAnalytics.details.dateNote")}
          </p>
        </TkPanelBody>
      </TkPanel>

      <TkPanel as="section" padding="none">
        <TkPanelHeader
          eyebrow={
            entity === "REVIEW"
              ? t("ecommerce.affiliateAnalytics.details.review")
              : t("ecommerce.affiliateAnalytics.details.fulfillment")
          }
          title={t("ecommerce.affiliateAnalytics.details.results")}
          description={t("ecommerce.affiliateAnalytics.details.resultNote")}
          actions={rows.length ? (
            <button
              type="button"
              disabled={exporting || dataState.loading}
              onClick={() => void downloadExcel(
                rows,
                columns,
                entity === "REVIEW" ? "Sample review" : "Fulfillment",
                `affiliate-${entity === "REVIEW" ? "sample-review" : "fulfillment"}-${new Date().toISOString().slice(0, 10)}.xlsx`,
              )}
            >
              {t("ecommerce.affiliateAnalytics.details.exportLoaded", { count: rows.length })}
            </button>
          ) : undefined}
        />
        {lastInput && dataState.error && !rows.length ? (
          <TkPanelBody>
            <p role="alert">
              {t("ecommerce.affiliateAnalytics.sectionErrorTitle")}: {dataState.error.message}
            </p>
          </TkPanelBody>
        ) : rows.length === 0 ? (
          <TkPanelBody>
            <p>
              {dataState.loading
                ? t("ecommerce.affiliateAnalytics.loading")
                : !lastInput
                  ? t("ecommerce.affiliateAnalytics.details.searchPrompt")
                  : t("ecommerce.affiliateAnalytics.noDataBody")}
            </p>
          </TkPanelBody>
        ) : (
          <>
            <TkTableFrame variant="embedded" className="affiliate-detail-table affiliate-detail-main-table">
              <table>
                <thead>
                  <tr>
                    {columns.map((key) => (
                      <th key={key}>{label(key)}</th>
                    ))}
                    {entity === "FULFILLMENT" && (
                      <th>{t("ecommerce.affiliateAnalytics.details.ordersAndVideos")}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.SHOP_ID}:${row.SAMPLE_APPLICATION_ID}:${index}`}>
                      {columns.map((key) => (
                        <td key={key} title={formatted(row[key])}>
                          {key === "CREATOR_USERNAME" || key === "PRODUCT_NAME" ? (
                            <TkPrivate sensitive>{cell(row, key)}</TkPrivate>
                          ) : (
                            cell(row, key)
                          )}
                        </td>
                      ))}
                      {entity === "FULFILLMENT" && (
                        <td>
                          <button
                            type="button"
                            aria-label={`${t("ecommerce.affiliateAnalytics.details.viewOrders")}: ${formatted(row.SAMPLE_APPLICATION_ID)}`}
                            onClick={() => void selectApplication(row)}
                          >
                            {t("ecommerce.affiliateAnalytics.details.viewOrders")}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TkTableFrame>
            <TkPanelBody>
              <div className="affiliate-detail-footer">
                <span>
                  {t("ecommerce.affiliateAnalytics.details.loaded", { count: rows.length })}
                </span>
                {exportError && <span role="alert">{exportError}</span>}
                {dataState.error && <span role="alert">{dataState.error.message}</span>}
                {dataState.loading && <span>{t("ecommerce.affiliateAnalytics.loading")}</span>}
                {page?.hasMore && (
                  <button
                    type="button"
                    disabled={dataState.loading}
                    onClick={() => void load(page.nextOffset ?? 0)}
                  >
                    {t("ecommerce.affiliateAnalytics.details.loadMore")}
                  </button>
                )}
              </div>
            </TkPanelBody>
          </>
        )}
      </TkPanel>

      <TkModal
        isOpen={entity === "FULFILLMENT" && selectedApplication !== null}
        onClose={closeOrders}
        title={t("ecommerce.affiliateAnalytics.details.ordersAndVideos")}
        maxWidth={1080}
        className="affiliate-detail-order-modal"
        closeLabel={t("common.close")}
      >
        <p className="affiliate-detail-order-context">
          {t("ecommerce.affiliateAnalytics.details.applicationId")}: {selectedApplication?.applicationId}
        </p>
        <p className="affiliate-detail-note">
          {t("ecommerce.affiliateAnalytics.details.orderNote")}
        </p>
        {ordersState.error && !orderRows.length ? (
          <p role="alert">{ordersState.error.message}</p>
        ) : ordersState.loading && !orderRows.length ? (
          <p>{t("ecommerce.affiliateAnalytics.loading")}</p>
        ) : !orderRows.length ? (
          <p>{t("ecommerce.affiliateAnalytics.details.noPostApplicationOrders")}</p>
        ) : (
          <>
              <TkTableFrame variant="embedded" className="affiliate-detail-table">
                <table>
                  <thead>
                    <tr>
                      {ORDER_COLUMNS.map((key) => (
                        <th key={key}>{label(key, true)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orderRows.map((row, index) => (
                      <tr key={`${row.ORDER_ID}:${row.CONTENT_ID}:${index}`}>
                        {ORDER_COLUMNS.map((key) => (
                          <td key={key}>{cell(row, key)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TkTableFrame>
              <div className="affiliate-detail-order-footer">
                <span>{t("ecommerce.affiliateAnalytics.details.loaded", { count: orderRows.length })}</span>
                {ordersState.error && <p role="alert">{ordersState.error.message}</p>}
                {orderExportError && <p role="alert">{orderExportError}</p>}
                {orderPage?.hasMore && lastOrderInput && (
                  <button
                    type="button"
                    disabled={ordersState.loading}
                    onClick={() =>
                      void loadOrders(
                        { ...lastOrderInput, offset: orderPage.nextOffset ?? 0 },
                        true,
                      )
                    }
                  >
                    {t("ecommerce.affiliateAnalytics.details.loadMore")}
                  </button>
                )}
                <button
                  type="button"
                  disabled={exporting || ordersState.loading}
                  onClick={() => void downloadExcel(
                    orderRows,
                    ORDER_COLUMNS,
                    "Post-application orders",
                    `affiliate-sample-orders-${new Date().toISOString().slice(0, 10)}.xlsx`,
                    true,
                  )}
                >
                  {t("ecommerce.affiliateAnalytics.details.exportLoaded", { count: orderRows.length })}
                </button>
              </div>
          </>
        )}
      </TkModal>
    </section>
  );
}
