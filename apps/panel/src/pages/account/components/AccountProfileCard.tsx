import { useTranslation } from "react-i18next";

interface AccountProfileCardProps {
  user: { name: string | null; email: string; plan: string; createdAt: string };
  initial: string;
  subscription: { plan: string; validUntil: string } | null;
  llmQuota: {
    fiveHour: { remainingPercent: number; refreshAt: string };
    weekly: { remainingPercent: number; refreshAt: string };
  } | null;
  onLogout: () => void;
}

export function AccountProfileCard({
  user,
  initial,
  subscription,
  llmQuota,
  onLogout,
}: AccountProfileCardProps) {
  const { t } = useTranslation();

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
            <span className="acct-badge acct-badge-plan">{t(`subscription.${(subscription?.plan ?? user.plan).toLowerCase()}`)}</span>
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
            {subscription ? new Date(subscription.validUntil).toLocaleDateString() : "\u2014"}
          </span>
        </div>
        {llmQuota && (
          <>
            <div className="account-info-item account-info-item-wide quota-five-hour">
              <div className="quota-header">
                <span className="account-info-label">{t("account.quotaFiveHour")}</span>
                <span className="quota-refresh-time">
                  {t("account.quotaRefreshAt", { time: new Date(llmQuota.fiveHour.refreshAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })}
                </span>
              </div>
              <div className="quota-bar-wrap">
                <progress
                  className={`quota-bar${llmQuota.fiveHour.remainingPercent < 20 ? " quota-bar-low" : ""}`}
                  value={llmQuota.fiveHour.remainingPercent}
                  max={100}
                />
                <span className="quota-bar-label">{Math.round(llmQuota.fiveHour.remainingPercent)}%</span>
              </div>
            </div>
            <div className="account-info-item account-info-item-wide quota-weekly">
              <div className="quota-header">
                <span className="account-info-label">{t("account.quotaWeekly")}</span>
                <span className="quota-refresh-time">
                  {t("account.quotaRefreshAt", { time: new Date(llmQuota.weekly.refreshAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) })}
                </span>
              </div>
              <div className="quota-bar-wrap">
                <progress
                  className={`quota-bar${llmQuota.weekly.remainingPercent < 20 ? " quota-bar-low" : ""}`}
                  value={llmQuota.weekly.remainingPercent}
                  max={100}
                />
                <span className="quota-bar-label">{Math.round(llmQuota.weekly.remainingPercent)}%</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
