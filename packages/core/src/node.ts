// Node.js-specific entry point.
// Re-exports everything from the main entry plus path resolvers
// that depend on node:path and node:os.

export * from "./index.js";

export { findFreePort } from "./node-utils/find-free-port.js";

export {
  resolveRivonClawHome,
  resolveDbPath,
  resolveLogDir,
  resolveSecretsDir,
  resolveOpenClawStateDir,
  resolveOpenClawConfigPath,
  resolveMediaDir,
  resolveCdpDataDir,
  resolveUpdateMarkerPath,
  resolveHeartbeatPath,
  resolveProxyRouterConfigPath,
  resolveUserSkillsDir,
  resolveCredentialsDir,
  DEFAULT_AGENT_ID,
  resolveAgentConfigDir,
  resolveAgentSessionsDir,
  resolveSessionStateDir,
} from "./node-utils/paths.js";
