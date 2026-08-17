import { useQuery } from "@apollo/client/react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { AFFILIATE_BUSINESS_DEVELOPERS_QUERY } from "../../api/shops-queries.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";

interface AffiliateBdDeviceBannerProps {
  onNavigate: (path: string) => void;
}

/**
 * App-wide warning shown while any active (non-archived) affiliate business
 * developer has no outreach device bound. Existing deviceless BDs are never
 * migrated or auto-assigned — this banner is the remediation surface, pointing
 * the seller at the team page.
 *
 * It reads its own query result and deliberately writes nothing to the MST
 * workspace: `replaceAffiliateBusinessDevelopers` clears the collection before
 * rebuilding it, so a second writer of the same list makes every observer of
 * `businessDevelopers` render an empty list for a frame. This banner is mounted
 * app-wide, which would inflict that flash on the team page continuously. The
 * Apollo cache is shared, so a save on the team page still updates this query
 * and clears the banner immediately.
 */
export const AffiliateBdDeviceBanner = observer(function AffiliateBdDeviceBanner({
  onNavigate,
}: AffiliateBdDeviceBannerProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const skip = !user || authChecking;

  const developersQuery = useQuery<{ affiliateBusinessDevelopers: GQL.AffiliateBusinessDeveloper[] }>(
    AFFILIATE_BUSINESS_DEVELOPERS_QUERY,
    { variables: { includeArchived: true }, fetchPolicy: "cache-and-network", skip },
  );

  if (skip) return null;
  const missingDeviceNames = (developersQuery.data?.affiliateBusinessDevelopers ?? [])
    .filter((developer) => !developer.archivedAt && !(developer.deviceId ?? "").trim())
    .map((developer) => developer.displayName);
  if (missingDeviceNames.length === 0) return null;

  return (
    <div className="warning-banner customer-service-routing-banner" role="alert">
      <span className="customer-service-routing-banner-title">
        {t("ecommerce.affiliateTeam.deviceBannerTitle")}
      </span>
      <span>{t("ecommerce.affiliateTeam.deviceBannerBody", { names: missingDeviceNames.join(", ") })}</span>
      <span className="quota-banner-actions">
        <button
          type="button"
          className="quota-banner-action"
          onClick={() => onNavigate("/commerce/affiliate/team")}
        >
          {t("ecommerce.affiliateTeam.deviceBannerAction")}
        </button>
      </span>
    </div>
  );
});
