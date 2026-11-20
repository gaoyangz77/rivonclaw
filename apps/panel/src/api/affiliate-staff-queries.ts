import { gql } from "@apollo/client/core";

/**
 * Affiliate staff logins (ADR-112): the team lead's read-only workspace over
 * their subtree and the region admin's Creator allocation. Each operation here
 * is on the Backend allowlist of the staff kind that issues it; supervisors and
 * BDs never call them.
 */

/** Which kind of Affiliate login the caller is, and which staff profiles it holds. */
export const AFFILIATE_VIEWER_CAPABILITIES_QUERY = gql`
  query AffiliateViewerCapabilities {
    affiliateViewerCapabilities {
      kind
      isTeamLead
      isRegionAdmin
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

/** The BDs a Creator may be assigned to (region admins, for a Creator wholly inside their scope). */
export const AFFILIATE_ASSIGNABLE_BUSINESS_DEVELOPERS_QUERY = gql`
  query AffiliateAssignableBusinessDevelopers($creatorRelationshipId: ID!) {
    affiliateAssignableBusinessDevelopers(creatorRelationshipId: $creatorRelationshipId) {
      id
      displayName
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
