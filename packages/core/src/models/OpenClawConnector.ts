import { types, type Instance } from "mobx-state-tree";

export const SidecarState = types.enumeration("SidecarState", [
  "unknown", "probing", "ready", "failed",
]);

export const GatewayProcessState = types.enumeration("GatewayProcessState", [
  "stopped", "starting", "running", "stopping",
]);

export const OpenClawConnectorModel = types.model("OpenClawConnector", {
  processState: types.optional(GatewayProcessState, "stopped"),
  rpcConnected: types.optional(types.boolean, false),
  sidecarState: types.optional(SidecarState, "unknown"),
  restartAttempt: types.optional(types.number, 0),
  lastError: types.optional(types.string, ""),
});

export interface OpenClawConnector extends Instance<typeof OpenClawConnectorModel> {}
