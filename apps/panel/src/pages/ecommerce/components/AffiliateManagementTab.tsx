import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import type { Shop } from "@rivonclaw/core/models";
import { Select } from "../../../components/inputs/Select.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { AffiliateApprovalPolicyPanel } from "./AffiliateApprovalPolicyPanel.js";

const AFFILIATE_BUSINESS_PROMPT_MAX_LENGTH = 10_000;
const SHOP_MODEL_RECOMMENDATION_LIFT_RATIO = 1.25;

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
  editModelUsageScope: "USER_LEVEL" | "SHOP_LEVEL";
  onEditModelUsageScope: (value: "USER_LEVEL" | "SHOP_LEVEL") => void;
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
  const shopModelInsight = entityStore.affiliateMlInsightRow(affiliateInsightSubjectKey, "shop");
  const accountModelEvaluation = affiliateModelEvaluation(accountModelInsight?.summary);
  const shopModelEvaluation = affiliateModelEvaluation(shopModelInsight?.summary);
  const modelRecommendation = useMemo(
    () => buildAffiliateModelRecommendation(accountModelEvaluation, shopModelEvaluation),
    [accountModelEvaluation, shopModelEvaluation],
  );
  const modelUsageOptions = [
    {
      value: "USER_LEVEL",
      label: t("ecommerce.shopDrawer.affiliate.modelUsageScopeUserLevel"),
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
      && !shopModelInsight
      && !entityStore.affiliateMlInsightsLoading
      && !entityStore.affiliateMlInsightsError
    ) {
      entityStore.fetchAffiliateMlInsights({ shopIds: [shop.id] }).catch(() => {});
    }
  }, [
    accountModelInsight,
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
                onChange={(value) => onEditModelUsageScope(value === "SHOP_LEVEL" ? "SHOP_LEVEL" : "USER_LEVEL")}
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

type AffiliateModelConfidence = "high" | "medium" | "low";

type AffiliateModelEvaluation = {
  confidence: AffiliateModelConfidence | null;
  liftRatio: number | null;
};

type AffiliateModelRecommendation = {
  reason: "account_more_stable" | "shop_clear_advantage" | "only_account" | "only_shop";
  scope: "USER_LEVEL" | "SHOP_LEVEL";
};

function AffiliateModelRecommendationPanel({
  accountModel,
  loading,
  recommendation,
  selectedScope,
  shopModel,
}: {
  accountModel: AffiliateModelEvaluation | null;
  loading: boolean;
  recommendation: AffiliateModelRecommendation | null;
  selectedScope: "USER_LEVEL" | "SHOP_LEVEL";
  shopModel: AffiliateModelEvaluation | null;
}) {
  const { t } = useTranslation();
  const hasAnyModel = Boolean(accountModel || shopModel);
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

  const recommendedLabel = recommendation.scope === "SHOP_LEVEL"
    ? t("ecommerce.shopDrawer.affiliate.modelUsageScopeShopLevel")
    : t("ecommerce.shopDrawer.affiliate.modelUsageScopeUserLevel");
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
  shopModel: AffiliateModelEvaluation | null,
): AffiliateModelRecommendation | null {
  if (accountModel && !shopModel) return { scope: "USER_LEVEL", reason: "only_account" };
  if (!accountModel && shopModel) return { scope: "SHOP_LEVEL", reason: "only_shop" };
  if (!accountModel || !shopModel) return null;

  const accountConfidenceRank = confidenceRank(accountModel.confidence);
  const shopConfidenceRank = confidenceRank(shopModel.confidence);
  if (accountConfidenceRank > shopConfidenceRank) {
    return { scope: "USER_LEVEL", reason: "account_more_stable" };
  }

  const accountLift = accountModel.liftRatio ?? 0;
  const shopLift = shopModel.liftRatio ?? 0;
  const shopHasClearAdvantage =
    shopConfidenceRank >= accountConfidenceRank
    && shopConfidenceRank > confidenceRank("low")
    && shopLift > 0
    && shopLift >= Math.max(accountLift, 0.01) * SHOP_MODEL_RECOMMENDATION_LIFT_RATIO;

  if (shopHasClearAdvantage) {
    return { scope: "SHOP_LEVEL", reason: "shop_clear_advantage" };
  }
  return { scope: "USER_LEVEL", reason: "account_more_stable" };
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
