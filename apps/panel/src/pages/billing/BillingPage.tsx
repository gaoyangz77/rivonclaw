import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { AccountBillingSection } from "../../components/billing/AccountBillingSection.js";
import { TkPageFrame, TkPageHeader, TkPanel } from "../../components/design-system/index.js";

export const BillingPage = observer(function BillingPage() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";

  useEffect(() => {
    if (!user) return;
    entityStore.refreshBilling().catch(() => {});
    entityStore.refreshPlanDefinitions().catch(() => {});
    entityStore.readPayments().catch(() => {});
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        entityStore.refreshBilling().catch(() => {});
        entityStore.readPayments().catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [entityStore, user]);

  if (authChecking) {
    return (
      <TkPageFrame className="billing-page">
        <TkPanel>
          <p>{t("common.loading")}</p>
        </TkPanel>
      </TkPageFrame>
    );
  }

  if (!user) {
    return (
      <TkPageFrame className="billing-page">
        <TkPanel>
          <h2>{t("auth.loginRequired")}</h2>
          <p>{t("auth.loginFromSidebar")}</p>
        </TkPanel>
      </TkPageFrame>
    );
  }

  return (
    <TkPageFrame className="billing-page" data-tutorial-id="billing-page">
      <TkPageHeader title={t("nav.billing")} />
      <AccountBillingSection />
    </TkPageFrame>
  );
});
