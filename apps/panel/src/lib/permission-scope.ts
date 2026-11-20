import { GQL } from "@rivonclaw/core";

/**
 * Menu-level permission gating.
 *
 * This is job separation, not a security boundary: it decides which nav items
 * a member account sees, nothing more. Route resolution and page rendering are
 * deliberately left untouched.
 */

export interface ScopedRoute {
  /**
   * Scopes that each unlock this route: holding ANY one of them is enough.
   * Absent = base page, visible to every account.
   */
  scopes?: readonly string[];
}

export interface ScopeHolder {
  /** Main accounts are unrestricted. */
  isOwner: boolean;
  /** Effective scopes: role grant intersected with account entitlements. */
  permissionScopes: readonly string[];
}

/** Whether the given user may see this route in the sidebar. */
export function canSeeRoute(route: ScopedRoute, user: ScopeHolder | null): boolean {
  // Signed out: unchanged behavior. `authRequired` already prompts for login.
  if (!user) return true;
  if (user.isOwner) return true;
  if (!route.scopes) return true;
  return route.scopes.some((scope) => user.permissionScopes.includes(scope));
}

/**
 * Whether the user works in the business developer (BD) workspace only
 * (ADR 085): a member holding AFFILIATE_BUSINESS_DEVELOPER without the full
 * AFFILIATE scope. Such a member sees a reduced Affiliate section — the
 * Analytics Details tab only and read-only Product Knowledge.
 *
 * Owners hold both scopes and are never BD-only; signed-out users are not
 * either. Like `canSeeRoute`, this shapes what the Panel offers, not what the
 * backend allows.
 */
export function isBusinessDeveloperOnly(user: ScopeHolder | null | undefined): boolean {
  if (!user || user.isOwner) return false;
  return (
    user.permissionScopes.includes(GQL.PermissionScope.AffiliateBusinessDeveloper) &&
    !user.permissionScopes.includes(GQL.PermissionScope.Affiliate)
  );
}

/**
 * Whether the user signs in to Affiliate as staff only (ADR-112): a member
 * whose role holds the team lead and/or region admin scope and nothing that
 * makes them a supervisor or a BD. Staff read (team lead) or allocate (region
 * admin); the Panel hides every daily-work control for them.
 *
 * The scopes only say which pages may open. Which facet the login really has
 * comes from its Affiliate-side profile, read through
 * `affiliateViewerCapabilities`; a scope without a profile sees nothing.
 */
export function isAffiliateStaffOnly(user: ScopeHolder | null | undefined): boolean {
  if (!user || user.isOwner) return false;
  const scopes = user.permissionScopes ?? [];
  return (
    (scopes.includes(GQL.PermissionScope.AffiliateTeamLead) ||
      scopes.includes(GQL.PermissionScope.AffiliateRegionAdmin)) &&
    !scopes.includes(GQL.PermissionScope.Affiliate) &&
    !scopes.includes(GQL.PermissionScope.AffiliateBusinessDeveloper)
  );
}
