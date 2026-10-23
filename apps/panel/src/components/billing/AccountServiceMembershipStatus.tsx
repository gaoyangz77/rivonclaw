import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import type { BillingEntitlementStatus } from "@rivonclaw/core/models";
import { formatLocalizedDateTime } from "../../lib/format-datetime.js";
import "./AccountServiceMembershipStatus.css";

export const AccountServiceMembershipStatus = observer(function AccountServiceMembershipStatus({
  entitlement,
}: {
  entitlement: BillingEntitlementStatus;
}) {
  const { t, i18n } = useTranslation();
  return (
    <div
      className={`cs-billing-access-card account-service-membership${entitlement.allowed ? " cs-billing-access-active" : ""}`}
      data-testid="account-service-membership"
    >
      <div className="cs-billing-access-head account-membership-header">
        <strong>{t("billing.accountCustomerService")}</strong>
        <span className={entitlement.allowed ? "badge badge-active" : "badge badge-warning"}>
          {t(entitlement.allowed ? "billing.accountCoverage" : "billing.contactAdminRenewal")}
        </span>
      </div>
      <dl className="account-membership-details">
        <div>
          <dt>{t("billing.validUntil")}</dt>
          <dd>{formatLocalizedDateTime(entitlement.validUntil, i18n.language, undefined, "-")}</dd>
        </div>
        <div>
          <dt>{t("billing.renewalMode")}</dt>
          <dd>{t("billing.offlineSettlement")}</dd>
        </div>
      </dl>
    </div>
  );
});
