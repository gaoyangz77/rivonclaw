export { OpenClawConnector } from "./openclaw-connector.js";
export type {
  ConfigMutationPolicy,
  RpcConnectionDeps,
  OpenClawConnectorDeps,
  RpcConnectedCallback,
} from "./openclaw-connector.js";

/** Singleton connector instance for the Desktop process. */
import { OpenClawConnector } from "./openclaw-connector.js";
export const openClawConnector = new OpenClawConnector();
