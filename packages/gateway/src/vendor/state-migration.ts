import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createLogger } from "@rivonclaw/logger";

const log = createLogger("gateway:vendor-state-migration");

export interface VendorStateMigrationOptions {
  configPath?: string;
  stateDir: string;
  vendorDir: string;
}

export interface VendorStateMigrationInspection {
  required: boolean;
  reasons: string[];
  targetAgentSchemaVersion: number;
}

type VendorSqliteRuntime = {
  ensureOpenClawAgentDatabaseSchema: (
    database: DatabaseSync,
    options: { agentId: string; path: string; env: NodeJS.ProcessEnv },
  ) => void;
};

type VendorNodeHostRuntime = {
  detectLegacyWorkspaceState: (options: {
    cfg: Record<string, unknown>;
    doctorOnlyStateMigrations: true;
    env: NodeJS.ProcessEnv;
    stateDir: string;
  }) => VendorWorkspaceStateDetection;
  migrateLegacyWorkspaceState: (options: {
    detected: VendorWorkspaceStateDetection;
    env: NodeJS.ProcessEnv;
    stateDir: string;
  }) => Promise<VendorMigrationMessages>;
  runStartupMigrations: (options: {
    env: NodeJS.ProcessEnv;
    log: { info: (message: string) => void; warn: (message: string) => void };
  }) => Promise<void>;
};

type VendorWorkspaceStateSource = {
  workspaceDir?: string;
};

type VendorWorkspaceStateDetection = {
  hasLegacy: boolean;
  sources: VendorWorkspaceStateSource[];
};

type VendorMigrationMessages = {
  changes: string[];
  notices?: string[];
  warnings: string[];
};

type AgentDatabaseTarget = {
  agentId: string;
  databasePath: string;
};

type OpenClawChannelConfig = {
  accounts?: Record<string, unknown>;
  defaultAccount?: unknown;
};

type OpenClawConfig = {
  bindings?: Array<{ match?: { accountId?: unknown; channel?: unknown } }>;
  channels?: Record<string, OpenClawChannelConfig>;
};

export interface RestoredFeishuAllowFromFile {
  accountId: string;
  path: string;
  recipientIds: string[];
}

const LEGACY_ALLOW_FROM_SUFFIX = "-allowFrom.json";
const LEGACY_DEVICE_IDENTITY_RELATIVE_PATH = join("identity", "device.json");
const LEGACY_DEVICE_IDENTITY_CLAIM_SUFFIXES = [
  "",
  ".doctor-importing",
  ".native-importing",
] as const;
const LEGACY_DEVICE_IDENTITY_MIGRATION_KIND = "legacy-device-identity-json";
const FEISHU_CHANNEL_ID = "feishu";
const FEISHU_OPEN_ID_PATTERN = /^ou_[A-Za-z0-9_-]+$/;

function safePairingKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value.trim().toLowerCase();
  if (!raw || raw === "*") return undefined;
  const safe = raw.replace(/[\\/:*?"<>|]/g, "_").replace(/\.\./g, "_");
  return safe && safe !== "_" ? safe : undefined;
}

function addActiveAllowFromFiles(
  activeFiles: Set<string>,
  channelValue: unknown,
  accountValues: unknown[],
): void {
  const channel = safePairingKey(channelValue);
  if (!channel) return;
  activeFiles.add(`${channel}${LEGACY_ALLOW_FROM_SUFFIX}`);
  activeFiles.add(`${channel}-default${LEGACY_ALLOW_FROM_SUFFIX}`);
  for (const accountValue of accountValues) {
    const account = safePairingKey(accountValue);
    if (account) activeFiles.add(`${channel}-${account}${LEGACY_ALLOW_FROM_SUFFIX}`);
  }
}

function listActiveLegacyAllowFromFiles(configPath: string): Set<string> {
  const config = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;
  const activeFiles = new Set<string>();

  for (const [channel, channelConfig] of Object.entries(config.channels ?? {})) {
    addActiveAllowFromFiles(activeFiles, channel, [
      ...Object.keys(channelConfig.accounts ?? {}),
      channelConfig.defaultAccount,
    ]);
  }

  for (const binding of config.bindings ?? []) {
    addActiveAllowFromFiles(activeFiles, binding.match?.channel, [binding.match?.accountId]);
  }

  return activeFiles;
}

function nextArchivePath(path: string): string {
  const base = `${path}.orphaned`;
  if (!existsSync(base)) return base;
  for (let index = 1; ; index += 1) {
    const candidate = `${base}.${index}`;
    if (!existsSync(candidate)) return candidate;
  }
}

/**
 * OpenClaw cannot resolve legacy allowlists for accounts removed from config,
 * and newer startup migrations treat those warnings as fatal. Preserve such
 * files under an archival suffix so OpenClaw can migrate all active accounts.
 */
export function archiveOrphanedLegacyAllowFromFiles(
  stateDir: string,
  configPath: string,
): string[] {
  const credentialsDir = join(stateDir, "credentials");
  if (!existsSync(credentialsDir) || !existsSync(configPath)) return [];

  let activeFiles: Set<string>;
  try {
    activeFiles = listActiveLegacyAllowFromFiles(configPath);
  } catch (error) {
    log.warn(
      `Skipping legacy allowFrom archival because config could not be read: ${String(error)}`,
    );
    return [];
  }

  const archived: string[] = [];
  for (const entry of readdirSync(credentialsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(LEGACY_ALLOW_FROM_SUFFIX)) continue;
    if (activeFiles.has(entry.name)) continue;
    const sourcePath = join(credentialsDir, entry.name);
    const archivePath = nextArchivePath(sourcePath);
    renameSync(sourcePath, archivePath);
    archived.push(archivePath);
  }
  return archived;
}

function listActiveFeishuAccountIds(configPath: string): Set<string> {
  const config = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;
  const feishu = config.channels?.[FEISHU_CHANNEL_ID];
  if (!feishu) return new Set();

  const accountIds = new Set<string>();
  for (const accountId of Object.keys(feishu.accounts ?? {})) {
    const normalized = safePairingKey(accountId);
    if (normalized) accountIds.add(normalized);
  }

  const defaultAccountId = safePairingKey(feishu.defaultAccount);
  if (defaultAccountId) accountIds.add(defaultAccountId);

  // Legacy single-account Feishu config maps to the canonical default account.
  if (accountIds.size === 0) accountIds.add("default");
  return accountIds;
}

function collectFeishuDirectRecipients(stateDir: string): Map<string, Set<string>> {
  const recipientsByAccount = new Map<string, Set<string>>();

  for (const { databasePath } of listAgentDatabaseTargets(stateDir)) {
    if (!existsSync(databasePath)) continue;
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const hasConversations = database
        .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'conversations'")
        .get();
      if (!hasConversations) continue;

      const rows = database
        .prepare(
          `SELECT DISTINCT account_id, peer_id, delivery_target
           FROM conversations
           WHERE channel = ? AND kind = 'direct'`,
        )
        .all(FEISHU_CHANNEL_ID) as Array<{
        account_id: unknown;
        peer_id: unknown;
        delivery_target: unknown;
      }>;

      for (const row of rows) {
        const accountId = safePairingKey(row.account_id);
        const peerId = typeof row.peer_id === "string" ? row.peer_id.trim() : "";
        if (
          !accountId ||
          !FEISHU_OPEN_ID_PATTERN.test(peerId) ||
          row.delivery_target !== `user:${peerId}`
        ) {
          continue;
        }
        const recipients = recipientsByAccount.get(accountId) ?? new Set<string>();
        recipients.add(peerId);
        recipientsByAccount.set(accountId, recipients);
      }
    } catch (error) {
      log.warn(`Skipping Feishu recipient recovery from ${databasePath}: ${String(error)}`);
    } finally {
      database.close();
    }
  }

  return recipientsByAccount;
}

/**
 * Recover a missing account-scoped Feishu recipient file from OpenClaw's
 * canonical conversation rows. Existing files remain authoritative, including
 * an intentionally empty allowlist, so removed recipients never return.
 * Older Desktop state only retained channel-wide metadata, which cannot safely
 * be merged when multiple Feishu bots are configured.
 */
export function restoreFeishuAllowFromFromAgentDatabases(
  stateDir: string,
  configPath: string,
): RestoredFeishuAllowFromFile[] {
  if (!existsSync(configPath)) return [];

  let activeAccountIds: Set<string>;
  try {
    activeAccountIds = listActiveFeishuAccountIds(configPath);
  } catch (error) {
    log.warn(
      `Skipping Feishu recipient recovery because config could not be read: ${String(error)}`,
    );
    return [];
  }
  if (activeAccountIds.size === 0) return [];

  const credentialsDir = join(stateDir, "credentials");
  const recipientsByAccount = collectFeishuDirectRecipients(stateDir);
  const restored: RestoredFeishuAllowFromFile[] = [];

  for (const [accountId, discoveredRecipients] of recipientsByAccount) {
    if (!activeAccountIds.has(accountId) || discoveredRecipients.size === 0) continue;

    const path = join(
      credentialsDir,
      `${FEISHU_CHANNEL_ID}-${accountId}${LEGACY_ALLOW_FROM_SUFFIX}`,
    );
    if (existsSync(path)) continue;

    const recipientIds = [...discoveredRecipients].sort();

    mkdirSync(credentialsDir, { recursive: true });
    const temporaryPath = `${path}.tmp-${process.pid}`;
    writeFileSync(
      temporaryPath,
      `${JSON.stringify({ version: 1, allowFrom: recipientIds }, null, 2)}\n`,
      "utf-8",
    );
    renameSync(temporaryPath, path);
    restored.push({ accountId, path, recipientIds });
  }

  return restored;
}

function readTargetAgentSchemaVersion(vendorDir: string): number {
  const manifest = JSON.parse(readFileSync(join(vendorDir, "package.json"), "utf-8")) as {
    openclaw?: { schemaVersions?: { agent?: unknown } };
  };
  const version = Number(manifest.openclaw?.schemaVersions?.agent);
  if (!Number.isSafeInteger(version) || version <= 0) {
    throw new Error(`OpenClaw at ${vendorDir} does not declare a valid agent schema version`);
  }
  return version;
}

function listAgentDatabaseTargets(stateDir: string): AgentDatabaseTarget[] {
  const agentsDir = join(stateDir, "agents");
  if (!existsSync(agentsDir)) return [];
  return readdirSync(agentsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      agentId: entry.name,
      databasePath: join(agentsDir, entry.name, "agent", "openclaw-agent.sqlite"),
    }));
}

function pendingLegacyDeviceIdentityPaths(stateDir: string): string[] {
  const sourcePath = join(stateDir, LEGACY_DEVICE_IDENTITY_RELATIVE_PATH);
  return LEGACY_DEVICE_IDENTITY_CLAIM_SUFFIXES.map((suffix) => `${sourcePath}${suffix}`).filter(
    existsSync,
  );
}

export function resolveGatewayRpcClientIdentityPath(stateDir: string): string {
  return join(stateDir, "rivonclaw", "identity", "gateway-rpc-client.json");
}

function hasCompletedLegacyDeviceIdentityReceipt(stateDir: string, sourcePath: string): boolean {
  const databasePath = join(stateDir, "state", "openclaw.sqlite");
  if (!existsSync(databasePath)) return false;

  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return Boolean(
      database
        .prepare(
          `SELECT 1
           FROM migration_sources
           WHERE migration_kind = ? AND source_path = ? AND removed_source = 1
           LIMIT 1`,
        )
        .get(LEGACY_DEVICE_IDENTITY_MIGRATION_KIND, resolve(sourcePath)),
    );
  } catch {
    return false;
  } finally {
    database.close();
  }
}

/**
 * Older RivonClaw builds persisted their RPC client identity at OpenClaw's
 * retired primary identity path. Move only files recreated after OpenClaw has
 * recorded a completed import, which distinguishes our client key from an
 * authoritative legacy Gateway identity that still needs official migration.
 */
export function relocateRecreatedGatewayRpcClientIdentity(stateDir: string): string | undefined {
  const sourcePath = join(stateDir, LEGACY_DEVICE_IDENTITY_RELATIVE_PATH);
  if (!existsSync(sourcePath)) return undefined;
  if (!hasCompletedLegacyDeviceIdentityReceipt(stateDir, sourcePath)) return undefined;

  const targetPath = resolveGatewayRpcClientIdentityPath(stateDir);
  mkdirSync(dirname(targetPath), { recursive: true });
  if (existsSync(targetPath)) {
    if (!readFileSync(sourcePath).equals(readFileSync(targetPath))) {
      throw new Error(
        `RivonClaw RPC client identity conflicts with its migrated target: ${targetPath}`,
      );
    }
    unlinkSync(sourcePath);
  } else {
    renameSync(sourcePath, targetPath);
  }
  try {
    chmodSync(targetPath, 0o600);
  } catch {
    // Best effort on Windows.
  }
  return targetPath;
}

async function migrateRetiredVendorStartupState(
  options: VendorStateMigrationOptions,
): Promise<VendorNodeHostRuntime> {
  const runtimePath = join(options.vendorDir, "dist", "plugin-sdk", "node-host.js");
  const runtime = (await import(pathToFileURL(runtimePath).href)) as VendorNodeHostRuntime;
  if (typeof runtime.runStartupMigrations !== "function") {
    throw new Error(
      `OpenClaw node-host runtime does not expose startup migrations: ${runtimePath}`,
    );
  }

  const warnings: string[] = [];
  await runtime.runStartupMigrations({
    env: { ...process.env, OPENCLAW_STATE_DIR: options.stateDir },
    log: {
      info: (message) => log.info(message),
      warn: (message) => {
        warnings.push(message);
        log.warn(message);
      },
    },
  });

  const pendingIdentityPaths = pendingLegacyDeviceIdentityPaths(options.stateDir);
  if (pendingIdentityPaths.length > 0) {
    const detail = warnings.length > 0 ? ` (${warnings.join("; ")})` : "";
    throw new Error(
      `OpenClaw device identity migration remained incomplete: ${pendingIdentityPaths.join(", ")}${detail}`,
    );
  }
  return runtime;
}

function configuredWorkspaceStateDetection(
  runtime: VendorNodeHostRuntime,
  config: Record<string, unknown>,
  stateDir: string,
  env: NodeJS.ProcessEnv,
): VendorWorkspaceStateDetection {
  const detected = runtime.detectLegacyWorkspaceState({
    cfg: config,
    doctorOnlyStateMigrations: true,
    env,
    stateDir,
  });
  const sources = detected.sources.filter(
    (source) => typeof source.workspaceDir === "string" && source.workspaceDir.length > 0,
  );
  return { hasLegacy: sources.length > 0, sources };
}

async function migrateConfiguredWorkspaceState(
  options: VendorStateMigrationOptions,
  runtime: VendorNodeHostRuntime,
): Promise<void> {
  if (!options.configPath || !existsSync(options.configPath)) return;

  const config = JSON.parse(readFileSync(options.configPath, "utf-8")) as Record<string, unknown>;
  const env = { ...process.env, OPENCLAW_STATE_DIR: options.stateDir };
  const detected = configuredWorkspaceStateDetection(runtime, config, options.stateDir, env);
  if (!detected.hasLegacy) return;

  log.info(`Migrating retired workspace state for ${detected.sources.length} configured source(s)`);
  const result = await runtime.migrateLegacyWorkspaceState({
    detected,
    env,
    stateDir: options.stateDir,
  });
  for (const message of result.changes) log.info(message);
  for (const message of result.notices ?? []) log.info(message);
  for (const message of result.warnings) log.warn(message);

  const remaining = configuredWorkspaceStateDetection(runtime, config, options.stateDir, env);
  if (remaining.hasLegacy) {
    const detail = result.warnings.length > 0 ? ` (${result.warnings.join("; ")})` : "";
    throw new Error(
      `OpenClaw workspace state migration remained incomplete for ${remaining.sources.length} configured source(s)${detail}`,
    );
  }
}

export function inspectVendorStateMigration(
  stateDir: string,
  vendorDir: string,
): VendorStateMigrationInspection {
  const targetAgentSchemaVersion = readTargetAgentSchemaVersion(vendorDir);
  const reasons: string[] = [];

  for (const { databasePath } of listAgentDatabaseTargets(stateDir)) {
    if (!existsSync(databasePath)) continue;
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const version = Number(
        (database.prepare("PRAGMA user_version").get() as { user_version?: unknown } | undefined)
          ?.user_version ?? 0,
      );
      if (version > 0 && version < targetAgentSchemaVersion) {
        reasons.push(`agent schema ${version} -> ${targetAgentSchemaVersion}: ${databasePath}`);
      }
    } finally {
      database.close();
    }
  }

  return { required: reasons.length > 0, reasons, targetAgentSchemaVersion };
}

/**
 * Run OpenClaw's schema owner before Desktop writes auth state or starts the
 * gateway. Do not invoke the full Doctor here: it also loads plugins, refreshes
 * OAuth, and migrates unrelated channel state, so one malformed legacy pairing
 * record can otherwise prevent the gateway from ever starting.
 */
export async function migrateVendorStateBeforeGateway(
  options: VendorStateMigrationOptions,
): Promise<void> {
  const relocatedRpcIdentity = relocateRecreatedGatewayRpcClientIdentity(options.stateDir);
  if (relocatedRpcIdentity) {
    log.info(`Relocated RivonClaw Gateway RPC client identity to ${relocatedRpcIdentity}`);
  }
  const nodeHostRuntime = await migrateRetiredVendorStartupState(options);
  await migrateConfiguredWorkspaceState(options, nodeHostRuntime);

  if (options.configPath) {
    const archived = archiveOrphanedLegacyAllowFromFiles(options.stateDir, options.configPath);
    if (archived.length > 0) {
      log.info(`Archived orphaned legacy allowFrom files: ${archived.join(", ")}`);
    }
  }

  const inspection = inspectVendorStateMigration(options.stateDir, options.vendorDir);
  if (inspection.required) {
    log.info(`Running OpenClaw agent database migration: ${inspection.reasons.join("; ")}`);
    const runtimePath = join(options.vendorDir, "dist", "plugin-sdk", "sqlite-runtime.js");
    const runtime = (await import(pathToFileURL(runtimePath).href)) as VendorSqliteRuntime;
    const env = { ...process.env, OPENCLAW_STATE_DIR: options.stateDir };

    for (const target of listAgentDatabaseTargets(options.stateDir)) {
      if (!existsSync(target.databasePath)) continue;
      const database = new DatabaseSync(target.databasePath);
      try {
        runtime.ensureOpenClawAgentDatabaseSchema(database, {
          agentId: target.agentId,
          path: target.databasePath,
          env,
        });
      } finally {
        database.close();
      }
    }

    const remaining = inspectVendorStateMigration(options.stateDir, options.vendorDir);
    if (remaining.required) {
      throw new Error(
        `OpenClaw agent database migration remained incomplete: ${remaining.reasons.join("; ")}`,
      );
    }
    log.info("OpenClaw agent database migration completed");
  }

  if (options.configPath) {
    const restored = restoreFeishuAllowFromFromAgentDatabases(options.stateDir, options.configPath);
    if (restored.length > 0) {
      const summary = restored
        .map(({ accountId, recipientIds }) => `${accountId}=${recipientIds.length}`)
        .join(", ");
      log.info(`Restored account-scoped Feishu recipients from SQLite conversations: ${summary}`);
    }
  }
}
