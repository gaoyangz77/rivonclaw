import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  billingEnumLabel,
  billingPlanDisplayName,
  entitlementStatusLabel,
  findPlanDefinition,
  sortUsageWindows,
  usagePercentLabel,
} from "../../../components/billing/billing-labels.js";
import { CheckIcon, CopyIcon, InfoIcon } from "../../../components/icons.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { getUserInitial } from "../../../lib/user-manager.js";

interface AccountProfileCardProps {
  onLogout: () => void;
}

export function AccountProfileCard({
  onLogout,
}: AccountProfileCardProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const [inviteCopied, setInviteCopied] = useState(false);
  if (!user) return null;
  const initial = getUserInitial(user);
  const billingOverview = entityStore.billingOverview;
  const planDefinitions = entityStore.billingPlanDefinitions;
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
  const inviteCode = user.agent?.active ? user.agent.inviteCode ?? null : null;

  async function copyInviteCode() {
    if (!inviteCode) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteCode);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = inviteCode;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 1400);
    } catch {
      setInviteCopied(false);
    }
  }

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
        {inviteCode && (
          <div className="account-info-item account-invite-item">
            <span className="account-info-label account-invite-label">
              {t("account.inviteCode")}
              <span
                className="account-invite-help has-tooltip"
                data-tooltip={t("account.inviteCodeTooltip")}
                aria-label={t("account.inviteCodeTooltip")}
                tabIndex={0}
              >
                <InfoIcon size={13} />
              </span>
            </span>
            <span className="account-info-value account-invite-value">
              <span className="account-invite-code">{inviteCode}</span>
              <button
                type="button"
                className={`account-invite-copy${inviteCopied ? " account-invite-copy-copied" : ""}`}
                onClick={() => void copyInviteCode()}
                title={inviteCopied ? t("common.copied") : t("common.copy")}
                aria-label={inviteCopied ? t("common.copied") : t("common.copy")}
              >
                {inviteCopied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
              </button>
            </span>
          </div>
        )}
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
