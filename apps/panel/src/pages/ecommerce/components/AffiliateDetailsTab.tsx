import { useRef, useState } from "react";
import { useQuery } from "@apollo/client/react";
import type { GQL } from "@rivonclaw/core";
import { useTranslation } from "react-i18next";
import { AFFILIATE_SAMPLE_REVIEWER_OPTIONS_QUERY } from "../../../api/affiliate-analytics-queries.js";
import {
  TkAlert,
  TkButton,
  TkChoiceSelect,
  TkEmptyState,
  TkFormStack,
  TkInteractiveTableRow,
  TkLoadingState,
  TkPanel,
  TkPanelBody,
  TkPanelFooter,
  TkPanelHeader,
  TkPrivate,
  TkTableFrame,
} from "../../../components/design-system/index.js";
import { isAffiliateDetailNumberField } from "../affiliate-detail-export.js";
import {
  AFFILIATE_DETAIL_COLUMNS,
  EMPTY_AFFILIATE_DETAIL_FILTERS,
  affiliateDetailCell,
  affiliateDetailEntityOf,
  affiliateDetailLabel,
  affiliateDetailTitle,
  buildAffiliateDetailInput,
  type AffiliateDetailEntity,
  type AffiliateDetailFilterDraft,
} from "../affiliate-detail-query.js";
import { defaultAffiliateDateRange, endDateLtFromInclusive } from "../affiliate-analytics.js";
import {
  defaultReviewActionRange,
  deviceTimeZoneLabel,
  deviceUtcOffsetLabel,
  reviewActionBounds,
} from "../affiliate-review-time.js";
import {
  reconcileShopSelection,
  type AffiliateAnalyticsShop,
} from "../affiliate-analytics-scope.js";
import {
  AFFILIATE_DETAIL_PAGE_SIZE,
  useAffiliateDetailPages,
} from "../hooks/useAffiliateDetailPages.js";
import { useAffiliateDetailExport } from "../hooks/useAffiliateDetailExport.js";
import {
  AffiliateDetailWindowFields,
  type AffiliateDetailTimeBasis,
} from "./AffiliateDetailWindowFields.js";
import { AffiliateShopScopeControl } from "./AffiliateShopScopeControl.js";
import { AffiliateFulfillmentFilters, AffiliateReviewFilters } from "./AffiliateDetailFilters.js";
import { AffiliateDetailPager, revealTableStart } from "./AffiliateDetailPager.js";
import {
  AffiliateDetailExportAlert,
  AffiliateDetailExportControl,
} from "./AffiliateDetailExportControl.js";
import { AffiliateDetailOrdersModal } from "./AffiliateDetailOrdersModal.js";

type Row = Record<string, unknown>;

const SENSITIVE_TEXT_FIELDS = new Set(["CREATOR_USERNAME", "PRODUCT_NAME"]);

function cellClass(key: string): string | undefined {
  if (isAffiliateDetailNumberField(key)) return "affiliate-detail-num";
  if (SENSITIVE_TEXT_FIELDS.has(key)) return "affiliate-detail-text";
  return undefined;
}

export function AffiliateDetailsTab({ shops }: { shops: AffiliateAnalyticsShop[] }) {
  const { t, i18n } = useTranslation();
  const [entity, setEntity] = useState<AffiliateDetailEntity>("REVIEW");
  const [shopSelection, setShopSelection] = useState<string[]>(shops.map((shop) => shop.id));
  const shopIds = reconcileShopSelection(shopSelection, shops);
  const [basis, setBasis] = useState<AffiliateDetailTimeBasis>("APPLICATION_DATE");
  const [range, setRange] = useState(defaultAffiliateDateRange);
  const [reviewRange, setReviewRange] = useState(defaultReviewActionRange);
  const [filters, setFilters] = useState<AffiliateDetailFilterDraft>(
    EMPTY_AFFILIATE_DETAIL_FILTERS,
  );
  const [selectedApplication, setSelectedApplication] = useState<{
    shopId: string;
    applicationId: string;
    /** Application-date window bounding the order lines (a review-time search has none of its own). */
    window: Pick<GQL.EcomBiQueryInput, "startDateGe" | "endDateLt">;
  } | null>(null);
  const { data: reviewerData } = useQuery<{
    affiliateSampleReviewerOptions: GQL.AffiliateSampleReviewerOption[];
  }>(AFFILIATE_SAMPLE_REVIEWER_OPTIONS_QUERY);
  const reviewerOptions = reviewerData?.affiliateSampleReviewerOptions ?? [];
  const pages = useAffiliateDetailPages();
  const exporter = useAffiliateDetailExport();
  const tableRef = useRef<HTMLDivElement>(null);

  // Everything below the filter panel describes the frozen search, not the draft.
  const resultEntity = pages.input ? affiliateDetailEntityOf(pages.input) : entity;
  const columns = AFFILIATE_DETAIL_COLUMNS[resultEntity];
  const label = (key: string) => affiliateDetailLabel(t, key);
  const cell = (row: Row, key: string) => affiliateDetailCell(t, i18n.language, row, key);
  const reviewBounds = reviewActionBounds(reviewRange);
  const windowValid =
    basis === "REVIEW_ACTION" ? reviewBounds !== null : range.startDateGe < range.endDateLt;
  const searching = pages.loading && pages.rows.length === 0;

  const clearResults = () => {
    exporter.cancel();
    exporter.clearError();
    setSelectedApplication(null);
  };

  const search = () => {
    if (!shopIds.length || !windowValid) return;
    clearResults();
    void pages.search(
      buildAffiliateDetailInput({
        entity,
        shopIds,
        window:
          basis === "REVIEW_ACTION" && reviewBounds
            ? { basis, ...reviewBounds }
            : { basis: "APPLICATION_DATE", ...range },
        filters,
      }),
    );
  };

  const goTo = async (pageIndex: number) => {
    if (await pages.goTo(pageIndex)) revealTableStart(tableRef.current);
  };

  const downloadAll = () => {
    const input = pages.input;
    if (!input) return;
    const review = affiliateDetailEntityOf(input) === "REVIEW";
    void exporter.start({
      input,
      columns,
      sheetName: review ? "Sample review" : "Fulfillment",
      filename: `affiliate-${review ? "sample-review" : "fulfillment"}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      // A spreadsheet date-time has no zone, so its header names the clock it shows.
      label: (key) =>
        key === "SAMPLE_REVIEW_ACTION_AT"
          ? t("ecommerce.affiliateAnalytics.details.exportTimeZoneHeader", {
              label: label(key),
              zone: deviceUtcOffsetLabel(),
            })
          : label(key),
      displayText: (key, value) => cell({ [key]: value }, key),
    });
  };

  const openOrders = (row: Row) => {
    const shopId = String(row.SHOP_ID ?? "");
    const applicationId = String(row.SAMPLE_APPLICATION_ID ?? "");
    const input = pages.input;
    if (!shopId || !applicationId || !input) return;
    // The order dataset is windowed by application date. A review-time search
    // has no such window, so bound the lines by the application's own day.
    const applicationDate = typeof row.DATE === "string" ? row.DATE : "";
    const orderWindow =
      input.startDateGe && input.endDateLt
        ? { startDateGe: input.startDateGe, endDateLt: input.endDateLt }
        : applicationDate
          ? { startDateGe: applicationDate, endDateLt: endDateLtFromInclusive(applicationDate) }
          : null;
    if (!orderWindow) return;
    setSelectedApplication({ shopId, applicationId, window: orderWindow });
  };

  const renderCells = (row: Row) =>
    columns.map((key) => (
      <td
        key={key}
        className={cellClass(key)}
        title={key === "AFFILIATE_SAMPLE_REVIEWER" ? cell(row, key) : affiliateDetailTitle(row[key])}
      >
        {SENSITIVE_TEXT_FIELDS.has(key) ? (
          <TkPrivate sensitive>{cell(row, key)}</TkPrivate>
        ) : (
          cell(row, key)
        )}
      </td>
    ));

  return (
    <section className="affiliate-details">
      <TkPanel as="section" padding="none">
        <TkPanelHeader
          eyebrow={t("ecommerce.affiliateAnalytics.details.eyebrow")}
          title={t("ecommerce.affiliateAnalytics.details.title")}
          description={t("ecommerce.affiliateAnalytics.details.subtitle")}
        />
        <TkPanelBody>
          <TkFormStack
            gap="md"
            className="affiliate-detail-query"
            data-tutorial-id="affiliate-analytics-details-query"
          >
            <div className="affiliate-detail-controls">
              <TkChoiceSelect
                className="affiliate-detail-field"
                label={t("ecommerce.affiliateAnalytics.details.entity")}
                value={entity}
                onChange={(next) => {
                  clearResults();
                  pages.reset();
                  setEntity(next as AffiliateDetailEntity);
                  setFilters(EMPTY_AFFILIATE_DETAIL_FILTERS);
                }}
                options={[
                  { value: "REVIEW", label: t("ecommerce.affiliateAnalytics.details.review") },
                  {
                    value: "FULFILLMENT",
                    label: t("ecommerce.affiliateAnalytics.details.fulfillment"),
                  },
                ]}
              />
              <AffiliateShopScopeControl
                shops={shops}
                selected={shopIds}
                onChange={setShopSelection}
              />
              <AffiliateDetailWindowFields
                basis={basis}
                onBasisChange={setBasis}
                dateRange={range}
                onDateRangeChange={setRange}
                reviewRange={reviewRange}
                onReviewRangeChange={setReviewRange}
              />
            </div>
            {basis === "REVIEW_ACTION" && (
              <p className="affiliate-detail-note">
                {t("ecommerce.affiliateAnalytics.details.deviceTimeZone", {
                  zone: deviceTimeZoneLabel(),
                })}
                {reviewBounds === null &&
                  ` ${t("ecommerce.affiliateAnalytics.details.reviewTimeInvalid")}`}
              </p>
            )}
            <div
              className="tk-v1-form-action-row"
              data-tutorial-id="affiliate-analytics-details-filters"
            >
              <div className="affiliate-detail-controls">
                {entity === "REVIEW" ? (
                  <AffiliateReviewFilters
                    value={filters}
                    onChange={setFilters}
                    reviewerOptions={reviewerOptions}
                  />
                ) : (
                  <AffiliateFulfillmentFilters
                    value={filters}
                    onChange={setFilters}
                    reviewerOptions={reviewerOptions}
                  />
                )}
              </div>
              <TkButton
                variant="primary"
                loading={searching}
                disabled={!shopIds.length || !windowValid || pages.loading}
                onClick={search}
              >
                {t("ecommerce.affiliateAnalytics.details.search")}
              </TkButton>
            </div>
            <div className="affiliate-detail-notes">
              <p className="affiliate-detail-note">
                {t(
                  basis === "REVIEW_ACTION"
                    ? "ecommerce.affiliateAnalytics.details.reviewTimeNote"
                    : "ecommerce.affiliateAnalytics.details.dateNote",
                )}
              </p>
              <p className="affiliate-detail-note">
                {t("ecommerce.affiliateAnalytics.details.creatorNote")}
              </p>
            </div>
          </TkFormStack>
        </TkPanelBody>
      </TkPanel>

      <TkPanel as="section" padding="none" data-tutorial-id="affiliate-analytics-details-results">
        <TkPanelHeader
          eyebrow={
            resultEntity === "REVIEW"
              ? t("ecommerce.affiliateAnalytics.details.review")
              : t("ecommerce.affiliateAnalytics.details.fulfillment")
          }
          title={t("ecommerce.affiliateAnalytics.details.results")}
          description={t("ecommerce.affiliateAnalytics.details.resultNote")}
          actions={
            pages.input && pages.totalRows ? (
              <AffiliateDetailExportControl
                totalRows={pages.totalRows}
                exporter={exporter}
                disabled={searching}
                onStart={downloadAll}
              />
            ) : undefined
          }
        />
        {(pages.error !== null || exporter.error !== null) && (
          <TkPanelBody className="affiliate-detail-alerts">
            {pages.error && (
              <TkAlert tone="danger" title={t("ecommerce.affiliateAnalytics.sectionErrorTitle")}>
                {pages.error}
              </TkAlert>
            )}
            <AffiliateDetailExportAlert error={exporter.error} />
          </TkPanelBody>
        )}
        {pages.rows.length === 0 ? (
          searching ? (
            <TkPanelBody>
              <TkLoadingState size="inline" label={t("ecommerce.affiliateAnalytics.loading")} />
            </TkPanelBody>
          ) : pages.error ? null : (
            <TkPanelBody>
              <TkEmptyState
                title={
                  pages.input
                    ? t("ecommerce.affiliateAnalytics.noDataTitle")
                    : t("ecommerce.affiliateAnalytics.details.searchPrompt")
                }
                description={pages.input ? t("ecommerce.affiliateAnalytics.noDataBody") : undefined}
              />
            </TkPanelBody>
          )
        ) : (
          <>
            <TkTableFrame
              ref={tableRef}
              variant="embedded"
              className="affiliate-detail-table"
              aria-busy={pages.loading || undefined}
            >
              <table>
                <thead>
                  <tr>
                    {columns.map((key) => (
                      <th key={key} className={cellClass(key)}>
                        {label(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pages.rows.map((row, index) => {
                    const key = `${String(row.SHOP_ID)}:${String(row.SAMPLE_APPLICATION_ID)}:${index}`;
                    return resultEntity === "FULFILLMENT" ? (
                      <TkInteractiveTableRow
                        key={key}
                        aria-label={`${t("ecommerce.affiliateAnalytics.details.viewOrders")}: ${affiliateDetailTitle(row.SAMPLE_APPLICATION_ID)}`}
                        onActivate={() => openOrders(row)}
                      >
                        {renderCells(row)}
                      </TkInteractiveTableRow>
                    ) : (
                      <tr key={key}>{renderCells(row)}</tr>
                    );
                  })}
                </tbody>
              </table>
            </TkTableFrame>
            {pages.totalRows !== null && (
              <TkPanelFooter>
                <AffiliateDetailPager
                  pageIndex={pages.pageIndex}
                  pageSize={AFFILIATE_DETAIL_PAGE_SIZE}
                  totalRows={pages.totalRows}
                  loading={pages.loading}
                  onPageChange={(pageIndex) => void goTo(pageIndex)}
                />
              </TkPanelFooter>
            )}
          </>
        )}
      </TkPanel>

      {selectedApplication && pages.input && (
        <AffiliateDetailOrdersModal
          key={`${selectedApplication.shopId}:${selectedApplication.applicationId}`}
          shopId={selectedApplication.shopId}
          applicationId={selectedApplication.applicationId}
          search={selectedApplication.window}
          onClose={() => setSelectedApplication(null)}
        />
      )}
    </section>
  );
}
