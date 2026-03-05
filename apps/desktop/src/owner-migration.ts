import { createLogger } from "@easyclaw/logger";
import type { Storage } from "@easyclaw/storage";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { syncOwnerAllowFrom } from "./owner-sync.js";

const log = createLogger("owner-migration");

interface AllowFromStore {
  version: number;
  allowFrom: string[];
}

/**
 * One-time backfill: ensure all existing allowFrom entries have channel_recipients
 * rows with is_owner=true. This covers recipients that were paired before the
 * is_owner column existed (they have allowFrom file entries but no SQLite rows).
 */
export async function backfillOwnerMigration(
  storage: Storage,
  stateDir: string,
  configPath?: string,
): Promise<void> {
  if (storage.settings.get("owner-migration-v1")) return;

  const credentialsDir = join(stateDir, "credentials");
  const suffix = "-allowFrom.json";

  let files: string[];
  try {
    files = await fs.readdir(credentialsDir);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      storage.settings.set("owner-migration-v1", "1");
      return;
    }
    throw err;
  }

  let count = 0;
  for (const file of files) {
    if (!file.endsWith(suffix)) continue;

    // Extract channelId from filename: "{channelId}-allowFrom.json" or "{channelId}-{accountId}-allowFrom.json"
    const baseName = file.slice(0, -suffix.length);
    // The channelId is the first segment before the first hyphen that could be an accountId.
    // However, channel IDs can contain hyphens too. The simplest approach: use the part
    // before the last "-allowFrom" suffix, and if it contains a second hyphen that looks
    // like an accountId, split there. But channel IDs in OpenClaw are typically simple
    // like "telegram", "discord", "whatsapp", "signal", "imessage", "slack", "line".
    // The scoped format is "{channelId}-{accountId}-allowFrom.json".
    // We'll try to extract channelId by checking known channel prefixes.
    const channelId = extractChannelId(baseName);
    if (!channelId) continue;

    try {
      const content = await fs.readFile(join(credentialsDir, file), "utf-8");
      const data: AllowFromStore = JSON.parse(content);
      if (!Array.isArray(data.allowFrom)) continue;

      for (const recipientId of data.allowFrom) {
        const id = String(recipientId).trim();
        if (!id) continue;
        storage.channelRecipients.ensureExists(channelId, id, true);
        count++;
      }
    } catch {
      // Skip unreadable files
    }
  }

  if (count > 0) {
    log.info(`Backfilled ${count} existing allowFrom entries as owners`);
    syncOwnerAllowFrom(storage, configPath);
  }

  storage.settings.set("owner-migration-v1", "1");
}

const KNOWN_CHANNELS = [
  "telegram", "discord", "whatsapp", "signal", "imessage",
  "slack", "line", "irc", "msteams", "googlechat", "web",
];

function extractChannelId(baseName: string): string | null {
  // Try exact match first (legacy format: "{channelId}-allowFrom.json" → baseName = channelId)
  if (KNOWN_CHANNELS.includes(baseName)) return baseName;

  // Try scoped format: "{channelId}-{accountId}" → first known channel prefix
  for (const ch of KNOWN_CHANNELS) {
    if (baseName.startsWith(ch + "-")) return ch;
  }

  // Fallback: use the whole baseName as channelId (unknown channel type)
  return baseName;
}
