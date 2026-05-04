import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createLogger } from "@rivonclaw/logger";

const log = createLogger("legacy-openclaw-config-migration");

const REMOVED_PLUGIN_IDS = new Set([
  "wecom",
  "dingtalk",
  "tiktok-shop",
  "rivonclaw-ecommerce",
  "google-gemini-cli-auth",
  "qwen-portal-auth",
  "mobile",
  "modelstudio",
  "easyclaw-tools",
  "rivonclaw-tools",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function pruneRemovedPluginIds(value: unknown): { value: unknown; changed: boolean } {
  if (!Array.isArray(value)) return { value, changed: false };
  const next = value.filter((entry) => typeof entry !== "string" || !REMOVED_PLUGIN_IDS.has(entry));
  return { value: next, changed: next.length !== value.length };
}

/**
 * Remove config keys that older RivonClaw builds wrote but OpenClaw no longer
 * accepts or ships. Run before the first post-upgrade gateway config write so
 * vendor startup does not warn on stale fields.
 */
export function migrateLegacyOpenClawConfig(configPath: string): void {
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
    log.warn(`failed to parse ${configPath} - skipping legacy OpenClaw config migration:`, err);
    return;
  }

  const touched: string[] = [];

  const agents = config.agents;
  const defaults = isRecord(agents) && isRecord(agents.defaults) ? agents.defaults : undefined;
  if (defaults && Object.prototype.hasOwnProperty.call(defaults, "llm")) {
    delete defaults.llm;
    touched.push("agents.defaults.llm");
  }

  const plugins = config.plugins;
  if (isRecord(plugins)) {
    const allow = pruneRemovedPluginIds(plugins.allow);
    if (allow.changed) {
      plugins.allow = allow.value;
      touched.push("plugins.allow");
    }

    const deny = pruneRemovedPluginIds(plugins.deny);
    if (deny.changed) {
      plugins.deny = deny.value;
      touched.push("plugins.deny");
    }

    const entries = plugins.entries;
    if (isRecord(entries)) {
      for (const pluginId of Object.keys(entries)) {
        if (!REMOVED_PLUGIN_IDS.has(pluginId)) continue;
        delete entries[pluginId];
        touched.push(`plugins.entries.${pluginId}`);
      }
    }
  }

  if (touched.length === 0) return;

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  log.info(`removed legacy OpenClaw config keys in ${configPath}: ${[...new Set(touched)].join(", ")}`);
}
