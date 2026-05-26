import { useTranslation } from "react-i18next";
import type { BillingOverview, BillingPlanDefinition } from "@rivonclaw/core/models";
import {
  billingEnumLabel,
  billingPlanDisplayName,
  entitlementStatusLabel,
  findPlanDefinition,
  sortUsageWindows,
  usagePercentLabel,
} from "../../../components/billing/billing-labels.js";

interface AccountProfileCardProps {
  user: { name: string | null; email: string; createdAt: string };
  initial: string;
  billingOverview: BillingOverview | null;
  planDefinitions: readonly BillingPlanDefinition[];
  onLogout: () => void;
}

export function AccountProfileCard({
  user,
  initial,
  billingOverview,
  planDefinitions,
  onLogout,
}: AccountProfileCardProps) {
  const { t } = useTranslation();
  const accountLlm = billingOverview?.accountLlm ?? null;
  const llmUsages = sortUsageWindows(accountLlm?.entitlement.usage ?? []);
  const validUntil = accountLlm?.entitlement.validUntil ?? null;
  const accountPlan = findPlanDefinition(
    planDefinitions,
    accountLlm?.planId,
    accountLlm?.entitlement.product,
  );
  const planLabel = accountPlan
    ? billingPlanDisplayName(t, accountPlan)
    : accountLlm?.entitlement.subscription
      ? entitlementStatusLabel(t, accountLlm.entitlement)
      : t("billing.notSubscribed");

  return (
    <div className="section-card account-profile-card">
      <div className="account-profile-header">
        <div className="account-profile-identity">
          <div className="account-avatar">{initial}</div>
          <div className="account-profile-name-group">
            {user.name && <span className="account-profile-name">{user.name}</span>}
            <span className="account-profile-email">{user.email}</span>
          </div>
        </div>
        <button className="btn btn-danger btn-sm" onClick={onLogout}>
          {t("auth.logout")}
        </button>
      </div>

      <div className="account-info-grid">
        <div className="account-info-item">
          <span className="account-info-label">{t("account.plan")}</span>
          <span className="account-info-value">
            <span className="acct-badge acct-badge-plan">
              {accountLlm?.entitlement ? planLabel : "\u2014"}
            </span>
          </span>
        </div>
        <div className="account-info-item">
          <span className="account-info-label">{t("account.memberSince")}</span>
          <span className="account-info-value">
            {new Date(user.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className="account-info-item">
          <span className="account-info-label">{t("account.validUntil")}</span>
          <span className="account-info-value">
            {validUntil ? new Date(validUntil).toLocaleDateString() : "\u2014"}
          </span>
        </div>
        {llmUsages.length > 0 && (
          <div className="account-info-item account-info-item-wide quota-weekly account-usage-list">
            {llmUsages.map((usage) => {
              const remainingPercent = usage.remainingPercent;
              return (
                <div className="account-usage-row" key={`${usage.metric}:${usage.window}`}>
                  <div className="quota-header">
                    <span className="account-info-label">
                      {billingEnumLabel(t, "usageMetric", usage.metric)}
                      <span className="account-usage-window">
                        {billingEnumLabel(t, "usageWindow", usage.window)}
                      </span>
                    </span>
                    <span className="quota-refresh-time">
                      {t("account.quotaRefreshAt", { time: new Date(usage.refreshAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) })}
                    </span>
                  </div>
                  <div className="quota-bar-wrap">
                    <progress
                      className={`quota-bar${remainingPercent < 20 ? " quota-bar-low" : ""}`}
                      value={remainingPercent}
                      max={100}
                    />
                    <span className="quota-bar-label">
                      {t("billing.usageRemainingPercent", { percent: usagePercentLabel(remainingPercent) })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
