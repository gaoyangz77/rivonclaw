/**
 * Pure rules for the admin team-structure editor (ADR-112, ADR-113): the
 * hierarchy tree, parent-picker candidates, eligible-member filtering, the
 * permission sets of the profiles and the refusal codes the Backend can return. Everything works on plain objects read from the
 * query result; nothing here touches React or the entity store.
 */
import { GQL } from "@rivonclaw/core";
import { graphQLErrorCode } from "../../lib/graphql-error-code.js";

export type TeamLeadProfile = Pick<
  GQL.AffiliateTeamLeadProfile,
  "id" | "memberUserId" | "displayName" | "parentLeadId" | "permissions" | "archivedAt"
>;
export type RegionAdminProfile = Pick<
  GQL.AffiliateRegionAdminProfile,
  "id" | "memberUserId" | "displayName" | "regions" | "shopIds" | "permissions" | "archivedAt"
>;
export type TeamBusinessDeveloper = Pick<
  GQL.AffiliateTeamBusinessDeveloper,
  "id" | "displayName" | "parentLeadId"
>;
export type EligibleMember = Pick<
  GQL.AffiliateTeamEligibleMember,
  "userId" | "email" | "name" | "profileId"
>;

/** The `affiliateTeamStructure` query result, as the editor reads it. */
export interface TeamStructure {
  teamLeads: TeamLeadProfile[];
  regionAdmins: RegionAdminProfile[];
  businessDevelopers: TeamBusinessDeveloper[];
  eligibleTeamLeadMembers: EligibleMember[];
  eligibleRegionAdminMembers: EligibleMember[];
}

export interface TeamTreeLead {
  lead: TeamLeadProfile;
  childLeads: TeamTreeLead[];
  businessDevelopers: TeamBusinessDeveloper[];
  /**
   * Set on a lead that only became a root because the stored structure already
   * holds a cycle. The Backend refuses new cycles, so this marks bad data that
   * an admin has to see rather than a node to hide.
   */
  inCycle: boolean;
}

export interface TeamTree {
  roots: TeamTreeLead[];
  /** BDs with no parent, or whose parent lead is archived or unknown. */
  unparentedBusinessDevelopers: TeamBusinessDeveloper[];
  archivedLeads: TeamLeadProfile[];
}

/** What a staff profile may do inside its reach (ADR-113), in the order the editor lists them. */
export const AFFILIATE_STAFF_PERMISSIONS: readonly GQL.AffiliateStaffPermission[] = [
  GQL.AffiliateStaffPermission.View,
  GQL.AffiliateStaffPermission.Operate,
  GQL.AffiliateStaffPermission.Allocate,
  GQL.AffiliateStaffPermission.Campaign,
];

export type StaffProfileRole = "TEAM_LEAD" | "REGION_ADMIN";

/**
 * The permissions the editor offers a profile of this role. `CAMPAIGN` (ADR-118)
 * belongs to region admins only: the Backend refuses it on a team lead profile,
 * so the editor never offers it there.
 */
export function staffPermissionsForRole(role: StaffProfileRole): GQL.AffiliateStaffPermission[] {
  return AFFILIATE_STAFF_PERMISSIONS.filter(
    (permission) =>
      role === "REGION_ADMIN" || permission !== GQL.AffiliateStaffPermission.Campaign,
  );
}

/**
 * The permissions a new profile of this role starts with. They are the Backend's
 * role defaults, so a profile the admin saves untouched behaves like one created
 * without a permission list.
 */
export function defaultStaffPermissions(
  role: StaffProfileRole,
): GQL.AffiliateStaffPermission[] {
  return role === "TEAM_LEAD"
    ? [GQL.AffiliateStaffPermission.View]
    : [GQL.AffiliateStaffPermission.Allocate];
}

/**
 * The set after one checkbox changed. `OPERATE` implies `VIEW`: ticking it ticks
 * `VIEW`, and unticking `VIEW` unticks `OPERATE`, so the draft is never a set
 * the Backend would refuse.
 */
export function toggleStaffPermission(
  current: readonly GQL.AffiliateStaffPermission[],
  permission: GQL.AffiliateStaffPermission,
  checked: boolean,
): GQL.AffiliateStaffPermission[] {
  const next = new Set(current);
  if (checked) {
    next.add(permission);
    if (permission === GQL.AffiliateStaffPermission.Operate) {
      next.add(GQL.AffiliateStaffPermission.View);
    }
  } else {
    next.delete(permission);
    if (permission === GQL.AffiliateStaffPermission.View) {
      next.delete(GQL.AffiliateStaffPermission.Operate);
    }
  }
  return AFFILIATE_STAFF_PERMISSIONS.filter((candidate) => next.has(candidate));
}

/** Whether two permission lists name the same set, whatever their order. */
export function sameStaffPermissions(
  a: readonly GQL.AffiliateStaffPermission[],
  b: readonly GQL.AffiliateStaffPermission[],
): boolean {
  return a.length === b.length && a.every((permission) => b.includes(permission));
}

function byDisplayName<T extends { displayName: string }>(a: T, b: T): number {
  return a.displayName.localeCompare(b.displayName);
}

export function liveTeamLeads(structure: Pick<TeamStructure, "teamLeads">): TeamLeadProfile[] {
  return structure.teamLeads.filter((lead) => !lead.archivedAt);
}

/** A parent id that names a live lead; an archived or unknown parent means "no parent". */
export function liveParentLeadId(
  parentLeadId: string | null | undefined,
  liveLeadIds: ReadonlySet<string>,
): string | null {
  return parentLeadId && liveLeadIds.has(parentLeadId) ? parentLeadId : null;
}

export function buildTeamTree(
  structure: Pick<TeamStructure, "teamLeads" | "businessDevelopers">,
): TeamTree {
  const live = liveTeamLeads(structure);
  const liveIds = new Set(live.map((lead) => lead.id));
  const childLeadsOf = new Map<string, TeamLeadProfile[]>();
  const businessDevelopersOf = new Map<string, TeamBusinessDeveloper[]>();
  const rootLeads: TeamLeadProfile[] = [];
  for (const lead of live) {
    const parentId = liveParentLeadId(lead.parentLeadId, liveIds);
    if (!parentId) rootLeads.push(lead);
    else childLeadsOf.set(parentId, [...(childLeadsOf.get(parentId) ?? []), lead]);
  }
  const unparentedBusinessDevelopers: TeamBusinessDeveloper[] = [];
  for (const developer of structure.businessDevelopers) {
    const parentId = liveParentLeadId(developer.parentLeadId, liveIds);
    if (!parentId) unparentedBusinessDevelopers.push(developer);
    else
      businessDevelopersOf.set(parentId, [
        ...(businessDevelopersOf.get(parentId) ?? []),
        developer,
      ]);
  }

  const visited = new Set<string>();
  const build = (lead: TeamLeadProfile, inCycle: boolean): TeamTreeLead => {
    visited.add(lead.id);
    return {
      lead,
      inCycle,
      childLeads: (childLeadsOf.get(lead.id) ?? [])
        .filter((child) => !visited.has(child.id))
        .sort(byDisplayName)
        .map((child) => build(child, false)),
      businessDevelopers: [...(businessDevelopersOf.get(lead.id) ?? [])].sort(byDisplayName),
    };
  };
  const roots = [...rootLeads].sort(byDisplayName).map((lead) => build(lead, false));
  // Leads that no root reaches sit on a stored cycle. Surface each as a flagged root.
  for (const lead of [...live].sort(byDisplayName)) {
    if (!visited.has(lead.id)) roots.push(build(lead, true));
  }

  return {
    roots,
    unparentedBusinessDevelopers: unparentedBusinessDevelopers.sort(byDisplayName),
    archivedLeads: structure.teamLeads.filter((lead) => lead.archivedAt).sort(byDisplayName),
  };
}

/** Ids of every live lead below `leadId` (children, grandchildren, ...). */
export function descendantLeadIds(
  structure: Pick<TeamStructure, "teamLeads">,
  leadId: string,
): Set<string> {
  const live = liveTeamLeads(structure);
  const liveIds = new Set(live.map((lead) => lead.id));
  const result = new Set<string>();
  const queue = [leadId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const lead of live) {
      if (liveParentLeadId(lead.parentLeadId, liveIds) === current && !result.has(lead.id)) {
        result.add(lead.id);
        queue.push(lead.id);
      }
    }
  }
  return result;
}

/**
 * The leads a node may report to: every live lead, except the node itself and
 * (for a lead) its descendants. The Backend refuses a cycle regardless; this
 * keeps the picker from offering one.
 */
export function parentLeadCandidates(
  structure: Pick<TeamStructure, "teamLeads">,
  subject: { kind: "BUSINESS_DEVELOPER" } | { kind: "TEAM_LEAD"; id: string },
): TeamLeadProfile[] {
  const excluded =
    subject.kind === "TEAM_LEAD"
      ? new Set([subject.id, ...descendantLeadIds(structure, subject.id)])
      : new Set<string>();
  return liveTeamLeads(structure)
    .filter((lead) => !excluded.has(lead.id))
    .sort(byDisplayName);
}

/** Members an admin may still bind: eligible and not already carrying a live profile. */
export function unboundEligibleMembers(members: readonly EligibleMember[]): EligibleMember[] {
  return members.filter((member) => !member.profileId);
}

/**
 * The display name a new profile's draft holds after a member is picked.
 *
 * The member's own name fills the field while the admin has not typed one of
 * their own: an empty draft, or the name the previous pick filled in. A name
 * the admin typed is never overwritten, and a member without a name leaves the
 * draft as it was.
 */
export function displayNameAfterMemberPick(
  draft: string,
  previous: Pick<EligibleMember, "name"> | undefined,
  next: Pick<EligibleMember, "name"> | undefined,
): string {
  const suggested = next?.name?.trim();
  if (!suggested) return draft;
  const untouched = draft.trim() === "" || draft === (previous?.name?.trim() ?? "");
  return untouched ? suggested : draft;
}

export function memberLabel(member: Pick<EligibleMember, "email" | "name">): string {
  return member.name ? `${member.name} (${member.email})` : member.email;
}

const TEAM_STRUCTURE_ERROR_KEYS: Record<string, string> = {
  AFFILIATE_TEAM_MEMBER_INVALID: "ecommerce.affiliateTeam.teamStructureErrorMemberInvalid",
  AFFILIATE_TEAM_PROFILE_EXISTS: "ecommerce.affiliateTeam.teamStructureErrorProfileExists",
  AFFILIATE_TEAM_PROFILE_NOT_FOUND: "ecommerce.affiliateTeam.teamStructureErrorProfileNotFound",
  AFFILIATE_TEAM_PROFILE_ARCHIVED: "ecommerce.affiliateTeam.teamStructureErrorProfileArchived",
  AFFILIATE_TEAM_BUSINESS_DEVELOPER_NOT_FOUND:
    "ecommerce.affiliateTeam.teamStructureErrorBusinessDeveloperNotFound",
  AFFILIATE_TEAM_PARENT_INVALID: "ecommerce.affiliateTeam.teamStructureErrorParentInvalid",
  AFFILIATE_TEAM_PARENT_CYCLE: "ecommerce.affiliateTeam.teamStructureErrorParentCycle",
  AFFILIATE_TEAM_SHOP_NOT_FOUND: "ecommerce.affiliateTeam.teamStructureErrorShopNotFound",
  AFFILIATE_TEAM_INPUT_INVALID: "ecommerce.affiliateTeam.teamStructureErrorInputInvalid",
};

/**
 * The translation key explaining a team-structure refusal, or null when the
 * error is anything else and the caller should keep its own message.
 */
export function teamStructureErrorKey(error: unknown): string | null {
  const code = graphQLErrorCode(error);
  return code ? (TEAM_STRUCTURE_ERROR_KEYS[code] ?? null) : null;
}
