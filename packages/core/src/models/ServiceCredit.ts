import { types, type Instance } from "mobx-state-tree";

export const ServiceCreditModel = types.model("ServiceCredit", {
  id: types.identifier,
  service: types.string,
  quota: types.integer,
  status: types.string,
  expiresAt: types.string,
  source: types.string,
});

export interface ServiceCredit extends Instance<typeof ServiceCreditModel> {}
