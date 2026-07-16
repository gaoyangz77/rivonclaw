import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import QRCode from "qrcode";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { Select } from "../../../components/inputs/Select.js";
import { useToast } from "../../../components/Toast.js";
import { RefreshIcon } from "../../../components/icons.js";
import { panelEventBus } from "../../../lib/event-bus.js";
import {
  CREATE_WHATSAPP_ACCOUNT_BINDING_MUTATION,
  ASSIGN_AFFILIATE_WHATSAPP_ACCOUNT_MUTATION,
  CREATE_WHATSAPP_PROXY_MUTATION,
  REFRESH_WHATSAPP_ACCOUNT_BINDING_MUTATION,
  REVOKE_WHATSAPP_ACCOUNT_BINDING_MUTATION,
  START_WHATSAPP_QR_ONBOARDING_MUTATION,
  UPDATE_WHATSAPP_PROXY_MUTATION,
  WHATSAPP_ACCOUNT_BINDINGS_QUERY,
  WHATSAPP_CONNECTOR_STATUS_QUERY,
  WHATSAPP_PROXIES_QUERY,
} from "../../../api/shops-queries.js";

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

type ProxyForm = {
  protocol: GQL.ProxyProtocol;
  host: string;
  port: string;
  username: string;
  password: string;
  region: string;
};

const NO_PROXY_VALUE = "__NO_PROXY__";
const DEFAULT_PROXY_FORM: ProxyForm = {
  protocol: GQL.ProxyProtocol.Socks5,
  host: "",
  port: "",
  username: "",
  password: "",
  region: "",
};

export function AffiliateWhatsAppAccountPanel({
  businessDeveloperId = null,
  showAccountList = true,
  reconnectBindingId = null,
  onReconnectComplete,
  onAccountsChanged,
}: {
  businessDeveloperId?: string | null;
  showAccountList?: boolean;
  reconnectBindingId?: string | null;
  onReconnectComplete?: () => void;
  onAccountsChanged?: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [selectedProxyId, setSelectedProxyId] = useState(NO_PROXY_VALUE);
  const [activeQr, setActiveQr] = useState<QrPayload | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [proxyForm, setProxyForm] = useState<ProxyForm>(DEFAULT_PROXY_FORM);
  const [editingProxyId, setEditingProxyId] = useState<string | null>(null);
  const handledConnectedAccountIds = useRef(new Set<string>());
  const requestedReconnectIds = useRef(new Set<string>());

  const {
    data: accountsData,
    loading: accountsLoading,
    refetch: refetchAccounts,
  } = useQuery<{ whatsAppAccountBindings: WhatsAppAccount[] }>(WHATSAPP_ACCOUNT_BINDINGS_QUERY, {
    fetchPolicy: "cache-and-network",
  });
  const {
    data: proxiesData,
    refetch: refetchProxies,
  } = useQuery<{ whatsAppProxies: WhatsAppProxy[] }, { status?: GQL.ProxyStatus | null }>(
    WHATSAPP_PROXIES_QUERY,
    {
      fetchPolicy: "cache-and-network",
    },
  );
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
  const [createProxy, { loading: creatingProxy }] = useMutation<
    { createWhatsAppProxy: WhatsAppProxy },
    { input: GQL.CreateWhatsAppProxyInput }
  >(CREATE_WHATSAPP_PROXY_MUTATION);
  const [updateProxy, { loading: updatingProxy }] = useMutation<
    { updateWhatsAppProxy: WhatsAppProxy },
    { input: GQL.UpdateWhatsAppProxyInput }
  >(UPDATE_WHATSAPP_PROXY_MUTATION);

  const accounts = accountsData?.whatsAppAccountBindings ?? [];
  const visibleAccounts = businessDeveloperId
    ? accounts.filter((account) => account.businessDeveloperId === businessDeveloperId)
    : accounts;
  const proxies = proxiesData?.whatsAppProxies ?? [];
  const activeProxies = proxies.filter((proxy) => proxy.status === GQL.ProxyStatus.Active);
  const connectorStatus = connectorData?.whatsAppConnectorStatus ?? null;
  const busy = creatingBinding || startingQr || refreshingBinding || revokingBinding;
  const proxyBusy = creatingProxy || updatingProxy;
  const onboardingDisabled = busy || connectorLoading || !connectorStatus?.ready;
  const onboardingDisabledReason = connectorStatus
    ? connectorStatusText(t, connectorStatus)
    : t("ecommerce.affiliateWorkspace.whatsapp.connectorStatusLoading", {
      defaultValue: "Checking Evolution API connector status.",
    });

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
      const reconnectMatches = !reconnectBindingId || !accountId || accountId === reconnectBindingId;
      const alreadyHandled = accountId ? handledConnectedAccountIds.current.has(accountId) : false;
      if (accountId) handledConnectedAccountIds.current.add(accountId);
      setActiveQr((current) =>
        !accountId || current?.binding.id === accountId ? null : current,
      );
      void Promise.all([refetchAccounts(), refetchConnectorStatus()])
        .then(() => {
          void onAccountsChanged?.();
          if (reconnectMatches) onReconnectComplete?.();
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
  }, [onAccountsChanged, onReconnectComplete, reconnectBindingId, refetchAccounts, refetchConnectorStatus, showToast, t]);

  useEffect(() => {
    if (!reconnectBindingId || !connectorStatus?.ready) return;
    if (requestedReconnectIds.current.has(reconnectBindingId)) return;
    requestedReconnectIds.current.add(reconnectBindingId);
    void handleStartQr(reconnectBindingId);
  }, [connectorStatus?.ready, reconnectBindingId]);

  async function handleConnectNew() {
    if (!connectorStatus?.ready) {
      showToast(onboardingDisabledReason, "error");
      return;
    }
    try {
      const created = await createBinding({
        variables: {
          proxyId: selectedProxyId === NO_PROXY_VALUE ? null : selectedProxyId,
        },
      });
      const bindingId = created.data?.createWhatsAppAccountBinding.id;
      if (!bindingId) {
        throw new Error(t("ecommerce.affiliateWorkspace.whatsapp.bindingCreateFailed", {
          defaultValue: "The WhatsApp account could not be created.",
        }));
      }
      if (businessDeveloperId) {
        await assignBinding({ variables: { accountBindingId: bindingId, businessDeveloperId } });
      }
      await handleStartQr(bindingId);
      await Promise.all([refetchAccounts(), refetchConnectorStatus()]);
      await onAccountsChanged?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function handleStartQr(bindingId: string) {
    if (!connectorStatus?.ready) {
      showToast(onboardingDisabledReason, "error");
      return;
    }
    try {
      setQrError(null);
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
        onReconnectComplete?.();
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

  async function handleSaveProxy() {
    const host = proxyForm.host.trim();
    const port = proxyForm.port.trim();
    if (!host || !port) {
      showToast(t("ecommerce.affiliateWorkspace.whatsapp.proxyRequired", { defaultValue: "Proxy host and port are required." }), "error");
      return;
    }
    const input = {
      protocol: proxyForm.protocol,
      host,
      port,
      username: cleanOptional(proxyForm.username),
      password: cleanOptional(proxyForm.password),
      region: cleanOptional(proxyForm.region),
    };
    try {
      if (editingProxyId) {
        await updateProxy({
          variables: {
            input: {
              id: editingProxyId,
              ...input,
            },
          },
        });
        showToast(t("ecommerce.affiliateWorkspace.whatsapp.proxyUpdated", { defaultValue: "WhatsApp proxy updated." }), "success");
      } else {
        await createProxy({ variables: { input } });
        showToast(t("ecommerce.affiliateWorkspace.whatsapp.proxyCreated", { defaultValue: "WhatsApp proxy created." }), "success");
      }
      resetProxyForm();
      await Promise.all([refetchProxies(), refetchConnectorStatus()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function handleToggleProxy(proxy: WhatsAppProxy) {
    const nextStatus = proxy.status === GQL.ProxyStatus.Active
      ? GQL.ProxyStatus.Disabled
      : GQL.ProxyStatus.Active;
    try {
      await updateProxy({
        variables: {
          input: {
            id: proxy.id,
            status: nextStatus,
          },
        },
      });
      if (selectedProxyId === proxy.id && nextStatus !== GQL.ProxyStatus.Active) {
        setSelectedProxyId(NO_PROXY_VALUE);
      }
      await Promise.all([refetchProxies(), refetchConnectorStatus()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  function handleEditProxy(proxy: WhatsAppProxy) {
    setEditingProxyId(proxy.id);
    setProxyForm({
      protocol: proxy.protocol,
      host: proxy.host,
      port: proxy.port,
      username: proxy.username ?? "",
      password: "",
      region: proxy.region ?? "",
    });
  }

  function resetProxyForm() {
    setEditingProxyId(null);
    setProxyForm(DEFAULT_PROXY_FORM);
  }

  if (reconnectBindingId) {
    return (
      <div className="affiliate-whatsapp-panel affiliate-whatsapp-reconnect-panel">
        <div className="affiliate-whatsapp-reconnect-head">
          <span className="affiliate-whatsapp-reconnect-pulse" aria-hidden="true" />
          <div>
            <strong>{t("ecommerce.affiliateWorkspace.whatsapp.reconnectTitle", { defaultValue: "Reconnect this WhatsApp account" })}</strong>
            <span>{t("ecommerce.affiliateWorkspace.whatsapp.reconnectHint", { defaultValue: "The existing account, BD ownership, proxy, and message routes will be preserved." })}</span>
          </div>
        </div>
        {!connectorStatus?.ready ? (
          <div className="affiliate-whatsapp-reconnect-warning">{onboardingDisabledReason}</div>
        ) : qrError ? (
          <div className="affiliate-whatsapp-reconnect-warning">
            <span>{qrError}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void handleStartQr(reconnectBindingId)}
              disabled={startingQr}
            >
              <RefreshIcon size={15} />
              {t("common.retry", { defaultValue: "Try again" })}
            </button>
          </div>
        ) : activeQr ? (
          <div className="affiliate-whatsapp-qr is-reconnect">
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
              <strong>{t("ecommerce.affiliateWorkspace.whatsapp.scanTitle", { defaultValue: "Scan with WhatsApp" })}</strong>
              <span>{t("ecommerce.affiliateWorkspace.whatsapp.scanHint", { defaultValue: "Open WhatsApp on the seller phone, choose Linked devices, then scan this QR code." })}</span>
              <small>{t("ecommerce.affiliateWorkspace.whatsapp.reconnectWaiting", { defaultValue: "This screen will update automatically after WhatsApp confirms the connection." })}</small>
              {activeQr.pairingCode && <code>{activeQr.pairingCode}</code>}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  requestedReconnectIds.current.delete(reconnectBindingId);
                  setActiveQr(null);
                  void handleStartQr(reconnectBindingId);
                }}
                disabled={startingQr}
              >
                <RefreshIcon size={15} />
                {t("ecommerce.affiliateWorkspace.whatsapp.refreshQr", { defaultValue: "Refresh QR code" })}
              </button>
            </div>
          </div>
        ) : (
          <div className="affiliate-whatsapp-reconnect-loading">
            <span className="affiliate-whatsapp-reconnect-spinner" aria-hidden="true" />
            <span>{t("ecommerce.affiliateWorkspace.whatsapp.generatingQr", { defaultValue: "Generating a secure QR code…" })}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="affiliate-whatsapp-panel">
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

      {connectorStatus && (
        <div className={`affiliate-whatsapp-connector affiliate-whatsapp-connector-${connectorStatus.ready ? "ready" : "warning"}`}>
          <div>
            <strong>
              {t("ecommerce.affiliateWorkspace.whatsapp.connectorStatus", {
                defaultValue: "Connector status",
              })}
            </strong>
            <span>{connectorStatusText(t, connectorStatus)}</span>
          </div>
          <div className="affiliate-whatsapp-connector-metrics">
            <span>
              {t("ecommerce.affiliateWorkspace.whatsapp.connectedAccounts", {
                defaultValue: "Connected",
              })}
              : {countAccountStatus(connectorStatus, GQL.WhatsAppAccountStatus.Connected)}
            </span>
            <span>
              {t("ecommerce.affiliateWorkspace.whatsapp.pendingAccounts", {
                defaultValue: "Pending QR",
              })}
              : {countAccountStatus(connectorStatus, GQL.WhatsAppAccountStatus.PendingQr)}
            </span>
            <span>
              {t("ecommerce.affiliateWorkspace.whatsapp.activeProxies", {
                defaultValue: "Active proxies",
              })}
              : {countProxyStatus(connectorStatus, GQL.ProxyStatus.Active)}
            </span>
          </div>
        </div>
      )}

      <div className="affiliate-whatsapp-connect">
        <label>
          <span>{t("ecommerce.affiliateWorkspace.whatsapp.proxyLabel", { defaultValue: "Proxy for new account" })}</span>
          <Select
            value={selectedProxyId}
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

      <div className="affiliate-whatsapp-proxy-panel">
        <div className="affiliate-whatsapp-proxy-head">
          <div>
            <strong>{t("ecommerce.affiliateWorkspace.whatsapp.proxyPool", { defaultValue: "Proxy pool" })}</strong>
            <span>{t("ecommerce.affiliateWorkspace.whatsapp.proxyPoolHint", { defaultValue: "Assign one stable egress proxy before scanning a seller WhatsApp account." })}</span>
          </div>
          {editingProxyId && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={resetProxyForm} disabled={proxyBusy}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
          )}
        </div>
        <div className="affiliate-whatsapp-proxy-form">
          <label>
            <span>{t("ecommerce.affiliateWorkspace.whatsapp.protocol", { defaultValue: "Protocol" })}</span>
            <Select
              value={proxyForm.protocol}
              onChange={(value) => setProxyForm((prev) => ({ ...prev, protocol: value as GQL.ProxyProtocol }))}
              options={[
                { value: GQL.ProxyProtocol.Socks5, label: "SOCKS5" },
                { value: GQL.ProxyProtocol.Http, label: "HTTP" },
              ]}
              disabled={proxyBusy}
            />
          </label>
          <label>
            <span>{t("ecommerce.affiliateWorkspace.whatsapp.host", { defaultValue: "Host" })}</span>
            <input
              className="input"
              value={proxyForm.host}
              onChange={(event) => setProxyForm((prev) => ({ ...prev, host: event.target.value }))}
              placeholder="proxy.example.com"
              disabled={proxyBusy}
            />
          </label>
          <label>
            <span>{t("ecommerce.affiliateWorkspace.whatsapp.port", { defaultValue: "Port" })}</span>
            <input
              className="input"
              value={proxyForm.port}
              onChange={(event) => setProxyForm((prev) => ({ ...prev, port: event.target.value }))}
              placeholder="1080"
              inputMode="numeric"
              disabled={proxyBusy}
            />
          </label>
          <label>
            <span>{t("ecommerce.affiliateWorkspace.whatsapp.region", { defaultValue: "Region" })}</span>
            <input
              className="input"
              value={proxyForm.region}
              onChange={(event) => setProxyForm((prev) => ({ ...prev, region: event.target.value }))}
              placeholder="US"
              disabled={proxyBusy}
            />
          </label>
          <label>
            <span>{t("ecommerce.affiliateWorkspace.whatsapp.username", { defaultValue: "Username" })}</span>
            <input
              className="input"
              value={proxyForm.username}
              onChange={(event) => setProxyForm((prev) => ({ ...prev, username: event.target.value }))}
              disabled={proxyBusy}
            />
          </label>
          <label>
            <span>{t("ecommerce.affiliateWorkspace.whatsapp.password", { defaultValue: "Password" })}</span>
            <input
              className="input"
              value={proxyForm.password}
              onChange={(event) => setProxyForm((prev) => ({ ...prev, password: event.target.value }))}
              placeholder={editingProxyId ? t("ecommerce.affiliateWorkspace.whatsapp.passwordKeep", { defaultValue: "Leave blank to keep" }) : ""}
              type="password"
              disabled={proxyBusy}
            />
          </label>
          <button type="button" className="btn btn-secondary" onClick={handleSaveProxy} disabled={proxyBusy}>
            {proxyBusy
              ? t("common.loading")
              : editingProxyId
                ? t("common.save", { defaultValue: "Save" })
                : t("ecommerce.affiliateWorkspace.whatsapp.addProxy", { defaultValue: "Add proxy" })}
          </button>
        </div>
        <div className="affiliate-whatsapp-proxy-list">
          {proxies.length === 0 && (
            <div className="affiliate-policy-option-empty">
              {t("ecommerce.affiliateWorkspace.whatsapp.noProxies", { defaultValue: "No proxy configured yet." })}
            </div>
          )}
          {proxies.map((proxy) => (
            <div className="affiliate-whatsapp-proxy-row" key={proxy.id}>
              <div>
                <span className={`affiliate-whatsapp-status affiliate-whatsapp-status-${proxy.status.toLowerCase()}`}>
                  {proxyStatusLabel(t, proxy.status)}
                </span>
                <strong>{proxyDisplayLabel(proxy)}</strong>
                {proxy.lastError && <em>{proxy.lastError}</em>}
              </div>
              <div className="affiliate-whatsapp-account-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleEditProxy(proxy)} disabled={proxyBusy}>
                  {t("common.edit", { defaultValue: "Edit" })}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleToggleProxy(proxy)} disabled={proxyBusy}>
                  {proxy.status === GQL.ProxyStatus.Active
                    ? t("common.disable", { defaultValue: "Disable" })
                    : t("common.enable", { defaultValue: "Enable" })}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {activeQr && (
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
            <strong>{t("ecommerce.affiliateWorkspace.whatsapp.scanTitle", { defaultValue: "Scan with WhatsApp" })}</strong>
            <span>{t("ecommerce.affiliateWorkspace.whatsapp.scanHint", { defaultValue: "Open WhatsApp on the seller phone, choose Linked devices, then scan this QR code." })}</span>
            {activeQr.pairingCode && (
              <code>{activeQr.pairingCode}</code>
            )}
          </div>
        </div>
      )}

      {showAccountList && <div className="affiliate-whatsapp-list">
        {visibleAccounts.length === 0 && (
          <div className="affiliate-policy-option-empty">
            {accountsLoading
              ? t("common.loading")
              : t("ecommerce.affiliateWorkspace.whatsapp.empty", { defaultValue: "No WhatsApp account connected yet." })}
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

function proxyStatusLabel(
  t: ReturnType<typeof useTranslation>["t"],
  status: GQL.ProxyStatus,
): string {
  return t(`ecommerce.affiliateWorkspace.whatsapp.proxyStatus.${status}`, {
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

function countAccountStatus(
  status: ConnectorStatus,
  accountStatus: GQL.WhatsAppAccountStatus,
): number {
  return status.accountCounts.find((item) => item.status === accountStatus)?.count ?? 0;
}

function countProxyStatus(status: ConnectorStatus, proxyStatus: GQL.ProxyStatus): number {
  return status.proxyCounts.find((item) => item.status === proxyStatus)?.count ?? 0;
}

function cleanOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function proxyDisplayLabel(proxy: WhatsAppProxy): string {
  const base = `${proxy.protocol.toLowerCase()}://${proxy.host}:${proxy.port}`;
  return proxy.region ? `${proxy.region} · ${base}` : base;
}
