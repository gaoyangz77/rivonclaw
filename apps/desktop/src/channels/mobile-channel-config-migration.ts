import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createLogger } from "@rivonclaw/logger";

const log = createLogger("mobile-channel-migration");

/**
 * One-shot boot-time migration for `openclaw.json`.
 *
 * Older desktop builds persisted `channels.mobile.managed=true` so vendor
 * startup would treat mobile as a configured channel before the pairing-backed
 * RivonClaw mobile plugin migration was complete. Mobile is now owned solely
 * through SQLite pairings + plugins.entries; leaving the old `channels.mobile`
 * block in config lets vendor auto-enable its legacy bundled
 * `mobile-chat-channel`, which then collides with
 * `rivonclaw-mobile-chat-channel` during startup.
 *
 * This helper removes the stale `channels.mobile` subtree in-place before the
 * first post-upgrade gateway write. It is safe to run on every boot — once the
 * key is gone, the migration is a no-op and the file bytes are left unchanged.
 */
export function migrateLegacyMobileChannelConfig(configPath: string): void {
  if (!existsSync(configPath)) return;

  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch (err) {
    log.warn(`failed to read ${configPath}:`, err);
    return;
  }

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    log.warn(`failed to parse ${configPath} — skipping legacy mobile channel migration:`, err);
    return;
  }

  const channels = (config.channels ?? null) as Record<string, unknown> | null;
  if (!channels || typeof channels !== "object") return;
  if (!Object.prototype.hasOwnProperty.call(channels, "mobile")) return;

  delete channels.mobile;
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  log.info(`removed legacy channels.mobile config from ${configPath}`);
}
