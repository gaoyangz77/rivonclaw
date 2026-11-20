import { useQuery } from "@apollo/client/react";
import type { GQL } from "@rivonclaw/core";
import {
  AFFILIATE_REGION_BUSINESS_DEVELOPER_OPTIONS_QUERY,
  AFFILIATE_TEAM_LEAD_SUBTREE_QUERY,
} from "../api/affiliate-staff-queries.js";
import type { AffiliateAccess } from "../lib/affiliate-access.js";
import {
  affiliateRegionDevelopers,
  affiliateSubtreeDevelopers,
  type AffiliateStaffDeveloper,
} from "../lib/affiliate-staff-directory.js";

export interface AffiliateStaffDirectory {
  /** The team lead's subtree; empty for any other login. */
  teamDevelopers: AffiliateStaffDeveloper[];
  /** The BDs a region admin may name; empty for any other login. */
  regionDevelopers: AffiliateStaffDeveloper[];
  loading: boolean;
}

/**
 * The BDs a staff login can name, read through the operations the Backend lets
 * that facet call. A supervisor or BD reads nothing here: their pages keep
 * using the BD roster.
 */
export function useAffiliateStaffDirectory(access: AffiliateAccess): AffiliateStaffDirectory {
  const staff = access.kind === "STAFF";
  const subtreeSkipped = !(staff && access.isTeamLead);
  const regionSkipped = !(staff && access.isRegionAdmin);
  const subtree = useQuery<{ affiliateTeamLeadSubtree: GQL.AffiliateTeamLeadSubtree }>(
    AFFILIATE_TEAM_LEAD_SUBTREE_QUERY,
    { fetchPolicy: "cache-and-network", skip: subtreeSkipped },
  );
  const region = useQuery<{
    affiliateRegionBusinessDeveloperOptions: GQL.AffiliateAllocationBusinessDeveloper[];
  }>(AFFILIATE_REGION_BUSINESS_DEVELOPER_OPTIONS_QUERY, {
    fetchPolicy: "cache-and-network",
    skip: regionSkipped,
  });
  const subtreeData = subtreeSkipped ? undefined : subtree.data?.affiliateTeamLeadSubtree;
  const regionData = regionSkipped ? undefined : region.data?.affiliateRegionBusinessDeveloperOptions;
  return {
    teamDevelopers: subtreeData ? affiliateSubtreeDevelopers(subtreeData) : [],
    regionDevelopers: regionData ? affiliateRegionDevelopers(regionData) : [],
    loading: (!subtreeSkipped && subtree.loading) || (!regionSkipped && region.loading),
  };
}
