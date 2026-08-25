/**
 * Menu-level permission gating.
 *
 * This is job separation, not a security boundary: it decides which nav items
 * a member account sees, nothing more. Route resolution and page rendering are
 * deliberately left untouched.
 */

export interface ScopedRoute {
  /** Absent = base page, visible to every account. */
  scope?: string;
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
  if (!route.scope) return true;
  return user.permissionScopes.includes(route.scope);
}
