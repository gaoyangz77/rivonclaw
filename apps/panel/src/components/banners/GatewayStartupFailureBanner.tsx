import { useTranslation } from "react-i18next";

interface GatewayStartupFailureBannerProps {
  /** The gateway's own startup failure reason; empty while there is none. */
  reason: string;
}

export function GatewayStartupFailureBanner({ reason }: GatewayStartupFailureBannerProps) {
  const { t } = useTranslation();
  if (!reason) return null;

  return (
    <div className="warning-banner customer-service-routing-banner" role="alert">
      <span className="customer-service-routing-banner-title">
        {t("common.gatewayStartupFailedTitle")}
      </span>
      <span>{t("common.gatewayStartupFailedBody")}</span>
      <span className="gateway-startup-failure-reason">{reason}</span>
    </div>
  );
}
