import { GQL } from "@rivonclaw/core";

/**
 * What the signed-in Affiliate login may see and do in the Panel (ADR-112,
 * ADR-113).
 *
 * One value answers it for every Affiliate surface, so no page adds its own
 * "is this a team lead" condition. A staff login's answer comes from the
 * permissions its profiles hold (`VIEW`, `OPERATE`, `ALLOCATE`), never from the
 * role kind. Like `lib/permission-scope.ts` it shapes what the Panel offers, not
 * what the Backend allows: every refusal still comes from the Backend, and a
 * control is hidden here only because the Backend would refuse it.
 */

export type AffiliateCreatorDetailTab =
  | "profile"
  | "overview"
  | "samples"
  | "platform"
  | "conversation"
  | "activity";

export interface AffiliateAccess {
  /** Mirrors the Backend viewer kind; the Panel treats a supervisor and a BD through their scopes. */
  kind: GQL.AffiliateViewerKind;
  isTeamLead: boolean;
  isRegionAdmin: boolean;
  /**
   * `VIEW`: the work views (workbenches, conversations, proposals, escalations,
   * collaborations) and the Creator's contact routes. The union over both facets.
   */
  canView: boolean;
  /**
   * `OPERATE`: the daily work (decide proposals, review samples, send messages,
   * tag, edit contacts, escalate and answer). The union over both facets; the
   * per-row flags the Backend returns (`viewerCanApprove`,
   * `viewerCanPerformDailyOperations`) still decide each row, because a facet
   * operates only inside its own reach.
   */
  canOperate: boolean;
  /**
   * `ALLOCATE`: assign, reassign and release Creators, offered as the staff
   * allocation control. False for a supervisor or BD, who own Creators through
   * the owner selector of their own pages.
   */
  canAllocate: boolean;
  /**
   * Collaboration management (create, configure, edit, remove). Admin-only for
   * every permission set (ADR-113), so false for any staff login.
   */
  canManageCollaborations: boolean;
  /**
   * Creator detail tabs whose queries the Backend serves this login, or null for
   * every tab. Without `VIEW` a profile reads the profile, samples and activity
   * only (the base Creator read every live profile has).
   */
  creatorDetailTabs: readonly AffiliateCreatorDetailTab[] | null;
  /** Whether the Creator's contact routes may be read. */
  canReadCreatorContacts: boolean;
}

/** Supervisors and BDs: nothing is hidden on their behalf by this value. */
export const AFFILIATE_FULL_ACCESS: AffiliateAccess = {
  kind: GQL.AffiliateViewerKind.Supervisor,
  isTeamLead: false,
  isRegionAdmin: false,
  canView: true,
  canOperate: true,
  canAllocate: false,
  canManageCollaborations: true,
  creatorDetailTabs: null,
  canReadCreatorContacts: true,
};

export type AffiliateStaffSurface = "WORKBENCH" | "HISTORY" | "CREATORS";

const BASE_CREATOR_DETAIL_TABS: readonly AffiliateCreatorDetailTab[] = [
  "profile",
  "samples",
  "activity",
];

type AffiliateViewerCapabilitiesFacts = Pick<
  GQL.AffiliateViewerCapabilities,
  "kind" | "isTeamLead" | "isRegionAdmin" | "teamLeadPermissions" | "regionAdminPermissions"
>;

/**
 * The access of a staff login from its capabilities. Null when the login holds
 * the scope but has no profile yet: the Backend serves such a login nothing.
 * A capability that is not staff (a role the Panel read through its scopes)
 * carries no restriction here.
 */
export function resolveAffiliateStaffAccess(
  capabilities: AffiliateViewerCapabilitiesFacts,
): AffiliateAccess | null {
  if (capabilities.kind !== GQL.AffiliateViewerKind.Staff) return AFFILIATE_FULL_ACCESS;
  const { isTeamLead, isRegionAdmin } = capabilities;
  if (!isTeamLead && !isRegionAdmin) return null;
  // The Backend returns an empty list for a facet the login does not hold, so the
  // union needs no facet check of its own.
  const holds = (permission: GQL.AffiliateStaffPermission) =>
    capabilities.teamLeadPermissions.includes(permission) ||
    capabilities.regionAdminPermissions.includes(permission);
  const canView = holds(GQL.AffiliateStaffPermission.View);
  return {
    kind: GQL.AffiliateViewerKind.Staff,
    isTeamLead,
    isRegionAdmin,
    canView,
    canOperate: holds(GQL.AffiliateStaffPermission.Operate),
    canAllocate: holds(GQL.AffiliateStaffPermission.Allocate),
    canManageCollaborations: false,
    creatorDetailTabs: canView ? null : BASE_CREATOR_DETAIL_TABS,
    canReadCreatorContacts: canView,
  };
}

/** Whether a login with this access may open the surface at all. */
export function affiliateAccessMaySeeSurface(
  access: AffiliateAccess,
  surface: AffiliateStaffSurface,
): boolean {
  if (access.kind !== GQL.AffiliateViewerKind.Staff) return true;
  // The Creator list is the base read of every live profile; the work views need `VIEW`.
  return surface === "CREATORS" ? true : access.canView;
}

/**
 * The `ecommerce.affiliateStaff` key that tells a staff login what its profile
 * may do, from the permissions it holds: view only, view and operate, allocate,
 * or a combination. `OPERATE` always implies `VIEW`, so the wording never offers
 * "operate" without "view". Null for a supervisor or BD, who get no notice.
 */
export function affiliateStaffNoticeKey(access: AffiliateAccess): string | null {
  if (access.kind !== GQL.AffiliateViewerKind.Staff) return null;
  const work = access.canOperate ? "ViewOperate" : access.canView ? "View" : "";
  const allocate = access.canAllocate ? "Allocate" : "";
  return work || allocate ? `notice${work}${allocate}` : "noticeCreatorsOnly";
}

/** Whether a Creator detail tab is available to this access. */
export function affiliateAccessMaySeeCreatorTab(
  access: AffiliateAccess,
  tab: AffiliateCreatorDetailTab,
): boolean {
  return access.creatorDetailTabs === null || access.creatorDetailTabs.includes(tab);
}

/**
 * The tab a Creator detail opens on: the requested one when this access may
 * see it, otherwise the first one it may.
 */
export function affiliateAccessCreatorTab(
  access: AffiliateAccess,
  requested: AffiliateCreatorDetailTab,
): AffiliateCreatorDetailTab {
  if (affiliateAccessMaySeeCreatorTab(access, requested)) return requested;
  return access.creatorDetailTabs?.[0] ?? requested;
}
