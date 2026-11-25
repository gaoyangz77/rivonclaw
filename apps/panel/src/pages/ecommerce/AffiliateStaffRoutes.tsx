import { AffiliateStaffGate } from "../../components/ecommerce/AffiliateStaffGate.js";
import {
  AffiliateCreatorsPage,
  AffiliateHistoryPage,
  AffiliateManualWorkbenchPage,
  AffiliateWorkbenchPage,
} from "./AffiliateManagementPage.js";
import { AffiliateCampaignPage } from "./AffiliateCampaignPage.js";

/**
 * The Affiliate pages a team lead or region admin may open (ADR-112), each
 * behind the gate that learns which profile the login holds. Supervisors and
 * BDs pass through the gate untouched.
 */

export function AffiliateWorkbenchRoute() {
  return (
    <AffiliateStaffGate surface="WORKBENCH">
      <AffiliateWorkbenchPage />
    </AffiliateStaffGate>
  );
}

export function AffiliateManualWorkbenchRoute() {
  return (
    <AffiliateStaffGate surface="WORKBENCH">
      <AffiliateManualWorkbenchPage />
    </AffiliateStaffGate>
  );
}

export function AffiliateCreatorsRoute() {
  return (
    <AffiliateStaffGate surface="CREATORS">
      <AffiliateCreatorsPage />
    </AffiliateStaffGate>
  );
}

export function AffiliateHistoryRoute() {
  return (
    <AffiliateStaffGate surface="HISTORY">
      <AffiliateHistoryPage />
    </AffiliateStaffGate>
  );
}

/**
 * Campaigns (ADR-118): supervisors, BDs and region admins holding `CAMPAIGN`.
 * The gate answers for staff; the page itself narrows to what the access allows.
 */
export function AffiliateCampaignRoute() {
  return (
    <AffiliateStaffGate surface="CAMPAIGNS">
      <AffiliateCampaignPage />
    </AffiliateStaffGate>
  );
}
