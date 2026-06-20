import { useTranslation } from "react-i18next";

interface LlmUnavailableBannerProps {
  show: boolean;
}

export function LlmUnavailableBanner({ show }: LlmUnavailableBannerProps) {
  const { t } = useTranslation();
  if (!show) return null;

  return (
    <div className="warning-banner customer-service-routing-banner" role="alert">
      <span className="customer-service-routing-banner-title">
        {t("ecommerce.llmUnavailableTitle")}
      </span>
      <span>{t("ecommerce.llmUnavailableBody")}</span>
    </div>
  );
}
