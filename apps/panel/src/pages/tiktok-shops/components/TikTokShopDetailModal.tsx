import { useTranslation } from "react-i18next";
import { Modal } from "../../../components/modals/Modal.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import type { ModalTab } from "../tiktok-shops-types.js";
import { TikTokShopOverviewTab } from "./TikTokShopOverviewTab.js";
import { TikTokShopBillingTab } from "./TikTokShopBillingTab.js";
import { TikTokShopSessionsTab } from "./TikTokShopSessionsTab.js";

interface TikTokShopDetailModalProps {
  shopId: string | null;
  onClose: () => void;
  upgradePrompt: boolean;
  activeTab: ModalTab;
  onTabChange: (tab: ModalTab) => void;
  // Overview tab props
  togglingServiceId: string | null;
  editBusinessPrompt: string;
  onEditBusinessPrompt: (value: string) => void;
  savingSettings: boolean;
  onToggleCustomerService: (shopId: string, currentValue: boolean) => void;
  onSaveBusinessPrompt: () => void;
}

export function TikTokShopDetailModal({
  shopId,
  onClose,
  upgradePrompt,
  activeTab,
  onTabChange,
  togglingServiceId,
  editBusinessPrompt,
  onEditBusinessPrompt,
  savingSettings,
  onToggleCustomerService,
  onSaveBusinessPrompt,
}: TikTokShopDetailModalProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const shop = shopId
    ? entityStore.shops.find((item) => item.id === shopId) ?? null
    : null;

  return (
    <Modal
      isOpen={!!shop}
      onClose={onClose}
      title={shop?.shopName ?? ""}
      maxWidth={680}
    >
      {shop && (
        <div className="modal-form-col">
          {upgradePrompt && (
            <div className="info-box info-box-blue">
              {t("tiktokShops.upgradeRequired")}
            </div>
          )}

          {/* Tab Bar */}
          <div className="tab-bar tab-bar--spread">
            <button
              className={`tab-btn ${activeTab === "overview" ? "tab-btn-active" : ""}`}
              onClick={() => onTabChange("overview")}
            >
              {t("tiktokShops.modal.tabs.overview")}
            </button>
            <button
              className={`tab-btn ${activeTab === "billing" ? "tab-btn-active" : ""}`}
              onClick={() => onTabChange("billing")}
            >
              {t("tiktokShops.modal.tabs.billing")}
            </button>
            <button
              className={`tab-btn ${activeTab === "sessions" ? "tab-btn-active" : ""}`}
              onClick={() => onTabChange("sessions")}
            >
              {t("tiktokShops.modal.tabs.sessions")}
            </button>
          </div>

          {activeTab === "overview" && (
            <TikTokShopOverviewTab
              shop={shop}
              togglingServiceId={togglingServiceId}
              editBusinessPrompt={editBusinessPrompt}
              onEditBusinessPrompt={onEditBusinessPrompt}
              savingSettings={savingSettings}
              onToggleCustomerService={onToggleCustomerService}
              onSaveBusinessPrompt={onSaveBusinessPrompt}
            />
          )}

          {activeTab === "billing" && (
            <TikTokShopBillingTab shop={shop} />
          )}

          {activeTab === "sessions" && (
            <TikTokShopSessionsTab shop={shop} />
          )}
        </div>
      )}
    </Modal>
  );
}
