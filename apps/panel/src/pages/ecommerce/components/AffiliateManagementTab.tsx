import { useEffect, useMemo } from "react";
import { useQuery } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { GQL } from "@rivonclaw/core";
import type { Shop } from "@rivonclaw/core/models";
import { Select } from "../../../components/inputs/Select.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { AFFILIATE_OUTREACH_OPERATIONAL_STATUS_QUERY } from "../../../api/shops-queries.js";
import { AffiliateApprovalPolicyPanel } from "./AffiliateApprovalPolicyPanel.js";
import { AffiliateEmailAccountPanel } from "./AffiliateEmailAccountPanel.js";
import { AffiliateWhatsAppAccountPanel } from "./AffiliateWhatsAppAccountPanel.js";

const AFFILIATE_BUSINESS_PROMPT_MAX_LENGTH = 10_000;
const SHOP_MODEL_RECOMMENDATION_LIFT_RATIO = 1.25;
type AffiliateModelUsageScopeValue = "USER_LEVEL" | "REGION_LEVEL" | "SHOP_LEVEL";

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
  editModelUsageScope: AffiliateModelUsageScopeValue;
  onEditModelUsageScope: (value: AffiliateModelUsageScopeValue) => void;
  savingSettings: boolean;
  onSaveBusinessPrompt: () => void;
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
  editModelUsageScope,
  onEditModelUsageScope,
  savingSettings,
  onSaveBusinessPrompt,
  myDeviceId,
  togglingBindShopId,
  onBindDevice,
  onUnbindDevice,
}: AffiliateManagementTabProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const allTools = entityStore.availableTools;
  const assignedDeviceId = shop.services?.affiliateService?.csDeviceId ?? null;
  const handledByThisDevice = Boolean(myDeviceId && assignedDeviceId === myDeviceId);
  const affiliateInsightSubjectKey = `shop:${shop.id}`;
  const accountModelInsight = entityStore.affiliateMlInsightRow(affiliateInsightSubjectKey, "user");
  const regionModelInsight = entityStore.affiliateMlInsightRow(affiliateInsightSubjectKey, "region");
  const shopModelInsight = entityStore.affiliateMlInsightRow(affiliateInsightSubjectKey, "shop");
  const accountModelEvaluation = affiliateModelEvaluation(accountModelInsight?.summary);
  const regionModelEvaluation = affiliateModelEvaluation(regionModelInsight?.summary);
  const shopModelEvaluation = affiliateModelEvaluation(shopModelInsight?.summary);
  const modelRecommendation = useMemo(
    () => buildAffiliateModelRecommendation(accountModelEvaluation, regionModelEvaluation, shopModelEvaluation),
    [accountModelEvaluation, regionModelEvaluation, shopModelEvaluation],
  );
  const modelUsageOptions = [
    {
      value: "USER_LEVEL",
      label: t("ecommerce.shopDrawer.affiliate.modelUsageScopeUserLevel"),
    },
    {
      value: "REGION_LEVEL",
      label: t("ecommerce.shopDrawer.affiliate.modelUsageScopeRegionLevel"),
    },
    {
      value: "SHOP_LEVEL",
      label: t("ecommerce.shopDrawer.affiliate.modelUsageScopeShopLevel"),
    },
  ];

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
          <label className="toggle-switch">
            <input
              type="checkbox"
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
            <span
              className={`toggle-track ${handledByThisDevice ? "toggle-track-on" : "toggle-track-off"} ${togglingBindShopId === shop.id ? "toggle-track-disabled" : ""}`}
            >
              <span className={`toggle-thumb ${handledByThisDevice ? "toggle-thumb-on" : "toggle-thumb-off"}`} />
            </span>
          </label>
        </div>
        <AffiliateOutreachOpsPanel shopId={shop.id} />
      </section>

      <section id="shop-workspace-affiliateManagement-whatsapp" className="shop-workspace-section">
        <div className="drawer-section-label">
          {t("ecommerce.affiliateWorkspace.whatsapp.title", { defaultValue: "WhatsApp outreach accounts" })}
        </div>
        <AffiliateWhatsAppAccountPanel />
      </section>

      <section id="shop-workspace-affiliateManagement-email" className="shop-workspace-section">
        <div className="drawer-section-label">
          {t("ecommerce.affiliateWorkspace.email.title", { defaultValue: "Outlook email accounts" })}
        </div>
        <AffiliateEmailAccountPanel />
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
        <div className="drawer-section-label">{t("ecommerce.shopDrawer.affiliate.modelUsageScope")}</div>
        <div className="shop-info-card">
          <div className="affiliate-threshold-row">
            <div className="affiliate-threshold-copy">
              <label className="form-label-block">
                {t("ecommerce.shopDrawer.affiliate.modelUsageScopeLabel")}
              </label>
              <div className="shop-info-card-hint">
                {t("ecommerce.shopDrawer.affiliate.modelUsageScopeHint")}
              </div>
            </div>
            <div className="affiliate-threshold-control">
              <Select
                value={editModelUsageScope}
                onChange={(value) => {
                  if (value === "SHOP_LEVEL" || value === "REGION_LEVEL") {
                    onEditModelUsageScope(value);
                    return;
                  }
                  onEditModelUsageScope("USER_LEVEL");
                }}
                options={modelUsageOptions}
                className="input-full"
                disabled={savingSettings}
              />
            </div>
          </div>
          <AffiliateModelRecommendationPanel
            accountModel={accountModelEvaluation}
            loading={entityStore.affiliateMlInsightsLoading}
            recommendation={modelRecommendation}
            regionModel={regionModelEvaluation}
            selectedScope={editModelUsageScope}
            shopModel={shopModelEvaluation}
          />
        </div>
      </section>

      <section id="shop-workspace-affiliateManagement-thresholds" className="shop-workspace-section">
        <div className="drawer-section-label">{t("ecommerce.shopDrawer.affiliate.decisionThresholds")}</div>
        <div className="shop-info-card">
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
                placeholder={t("ecommerce.shopDrawer.affiliate.noThreshold")}
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

      <section id="shop-workspace-affiliateManagement-policies" className="shop-workspace-section">
        <div className="drawer-section-label">{t("ecommerce.affiliateWorkspace.policies.title")}</div>
        <AffiliateApprovalPolicyPanel shop={shop} />
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
  fallbackCount: number;
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
    direction: GQL.AffiliateConversationMessageDirection;
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
  const { t } = useTranslation();
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
                since: formatCompactDate(status.since),
              })
            : t("common.loading", { defaultValue: "Loading..." })}
        </span>
        {status?.latestInboundAt ? (
          <span>
            {t("ecommerce.affiliateWorkspace.ops.latestInbound", {
              defaultValue: "Latest inbound: {{time}}",
              time: formatCompactDate(status.latestInboundAt),
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
          {t("ecommerce.affiliateWorkspace.ops.fallbacks", { defaultValue: "Fallbacks" })}: {status?.fallbackCount ?? 0}
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

function formatCompactDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

type AffiliateModelConfidence = "high" | "medium" | "low";

type AffiliateModelEvaluation = {
  confidence: AffiliateModelConfidence | null;
  liftRatio: number | null;
};

type AffiliateModelRecommendation = {
  reason:
    | "account_more_stable"
    | "region_balanced"
    | "shop_clear_advantage"
    | "only_account"
    | "only_region"
    | "only_shop";
  scope: AffiliateModelUsageScopeValue;
};

function AffiliateModelRecommendationPanel({
  accountModel,
  loading,
  recommendation,
  regionModel,
  selectedScope,
  shopModel,
}: {
  accountModel: AffiliateModelEvaluation | null;
  loading: boolean;
  recommendation: AffiliateModelRecommendation | null;
  regionModel: AffiliateModelEvaluation | null;
  selectedScope: AffiliateModelUsageScopeValue;
  shopModel: AffiliateModelEvaluation | null;
}) {
  const { t } = useTranslation();
  const hasAnyModel = Boolean(accountModel || regionModel || shopModel);
  if (!hasAnyModel) {
    return (
      <div className="affiliate-model-recommendation affiliate-model-recommendation-muted">
        <strong>{t("ecommerce.shopDrawer.affiliate.modelRecommendationPending")}</strong>
        <span>
          {loading
            ? t("ecommerce.shopDrawer.affiliate.modelRecommendationLoading")
            : t("ecommerce.shopDrawer.affiliate.modelRecommendationUnavailable")}
        </span>
      </div>
    );
  }

  if (!recommendation) {
    return (
      <div className="affiliate-model-recommendation affiliate-model-recommendation-muted">
        <strong>{t("ecommerce.shopDrawer.affiliate.modelRecommendationPending")}</strong>
        <span>{t("ecommerce.shopDrawer.affiliate.modelRecommendationIncomplete")}</span>
      </div>
    );
  }

  const recommendedLabel = affiliateModelUsageScopeLabel(t, recommendation.scope);
  const selectedMatchesRecommendation = selectedScope === recommendation.scope;

  return (
    <div className={`affiliate-model-recommendation${selectedMatchesRecommendation ? "" : " affiliate-model-recommendation-actionable"}`}>
      <div className="affiliate-model-recommendation-head">
        <strong>
          {t("ecommerce.shopDrawer.affiliate.modelRecommendationTitle", {
            scope: recommendedLabel,
          })}
        </strong>
        <span>
          {selectedMatchesRecommendation
            ? t("ecommerce.shopDrawer.affiliate.modelRecommendationSelected")
            : t("ecommerce.shopDrawer.affiliate.modelRecommendationSwitch")}
        </span>
      </div>
      <p>{t(`ecommerce.shopDrawer.affiliate.modelRecommendationReasons.${recommendation.reason}`)}</p>
      <div className="affiliate-model-recommendation-metrics">
        <AffiliateModelRecommendationMetric
          evaluation={accountModel}
          label={t("ecommerce.shopDrawer.affiliate.modelUsageScopeUserLevel")}
        />
        <AffiliateModelRecommendationMetric
          evaluation={regionModel}
          label={t("ecommerce.shopDrawer.affiliate.modelUsageScopeRegionLevel")}
        />
        <AffiliateModelRecommendationMetric
          evaluation={shopModel}
          label={t("ecommerce.shopDrawer.affiliate.modelUsageScopeShopLevel")}
        />
      </div>
    </div>
  );
}

function AffiliateModelRecommendationMetric({
  evaluation,
  label,
}: {
  evaluation: AffiliateModelEvaluation | null;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="affiliate-model-recommendation-metric">
      <span>{label}</span>
      <strong>{formatModelLift(evaluation?.liftRatio ?? null)}</strong>
      <small>
        {evaluation?.confidence
          ? t(`ecommerce.shopDrawer.affiliate.modelConfidence.${evaluation.confidence}`)
          : t("ecommerce.shopDrawer.affiliate.modelRecommendationNoData")}
      </small>
    </div>
  );
}

function buildAffiliateModelRecommendation(
  accountModel: AffiliateModelEvaluation | null,
  regionModel: AffiliateModelEvaluation | null,
  shopModel: AffiliateModelEvaluation | null,
): AffiliateModelRecommendation | null {
  const candidates = [
    { scope: "USER_LEVEL" as const, evaluation: accountModel, reason: "account_more_stable" as const },
    { scope: "REGION_LEVEL" as const, evaluation: regionModel, reason: "region_balanced" as const },
    { scope: "SHOP_LEVEL" as const, evaluation: shopModel, reason: "shop_clear_advantage" as const },
  ].filter((candidate) => candidate.evaluation) as Array<{
    scope: AffiliateModelUsageScopeValue;
    evaluation: AffiliateModelEvaluation;
    reason: AffiliateModelRecommendation["reason"];
  }>;

  if (candidates.length === 0) return null;
  if (candidates.length === 1) {
    const only = candidates[0]!;
    if (only.scope === "REGION_LEVEL") return { scope: only.scope, reason: "only_region" };
    if (only.scope === "SHOP_LEVEL") return { scope: only.scope, reason: "only_shop" };
    return { scope: only.scope, reason: "only_account" };
  }

  const ranked = [...candidates].sort((left, right) => {
    const confidenceDelta = confidenceRank(right.evaluation.confidence) - confidenceRank(left.evaluation.confidence);
    if (confidenceDelta !== 0) return confidenceDelta;
    const liftDelta = (right.evaluation.liftRatio ?? 0) - (left.evaluation.liftRatio ?? 0);
    if (Math.abs(liftDelta) > 0.05) return liftDelta;
    return scopeStabilityRank(right.scope) - scopeStabilityRank(left.scope);
  });
  const best = ranked[0]!;

  if (best.scope === "SHOP_LEVEL") {
    const accountLift = accountModel?.liftRatio ?? 0;
    const shopLift = shopModel?.liftRatio ?? 0;
    const shopHasClearAdvantage =
      confidenceRank(shopModel?.confidence ?? null) > confidenceRank("low")
      && shopLift > 0
      && shopLift >= Math.max(accountLift, 0.01) * SHOP_MODEL_RECOMMENDATION_LIFT_RATIO;
    if (shopHasClearAdvantage) return { scope: best.scope, reason: "shop_clear_advantage" };
    if (regionModel) return { scope: "REGION_LEVEL", reason: "region_balanced" };
    return { scope: "USER_LEVEL", reason: "account_more_stable" };
  }

  return { scope: best.scope, reason: best.reason };
}

function affiliateModelUsageScopeLabel(t: (key: string) => string, scope: AffiliateModelUsageScopeValue): string {
  if (scope === "SHOP_LEVEL") return t("ecommerce.shopDrawer.affiliate.modelUsageScopeShopLevel");
  if (scope === "REGION_LEVEL") return t("ecommerce.shopDrawer.affiliate.modelUsageScopeRegionLevel");
  return t("ecommerce.shopDrawer.affiliate.modelUsageScopeUserLevel");
}

function scopeStabilityRank(scope: AffiliateModelUsageScopeValue): number {
  if (scope === "USER_LEVEL") return 3;
  if (scope === "REGION_LEVEL") return 2;
  return 1;
}

function affiliateModelEvaluation(summary: unknown): AffiliateModelEvaluation | null {
  if (!summary || typeof summary !== "object") return null;
  const source = summary as Record<string, unknown>;
  const liftRatio = numberFromUnknown(source.modelVsHumanExpectedUnitsLiftRatio);
  const payload = objectFromUnknown(source.payload);
  const confidence = normalizeConfidence(
    stringFromUnknown(objectFromUnknown(payload?.same_sample_budget_confidence)?.level),
  );
  if (liftRatio == null && confidence == null) return null;
  return { confidence, liftRatio };
}

function confidenceRank(confidence: AffiliateModelConfidence | null): number {
  if (confidence === "high") return 3;
  if (confidence === "medium") return 2;
  if (confidence === "low") return 1;
  return 0;
}

function normalizeConfidence(value: string | null): AffiliateModelConfidence | null {
  const normalized = value?.toLowerCase();
  return normalized === "high" || normalized === "medium" || normalized === "low" ? normalized : null;
}

function formatModelLift(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const liftPercent = (value - 1) * 100;
  if (Math.abs(liftPercent) < 0.05) return "0.0%";
  return `${liftPercent > 0 ? "+" : ""}${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(liftPercent)}%`;
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
