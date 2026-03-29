import { types, type Instance } from "mobx-state-tree";

const LlmKeyModel = types.model("LlmKey", {
  key: types.string,
  suspendedUntil: types.maybeNull(types.string),
});

export const UserModel = types.model("User", {
  userId: types.identifier,
  email: types.string,
  name: types.maybeNull(types.string),
  plan: types.string,
  createdAt: types.string,
  enrolledModules: types.optional(types.array(types.string), []),
  entitlementKeys: types.optional(types.array(types.string), []),
  defaultRunProfileId: types.maybeNull(types.string),
  llmKey: types.maybeNull(LlmKeyModel),
});

export interface User extends Instance<typeof UserModel> {}
