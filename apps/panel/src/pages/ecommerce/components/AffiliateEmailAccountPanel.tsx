import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import {
  EMAIL_ACCOUNT_BINDINGS_QUERY,
  MICROSOFT_GRAPH_CONNECTOR_STATUS_QUERY,
  REVOKE_EMAIL_ACCOUNT_BINDING_MUTATION,
  START_MICROSOFT_EMAIL_OAUTH_MUTATION,
} from "../../../api/shops-queries.js";
import { Select } from "../../../components/inputs/Select.js";
import { useToast } from "../../../components/Toast.js";
import { panelEventBus } from "../../../lib/event-bus.js";

type EmailAccount = GQL.EmailAccountBinding;

type MicrosoftGraphConnectorStatus = {
  configured: boolean;
  oauthConfigured: boolean;
  webhookConfigured: boolean;
  ready: boolean;
  message?: string | null;
  accountCounts: Array<{ status: GQL.EmailAccountStatus; count: number }>;
  subscriptionCounts: Array<{ health: GQL.MicrosoftGraphSubscriptionHealth; count: number }>;
};

type StartMicrosoftEmailOAuthPayload = {
  url: string;
  state: string;
};

export function AffiliateEmailAccountPanel() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [mailboxType, setMailboxType] = useState<GQL.EmailMailboxType>(GQL.EmailMailboxType.Personal);
  const [sharedMailboxAddress, setSharedMailboxAddress] = useState("");

  const {
    data,
    loading,
    refetch,
  } = useQuery<{ emailAccountBindings: EmailAccount[] }>(EMAIL_ACCOUNT_BINDINGS_QUERY, {
    fetchPolicy: "cache-and-network",
  });
  const {
    data: connectorData,
    loading: connectorLoading,
    refetch: refetchConnectorStatus,
  } = useQuery<{ microsoftGraphConnectorStatus: MicrosoftGraphConnectorStatus }>(
    MICROSOFT_GRAPH_CONNECTOR_STATUS_QUERY,
    { fetchPolicy: "cache-and-network" },
  );
  const [startOAuth, { loading: startingOAuth }] = useMutation<
    { startMicrosoftEmailOAuth: StartMicrosoftEmailOAuthPayload },
    { input?: GQL.StartMicrosoftEmailOAuthInput | null }
  >(START_MICROSOFT_EMAIL_OAUTH_MUTATION);
  const [revokeBinding, { loading: revokingBinding }] = useMutation<
    { revokeEmailAccountBinding: EmailAccount },
    { bindingId: string }
  >(REVOKE_EMAIL_ACCOUNT_BINDING_MUTATION);

  const accounts = data?.emailAccountBindings ?? [];
  const connectorStatus = connectorData?.microsoftGraphConnectorStatus ?? null;
  const busy = startingOAuth || revokingBinding;
  const onboardingDisabled = busy || connectorLoading || !connectorStatus?.ready;
  const onboardingDisabledReason = connectorStatus
    ? microsoftGraphConnectorStatusText(t, connectorStatus)
    : t("ecommerce.affiliateWorkspace.email.connectorStatusLoading", {
      defaultValue: "Checking Microsoft Graph connector status.",
    });
  const mailboxOptions = [
    {
      value: GQL.EmailMailboxType.Personal,
      label: t("ecommerce.affiliateWorkspace.email.personalMailbox", { defaultValue: "Personal mailbox" }),
    },
    {
      value: GQL.EmailMailboxType.Shared,
      label: t("ecommerce.affiliateWorkspace.email.sharedMailbox", { defaultValue: "Shared mailbox" }),
    },
  ];

  useEffect(() => {
    return panelEventBus.subscribe("affiliate-outreach-account-connected", (raw) => {
      const event = raw as { channel?: unknown };
      if (event.channel !== "EMAIL") return;
      void Promise.all([refetch(), refetchConnectorStatus()])
        .then(() => {
          showToast(
            t("ecommerce.affiliateWorkspace.email.oauthCompleted", {
              defaultValue: "Outlook mailbox connected.",
            }),
            "success",
          );
        })
        .catch((err: unknown) => {
          showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
        });
    });
  }, [refetch, refetchConnectorStatus, showToast, t]);

  async function handleStartOAuth() {
    if (!connectorStatus?.ready) {
      showToast(onboardingDisabledReason, "error");
      return;
    }
    const sharedAddress = sharedMailboxAddress.trim();
    if (mailboxType === GQL.EmailMailboxType.Shared && !sharedAddress) {
      showToast(
        t("ecommerce.affiliateWorkspace.email.sharedMailboxRequired", {
          defaultValue: "Shared mailbox address is required.",
        }),
        "error",
      );
      return;
    }
    try {
      const result = await startOAuth({
        variables: {
          input: {
            mailboxType,
            sharedMailboxAddress: mailboxType === GQL.EmailMailboxType.Shared ? sharedAddress : null,
          },
        },
      });
      const url = result.data?.startMicrosoftEmailOAuth.url;
      if (!url) throw new Error("Microsoft OAuth URL was not returned");
      window.open(url, "_blank", "noopener,noreferrer");
      showToast(
        t("ecommerce.affiliateWorkspace.email.oauthStarted", {
          defaultValue: "Microsoft sign-in opened. This page will refresh after the callback succeeds.",
        }),
        "success",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function handleRevoke(bindingId: string) {
    try {
      await revokeBinding({ variables: { bindingId } });
      await refetch();
      showToast(
        t("ecommerce.affiliateWorkspace.email.revokeSuccess", { defaultValue: "Outlook account revoked." }),
        "success",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  return (
    <div className="affiliate-email-panel">
      <div className="affiliate-whatsapp-head">
        <div>
          <strong>{t("ecommerce.affiliateWorkspace.email.headline", { defaultValue: "Outlook email accounts" })}</strong>
          <span>
            {t("ecommerce.affiliateWorkspace.email.hint", {
              defaultValue: "Connect seller-level Microsoft mailboxes for creator outreach and inbound email sync.",
            })}
          </span>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          onClick={() => {
            void Promise.all([refetch(), refetchConnectorStatus()]);
          }}
          disabled={loading || connectorLoading}
        >
          {loading || connectorLoading
            ? t("common.loading", { defaultValue: "Loading..." })
            : t("common.refresh", { defaultValue: "Refresh" })}
        </button>
      </div>

      {connectorStatus && (
        <div className={`affiliate-whatsapp-connector affiliate-whatsapp-connector-${connectorStatus.ready ? "ready" : "warning"}`}>
          <div>
            <strong>
              {t("ecommerce.affiliateWorkspace.email.connectorStatus", {
                defaultValue: "Connector status",
              })}
            </strong>
            <span>{microsoftGraphConnectorStatusText(t, connectorStatus)}</span>
          </div>
          <div className="affiliate-whatsapp-connector-metrics">
            <span>
              {t("ecommerce.affiliateWorkspace.email.connectedAccounts", {
                defaultValue: "Connected",
              })}
              : {countEmailAccountStatus(connectorStatus, GQL.EmailAccountStatus.Connected)}
            </span>
            <span>
              {t("ecommerce.affiliateWorkspace.email.activeSubscriptions", {
                defaultValue: "Active subscriptions",
              })}
              : {countSubscriptionHealth(connectorStatus, GQL.MicrosoftGraphSubscriptionHealth.Active)}
            </span>
            <span>
              {t("ecommerce.affiliateWorkspace.email.missingSubscriptions", {
                defaultValue: "Missing subscriptions",
              })}
              : {countSubscriptionHealth(connectorStatus, GQL.MicrosoftGraphSubscriptionHealth.Missing)}
            </span>
          </div>
        </div>
      )}

      <div className="affiliate-email-connect">
        <label>
          <span>{t("ecommerce.affiliateWorkspace.email.mailboxType", { defaultValue: "Mailbox type" })}</span>
          <Select
            value={mailboxType}
            onChange={(value) => setMailboxType(value as GQL.EmailMailboxType)}
            options={mailboxOptions}
            disabled={onboardingDisabled}
          />
        </label>
        {mailboxType === GQL.EmailMailboxType.Shared && (
          <label>
            <span>{t("ecommerce.affiliateWorkspace.email.sharedMailboxAddress", { defaultValue: "Shared mailbox" })}</span>
            <input
              className="input"
              value={sharedMailboxAddress}
              onChange={(event) => setSharedMailboxAddress(event.target.value)}
              placeholder="creators@brand.com"
              disabled={onboardingDisabled}
            />
          </label>
        )}
        <button
          className="btn btn-primary"
          type="button"
          onClick={handleStartOAuth}
          disabled={onboardingDisabled}
          title={onboardingDisabled ? onboardingDisabledReason : undefined}
        >
          {startingOAuth
            ? t("ecommerce.affiliateWorkspace.email.connecting", { defaultValue: "Opening..." })
            : t("ecommerce.affiliateWorkspace.email.connect", { defaultValue: "Connect Outlook" })}
        </button>
      </div>

      <div className="affiliate-email-list">
        {accounts.length === 0 ? (
          <div className="affiliate-email-empty">
            {loading
              ? t("common.loading", { defaultValue: "Loading..." })
              : t("ecommerce.affiliateWorkspace.email.empty", { defaultValue: "No Outlook mailbox connected yet." })}
          </div>
        ) : (
          accounts.map((account) => (
            <div className="affiliate-whatsapp-account" key={account.id}>
              <div className="affiliate-whatsapp-account-main">
                <strong>{account.displayName || account.emailAddress}</strong>
                <small>
                  {account.emailAddress}
                  {account.sharedMailboxAddress ? ` · ${account.sharedMailboxAddress}` : ""}
                </small>
                <span className={`affiliate-whatsapp-status affiliate-whatsapp-status-${account.status.toLowerCase()}`}>
                  {emailStatusLabel(t, account.status)}
                </span>
                {account.lastError ? <em>{account.lastError}</em> : null}
                <small>
                  {t("ecommerce.affiliateWorkspace.email.updatedAt", { defaultValue: "Updated" })}:{" "}
                  {formatDate(account.updatedAt)}
                </small>
              </div>
              <div className="affiliate-whatsapp-account-actions">
                <button
                  className="btn btn-danger btn-sm"
                  type="button"
                  onClick={() => handleRevoke(account.id)}
                  disabled={revokingBinding || account.status === GQL.EmailAccountStatus.Revoked}
                >
                  {t("ecommerce.affiliateWorkspace.email.revoke", { defaultValue: "Revoke" })}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function emailStatusLabel(t: ReturnType<typeof useTranslation>["t"], status: GQL.EmailAccountStatus): string {
  switch (status) {
    case GQL.EmailAccountStatus.Connected:
      return t("ecommerce.affiliateWorkspace.email.status.connected", { defaultValue: "Connected" });
    case GQL.EmailAccountStatus.Disconnected:
      return t("ecommerce.affiliateWorkspace.email.status.disconnected", { defaultValue: "Disconnected" });
    case GQL.EmailAccountStatus.Error:
      return t("ecommerce.affiliateWorkspace.email.status.error", { defaultValue: "Error" });
    case GQL.EmailAccountStatus.Revoked:
      return t("ecommerce.affiliateWorkspace.email.status.revoked", { defaultValue: "Revoked" });
    default:
      return status;
  }
}

function microsoftGraphConnectorStatusText(
  t: ReturnType<typeof useTranslation>["t"],
  status: MicrosoftGraphConnectorStatus,
): string {
  if (!status.oauthConfigured && !status.webhookConfigured) {
    return t("ecommerce.affiliateWorkspace.email.connectorUnconfigured", {
      defaultValue: "Microsoft Graph OAuth and webhook settings are not configured.",
    });
  }
  if (!status.oauthConfigured) {
    return t("ecommerce.affiliateWorkspace.email.connectorOAuthUnconfigured", {
      defaultValue: "Microsoft Graph OAuth settings are not configured.",
    });
  }
  if (!status.webhookConfigured) {
    return t("ecommerce.affiliateWorkspace.email.connectorWebhookUnconfigured", {
      defaultValue: "Microsoft Graph webhook settings are not configured.",
    });
  }
  if (!status.ready) {
    return status.message || t("ecommerce.affiliateWorkspace.email.connectorNotReady", {
      defaultValue: "Microsoft Graph connector is not ready.",
    });
  }
  return t("ecommerce.affiliateWorkspace.email.connectorReady", {
    defaultValue: "Microsoft Graph is ready for Outlook onboarding and inbound sync.",
  });
}

function countEmailAccountStatus(
  status: MicrosoftGraphConnectorStatus,
  accountStatus: GQL.EmailAccountStatus,
): number {
  return status.accountCounts.find((item) => item.status === accountStatus)?.count ?? 0;
}

function countSubscriptionHealth(
  status: MicrosoftGraphConnectorStatus,
  health: GQL.MicrosoftGraphSubscriptionHealth,
): number {
  return status.subscriptionCounts.find((item) => item.health === health)?.count ?? 0;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
