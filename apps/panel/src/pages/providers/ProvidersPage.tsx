import { useState } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { getDefaultModelForProvider, SUBSCRIPTION_PROVIDER_IDS } from "@rivonclaw/core";
import type { LLMProvider } from "@rivonclaw/core";
import { trackEvent } from "../../api/index.js";
import { fetchJson, invalidateCache } from "../../api/client.js";
import { API, clientPath } from "@rivonclaw/core/api-contract";
import { ModelSelect } from "../../components/inputs/ModelSelect.js";
import { Select } from "../../components/inputs/Select.js";
import { ProviderSetupForm } from "../../components/ProviderSetupForm.js";
import { useEntityStore } from "../../store/index.js";
import { useToast } from "../../components/Toast.js";

export const ProvidersPage = observer(function ProvidersPage() {
  const { t } = useTranslation();
  const store = useEntityStore();
  const keys = store.providerKeys;
  const [expandedKeyId, setExpandedKeyId] = useState<string | null>(null);
  const [updateApiKey, setUpdateApiKey] = useState("");
  const [editProxyUrl, setEditProxyUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const { showToast } = useToast();
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState("");
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [refreshingModelsId, setRefreshingModelsId] = useState<string | null>(null);

  async function handleUpdateKey(keyId: string, provider: string) {
    if (!updateApiKey.trim()) return;
    setValidating(true);
    try {
      const existing = keys.find((k) => k.id === keyId);
      if (!existing) throw new Error(`Provider key ${keyId} not found`);
      // Capture values before delete — SSE patch may remove the node during await
      const wasDefault = existing.isDefault;
      const prevLabel = existing.label;
      const prevModel = existing.model;
      const prevAuthType = existing.authType;
      const prevBaseUrl = existing.baseUrl;
      const prevCustomProtocol = existing.customProtocol;
      const prevCustomModelsJson = existing.customModelsJson;
      await existing.delete();
      const entry = await store.createProviderKey({
        provider,
        label: prevLabel || t("providers.labelDefault"),
        model: prevModel || (getDefaultModelForProvider(provider as LLMProvider)?.modelId ?? ""),
        apiKey: updateApiKey.trim(),
        authType: prevAuthType as "api_key" | "oauth" | "local" | "custom" | undefined,
        baseUrl: prevAuthType === "custom" ? (prevBaseUrl || undefined) : undefined,
        customProtocol: prevAuthType === "custom" ? (prevCustomProtocol as "openai" | "anthropic" || undefined) : undefined,
        customModelsJson: prevAuthType === "custom" ? (prevCustomModelsJson || undefined) : undefined,
      });

      if (wasDefault) {
        // The new key may not be in the MST store yet (arrives via SSE),
        // so try the MST instance first, fall back to direct REST call.
        const newKey = store.providerKeys.find((k) => k.id === entry.id);
        if (newKey) {
          await newKey.activate();
        } else {
          await fetchJson(clientPath(API["providerKeys.activate"], { id: entry.id }), { method: "POST" });
          invalidateCache("models");
        }
      }

      setUpdateApiKey("");
      setExpandedKeyId(null);
      showToast(t("common.saved"), "success");
    } catch (err) {
      showToast(t("providers.failedToSave") + String(err), "error");
    } finally {
      setSaving(false);
      setValidating(false);
    }
  }

  async function handleActivate(keyId: string, provider: string) {
    try {
      await store.llmManager.activateProvider(keyId);
      trackEvent("provider.key_activated", { provider });
    } catch (err) {
      showToast(t("providers.failedToSave") + String(err), "error");
    }
  }

  async function handleRemoveKey(keyId: string) {
    const key = keys.find((k) => k.id === keyId);
    if (!key) return;
    try {
      const provider = key.provider;
      await key.delete();
      trackEvent("provider.key_deleted", { provider });
    } catch (err) {
      showToast(t("providers.failedToSave") + String(err), "error");
    }
  }

  async function handleModelChange(keyId: string, model: string) {
    try {
      const { contextWarning } = await store.llmManager.switchModel(keyId, model);
      if (contextWarning) {
        const fmt = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
        // Scenario A (exceeded) vs B (approaching): differentiate severity
        const severity = contextWarning.currentTokens > contextWarning.newContextWindow
          ? "error" as const
          : "warning" as const;
        showToast(
          t("chat.contextWindowWarning", {
            currentTokens: fmt(contextWarning.currentTokens),
            newContextWindow: fmt(contextWarning.newContextWindow),
          }),
          severity,
        );
      }
    } catch (err) {
      showToast(t("providers.failedToSave") + String(err), "error");
    }
  }

  async function handleProxyChange(keyId: string, proxyUrl: string) {
    setSaving(true);
    try {
      const key = store.providerKeys.find((k) => k.id === keyId);
      if (!key) throw new Error(`Provider key ${keyId} not found`);
      await key.update({ proxyUrl: proxyUrl || null as any });
      showToast(t("common.saved"), "success");
    } catch (err) {
      showToast(t("providers.failedToSave") + String(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleBaseUrlChange(keyId: string, newBaseUrl: string) {
    setSaving(true);
    try {
      const key = store.providerKeys.find((k) => k.id === keyId);
      if (!key) throw new Error(`Provider key ${keyId} not found`);
      await key.update({ baseUrl: newBaseUrl || null as any });
      showToast(t("common.saved"), "success");
    } catch (err) {
      showToast(t("providers.failedToSave") + String(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRefreshModels(keyId: string) {
    setRefreshingModelsId(keyId);
    try {
      const key = store.providerKeys.find((k) => k.id === keyId);
      if (!key) throw new Error(`Provider key ${keyId} not found`);
      await key.refreshModels();
      showToast(t("common.saved"), "success");
    } catch (err) {
      showToast(t("providers.failedToSave") + String(err), "error");
    } finally {
      setRefreshingModelsId(null);
    }
  }

  async function handleLabelSave(keyId: string) {
    const trimmed = editLabelValue.trim();
    if (!trimmed) return;
    try {
      const key = store.providerKeys.find((k) => k.id === keyId);
      if (!key) throw new Error(`Provider key ${keyId} not found`);
      await key.update({ label: trimmed });
      setEditingLabelId(null);
    } catch (err) {
      showToast(t("providers.failedToSave") + String(err), "error");
    }
  }

  return (
    <div className="page-enter">
      <h1>{t("providers.title")}</h1>
      <p>{t("providers.description")}</p>

      {/* Section A: Add Key */}
      <ProviderSetupForm
        onSave={() => { /* MST auto-updates via SSE */ }}
        title={t("providers.addTitle")}
      />

      {/* Section B: Configured Keys */}
      <div className="section-card">
        <h3>{t("providers.configuredKeysTitle")}</h3>
        {keys.length === 0 ? (
          <div className="empty-cell">
            {t("providers.noKeys")}
          </div>
        ) : (
          <div className="flex-col-gap-1">
            {keys.map((k) => {
              const isActive = k.isDefault;
              const isExp = expandedKeyId === k.id;
              return (
                <div
                  key={k.id}
                  className={`key-card ${isActive ? "key-card-active" : "key-card-inactive"}`}
                >
                  {/* Row: info left, actions right */}
                  <div className="key-row">
                    {/* Left: provider info */}
                    <div className="key-info">
                      <div className="key-meta">
                        <strong className="text-sm">
                          {k.provider === "rivonclaw-pro" && (
                            <span className="provider-crown" aria-label="Premium">👑</span>
                          )}
                          {k.authType === "custom" ? k.label : t(`providers.label_${k.provider}`)}
                        </strong>
                        {k.provider !== "rivonclaw-pro" && (
                          <span className="badge badge-muted">
                            {k.authType === "custom"
                              ? t("providers.authTypeCustom")
                              : k.authType === "local"
                                ? t("providers.badgeLocal")
                                : k.authType === "oauth" || SUBSCRIPTION_PROVIDER_IDS.includes(k.provider as LLMProvider)
                                  ? t("providers.authTypeSubscription")
                                  : t("providers.authTypeApiKey")}
                          </span>
                        )}
                        {isActive && (
                          <span className="badge badge-active">
                            {t("providers.active")}
                          </span>
                        )}
                        {k.proxyUrl && (
                          <span className="has-tooltip inline-flex-center" data-tooltip={t("providers.proxyTooltip")}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="3" y="11" width="18" height="11" rx="2" fill="#f5d060" stroke="#b8860b" strokeWidth="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#b8860b" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </span>
                        )}
                        {(k.authType === "local" || k.authType === "custom") && k.baseUrl && k.provider !== "rivonclaw-pro" && (
                          <span className="text-secondary text-sm">{k.baseUrl}</span>
                        )}
                      </div>
                      <div className="key-details">
                        {editingLabelId === k.id ? (
                          <input
                            className="key-label-input"
                            value={editLabelValue}
                            onChange={(e) => setEditLabelValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleLabelSave(k.id);
                              if (e.key === "Escape") setEditingLabelId(null);
                            }}
                            onBlur={() => handleLabelSave(k.id)}
                            autoFocus
                          />
                        ) : (
                          <span className="key-label">
                            {k.label}
                            <button
                              className="key-label-edit-btn"
                              onClick={() => {
                                setEditingLabelId(k.id);
                                setEditLabelValue(k.label);
                              }}
                              title={t("common.edit")}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              </svg>
                            </button>
                          </span>
                        )}
                        {k.authType === "custom" && k.customModelsJson ? (
                          <Select
                            value={k.model}
                            onChange={(model) => handleModelChange(k.id, model)}
                            options={
                              (JSON.parse(k.customModelsJson) as Array<string | { id: string }>)
                                .map((m) => typeof m === "string" ? m : m.id)
                                .sort((a, b) => b.localeCompare(a))
                                .map((m) => ({ value: m, label: m }))
                            }
                          />
                        ) : (
                          <ModelSelect
                            provider={k.provider}
                            value={k.model}
                            onChange={(model) => handleModelChange(k.id, model)}
                          />
                        )}
                      </div>
                    </div>

                    {/* Right: action buttons */}
                    <div className="td-actions">
                      {k.authType === "custom" && k.customProtocol === "openai" && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleRefreshModels(k.id)}
                          disabled={refreshingModelsId === k.id}
                        >
                          {refreshingModelsId === k.id ? t("providers.fetchingModels") : t("providers.refreshModels")}
                        </button>
                      )}
                      {!isActive && (
                        <button className="btn btn-outline btn-sm" onClick={() => handleActivate(k.id, k.provider)}>
                          {t("providers.activate")}
                        </button>
                      )}
                      {k.provider !== "rivonclaw-pro" && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setExpandedKeyId(isExp ? null : k.id);
                            setUpdateApiKey("");
                            setEditProxyUrl(k.proxyUrl || "");
                            setEditBaseUrl(k.baseUrl || "");
                          }}
                        >
                          {k.authType === "local" ? t("providers.updateUrl") : k.authType === "custom" ? t("providers.updateKey") : t("providers.updateKey")}
                        </button>
                      )}
                      {k.provider !== "rivonclaw-pro" && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleRemoveKey(k.id)}>
                          {t("providers.removeKey")}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded: update key / proxy / baseUrl form */}
                  {isExp && (
                    <div className="key-expanded">
                      {k.authType === "local" ? (
                        <>
                          <div className="form-row">
                            <input
                              type="text"
                              value={editBaseUrl}
                              onChange={(e) => setEditBaseUrl(e.target.value)}
                              placeholder={t("providers.baseUrlPlaceholder")}
                              className="flex-1 input-mono"
                            />
                            <button
                              className="btn btn-primary"
                              onClick={() => handleBaseUrlChange(k.id, editBaseUrl)}
                              disabled={saving || editBaseUrl === (k.baseUrl || "")}
                            >
                              {saving ? "..." : t("common.save")}
                            </button>
                          </div>
                          <small className="form-help-sm">{t("providers.baseUrlHelp")}</small>
                        </>
                      ) : k.authType === "custom" ? (
                        <>
                          <div className="form-row">
                            <input
                              type="password"
                              autoComplete="off"
                              data-1p-ignore
                              value={updateApiKey}
                              onChange={(e) => setUpdateApiKey(e.target.value)}
                              placeholder={t("providers.updateKeyPlaceholder")}
                              className="flex-1 input-mono"
                            />
                            <button
                              className="btn btn-primary"
                              onClick={() => handleUpdateKey(k.id, k.provider)}
                              disabled={saving || validating || !updateApiKey.trim()}
                            >
                              {validating ? t("providers.validating") : saving ? "..." : t("common.save")}
                            </button>
                          </div>
                          <small className="form-help-sm">{t("providers.apiKeyHelp")}</small>
                          <div className="key-section-border">
                            <div className="form-label text-secondary">{t("providers.customEndpointLabel")}</div>
                            <div className="form-row">
                              <input
                                type="text"
                                value={editBaseUrl}
                                onChange={(e) => setEditBaseUrl(e.target.value)}
                                placeholder={t("providers.customEndpointPlaceholder")}
                                className="flex-1 input-mono"
                              />
                              <button
                                className="btn btn-primary"
                                onClick={() => handleBaseUrlChange(k.id, editBaseUrl)}
                                disabled={saving || editBaseUrl === (k.baseUrl || "")}
                              >
                                {saving ? "..." : t("common.save")}
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="form-row">
                            <input
                              type="password"
                              autoComplete="off"
                              data-1p-ignore
                              value={updateApiKey}
                              onChange={(e) => setUpdateApiKey(e.target.value)}
                              placeholder={k.provider === "anthropic" || k.provider === "claude" ? t("providers.anthropicUpdatePlaceholder") : t("providers.updateKeyPlaceholder")}
                              className="flex-1 input-mono"
                            />
                            <button
                              className="btn btn-primary"
                              onClick={() => handleUpdateKey(k.id, k.provider)}
                              disabled={saving || validating || !updateApiKey.trim()}
                            >
                              {validating ? t("providers.validating") : saving ? "..." : t("common.save")}
                            </button>
                          </div>
                          <small className="form-help-sm">{t("providers.apiKeyHelp")}</small>
                          {(k.provider === "anthropic" || k.provider === "claude") && (
                            <div className="info-box info-box-yellow mt-sm">
                              {t("providers.anthropicTokenWarning")}
                            </div>
                          )}
                          <div className="key-section-border">
                            <div className="form-label text-secondary">{t("providers.proxyLabel")}</div>
                            <div className="form-row">
                              <input
                                type="text"
                                value={editProxyUrl}
                                onChange={(e) => setEditProxyUrl(e.target.value)}
                                placeholder={t("providers.proxyPlaceholder")}
                                className="flex-1 input-mono"
                              />
                              <button
                                className="btn btn-primary"
                                onClick={() => handleProxyChange(k.id, editProxyUrl)}
                                disabled={saving || editProxyUrl === (k.proxyUrl || "")}
                              >
                                {saving ? "..." : t("common.save")}
                              </button>
                            </div>
                            <small className="form-help-sm">{t("providers.proxyHelp")}</small>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
