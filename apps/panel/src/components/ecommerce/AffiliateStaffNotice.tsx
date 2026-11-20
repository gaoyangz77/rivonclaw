import { useTranslation } from "react-i18next";
import { useAffiliateAccess } from "../../hooks/useAffiliateAccess.js";
import { TkAlert } from "../design-system/index.js";

/**
 * Tells a team lead or region admin what their view is for (ADR-112). Renders
 * nothing for supervisors and BDs, so a page can mount it unconditionally.
 */
export function AffiliateStaffNotice({ className }: { className?: string }) {
  const { t } = useTranslation();
  const access = useAffiliateAccess();
  if (access.kind !== "STAFF") return null;
  const key =
    access.isTeamLead && access.isRegionAdmin
      ? "teamLeadAndRegionAdminNotice"
      : access.isTeamLead
        ? "teamLeadNotice"
        : "regionAdminNotice";
  return (
    <TkAlert className={className} tone="info">
      {t(`ecommerce.affiliateStaff.${key}`)}
    </TkAlert>
  );
}
