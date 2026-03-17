// TODO(cleanup): Remove this migration module after v1.8.0 when most users
// have upgraded past the EasyClaw → RivonClaw rebrand. Also remove the hook
// in main.ts (~line 300).

import { homedir, hostname, userInfo } from "node:os";
import { join } from "node:path";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { platform } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from "node:crypto";
import { createLogger } from "@rivonclaw/logger";

const execFileAsync = promisify(execFile);
const log = createLogger("rebrand-migration");

const OLD_DIR_NAME = ".easyclaw";
const NEW_DIR_NAME = ".rivonclaw";
const OLD_SERVICE_PREFIX = "easyclaw/";
const NEW_SERVICE_PREFIX = "rivonclaw/";
const NEW_ACCOUNT = "rivonclaw";

/** Relative paths (from ~/.easyclaw) that contain irreplaceable user data. */
const PATHS_TO_COPY = [
  "db.sqlite",
  "secrets",
  "openclaw/credentials",
  "openclaw/session-state",
  "openclaw/delivery-queue",
  "openclaw/devices",
  "openclaw/feishu",
  "openclaw/mobile-sync",
  "openclaw/media",
  "openclaw/cron",
  "openclaw/identity",
  "openclaw/workspace",
];

/**
 * One-time migration from EasyClaw → RivonClaw.
 *
 * Selectively copies irreplaceable user data from ~/.easyclaw → ~/.rivonclaw,
 * re-encrypts file-based secrets (Windows/Linux), and migrates macOS Keychain
 * entries.
 *
 * If ~/.rivonclaw already exists (e.g. from a previous launch that initialized
 * an empty db/schema), the copied data is merged into it — existing files are
 * overwritten with the real data from ~/.easyclaw.
 *
 * Migration failure does NOT prevent the app from starting.
 */
export async function migrateFromEasyClaw(): Promise<void> {
  try {
    const home = homedir();
    const oldDir = join(home, OLD_DIR_NAME);
    const newDir = join(home, NEW_DIR_NAME);

    // Skip if old directory doesn't exist (fresh install, nothing to migrate)
    if (!existsSync(oldDir)) {
      log.debug("~/.easyclaw does not exist — nothing to migrate");
      return;
    }

    // One-time guard: marker file ensures we never run twice.
    const markerCheck = join(newDir, ".migrated-from-easyclaw");
    if (existsSync(markerCheck)) {
      log.debug("Migration marker exists — already migrated");
      return;
    }

    log.info("Starting rebrand migration: ~/.easyclaw → ~/.rivonclaw (selective copy)");

    // Ensure the target directory exists (may already exist from app init)
    mkdirSync(newDir, { recursive: true });

    // Selectively copy irreplaceable user data
    copyUserData(oldDir, newDir);

    // Migrate secrets
    if (platform() === "darwin") {
      await migrateKeychainEntries();
    } else {
      reEncryptFileSecrets(join(newDir, "secrets"));
    }

    // Write marker — after this point migration never runs again
    const marker = join(newDir, ".migrated-from-easyclaw");
    writeFileSync(marker, new Date().toISOString(), "utf-8");
    log.info("Rebrand migration complete");

    // Best-effort cleanup of old directory
    try {
      rmSync(oldDir, { recursive: true, force: true });
      log.info("Removed old ~/.easyclaw");
    } catch (cleanupErr) {
      log.warn("Could not remove old ~/.easyclaw (Windows file locks?):", cleanupErr);
    }
  } catch (err) {
    log.error("Rebrand migration failed (app will continue):", err);
  }
}

/**
 * Copy each entry in PATHS_TO_COPY from oldDir to newDir.
 * Files are copied with `copyFileSync`; directories with `cpSync` (recursive).
 * Missing source paths are silently skipped — not every user has every dir.
 */
function copyUserData(oldDir: string, newDir: string): void {
  for (const relPath of PATHS_TO_COPY) {
    const src = join(oldDir, relPath);
    if (!existsSync(src)) {
      log.debug(`Skipping ${relPath} — does not exist`);
      continue;
    }

    const dest = join(newDir, relPath);

    try {
      // Check if source is a directory (cpSync) or file (copyFileSync)
      // by attempting cpSync with recursive — for a file this would fail,
      // so we use a simple heuristic: known file entries vs directory entries.
      if (relPath === "db.sqlite") {
        mkdirSync(join(dest, ".."), { recursive: true });
        copyFileSync(src, dest);
      } else {
        mkdirSync(dest, { recursive: true });
        cpSync(src, dest, { recursive: true });
      }
      log.info(`Copied ${relPath}`);
    } catch (err) {
      log.warn(`Failed to copy ${relPath}:`, err);
    }
  }
}

/**
 * Re-encrypt file-based secrets from the old "easyclaw" salt to the new "rivonclaw" salt.
 * Used on Windows and Linux where secrets are AES-256-GCM encrypted files.
 */
function reEncryptFileSecrets(secretsDir: string): void {
  if (!existsSync(secretsDir)) return;

  const IV_LENGTH = 16;
  const AUTH_TAG_LENGTH = 16;
  const ALGORITHM = "aes-256-gcm" as const;

  const user = userInfo().username;
  const host = hostname();

  const oldKey = scryptSync("easyclaw-" + host + "-" + user, "easyclaw-v0-salt", 32);
  const newKey = scryptSync("rivonclaw-" + host + "-" + user, "rivonclaw-v0-salt", 32);

  let files: string[];
  try {
    files = readdirSync(secretsDir).filter((f) => f.endsWith(".enc"));
  } catch {
    return;
  }

  if (files.length === 0) return;
  log.info(`Re-encrypting ${files.length} secret file(s) with new salt`);

  for (const file of files) {
    const filePath = join(secretsDir, file);
    try {
      const data = readFileSync(filePath);
      const iv = data.subarray(0, IV_LENGTH);
      const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
      const decipher = createDecipheriv(ALGORITHM, oldKey, iv);
      decipher.setAuthTag(authTag);
      const plaintext = decipher.update(ciphertext) + decipher.final("utf8");

      const newIv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, newKey, newIv);
      const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const newAuthTag = cipher.getAuthTag();
      writeFileSync(filePath, Buffer.concat([newIv, newAuthTag, encrypted]));

      log.info(`Re-encrypted secret: ${file}`);
    } catch (err) {
      log.warn(`Failed to re-encrypt secret "${file}":`, err);
    }
  }
}

/**
 * Find all `easyclaw/*` keychain entries and re-save them under `rivonclaw/*`.
 * Old entries are kept as backup.
 */
async function migrateKeychainEntries(): Promise<void> {
  log.info("Migrating macOS Keychain entries...");

  const { stdout } = await execFileAsync("security", ["dump-keychain"]);
  const keys: string[] = [];
  const serviceRegex = /"svce"<blob>="easyclaw\/([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = serviceRegex.exec(stdout)) !== null) {
    keys.push(match[1]);
  }

  if (keys.length === 0) {
    log.info("No easyclaw/* keychain entries found");
    return;
  }

  log.info(`Found ${keys.length} keychain entries to migrate`);

  for (const key of keys) {
    try {
      const { stdout: password } = await execFileAsync("security", [
        "find-generic-password",
        "-s", OLD_SERVICE_PREFIX + key,
        "-w",
      ]);

      await execFileAsync("security", [
        "add-generic-password",
        "-s", NEW_SERVICE_PREFIX + key,
        "-a", NEW_ACCOUNT,
        "-w", password.trim(),
        "-U",
      ]);

      log.info(`Migrated keychain entry: ${key}`);
    } catch (err) {
      log.warn(`Failed to migrate keychain entry "${key}":`, err);
    }
  }
}
