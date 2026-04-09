import { types, type Instance } from "mobx-state-tree";

export const CsBridgeStatusModel = types.model("CsBridgeStatus", {
  state: types.optional(
    types.enumeration("CsBridgeState", ["connected", "disconnected", "reconnecting"]),
    "disconnected",
  ),
  reconnectAttempt: types.optional(types.number, 0),
});

export const RuntimeStatusStoreModel = types.model("RuntimeStatusStore", {
  csBridge: types.optional(CsBridgeStatusModel, {}),
});

export interface CsBridgeStatus extends Instance<typeof CsBridgeStatusModel> {}
export interface RuntimeStatusStore extends Instance<typeof RuntimeStatusStoreModel> {}
