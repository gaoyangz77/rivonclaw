import { GQL } from "@rivonclaw/core";

/**
 * Sub-account rules for the built-in Business Developer role (ADR 085).
 *
 * A business developer's login is created from the business developer itself
 * on the Affiliate Team & Channels page. The generic member editor therefore
 * never hands out that role, never edits or deletes a member holding it, and
 * never grants the BD workspace scope, whose only holder is that role. The
 * backend refuses all of these; the Panel does not offer them.
 */

type RoleKeyed = Pick<GQL.AccountRoleType, "systemKey">;
type MemberKeyed = Pick<GQL.AccountMember, "roleSystemKey">;

/** Whether the role is the built-in Business Developer role, matched by key, never by name. */
export function isBusinessDeveloperRole(role: RoleKeyed): boolean {
  return role.systemKey === GQL.AccountSystemRoleKey.BusinessDeveloper;
}

/** Whether the member is a business developer's login, administered from the Team page. */
export function isBusinessDeveloperMember(member: MemberKeyed): boolean {
  return member.roleSystemKey === GQL.AccountSystemRoleKey.BusinessDeveloper;
}

/** Roles an owner may assign through the sub-account form. */
export function assignableMemberRoles<T extends RoleKeyed>(roles: readonly T[]): T[] {
  return roles.filter((role) => !isBusinessDeveloperRole(role));
}

/** Scopes an owner may grant to a role in the role editor. */
export const GRANTABLE_ROLE_SCOPES: readonly GQL.PermissionScope[] = Object.values(
  GQL.PermissionScope,
).filter((scope) => scope !== GQL.PermissionScope.AffiliateBusinessDeveloper);
