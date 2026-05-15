import { readExistingConfig, resolveOpenClawConfigPath } from "@rivonclaw/gateway";
import type { Storage } from "@rivonclaw/storage";
import { writeFileSync } from "node:fs";
import {
  RIVONCLAW_TELEGRAM_DEBUG_ACCOUNT_ID,
  TELEGRAM_CHANNEL_ID,
  readTelegramDebugOperatorUserIds,
} from "../channels/telegram-debug-support.js";

/**
 * Sync the owner allowlist from SQLite channel_recipients to the OpenClaw config.
 * Builds commands.ownerAllowFrom from all recipients with is_owner=1,
 * always including "openclaw-control-ui" for the panel webchat client.
 */
export function syncOwnerAllowFrom(storage: Storage, configPath?: string): void {
  const path = configPath ?? resolveOpenClawConfigPath();
  const config = readExistingConfig(path) as Record<string, unknown>;

  const ownerEntries = buildOwnerAllowFromEntries(storage);
  const uniqueEntries = [...new Set(ownerEntries)];

  const existingCommands =
    typeof config.commands === "object" && config.commands !== null
      ? (config.commands as Record<string, unknown>)
      : {};
  config.commands = {
    ...existingCommands,
    ownerAllowFrom: uniqueEntries,
  };

  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/**
 * Build the ownerAllowFrom array from storage, for use in writeGatewayConfig().
 */
export function buildOwnerAllowFrom(storage: Storage): string[] {
  return [...new Set(buildOwnerAllowFromEntries(storage))];
}

function buildOwnerAllowFromEntries(storage: Storage): string[] {
  const owners = filterActiveOwnerRecipients(storage);
  return [
    "openclaw-control-ui",
    ...owners.map((o) => `${o.channelId}:${o.recipientId}`),
    ...buildTelegramDebugOwnerEntries(storage),
  ];
}

function buildTelegramDebugOwnerEntries(storage: Storage): string[] {
  // The RivonClaw support account is hidden from recipient lists, so its
  // operators must be injected directly into OpenClaw's owner allowlist.
  if (!storage.channelAccounts.get(TELEGRAM_CHANNEL_ID, RIVONCLAW_TELEGRAM_DEBUG_ACCOUNT_ID)) {
    return [];
  }
  return readTelegramDebugOperatorUserIds(storage).map((id) => `${TELEGRAM_CHANNEL_ID}:${id}`);
}

function filterActiveOwnerRecipients(storage: Storage): Array<{ channelId: string; recipientId: string }> {
  const activeChannelIds = new Set(storage.channelAccounts.list().map((account) => account.channelId));
  activeChannelIds.add("mobile");

  return storage.channelRecipients.getOwners().filter(({ channelId, recipientId }) => (
    activeChannelIds.has(channelId) && !recipientId.startsWith(`${channelId}:`)
  ));
}
