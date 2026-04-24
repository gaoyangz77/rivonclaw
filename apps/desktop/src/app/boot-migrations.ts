import { createLogger } from "@rivonclaw/logger";

const log = createLogger("boot-migrations");

/**
 * One-shot, idempotent migrations that run during Desktop startup.
 *
 * Each migration is tagged with `introduced` (the app version that first
 * shipped it) and `removeAfter` (the earliest version where it is safe to
 * delete). When a customer has upgraded past `removeAfter`, their data is
 * guaranteed already migrated and the code can be dropped.
 *
 * Migrations are split into phases because they have different dependency
 * requirements. Each phase runs at a specific point in `main.ts` startup —
 * see call sites there.
 *
 * ── Registry ────────────────────────────────────────────────────────────
 *
 * │ #  │ Name                          │ Phase        │ Introduced │ Remove after │
 * │────│───────────────────────────────│──────────────│────────────│──────────────│
 * │ 1  │ migrateWeixinAccountKeys      │ postConfig   │ v1.7.14    │ v1.9.0       │
 * │ 2  │ migrateFeishuBotName          │ postConfig   │ v1.7.14    │ v1.9.0       │
 * │ 3  │ migrateLegacyMobileChannelConfig │ postConfig │ v1.8.8     │ v2.0.0       │
 *
 * When removing a migration:
 *   1. Delete the corresponding entry from the phase body below.
 *   2. Delete the migration's source file under `../auth/` or `../channels/`.
 *   3. Remove the row from this registry table.
 *   4. If a phase function becomes empty, remove the phase entirely + its
 *      call site in main.ts.
 */

// ── Phase B: post-config ────────────────────────────────────────────────
// Runs AFTER `ensureGatewayConfig()` returns `configPath`, but BEFORE the
// first `writeGatewayConfig` so the gateway reads the migrated file.
//
// Invariant relied on: only Desktop mutates openclaw.json (via
// channel-config-writer). Gateway subprocesses read but never write it.
// If that ever changes, move the stale-gateway-killall in main.ts to run
// BEFORE this phase — otherwise a stale gateway could race the migration.
export async function runPostConfigMigrations(configPath: string): Promise<void> {
  // [1] v1.7.14 · remove after v1.9.0
  // Canonicalize WeChat account keys in openclaw.json from the plugin's
  // raw `xxx@im.bot` form to the canonical dash form `xxx-im-bot`. Paired
  // with SQLite migration 27 (packages/storage) which does the same for
  // `channel_accounts`. See `normalizeWeixinAccountId` in @rivonclaw/core.
  // Idempotent — no-op once all keys are canonical.
  const { migrateWeixinAccountKeys } = await import("../channels/weixin-account-id-migration.js");
  migrateWeixinAccountKeys(configPath);

  // [2] v1.7.14 · remove after v1.9.0
  // Older builds persisted `channels.feishu.accounts.*.botName`, but the
  // current Feishu runtime schema validates account configs strictly and
  // rejects that stale field. Strip it before the gateway reads the file.
  const { migrateFeishuBotName } = await import("../channels/feishu-bot-name-migration.js");
  migrateFeishuBotName(configPath);

  // [3] v1.8.8 · remove after v2.0.0
  // Older builds persisted `channels.mobile.managed=true` to hint vendor
  // startup. Mobile now lives exclusively in SQLite pairings +
  // plugins.entries, so that stale config block causes vendor to auto-enable
  // the legacy bundled mobile plugin and collide with RivonClaw's mobile
  // channel plugin during startup.
  const { migrateLegacyMobileChannelConfig } = await import("../channels/mobile-channel-config-migration.js");
  migrateLegacyMobileChannelConfig(configPath);

  log.debug("post-config migrations complete");
}
