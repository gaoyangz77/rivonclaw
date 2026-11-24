import { useTranslation } from "react-i18next";
import { useAffiliateAccess } from "../../hooks/useAffiliateAccess.js";
import { affiliateStaffNoticeKey } from "../../lib/affiliate-access.js";
import { TkAlert } from "../design-system/index.js";

/**
 * Tells a team lead or region admin what this login may do (ADR-113): view,
 * view and operate, allocate, or a combination. Renders nothing for supervisors
 * and BDs, so a page can mount it unconditionally.
 */
export function AffiliateStaffNotice({ className }: { className?: string }) {
  const { t } = useTranslation();
  const key = affiliateStaffNoticeKey(useAffiliateAccess());
  if (!key) return null;
  return (
    <TkAlert className={className} tone="info">
      {t(`ecommerce.affiliateStaff.${key}`)}
    </TkAlert>
  );
}
