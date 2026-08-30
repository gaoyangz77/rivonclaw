import { useTranslation } from "react-i18next";
import { TkTabs } from "../../../components/design-system/index.js";
import { TkModal as Modal } from "../../../components/design-system/index.js";
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

          <TkTabs
            idPrefix="tiktok-shop-detail"
            label={t("tiktokShops.modal.title", { defaultValue: shop.shopName })}
            items={[
              { id: "overview", label: t("tiktokShops.modal.tabs.overview") },
              { id: "billing", label: t("tiktokShops.modal.tabs.billing") },
              { id: "sessions", label: t("tiktokShops.modal.tabs.sessions") },
            ]}
            value={activeTab}
            onChange={(value) => onTabChange(value as ModalTab)}
          />

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
