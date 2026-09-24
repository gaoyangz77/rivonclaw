import { useEffect, useRef, useState } from "react";
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
} from "../../../components/design-system/index.js";
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
    const response = await queryData({ variables: { input } });
    if (request !== requestSequence.current) return;
    const result = response.data?.getEcommerceBiData;
    if (!result) return;
    setRows((current) =>
      offset ? [...current, ...(result.rows as Row[])] : (result.rows as Row[]),
    );
    setPage(result.pageInfo);
    if (!offset) {
      setLastInput(input);
      setSelectedApplication(null);
    }
  };

  // The first page is useful immediately; edits to filters remain drafts until Search is clicked.
  useEffect(() => {
    if (shops.length) void load();
    // The tab mounts with an entitlement-filtered shop DTO list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectApplication = async (row: Row) => {
    const shopId = String(row.SHOP_ID ?? "");
    const applicationId = String(row.SAMPLE_APPLICATION_ID ?? "");
    if (!shopId || !applicationId) return;
    if (
      selectedApplication?.shopId === shopId &&
      selectedApplication.applicationId === applicationId
    ) {
      orderRequestSequence.current += 1;
      setSelectedApplication(null);
      return;
    }
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

  const columns =
    entity === "REVIEW"
      ? [
          "DATE",
          "SHOP_NAME",
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
                  setSelectedApplication(null);
                  orderRequestSequence.current += 1;
                  setOrderRows([]);
                  setOrderPage(null);
                  setLastOrderInput(null);
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
            <TkTableFrame variant="embedded" className="affiliate-detail-table">
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
                          <button type="button" onClick={() => void selectApplication(row)}>
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

      {entity === "FULFILLMENT" && selectedApplication && (
        <TkPanel as="section" padding="none">
          <TkPanelHeader
            eyebrow={selectedApplication.applicationId}
            title={t("ecommerce.affiliateAnalytics.details.ordersAndVideos")}
            description={t("ecommerce.affiliateAnalytics.details.orderNote")}
          />
          {ordersState.error && !orderRows.length ? (
            <TkPanelBody>
              <p role="alert">{ordersState.error.message}</p>
            </TkPanelBody>
          ) : ordersState.loading && !orderRows.length ? (
            <TkPanelBody>
              <p>{t("ecommerce.affiliateAnalytics.loading")}</p>
            </TkPanelBody>
          ) : !orderRows.length ? (
            <TkPanelBody>
              <p>{t("ecommerce.affiliateAnalytics.details.noPostApplicationOrders")}</p>
            </TkPanelBody>
          ) : (
            <>
              <TkTableFrame variant="embedded" className="affiliate-detail-table">
                <table>
                  <thead>
                    <tr>
                      {["ORDER_DATE", "ORDER_ID", "CONTENT_ID", ...ORDER_METRICS].map((key) => (
                        <th key={key}>{label(key, true)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orderRows.map((row, index) => (
                      <tr key={`${row.ORDER_ID}:${row.CONTENT_ID}:${index}`}>
                        {["ORDER_DATE", "ORDER_ID", "CONTENT_ID", ...ORDER_METRICS].map((key) => (
                          <td key={key}>{cell(row, key)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TkTableFrame>
              {orderPage?.hasMore && lastOrderInput && (
                <TkPanelBody>
                  {ordersState.error && <p role="alert">{ordersState.error.message}</p>}
                  {ordersState.loading && <p>{t("ecommerce.affiliateAnalytics.loading")}</p>}
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
                </TkPanelBody>
              )}
            </>
          )}
        </TkPanel>
      )}
    </section>
  );
}
