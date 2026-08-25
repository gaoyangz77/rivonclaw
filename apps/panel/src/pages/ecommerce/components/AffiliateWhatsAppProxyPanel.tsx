import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { Select } from "../../../components/inputs/Select.js";
import { useToast } from "../../../components/Toast.js";
import {
  CREATE_WHATSAPP_PROXY_MUTATION,
  UPDATE_WHATSAPP_PROXY_MUTATION,
  WHATSAPP_PROXIES_QUERY,
} from "../../../api/shops-queries.js";

type WhatsAppProxy = GQL.WhatsAppProxy;

type ProxyForm = {
  protocol: GQL.ProxyProtocol;
  host: string;
  port: string;
  username: string;
  password: string;
  region: string;
};

const DEFAULT_PROXY_FORM: ProxyForm = {
  protocol: GQL.ProxyProtocol.Socks5,
  host: "",
  port: "",
  username: "",
  password: "",
  region: "",
};

export function AffiliateWhatsAppProxyPanel({ onBack }: { onBack?: () => void }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [proxyForm, setProxyForm] = useState<ProxyForm>(DEFAULT_PROXY_FORM);
  const [editingProxyId, setEditingProxyId] = useState<string | null>(null);

  const { data: proxiesData, refetch: refetchProxies } = useQuery<
    { whatsAppProxies: WhatsAppProxy[] },
    { status?: GQL.ProxyStatus | null }
  >(WHATSAPP_PROXIES_QUERY, {
    fetchPolicy: "cache-and-network",
  });

  const [createProxy, { loading: creatingProxy }] = useMutation<
    { createWhatsAppProxy: WhatsAppProxy },
    { input: GQL.CreateWhatsAppProxyInput }
  >(CREATE_WHATSAPP_PROXY_MUTATION);
  const [updateProxy, { loading: updatingProxy }] = useMutation<
    { updateWhatsAppProxy: WhatsAppProxy },
    { input: GQL.UpdateWhatsAppProxyInput }
  >(UPDATE_WHATSAPP_PROXY_MUTATION);

  const proxies = proxiesData?.whatsAppProxies ?? [];
  const proxyBusy = creatingProxy || updatingProxy;

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
      await refetchProxies();
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
      await refetchProxies();
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

  return (
    <div className="affiliate-whatsapp-proxy-panel">
      <div className="affiliate-whatsapp-proxy-head">
        <div>
          <strong>{t("ecommerce.affiliateWorkspace.whatsapp.proxyPool", { defaultValue: "Proxy pool" })}</strong>
          <span>{t("ecommerce.affiliateWorkspace.whatsapp.proxyPoolHint", { defaultValue: "Assign one stable egress proxy before scanning a seller WhatsApp account." })}</span>
        </div>
        <div className="affiliate-whatsapp-proxy-head-actions">
          {editingProxyId && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={resetProxyForm} disabled={proxyBusy}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
          )}
          {onBack && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
              {t("common.back", { defaultValue: "Back" })}
            </button>
          )}
        </div>
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
  );
}

function proxyStatusLabel(
  t: ReturnType<typeof useTranslation>["t"],
  status: GQL.ProxyStatus,
): string {
  return t(`ecommerce.affiliateWorkspace.whatsapp.proxyStatus.${status}`, {
    defaultValue: status.replace(/_/g, " ").toLowerCase(),
  });
}

function cleanOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function proxyDisplayLabel(proxy: WhatsAppProxy): string {
  const base = `${proxy.protocol.toLowerCase()}://${proxy.host}:${proxy.port}`;
  return proxy.region ? `${proxy.region} · ${base}` : base;
}
