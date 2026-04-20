import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { normalizeWeixinAccountId } from "@rivonclaw/core";
import { createLogger } from "@rivonclaw/logger";

const log = createLogger("weixin-migration");

/**
 * One-shot boot-time migration for `openclaw.json`.
 *
 * The upstream weixin plugin uses `xxx-im-bot` / `xxx-im-wechat` as its
 * canonical account identifier everywhere internal (session keys, file paths,
 * `channels.status` RPC). But `loginWithQrWait` returns the raw `xxx@im.bot`
 * form, and earlier Panel builds stored that raw form into `openclaw.json`
 * via `writeChannelAccount`. On upgrade, those `@`-form account keys never
 * match the gateway's status payload and the Channels page shows `Unknown`
 * for the bot.
 *
 * This helper rewrites any `@`-form keys under
 * `channels["openclaw-weixin"].accounts` to the canonical dash form,
 * preserving the full account config blob (including secrets) so the gateway
 * reads the same data under the new key. It is safe to run on every boot —
 * once all keys are canonical, the `canonical === key` check short-circuits
 * every entry and no write occurs.
 *
 * Failure modes:
 *  - Missing file: no-op (first-run installs).
 *  - Unreadable / corrupted JSON: logs and returns without throwing, so the
 *    main app doesn't crash. Downstream writers will overwrite the file.
 *  - Mutation errors: bubbled up (filesystem errors should surface loudly).
 */
export function migrateWeixinAccountKeys(configPath: string): void {
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
    log.warn(`failed to parse ${configPath} — skipping weixin accountId migration:`, err);
    return;
  }

  const channels = (config.channels ?? null) as Record<string, unknown> | null;
  const weixin = channels && typeof channels === "object" ? channels["openclaw-weixin"] : undefined;
  if (!weixin || typeof weixin !== "object") return;

  const accounts = (weixin as Record<string, unknown>).accounts;
  if (!accounts || typeof accounts !== "object") return;

  const accountsMap = accounts as Record<string, unknown>;
  let mutated = false;

  for (const key of Object.keys(accountsMap)) {
    const canonical = normalizeWeixinAccountId(key);
    if (canonical === key) continue;

    // Conflict: both forms already exist. Dash form is plugin-internal and
    // takes precedence — drop the @ form so the merged view is consistent
    // with the SQLite migration's behaviour.
    if (accountsMap[canonical] !== undefined) {
      delete accountsMap[key];
    } else {
      accountsMap[canonical] = accountsMap[key];
      delete accountsMap[key];
    }
    mutated = true;
  }

  if (mutated) {
    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    log.info(`migrated weixin account keys in ${configPath}`);
  }
}
