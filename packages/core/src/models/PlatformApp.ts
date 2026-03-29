import { types, type Instance } from "mobx-state-tree";

export const PlatformAppModel = types.model("PlatformApp", {
  id: types.identifier,
  platform: types.string,
  market: types.string,
  status: types.string,
  label: types.string,
  apiBaseUrl: types.string,
  authLinkUrl: types.string,
});

export interface PlatformApp extends Instance<typeof PlatformAppModel> {}
