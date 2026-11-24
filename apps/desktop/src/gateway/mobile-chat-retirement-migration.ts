import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { clearVendorChannelAllowFrom } from "@rivonclaw/gateway";
import { createLogger } from "@rivonclaw/logger";
import { writeDesktopOpenClawConfig } from "./openclaw-config-mutation.js";

const log = createLogger("mobile-chat-retirement-migration");

const MOBILE_CHANNEL_ID = "mobile";
const MOBILE_PLUGIN_IDS = new Set(["rivonclaw-mobile-chat-channel", "mobile-chat-channel"]);
const MOBILE_OWNER_PREFIX = "mobile:";
const MOBILE_ALLOWLIST_FILE_PREFIX = "mobile-allowFrom.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isMobileBinding(binding: unknown): boolean {
  if (!isRecord(binding) || !isRecord(binding.match)) return false;
  const channel = binding.match.channel;
  return typeof channel === "string" && channel.trim().toLowerCase() === MOBILE_CHANNEL_ID;
}

/** Returns true when the config object was modified. */
function stripMobileChatFromConfig(config: Record<string, unknown>): boolean {
  let changed = false;

  if (isRecord(config.channels) && MOBILE_CHANNEL_ID in config.channels) {
    delete config.channels[MOBILE_CHANNEL_ID];
    changed = true;
  }

  if (Array.isArray(config.bindings)) {
    const next = config.bindings.filter((binding) => !isMobileBinding(binding));
    if (next.length !== config.bindings.length) {
      config.bindings = next;
      changed = true;
    }
  }

  if (isRecord(config.plugins)) {
    const plugins = config.plugins;
    if (isRecord(plugins.entries)) {
      for (const id of MOBILE_PLUGIN_IDS) {
        if (id in plugins.entries) {
          delete plugins.entries[id];
          changed = true;
        }
      }
    }
    for (const key of ["allow", "deny"]) {
      const list = plugins[key];
      if (!Array.isArray(list)) continue;
      const next = list.filter((id) => typeof id !== "string" || !MOBILE_PLUGIN_IDS.has(id));
      if (next.length !== list.length) {
        plugins[key] = next;
        changed = true;
      }
    }
  }

  if (isRecord(config.commands) && Array.isArray(config.commands.ownerAllowFrom)) {
    const owners = config.commands.ownerAllowFrom;
    const next = owners.filter(
      (entry) => typeof entry !== "string" || !entry.startsWith(MOBILE_OWNER_PREFIX),
    );
    if (next.length !== owners.length) {
      config.commands.ownerAllowFrom = next;
      changed = true;
    }
  }

  return changed;
}

function removeIfPresent(path: string): boolean {
  if (!existsSync(path)) return false;
  rmSync(path, { recursive: true, force: true });
  return true;
}

/**
 * One-shot boot-time migration for the retired 爪聊 mobile chat channel.
 *
 * The `rivonclaw-mobile-chat-channel` extension is gone, so OpenClaw would
 * report a leftover `channels.mobile` as an unknown channel id. Strip every
 * config reference, clear the channel's rows from OpenClaw's pairing allowlist
 * table and delete the extension's leftover state files.
 *
 * `media/inbound/mobile/` is intentionally kept: old chat transcripts still
 * reference those files. Idempotent; a no-op on installs that never paired.
 */
export function migrateRetiredMobileChat(configPath: string, stateDir: string): void {
  let configChanged = false;
  if (existsSync(configPath)) {
    let config: Record<string, unknown> | undefined;
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
    } catch (err) {
      log.warn(`failed to read or parse ${configPath} — skipping mobile chat config cleanup:`, err);
    }
    if (config && stripMobileChatFromConfig(config)) {
      writeDesktopOpenClawConfig(configPath, config, "mobile chat retirement migration");
      configChanged = true;
    }
  }

  const allowlistRows = clearVendorChannelAllowFrom(stateDir, MOBILE_CHANNEL_ID);

  const removedFiles: string[] = [];
  const credentialsDir = join(stateDir, "credentials");
  const candidates = [
    join(stateDir, "mobile-sync"),
    join(stateDir, "identity", "mobile-desktop-id.txt"),
    ...(existsSync(credentialsDir)
      ? readdirSync(credentialsDir)
          .filter((name) => name.startsWith(MOBILE_ALLOWLIST_FILE_PREFIX))
          .map((name) => join(credentialsDir, name))
      : []),
  ];
  for (const path of candidates) {
    if (removeIfPresent(path)) removedFiles.push(path);
  }

  if (configChanged || allowlistRows > 0 || removedFiles.length > 0) {
    log.info(
      `retired mobile chat cleanup: config=${configChanged} allowlistRows=${allowlistRows} files=${removedFiles.length}`,
    );
  }
}
