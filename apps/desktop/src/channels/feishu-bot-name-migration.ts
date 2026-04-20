import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createLogger } from "@rivonclaw/logger";

const log = createLogger("feishu-migration");

/**
 * One-shot boot-time migration for `openclaw.json`.
 *
 * Older RivonClaw/OpenClaw builds persisted `channels.feishu.accounts.*.botName`
 * as a display-only convenience field. Newer Feishu runtime schema validates
 * each account config with `.strict()` and rejects that stale key, causing
 * gateway startup to fail after upgrade.
 *
 * This helper strips `botName` from every Feishu account config in-place
 * before the first post-upgrade gateway write. It is safe to run on every
 * boot: once no account contains `botName`, the migration is a no-op and the
 * file bytes are left unchanged.
 */
export function migrateFeishuBotName(configPath: string): void {
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
    log.warn(`failed to parse ${configPath} — skipping feishu botName migration:`, err);
    return;
  }

  const channels = (config.channels ?? null) as Record<string, unknown> | null;
  const feishu = channels && typeof channels === "object" ? channels.feishu : undefined;
  if (!feishu || typeof feishu !== "object") return;

  const accounts = (feishu as Record<string, unknown>).accounts;
  if (!accounts || typeof accounts !== "object") return;

  let mutated = false;
  for (const account of Object.values(accounts as Record<string, unknown>)) {
    if (!account || typeof account !== "object") continue;
    const accountConfig = account as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(accountConfig, "botName")) continue;
    delete accountConfig.botName;
    mutated = true;
  }

  if (mutated) {
    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    log.info(`removed stale Feishu botName fields in ${configPath}`);
  }
}
