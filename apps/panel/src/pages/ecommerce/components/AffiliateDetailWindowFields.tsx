import { useTranslation } from "react-i18next";
import { TkChoiceSelect, TkField } from "../../../components/design-system/index.js";
import {
  endDateLtFromInclusive,
  formatInputEndDate,
  type AffiliateDateRange,
} from "../affiliate-analytics.js";
import type { LocalDateTimeRange } from "../affiliate-review-time.js";

export type AffiliateDetailTimeBasis = "APPLICATION_DATE" | "REVIEW_ACTION";

type Props = {
  basis: AffiliateDetailTimeBasis;
  onBasisChange: (next: AffiliateDetailTimeBasis) => void;
  dateRange: AffiliateDateRange;
  onDateRangeChange: (next: AffiliateDateRange) => void;
  reviewRange: LocalDateTimeRange;
  onReviewRangeChange: (next: LocalDateTimeRange) => void;
};

/**
 * Time basis selector plus its two bounds. The application date is whole days
 * (inclusive end date); the review action time is a device-local date-time
 * window whose end is exclusive, so the bounds read exactly as they are sent.
 */
export function AffiliateDetailWindowFields({
  basis,
  onBasisChange,
  dateRange,
  onDateRangeChange,
  reviewRange,
  onReviewRangeChange,
}: Props) {
  const { t } = useTranslation();
  return (
    <>
      <TkChoiceSelect
        className="affiliate-detail-field"
        label={t("ecommerce.affiliateAnalytics.details.timeBasis")}
        value={basis}
        onChange={(next) => onBasisChange(next as AffiliateDetailTimeBasis)}
        options={[
          {
            value: "APPLICATION_DATE",
            label: t("ecommerce.affiliateAnalytics.details.timeBasisApplication"),
          },
          {
            value: "REVIEW_ACTION",
            label: t("ecommerce.affiliateAnalytics.details.timeBasisReviewAction"),
          },
        ]}
      />
      {basis === "REVIEW_ACTION" ? (
        <>
          <TkField
            className="affiliate-detail-field affiliate-detail-field-wide"
            type="datetime-local"
            label={t("ecommerce.affiliateAnalytics.details.reviewStartTime")}
            value={reviewRange.start}
            onChange={(event) => onReviewRangeChange({ ...reviewRange, start: event.target.value })}
          />
          <TkField
            className="affiliate-detail-field affiliate-detail-field-wide"
            type="datetime-local"
            label={t("ecommerce.affiliateAnalytics.details.reviewEndTime")}
            value={reviewRange.end}
            onChange={(event) => onReviewRangeChange({ ...reviewRange, end: event.target.value })}
          />
        </>
      ) : (
        <>
          <TkField
            className="affiliate-detail-field"
            type="date"
            label={t("ecommerce.affiliateAnalytics.startDate")}
            value={dateRange.startDateGe}
            onChange={(event) =>
              onDateRangeChange({ ...dateRange, startDateGe: event.target.value })
            }
          />
          <TkField
            className="affiliate-detail-field"
            type="date"
            label={t("ecommerce.affiliateAnalytics.endDate")}
            value={formatInputEndDate(dateRange.endDateLt)}
            onChange={(event) =>
              onDateRangeChange({
                ...dateRange,
                endDateLt: endDateLtFromInclusive(event.target.value),
              })
            }
          />
        </>
      )}
    </>
  );
}
