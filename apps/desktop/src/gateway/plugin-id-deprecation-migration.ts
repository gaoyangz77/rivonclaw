import { existsSync, readFileSync } from "node:fs";
import { createLogger } from "@rivonclaw/logger";
import { writeDesktopOpenClawConfig } from "./openclaw-config-mutation.js";

const log = createLogger("plugin-id-deprecation-migration");

const DEPRECATED_PLUGIN_IDS = new Set(["easyclaw-policy", "rivonclaw-policy"]);

function filterDeprecatedIds(value: unknown): { next: unknown; changed: boolean } {
  if (!Array.isArray(value)) return { next: value, changed: false };
  const next = value.filter((id) => typeof id !== "string" || !DEPRECATED_PLUGIN_IDS.has(id));
  return { next, changed: next.length !== value.length };
}

/**
 * One-shot boot-time migration for `openclaw.json`.
 *
 * The rules/policy layer and its `rivonclaw-policy` extension were removed.
 * Strip stale plugin references during Desktop startup so OpenClaw does not
 * try to load a plugin that no longer exists after upgrade. This only touches
 * the gateway config; SQLite rule/artifact tables are intentionally preserved.
 */
export function migrateDeprecatedPluginIds(configPath: string): void {
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
    log.warn(`failed to parse ${configPath} — skipping deprecated plugin id migration:`, err);
    return;
  }

  const plugins = (config.plugins ?? null) as Record<string, unknown> | null;
  if (!plugins || typeof plugins !== "object" || Array.isArray(plugins)) return;

  let changed = false;
  const entries = (plugins.entries ?? null) as Record<string, unknown> | null;
  if (entries && typeof entries === "object" && !Array.isArray(entries)) {
    for (const id of DEPRECATED_PLUGIN_IDS) {
      if (Object.prototype.hasOwnProperty.call(entries, id)) {
        delete entries[id];
        changed = true;
      }
    }
  }

  for (const key of ["allow", "deny"]) {
    const { next, changed: listChanged } = filterDeprecatedIds(plugins[key]);
    if (listChanged) {
      plugins[key] = next;
      changed = true;
    }
  }

  if (!changed) return;
  writeDesktopOpenClawConfig(configPath, config, "plugin id deprecation migration");
  log.info(`removed deprecated policy plugin ids from ${configPath}`);
}
