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
  support: types.optional(types.maybeNull(UserSupportModel), null),
  agent: types.optional(types.maybeNull(UserAgentProfileModel), null),
});

export interface User extends Instance<typeof UserModel> {}
