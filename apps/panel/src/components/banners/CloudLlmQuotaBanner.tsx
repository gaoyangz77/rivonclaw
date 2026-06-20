import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { resolveCloudLlmQuotaBannerState } from "../../lib/cloud-llm-quota-banner.js";

interface CloudLlmQuotaBannerProps {
  onNavigate: (path: string) => void;
}

export const CloudLlmQuotaBanner = observer(function CloudLlmQuotaBanner({ onNavigate }: CloudLlmQuotaBannerProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const isUsingCloudLlm = entityStore.providerKeys.some((key) => key.isDefault && key.provider === "rivonclaw-pro");
  const banner = resolveCloudLlmQuotaBannerState(entityStore.providerKeys, entityStore.billingOverview);

  useEffect(() => {
    if (!user || authChecking || !isUsingCloudLlm) return;

    let cancelled = false;
    function refreshBilling() {
      if (cancelled || document.visibilityState === "hidden") return;
      entityStore.refreshBilling().catch(() => {});
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") refreshBilling();
    }

    refreshBilling();
    const interval = window.setInterval(refreshBilling, 60_000);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [authChecking, entityStore, isUsingCloudLlm, user]);

  if (!banner) return null;

  return (
    <div
      className={`quota-banner quota-banner-${banner.severity}`}
      role="alert"
    >
      <span className="quota-banner-title">
        {t(banner.severity === "error"
          ? "billing.cloudQuotaExhaustedTitle"
          : "billing.cloudQuotaLowTitle")}
      </span>
      <span>
        {t(banner.severity === "error"
          ? "billing.cloudQuotaExhaustedBody"
          : "billing.cloudQuotaLowBody")}
      </span>
      <span className="quota-banner-actions">
        <button
          type="button"
          className="quota-banner-action"
          onClick={() => onNavigate("/account/billing")}
        >
          {t("billing.openBilling")}
        </button>
        <button
          type="button"
          className="quota-banner-action"
          onClick={() => onNavigate("/connections/models")}
        >
          {t("billing.addLlmKey")}
        </button>
      </span>
    </div>
  );
});
