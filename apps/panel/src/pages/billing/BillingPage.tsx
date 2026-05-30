import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { AccountBillingSection } from "../../components/billing/AccountBillingSection.js";

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
      <div className="billing-page page-enter">
        <div className="section-card">
          <p>{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="billing-page page-enter">
        <div className="section-card">
          <h2>{t("auth.loginRequired")}</h2>
          <p>{t("auth.loginFromSidebar")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="billing-page page-enter">
      <AccountBillingSection
        billingOverview={entityStore.billingOverview}
        planDefinitions={entityStore.billingPlanDefinitions}
        payments={entityStore.payments}
      />
    </div>
  );
});
