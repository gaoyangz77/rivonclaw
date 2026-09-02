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
  CUSTOMER_SERVICE_AGENT_ID,
  AFFILIATE_AGENT_ID,
  AFFILIATE_WORKFLOW_SKILL_SLUG,
  resolveAgentWorkspaceBaseDir,
  resolveMainAgentWorkspaceDir,
  resolveAffiliateAgentWorkspaceDir,
  resolveAffiliateAgentSkillsDir,
  resolveAffiliateWorkflowSkillDir,
  resolveAgentConfigDir,
  resolveAgentSessionsDir,
} from "./node-utils/paths.js";
export {
  AFFILIATE_MAX_CONCURRENT_ENV,
  CS_MAX_CONCURRENT_ENV,
  DEFAULT_AFFILIATE_MAX_CONCURRENT,
  DEFAULT_CS_MAX_CONCURRENT,
  DEFAULT_SHOP_OPERATIONS_MAX_CONCURRENT,
  SHOP_OPERATIONS_MAX_CONCURRENT_ENV,
  resolveConcurrency,
} from "./node-utils/agent-concurrency.js";
