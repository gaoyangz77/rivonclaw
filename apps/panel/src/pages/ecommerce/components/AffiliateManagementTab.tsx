import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import type { Shop } from "@rivonclaw/core/models";
import { Select } from "../../../components/inputs/Select.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";

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

  function toolDisplayName(toolId: string): string {
    const tool = allTools.find((candidate) => candidate.id === toolId);
    const catLabel = tool?.category ? t(`tools.selector.category.${tool.category}`, { defaultValue: "" }) : "";
    const nameLabel = t(`tools.selector.name.${toolId}`, { defaultValue: tool?.displayName ?? toolId });
    return catLabel ? `${catLabel} — ${nameLabel}` : nameLabel;
  }

  return (
    <div className="shop-detail-section">
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
    </div>
  );
});
