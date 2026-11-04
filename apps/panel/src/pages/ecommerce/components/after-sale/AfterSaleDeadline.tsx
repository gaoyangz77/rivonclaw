import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { afterSaleDeadlineState, type AfterSaleDuration } from "../../../../lib/after-sale.js";

export function formatAfterSaleDuration(t: TFunction, duration: AfterSaleDuration): string {
  return t(`ecommerce.afterSale.duration.${duration.format}`, {
    days: duration.days,
    hours: duration.hours,
    minutes: duration.minutes,
  });
}

/** Time left until the platform deadline, or the request's age when the platform sets none. */
export function AfterSaleDeadline({
  sellerActionDeadline,
  createTime,
  nowMs,
}: {
  sellerActionDeadline: string | null;
  createTime: string;
  nowMs: number;
}) {
  const { t } = useTranslation();
  const state = afterSaleDeadlineState({ sellerActionDeadline, createTime }, nowMs);
  if (state.state === "overdue") {
    return (
      <span className="after-sale-deadline after-sale-deadline-urgent">
        {t("ecommerce.afterSale.timeLeft.overdue")}
      </span>
    );
  }
  if (state.state === "left") {
    return (
      <span
        className={
          state.urgent ? "after-sale-deadline after-sale-deadline-urgent" : "after-sale-deadline"
        }
      >
        {formatAfterSaleDuration(t, state.duration)}
      </span>
    );
  }
  return (
    <span className="after-sale-deadline after-sale-deadline-none">
      <span>{t("ecommerce.afterSale.timeLeft.noDeadline")}</span>
      <small>
        {t("ecommerce.afterSale.timeLeft.waiting", {
          duration: formatAfterSaleDuration(t, state.age),
        })}
      </small>
    </span>
  );
}
