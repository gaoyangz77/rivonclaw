import { types, type Instance } from "mobx-state-tree";

export const RunProfileModel = types.model("RunProfile", {
  id: types.identifier,
  name: types.string,
  selectedToolIds: types.optional(types.array(types.string), []),
  surfaceId: types.optional(types.string, ""),
  userId: types.optional(types.string, ""),
});

export interface RunProfile extends Instance<typeof RunProfileModel> {}
