import { types, flow, getRoot, type Instance } from "mobx-state-tree";
import { basename, join } from "node:path";
import { promises as fs } from "node:fs";
import { existsSync, readFileSync } from "node:fs";
import type { Storage } from "@rivonclaw/storage";
import type { ChannelAccount } from "@rivonclaw/storage";
import { readExistingConfig } from "@rivonclaw/gateway";
import type { GatewayRpcClient } from "@rivonclaw/gateway";
import type { ChannelsStatusSnapshot } from "@rivonclaw/core";
import { normalizeWeixinAccountId } from "@rivonclaw/core";
import { resolveCredentialsDir } from "@rivonclaw/core/node";
import { createLogger } from "@rivonclaw/logger";
import { syncOwnerAllowFrom } from "../auth/owner-sync.js";
import { writeDesktopOpenClawConfig } from "../gateway/openclaw-config-mutation.js";
import {
  addAllowFromEntry,
  addAllowFromEntrySync,
  mergeAccountAllowFromList,
  readAllAllowFromLists,
  readAllowFromList,
  resolveAllowFromPathForChannel,
  writeAllowFromList,
  type AllowFromStore,
} from "./channel-allowlist-store.js";
import {
  WEIXIN_CHANNEL_ID,
  hasWeixinAccountFile,
  readIndexedWeixinAccountIds,
  readWeixinContextTokensSync,
  readWeixinContextTokenRecipientIds,
  readWeixinAccountUserId,
  readWeixinAccountUserIdSync,
  selectStaleWeixinAccountIdsForLogin,
  selectWeixinReplacementAccountName,
} from "./weixin-account-dedupe.js";

const log = createLogger("channel-manager");
const RIVONCLAW_WEIXIN_LOGIN_START = "rivonclaw.weixin.login.start";
const RIVONCLAW_WEIXIN_LOGIN_WAIT = "rivonclaw.weixin.login.wait";
const WEIXIN_CONTEXT_TOKEN_RETRY_DELAYS_MS = [100, 300, 700, 1_500, 3_000];
const TELEGRAM_CHANNEL_ID = "telegram";
export const RIVONCLAW_TELEGRAM_DEBUG_ACCOUNT_ID = "rivonclaw-support";
const RIVONCLAW_TELEGRAM_DEBUG_ACCOUNT_NAME = "RivonClaw Support";

// ---------------------------------------------------------------------------
// Environment interface -- late-initialized infrastructure dependencies.
// ---------------------------------------------------------------------------

export interface ChannelManagerEnv {
  storage: Storage;
  configPath: string;
  stateDir: string;
}

// ---------------------------------------------------------------------------
// Pairing / AllowFrom file I/O helpers (module-level, used by actions)
// ---------------------------------------------------------------------------

export interface PairingRequest {
  id: string;
  code: string;
  createdAt: string;
  lastSeenAt: string;
  meta?: Record<string, string>;
}

interface PairingStore {
  version: number;
  requests: PairingRequest[];
}

export interface ChannelAccountSnapshotForMst {
  channelId: string;
  accountId: string;
  name: string | null;
  config: Record<string, unknown>;
  status: {
    hasContextToken: boolean | null;
  };
  recipients: ChannelRecipientsSnapshot;
}

export interface ChannelRecipientsSnapshot {
  allowlist: string[];
  labels: Record<string, string>;
  owners: Record<string, boolean>;
  pairingRequests: PairingRequest[];
}

function deriveRawWeixinAccountId(accountId: string): string | undefined {
  if (accountId.endsWith("-im-bot")) {
    return `${accountId.slice(0, -"-im-bot".length)}@im.bot`;
  }
  if (accountId.endsWith("-im-wechat")) {
    return `${accountId.slice(0, -"-im-wechat".length)}@im.wechat`;
  }
  return undefined;
}

function resolveEquivalentWeixinAccountIds(accountId: string): string[] {
  const canonical = normalizeWeixinAccountId(accountId);
  const ids = new Set<string>([canonical, accountId]);
  const raw = deriveRawWeixinAccountId(canonical);
  if (raw) ids.add(raw);
  return [...ids];
}

function resolvePairingPath(channelId: string): string {
  return join(resolveCredentialsDir(), `${channelId}-pairing.json`);
}

function ensureRecord(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = parent[key];
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  const next: Record<string, unknown> = {};
  parent[key] = next;
  return next;
}

function ensureChannelPluginConfig(config: Record<string, unknown>, channelId: string, enabled: boolean): void {
  const plugins = ensureRecord(config, "plugins");
  const entries = ensureRecord(plugins, "entries");
  const existing = entries[channelId] !== null && typeof entries[channelId] === "object" && !Array.isArray(entries[channelId])
    ? (entries[channelId] as Record<string, unknown>)
    : {};
  entries[channelId] = { ...existing, enabled };
}

function ensureWildcardBinding(config: Record<string, unknown>, channelId: string): void {
  const bindings = (Array.isArray(config.bindings) ? config.bindings : []) as Array<Record<string, unknown>>;
  const channelLower = channelId.toLowerCase();
  const hasCovering = bindings.some((binding) => {
    const match = binding.match;
    if (match === null || typeof match !== "object" || Array.isArray(match)) return false;
    const record = match as Record<string, unknown>;
    return String(record.channel ?? "").trim().toLowerCase() === channelLower &&
      String(record.accountId ?? "").trim() === "*";
  });
  if (!hasCovering) {
    bindings.push({
      agentId: "main",
      match: { channel: channelId, accountId: "*" },
    });
    config.bindings = bindings;
  }
}

async function readPairingRequests(channelId: string): Promise<PairingRequest[]> {
  try {
    const filePath = resolvePairingPath(channelId);
    const content = await fs.readFile(filePath, "utf-8");
    if (!content.trim()) return [];
    const data: PairingStore = JSON.parse(content);
    return Array.isArray(data.requests) ? data.requests : [];
  } catch (err: any) {
    if (err.code === "ENOENT") return [];
    if (err instanceof SyntaxError) return [];
    throw err;
  }
}

function requestMatchesAccountId(request: PairingRequest, accountId?: string): boolean {
  if (!accountId) return true;
  return (request.meta?.accountId ?? "default").trim().toLowerCase() === accountId.trim().toLowerCase();
}

function readPairingRequestsSync(channelId: string, accountId?: string): PairingRequest[] {
  try {
    const filePath = resolvePairingPath(channelId);
    const content = readFileSync(filePath, "utf-8");
    if (!content.trim()) return [];
    const data: PairingStore = JSON.parse(content);
    const requests = Array.isArray(data.requests) ? data.requests : [];
    return requests.filter((request) => requestMatchesAccountId(request, accountId));
  } catch (err: any) {
    if (err.code === "ENOENT") return [];
    if (err instanceof SyntaxError) return [];
    throw err;
  }
}

async function writePairingRequests(channelId: string, requests: PairingRequest[]): Promise<void> {
  const filePath = resolvePairingPath(channelId);
  const data: PairingStore = { version: 1, requests };
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function shouldIncludeLegacyAllowFromEntries(accountId?: string): boolean {
  const normalized = accountId?.trim().toLowerCase() || "default";
  return normalized === "default";
}

function readAllowFromListSyncForPath(filePath: string): string[] {
  try {
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, "utf-8");
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw) as AllowFromStore;
    return Array.isArray(parsed.allowFrom) ? parsed.allowFrom.filter((entry) => typeof entry === "string" && entry.trim()) : [];
  } catch {
    return [];
  }
}

function readAccountAllowFromListSync(channelId: string, accountId?: string): string[] {
  if (shouldIncludeLegacyAllowFromEntries(accountId)) {
    return [...new Set([
      ...readAllowFromListSyncForPath(resolveAllowFromPathForChannel(channelId, "default")),
      ...readAllowFromListSyncForPath(resolveAllowFromPathForChannel(channelId)),
    ])];
  }
  return readAllowFromListSyncForPath(resolveAllowFromPathForChannel(channelId, accountId));
}

function sanitizeChannelAccountConfig(channelId: string, config: Record<string, unknown>): Record<string, unknown> {
  if (channelId !== WEIXIN_CHANNEL_ID || !Object.prototype.hasOwnProperty.call(config, "userId")) {
    return config;
  }
  const { userId: _providerOwnedUserId, ...rest } = config;
  return rest;
}

function channelAccountConfigHasWeixinUserId(channelId: string, config: Record<string, unknown>): boolean {
  return channelId === WEIXIN_CHANNEL_ID && Object.prototype.hasOwnProperty.call(config, "userId");
}

function normalizeTelegramDebugApiRoot(apiRoot: string): string {
  return apiRoot.trim().replace(/\/+$/, "");
}

function buildTelegramDebugAccountConfig(proxyToken: string, apiRoot: string, deviceId: string): Record<string, unknown> {
  const deviceApiRoot = `${normalizeTelegramDebugApiRoot(apiRoot)}/telegram-debug/devices/${encodeURIComponent(deviceId)}`;
  return {
    name: RIVONCLAW_TELEGRAM_DEBUG_ACCOUNT_NAME,
    botToken: proxyToken,
    apiRoot: deviceApiRoot,
    dmPolicy: "open",
    allowFrom: ["*"],
    groupPolicy: "disabled",
    streaming: { mode: "block" },
    commands: { native: false, nativeSkills: false },
    configWrites: false,
  };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function isRivonClawTelegramDebugAccount(channelId: string, accountId?: string): boolean {
  return channelId === TELEGRAM_CHANNEL_ID && accountId === RIVONCLAW_TELEGRAM_DEBUG_ACCOUNT_ID;
}

function shouldIncludeChannelWideRecipientMeta(channelId: string, accountId?: string): boolean {
  // Telegram supports multiple named bot accounts. SQLite recipient metadata is
  // keyed by channelId for labels/owner flags, so blindly merging every
  // channel-wide row into every named account leaks recipients between user bots
  // and the hidden RivonClaw support bot. Account-scoped allowFrom files remain
  // the membership source; metadata only enriches entries already in that set.
  if (channelId === TELEGRAM_CHANNEL_ID && accountId && accountId !== "default") {
    return false;
  }
  return true;
}

function isWeixinAlreadyConnectedQrResult(result: { connected?: boolean; message?: string }): boolean {
  if (result.connected) return false;
  const message = result.message ?? "";
  return message.includes("已连接过此 OpenClaw") ||
    message.includes("无需重复连接") ||
    /\balready\s+(connected|bound)\b/i.test(message);
}

function mergeProviderOwnedChannelConfig(
  channelId: string,
  accountId: string,
  config: Record<string, unknown>,
  stateDir: string,
): Record<string, unknown> {
  const base = sanitizeChannelAccountConfig(channelId, config);
  if (channelId !== WEIXIN_CHANNEL_ID) return base;

  const userId = readWeixinAccountUserIdSync(stateDir, accountId);
  return userId ? { ...base, userId } : base;
}

// ---------------------------------------------------------------------------
// MST Model
// ---------------------------------------------------------------------------

export const ChannelManagerModel = types
  .model("ChannelManager", {
    initialized: types.optional(types.boolean, false),
  })
  .volatile(() => ({
    _env: null as ChannelManagerEnv | null,
    // Desktop MST owns raw WeChat context tokens. Panel receives only the
    // derived account.status.hasContextToken bit through the root snapshot.
    _weixinContextTokens: new Map<string, Map<string, string>>(),
    _weixinContextTokenSyncTimers: new Map<string, ReturnType<typeof setTimeout>>(),
  }))
  .views((self) => ({
    get root(): any {
      return getRoot(self);
    },
  }))
  .views((self) => ({
    /**
     * Build plugin entries for all channels that have at least one account.
     * Also includes mobile if any active pairing exists.
     * Returns Record<string, { enabled: boolean }> for gateway config plugins.entries.
     */
    buildPluginEntries(): Record<string, { enabled: boolean }> {
      const env = self._env;
      if (!env) return {};

      const entries: Record<string, { enabled: boolean }> = {};

      // openclaw-weixin is a QR-login bootstrap channel: accounts are created
      // AFTER QR login succeeds, so the plugin must be enabled before any
      // account exists. Always keep it on — lifecycle is independent of
      // account presence.
      entries["openclaw-weixin"] = { enabled: true };

      // Channel accounts from root store
      const channelIds = new Set<string>();
      for (const a of self.root.channelAccounts as any[]) {
        channelIds.add(a.channelId);
      }
      for (const channelId of channelIds) {
        entries[channelId] = { enabled: true };
      }

      // Mobile channel uses a separate pairing system (mobile_pairings table)
      const pairings = env.storage.mobilePairings.getAllPairings();
      if (pairings.length > 0) {
        entries["rivonclaw-mobile-chat-channel"] = { enabled: true };
      }

      return entries;
    },

    /**
     * Build channel account configs for gateway config write-back.
     * Does NOT include mobile accounts (mobile plugin manages its own config).
     */
    buildConfigAccounts(): Array<{ channelId: string; accountId: string; config: Record<string, unknown> }> {
      const env = self._env;
      return self.root.channelAccounts
        .filter((a: any) => a.channelId !== "mobile")
        .map((a: any) => ({
          channelId: a.channelId,
          accountId: a.accountId,
          config: env
            ? mergeProviderOwnedChannelConfig(a.channelId, a.accountId, a.config, env.stateDir)
            : sanitizeChannelAccountConfig(a.channelId, a.config),
        }));
    },
  }))
  .actions((self) => {
    function getEnv(): ChannelManagerEnv {
      if (!self._env) throw new Error("ChannelManager not initialized -- call setEnv() first");
      return self._env;
    }

    /**
     * One-time migration: import and enrich channel accounts from openclaw.json into SQLite.
     * Only runs if the migration flag is not set.
     *
     * Two cases:
     * 1. SQLite is empty → import all accounts from config (first-run upgrade)
     * 2. SQLite has data → enrich existing records with fields that config has but SQLite lacks
     *    (secret backfill from older versions that stored secrets only in config/keychain)
     */
    function runMigrationIfNeeded(): void {
      const { storage, configPath } = getEnv();

      if (storage.settings.get("channel-migration-done") === "1") return;

      let existingConfig: Record<string, unknown>;
      try {
        existingConfig = readExistingConfig(configPath);
      } catch {
        // No config file -- nothing to migrate
        storage.settings.set("channel-migration-done", "1");
        return;
      }

      const channels = existingConfig.channels;
      if (!channels || typeof channels !== "object") {
        storage.settings.set("channel-migration-done", "1");
        return;
      }

      const existingAccounts = storage.channelAccounts.list();
      const sqliteMap = new Map(existingAccounts.map((a) => [`${a.channelId}:${a.accountId}`, a]));

      for (const [channelId, channelData] of Object.entries(channels as Record<string, unknown>)) {
        if (channelId === "mobile") continue; // mobile uses mobile_pairings
        if (!channelData || typeof channelData !== "object") continue;
        const accounts = (channelData as Record<string, unknown>).accounts;
        if (!accounts || typeof accounts !== "object") continue;

        for (const [accountId, accountData] of Object.entries(accounts as Record<string, unknown>)) {
          const configObj = typeof accountData === "object" && accountData !== null
            ? (accountData as Record<string, unknown>)
            : {};
          const sqliteConfigObj = sanitizeChannelAccountConfig(channelId, configObj);
          const key = `${channelId}:${accountId}`;
          const sqliteRecord = sqliteMap.get(key);

          if (!sqliteRecord) {
            // Config has account that SQLite doesn't → import
            storage.channelAccounts.upsert(
              channelId,
              accountId,
              typeof sqliteConfigObj.name === "string" ? sqliteConfigObj.name : null,
              sqliteConfigObj,
            );
          } else {
            // Both have it → merge any fields config has that SQLite lacks
            // (secret backfill from older versions)
            let needsUpdate = false;
            const merged = sanitizeChannelAccountConfig(channelId, { ...sqliteRecord.config });
            if (channelAccountConfigHasWeixinUserId(channelId, sqliteRecord.config)) {
              needsUpdate = true;
            }
            for (const [k, v] of Object.entries(sqliteConfigObj)) {
              if (v !== undefined && v !== null && !(k in merged)) {
                merged[k] = v;
                needsUpdate = true;
              }
            }
            if (needsUpdate) {
              storage.channelAccounts.upsert(channelId, accountId, sqliteRecord.name, merged);
            }
          }
        }
      }

      if (existingAccounts.length === 0) {
        log.info("Migrated channel accounts from config file to SQLite");
      }

      storage.settings.set("channel-migration-done", "1");
    }

    function stripWeixinUserIdFromStoredAccounts(): void {
      const { storage } = getEnv();
      for (const account of storage.channelAccounts.list(WEIXIN_CHANNEL_ID)) {
        if (!channelAccountConfigHasWeixinUserId(account.channelId, account.config)) continue;
        storage.channelAccounts.upsert(
          account.channelId,
          account.accountId,
          account.name,
          sanitizeChannelAccountConfig(account.channelId, account.config),
        );
      }
    }

    function writeChannelAccountsSnapshot(channelId: string): void {
      const { storage, configPath, stateDir } = getEnv();
      const config = readExistingConfig(configPath);
      const channels = (config.channels && typeof config.channels === "object")
        ? (config.channels as Record<string, unknown>)
        : {};
      const existingChannel = channels[channelId] && typeof channels[channelId] === "object"
        ? (channels[channelId] as Record<string, unknown>)
        : {};
      const accounts: Record<string, Record<string, unknown>> = {};

      for (const account of storage.channelAccounts.list(channelId)) {
        accounts[account.accountId] = mergeProviderOwnedChannelConfig(
          channelId,
          account.accountId,
          account.config,
          stateDir,
        );
      }

      if (Object.keys(accounts).length > 0 || channelId === WEIXIN_CHANNEL_ID) {
        channels[channelId] = {
          ...existingChannel,
          ...(channelId === WEIXIN_CHANNEL_ID ? { managed: true } : {}),
          accounts,
        };
      } else {
        delete channels[channelId];
      }
      config.channels = channels;
      ensureChannelPluginConfig(config, channelId, Object.keys(accounts).length > 0 || channelId === WEIXIN_CHANNEL_ID);
      if (Object.keys(accounts).some((accountId) => accountId.trim().toLowerCase() !== "default")) {
        ensureWildcardBinding(config, channelId);
      }
      writeDesktopOpenClawConfig(configPath, config, `channel account snapshot: ${channelId}`);
      log.info(`Wrote channel account snapshot: ${channelId}/${Object.keys(accounts).length} account(s)`);
    }

    function removeAccountById(channelId: string, accountId: string, options?: { writeConfig?: boolean }): void {
      const { storage, stateDir } = getEnv();

      // Defensive canonicalization (see addAccount for rationale).
      if (channelId === WEIXIN_CHANNEL_ID) {
        accountId = normalizeWeixinAccountId(accountId);
      }

      // WeChat plugin stores its own state files (account index + credential files).
      // Clean them up so the plugin doesn't re-register the account on reload.
      if (channelId === WEIXIN_CHANNEL_ID) {
        const weixinStateDir = join(stateDir, WEIXIN_CHANNEL_ID);
        const equivalentIds = resolveEquivalentWeixinAccountIds(accountId);
        for (const id of equivalentIds) {
          for (const suffix of [".json", ".sync.json", ".context-tokens.json"]) {
            fs.rm(join(weixinStateDir, "accounts", `${id}${suffix}`), { force: true }).catch(() => {});
          }
        }
        // Remove accountId from index
        (async () => {
          try {
            const indexPath = join(weixinStateDir, "accounts.json");
            const raw = await fs.readFile(indexPath, "utf-8");
            const ids: string[] = JSON.parse(raw);
            const updated = ids.filter((id: string) => normalizeWeixinAccountId(id) !== accountId);
            await fs.writeFile(indexPath, JSON.stringify(updated, null, 2), "utf-8");
          } catch { /* index file may not exist */ }
        })();
      }

      // Remove account-scoped allowFrom file to prevent orphaned recipients
      const allowFromAccountIds = channelId === WEIXIN_CHANNEL_ID
        ? resolveEquivalentWeixinAccountIds(accountId)
        : [accountId];
      for (const allowFromAccountId of allowFromAccountIds) {
        const allowFromPath = resolveAllowFromPathForChannel(channelId, allowFromAccountId);
        fs.rm(allowFromPath, { force: true }).catch(() => {});
      }

      // Remove from SQLite
      storage.channelAccounts.delete(channelId, accountId);

      // Update MST state via root store
      (getRoot(self) as any).removeChannelAccount(channelId, accountId);

      if (options?.writeConfig !== false) {
        writeChannelAccountsSnapshot(channelId);
      }
    }

    function upsertAccountState(params: {
      channelId: string;
      accountId: string;
      name?: string;
      config: Record<string, unknown>;
      secrets?: Record<string, string>;
      writeConfig?: boolean;
    }): ChannelAccountSnapshotForMst {
      const { storage } = getEnv();

      if (params.channelId === WEIXIN_CHANNEL_ID) {
        params = { ...params, accountId: normalizeWeixinAccountId(params.accountId) };
      }

      let accountConfig: Record<string, unknown> = { ...params.config };
      if (params.name !== undefined) {
        accountConfig.name = params.name;
      }

      if (params.secrets && typeof params.secrets === "object") {
        for (const [secretKey, secretValue] of Object.entries(params.secrets)) {
          if (secretValue) {
            accountConfig[secretKey] = secretValue;
          }
        }
      }
      accountConfig = sanitizeChannelAccountConfig(params.channelId, accountConfig);

      const savedAccount = storage.channelAccounts.upsert(
        params.channelId,
        params.accountId,
        params.name ?? null,
        accountConfig,
      );

      const entry = buildChannelAccountSnapshot(savedAccount);
      (getRoot(self) as any).upsertChannelAccount(entry);
      if (params.writeConfig !== false) {
        writeChannelAccountsSnapshot(params.channelId);
      }
      return entry;
    }

    function weixinContextTokenSyncKey(accountId: string, recipientId: string): string {
      return `${normalizeWeixinAccountId(accountId)}\u0000${recipientId.trim()}`;
    }

    function clearPendingWeixinContextTokenSync(accountId: string, recipientId: string): void {
      const key = weixinContextTokenSyncKey(accountId, recipientId);
      const timer = self._weixinContextTokenSyncTimers.get(key);
      if (timer) clearTimeout(timer);
      self._weixinContextTokenSyncTimers.delete(key);
    }

    function clearAllPendingWeixinContextTokenSyncs(): void {
      for (const timer of self._weixinContextTokenSyncTimers.values()) {
        clearTimeout(timer);
      }
      self._weixinContextTokenSyncTimers.clear();
    }

    function loadWeixinContextTokens(accountId: string): Map<string, string> {
      const { stateDir } = getEnv();
      const canonicalAccountId = normalizeWeixinAccountId(accountId);
      const tokens = new Map(Object.entries(readWeixinContextTokensSync(stateDir, canonicalAccountId)));
      self._weixinContextTokens.set(canonicalAccountId, tokens);
      return tokens;
    }

    function getWeixinContextTokens(accountId: string): Map<string, string> {
      const canonicalAccountId = normalizeWeixinAccountId(accountId);
      return self._weixinContextTokens.get(canonicalAccountId) ?? new Map();
    }

    function hasLoadedWeixinContextToken(accountId: string, recipientId: string): boolean {
      const trimmedRecipientId = recipientId.trim();
      if (!trimmedRecipientId) return false;
      return getWeixinContextTokens(accountId).has(trimmedRecipientId);
    }

    function getLoadedWeixinContextToken(accountId: string, recipientId: string): string | undefined {
      const trimmedRecipientId = recipientId.trim();
      if (!trimmedRecipientId) return undefined;
      return getWeixinContextTokens(accountId).get(trimmedRecipientId);
    }

    function clearLoadedWeixinContextTokens(accountId: string): void {
      self._weixinContextTokens.delete(normalizeWeixinAccountId(accountId));
    }

    function applyWeixinContextTokenSync(accountId: string, recipientId?: string): {
      hasRecipientToken: boolean;
    } {
      const canonicalAccountId = normalizeWeixinAccountId(accountId);
      const tokens = loadWeixinContextTokens(canonicalAccountId);
      refreshWeixinContextTokenStatus(canonicalAccountId);
      updateChannelRecipientsForAccounts(WEIXIN_CHANNEL_ID, canonicalAccountId);

      const trimmedRecipientId = recipientId?.trim();
      const hasRecipientToken = trimmedRecipientId ? tokens.has(trimmedRecipientId) : tokens.size > 0;
      if (trimmedRecipientId && hasRecipientToken) {
        clearPendingWeixinContextTokenSync(canonicalAccountId, trimmedRecipientId);
      }
      return { hasRecipientToken };
    }

    function scheduleWeixinContextTokenSync(accountId: string, recipientId: string, attempt = 0): void {
      const trimmedRecipientId = recipientId.trim();
      if (!trimmedRecipientId) return;
      if (attempt >= WEIXIN_CONTEXT_TOKEN_RETRY_DELAYS_MS.length) return;

      const canonicalAccountId = normalizeWeixinAccountId(accountId);
      const key = weixinContextTokenSyncKey(canonicalAccountId, trimmedRecipientId);
      if (self._weixinContextTokenSyncTimers.has(key)) return;

      const delayMs = WEIXIN_CONTEXT_TOKEN_RETRY_DELAYS_MS[attempt]!;
      const timer = setTimeout(() => {
        (self as any).retryWeixinContextTokenSync(canonicalAccountId, trimmedRecipientId, attempt);
      }, delayMs);
      self._weixinContextTokenSyncTimers.set(key, timer);
    }

    function buildChannelAccountSnapshot(account: ChannelAccount): ChannelAccountSnapshotForMst {
      const canonicalAccountId = account.channelId === WEIXIN_CHANNEL_ID
        ? normalizeWeixinAccountId(account.accountId)
        : account.accountId;
      const status: ChannelAccountSnapshotForMst["status"] = {
        hasContextToken: null,
      };

      if (account.channelId === WEIXIN_CHANNEL_ID) {
        status.hasContextToken = getWeixinContextTokens(canonicalAccountId).size > 0;
      }

      return {
        channelId: account.channelId,
        accountId: canonicalAccountId,
        name: account.name,
        config: sanitizeChannelAccountConfig(account.channelId, account.config),
        status,
        recipients: buildChannelRecipientsSnapshot(account.channelId, canonicalAccountId),
      };
    }

    function refreshWeixinContextTokenStatus(accountId?: string): void {
      const { storage } = getEnv();
      const root = getRoot(self) as any;
      const accounts = storage.channelAccounts.list(WEIXIN_CHANNEL_ID)
        .filter((account) => !accountId || normalizeWeixinAccountId(account.accountId) === normalizeWeixinAccountId(accountId));

      for (const account of accounts) {
        const snapshot = buildChannelAccountSnapshot(account);
        root.updateChannelAccountStatus(WEIXIN_CHANNEL_ID, snapshot.accountId, snapshot.status);
      }
    }

    function normalizeChannelAccountId(channelId: string, accountId: string): string {
      return channelId === WEIXIN_CHANNEL_ID ? normalizeWeixinAccountId(accountId) : accountId;
    }

    function buildChannelRecipientsSnapshot(channelId: string, accountId?: string): ChannelRecipientsSnapshot {
      const { storage } = getEnv();
      const entries = new Set<string>(readAccountAllowFromListSync(channelId, accountId));

      if (channelId === WEIXIN_CHANNEL_ID && accountId) {
        for (const recipientId of getWeixinContextTokens(accountId).keys()) {
          entries.add(recipientId);
        }
      }

      const meta = storage.channelRecipients.getRecipientMeta(channelId);
      if (channelId !== WEIXIN_CHANNEL_ID && shouldIncludeChannelWideRecipientMeta(channelId, accountId)) {
        for (const id of Object.keys(meta)) {
          entries.add(id);
        }
      }

      const labels: Record<string, string> = {};
      const owners: Record<string, boolean> = {};
      for (const id of entries) {
        const data = meta[id];
        if (!data) continue;
        if (data.label) labels[id] = data.label;
        owners[id] = data.isOwner;
      }

      return {
        allowlist: [...entries],
        labels,
        owners,
        pairingRequests: readPairingRequestsSync(channelId, accountId),
      };
    }

    function updateChannelAccountRecipients(channelId: string, accountId: string): ChannelRecipientsSnapshot {
      const recipients = buildChannelRecipientsSnapshot(channelId, accountId);
      (getRoot(self) as any).updateChannelAccountRecipients(channelId, accountId, recipients);
      return recipients;
    }

    function updateChannelRecipientsForAccounts(channelId: string, accountId?: string): void {
      const root = getRoot(self) as any;
      for (const account of root.channelAccounts as any[]) {
        if (account.channelId !== channelId) continue;
        if (accountId && account.accountId !== accountId) continue;
        updateChannelAccountRecipients(channelId, account.accountId);
      }
    }

    return {
      /** Set the environment dependencies. Called once during startup. */
      setEnv(env: ChannelManagerEnv) {
        clearAllPendingWeixinContextTokenSyncs();
        self._env = env;
        self._weixinContextTokens.clear();
      },

      /** Initialize from SQLite. Runs migration if needed, then loads all accounts. */
      init() {
        runMigrationIfNeeded();

        const { storage } = getEnv();
        stripWeixinUserIdFromStoredAccounts();
        const allAccounts = storage.channelAccounts.list();
        clearAllPendingWeixinContextTokenSyncs();
        self._weixinContextTokens.clear();
        for (const account of allAccounts) {
          if (account.channelId === WEIXIN_CHANNEL_ID) {
            loadWeixinContextTokens(account.accountId);
          }
        }
        (getRoot(self) as any).loadChannelAccounts(
          allAccounts.map((account) => buildChannelAccountSnapshot(account)),
        );

        self.initialized = true;
        log.info(`Channel manager initialized with ${allAccounts.length} account(s)`);
      },

      refreshWeixinContextTokenStatus(accountId?: string) {
        return refreshWeixinContextTokenStatus(accountId);
      },

      syncWeixinContextTokensFromDisk(accountId: string, recipientId?: string) {
        return applyWeixinContextTokenSync(accountId, recipientId);
      },

      retryWeixinContextTokenSync(accountId: string, recipientId: string, attempt: number) {
        self._weixinContextTokenSyncTimers.delete(weixinContextTokenSyncKey(accountId, recipientId));
        const result = applyWeixinContextTokenSync(accountId, recipientId);
        if (!result.hasRecipientToken) {
          scheduleWeixinContextTokenSync(accountId, recipientId, attempt + 1);
        }
        return result;
      },

      /**
       * Read one account through the channel-account model boundary. Route
       * handlers use this instead of reaching into SQLite directly.
       */
      getAccount(channelId: string, accountId: string) {
        const { storage } = getEnv();
        const normalizedAccountId = normalizeChannelAccountId(channelId, accountId);
        const account = storage.channelAccounts.get(channelId, normalizedAccountId);
        return account ? buildChannelAccountSnapshot(account) : undefined;
      },

      /**
       * Check whether a WeChat recipient has an OpenClaw context token. The raw
       * token is loaded into this desktop-only manager state; the shared root
       * store exposes only the derived readiness bit to Panel.
       */
      hasWeixinContextTokenForRecipient(accountId: string, recipientId: string): boolean {
        const canonicalAccountId = normalizeWeixinAccountId(accountId);
        return hasLoadedWeixinContextToken(canonicalAccountId, recipientId);
      },

      getWeixinContextTokenForRecipient(accountId: string, recipientId: string): string | undefined {
        const canonicalAccountId = normalizeWeixinAccountId(accountId);
        return getLoadedWeixinContextToken(canonicalAccountId, recipientId);
      },

      /**
       * Persist a gateway recipient-seen event. This is the action boundary for
       * recipient SQLite rows, account-scoped WeChat allowFrom files, and the
       * derived WeChat context-token readiness in MST.
       */
      recordRecipientSeen(params: { channelId: string; accountId?: string; recipientId: string }) {
        const { storage, configPath } = getEnv();
        const accountId = params.accountId
          ? normalizeChannelAccountId(params.channelId, params.accountId)
          : undefined;

        if (isRivonClawTelegramDebugAccount(params.channelId, accountId)) {
          return { inserted: false, membershipChanged: false };
        }

        const inserted = storage.channelRecipients.ensureExists(params.channelId, params.recipientId, true);
        let membershipChanged = false;

        if (params.channelId === WEIXIN_CHANNEL_ID) {
          if (accountId) {
            const syncResult = applyWeixinContextTokenSync(accountId, params.recipientId);
            membershipChanged = addAllowFromEntrySync(params.channelId, accountId, params.recipientId);
            if (!syncResult.hasRecipientToken) {
              scheduleWeixinContextTokenSync(accountId, params.recipientId);
            }
          } else {
            log.warn(
              `WeChat recipient-seen missing accountId; skipped account-scoped context-token sync for recipient=${params.recipientId}`,
            );
          }
        }

        if (inserted) {
          syncOwnerAllowFrom(storage, configPath);
        }

        updateChannelRecipientsForAccounts(params.channelId, accountId);

        return { inserted, membershipChanged };
      },

      /**
       * Create a new channel account.
       * Writes to SQLite + config file, updates MST state, triggers full config rebuild.
       */
      addAccount(params: {
        channelId: string;
        accountId: string;
        name?: string;
        config: Record<string, unknown>;
        secrets?: Record<string, string>;
      }) {
        return upsertAccountState(params);
      },

      /**
       * Maintain the app-managed Telegram account that talks to RivonClaw's
       * support/debug relay. User-owned Telegram accounts remain untouched.
       */
      syncTelegramDebugProxyAccount(params: {
        proxyToken?: string | null;
        apiRoot: string;
        deviceId: string;
        writeConfig?: boolean;
      }): { changed: boolean; channelId: string; accountId: string } {
        const { storage } = getEnv();
        const proxyToken = params.proxyToken?.trim() ?? "";
        const accountId = RIVONCLAW_TELEGRAM_DEBUG_ACCOUNT_ID;

        if (!proxyToken) {
          if (!storage.channelAccounts.get(TELEGRAM_CHANNEL_ID, accountId)) {
            return { changed: false, channelId: TELEGRAM_CHANNEL_ID, accountId };
          }
          removeAccountById(TELEGRAM_CHANNEL_ID, accountId, { writeConfig: params.writeConfig });
          return { changed: true, channelId: TELEGRAM_CHANNEL_ID, accountId };
        }

        const desiredConfig = buildTelegramDebugAccountConfig(proxyToken, params.apiRoot, params.deviceId);
        const existing = storage.channelAccounts.get(TELEGRAM_CHANNEL_ID, accountId);
        if (
          existing?.name === RIVONCLAW_TELEGRAM_DEBUG_ACCOUNT_NAME &&
          stableJson(existing.config) === stableJson(desiredConfig)
        ) {
          return { changed: false, channelId: TELEGRAM_CHANNEL_ID, accountId };
        }

        upsertAccountState({
          channelId: TELEGRAM_CHANNEL_ID,
          accountId,
          name: RIVONCLAW_TELEGRAM_DEBUG_ACCOUNT_NAME,
          config: desiredConfig,
          writeConfig: params.writeConfig,
        });

        return { changed: true, channelId: TELEGRAM_CHANNEL_ID, accountId };
      },

      /**
       * Update an existing channel account.
       * Reads existing config, merges new values, writes back to SQLite + config file.
       */
      updateAccount(params: {
        channelId: string;
        accountId: string;
        name?: string;
        config: Record<string, unknown>;
        secrets?: Record<string, string>;
      }) {
        const { storage } = getEnv();

        // Defensive canonicalization (see addAccount for rationale).
        if (params.channelId === "openclaw-weixin") {
          params = { ...params, accountId: normalizeWeixinAccountId(params.accountId) };
        }

        const existingAccount = storage.channelAccounts.get(params.channelId, params.accountId);
        const existingAccountConfig = existingAccount?.config ?? {};

        let accountConfig: Record<string, unknown> = { ...existingAccountConfig, ...params.config };

        if (params.name !== undefined) {
          accountConfig.name = params.name;
        }

        // Merge secrets
        if (params.secrets && typeof params.secrets === "object") {
          for (const [secretKey, secretValue] of Object.entries(params.secrets)) {
            if (secretValue) {
              accountConfig[secretKey] = secretValue;
            } else {
              delete accountConfig[secretKey];
            }
          }
        }
        accountConfig = sanitizeChannelAccountConfig(params.channelId, accountConfig);

        // Persist UI-owned account metadata to SQLite. Provider-owned WeChat
        // identity stays in the WeChat sidecar files.
        const savedAccount = storage.channelAccounts.upsert(params.channelId, params.accountId, params.name ?? null, accountConfig);

        // Update MST state via root store
        const entry = buildChannelAccountSnapshot(savedAccount);
        (getRoot(self) as any).upsertChannelAccount(entry);
        writeChannelAccountsSnapshot(params.channelId);

        return entry;
      },

      /**
       * Remove a channel account.
       * Cleans up config file, state files (WeChat), allowFrom files, and SQLite.
       */
      removeAccount(channelId: string, accountId: string) {
        removeAccountById(channelId, accountId);
      },

      // -----------------------------------------------------------------------
      // Channel status
      // -----------------------------------------------------------------------

      /**
       * Query channel status from the gateway and enrich with dmPolicy.
       * The RPC client must be obtained by the caller (route handler awaits gateway readiness).
       */
      getChannelStatus: flow(function* (
        rpcClient: GatewayRpcClient,
        probe: boolean,
        probeTimeoutMs: number,
        clientTimeoutMs: number,
      ) {
        const snapshot: ChannelsStatusSnapshot = yield rpcClient.request(
          "channels.status",
          { probe, timeoutMs: probeTimeoutMs },
          clientTimeoutMs,
        );

        // Enrich with dmPolicy. Read from config file for the full fallback chain
        // (account config → channel root config → "pairing").
        try {
          const { configPath } = getEnv();
          const fullConfig = readExistingConfig(configPath);
          const channelsCfg = (fullConfig.channels ?? {}) as Record<string, Record<string, unknown>>;

          for (const [channelId, accounts] of Object.entries(snapshot.channelAccounts)) {
            const chCfg = channelsCfg[channelId] ?? {};
            const rootDmPolicy = chCfg.dmPolicy as string | undefined;
            const accountsCfg = (chCfg.accounts ?? {}) as Record<string, Record<string, unknown>>;

            for (const account of accounts) {
              if (!account.dmPolicy) {
                const acctCfg = accountsCfg[account.accountId];
                account.dmPolicy = (acctCfg?.dmPolicy as string) ?? rootDmPolicy ?? "pairing";
              }

            }
          }
        } catch {
          // Non-critical enrichment
        }

        return snapshot;
      }),

      // -----------------------------------------------------------------------
      // Pairing operations
      // -----------------------------------------------------------------------

      /** Read pending pairing requests for a channel/account from its pairing state file. */
      getPairingRequests: flow(function* (channelId: string, accountId?: string) {
        const requests = (yield readPairingRequests(channelId)) as PairingRequest[];
        const filtered = requests.filter((request) => requestMatchesAccountId(request, accountId));
        if (accountId && channelId !== "mobile") {
          updateChannelAccountRecipients(channelId, accountId);
        }
        return filtered;
      }),

      /**
       * Approve a pairing request: validate code, update allowlist, register recipient.
       * Returns the recipient ID and the matched pairing entry.
       */
      approvePairing: flow(function* (params: { channelId: string; code: string; accountId?: string }) {
        const requests: PairingRequest[] = yield readPairingRequests(params.channelId);
        const codeUpper = params.code.trim().toUpperCase();
        const requestIndex = requests.findIndex((r) => (
          r.code.toUpperCase() === codeUpper && requestMatchesAccountId(r, params.accountId)
        ));

        if (requestIndex < 0) {
          throw new Error("Pairing code not found or expired");
        }

        const request = requests[requestIndex];
        const accountId = request.meta?.accountId ?? params.accountId;

        // Remove from pairing requests
        requests.splice(requestIndex, 1);
        yield writePairingRequests(params.channelId, requests);

        // Add to allowlist
        const allowlist: string[] = yield readAllowFromList(params.channelId, accountId);
        if (!allowlist.includes(request.id)) {
          allowlist.push(request.id);
          yield writeAllowFromList(params.channelId, allowlist, accountId);
        }

        // Every new recipient is provisioned as owner by default; single-operator is
        // the common case. Users can demote via the Role toggle in the Channels page.
        const { storage, configPath } = getEnv();
        const inserted = storage.channelRecipients.ensureExists(params.channelId, request.id, true);
        if (inserted) {
          syncOwnerAllowFrom(storage, configPath);
        }

        if (accountId) {
          updateChannelAccountRecipients(params.channelId, accountId);
        } else {
          updateChannelRecipientsForAccounts(params.channelId);
        }

        log.info(`Approved pairing for ${params.channelId}: ${request.id}`);

        return { recipientId: request.id, entry: request };
      }),

      /**
       * Get the merged allowlist for a channel, enriched with labels and owner flags.
       *
       * Two sources converge here:
       *   1. AllowFrom files under the credentials dir — populated by pairing-flow
       *      channels (Telegram, Feishu) via `approvePairing`.
       *   2. SQLite `channel_recipients` rows — populated by BOTH pairing-flow
       *      channels (same code path) AND non-pairing channels (WeChat) via the
       *      gateway's `rivonclaw.recipient-seen` broadcast (see
       *      `apps/desktop/src/gateway/event-dispatcher.ts`).
       *
       * Every SQLite row is added to the returned allowlist even when no
       * allowFrom entry exists, so WeChat recipients that have no pairing file
       * still show up in the Channels page.
       *
       * For WeChat, recipients are account-scoped: each QR login account has
       * its own allowFrom file, supplemented by persisted context-token files
       * from older onboarded installs. Labels/owner flags remain channel-wide metadata.
       */
      getAllowlist: flow(function* (channelId: string, accountId?: string) {
        const { storage, stateDir } = getEnv();

        if (accountId && channelId !== "mobile") {
          return updateChannelAccountRecipients(channelId, accountId);
        }

        const isWeixinScoped = channelId === WEIXIN_CHANNEL_ID && Boolean(accountId);
        const entries = new Set<string>(yield readAllAllowFromLists(channelId));
        if (isWeixinScoped && accountId) {
          for (const recipientId of yield readWeixinContextTokenRecipientIds(stateDir, accountId)) {
            entries.add(recipientId);
          }
        }
        const meta = storage.channelRecipients.getRecipientMeta(channelId);
        const labels: Record<string, string> = {};
        const owners: Record<string, boolean> = {};
        for (const [id, data] of Object.entries(meta)) {
          if (data.label) labels[id] = data.label;
          owners[id] = data.isOwner;
          if (!isWeixinScoped) {
            // Surface recipients persisted via the recipient-seen path even when
            // they have no allowFrom file entry.
            entries.add(id);
          }
        }

        return { allowlist: [...entries], labels, owners };
      }),

      /** Set a display label for a recipient. Empty label removes the recipient metadata. */
      setRecipientLabel(channelId: string, recipientId: string, label: string, accountId?: string) {
        const { storage } = getEnv();
        if (label.trim()) {
          storage.channelRecipients.setLabel(channelId, recipientId, label.trim());
        } else {
          storage.channelRecipients.delete(channelId, recipientId);
        }
        updateChannelRecipientsForAccounts(channelId, accountId);
      },

      /** Set or unset the owner flag for a recipient. Syncs ownerAllowFrom to config. */
      setRecipientOwner(channelId: string, recipientId: string, isOwner: boolean, accountId?: string) {
        const { storage, configPath } = getEnv();
        storage.channelRecipients.ensureExists(channelId, recipientId);
        storage.channelRecipients.setOwner(channelId, recipientId, isOwner);
        syncOwnerAllowFrom(storage, configPath);
        updateChannelRecipientsForAccounts(channelId, accountId);
      },

      /**
       * Remove an entry from a channel's allowlist.
       * For mobile channel, delegates to MobileManager.
       * Returns whether the allowlist was changed.
       */
      removeFromAllowlist: flow(function* (channelId: string, entry: string, accountId?: string) {
        const { storage, configPath } = getEnv();

        // Mobile channel: delegate full cleanup to MobileManager
        if (channelId === "mobile") {
          const mobileManager = self.root.mobileManager;
          if (mobileManager?.initialized) {
            const match = (self.root.mobilePairings as any[]).find(
              (p: any) => p.pairingId === entry || p.id === entry,
            );
            if (match) {
              mobileManager.removePairing(match.id);
              return { changed: true };
            }
          }
          return { changed: false };
        }

        // Generic channel: remove entry from the scoped allowFrom file when
        // an account is provided; otherwise preserve the legacy channel-wide
        // cleanup behavior.
        let changed = false;
        const credentialsDir = resolveCredentialsDir();
        const prefix = `${channelId}-`;
        const suffix = "-allowFrom.json";

        let files: string[];
        if (accountId) {
          files = [basename(resolveAllowFromPathForChannel(channelId, accountId))];
          if (shouldIncludeLegacyAllowFromEntries(accountId)) {
            files.push(basename(resolveAllowFromPathForChannel(channelId)));
          }
        } else {
          try {
            files = yield fs.readdir(credentialsDir);
          } catch (err: any) {
            if (err.code === "ENOENT") files = [];
            else throw err;
          }
        }

        for (const file of files) {
          if (!file.startsWith(prefix) || !file.endsWith(suffix)) continue;
          const filePath = join(credentialsDir, file);
          try {
            const content: string = yield fs.readFile(filePath, "utf-8");
            const data: AllowFromStore = JSON.parse(content);
            if (!Array.isArray(data.allowFrom)) continue;
            const filtered = data.allowFrom.filter((e: string) => e !== entry);
            if (filtered.length !== data.allowFrom.length) {
              yield fs.writeFile(filePath, JSON.stringify({ version: 1, allowFrom: filtered }, null, 2) + "\n", "utf-8");
              changed = true;
            }
          } catch {
            // Skip unreadable files
          }
        }

        if (changed) {
          log.info(`Removed from ${channelId} allowlist: ${entry}`);
        }

        storage.channelRecipients.delete(channelId, entry);
        syncOwnerAllowFrom(storage, configPath);
        updateChannelRecipientsForAccounts(channelId, accountId);

        return { changed };
      }),

      // -----------------------------------------------------------------------
      // QR Login (WeChat)
      // -----------------------------------------------------------------------

      /** Start WeChat QR login. Caller must provide a ready RPC client. */
      startQrLogin: flow(function* (
        rpcClient: GatewayRpcClient,
        accountId?: string,
      ) {
        return (yield rpcClient.request(RIVONCLAW_WEIXIN_LOGIN_START, { accountId })) as {
          connected?: boolean;
          qrDataUrl?: string;
          message: string;
          accountId?: string;
          sessionKey?: string;
          userId?: string;
        };
      }),

      /** Wait for WeChat QR login scan. Long-poll -- caller must provide a ready RPC client. */
      waitQrLogin: flow(function* (
        rpcClient: GatewayRpcClient,
        accountId?: string,
        timeoutMs?: number,
        sessionKey?: string,
      ) {
        const { storage, stateDir } = getEnv();
        const serverPollMs = timeoutMs ?? 60_000;
        const rpcTimeoutMs = serverPollMs + 15_000;
        const result = (yield rpcClient.request(
          RIVONCLAW_WEIXIN_LOGIN_WAIT,
          { accountId, timeoutMs, sessionKey },
          rpcTimeoutMs,
        )) as { connected: boolean; message: string; accountId?: string; userId?: string };

        if (isWeixinAlreadyConnectedQrResult(result)) {
          const existingAccounts = storage.channelAccounts.list(WEIXIN_CHANNEL_ID);
          if (existingAccounts.length === 1) {
            const existingAccountId = normalizeWeixinAccountId(existingAccounts[0]!.accountId);
            log.info(`WeChat QR login returned already-connected; treating ${existingAccountId} as existing account`);
            refreshWeixinContextTokenStatus(existingAccountId);
            return {
              ...result,
              connected: true,
              accountId: existingAccountId,
              accountName: existingAccountId,
              accountStatus: "existing",
            };
          }
          log.warn(
            `WeChat QR login returned already-connected but could not resolve a unique account `
            + `(count=${existingAccounts.length})`,
          );
        }

        if (!result.connected || !result.accountId) return result;

        const canonicalAccountId = normalizeWeixinAccountId(result.accountId);
        const accountStatus = storage.channelAccounts.get(WEIXIN_CHANNEL_ID, canonicalAccountId)
          ? "existing"
          : "created";

        const userId = (typeof result.userId === "string" && result.userId.trim())
          ? result.userId.trim()
          : yield readWeixinAccountUserId(stateDir, canonicalAccountId);

        const weixinAccounts = storage.channelAccounts.list(WEIXIN_CHANNEL_ID);
        let staleAccountIds: string[] = [];
        let replacementAccountName: string | undefined;

        if (userId) {
          yield addAllowFromEntry(WEIXIN_CHANNEL_ID, canonicalAccountId, userId);

          const indexedAccountIds: Set<string> = yield readIndexedWeixinAccountIds(stateDir);
          const accountFileExists = new Set<string>();
          const accountUserIds = new Map<string, string | undefined>();

          for (const account of weixinAccounts) {
            const existingAccountId = normalizeWeixinAccountId(account.accountId);
            const existingUserId: string | undefined = yield readWeixinAccountUserId(stateDir, existingAccountId);
            accountUserIds.set(existingAccountId, existingUserId);
            if (yield hasWeixinAccountFile(stateDir, existingAccountId)) {
              accountFileExists.add(existingAccountId);
            }
          }

          staleAccountIds = selectStaleWeixinAccountIdsForLogin({
            accounts: weixinAccounts,
            currentAccountId: canonicalAccountId,
            userId,
            accountUserIds,
            indexedAccountIds,
            accountFileExists,
          });
          replacementAccountName = selectWeixinReplacementAccountName({
            accounts: weixinAccounts,
            currentAccountId: canonicalAccountId,
            staleAccountIds,
          });
        }

        for (const staleAccountId of staleAccountIds) {
          yield mergeAccountAllowFromList(WEIXIN_CHANNEL_ID, staleAccountId, canonicalAccountId);
          removeAccountById(WEIXIN_CHANNEL_ID, staleAccountId, { writeConfig: false });
        }

        if (staleAccountIds.length > 0) {
          log.info(
            `Merged duplicate WeChat account(s) for userId=${userId}: `
            + `${staleAccountIds.join(", ")} -> ${canonicalAccountId}`,
          );
        }

        const accountName = replacementAccountName ?? canonicalAccountId;
        upsertAccountState({
          channelId: WEIXIN_CHANNEL_ID,
          accountId: canonicalAccountId,
          name: accountName,
          config: {},
          writeConfig: false,
        });
        loadWeixinContextTokens(canonicalAccountId);
        writeChannelAccountsSnapshot(WEIXIN_CHANNEL_ID);

        return {
          ...result,
          accountId: canonicalAccountId,
          ...(userId ? { userId } : {}),
          accountName,
          accountStatus,
        };
      }),
    };
  });

export type ChannelManagerInstance = Instance<typeof ChannelManagerModel>;
