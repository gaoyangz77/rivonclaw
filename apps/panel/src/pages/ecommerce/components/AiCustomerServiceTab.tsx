import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import type { Shop } from "@rivonclaw/core/models";
import { Select } from "../../../components/inputs/Select.js";
import { KeyModelSelector } from "../../../components/inputs/KeyModelSelector.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { CustomerServiceBillingCta } from "../../../components/billing/CustomerServiceBillingCta.js";
import type { UnpaidReachoutStageDraft } from "../EcommercePage.js";

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
  const entitlement = entityStore.billingOverview?.shops.find((item) => item.shopId === shop.id)?.customerService ?? null;
  const savedUnpaidReachoutEnabled = shop.services?.customerService?.unpaidOrderReachoutEnabled ?? false;
  const savedStages = shop.services?.customerService?.unpaidOrderReachoutStages ?? [];
  const savedExperiment = shop.services?.customerService?.unpaidOrderReachoutExperiment;
  const stagesValid = draftUnpaidReachoutStages.every((stage) => {
    const delay = Number(stage.delayMinutes.trim());
    return Number.isInteger(delay) && delay >= 1 && delay <= 2879;
  });
  const enabledDelays = draftUnpaidReachoutStages.filter((stage) => stage.enabled).map((stage) => stage.delayMinutes.trim());
  const holdout = Number(draftUnpaidHoldoutPercent.trim());
  const experimentValid = Number.isInteger(holdout) && holdout >= 1 && holdout <= 20;
  const unpaidReachoutDirty =
    draftUnpaidReachoutEnabled !== savedUnpaidReachoutEnabled ||
    JSON.stringify(draftUnpaidReachoutStages.map((stage) => ({ ...stage, delayMinutes: Number(stage.delayMinutes) }))) !== JSON.stringify(savedStages) ||
    draftUnpaidExperimentEnabled !== (savedExperiment?.enabled ?? false) ||
    draftUnpaidHoldoutPercent.trim() !== String(savedExperiment?.holdoutPercent ?? 5);
  function toolDisplayName(toolId: string): string {
    const tool = allTools.find((t) => t.id === toolId);
    const catLabel = tool?.category ? t(`tools.selector.category.${tool.category}`, { defaultValue: tool.category }) : "";
    const nameLabel = t(`tools.selector.name.${toolId}`, { defaultValue: tool?.displayName ?? toolId });
    return catLabel ? `${catLabel} — ${nameLabel}` : nameLabel;
  }

  function updateStage(index: number, patch: Partial<UnpaidReachoutStageDraft>) {
    onDraftUnpaidReachoutStagesChange(
      draftUnpaidReachoutStages.map((stage, stageIndex) => stageIndex === index ? { ...stage, ...patch } : stage),
    );
  }

  return (
    <div className="shop-detail-section">
      <section id="shop-workspace-aiCustomerService-service" className="shop-workspace-section">
        <div className="drawer-section-label">{t("ecommerce.shopDrawer.aiCS.serviceStatus")}</div>
        <CustomerServiceBillingCta shopId={shop.id} shopName={shop.alias || shop.shopName} entitlement={entitlement} />
      </section>

      <section id="shop-workspace-aiCustomerService-device" className="shop-workspace-section">
        <div className="drawer-section-label">{t("ecommerce.shopDrawer.aiCS.csBindDevice")}</div>
        <div className="shop-toggle-card">
          <div className="shop-toggle-card-left">
            <span className="shop-toggle-card-label">
              {t("ecommerce.shopDrawer.aiCS.csBindDevice")}
            </span>
            <span className="form-hint">{t("ecommerce.shopDrawer.aiCS.csBindDeviceHint")}</span>
            {shop.services?.customerService?.csDeviceId && !shop.handlesCustomerServiceOnDevice(myDeviceId) && (
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
            <label className="form-label-block">{t("ecommerce.shopDrawer.aiCS.runProfileLabel")}</label>
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
              <div className="form-label-block">{t("ecommerce.shopDrawer.aiCS.availableTools")}</div>
              <ul className="shop-tool-list">
                {selectedRunProfile.selectedToolIds.map((toolId) => (
                  <li key={toolId} className="shop-tool-list-item">{toolDisplayName(toolId)}</li>
                ))}
              </ul>
              <div className="shop-tool-count">
                {t("ecommerce.shopDrawer.aiCS.toolCount", { count: selectedRunProfile.selectedToolIds.length })}
              </div>
            </div>
          ) : (
            <div className="shop-info-card-hint">{t("ecommerce.shopDrawer.aiCS.runProfileHint")}</div>
          )}
        </div>
      </section>

      <section id="shop-workspace-aiCustomerService-model" className="shop-workspace-section">
        <div className="drawer-section-label">{t("ecommerce.shopDrawer.aiCS.csModelOverride")}</div>
        <div className="shop-info-card">
          <div className="shop-runprofile-row">
            <label className="form-label-block">{t("ecommerce.shopDrawer.aiCS.csModelOverride")}</label>
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
          <div className="shop-info-card-hint">{t("ecommerce.shopDrawer.aiCS.csModelOverrideHint")}</div>
        </div>
      </section>

      <section id="shop-workspace-aiCustomerService-unpaid-reachout" className="shop-workspace-section">
        <div className="drawer-section-label">
          {t("ecommerce.shopDrawer.aiCS.unpaidReachout")}
        </div>
        <div className="shop-info-card shop-unpaid-reachout-card">
          <div className="shop-unpaid-reachout-toggle-pane">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={draftUnpaidReachoutEnabled}
                onChange={(e) => onToggleUnpaidReachoutEnabled(e.target.checked)}
                disabled={savingUnpaidReachoutSettings}
              />
              <span className={`toggle-track ${draftUnpaidReachoutEnabled ? "toggle-track-on" : "toggle-track-off"} ${savingUnpaidReachoutSettings ? "toggle-track-disabled" : ""}`}>
                <span className={`toggle-thumb ${draftUnpaidReachoutEnabled ? "toggle-thumb-on" : "toggle-thumb-off"}`} />
              </span>
            </label>
            <div className="shop-unpaid-reachout-copy">
              <span className="shop-toggle-card-label">
                {t("ecommerce.shopDrawer.aiCS.unpaidReachoutEnabled")}
              </span>
              <span className="form-hint">
                {t("ecommerce.shopDrawer.aiCS.unpaidReachoutHint")}
              </span>
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
                    <strong>{t("ecommerce.shopDrawer.aiCS.unpaidReachoutStage", { index: index + 1 })}</strong>
                    <label className="toggle-switch shop-unpaid-stage-toggle">
                      <input type="checkbox" checked={stage.enabled} onChange={(event) => updateStage(index, { enabled: event.target.checked })} />
                      <span className={`toggle-track ${stage.enabled ? "toggle-track-on" : "toggle-track-off"}`}><span className={`toggle-thumb ${stage.enabled ? "toggle-thumb-on" : "toggle-thumb-off"}`} /></span>
                    </label>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDraftUnpaidReachoutStagesChange(draftUnpaidReachoutStages.filter((_, itemIndex) => itemIndex !== index))}>{t("ecommerce.shopDrawer.aiCS.unpaidReachoutRemoveStage")}</button>
                  </div>
                  <div className="shop-unpaid-stage-delay-row">
                    <input className="input-full shop-unpaid-reachout-delay-input" type="number" min={1} max={2879} step={1} value={stage.delayMinutes} onChange={(event) => updateStage(index, { delayMinutes: event.target.value })} aria-invalid={!delayValid} />
                    <span className="shop-info-card-hint">{t("ecommerce.shopDrawer.aiCS.unpaidReachoutStageMinutes")}</span>
                  </div>
                  <textarea className="textarea-field shop-unpaid-reachout-template-input" value={stage.messageTemplate} onChange={(event) => updateStage(index, { messageTemplate: event.target.value })} rows={3} placeholder={t("ecommerce.shopDrawer.aiCS.unpaidReachoutTemplatePlaceholder")} />
                  <div className="shop-unpaid-reachout-placeholder-row">
                    {UNPAID_ORDER_TEMPLATE_PLACEHOLDERS.map((placeholder) => (
                      <button key={placeholder.token} type="button" className="shop-unpaid-reachout-placeholder-chip" onClick={() => updateStage(index, { messageTemplate: `${stage.messageTemplate}${placeholder.token}` })}>
                        <span className="shop-unpaid-reachout-placeholder-chip-token">{placeholder.token}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <button type="button" className="btn btn-secondary btn-sm shop-unpaid-add-stage" disabled={draftUnpaidReachoutStages.length >= 3 || savingUnpaidReachoutSettings} onClick={() => onDraftUnpaidReachoutStagesChange([...draftUnpaidReachoutStages, { enabled: true, delayMinutes: "", messageTemplate: "" }])}>
              + {t("ecommerce.shopDrawer.aiCS.unpaidReachoutAddStage")} {draftUnpaidReachoutStages.length >= 3 ? `(${t("ecommerce.shopDrawer.aiCS.unpaidReachoutMaxStages")})` : ""}
            </button>
          </div>
          <div className="shop-unpaid-experiment">
            <div className="shop-unpaid-reachout-toggle-pane">
              <label className="toggle-switch"><input type="checkbox" checked={draftUnpaidExperimentEnabled} onChange={(event) => onDraftUnpaidExperimentEnabledChange(event.target.checked)} /><span className={`toggle-track ${draftUnpaidExperimentEnabled ? "toggle-track-on" : "toggle-track-off"}`}><span className={`toggle-thumb ${draftUnpaidExperimentEnabled ? "toggle-thumb-on" : "toggle-thumb-off"}`} /></span></label>
              <div className="shop-unpaid-reachout-copy"><span className="shop-toggle-card-label">{t("ecommerce.shopDrawer.aiCS.unpaidReachoutControlGroup")}</span><span className="form-hint">{t("ecommerce.shopDrawer.aiCS.unpaidReachoutControlHint")}</span></div>
            </div>
            {draftUnpaidExperimentEnabled && <div className="shop-unpaid-stage-delay-row"><input className="input-full shop-unpaid-reachout-delay-input" type="number" min={1} max={20} value={draftUnpaidHoldoutPercent} onChange={(event) => onDraftUnpaidHoldoutPercentChange(event.target.value)} aria-invalid={!experimentValid} /><span className="shop-info-card-hint">{t("ecommerce.shopDrawer.aiCS.unpaidReachoutHoldoutHint")}</span></div>}
            {savedExperiment?.experimentId && <div className="shop-info-card-hint">Experiment {savedExperiment.experimentId}{savedExperiment.startedAt ? ` · started ${new Date(savedExperiment.startedAt).toLocaleDateString()}` : ""}</div>}
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
                  !unpaidReachoutDirty || !stagesValid || enabledDelays.length !== new Set(enabledDelays).size || !experimentValid
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
              <label className="form-label-block">{t("tiktokShops.detail.escalationChannel")}</label>
              <Select
                value={draftEscalationChannel}
                onChange={onDraftEscalationChannelChange}
                options={escalationChannelSelectOptions}
                disabled={savingEscalation}
                className="input-full"
              />
            </div>
            <div className={`escalation-cascade-col${!draftEscalationChannel ? " escalation-cascade-col-disabled" : ""}`}>
              <label className="form-label-block">{t("tiktokShops.detail.escalationRecipient")}</label>
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

      <section id="shop-workspace-aiCustomerService-prompt" className="shop-workspace-section shop-prompt-section">
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
            disabled={savingSettings || editBusinessPrompt === (shop.services?.customerService?.businessPrompt ?? "")}
          >
            {savingSettings ? t("common.loading") : t("ecommerce.shopDrawer.overview.save")}
          </button>
        </div>
      </section>

    </div>
  );
});
