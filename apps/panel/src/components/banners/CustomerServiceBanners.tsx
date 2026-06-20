import { useTranslation } from "react-i18next";

export interface CustomerServiceRoutingProblem {
  shopId: string;
  shopName: string;
  issue: "invalid_channel" | "missing_context_token";
}

interface CustomerServiceBridgeBannerProps {
  show: boolean;
  state: string;
  reconnectAttempt: number;
}

export function CustomerServiceBridgeBanner({
  show,
  state,
  reconnectAttempt,
}: CustomerServiceBridgeBannerProps) {
  const { t } = useTranslation();
  if (!show) return null;

  return (
    <div className="warning-banner">
      {state === "reconnecting" && <span className="spinner" />}
      {state === "reconnecting"
        ? t("ecommerce.shopDrawer.aiCS.bridgeReconnecting", { attempt: reconnectAttempt })
        : t("ecommerce.shopDrawer.aiCS.bridgeDisconnected")}
    </div>
  );
}

interface CustomerServiceRoutingBannerProps {
  problems: readonly CustomerServiceRoutingProblem[];
}

export function CustomerServiceRoutingBanner({ problems }: CustomerServiceRoutingBannerProps) {
  const { t } = useTranslation();
  if (problems.length === 0) return null;

  return (
    <div className="warning-banner customer-service-routing-banner" role="alert">
      <span className="customer-service-routing-banner-title">
        {t("ecommerce.customerServiceRoutingUnavailableTitle")}
      </span>
      <span className="customer-service-routing-banner-items">
        {problems.map((problem) => (
          <span className="customer-service-routing-banner-item" key={problem.shopId}>
            <strong>{problem.shopName}</strong>
            <span>{t(`ecommerce.customerServiceRoutingIssue_${problem.issue}`)}</span>
          </span>
        ))}
      </span>
    </div>
  );
}
