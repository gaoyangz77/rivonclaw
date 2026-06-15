import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
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
    Promise.all([
      inventory.fetchWmsInventory(),
      inventory.fetchInventoryGoods(),
    ]).catch(() => {});
  }, [inventory, user]);

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
    <div className="page-enter inventory-page">
      <div className="ecommerce-page-header">
        <div>
          <h1>{t("ecommerce.inventory.pageTitle")}</h1>
          <p className="ecommerce-page-subtitle">{t("ecommerce.inventory.pageSubtitle")}</p>
        </div>
      </div>

      <WmsAccountTable
        accounts={entityStore.wmsAccounts}
        warehouses={entityStore.warehouses}
        onAddAccount={() => inventory.setAddWmsAccountModalOpen(true)}
      />

      <InventoryGoodsTableSection />

      <AddWmsAccountModal />
      <WmsInventoryGoodsSyncModal />
      <InventoryGoodModal />
    </div>
  );
});
