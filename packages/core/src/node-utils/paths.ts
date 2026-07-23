import { join } from "node:path";
import { homedir } from "node:os";

/** Resolve the RivonClaw home directory. Defaults to ~/.rivonclaw. */
export function resolveRivonClawHome(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.RIVONCLAW_HOME?.trim() || join(homedir(), ".rivonclaw");
}

/** Resolve the SQLite database path. */
export function resolveDbPath(env: Record<string, string | undefined> = process.env): string {
  return env.RIVONCLAW_DB_PATH?.trim() || join(resolveRivonClawHome(env), "db.sqlite");
}

/** Resolve the log directory. */
export function resolveLogDir(env: Record<string, string | undefined> = process.env): string {
  return env.RIVONCLAW_LOG_DIR?.trim() || join(resolveRivonClawHome(env), "logs");
}

/** Resolve the secrets directory. */
export function resolveSecretsDir(env: Record<string, string | undefined> = process.env): string {
  return env.RIVONCLAW_SECRETS_DIR?.trim() || join(resolveRivonClawHome(env), "secrets");
}

/** Resolve the OpenClaw state directory. */
export function resolveOpenClawStateDir(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.OPENCLAW_STATE_DIR?.trim() || join(resolveRivonClawHome(env), "openclaw");
}

/** Resolve the OpenClaw config file path. */
export function resolveOpenClawConfigPath(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.OPENCLAW_CONFIG_PATH?.trim() || join(resolveOpenClawStateDir(env), "openclaw.json");
}

/** Resolve the media base directory (under OpenClaw state). */
export function resolveMediaDir(env: Record<string, string | undefined> = process.env): string {
  return join(resolveOpenClawStateDir(env), "media");
}

/** Resolve the Chrome CDP wrapper data directory. */
export function resolveCdpDataDir(env: Record<string, string | undefined> = process.env): string {
  return join(resolveRivonClawHome(env), "chrome-cdp");
}

/** Resolve the update-installing marker file path. */
export function resolveUpdateMarkerPath(
  env: Record<string, string | undefined> = process.env,
): string {
  return join(resolveRivonClawHome(env), "update-installing");
}

/** Resolve the proxy router config file path. */
export function resolveProxyRouterConfigPath(
  env: Record<string, string | undefined> = process.env,
): string {
  return join(resolveOpenClawStateDir(env), "proxy-router.json");
}

/** Resolve the heartbeat file path used for single-instance stale detection. */
export function resolveHeartbeatPath(
  env: Record<string, string | undefined> = process.env,
): string {
  return join(resolveRivonClawHome(env), "heartbeat.json");
}

/** Resolve the user-installed skills directory. */
export function resolveUserSkillsDir(
  env: Record<string, string | undefined> = process.env,
): string {
  return join(resolveOpenClawStateDir(env), "skills");
}

/** Resolve the credentials directory (channel pairing, mobile allow-lists). */
export function resolveCredentialsDir(
  env: Record<string, string | undefined> = process.env,
): string {
  return join(resolveOpenClawStateDir(env), "credentials");
}

/** Default agent ID used by the OpenClaw engine. */
export const DEFAULT_AGENT_ID = "main";

/** RivonClaw-managed agent dedicated to external customer-service sessions. */
export const CUSTOMER_SERVICE_AGENT_ID = "customer-service";

/** RivonClaw-managed agent dedicated to Affiliate creator-management sessions. */
export const AFFILIATE_AGENT_ID = "affiliate";

/** Official workflow skill installed only into the Affiliate agent workspace. */
export const AFFILIATE_WORKFLOW_SKILL_SLUG = "affiliate-workflow";

/** Resolve the dedicated Affiliate agent workspace. */
export function resolveAffiliateAgentWorkspaceDir(
  env: Record<string, string | undefined> = process.env,
): string {
  return join(resolveOpenClawStateDir(env), "workspace-affiliate");
}

/** Resolve the workspace-local skills directory for the Affiliate agent. */
export function resolveAffiliateAgentSkillsDir(
  env: Record<string, string | undefined> = process.env,
): string {
  return join(resolveAffiliateAgentWorkspaceDir(env), "skills");
}

/** Resolve the canonical Affiliate workflow skill root. */
export function resolveAffiliateWorkflowSkillDir(
  env: Record<string, string | undefined> = process.env,
): string {
  return join(resolveAffiliateAgentSkillsDir(env), AFFILIATE_WORKFLOW_SKILL_SLUG);
}

/** Resolve the main agent config directory (models.json, auth-profiles.json). */
export function resolveAgentConfigDir(
  env: Record<string, string | undefined> = process.env,
  agentId: string = DEFAULT_AGENT_ID,
): string {
  return join(resolveOpenClawStateDir(env), "agents", agentId, "agent");
}

/** Resolve the agent sessions directory (sessions.json). */
export function resolveAgentSessionsDir(
  env: Record<string, string | undefined> = process.env,
  agentId: string = DEFAULT_AGENT_ID,
): string {
  return join(resolveOpenClawStateDir(env), "agents", agentId, "sessions");
}
