import { useTranslation } from "react-i18next";
import { Select } from "../../../components/inputs/Select.js";

export interface AffiliateDetailFilterDraft {
  origin: string;
  decision: string;
  creatorId: string;
  productId: string;
  shipped: string;
  hasContent: string;
  postApplicationOrder: string;
}

type Props = {
  value: AffiliateDetailFilterDraft;
  onChange: (next: AffiliateDetailFilterDraft) => void;
};

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <Select ariaLabel={label} value={value} options={options} onChange={onChange} />
    </label>
  );
}

function CommonFilters({ value, onChange }: Props) {
  const { t } = useTranslation();
  const set = (key: keyof AffiliateDetailFilterDraft, next: string) =>
    onChange({ ...value, [key]: next });
  return (
    <>
      <Choice
        label={t("ecommerce.affiliateAnalytics.details.origin")}
        value={value.origin}
        onChange={(next) => set("origin", next)}
        options={[
          { value: "", label: t("ecommerce.affiliateAnalytics.details.all") },
          { value: "AI", label: t("ecommerce.affiliateAnalytics.details.ai") },
          { value: "NOT_AI", label: t("ecommerce.affiliateAnalytics.details.notAi") },
        ]}
      />
      <label>
        <span>{t("ecommerce.affiliateAnalytics.details.creatorId")}</span>
        <input
          type="search"
          value={value.creatorId}
          onChange={(event) => set("creatorId", event.target.value)}
        />
      </label>
      <label>
        <span>{t("ecommerce.affiliateAnalytics.details.productId")}</span>
        <input
          type="search"
          value={value.productId}
          onChange={(event) => set("productId", event.target.value)}
        />
      </label>
    </>
  );
}

export function AffiliateReviewFilters(props: Props) {
  const { t } = useTranslation();
  const { value, onChange } = props;
  return (
    <>
      <CommonFilters {...props} />
      <Choice
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
      <Choice
        label={t("ecommerce.affiliateAnalytics.details.shipmentObserved")}
        value={value.shipped}
        options={yesNo}
        onChange={(next) => set("shipped", next)}
      />
      <Choice
        label={t("ecommerce.affiliateAnalytics.details.contentObserved")}
        value={value.hasContent}
        options={yesNo}
        onChange={(next) => set("hasContent", next)}
      />
      <Choice
        label={t("ecommerce.affiliateAnalytics.details.postApplicationOrder")}
        value={value.postApplicationOrder}
        options={yesNo}
        onChange={(next) => set("postApplicationOrder", next)}
      />
    </>
  );
}
