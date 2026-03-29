import { types, type Instance } from "mobx-state-tree";

export const ProviderKeyModel = types.model("ProviderKey", {
  id: types.identifier,
  provider: types.string,
  label: types.string,
  model: types.string,
  isDefault: types.boolean,
  proxyUrl: types.maybeNull(types.string),
  authType: types.optional(types.string, "api_key"),
  baseUrl: types.maybeNull(types.string),
  customProtocol: types.maybeNull(types.string),
  customModelsJson: types.maybeNull(types.string),
  inputModalities: types.maybeNull(types.array(types.string)),
  source: types.optional(types.string, "local"),
  createdAt: types.string,
  updatedAt: types.string,
});

export interface ProviderKey extends Instance<typeof ProviderKeyModel> {}
