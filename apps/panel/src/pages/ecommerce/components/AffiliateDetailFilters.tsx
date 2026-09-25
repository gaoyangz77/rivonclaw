import { useTranslation } from "react-i18next";
import { TkChoiceSelect, TkField } from "../../../components/design-system/index.js";
import type { AffiliateDetailFilterDraft } from "../affiliate-detail-query.js";

type Props = {
  value: AffiliateDetailFilterDraft;
  onChange: (next: AffiliateDetailFilterDraft) => void;
};

function CommonFilters({ value, onChange }: Props) {
  const { t } = useTranslation();
  const set = (key: keyof AffiliateDetailFilterDraft, next: string) =>
    onChange({ ...value, [key]: next });
  return (
    <>
      <TkChoiceSelect
        className="affiliate-detail-field"
        label={t("ecommerce.affiliateAnalytics.details.origin")}
        value={value.origin}
        onChange={(next) => set("origin", next)}
        options={[
          { value: "", label: t("ecommerce.affiliateAnalytics.details.all") },
          { value: "AI", label: t("ecommerce.affiliateAnalytics.details.ai") },
          { value: "NOT_AI", label: t("ecommerce.affiliateAnalytics.details.notAi") },
        ]}
      />
      <TkField
        className="affiliate-detail-field affiliate-detail-field-wide"
        type="search"
        label={t("ecommerce.affiliateAnalytics.details.creatorId")}
        value={value.creatorId}
        onChange={(event) => set("creatorId", event.target.value)}
      />
      <TkField
        className="affiliate-detail-field affiliate-detail-field-wide"
        type="search"
        label={t("ecommerce.affiliateAnalytics.details.productId")}
        value={value.productId}
        onChange={(event) => set("productId", event.target.value)}
      />
    </>
  );
}

export function AffiliateReviewFilters(props: Props) {
  const { t } = useTranslation();
  const { value, onChange } = props;
  return (
    <>
      <CommonFilters {...props} />
      <TkChoiceSelect
        className="affiliate-detail-field"
        label={t("ecommerce.affiliateAnalytics.details.decision")}
        value={value.decision}
        onChange={(next) => onChange({ ...value, decision: next })}
        options={[
          { value: "", label: t("ecommerce.affiliateAnalytics.details.all") },
          ...["APPROVED", "MERCHANT_REJECTED", "OVERDUE_BY_US", "IN_FLIGHT"].map((id) => ({
            value: id,
            label: t(`ecommerce.affiliateAnalytics.details.decisions.${id}`),
          })),
        ]}
      />
    </>
  );
}

export function AffiliateFulfillmentFilters(props: Props) {
  const { t } = useTranslation();
  const { value, onChange } = props;
  const set = (key: keyof AffiliateDetailFilterDraft, next: string) =>
    onChange({ ...value, [key]: next });
  const yesNo = [
    { value: "", label: t("ecommerce.affiliateAnalytics.details.all") },
    { value: "1", label: t("ecommerce.affiliateAnalytics.details.yes") },
    { value: "0", label: t("ecommerce.affiliateAnalytics.details.no") },
  ];
  return (
    <>
      <CommonFilters {...props} />
      <TkChoiceSelect
        className="affiliate-detail-field"
        label={t("ecommerce.affiliateAnalytics.details.shipmentObserved")}
        value={value.shipped}
        options={yesNo}
        onChange={(next) => set("shipped", next)}
      />
      <TkChoiceSelect
        className="affiliate-detail-field"
        label={t("ecommerce.affiliateAnalytics.details.contentObserved")}
        value={value.hasContent}
        options={yesNo}
        onChange={(next) => set("hasContent", next)}
      />
      <TkChoiceSelect
        className="affiliate-detail-field"
        label={t("ecommerce.affiliateAnalytics.details.postApplicationOrder")}
        value={value.postApplicationOrder}
        options={yesNo}
        onChange={(next) => set("postApplicationOrder", next)}
      />
    </>
  );
}
