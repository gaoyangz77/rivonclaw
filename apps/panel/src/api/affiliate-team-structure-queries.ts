import { gql } from "@apollo/client/core";

/**
 * Admin-side team structure (ADR-112): the team-lead tree, region admin
 * profiles with the permissions each holds (ADR-113), and the members an admin
 * may bind a profile to. Every operation
 * here is admin-only on the Backend.
 */

export const AFFILIATE_TEAM_LEAD_PROFILE_FIELDS_FRAGMENT = gql`
  fragment AffiliateTeamLeadProfileFields on AffiliateTeamLeadProfile {
    id
    memberUserId
    displayName
    parentLeadId
    permissions
    archivedAt
  }
`;

export const AFFILIATE_REGION_ADMIN_PROFILE_FIELDS_FRAGMENT = gql`
  fragment AffiliateRegionAdminProfileFields on AffiliateRegionAdminProfile {
    id
    memberUserId
    displayName
    regions
    shopIds
    permissions
    archivedAt
  }
`;

export const AFFILIATE_TEAM_STRUCTURE_FIELDS_FRAGMENT = gql`
  ${AFFILIATE_TEAM_LEAD_PROFILE_FIELDS_FRAGMENT}
  ${AFFILIATE_REGION_ADMIN_PROFILE_FIELDS_FRAGMENT}
  fragment AffiliateTeamStructureFields on AffiliateTeamStructure {
    teamLeads {
      ...AffiliateTeamLeadProfileFields
    }
    regionAdmins {
      ...AffiliateRegionAdminProfileFields
    }
    businessDevelopers {
      id
      displayName
      parentLeadId
    }
    eligibleTeamLeadMembers {
      userId
      email
      name
      profileId
    }
    eligibleRegionAdminMembers {
      userId
      email
      name
      profileId
    }
  }
`;

export const AFFILIATE_TEAM_STRUCTURE_QUERY = gql`
  ${AFFILIATE_TEAM_STRUCTURE_FIELDS_FRAGMENT}
  query AffiliateTeamStructure {
    affiliateTeamStructure {
      ...AffiliateTeamStructureFields
    }
  }
`;

export const WRITE_AFFILIATE_TEAM_LEAD_MUTATION = gql`
  ${AFFILIATE_TEAM_LEAD_PROFILE_FIELDS_FRAGMENT}
  mutation WriteAffiliateTeamLead($input: WriteAffiliateTeamLeadInput!) {
    writeAffiliateTeamLead(input: $input) {
      ...AffiliateTeamLeadProfileFields
    }
  }
`;

export const ARCHIVE_AFFILIATE_TEAM_LEAD_MUTATION = gql`
  ${AFFILIATE_TEAM_LEAD_PROFILE_FIELDS_FRAGMENT}
  mutation ArchiveAffiliateTeamLead($id: ID!) {
    archiveAffiliateTeamLead(id: $id) {
      ...AffiliateTeamLeadProfileFields
    }
  }
`;

export const WRITE_AFFILIATE_REGION_ADMIN_MUTATION = gql`
  ${AFFILIATE_REGION_ADMIN_PROFILE_FIELDS_FRAGMENT}
  mutation WriteAffiliateRegionAdmin($input: WriteAffiliateRegionAdminInput!) {
    writeAffiliateRegionAdmin(input: $input) {
      ...AffiliateRegionAdminProfileFields
    }
  }
`;

export const ARCHIVE_AFFILIATE_REGION_ADMIN_MUTATION = gql`
  ${AFFILIATE_REGION_ADMIN_PROFILE_FIELDS_FRAGMENT}
  mutation ArchiveAffiliateRegionAdmin($id: ID!) {
    archiveAffiliateRegionAdmin(id: $id) {
      ...AffiliateRegionAdminProfileFields
    }
  }
`;

export const SET_AFFILIATE_TEAM_PARENT_MUTATION = gql`
  ${AFFILIATE_TEAM_STRUCTURE_FIELDS_FRAGMENT}
  mutation SetAffiliateTeamParent($input: SetAffiliateTeamParentInput!) {
    setAffiliateTeamParent(input: $input) {
      ...AffiliateTeamStructureFields
    }
  }
`;
