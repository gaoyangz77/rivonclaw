import { useTranslation } from "react-i18next";
import { useId } from "react";
import { Select } from "../../../components/inputs/Select.js";
import { TkInfoTip } from "../../../components/design-system/index.js";

export function BadReviewReachoutContactLimit({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const scheduleId = useId();
  return (
    <div className="shop-review-field shop-review-contact-limit">
      <div className="shop-review-contact-limit-label">
        <span className="form-label-block">
          {t("ecommerce.shopDrawer.aiCS.badReviewReachoutMaxAttempts")}
        </span>
        <TkInfoTip label={t("ecommerce.shopDrawer.aiCS.badReviewReachoutTimingTooltip")} />
      </div>
      <Select
        value={value}
        onChange={onChange}
        ariaLabel={t("ecommerce.shopDrawer.aiCS.badReviewReachoutMaxAttempts")}
        ariaDescribedBy={scheduleId}
        options={[1, 2, 3].map((count) => ({
          value: String(count),
          label: t("ecommerce.shopDrawer.aiCS.badReviewReachoutAttemptCount", { count }),
        }))}
        disabled={disabled}
        className="shop-review-field-input"
      />
      <span id={scheduleId} className="form-hint" aria-live="polite">
        {t(`ecommerce.shopDrawer.aiCS.badReviewReachoutSchedule${value}`)}
      </span>
    </div>
  );
}
