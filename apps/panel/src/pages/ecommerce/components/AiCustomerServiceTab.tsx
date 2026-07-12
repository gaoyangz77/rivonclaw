import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import type { Shop } from "@rivonclaw/core/models";
import { Select } from "../../../components/inputs/Select.js";
import { KeyModelSelector } from "../../../components/inputs/KeyModelSelector.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { CustomerServiceBillingCta } from "../../../components/billing/CustomerServiceBillingCta.js";
import type { UnpaidReachoutStageDraft } from "../EcommercePage.js";
import { UnpaidOrderReachoutSettings } from "./UnpaidOrderReachoutSettings.js";

const BUSINESS_PROMPT_MAX_LENGTH = 10_000;
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
  onToggleUnpaidReachoutEnabled: (value: boolean) => void;
  onDraftUnpaidReachoutStagesChange: (value: UnpaidReachoutStageDraft[]) => void;
  onDraftUnpaidExperimentEnabledChange: (value: boolean) => void;
  onDraftUnpaidHoldoutPercentChange: (value: string) => void;
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
  onToggleUnpaidReachoutEnabled,
  onDraftUnpaidReachoutStagesChange,
  onDraftUnpaidExperimentEnabledChange,
  onDraftUnpaidHoldoutPercentChange,
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
        <UnpaidOrderReachoutSettings
          shop={shop}
          enabled={draftUnpaidReachoutEnabled}
          stages={draftUnpaidReachoutStages}
          evaluationEnabled={draftUnpaidExperimentEnabled}
          holdoutPercent={draftUnpaidHoldoutPercent}
          onEnabledChange={onToggleUnpaidReachoutEnabled}
          onStagesChange={onDraftUnpaidReachoutStagesChange}
          onEvaluationEnabledChange={onDraftUnpaidExperimentEnabledChange}
          onHoldoutPercentChange={onDraftUnpaidHoldoutPercentChange}
        />
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
