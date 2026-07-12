import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@apollo/client/react";
import { observer } from "mobx-react-lite";
import type { Shop } from "@rivonclaw/core/models";
import { Select } from "../../../components/inputs/Select.js";
import { KeyModelSelector } from "../../../components/inputs/KeyModelSelector.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { CustomerServiceBillingCta } from "../../../components/billing/CustomerServiceBillingCta.js";
import type { UnpaidReachoutStageDraft } from "../EcommercePage.js";
import {
  CREATE_UNPAID_CONFIG_EXPERIMENT,
  GET_UNPAID_EVALUATION,
  START_UNPAID_CONFIG_EXPERIMENT,
  STOP_UNPAID_CONFIG_EXPERIMENT,
} from "../../../api/unpaid-experiment-queries.js";

const BUSINESS_PROMPT_MAX_LENGTH = 10_000;
const UNPAID_ORDER_TEMPLATE_PLACEHOLDERS = [
  { token: "{{order_id}}", labelKey: "unpaidReachoutTemplateTokenOrderId" },
  { token: "{{product_count}}", labelKey: "unpaidReachoutTemplateTokenProductCount" },
  { token: "{{shop_name}}", labelKey: "unpaidReachoutTemplateTokenShopName" },
] as const;

interface AiCustomerServiceTabProps {
  shop: Shop;
  // Business prompt
  editBusinessPrompt: string;
  onEditBusinessPrompt: (value: string) => void;
  savingSettings: boolean;
  onSaveBusinessPrompt: () => void;
  // Run profile
  selectedRunProfileId: string;
  runProfileOptions: Array<{ value: string; label: string }>;
  selectedRunProfile: { selectedToolIds: string[] } | null;
  savingRunProfile: boolean;
  onRunProfileChange: (profileId: string) => void;
  // CS model override
  selectedCSProvider: string;
  selectedCSModel: string;
  savingModel: boolean;
  onCSModelChange: (provider: string, model: string) => void;
  // Unpaid-order reachout
  draftUnpaidReachoutEnabled: boolean;
  draftUnpaidReachoutStages: UnpaidReachoutStageDraft[];
  draftUnpaidExperimentEnabled: boolean;
  draftUnpaidHoldoutPercent: string;
  savingUnpaidReachoutSettings: boolean;
  onToggleUnpaidReachoutEnabled: (value: boolean) => void;
  onDraftUnpaidReachoutStagesChange: (value: UnpaidReachoutStageDraft[]) => void;
  onDraftUnpaidExperimentEnabledChange: (value: boolean) => void;
  onDraftUnpaidHoldoutPercentChange: (value: string) => void;
  onSaveUnpaidReachoutSettings: () => void;
  // Review optimization
  draftReviewOptimizationEnabled: boolean;
  draftBadReviewReachoutEnabled: boolean;
  draftBadReviewReachoutStars: string;
  draftBadReviewReachoutRecentDays: string;
  savingReviewOptimizationSettings: boolean;
  onToggleReviewOptimizationEnabled: (value: boolean) => void;
  onToggleBadReviewReachoutEnabled: (value: boolean) => void;
  onDraftBadReviewReachoutStarsChange: (value: string) => void;
  onDraftBadReviewReachoutRecentDaysChange: (value: string) => void;
  onSaveReviewOptimizationSettings: () => void;
  // Escalation
  savingEscalation: boolean;
  draftEscalationChannel: string;
  draftEscalationRecipient: string;
  escalationChannelSelectOptions: Array<{ value: string; label: string }>;
  escalationRecipientOptions: Array<{ value: string; label: string }>;
  onDraftEscalationChannelChange: (value: string) => void;
  onEscalationRecipientChange: (value: string) => void;
  // Device binding
  myDeviceId: string | null;
  togglingBindShopId: string | null;
  onBindDevice: (shopId: string) => void;
  onUnbindDevice: (shopId: string) => void;
}

export const AiCustomerServiceTab = observer(function AiCustomerServiceTab({
  shop,
  editBusinessPrompt,
  onEditBusinessPrompt,
  savingSettings,
  onSaveBusinessPrompt,
  selectedRunProfileId,
  runProfileOptions,
  selectedRunProfile,
  savingRunProfile,
  onRunProfileChange,
  selectedCSProvider,
  selectedCSModel,
  savingModel,
  onCSModelChange,
  draftUnpaidReachoutEnabled,
  draftUnpaidReachoutStages,
  draftUnpaidExperimentEnabled,
  draftUnpaidHoldoutPercent,
  savingUnpaidReachoutSettings,
  onToggleUnpaidReachoutEnabled,
  onDraftUnpaidReachoutStagesChange,
  onDraftUnpaidExperimentEnabledChange,
  onDraftUnpaidHoldoutPercentChange,
  onSaveUnpaidReachoutSettings,
  savingEscalation,
  draftEscalationChannel,
  draftEscalationRecipient,
  escalationChannelSelectOptions,
  escalationRecipientOptions,
  onDraftEscalationChannelChange,
  onEscalationRecipientChange,
  myDeviceId,
  togglingBindShopId,
  onBindDevice,
  onUnbindDevice,
}: AiCustomerServiceTabProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const allTools = entityStore.availableTools;
  const entitlement =
    entityStore.billingOverview?.shops.find((item) => item.shopId === shop.id)?.customerService ??
    null;
  const savedUnpaidReachoutEnabled =
    shop.services?.customerService?.unpaidOrderReachoutEnabled ?? false;
  const savedStages = shop.services?.customerService?.unpaidOrderReachoutStages ?? [];
  const savedExperiment = shop.services?.customerService?.unpaidOrderReachoutExperiment;
  const evaluationQuery = useQuery<{ ecommerceGetCSUnpaidOrderEvaluation: any }>(
    GET_UNPAID_EVALUATION,
    { variables: { shopId: shop.id }, fetchPolicy: "cache-and-network" },
  );
  const [createConfigExperiment] = useMutation(CREATE_UNPAID_CONFIG_EXPERIMENT);
  const [startConfigExperiment] = useMutation(START_UNPAID_CONFIG_EXPERIMENT);
  const [stopConfigExperiment] = useMutation(STOP_UNPAID_CONFIG_EXPERIMENT);
  const [configOptimizationEnabled, setConfigOptimizationEnabled] = useState(false);
  const [experimentVariants, setExperimentVariants] = useState<
    Array<{
      variantKey: string;
      label: string;
      percentage: string;
      stages: UnpaidReachoutStageDraft[];
    }>
  >([]);
  const activeConfigExperiment =
    evaluationQuery.data?.ecommerceGetCSUnpaidOrderEvaluation?.configExperiment;
  useEffect(() => {
    if (activeConfigExperiment) {
      setConfigOptimizationEnabled(true);
      setExperimentVariants(
        activeConfigExperiment.variants.map((v: any) => ({
          ...v,
          percentage: String(v.percentage),
          stages: v.stages.map((s: any) => ({ ...s, delayMinutes: String(s.delayMinutes) })),
        })),
      );
    }
  }, [activeConfigExperiment?.id]);
  function toggleConfigOptimization(enabled: boolean) {
    setConfigOptimizationEnabled(enabled);
    if (enabled && !experimentVariants.length)
      setExperimentVariants([
        {
          variantKey: "A",
          label: "A",
          percentage: "50",
          stages: draftUnpaidReachoutStages.map((stage) => ({ ...stage })),
        },
        { variantKey: "B", label: "B", percentage: "50", stages: [] },
      ]);
  }
  async function launchConfigExperiment() {
    const total = experimentVariants.reduce((sum, variant) => sum + Number(variant.percentage), 0);
    if (
      Math.abs(total - 100) > 0.001 ||
      experimentVariants.some((variant) => !variant.stages.length)
    )
      return;
    const result = await createConfigExperiment({
      variables: {
        input: {
          shopId: shop.id,
          variants: experimentVariants.map((variant) => ({
            ...variant,
            percentage: Number(variant.percentage),
            stages: variant.stages.map((stage) => ({
              id: stage.id,
              enabled: stage.enabled,
              delayMinutes: Number(stage.delayMinutes),
              messageTemplate: stage.messageTemplate,
            })),
          })),
        },
      },
    });
    const id = (result.data as any)?.ecommerceCreateCSUnpaidOrderConfigExperimentDraft?.id;
    if (id) {
      await startConfigExperiment({ variables: { experimentId: id } });
      await evaluationQuery.refetch();
    }
  }
  const stagesValid = draftUnpaidReachoutStages.every((stage) => {
    const delay = Number(stage.delayMinutes.trim());
    return Number.isInteger(delay) && delay >= 1 && delay <= 2879;
  });
  const enabledDelays = draftUnpaidReachoutStages
    .filter((stage) => stage.enabled)
    .map((stage) => stage.delayMinutes.trim());
  const holdout = Number(draftUnpaidHoldoutPercent.trim());
  const experimentValid = Number.isInteger(holdout) && holdout >= 1 && holdout <= 20;
  const unpaidReachoutDirty =
    draftUnpaidReachoutEnabled !== savedUnpaidReachoutEnabled ||
    JSON.stringify(
      draftUnpaidReachoutStages.map((stage) => ({
        ...stage,
        delayMinutes: Number(stage.delayMinutes),
      })),
    ) !== JSON.stringify(savedStages) ||
    draftUnpaidExperimentEnabled !== (savedExperiment?.enabled ?? false) ||
    draftUnpaidHoldoutPercent.trim() !== String(savedExperiment?.holdoutPercent ?? 5);
  function toolDisplayName(toolId: string): string {
    const tool = allTools.find((t) => t.id === toolId);
    const catLabel = tool?.category
      ? t(`tools.selector.category.${tool.category}`, { defaultValue: tool.category })
      : "";
    const nameLabel = t(`tools.selector.name.${toolId}`, {
      defaultValue: tool?.displayName ?? toolId,
    });
    return catLabel ? `${catLabel} — ${nameLabel}` : nameLabel;
  }

  function updateStage(index: number, patch: Partial<UnpaidReachoutStageDraft>) {
    onDraftUnpaidReachoutStagesChange(
      draftUnpaidReachoutStages.map((stage, stageIndex) =>
        stageIndex === index ? { ...stage, ...patch } : stage,
      ),
    );
  }

  return (
    <div className="shop-detail-section">
      <section id="shop-workspace-aiCustomerService-service" className="shop-workspace-section">
        <div className="drawer-section-label">{t("ecommerce.shopDrawer.aiCS.serviceStatus")}</div>
        <CustomerServiceBillingCta
          shopId={shop.id}
          shopName={shop.alias || shop.shopName}
          entitlement={entitlement}
        />
      </section>

      <section id="shop-workspace-aiCustomerService-device" className="shop-workspace-section">
        <div className="drawer-section-label">{t("ecommerce.shopDrawer.aiCS.csBindDevice")}</div>
        <div className="shop-toggle-card">
          <div className="shop-toggle-card-left">
            <span className="shop-toggle-card-label">
              {t("ecommerce.shopDrawer.aiCS.csBindDevice")}
            </span>
            <span className="form-hint">{t("ecommerce.shopDrawer.aiCS.csBindDeviceHint")}</span>
            {shop.services?.customerService?.csDeviceId &&
              !shop.handlesCustomerServiceOnDevice(myDeviceId) && (
                <span className="badge badge-warning shop-badge-inline">
                  {t("ecommerce.shopDrawer.aiCS.csOtherDevice")}
                </span>
              )}
            {shop.handlesCustomerServiceOnDevice(myDeviceId) && (
              <span className="badge badge-success shop-badge-inline">
                {t("ecommerce.shopDrawer.aiCS.csThisDevice")}
              </span>
            )}
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={shop.handlesCustomerServiceOnDevice(myDeviceId)}
              onChange={() => {
                if (shop.handlesCustomerServiceOnDevice(myDeviceId)) {
                  onUnbindDevice(shop.id);
                } else {
                  onBindDevice(shop.id);
                }
              }}
              disabled={togglingBindShopId === shop.id || !myDeviceId}
            />
            <span
              className={`toggle-track ${shop.handlesCustomerServiceOnDevice(myDeviceId) ? "toggle-track-on" : "toggle-track-off"} ${togglingBindShopId === shop.id ? "toggle-track-disabled" : ""}`}
            >
              <span
                className={`toggle-thumb ${shop.handlesCustomerServiceOnDevice(myDeviceId) ? "toggle-thumb-on" : "toggle-thumb-off"}`}
              />
            </span>
          </label>
        </div>
      </section>

      <section id="shop-workspace-aiCustomerService-run-profile" className="shop-workspace-section">
        <div className="drawer-section-label">{t("ecommerce.shopDrawer.aiCS.runProfile")}</div>
        <div className="shop-info-card">
          <div className="shop-runprofile-row">
            <label className="form-label-block">
              {t("ecommerce.shopDrawer.aiCS.runProfileLabel")}
            </label>
            <Select
              value={selectedRunProfileId}
              onChange={onRunProfileChange}
              options={runProfileOptions}
              placeholder={t("ecommerce.shopDrawer.aiCS.runProfileNone")}
              disabled={savingRunProfile}
              className="input-full"
            />
          </div>
          {selectedRunProfile ? (
            <div className="shop-runprofile-tools">
              <div className="form-label-block">
                {t("ecommerce.shopDrawer.aiCS.availableTools")}
              </div>
              <ul className="shop-tool-list">
                {selectedRunProfile.selectedToolIds.map((toolId) => (
                  <li key={toolId} className="shop-tool-list-item">
                    {toolDisplayName(toolId)}
                  </li>
                ))}
              </ul>
              <div className="shop-tool-count">
                {t("ecommerce.shopDrawer.aiCS.toolCount", {
                  count: selectedRunProfile.selectedToolIds.length,
                })}
              </div>
            </div>
          ) : (
            <div className="shop-info-card-hint">
              {t("ecommerce.shopDrawer.aiCS.runProfileHint")}
            </div>
          )}
        </div>
      </section>

      <section id="shop-workspace-aiCustomerService-model" className="shop-workspace-section">
        <div className="drawer-section-label">{t("ecommerce.shopDrawer.aiCS.csModelOverride")}</div>
        <div className="shop-info-card">
          <div className="shop-runprofile-row">
            <label className="form-label-block">
              {t("ecommerce.shopDrawer.aiCS.csModelOverride")}
            </label>
            <KeyModelSelector
              keys={entityStore.providerKeys.map((k) => ({
                id: k.id,
                provider: k.provider,
                label: k.label,
                model: k.model,
                isDefault: k.isDefault,
              }))}
              catalog={entityStore.llmManager.catalog}
              selectedProvider={selectedCSProvider}
              selectedModel={selectedCSModel}
              onChange={onCSModelChange}
              disabled={savingModel}
              variant="form"
              allowDefault
            />
          </div>
          <div className="shop-info-card-hint">
            {t("ecommerce.shopDrawer.aiCS.csModelOverrideHint")}
          </div>
        </div>
      </section>

      <section
        id="shop-workspace-aiCustomerService-unpaid-reachout"
        className="shop-workspace-section"
      >
        <div className="drawer-section-label">{t("ecommerce.shopDrawer.aiCS.unpaidReachout")}</div>
        <div className="shop-info-card shop-unpaid-reachout-card">
          <div className="shop-unpaid-reachout-toggle-pane">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={draftUnpaidReachoutEnabled}
                onChange={(e) => onToggleUnpaidReachoutEnabled(e.target.checked)}
                disabled={savingUnpaidReachoutSettings}
              />
              <span
                className={`toggle-track ${draftUnpaidReachoutEnabled ? "toggle-track-on" : "toggle-track-off"} ${savingUnpaidReachoutSettings ? "toggle-track-disabled" : ""}`}
              >
                <span
                  className={`toggle-thumb ${draftUnpaidReachoutEnabled ? "toggle-thumb-on" : "toggle-thumb-off"}`}
                />
              </span>
            </label>
            <div className="shop-unpaid-reachout-copy">
              <span className="shop-toggle-card-label">
                {t("ecommerce.shopDrawer.aiCS.unpaidReachoutEnabled")}
              </span>
              <span className="form-hint">{t("ecommerce.shopDrawer.aiCS.unpaidReachoutHint")}</span>
            </div>
          </div>
          <div className="shop-unpaid-stage-list">
            {draftUnpaidReachoutStages.map((stage, index) => {
              const delay = Number(stage.delayMinutes.trim());
              const delayValid = Number.isInteger(delay) && delay >= 1 && delay <= 2879;
              return (
                <div className="shop-unpaid-stage" key={stage.id ?? `new-${index}`}>
                  <div className="shop-unpaid-stage-head">
                    <span className="shop-unpaid-stage-number">{index + 1}</span>
                    <strong>
                      {t("ecommerce.shopDrawer.aiCS.unpaidReachoutStage", { index: index + 1 })}
                    </strong>
                    <label className="toggle-switch shop-unpaid-stage-toggle">
                      <input
                        type="checkbox"
                        checked={stage.enabled}
                        disabled={!!activeConfigExperiment}
                        onChange={(event) => updateStage(index, { enabled: event.target.checked })}
                      />
                      <span
                        className={`toggle-track ${stage.enabled ? "toggle-track-on" : "toggle-track-off"}`}
                      >
                        <span
                          className={`toggle-thumb ${stage.enabled ? "toggle-thumb-on" : "toggle-thumb-off"}`}
                        />
                      </span>
                    </label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={!!activeConfigExperiment}
                      onClick={() =>
                        onDraftUnpaidReachoutStagesChange(
                          draftUnpaidReachoutStages.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      {t("ecommerce.shopDrawer.aiCS.unpaidReachoutRemoveStage")}
                    </button>
                  </div>
                  <div className="shop-unpaid-stage-delay-row">
                    <input
                      className="input-full shop-unpaid-reachout-delay-input"
                      type="number"
                      min={1}
                      max={2879}
                      step={1}
                      value={stage.delayMinutes}
                      disabled={!!activeConfigExperiment}
                      onChange={(event) => updateStage(index, { delayMinutes: event.target.value })}
                      aria-invalid={!delayValid}
                    />
                    <span className="shop-info-card-hint">
                      {t("ecommerce.shopDrawer.aiCS.unpaidReachoutStageMinutes")}
                    </span>
                  </div>
                  <textarea
                    className="textarea-field shop-unpaid-reachout-template-input"
                    value={stage.messageTemplate}
                    disabled={!!activeConfigExperiment}
                    onChange={(event) =>
                      updateStage(index, { messageTemplate: event.target.value })
                    }
                    rows={3}
                    placeholder={t("ecommerce.shopDrawer.aiCS.unpaidReachoutTemplatePlaceholder")}
                  />
                  <div className="shop-unpaid-reachout-placeholder-row">
                    {UNPAID_ORDER_TEMPLATE_PLACEHOLDERS.map((placeholder) => (
                      <button
                        key={placeholder.token}
                        type="button"
                        className="shop-unpaid-reachout-placeholder-chip"
                        onClick={() =>
                          updateStage(index, {
                            messageTemplate: `${stage.messageTemplate}${placeholder.token}`,
                          })
                        }
                      >
                        <span className="shop-unpaid-reachout-placeholder-chip-token">
                          {placeholder.token}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              className="btn btn-secondary btn-sm shop-unpaid-add-stage"
              disabled={
                draftUnpaidReachoutStages.length >= 3 ||
                savingUnpaidReachoutSettings ||
                !!activeConfigExperiment
              }
              onClick={() =>
                onDraftUnpaidReachoutStagesChange([
                  ...draftUnpaidReachoutStages,
                  { enabled: true, delayMinutes: "", messageTemplate: "" },
                ])
              }
            >
              + {t("ecommerce.shopDrawer.aiCS.unpaidReachoutAddStage")}{" "}
              {draftUnpaidReachoutStages.length >= 3
                ? `(${t("ecommerce.shopDrawer.aiCS.unpaidReachoutMaxStages")})`
                : ""}
            </button>
          </div>
          <div className="shop-unpaid-experiment">
            <div className="shop-unpaid-reachout-toggle-pane">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={draftUnpaidExperimentEnabled}
                  onChange={(event) => onDraftUnpaidExperimentEnabledChange(event.target.checked)}
                />
                <span
                  className={`toggle-track ${draftUnpaidExperimentEnabled ? "toggle-track-on" : "toggle-track-off"}`}
                >
                  <span
                    className={`toggle-thumb ${draftUnpaidExperimentEnabled ? "toggle-thumb-on" : "toggle-thumb-off"}`}
                  />
                </span>
              </label>
              <div className="shop-unpaid-reachout-copy">
                <span className="shop-toggle-card-label">
                  {t("ecommerce.shopDrawer.aiCS.unpaidReachoutControlGroup")}
                </span>
                <span className="form-hint">
                  {t("ecommerce.shopDrawer.aiCS.unpaidReachoutControlHint")}
                </span>
              </div>
            </div>
            {draftUnpaidExperimentEnabled && (
              <div className="shop-unpaid-stage-delay-row">
                <input
                  className="input-full shop-unpaid-reachout-delay-input"
                  type="number"
                  min={1}
                  max={20}
                  value={draftUnpaidHoldoutPercent}
                  onChange={(event) => onDraftUnpaidHoldoutPercentChange(event.target.value)}
                  aria-invalid={!experimentValid}
                />
                <span className="shop-info-card-hint">
                  {t("ecommerce.shopDrawer.aiCS.unpaidReachoutHoldoutHint")}
                </span>
              </div>
            )}
            {savedExperiment?.experimentId && (
              <div className="shop-info-card-hint">
                Experiment {savedExperiment.experimentId}
                {savedExperiment.startedAt
                  ? ` · started ${new Date(savedExperiment.startedAt).toLocaleDateString()}`
                  : ""}
              </div>
            )}
            {draftUnpaidExperimentEnabled && (
              <div className="shop-unpaid-config-experiment">
                <div className="shop-unpaid-reachout-toggle-pane">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={configOptimizationEnabled}
                      onChange={(e) => toggleConfigOptimization(e.target.checked)}
                      disabled={!!activeConfigExperiment}
                    />
                    <span
                      className={`toggle-track ${configOptimizationEnabled ? "toggle-track-on" : "toggle-track-off"}`}
                    >
                      <span
                        className={`toggle-thumb ${configOptimizationEnabled ? "toggle-thumb-on" : "toggle-thumb-off"}`}
                      />
                    </span>
                  </label>
                  <div className="shop-unpaid-reachout-copy">
                    <span className="shop-toggle-card-label">
                      {t("ecommerce.shopDrawer.aiCS.unpaidConfigOptimization", {
                        defaultValue: "Configuration optimization (A/B test)",
                      })}
                    </span>
                    <span className="form-hint">
                      {t("ecommerce.shopDrawer.aiCS.unpaidConfigOptimizationHint", {
                        defaultValue:
                          "Compare complete follow-up strategies while keeping a holdout group.",
                      })}
                    </span>
                  </div>
                </div>
                {configOptimizationEnabled && (
                  <div className="shop-unpaid-variant-grid">
                    {experimentVariants.map((variant, variantIndex) => (
                      <div className="shop-unpaid-variant" key={variant.variantKey}>
                        <div className="shop-unpaid-variant-head">
                          <strong>Plan {variant.label}</strong>
                          <label>
                            <input
                              type="number"
                              min="1"
                              max="99"
                              step="0.01"
                              value={variant.percentage}
                              disabled={!!activeConfigExperiment}
                              onChange={(e) =>
                                setExperimentVariants(
                                  experimentVariants.map((v, i) =>
                                    i === variantIndex ? { ...v, percentage: e.target.value } : v,
                                  ),
                                )
                              }
                            />
                            % of Treatment
                          </label>
                        </div>
                        {variant.stages.length === 0 ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() =>
                              setExperimentVariants(
                                experimentVariants.map((v, i) =>
                                  i === variantIndex
                                    ? {
                                        ...v,
                                        stages: draftUnpaidReachoutStages.map((s) => ({ ...s })),
                                      }
                                    : v,
                                ),
                              )
                            }
                          >
                            Copy current configuration
                          </button>
                        ) : (
                          variant.stages.map((stage, stageIndex) => (
                            <div className="shop-unpaid-variant-stage" key={stage.id ?? stageIndex}>
                              <input
                                type="number"
                                min="1"
                                max="2879"
                                value={stage.delayMinutes}
                                disabled={!!activeConfigExperiment}
                                onChange={(e) =>
                                  setExperimentVariants(
                                    experimentVariants.map((v, i) =>
                                      i === variantIndex
                                        ? {
                                            ...v,
                                            stages: v.stages.map((s, j) =>
                                              j === stageIndex
                                                ? { ...s, delayMinutes: e.target.value }
                                                : s,
                                            ),
                                          }
                                        : v,
                                    ),
                                  )
                                }
                              />
                              <span> min</span>
                              <textarea
                                rows={3}
                                value={stage.messageTemplate}
                                disabled={!!activeConfigExperiment}
                                onChange={(e) =>
                                  setExperimentVariants(
                                    experimentVariants.map((v, i) =>
                                      i === variantIndex
                                        ? {
                                            ...v,
                                            stages: v.stages.map((s, j) =>
                                              j === stageIndex
                                                ? { ...s, messageTemplate: e.target.value }
                                                : s,
                                            ),
                                          }
                                        : v,
                                    ),
                                  )
                                }
                              />
                            </div>
                          ))
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {configOptimizationEnabled && !activeConfigExperiment && (
                  <div className="shop-unpaid-experiment-actions">
                    {experimentVariants.length < 3 && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          const count = experimentVariants.length + 1;
                          const percentages = Array.from({ length: count }, (_, i) =>
                            (
                              100 / count +
                              (i === 0 ? 100 - (Math.round(10000 / count) * count) / 100 : 0)
                            ).toFixed(2),
                          );
                          setExperimentVariants([
                            ...experimentVariants.map((v, i) => ({
                              ...v,
                              percentage: percentages[i],
                            })),
                            {
                              variantKey: "C",
                              label: "C",
                              percentage: percentages[count - 1],
                              stages: [],
                            },
                          ]);
                        }}
                      >
                        + Add plan C
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={launchConfigExperiment}
                    >
                      Start A/B test
                    </button>
                  </div>
                )}
                {activeConfigExperiment && (
                  <div className="shop-unpaid-experiment-actions">
                    <span className="badge badge-success">Running</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={async () => {
                        await stopConfigExperiment({
                          variables: { experimentId: activeConfigExperiment.id },
                        });
                        setConfigOptimizationEnabled(false);
                        setExperimentVariants([]);
                        await evaluationQuery.refetch();
                      }}
                    >
                      Stop experiment
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="shop-unpaid-reachout-actions">
              {unpaidReachoutDirty && (
                <span className="shop-unpaid-reachout-dirty">
                  {t("ecommerce.shopDrawer.aiCS.unpaidReachoutUnsaved")}
                </span>
              )}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onSaveUnpaidReachoutSettings}
                disabled={
                  savingUnpaidReachoutSettings ||
                  !unpaidReachoutDirty ||
                  !stagesValid ||
                  enabledDelays.length !== new Set(enabledDelays).size ||
                  !experimentValid
                }
              >
                {savingUnpaidReachoutSettings ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Review management is temporarily hidden from desktop UI while the product direction is being revisited. */}

      <section id="shop-workspace-aiCustomerService-escalation" className="shop-workspace-section">
        <div className="drawer-section-label">{t("tiktokShops.detail.escalationRouting")}</div>
        <div className="shop-info-card">
          <div className="escalation-cascade-row">
            <div className="escalation-cascade-col">
              <label className="form-label-block">
                {t("tiktokShops.detail.escalationChannel")}
              </label>
              <Select
                value={draftEscalationChannel}
                onChange={onDraftEscalationChannelChange}
                options={escalationChannelSelectOptions}
                disabled={savingEscalation}
                className="input-full"
              />
            </div>
            <div
              className={`escalation-cascade-col${!draftEscalationChannel ? " escalation-cascade-col-disabled" : ""}`}
            >
              <label className="form-label-block">
                {t("tiktokShops.detail.escalationRecipient")}
              </label>
              <Select
                value={draftEscalationRecipient}
                onChange={onEscalationRecipientChange}
                options={escalationRecipientOptions}
                disabled={savingEscalation || !draftEscalationChannel}
                className="input-full"
              />
            </div>
          </div>
          <div className="shop-info-card-hint">{t("tiktokShops.detail.escalationChannelHint")}</div>
        </div>
      </section>

      <section
        id="shop-workspace-aiCustomerService-prompt"
        className="shop-workspace-section shop-prompt-section"
      >
        <label className="drawer-section-label">
          {t("ecommerce.shopDrawer.aiCS.businessPrompt")}
        </label>
        <div className="form-hint">{t("ecommerce.shopDrawer.overview.businessPromptHint")}</div>
        <div className="shop-prompt-wrapper">
          <textarea
            className="input-full textarea-resize-vertical shop-prompt-textarea"
            value={editBusinessPrompt}
            onChange={(e) => onEditBusinessPrompt(e.target.value)}
            rows={15}
            maxLength={BUSINESS_PROMPT_MAX_LENGTH}
          />
          <span className="shop-prompt-charcount">
            {editBusinessPrompt.length} / {BUSINESS_PROMPT_MAX_LENGTH}
          </span>
        </div>
        <div className="modal-actions">
          <button
            className="btn btn-primary btn-sm"
            onClick={onSaveBusinessPrompt}
            disabled={
              savingSettings ||
              editBusinessPrompt === (shop.services?.customerService?.businessPrompt ?? "")
            }
          >
            {savingSettings ? t("common.loading") : t("ecommerce.shopDrawer.overview.save")}
          </button>
        </div>
      </section>
    </div>
  );
});
