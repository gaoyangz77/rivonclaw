import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { TkPageFrame, TkPageHeader, TkPanel } from "../../components/design-system/index.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { AddWmsAccountModal } from "./components/AddWmsAccountModal.js";
import { InventoryGoodModal } from "./components/InventoryGoodModal.js";
import { InventoryGoodsTableSection } from "./components/InventoryGoodsTableSection.js";
import { WmsAccountTable } from "./components/WmsAccountTable.js";
import { WmsInventoryGoodsSyncModal } from "./components/WmsInventoryGoodsSyncModal.js";

export const InventoryManagementPage = observer(function InventoryManagementPage() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const inventory = entityStore.ecommerceInventory;

  useEffect(() => {
    if (!user) return;
    Promise.all([inventory.fetchWmsInventory(), inventory.fetchInventoryGoods()]).catch(() => {});
  }, [inventory, user]);

  if (authChecking) {
    return (
      <TkPageFrame>
        <TkPanel className="section-card">
          <p>{t("common.loading")}</p>
        </TkPanel>
      </TkPageFrame>
    );
  }

  if (!user) {
    return (
      <TkPageFrame>
        <TkPanel className="section-card">
          <h2>{t("auth.loginRequired")}</h2>
          <p>{t("auth.loginFromSidebar")}</p>
        </TkPanel>
      </TkPageFrame>
    );
  }

  return (
    <TkPageFrame className="inventory-page">
      <TkPageHeader
        title={t("ecommerce.inventory.pageTitle")}
        description={t("ecommerce.inventory.pageSubtitle")}
        data-tutorial-id="inventory-header"
      />

      <WmsAccountTable
        accounts={entityStore.wmsAccounts}
        warehouses={entityStore.warehouses}
        onAddAccount={() => inventory.setAddWmsAccountModalOpen(true)}
      />

      <InventoryGoodsTableSection />

      <AddWmsAccountModal />
      <WmsInventoryGoodsSyncModal />
      <InventoryGoodModal />
    </TkPageFrame>
  );
});
