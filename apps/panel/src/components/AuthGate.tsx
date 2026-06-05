import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { useEntityStore } from "../store/EntityStoreProvider.js";

interface AuthGateProps {
  children: ReactNode;
  /** Where to navigate for login (default: "/account/profile") */
  loginPath?: string;
  /** Where to navigate for upgrade (default: "/account/profile") */
  upgradePath?: string;
  /** Navigation callback */
  onNavigate: (path: string) => void;
  /** Optional: custom loading element */
  loadingElement?: ReactNode;
  /** If true, skip the subscription check — only require login (default: false) */
  skipSubscriptionCheck?: boolean;
}

export const AuthGate = observer(function AuthGate({
  children,
  loginPath = "/account/profile",
  upgradePath = "/account/profile",
  onNavigate,
  loadingElement,
  skipSubscriptionCheck = false,
}: AuthGateProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const accountLlm = entityStore.billingOverview?.accountLlm ?? null;
  const authLoading = (entityStore as any).authBootstrap?.status === "loading";

  if (authLoading) {
    if (loadingElement) return <>{loadingElement}</>;
    return (
      <div className="section-card auth-gate-card">
        <p className="form-hint">{t("common.loading")}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="section-card auth-gate-card" data-testid="auth-gate-login">
        <h3>{t("authGate.loginRequired")}</h3>
        <p className="form-hint">{t("authGate.loginRequiredDesc")}</p>
        <button
          className="btn btn-primary"
          onClick={() => onNavigate(loginPath)}
          type="button"
        >
          {t("auth.login")}
        </button>
      </div>
    );
  }

  if (!skipSubscriptionCheck && accountLlm?.entitlement.allowed !== true) {
    return (
      <div className="section-card auth-gate-card" data-testid="auth-gate-upgrade">
        <h3>{t("authGate.subscriptionRequired")}</h3>
        <p className="form-hint">{t("authGate.subscriptionRequiredDesc")}</p>
        <button
          className="btn btn-primary"
          onClick={() => onNavigate(upgradePath)}
          type="button"
        >
          {t("authGate.upgradeAction")}
        </button>
      </div>
    );
  }

  return <>{children}</>;
});
