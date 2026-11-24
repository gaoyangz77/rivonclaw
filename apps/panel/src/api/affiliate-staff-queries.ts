import { gql } from "@apollo/client/core";

/**
 * Affiliate staff logins (ADR-112, ADR-113): the team lead's workspace over
 * their subtree and the region admin's Creator allocation, each as far as the
 * profile's permissions go. Each operation here is on the Backend allowlist of
 * the staff kind that issues it; supervisors and BDs never call them.
 */

/**
 * Which kind of Affiliate login the caller is, which staff profiles it holds and
 * what each profile may do (ADR-113). A facet the login does not hold lists no
 * permission.
 */
export const AFFILIATE_VIEWER_CAPABILITIES_QUERY = gql`
  query AffiliateViewerCapabilities {
    affiliateViewerCapabilities {
      kind
      isTeamLead
      isRegionAdmin
      teamLeadPermissions
      regionAdminPermissions
    }
  }
`;

/** A team lead's own team: themself, their live descendant leads and their live BDs. */
export const AFFILIATE_TEAM_LEAD_SUBTREE_QUERY = gql`
  query AffiliateTeamLeadSubtree {
    affiliateTeamLeadSubtree {
      self {
        id
        displayName
        parentLeadId
      }
      descendantLeads {
        id
        displayName
        parentLeadId
      }
      businessDevelopers {
        id
        displayName
        parentLeadId
      }
    }
  }
`;

/**
 * The BDs a Creator may be assigned to by this login (ADR-113), each with the
 * Creator's shops that BD does not cover. The uncovered shops are a warning, never
 * a refusal.
 */
export const AFFILIATE_ASSIGNABLE_BUSINESS_DEVELOPERS_QUERY = gql`
  query AffiliateAssignableBusinessDevelopers($creatorRelationshipId: ID!) {
    affiliateAssignableBusinessDevelopers(creatorRelationshipId: $creatorRelationshipId) {
      id
      displayName
      uncoveredShopIds
    }
  }
`;

/** The BDs a region admin may filter the Creator list by. */
export const AFFILIATE_REGION_BUSINESS_DEVELOPER_OPTIONS_QUERY = gql`
  query AffiliateRegionBusinessDeveloperOptions {
    affiliateRegionBusinessDeveloperOptions {
      id
      displayName
    }
  }
`;
