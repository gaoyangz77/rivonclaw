import { useState } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { ConfirmDialog } from "../../components/modals/ConfirmDialog.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { useTikTokShopData } from "./hooks/useTikTokShopData.js";
import { useTikTokOAuthFlow } from "./hooks/useTikTokOAuthFlow.js";
import { useTikTokShopDetail } from "./hooks/useTikTokShopDetail.js";
import { TikTokShopsList } from "./components/TikTokShopsList.js";
import { TikTokShopConnectModal } from "./components/TikTokShopConnectModal.js";
import { TikTokShopDetailModal } from "./components/TikTokShopDetailModal.js";

export const TikTokShopsPage = observer(function TikTokShopsPage() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const shops = entityStore.shops;
  const platformApps = entityStore.platformApps;

  const [upgradePrompt, setUpgradePrompt] = useState(false);

  useTikTokShopData();

  const {
    oauthLoading,
    oauthWaiting,
    connectModalOpen,
    setConnectModalOpen,
    selectedPlatformAppId,
    setSelectedPlatformAppId,
    cleanupOAuthWait,
    handleConnectShop,
    handleReauthorize,
    handleError,
  } = useTikTokOAuthFlow({ setUpgradePrompt });

  const {
    selectedShopId,
    activeTab,
    setActiveTab,
    editBusinessPrompt,
    setEditBusinessPrompt,
    savingSettings,
    togglingServiceId,
    confirmDeleteShopId,
    setConfirmDeleteShopId,
    openDetailModal,
    closeDetailModal,
    handleSaveBusinessPrompt,
    handleToggleCustomerService,
    handleDeleteShop,
  } = useTikTokShopDetail({ handleError, setUpgradePrompt });

  if (authChecking) {
    return (
      <div className="page-enter">
        <div className="section-card">
          <p>{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-enter">
        <div className="section-card">
          <h2>{t("auth.loginRequired")}</h2>
          <p>{t("auth.loginFromSidebar")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <h1>{t("tiktokShops.title")}</h1>
      <p>{t("tiktokShops.description")}</p>

      {upgradePrompt && (
        <div className="info-box info-box-blue">
          {t("tiktokShops.upgradeRequired")}
        </div>
      )}

      {/* OAuth Waiting State */}
      {oauthWaiting && (
        <div className="info-box">
          <span>{t("tiktokShops.oauthWaiting")}</span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              cleanupOAuthWait();
            }}
          >
            {t("common.cancel")}
          </button>
        </div>
      )}

      <TikTokShopsList
        shops={shops}
        oauthLoading={oauthLoading}
        oauthWaiting={oauthWaiting}
        onConnectClick={() => { setConnectModalOpen(true); }}
        onView={openDetailModal}
        onReauthorize={handleReauthorize}
        onDelete={setConfirmDeleteShopId}
      />

      <TikTokShopConnectModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        platformApps={platformApps}
        selectedPlatformAppId={selectedPlatformAppId}
        onPlatformAppChange={setSelectedPlatformAppId}
        onConnect={handleConnectShop}
        oauthLoading={oauthLoading}
      />

      <TikTokShopDetailModal
        shopId={selectedShopId}
        onClose={closeDetailModal}
        upgradePrompt={upgradePrompt}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        togglingServiceId={togglingServiceId}
        editBusinessPrompt={editBusinessPrompt}
        onEditBusinessPrompt={setEditBusinessPrompt}
        savingSettings={savingSettings}
        onToggleCustomerService={handleToggleCustomerService}
        onSaveBusinessPrompt={handleSaveBusinessPrompt}
      />

      <ConfirmDialog
        isOpen={confirmDeleteShopId !== null}
        title={t("tiktokShops.disconnect")}
        message={t("tiktokShops.confirmDisconnect")}
        confirmLabel={t("tiktokShops.disconnect")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => confirmDeleteShopId && handleDeleteShop(confirmDeleteShopId)}
        onCancel={() => setConfirmDeleteShopId(null)}
      />
    </div>
  );
});
