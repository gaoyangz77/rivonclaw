import { useMemo, type ReactNode } from "react";
import { useQuery } from "@apollo/client/react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";
import { AFFILIATE_VIEWER_CAPABILITIES_QUERY } from "../../api/affiliate-staff-queries.js";
import { AffiliateAccessContext } from "../../hooks/useAffiliateAccess.js";
import {
  AFFILIATE_BUSINESS_DEVELOPER_ACCESS,
  affiliateAccessMaySeeSurface,
  resolveAffiliateStaffAccess,
  type AffiliateStaffSurface,
} from "../../lib/affiliate-access.js";
import { isAffiliateStaffOnly, isBusinessDeveloperOnly } from "../../lib/permission-scope.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { TkAlert, TkButton, TkEmptyState, TkLoadingState } from "../design-system/index.js";
import "./AffiliateStaffGate.css";

/**
 * Decides what a team lead or region admin sees of an Affiliate page (ADR-112),
 * and gives everything below it their access through `useAffiliateAccess`.
 *
 * A supervisor passes straight through with no provider, so their pages behave
 * exactly as before. A BD is read from its scopes (no request needed) and gets
 * the BD access, which differs from the supervisor default only in the Campaign
 * strategies it may use (ADR-118). A staff login is held on a loading state until the
 * Backend has said which profile it holds, because the scope alone cannot tell
 * a lead from a role that nobody linked to a profile.
 */
export const AffiliateStaffGate = observer(function AffiliateStaffGate({
  surface,
  children,
}: {
  surface: AffiliateStaffSurface;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const user = useEntityStore().currentUser;
  const staffOnly = isAffiliateStaffOnly(user);
  const { data, error, refetch } = useQuery<{
    affiliateViewerCapabilities: GQL.AffiliateViewerCapabilities;
  }>(AFFILIATE_VIEWER_CAPABILITIES_QUERY, {
    fetchPolicy: "cache-and-network",
    skip: !staffOnly,
  });

  const capabilities = data?.affiliateViewerCapabilities;
  // One stable value per capability read: consumers key effects on it.
  const access = useMemo(
    () => (capabilities ? resolveAffiliateStaffAccess(capabilities) : null),
    [capabilities],
  );

  if (!staffOnly) {
    return isBusinessDeveloperOnly(user) ? (
      <AffiliateAccessContext.Provider value={AFFILIATE_BUSINESS_DEVELOPER_ACCESS}>
        {children}
      </AffiliateAccessContext.Provider>
    ) : (
      <>{children}</>
    );
  }

  if (!capabilities) {
    return error ? (
      <div className="affiliate-staff-gate">
        <TkAlert
          tone="danger"
          title={t("ecommerce.affiliateStaff.loadFailed")}
          actions={
            <TkButton size="sm" variant="secondary" onClick={() => void refetch()}>
              {t("ecommerce.affiliateStaff.retry")}
            </TkButton>
          }
        >
          {error.message}
        </TkAlert>
      </div>
    ) : (
      <TkLoadingState label={t("ecommerce.affiliateStaff.loadingAccess")} />
    );
  }

  if (!access) {
    return (
      <div className="affiliate-staff-gate">
        <TkEmptyState
          title={t("ecommerce.affiliateStaff.notSetUpTitle")}
          description={t("ecommerce.affiliateStaff.notSetUpDescription")}
        />
      </div>
    );
  }
  if (!affiliateAccessMaySeeSurface(access, surface)) {
    return (
      <div className="affiliate-staff-gate">
        <TkEmptyState
          title={t("ecommerce.affiliateStaff.unavailableTitle")}
          description={t("ecommerce.affiliateStaff.unavailableDescription")}
        />
      </div>
    );
  }
  return <AffiliateAccessContext.Provider value={access}>{children}</AffiliateAccessContext.Provider>;
});
