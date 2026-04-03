import { createLogger } from "@rivonclaw/logger";
import { readExistingConfig } from "@rivonclaw/gateway";
import type { Storage } from "@rivonclaw/storage";

const log = createLogger("migrate-channel-accounts");

/**
 * One-time migration: import channel accounts from openclaw.json into SQLite.
 *
 * Before v2026.4.1, channel plugin entries (e.g. `plugins.entries.telegram`)
 * lived only in the config file. writeGatewayConfig could overwrite them,
 * causing channels to disappear. Now SQLite `channel_accounts` is the source
 * of truth, and gateway-config-builder generates plugin entries from it.
 *
 * This migration reads `channels.<id>.accounts.<acctId>` from the existing
 * config and inserts any accounts not already in SQLite. It runs once on
 * startup and is idempotent (skips accounts that already exist).
 */
export function migrateChannelAccountsFromConfig(
  storage: Storage,
  configPath: string,
): void {
  const existing = storage.channelAccounts.list();
  const existingKeys = new Set(existing.map(a => `${a.channelId}:${a.accountId}`));

  let config: Record<string, unknown>;
  try {
    config = readExistingConfig(configPath);
  } catch {
    return; // No config file yet
  }

  const channels = config.channels;
  if (!channels || typeof channels !== "object") return;

  let migrated = 0;
  for (const [channelId, channelData] of Object.entries(channels as Record<string, unknown>)) {
    if (!channelData || typeof channelData !== "object") continue;
    const accounts = (channelData as Record<string, unknown>).accounts;
    if (!accounts || typeof accounts !== "object") continue;

    for (const [accountId, accountData] of Object.entries(accounts as Record<string, unknown>)) {
      const key = `${channelId}:${accountId}`;
      if (existingKeys.has(key)) continue;

      const acctObj = typeof accountData === "object" && accountData !== null
        ? (accountData as Record<string, unknown>)
        : {};

      storage.channelAccounts.upsert(
        channelId,
        accountId,
        typeof acctObj.name === "string" ? acctObj.name : null,
        acctObj,
      );
      migrated++;
    }
  }

  if (migrated > 0) {
    log.info(`Migrated ${migrated} channel account(s) from config to SQLite`);
  }
}
