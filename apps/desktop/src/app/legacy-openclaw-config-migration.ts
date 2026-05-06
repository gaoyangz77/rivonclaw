import { existsSync, readFileSync } from "node:fs";
import { createLogger } from "@rivonclaw/logger";
import { writeDesktopOpenClawConfig } from "../gateway/openclaw-config-mutation.js";

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

const WEB_SEARCH_PROVIDER_PLUGIN_IDS: Record<string, string> = {
  brave: "brave",
  perplexity: "perplexity",
  grok: "xai",
  gemini: "google",
  kimi: "moonshot",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function pruneRemovedPluginIds(value: unknown): { value: unknown; changed: boolean } {
  if (!Array.isArray(value)) return { value, changed: false };
  const next = value.filter((entry) => typeof entry !== "string" || !REMOVED_PLUGIN_IDS.has(entry));
  return { value: next, changed: next.length !== value.length };
}

function ensureRecord(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  if (isRecord(parent[key])) return parent[key];
  const next: Record<string, unknown> = {};
  parent[key] = next;
  return next;
}

function mergePluginWebSearchConfig(
  config: Record<string, unknown>,
  pluginId: string,
  webSearch: Record<string, unknown>,
): void {
  const plugins = ensureRecord(config, "plugins");
  const entries = ensureRecord(plugins, "entries");
  const entry = ensureRecord(entries, pluginId);
  const entryConfig = ensureRecord(entry, "config");
  const existingWebSearch = isRecord(entryConfig.webSearch) ? entryConfig.webSearch : {};
  entry.enabled = true;
  entryConfig.webSearch = {
    ...webSearch,
    ...existingWebSearch,
  };
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
        if (REMOVED_PLUGIN_IDS.has(pluginId)) {
          delete entries[pluginId];
          touched.push(`plugins.entries.${pluginId}`);
          continue;
        }

      }
    }
  }

  const tools = config.tools;
  const web = isRecord(tools) && isRecord(tools.web) ? tools.web : undefined;
  const search = web && isRecord(web.search) ? web.search : undefined;
  if (search) {
    if (Object.prototype.hasOwnProperty.call(search, "apiKey")) {
      mergePluginWebSearchConfig(config, "brave", {
        apiKey: search.apiKey,
      });
      delete search.apiKey;
      touched.push("tools.web.search.apiKey");
    }

    for (const [providerId, pluginId] of Object.entries(WEB_SEARCH_PROVIDER_PLUGIN_IDS)) {
      const providerConfig = search[providerId];
      if (!isRecord(providerConfig)) continue;
      mergePluginWebSearchConfig(config, pluginId, providerConfig);
      delete search[providerId];
      touched.push(`tools.web.search.${providerId}`);
    }
  }

  if (touched.length === 0) return;

  writeDesktopOpenClawConfig(configPath, config, "legacy openclaw config migration");
  log.info(`removed legacy OpenClaw config keys in ${configPath}: ${[...new Set(touched)].join(", ")}`);
}
