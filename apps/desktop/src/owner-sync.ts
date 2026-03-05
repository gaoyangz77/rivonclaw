import { readExistingConfig, resolveOpenClawConfigPath } from "@easyclaw/gateway";
import type { Storage } from "@easyclaw/storage";
import { writeFileSync } from "node:fs";

/**
 * Sync the owner allowlist from SQLite channel_recipients to the OpenClaw config.
 * Builds commands.ownerAllowFrom from all recipients with is_owner=1,
 * always including "openclaw-control-ui" for the panel webchat client.
 */
export function syncOwnerAllowFrom(storage: Storage, configPath?: string): void {
  const path = configPath ?? resolveOpenClawConfigPath();
  const config = readExistingConfig(path) as Record<string, unknown>;

  const owners = storage.channelRecipients.getOwners();
  const ownerEntries = [
    "openclaw-control-ui",
    ...owners.map((o) => `${o.channelId}:${o.recipientId}`),
  ];
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
  const owners = storage.channelRecipients.getOwners();
  const entries = [
    "openclaw-control-ui",
    ...owners.map((o) => `${o.channelId}:${o.recipientId}`),
  ];
  return [...new Set(entries)];
}
