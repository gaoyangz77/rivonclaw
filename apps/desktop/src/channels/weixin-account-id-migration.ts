import { existsSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeWeixinAccountId } from "@rivonclaw/core";
import { resolveOpenClawStateDir } from "@rivonclaw/core/node";
import { createLogger } from "@rivonclaw/logger";
import { writeDesktopOpenClawConfig } from "../gateway/openclaw-config-mutation.js";

const log = createLogger("weixin-migration");
const WEIXIN_CHANNEL_ID = "openclaw-weixin";

function parseLegacyWeixinStateFile(fileName: string): { accountId: string; suffix: string } | null {
  const match = /^(.+@im\.(?:bot|wechat))(\.context-tokens\.json|\.sync\.json|\.json)$/.exec(fileName);
  if (!match) return null;
  return { accountId: match[1], suffix: match[2] };
}

function readJsonObject(filePath: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function mergeContextTokenFiles(rawPath: string, canonicalPath: string): void {
  const rawTokens = readJsonObject(rawPath);
  const canonicalTokens = readJsonObject(canonicalPath);
  if (!rawTokens || !canonicalTokens) {
    unlinkSync(rawPath);
    return;
  }

  // Canonical file wins on conflicts: it is the file restored by the current
  // weixin runtime for this accountId.
  writeFileSync(
    canonicalPath,
    JSON.stringify({ ...rawTokens, ...canonicalTokens }, null, 0),
    "utf-8",
  );
  unlinkSync(rawPath);
}

function migrateWeixinAccountStateFiles(): void {
  const accountsDir = join(resolveOpenClawStateDir(), WEIXIN_CHANNEL_ID, "accounts");
  if (!existsSync(accountsDir)) return;

  let fileNames: string[];
  try {
    fileNames = readdirSync(accountsDir);
  } catch (err) {
    log.warn(`failed to read weixin accounts dir ${accountsDir}:`, err);
    return;
  }

  let migrated = 0;
  for (const fileName of fileNames) {
    const parsed = parseLegacyWeixinStateFile(fileName);
    if (!parsed) continue;

    const canonicalAccountId = normalizeWeixinAccountId(parsed.accountId);
    if (canonicalAccountId === parsed.accountId) continue;

    const rawPath = join(accountsDir, fileName);
    const canonicalPath = join(accountsDir, `${canonicalAccountId}${parsed.suffix}`);

    try {
      if (!existsSync(canonicalPath)) {
        renameSync(rawPath, canonicalPath);
      } else if (parsed.suffix === ".context-tokens.json") {
        mergeContextTokenFiles(rawPath, canonicalPath);
      } else {
        // For credentials and sync buffers the canonical runtime file is newer
        // source-of-truth; drop the legacy duplicate.
        unlinkSync(rawPath);
      }
      migrated++;
    } catch (err) {
      log.warn(`failed to migrate weixin state file ${rawPath}:`, err);
    }
  }

  if (migrated > 0) {
    log.info(`migrated ${migrated} weixin account state file(s) to canonical accountIds`);
  }
}

/**
 * One-shot boot-time migration for `openclaw.json` and account sidecar files.
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
  migrateWeixinAccountStateFiles();

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
    writeDesktopOpenClawConfig(configPath, config, "weixin account id migration");
    log.info(`migrated weixin account keys in ${configPath}`);
  }
}
