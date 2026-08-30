import { useEffect, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { GQL } from "@rivonclaw/core";
import type { Shop } from "@rivonclaw/core/models";
import { Select } from "../../../components/inputs/Select.js";
import { useToast } from "../../../components/Toast.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { AFFILIATE_OUTREACH_OPERATIONAL_STATUS_QUERY } from "../../../api/shops-queries.js";
import { resolveDailyCreatorOutreachLimit } from "../ecommerce-utils.js";
import { formatLocalizedDateTime } from "../../../lib/format-datetime.js";
import { TkSwitchControl } from "../../../components/design-system/index.js";

const AFFILIATE_BUSINESS_PROMPT_MAX_LENGTH = 10_000;

interface AffiliateManagementTabProps {
  shop: Shop;
  selectedRunProfileId: string;
  runProfileOptions: Array<{ value: string; label: string }>;
  selectedRunProfile: { selectedToolIds: string[] } | null;
  savingRunProfile: boolean;
  onRunProfileChange: (profileId: string) => void;
  editBusinessPrompt: string;
  onEditBusinessPrompt: (value: string) => void;
  editMinExpectedSalesUnits: string;
  onEditMinExpectedSalesUnits: (value: string) => void;
  onCommitMinExpectedSalesUnits: () => void;
  savingSettings: boolean;
  onSaveBusinessPrompt: () => void;
  onSaveDailyCreatorOutreachLimit: (limit: number) => Promise<void>;
  myDeviceId: string | null;
  togglingBindShopId: string | null;
  onBindDevice: (shopId: string) => void;
  onUnbindDevice: (shopId: string) => void;
}

export const AffiliateManagementTab = observer(function AffiliateManagementTab({
  shop,
  selectedRunProfileId,
  runProfileOptions,
  selectedRunProfile,
  savingRunProfile,
  onRunProfileChange,
  editBusinessPrompt,
  onEditBusinessPrompt,
  editMinExpectedSalesUnits,
  onEditMinExpectedSalesUnits,
  onCommitMinExpectedSalesUnits,
  savingSettings,
  onSaveBusinessPrompt,
  onSaveDailyCreatorOutreachLimit,
  myDeviceId,
  togglingBindShopId,
  onBindDevice,
  onUnbindDevice,
}: AffiliateManagementTabProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const allTools = entityStore.availableTools;
  const assignedDeviceId = shop.services?.affiliateService?.deviceId ?? null;
  const handledByThisDevice = Boolean(myDeviceId && assignedDeviceId === myDeviceId);
  const affiliateInsightSubjectKey = `shop:${shop.id}`;
  const accountModelInsight = entityStore.affiliateMlInsightRow(affiliateInsightSubjectKey, "user");
  const regionModelInsight = entityStore.affiliateMlInsightRow(affiliateInsightSubjectKey, "region");
  const shopModelInsight = entityStore.affiliateMlInsightRow(affiliateInsightSubjectKey, "shop");
  const automaticSelection = shopModelInsight?.automaticSelection
    ?? regionModelInsight?.automaticSelection
    ?? accountModelInsight?.automaticSelection
    ?? null;
  const persistedDailyLimit = shop.services?.affiliateService
    ?.campaignDailyCreatorOutreachLimit;
  const [dailyLimit, setDailyLimit] = useState(
    String(resolveDailyCreatorOutreachLimit(persistedDailyLimit)),
  );
  const [savingDailyLimit, setSavingDailyLimit] = useState(false);

  useEffect(() => {
    setDailyLimit(String(resolveDailyCreatorOutreachLimit(persistedDailyLimit)));
  }, [persistedDailyLimit, shop.id]);

  async function saveDailyLimit() {
    const value = Number(dailyLimit);
    if (!Number.isInteger(value) || value < 1 || value > 20_000) {
      showToast(t("ecommerce.shopDrawer.affiliate.dailyCreatorOutreachLimitInvalid"), "error");
      return;
    }
    if (value === persistedDailyLimit) return;
    setSavingDailyLimit(true);
    try {
      await onSaveDailyCreatorOutreachLimit(value);
      showToast(t("ecommerce.shopDrawer.affiliate.dailyCreatorOutreachLimitSaved"), "success");
    } catch {
      showToast(t("ecommerce.shopDrawer.affiliate.dailyCreatorOutreachLimitSaveFailed"), "error");
    } finally {
      setSavingDailyLimit(false);
    }
  }

  function toolDisplayName(toolId: string): string {
    const tool = allTools.find((candidate) => candidate.id === toolId);
    const catLabel = tool?.category ? t(`tools.selector.category.${tool.category}`, { defaultValue: tool.category }) : "";
    const nameLabel = t(`tools.selector.name.${toolId}`, { defaultValue: tool?.displayName ?? toolId });
    return catLabel ? `${catLabel} — ${nameLabel}` : nameLabel;
  }

  useEffect(() => {
    if (
      !accountModelInsight
      && !regionModelInsight
      && !shopModelInsight
      && !entityStore.affiliateMlInsightsLoading
      && !entityStore.affiliateMlInsightsError
    ) {
      entityStore.fetchAffiliateMlInsights({ shopIds: [shop.id] }).catch(() => {});
    }
  }, [
    accountModelInsight,
    regionModelInsight,
    shopModelInsight,
    entityStore,
    entityStore.affiliateMlInsightsError,
    entityStore.affiliateMlInsightsLoading,
    shop.id,
  ]);

  return (
    <div className="shop-detail-section">
      <section id="shop-workspace-affiliateManagement-service" className="shop-workspace-section">
        <div className="drawer-section-label">{t("ecommerce.shopDrawer.affiliate.serviceStatus")}</div>

        <div className="shop-toggle-card">
          <div className="shop-toggle-card-left">
            <span className="shop-toggle-card-label">
              {t("ecommerce.shopDrawer.affiliate.bindDevice")}
            </span>
            <span className="form-hint">{t("ecommerce.shopDrawer.affiliate.bindDeviceHint")}</span>
            {assignedDeviceId && !handledByThisDevice && (
              <span className="badge badge-warning shop-badge-inline">
                {t("ecommerce.shopDrawer.affiliate.otherDevice")}
              </span>
            )}
            {handledByThisDevice && (
              <span className="badge badge-success shop-badge-inline">
                {t("ecommerce.shopDrawer.affiliate.thisDevice")}
              </span>
            )}
          </div>
          <TkSwitchControl
              label={t("ecommerce.shopDrawer.affiliate.thisDevice")}
              checked={handledByThisDevice}
              onChange={() => {
                if (handledByThisDevice) {
                  onUnbindDevice(shop.id);
                } else {
                  onBindDevice(shop.id);
                }
              }}
              disabled={togglingBindShopId === shop.id || !myDeviceId}
            />
        </div>
        <AffiliateOutreachOpsPanel shopId={shop.id} />
      </section>

      <section id="shop-workspace-affiliateManagement-run-profile" className="shop-workspace-section">
        <div className="drawer-section-label">{t("ecommerce.shopDrawer.affiliate.runProfile")}</div>
        <div className="shop-info-card">
          <div className="shop-runprofile-row">
            <label className="form-label-block">{t("ecommerce.shopDrawer.affiliate.runProfileLabel")}</label>
            <Select
              value={selectedRunProfileId}
              onChange={onRunProfileChange}
              options={runProfileOptions}
              placeholder={t("ecommerce.shopDrawer.affiliate.runProfileNone")}
              disabled={savingRunProfile}
              className="input-full"
            />
          </div>
          {selectedRunProfile ? (
            <div className="shop-runprofile-tools">
              <div className="form-label-block">{t("ecommerce.shopDrawer.affiliate.availableTools")}</div>
              <ul className="shop-tool-list">
                {selectedRunProfile.selectedToolIds.map((toolId) => (
                  <li key={toolId} className="shop-tool-list-item">{toolDisplayName(toolId)}</li>
                ))}
              </ul>
              <div className="shop-tool-count">
                {t("ecommerce.shopDrawer.affiliate.toolCount", { count: selectedRunProfile.selectedToolIds.length })}
              </div>
            </div>
          ) : (
            <div className="shop-info-card-hint">{t("ecommerce.shopDrawer.affiliate.runProfileHint")}</div>
          )}
        </div>
      </section>

      <section id="shop-workspace-affiliateManagement-model" className="shop-workspace-section">
        <div className="drawer-section-label">{t("ecommerce.shopDrawer.affiliate.modelScopeDiagnostics")}</div>
        <div className="shop-info-card">
          <AffiliateModelScopeDiagnosticsPanel
            loading={entityStore.affiliateMlInsightsLoading}
            selection={automaticSelection}
          />
        </div>
      </section>

      <section id="shop-workspace-affiliateManagement-thresholds" className="shop-workspace-section">
        <div className="drawer-section-label">{t("ecommerce.shopDrawer.affiliate.decisionThresholds")}</div>
        <div className="shop-info-card">
          <div className="affiliate-threshold-row">
            <div className="affiliate-threshold-copy">
              <label className="form-label-block" htmlFor={`affiliate-daily-limit-${shop.id}`}>
                {t("ecommerce.shopDrawer.affiliate.dailyCreatorOutreachLimit")}
              </label>
              <div className="shop-info-card-hint">
                {t("ecommerce.shopDrawer.affiliate.dailyCreatorOutreachLimitHint")}
              </div>
            </div>
            <div className="affiliate-threshold-control">
              <input
                id={`affiliate-daily-limit-${shop.id}`}
                className="input affiliate-threshold-input"
                type="number"
                inputMode="numeric"
                min={1}
                max={20_000}
                step={1}
                placeholder="1–20,000"
                value={dailyLimit}
                onChange={(event) => setDailyLimit(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void saveDailyLimit();
                }}
                disabled={savingDailyLimit}
              />
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={() => void saveDailyLimit()}
                disabled={
                  savingDailyLimit ||
                  !dailyLimit.trim() ||
                  Number(dailyLimit) === persistedDailyLimit
                }
              >
                {savingDailyLimit
                  ? t("common.loading")
                  : t("ecommerce.shopDrawer.overview.save")}
              </button>
            </div>
          </div>
          <div className="affiliate-threshold-row">
            <div className="affiliate-threshold-copy">
              <label className="form-label-block" htmlFor={`affiliate-threshold-${shop.id}`}>
                {t("ecommerce.shopDrawer.affiliate.minExpectedSalesUnits")}
              </label>
              <div className="shop-info-card-hint">
                {t("ecommerce.shopDrawer.affiliate.minExpectedSalesUnitsHint")}
              </div>
            </div>
            <div className="affiliate-threshold-control">
              <input
                id={`affiliate-threshold-${shop.id}`}
                className="input affiliate-threshold-input"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.1}
                required
                placeholder="≥ 0"
                value={editMinExpectedSalesUnits}
                onChange={(e) => onEditMinExpectedSalesUnits(e.target.value)}
                onBlur={onCommitMinExpectedSalesUnits}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                disabled={savingSettings}
              />
            </div>
          </div>
        </div>
      </section>

      <section id="shop-workspace-affiliateManagement-prompt" className="shop-workspace-section">
        <div className="drawer-section-label">{t("ecommerce.shopDrawer.affiliate.businessPrompt")}</div>
        <div className="form-hint">{t("ecommerce.shopDrawer.affiliate.businessPromptHint")}</div>
        <div className="shop-prompt-wrapper">
          <textarea
            className="input-full textarea-resize-vertical shop-prompt-textarea"
            value={editBusinessPrompt}
            onChange={(e) => onEditBusinessPrompt(e.target.value)}
            rows={10}
            maxLength={AFFILIATE_BUSINESS_PROMPT_MAX_LENGTH}
          />
          <span className="shop-prompt-charcount">
            {editBusinessPrompt.length} / {AFFILIATE_BUSINESS_PROMPT_MAX_LENGTH}
          </span>
        </div>
        <div className="modal-actions">
          <button
            className="btn btn-primary btn-sm"
            onClick={onSaveBusinessPrompt}
            disabled={savingSettings || editBusinessPrompt === (shop.services?.affiliateService?.businessPrompt ?? "")}
          >
            {savingSettings ? t("common.loading") : t("ecommerce.shopDrawer.overview.save")}
          </button>
        </div>
      </section>
    </div>
  );
});

type AffiliateOutreachOperationalStatus = {
  since: string;
  failedDeliveryCount: number;
  webhookReceivedCount: number;
  ignoredWebhookCount: number;
  rejectedWebhookCount: number;
  mailboxSyncCount: number;
  failedMailboxSyncCount: number;
  subscriptionRenewalCount: number;
  failedSubscriptionRenewalCount: number;
  activeWhatsAppProxyCount: number;
  disabledWhatsAppProxyCount: number;
  errorWhatsAppProxyCount: number;
  whatsappAccountsUsingUnavailableProxyCount: number;
  whatsappAccountsNeedingReconnectCount: number;
  emailAccountsMissingRefreshTokenCount: number;
  sharedEmailAccountsMissingAddressCount: number;
  latestDeliveryAt?: string | null;
  latestInboundAt?: string | null;
  latestOperationalEventAt?: string | null;
  deliveryCounts: Array<{
    channel?: GQL.AffiliateMessageChannel | null;
    status: GQL.AffiliateDeliveryStatus;
    count: number;
  }>;
  inboundCounts: Array<{
    channel: GQL.AffiliateMessageChannel;
    direction: GQL.AffiliateCreatorMessageDirection;
    count: number;
  }>;
  operationalEventCounts: Array<{
    provider: GQL.AffiliateOutreachOperationalEventProvider;
    kind: GQL.AffiliateOutreachOperationalEventKind;
    status: GQL.AffiliateOutreachOperationalEventStatus;
    count: number;
  }>;
  operationalEventTypeCounts: Array<{
    provider: GQL.AffiliateOutreachOperationalEventProvider;
    kind: GQL.AffiliateOutreachOperationalEventKind;
    status: GQL.AffiliateOutreachOperationalEventStatus;
    eventType?: string | null;
    count: number;
  }>;
};

export function AffiliateOutreachOpsPanel({ shopId }: { shopId: string }) {
  const { t, i18n } = useTranslation();
  const { data, loading, refetch } = useQuery<
    { affiliateOutreachOperationalStatus: AffiliateOutreachOperationalStatus },
    { input: GQL.AffiliateOutreachOperationalStatusInput }
  >(AFFILIATE_OUTREACH_OPERATIONAL_STATUS_QUERY, {
    variables: { input: { shopId, days: 7 } },
    fetchPolicy: "cache-and-network",
  });
  const status = data?.affiliateOutreachOperationalStatus ?? null;
  const directSent = countDelivery(status, GQL.AffiliateDeliveryStatus.Sent, GQL.AffiliateMessageChannel.Whatsapp)
    + countDelivery(status, GQL.AffiliateDeliveryStatus.Sent, GQL.AffiliateMessageChannel.Email);
  const directInbound = countInbound(status, GQL.AffiliateMessageChannel.Whatsapp)
    + countInbound(status, GQL.AffiliateMessageChannel.Email);

  return (
    <div className="affiliate-whatsapp-connector affiliate-whatsapp-connector-ready">
      <div>
        <strong>
          {t("ecommerce.affiliateWorkspace.ops.title", {
            defaultValue: "Outreach operations",
          })}
        </strong>
        <span>
          {status
            ? t("ecommerce.affiliateWorkspace.ops.subtitle", {
                defaultValue: "Last 7 days since {{since}}",
                since: formatCompactDate(status.since, i18n.language),
              })
            : t("common.loading", { defaultValue: "Loading..." })}
        </span>
        {status?.latestInboundAt ? (
          <span>
            {t("ecommerce.affiliateWorkspace.ops.latestInbound", {
              defaultValue: "Latest inbound: {{time}}",
              time: formatCompactDate(status.latestInboundAt, i18n.language),
            })}
          </span>
        ) : null}
      </div>
      <div className="affiliate-whatsapp-connector-metrics">
        <span>
          {t("ecommerce.affiliateWorkspace.ops.directSent", { defaultValue: "Direct sent" })}: {directSent}
        </span>
        <span>
          {t("ecommerce.affiliateWorkspace.ops.directInbound", { defaultValue: "Direct inbound" })}: {directInbound}
        </span>
        <span>
          {t("ecommerce.affiliateWorkspace.ops.failed", { defaultValue: "Failed" })}: {status?.failedDeliveryCount ?? 0}
        </span>
        <span>
          {t("ecommerce.affiliateWorkspace.ops.webhooks", { defaultValue: "Webhooks" })}:{" "}
          {status?.webhookReceivedCount ?? 0}
        </span>
        <span>
          {t("ecommerce.affiliateWorkspace.ops.ignoredWebhooks", { defaultValue: "Ignored webhooks" })}:{" "}
          {status?.ignoredWebhookCount ?? 0}
        </span>
        <span>
          {t("ecommerce.affiliateWorkspace.ops.rejectedWebhooks", { defaultValue: "Rejected webhooks" })}:{" "}
          {status?.rejectedWebhookCount ?? 0}
        </span>
        <span>
          {t("ecommerce.affiliateWorkspace.ops.mailboxSyncs", { defaultValue: "Mailbox syncs" })}:{" "}
          {status?.mailboxSyncCount ?? 0}
        </span>
        <span>
          {t("ecommerce.affiliateWorkspace.ops.syncFailed", { defaultValue: "Sync failed" })}:{" "}
          {status?.failedMailboxSyncCount ?? 0}
        </span>
        <span>
          {t("ecommerce.affiliateWorkspace.ops.renewals", { defaultValue: "Renewals" })}:{" "}
          {status?.subscriptionRenewalCount ?? 0}
        </span>
        <span>
          {t("ecommerce.affiliateWorkspace.ops.renewalFailed", { defaultValue: "Renewal failed" })}:{" "}
          {status?.failedSubscriptionRenewalCount ?? 0}
        </span>
        <span>
          {t("ecommerce.affiliateWorkspace.ops.activeProxies", { defaultValue: "Active proxies" })}:{" "}
          {status?.activeWhatsAppProxyCount ?? 0}
        </span>
        <span>
          {t("ecommerce.affiliateWorkspace.ops.proxyIssues", { defaultValue: "Proxy issues" })}:{" "}
          {(status?.disabledWhatsAppProxyCount ?? 0) + (status?.errorWhatsAppProxyCount ?? 0)}
        </span>
        <span>
          {t("ecommerce.affiliateWorkspace.ops.badProxyBindings", { defaultValue: "Bad proxy bindings" })}:{" "}
          {status?.whatsappAccountsUsingUnavailableProxyCount ?? 0}
        </span>
        <span>
          {t("ecommerce.affiliateWorkspace.ops.reconnectNeeded", { defaultValue: "Reconnect needed" })}:{" "}
          {status?.whatsappAccountsNeedingReconnectCount ?? 0}
        </span>
        <span>
          {t("ecommerce.affiliateWorkspace.ops.mailboxAuthIssues", { defaultValue: "Mailbox auth issues" })}:{" "}
          {status?.emailAccountsMissingRefreshTokenCount ?? 0}
        </span>
        <span>
          {t("ecommerce.affiliateWorkspace.ops.sharedMailboxIssues", { defaultValue: "Shared mailbox issues" })}:{" "}
          {status?.sharedEmailAccountsMissingAddressCount ?? 0}
        </span>
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          onClick={() => {
            void refetch();
          }}
          disabled={loading}
        >
          {loading ? t("common.loading", { defaultValue: "Loading..." }) : t("common.refresh", { defaultValue: "Refresh" })}
        </button>
      </div>
    </div>
  );
}

function countDelivery(
  status: AffiliateOutreachOperationalStatus | null,
  deliveryStatus: GQL.AffiliateDeliveryStatus,
  channel?: GQL.AffiliateMessageChannel,
): number {
  return status?.deliveryCounts
    .filter((item) => item.status === deliveryStatus && (!channel || item.channel === channel))
    .reduce((sum, item) => sum + item.count, 0) ?? 0;
}

function countInbound(
  status: AffiliateOutreachOperationalStatus | null,
  channel: GQL.AffiliateMessageChannel,
): number {
  return status?.inboundCounts
    .filter((item) => item.channel === channel)
    .reduce((sum, item) => sum + item.count, 0) ?? 0;
}

function formatCompactDate(value: string, locale: string): string {
  return formatLocalizedDateTime(value, locale, undefined, value);
}

function AffiliateModelScopeDiagnosticsPanel({
  loading,
  selection,
}: {
  loading: boolean;
  selection: unknown;
}) {
  const { t } = useTranslation();
  const source = objectFromUnknown(selection);
  if (!source) {
    return (
      <div className="affiliate-model-recommendation affiliate-model-recommendation-muted">
        <strong>{t("ecommerce.shopDrawer.affiliate.modelScopeDiagnosticsUnavailable")}</strong>
        <span>
          {loading
            ? t("ecommerce.shopDrawer.affiliate.modelScopeDiagnosticsLoading")
            : t("ecommerce.shopDrawer.affiliate.modelScopeDiagnosticsInsufficient")}
        </span>
      </div>
    );
  }

  const scope = stringFromUnknown(source.requestedTenantScope) ?? "USER";
  const probability = numberFromUnknown(source.outperformanceProbability);
  const foundation = stringFromUnknown(source.dataFoundationLevel);
  const basis = stringFromUnknown(source.selectionBasis);

  return (
    <div className="affiliate-model-recommendation">
      <div className="affiliate-model-recommendation-head">
        <strong>{t("ecommerce.shopDrawer.affiliate.modelScopeDiagnosticsLeader", {
          scope: automaticScopeLabel(t, scope),
        })}</strong>
        <span>{basis === "OUTPERFORMANCE_PROBABILITY"
          ? t("ecommerce.shopDrawer.affiliate.modelScopeDiagnosticsProbabilityBasis")
          : t("ecommerce.shopDrawer.affiliate.modelScopeDiagnosticsInsufficient")}</span>
      </div>
      <p>{t("ecommerce.shopDrawer.affiliate.modelScopeDiagnosticsHint")}</p>
      <div className="affiliate-model-recommendation-metrics">
        <div className="affiliate-model-recommendation-metric">
          <span>{t("ecommerce.shopDrawer.affiliate.outperformanceProbability")}</span>
          <strong>{probability == null ? "—" : new Intl.NumberFormat(undefined, {
            style: "percent",
            maximumFractionDigits: 1,
          }).format(probability)}</strong>
        </div>
        <div className="affiliate-model-recommendation-metric">
          <span>{t("ecommerce.shopDrawer.affiliate.dataFoundation")}</span>
          <strong>{foundation
            ? t(`ecommerce.shopDrawer.affiliate.dataFoundationLevels.${foundation.toLowerCase()}`)
            : "—"}</strong>
        </div>
      </div>
    </div>
  );
}

function automaticScopeLabel(t: (key: string) => string, scope: string): string {
  if (scope === "SHOP") return t("ecommerce.shopDrawer.affiliate.scopeShop");
  if (scope === "REGION") return t("ecommerce.shopDrawer.affiliate.scopeRegion");
  return t("ecommerce.shopDrawer.affiliate.scopeUser");
}

function objectFromUnknown(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function numberFromUnknown(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function stringFromUnknown(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
