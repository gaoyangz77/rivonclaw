import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  TkAlert,
  TkButton,
  TkChoiceSelect,
  TkEmptyState,
  TkField,
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
import {
  defaultAffiliateDateRange,
  endDateLtFromInclusive,
  formatInputEndDate,
} from "../affiliate-analytics.js";
import {
  reconcileShopSelection,
  type AffiliateAnalyticsShop,
} from "../affiliate-analytics-scope.js";
import {
  AFFILIATE_DETAIL_PAGE_SIZE,
  useAffiliateDetailPages,
} from "../hooks/useAffiliateDetailPages.js";
import { useAffiliateDetailExport } from "../hooks/useAffiliateDetailExport.js";
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
  const [range, setRange] = useState(defaultAffiliateDateRange);
  const [filters, setFilters] = useState<AffiliateDetailFilterDraft>(EMPTY_AFFILIATE_DETAIL_FILTERS);
  const [selectedApplication, setSelectedApplication] = useState<{
    shopId: string;
    applicationId: string;
  } | null>(null);
  const pages = useAffiliateDetailPages();
  const exporter = useAffiliateDetailExport();
  const tableRef = useRef<HTMLDivElement>(null);

  // Everything below the filter panel describes the frozen search, not the draft.
  const resultEntity = pages.input ? affiliateDetailEntityOf(pages.input) : entity;
  const columns = AFFILIATE_DETAIL_COLUMNS[resultEntity];
  const label = (key: string) => affiliateDetailLabel(t, key);
  const cell = (row: Row, key: string) => affiliateDetailCell(t, i18n.language, row, key);
  const rangeValid = range.startDateGe < range.endDateLt;
  const searching = pages.loading && pages.rows.length === 0;

  const clearResults = () => {
    exporter.cancel();
    exporter.clearError();
    setSelectedApplication(null);
  };

  const search = () => {
    if (!shopIds.length || !rangeValid) return;
    clearResults();
    void pages.search(
      buildAffiliateDetailInput({
        entity,
        shopIds,
        startDateGe: range.startDateGe,
        endDateLt: range.endDateLt,
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
      label,
      displayText: (key, value) => cell({ [key]: value }, key),
    });
  };

  const openOrders = (row: Row) => {
    const shopId = String(row.SHOP_ID ?? "");
    const applicationId = String(row.SAMPLE_APPLICATION_ID ?? "");
    if (!shopId || !applicationId) return;
    setSelectedApplication({ shopId, applicationId });
  };

  const renderCells = (row: Row) =>
    columns.map((key) => (
      <td key={key} className={cellClass(key)} title={affiliateDetailTitle(row[key])}>
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
          <TkFormStack gap="md" className="affiliate-detail-query">
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
              <TkField
                className="affiliate-detail-field"
                type="date"
                label={t("ecommerce.affiliateAnalytics.startDate")}
                value={range.startDateGe}
                onChange={(event) => setRange({ ...range, startDateGe: event.target.value })}
              />
              <TkField
                className="affiliate-detail-field"
                type="date"
                label={t("ecommerce.affiliateAnalytics.endDate")}
                value={formatInputEndDate(range.endDateLt)}
                onChange={(event) =>
                  setRange({ ...range, endDateLt: endDateLtFromInclusive(event.target.value) })
                }
              />
            </div>
            <div className="tk-v1-form-action-row">
              <div className="affiliate-detail-controls">
                {entity === "REVIEW" ? (
                  <AffiliateReviewFilters value={filters} onChange={setFilters} />
                ) : (
                  <AffiliateFulfillmentFilters value={filters} onChange={setFilters} />
                )}
              </div>
              <TkButton
                variant="primary"
                loading={searching}
                disabled={!shopIds.length || !rangeValid || pages.loading}
                onClick={search}
              >
                {t("ecommerce.affiliateAnalytics.details.search")}
              </TkButton>
            </div>
            <div className="affiliate-detail-notes">
              <p className="affiliate-detail-note">
                {t("ecommerce.affiliateAnalytics.details.dateNote")}
              </p>
              <p className="affiliate-detail-note">
                {t("ecommerce.affiliateAnalytics.details.creatorNote")}
              </p>
            </div>
          </TkFormStack>
        </TkPanelBody>
      </TkPanel>

      <TkPanel as="section" padding="none">
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
                description={
                  pages.input ? t("ecommerce.affiliateAnalytics.noDataBody") : undefined
                }
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
          search={pages.input}
          onClose={() => setSelectedApplication(null)}
        />
      )}
    </section>
  );
}
