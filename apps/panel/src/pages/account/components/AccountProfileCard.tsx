import { useTranslation } from "react-i18next";
import type { BillingOverview } from "@rivonclaw/core/models";

interface AccountProfileCardProps {
  user: { name: string | null; email: string; createdAt: string };
  initial: string;
  billingOverview: BillingOverview | null;
  onLogout: () => void;
}

export function AccountProfileCard({
  user,
  initial,
  billingOverview,
  onLogout,
}: AccountProfileCardProps) {
  const { t } = useTranslation();
  const accountLlm = billingOverview?.accountLlm ?? null;
  const llmUsage = accountLlm?.entitlement.usage[0] ?? null;
  const validUntil = accountLlm?.entitlement.validUntil ?? null;
  const usagePercent = llmUsage && llmUsage.limit > 0
    ? Math.max(0, Math.min(100, (llmUsage.remaining / llmUsage.limit) * 100))
    : null;

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
              {accountLlm?.planId ?? accountLlm?.entitlement.code ?? "\u2014"}
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
        {llmUsage && usagePercent !== null && (
          <div className="account-info-item account-info-item-wide quota-weekly">
            <div className="quota-header">
              <span className="account-info-label">{llmUsage.metric}</span>
              <span className="quota-refresh-time">
                {t("account.quotaRefreshAt", { time: new Date(llmUsage.refreshAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) })}
              </span>
            </div>
            <div className="quota-bar-wrap">
              <progress
                className={`quota-bar${usagePercent < 20 ? " quota-bar-low" : ""}`}
                value={usagePercent}
                max={100}
              />
              <span className="quota-bar-label">
                {llmUsage.remaining}/{llmUsage.limit}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
