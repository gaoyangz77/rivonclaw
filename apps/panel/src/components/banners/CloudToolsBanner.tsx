import { useTranslation } from "react-i18next";

interface CloudToolsBannerProps {
  state: string;
}

export function CloudToolsBanner({ state }: CloudToolsBannerProps) {
  const { t } = useTranslation();
  if (state !== "unavailable") return null;

  return (
    <div className="warning-banner customer-service-routing-banner" role="alert">
      <span className="customer-service-routing-banner-title">
        {t("common.cloudToolsUnavailableTitle")}
      </span>
      <span>{t("common.cloudToolsUnavailableBody")}</span>
    </div>
  );
}
