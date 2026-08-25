import { types, type Instance } from "mobx-state-tree";

const UserSupportModel = types.model("UserSupport", {
  telegramDebugProxyToken: types.maybeNull(types.string),
});

const UserAgentProfileModel = types.model("UserAgentProfile", {
  active: types.optional(types.boolean, false),
  inviteCode: types.maybeNull(types.string),
  enabledAt: types.maybeNull(types.string),
  enabledByUserId: types.maybeNull(types.string),
  disabledAt: types.maybeNull(types.string),
  disabledByUserId: types.maybeNull(types.string),
});

export const UserModel = types.model("User", {
  userId: types.identifier,
  email: types.string,
  name: types.maybeNull(types.string),
  createdAt: types.string,
  enrolledModules: types.optional(types.array(types.string), []),
  entitlementKeys: types.optional(types.array(types.string), []),
  defaultRunProfileId: types.maybeNull(types.string),
  /** Main account this user belongs to. Equals userId for a main account. */
  accountId: types.optional(types.string, ""),
  /**
   * Whether this user is a main account rather than a member of one.
   *
   * Defaults to `true` on purpose: an older Desktop, or a snapshot written
   * before permission scopes existed, carries no value here. Defaulting to
   * `false` would silently hide every scoped menu from a main account, so the
   * absent value must mean "unrestricted owner".
   */
  isOwner: types.optional(types.boolean, true),
  /** Sections this user may open, after intersecting the role grant with account entitlements. */
  permissionScopes: types.optional(types.array(types.string), []),
  /** Role name for a member account; null for a main account. */
  roleName: types.maybeNull(types.string),
  support: types.optional(types.maybeNull(UserSupportModel), null),
  agent: types.optional(types.maybeNull(UserAgentProfileModel), null),
});

export interface User extends Instance<typeof UserModel> {}
