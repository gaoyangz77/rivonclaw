import { GQL } from "@rivonclaw/core";

/**
 * What the signed-in Affiliate login may see and do in the Panel (ADR-112).
 *
 * One value answers it for every Affiliate surface, so no page adds its own
 * "is this a team lead" condition. Like `lib/permission-scope.ts` it shapes what
 * the Panel offers, not what the Backend allows: every refusal still comes from
 * the Backend, and a control is hidden here only because the Backend would
 * refuse it.
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
   * Daily work is refused: decisions on proposals, messages, sample reviews,
   * escalation answers, tags, notes, claims and every collaboration change.
   * True for every staff login. Region admin allocation is the one write staff
   * have, and `canAllocate` carries it.
   */
  readOnly: boolean;
  /** Region admin: assign, reassign and release the Creators of the granted shops. */
  canAllocate: boolean;
  /**
   * Creator detail tabs whose queries the Backend serves this login, or null for
   * every tab. A region admin reads the profile, samples and activity only.
   */
  creatorDetailTabs: readonly AffiliateCreatorDetailTab[] | null;
  /** Whether the Creator's contact routes may be read (a region admin may not). */
  canReadCreatorContacts: boolean;
}

/** Supervisors and BDs: nothing is hidden on their behalf by this value. */
export const AFFILIATE_FULL_ACCESS: AffiliateAccess = {
  kind: GQL.AffiliateViewerKind.Supervisor,
  isTeamLead: false,
  isRegionAdmin: false,
  readOnly: false,
  canAllocate: false,
  creatorDetailTabs: null,
  canReadCreatorContacts: true,
};

export type AffiliateStaffSurface = "WORKBENCH" | "HISTORY" | "CREATORS";

const REGION_ADMIN_DETAIL_TABS: readonly AffiliateCreatorDetailTab[] = [
  "profile",
  "samples",
  "activity",
];

/**
 * The access of a staff login from its capabilities. Null when the login holds
 * the scope but has no profile yet: the Backend serves such a login nothing.
 * A capability that is not staff (a role the Panel read through its scopes)
 * carries no restriction here.
 */
export function resolveAffiliateStaffAccess(
  capabilities: Pick<GQL.AffiliateViewerCapabilities, "kind" | "isTeamLead" | "isRegionAdmin">,
): AffiliateAccess | null {
  if (capabilities.kind !== GQL.AffiliateViewerKind.Staff) return AFFILIATE_FULL_ACCESS;
  const { isTeamLead, isRegionAdmin } = capabilities;
  if (!isTeamLead && !isRegionAdmin) return null;
  return {
    kind: GQL.AffiliateViewerKind.Staff,
    isTeamLead,
    isRegionAdmin,
    readOnly: true,
    canAllocate: isRegionAdmin,
    // Reads are the union of both facets: the team lead facet reads every tab.
    creatorDetailTabs: isTeamLead ? null : REGION_ADMIN_DETAIL_TABS,
    canReadCreatorContacts: isTeamLead,
  };
}

/** Whether a login with this access may open the surface at all. */
export function affiliateAccessMaySeeSurface(
  access: AffiliateAccess,
  surface: AffiliateStaffSurface,
): boolean {
  if (access.kind !== GQL.AffiliateViewerKind.Staff) return true;
  return surface === "CREATORS" ? access.isTeamLead || access.isRegionAdmin : access.isTeamLead;
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

/**
 * Whether every shop of a Creator is in the viewer's shop list. A region admin
 * may allocate a Creator only when all of its shops are in scope, and a Creator
 * with no shop stays with the admins. The shop list a region admin reads is
 * already limited to their scope; the Backend remains the authority and its
 * refusal is shown if this guess is wrong.
 */
export function creatorWithinShopScope(
  creatorShopIds: readonly string[],
  scopeShopIds: ReadonlySet<string>,
): boolean {
  return creatorShopIds.length > 0 && creatorShopIds.every((shopId) => scopeShopIds.has(shopId));
}
