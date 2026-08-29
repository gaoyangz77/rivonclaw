import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import QRCode from "qrcode";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { Select } from "../../../components/inputs/Select.js";
import { LoadingSpinner } from "../../../components/LoadingSpinner.js";
import { useToast } from "../../../components/Toast.js";
import { RefreshIcon } from "../../../components/icons.js";
import { panelEventBus } from "../../../lib/event-bus.js";
import {
  CREATE_WHATSAPP_ACCOUNT_BINDING_MUTATION,
  ASSIGN_AFFILIATE_WHATSAPP_ACCOUNT_MUTATION,
  REFRESH_WHATSAPP_ACCOUNT_BINDING_MUTATION,
  REVOKE_WHATSAPP_ACCOUNT_BINDING_MUTATION,
  START_WHATSAPP_QR_ONBOARDING_MUTATION,
  WHATSAPP_ACCOUNT_BINDINGS_QUERY,
  WHATSAPP_CONNECTOR_STATUS_QUERY,
  WHATSAPP_PROXIES_QUERY,
} from "../../../api/shops-queries.js";
import { AffiliateWhatsAppProxyPanel, proxyDisplayLabel } from "./AffiliateWhatsAppProxyPanel.js";

type WhatsAppAccount = GQL.WhatsAppAccountBinding;
type WhatsAppProxy = GQL.WhatsAppProxy;

type QrPayload = {
  binding: WhatsAppAccount;
  qrBase64?: string | null;
  pairingCode?: string | null;
  qrCode?: string | null;
};

type ConnectorStatus = {
  configured: boolean;
  reachable: boolean;
  ready: boolean;
  httpStatus?: number | null;
  licenseRequired: boolean;
  message?: string | null;
  accountCounts: Array<{ status: GQL.WhatsAppAccountStatus; count: number }>;
  proxyCounts: Array<{ status: GQL.ProxyStatus; count: number }>;
};

/** Which surface of the connect modal is on screen. The proxy pool replaces the flow, never nests inside it. */
type PanelView = "CONNECT" | "PROXIES";
/** The three linear steps of the connect flow: prepare -> scan -> done. */
type ConnectStage = "IDLE" | "SCANNING" | "DONE";

const NO_PROXY_VALUE = "__NO_PROXY__";
/** WhatsApp pairing codes are short. Anything longer is a raw QR payload and must never be shown as a code. */
const MAX_PAIRING_CODE_LENGTH = 16;

export function AffiliateWhatsAppAccountPanel({
  businessDeveloperId = null,
  showAccountList = true,
  reconnectBindingId = null,
  onFlowComplete,
  onAccountsChanged,
}: {
  businessDeveloperId?: string | null;
  showAccountList?: boolean;
  reconnectBindingId?: string | null;
  onFlowComplete?: () => void;
  onAccountsChanged?: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [view, setView] = useState<PanelView>("CONNECT");
  const [stage, setStage] = useState<ConnectStage>(reconnectBindingId ? "SCANNING" : "IDLE");
  const [selectedProxyId, setSelectedProxyId] = useState(NO_PROXY_VALUE);
  const [activeQr, setActiveQr] = useState<QrPayload | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [connectedBindingId, setConnectedBindingId] = useState<string | null>(null);
  const handledConnectedAccountIds = useRef(new Set<string>());
  const requestedReconnectIds = useRef(new Set<string>());
  /** Id of a binding this flow created that is not connected yet, so it can be revoked instead of orphaned. */
  const disposableBindingId = useRef<string | null>(null);
  /** Id of the binding this modal is currently showing a QR for, so a connect event for any other account is ignored. */
  const scanningBindingId = useRef<string | null>(reconnectBindingId);

  const {
    data: accountsData,
    loading: accountsLoading,
    refetch: refetchAccounts,
  } = useQuery<{ whatsAppAccountBindings: WhatsAppAccount[] }>(WHATSAPP_ACCOUNT_BINDINGS_QUERY, {
    fetchPolicy: "cache-and-network",
  });
  const { data: proxiesData } = useQuery<
    { whatsAppProxies: WhatsAppProxy[] },
    { status?: GQL.ProxyStatus | null }
  >(WHATSAPP_PROXIES_QUERY, {
    fetchPolicy: "cache-and-network",
  });
  const {
    data: connectorData,
    loading: connectorLoading,
    refetch: refetchConnectorStatus,
  } = useQuery<{ whatsAppConnectorStatus: ConnectorStatus }>(WHATSAPP_CONNECTOR_STATUS_QUERY, {
    fetchPolicy: "cache-and-network",
  });

  const [createBinding, { loading: creatingBinding }] = useMutation<
    { createWhatsAppAccountBinding: WhatsAppAccount },
    { proxyId?: string | null }
  >(CREATE_WHATSAPP_ACCOUNT_BINDING_MUTATION);
  const [assignBinding] = useMutation<
    { assignAffiliateWhatsAppAccount: WhatsAppAccount },
    { accountBindingId: string; businessDeveloperId: string }
  >(ASSIGN_AFFILIATE_WHATSAPP_ACCOUNT_MUTATION);
  const [startQr, { loading: startingQr }] = useMutation<
    { startWhatsAppQrOnboarding: QrPayload },
    { input: GQL.StartWhatsAppQrOnboardingInput }
  >(START_WHATSAPP_QR_ONBOARDING_MUTATION);
  const [refreshBinding, { loading: refreshingBinding }] = useMutation<
    { refreshWhatsAppAccountBinding: WhatsAppAccount },
    { bindingId: string }
  >(REFRESH_WHATSAPP_ACCOUNT_BINDING_MUTATION);
  const [revokeBinding, { loading: revokingBinding }] = useMutation<
    { revokeWhatsAppAccountBinding: WhatsAppAccount },
    { bindingId: string; deleteInstance?: boolean | null }
  >(REVOKE_WHATSAPP_ACCOUNT_BINDING_MUTATION);
  const revokeBindingRef = useRef(revokeBinding);
  revokeBindingRef.current = revokeBinding;

  const accounts = accountsData?.whatsAppAccountBindings ?? [];
  const visibleAccounts = businessDeveloperId
    ? accounts.filter((account) => account.businessDeveloperId === businessDeveloperId)
    : accounts;
  const proxies = proxiesData?.whatsAppProxies ?? [];
  const activeProxies = proxies.filter((proxy) => proxy.status === GQL.ProxyStatus.Active);
  const connectorStatus = connectorData?.whatsAppConnectorStatus ?? null;
  const busy = creatingBinding || startingQr || refreshingBinding || revokingBinding;
  const onboardingDisabled = busy || connectorLoading || !connectorStatus?.ready;
  const onboardingDisabledReason = connectorStatus
    ? connectorStatusText(t, connectorStatus)
    : t("ecommerce.affiliateWorkspace.whatsapp.connectorStatusLoading", {
      defaultValue: "Checking Evolution API connector status.",
    });
  // A proxy disabled from the proxy pool must not stay selected here.
  const effectiveProxyId = selectedProxyId !== NO_PROXY_VALUE
    && !activeProxies.some((proxy) => proxy.id === selectedProxyId)
    ? NO_PROXY_VALUE
    : selectedProxyId;
  const connectedAccount = connectedBindingId
    ? accounts.find((account) => account.id === connectedBindingId) ?? null
    : null;

  const proxyOptions = useMemo(
    () => [
      {
        value: NO_PROXY_VALUE,
        label: t("ecommerce.affiliateWorkspace.whatsapp.noProxy", { defaultValue: "No proxy" }),
      },
      ...activeProxies.map((proxy) => ({
        value: proxy.id,
        label: proxyDisplayLabel(proxy),
      })),
    ],
    [activeProxies, t],
  );

  useEffect(() => {
    let cancelled = false;
    async function renderQr() {
      setQrImageUrl(null);
      if (!activeQr) return;
      const base64 = activeQr.qrBase64?.trim();
      if (base64) {
        setQrImageUrl(base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`);
        return;
      }
      const qrCode = activeQr.qrCode?.trim();
      if (!qrCode) return;
      const url = await QRCode.toDataURL(qrCode, { width: 220, margin: 1 });
      if (!cancelled) setQrImageUrl(url);
    }
    renderQr().catch((err) => {
      if (!cancelled) showToast(err instanceof Error ? err.message : String(err), "error");
    });
    return () => {
      cancelled = true;
    };
  }, [activeQr, showToast]);

  useEffect(() => {
    return panelEventBus.subscribe("affiliate-outreach-account-connected", (raw) => {
      const event = raw as { channel?: unknown; accountId?: unknown };
      if (event.channel !== "WHATSAPP") return;
      const accountId = typeof event.accountId === "string" ? event.accountId : undefined;
      // Another account connecting elsewhere must not finish this modal, or finish it under the wrong identity.
      const scanningId = reconnectBindingId ?? scanningBindingId.current;
      const flowMatches = Boolean(scanningId) && (!accountId || accountId === scanningId);
      const alreadyHandled = accountId ? handledConnectedAccountIds.current.has(accountId) : false;
      if (accountId) handledConnectedAccountIds.current.add(accountId);
      setActiveQr((current) =>
        !accountId || current?.binding.id === accountId ? null : current,
      );
      void Promise.all([refetchAccounts(), refetchConnectorStatus()])
        .then(() => {
          void onAccountsChanged?.();
          if (flowMatches) {
            // The account exists now, so it is no longer an orphan this flow must clean up.
            if (!accountId || disposableBindingId.current === accountId) {
              disposableBindingId.current = null;
            }
            scanningBindingId.current = null;
            setConnectedBindingId(accountId ?? scanningId);
            setStage("DONE");
          }
          if (alreadyHandled) return;
          showToast(
            t("ecommerce.affiliateWorkspace.whatsapp.accountConnected", {
              defaultValue: "WhatsApp account connected.",
            }),
            "success",
          );
        })
        .catch((err: unknown) => {
          showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
        });
    });
  }, [onAccountsChanged, reconnectBindingId, refetchAccounts, refetchConnectorStatus, showToast, t]);

  useEffect(() => {
    if (!reconnectBindingId || !connectorStatus?.ready) return;
    setStage((current) => (current === "IDLE" ? "SCANNING" : current));
    if (requestedReconnectIds.current.has(reconnectBindingId)) return;
    requestedReconnectIds.current.add(reconnectBindingId);
    void handleStartQr(reconnectBindingId);
  }, [connectorStatus?.ready, reconnectBindingId]);

  useEffect(() => {
    return () => {
      const bindingId = disposableBindingId.current;
      disposableBindingId.current = null;
      if (!bindingId) return;
      void revokeBindingRef.current({ variables: { bindingId, deleteInstance: true } })
        .catch((err: unknown) => {
          console.error("Failed to revoke the pending WhatsApp binding left by the connect flow", err);
        });
    };
  }, []);

  async function handleConnectNew() {
    if (!connectorStatus?.ready) {
      showToast(onboardingDisabledReason, "error");
      return;
    }
    // Enter SCANNING before awaiting so a second click cannot create a second binding.
    setStage("SCANNING");
    setQrError(null);
    try {
      const created = await createBinding({
        variables: {
          proxyId: effectiveProxyId === NO_PROXY_VALUE ? null : effectiveProxyId,
        },
      });
      const bindingId = created.data?.createWhatsAppAccountBinding.id;
      if (!bindingId) {
        throw new Error(t("ecommerce.affiliateWorkspace.whatsapp.bindingCreateFailed", {
          defaultValue: "The WhatsApp account could not be created.",
        }));
      }
      disposableBindingId.current = bindingId;
      if (businessDeveloperId) {
        await assignBinding({ variables: { accountBindingId: bindingId, businessDeveloperId } });
      }
      await handleStartQr(bindingId);
      await Promise.all([refetchAccounts(), refetchConnectorStatus()]);
      await onAccountsChanged?.();
    } catch (err) {
      // A binding created before the failure would otherwise be orphaned by the next attempt.
      discardPendingBinding();
      setStage("IDLE");
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  /** Revoke the not-yet-connected binding this flow created, if any, so no orphan is left behind. */
  function discardPendingBinding() {
    const bindingId = disposableBindingId.current;
    disposableBindingId.current = null;
    scanningBindingId.current = null;
    if (!bindingId) return;
    void revokeBinding({ variables: { bindingId, deleteInstance: true } })
      .then(() => Promise.all([refetchAccounts(), refetchConnectorStatus()]))
      .then(() => onAccountsChanged?.())
      .catch((err: unknown) => {
        showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
      });
  }

  async function handleStartQr(bindingId: string) {
    if (!connectorStatus?.ready) {
      showToast(onboardingDisabledReason, "error");
      return;
    }
    try {
      setQrError(null);
      setStage("SCANNING");
      scanningBindingId.current = bindingId;
      const result = await startQr({
        variables: {
          input: { bindingId },
        },
      });
      const payload = result.data?.startWhatsAppQrOnboarding;
      if (!payload) {
        throw new Error(t("ecommerce.affiliateWorkspace.whatsapp.qrDataMissing", {
          defaultValue: "The WhatsApp QR code could not be loaded.",
        }));
      }
      if (payload.binding.status === GQL.WhatsAppAccountStatus.Connected) {
        setActiveQr(null);
        await Promise.all([refetchAccounts(), refetchConnectorStatus()]);
        await onAccountsChanged?.();
        if (disposableBindingId.current === bindingId) disposableBindingId.current = null;
        scanningBindingId.current = null;
        setConnectedBindingId(bindingId);
        setStage("DONE");
        return;
      }
      setActiveQr(payload);
      await Promise.all([refetchAccounts(), refetchConnectorStatus()]);
      await onAccountsChanged?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("ecommerce.updateFailed");
      setQrError(message);
      requestedReconnectIds.current.delete(bindingId);
      showToast(message, "error");
    }
  }

  function handleRestartQr(bindingId: string) {
    requestedReconnectIds.current.delete(bindingId);
    setActiveQr(null);
    void handleStartQr(bindingId);
  }

  function handleCancelScanning() {
    setActiveQr(null);
    setQrError(null);
    discardPendingBinding();
    if (reconnectBindingId) {
      // The reconnect flow has no earlier step to return to; leaving it ends the flow.
      onFlowComplete?.();
      return;
    }
    setStage("IDLE");
  }

  async function handleRefresh(bindingId: string) {
    try {
      await refreshBinding({ variables: { bindingId } });
      await Promise.all([refetchAccounts(), refetchConnectorStatus()]);
      await onAccountsChanged?.();
      showToast(t("ecommerce.affiliateWorkspace.whatsapp.refreshSuccess", { defaultValue: "WhatsApp account refreshed." }), "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function handleRevoke(bindingId: string) {
    try {
      await revokeBinding({ variables: { bindingId, deleteInstance: false } });
      if (activeQr?.binding.id === bindingId) setActiveQr(null);
      await Promise.all([refetchAccounts(), refetchConnectorStatus()]);
      await onAccountsChanged?.();
      showToast(t("ecommerce.affiliateWorkspace.whatsapp.revokeSuccess", { defaultValue: "WhatsApp account revoked." }), "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  if (view === "PROXIES") {
    return (
      <div className="affiliate-whatsapp-panel">
        <AffiliateWhatsAppProxyPanel onBack={() => setView("CONNECT")} />
      </div>
    );
  }

  const scanBindingId = reconnectBindingId
    ?? activeQr?.binding.id
    ?? disposableBindingId.current
    ?? scanningBindingId.current;
  const pairingCode = activeQr?.pairingCode?.trim() ?? "";
  // The backend may still fall back to the raw QR payload; never render that as a pairing code.
  const showPairingCode = Boolean(pairingCode)
    && pairingCode !== activeQr?.qrCode?.trim()
    && pairingCode.length <= MAX_PAIRING_CODE_LENGTH;

  return (
    <div className={`affiliate-whatsapp-panel ${stage === "SCANNING" ? "affiliate-whatsapp-scan-panel" : ""}`}>
      {showAccountList && stage === "IDLE" && (
        <div className="affiliate-whatsapp-head">
          <div>
            <strong>{t("ecommerce.affiliateWorkspace.whatsapp.title", { defaultValue: "WhatsApp outreach accounts" })}</strong>
            <span>{t("ecommerce.affiliateWorkspace.whatsapp.subtitle", { defaultValue: "Seller-level linked-device accounts used for affiliate creator outreach." })}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              void Promise.all([refetchAccounts(), refetchConnectorStatus()]);
            }}
            disabled={accountsLoading || connectorLoading}
            title={t("common.refresh", { defaultValue: "Refresh" })}
          >
            <RefreshIcon size={15} />
            <span>{accountsLoading || connectorLoading ? t("common.loading") : t("common.refresh", { defaultValue: "Refresh" })}</span>
          </button>
        </div>
      )}

      {connectorStatus && !connectorStatus.ready && (
        <div className="affiliate-whatsapp-connector affiliate-whatsapp-connector-warning">
          <div>
            <strong>
              {t("ecommerce.affiliateWorkspace.whatsapp.connectorStatus", {
                defaultValue: "Connector status",
              })}
            </strong>
            <span>{connectorStatusText(t, connectorStatus)}</span>
          </div>
        </div>
      )}

      {stage === "IDLE" && (
        <>
          <div className="affiliate-whatsapp-intro">
            <strong>{t("ecommerce.affiliateWorkspace.whatsapp.connectIntroTitle", { defaultValue: "Connect a WhatsApp account" })}</strong>
            <span>{t("ecommerce.affiliateWorkspace.whatsapp.connectIntroHint", { defaultValue: "Scan a QR code with the seller phone. The account is assigned to this BD automatically." })}</span>
          </div>

          <div className="affiliate-whatsapp-connect">
            <div className="affiliate-whatsapp-connect-row">
              <label>
                <span>{t("ecommerce.affiliateWorkspace.whatsapp.proxyLabel", { defaultValue: "Proxy for new account" })}</span>
                <Select
                  value={effectiveProxyId}
                  onChange={setSelectedProxyId}
                  options={proxyOptions}
                  className="input-full"
                  disabled={onboardingDisabled}
                />
              </label>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConnectNew}
                disabled={onboardingDisabled}
                title={onboardingDisabled ? onboardingDisabledReason : undefined}
              >
                {startingQr || creatingBinding
                  ? t("common.loading")
                  : t("ecommerce.affiliateWorkspace.whatsapp.connect", { defaultValue: "Connect WhatsApp" })}
              </button>
            </div>
            <div className="affiliate-whatsapp-connect-footnote">
              <small className="form-hint">
                {t("ecommerce.affiliateWorkspace.whatsapp.proxyOptional", { defaultValue: "A proxy is optional. Leave it empty to connect without one." })}
              </small>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setView("PROXIES")}>
                {t("ecommerce.affiliateWorkspace.whatsapp.manageProxies", { defaultValue: "Manage proxy pool" })}
              </button>
            </div>
          </div>
        </>
      )}

      {stage === "SCANNING" && (
        <>
          <div className="affiliate-whatsapp-scan-head">
            {reconnectBindingId && <span className="affiliate-whatsapp-reconnect-pulse" aria-hidden="true" />}
            <div>
              <strong>
                {reconnectBindingId
                  ? t("ecommerce.affiliateWorkspace.whatsapp.reconnectTitle", { defaultValue: "Reconnect this WhatsApp account" })
                  : t("ecommerce.affiliateWorkspace.whatsapp.scanTitle", { defaultValue: "Scan with WhatsApp" })}
              </strong>
              <span>
                {reconnectBindingId
                  ? t("ecommerce.affiliateWorkspace.whatsapp.reconnectHint", { defaultValue: "The existing account, BD ownership, proxy, and message routes will be preserved." })
                  : t("ecommerce.affiliateWorkspace.whatsapp.scanHint", { defaultValue: "Open WhatsApp on the seller phone, choose Linked devices, then scan this QR code." })}
              </span>
            </div>
          </div>

          {!connectorStatus?.ready ? (
            <div className="affiliate-whatsapp-scan-warning">
              <span>{onboardingDisabledReason}</span>
              <div className="affiliate-whatsapp-qr-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCancelScanning}
                    disabled={revokingBinding}
                  >
                    {t("common.cancel", { defaultValue: "Cancel" })}
                  </button>
              </div>
            </div>
          ) : qrError ? (
            <div className="affiliate-whatsapp-scan-warning">
              <span>{qrError}</span>
              <div className="affiliate-whatsapp-qr-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => scanBindingId && handleRestartQr(scanBindingId)}
                  disabled={startingQr || !scanBindingId}
                >
                  <RefreshIcon size={15} />
                  {t("common.retry", { defaultValue: "Try again" })}
                </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCancelScanning}
                    disabled={revokingBinding}
                  >
                    {t("common.cancel", { defaultValue: "Cancel" })}
                  </button>
              </div>
            </div>
          ) : activeQr ? (
            <div className="affiliate-whatsapp-qr">
              <div className="affiliate-whatsapp-qr-frame">
                {qrImageUrl ? (
                  <img
                    src={qrImageUrl}
                    alt={t("ecommerce.affiliateWorkspace.whatsapp.qrAlt", { defaultValue: "WhatsApp login QR code" })}
                  />
                ) : (
                  <span>{t("ecommerce.affiliateWorkspace.whatsapp.qrUnavailable", { defaultValue: "QR image unavailable" })}</span>
                )}
              </div>
              <div className="affiliate-whatsapp-qr-copy">
                <ol className="affiliate-whatsapp-steps">
                  <li>{t("ecommerce.affiliateWorkspace.whatsapp.scanStep1", { defaultValue: "Open WhatsApp on the seller phone and go to Settings." })}</li>
                  <li>{t("ecommerce.affiliateWorkspace.whatsapp.scanStep2", { defaultValue: "Tap Linked devices, then Link a device." })}</li>
                  <li>{t("ecommerce.affiliateWorkspace.whatsapp.scanStep3", { defaultValue: "Point the camera at this QR code and wait for confirmation." })}</li>
                </ol>
                <small>{t("ecommerce.affiliateWorkspace.whatsapp.reconnectWaiting", { defaultValue: "This screen will update automatically after WhatsApp confirms the connection." })}</small>
                {showPairingCode && <code>{pairingCode}</code>}
                <div className="affiliate-whatsapp-qr-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => scanBindingId && handleRestartQr(scanBindingId)}
                    disabled={startingQr || !scanBindingId}
                  >
                    <RefreshIcon size={15} />
                    {t("ecommerce.affiliateWorkspace.whatsapp.refreshQr", { defaultValue: "Refresh QR code" })}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCancelScanning}
                    disabled={revokingBinding}
                  >
                    {t("common.cancel", { defaultValue: "Cancel" })}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="affiliate-whatsapp-scan-loading">
              <span className="affiliate-whatsapp-scan-spinner" aria-hidden="true" />
              <span>{t("ecommerce.affiliateWorkspace.whatsapp.generatingQr", { defaultValue: "Generating a secure QR code…" })}</span>
            </div>
          )}
        </>
      )}

      {stage === "DONE" && (
        <div className="affiliate-whatsapp-done">
          <span className="affiliate-whatsapp-done-mark" aria-hidden="true" />
          <strong>{t("ecommerce.affiliateWorkspace.whatsapp.accountConnected", { defaultValue: "WhatsApp account connected." })}</strong>
          {connectedAccount && (
            <span>
              {connectedAccount.displayName || connectedAccount.phoneNumber || connectedAccount.evolutionInstanceName}
            </span>
          )}
          <button type="button" className="btn btn-primary" onClick={() => onFlowComplete?.()}>
            {t("common.done", { defaultValue: "Done" })}
          </button>
        </div>
      )}

      {showAccountList && view === "CONNECT" && stage === "IDLE" && <div className="affiliate-whatsapp-list">
        {visibleAccounts.length === 0 && (
          accountsLoading
            ? <LoadingSpinner variant="inline" />
            : <div className="affiliate-policy-option-empty">
                {t("ecommerce.affiliateWorkspace.whatsapp.empty", { defaultValue: "No WhatsApp account connected yet." })}
              </div>
        )}
        {visibleAccounts.map((account) => (
          <div className="affiliate-whatsapp-account" key={account.id}>
            <div className="affiliate-whatsapp-account-main">
              <span className={`affiliate-whatsapp-status affiliate-whatsapp-status-${account.status.toLowerCase()}`}>
                {whatsAppStatusLabel(t, account.status)}
              </span>
              <strong>{account.displayName || account.phoneNumber || account.evolutionInstanceName}</strong>
              <small>{account.phoneNumber || account.evolutionInstanceName}</small>
              {account.lastError && <em>{account.lastError}</em>}
            </div>
            <div className="affiliate-whatsapp-account-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleStartQr(account.id)}
                disabled={onboardingDisabled}
                title={onboardingDisabled ? onboardingDisabledReason : undefined}
              >
                {t("ecommerce.affiliateWorkspace.whatsapp.qr", { defaultValue: "QR" })}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleRefresh(account.id)}
                disabled={busy}
              >
                {t("common.refresh", { defaultValue: "Refresh" })}
              </button>
              {account.status !== GQL.WhatsAppAccountStatus.Revoked && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleRevoke(account.id)}
                  disabled={busy}
                >
                  {t("ecommerce.affiliateWorkspace.whatsapp.revoke", { defaultValue: "Revoke" })}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}

function whatsAppStatusLabel(
  t: ReturnType<typeof useTranslation>["t"],
  status: GQL.WhatsAppAccountStatus,
): string {
  return t(`ecommerce.affiliateWorkspace.whatsapp.status.${status}`, {
    defaultValue: status.replace(/_/g, " ").toLowerCase(),
  });
}

function connectorStatusText(
  t: ReturnType<typeof useTranslation>["t"],
  status: ConnectorStatus,
): string {
  if (!status.configured) {
    return t("ecommerce.affiliateWorkspace.whatsapp.connectorUnconfigured", {
      defaultValue: "Evolution API is not configured on the backend.",
    });
  }
  if (!status.reachable) {
    return t("ecommerce.affiliateWorkspace.whatsapp.connectorUnreachable", {
      defaultValue: "Evolution API is configured but unreachable.",
    });
  }
  if (status.licenseRequired) {
    return t("ecommerce.affiliateWorkspace.whatsapp.connectorLicenseRequired", {
      defaultValue: "Evolution API requires activation before onboarding.",
    });
  }
  if (!status.ready) {
    return t("ecommerce.affiliateWorkspace.whatsapp.connectorNotReady", {
      defaultValue: "Evolution API responded but is not ready.",
    });
  }
  return t("ecommerce.affiliateWorkspace.whatsapp.connectorReady", {
    defaultValue: "Evolution API is ready for seller onboarding.",
  });
}
