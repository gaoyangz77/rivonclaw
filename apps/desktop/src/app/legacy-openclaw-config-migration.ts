import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readlinkSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
  type Dirent,
} from "node:fs";
import { join } from "node:path";
import { resolveMainAgentWorkspaceDir } from "@rivonclaw/core/node";
import { createLogger } from "@rivonclaw/logger";
import { writeDesktopOpenClawConfig } from "../gateway/openclaw-config-mutation.js";

const log = createLogger("legacy-openclaw-config-migration");

const MAIN_WORKSPACE_COPY_MARKER = ".rivonclaw-main-workspace-migrated-v1";
const MAIN_WORKSPACE_CLEANUP_MARKER = ".rivonclaw-main-workspace-migrated-v2";
const MAIN_WORKSPACE_FILES = [
  "AGENTS.md",
  "SOUL.md",
  "USER.md",
  "IDENTITY.md",
  "TOOLS.md",
  "HEARTBEAT.md",
  "MEMORY.md",
  "DREAMS.md",
] as const;
const MAIN_WORKSPACE_DIRECTORIES = ["memory", "skills"] as const;

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

// Older builds seeded optional providers into plugins.deny to reduce discovery
// overhead. Remove those stale deny references while preserving user entries;
// supported providers that are now packaged must not remain blocked after an
// upgrade, and absent providers do not need negative inventory entries.
const STALE_OPTIONAL_PLUGIN_DENY_IDS = new Set([
  "amazon-bedrock",
  "anthropic-vertex",
  "byteplus",
  "chutes",
  "cloudflare-ai-gateway",
  "deepseek",
  "github-copilot",
  "kilocode",
  "kimi",
  "mistral",
  "moonshot",
  "qianfan",
  "synthetic",
  "venice",
  "vercel-ai-gateway",
  "volcengine",
  "xiaomi",
]);

const REMOVED_PLUGIN_LOAD_PATH_HINTS = [
  "@larksuite/openclaw-lark",
  "/node_modules/@larksuite/openclaw-lark",
  "\\node_modules\\@larksuite\\openclaw-lark",
];

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

function copyMissingTree(sourceDir: string, targetDir: string): number {
  if (!existsSync(sourceDir)) return 0;
  mkdirSync(targetDir, { recursive: true });

  let copied = 0;
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copied += copyMissingTree(sourcePath, targetPath);
      continue;
    }
    if (existsSync(targetPath)) continue;
    if (entry.isFile()) {
      copyFileSync(sourcePath, targetPath);
      copied += 1;
      continue;
    }
    if (entry.isSymbolicLink()) {
      symlinkSync(readlinkSync(sourcePath), targetPath);
      copied += 1;
    }
  }
  return copied;
}

/**
 * OpenClaw's roster workspaces now live below `<workspace>/<agentId>`. Older
 * RivonClaw builds used the parent directory itself for the main agent. Move
 * only durable agent-owned context into the new main workspace; large outputs
 * and arbitrary working files remain in the shared parent workspace.
 */
export function migrateLegacyMainAgentWorkspace(stateDir: string): void {
  const legacyWorkspace = join(stateDir, "workspace");
  const mainWorkspace = resolveMainAgentWorkspaceDir({
    ...process.env,
    OPENCLAW_STATE_DIR: stateDir,
  });
  const copyMarkerPath = join(mainWorkspace, MAIN_WORKSPACE_COPY_MARKER);
  const cleanupMarkerPath = join(mainWorkspace, MAIN_WORKSPACE_CLEANUP_MARKER);
  if (!existsSync(legacyWorkspace) || existsSync(cleanupMarkerPath)) return;

  const sourceFiles = MAIN_WORKSPACE_FILES.filter((name) =>
    existsSync(join(legacyWorkspace, name)),
  );
  const sourceDirectories = MAIN_WORKSPACE_DIRECTORIES.filter((name) =>
    existsSync(join(legacyWorkspace, name)),
  );
  const legacyBootstrapPath = join(legacyWorkspace, "BOOTSTRAP.md");
  const mainBootstrapPath = join(mainWorkspace, "BOOTSTRAP.md");
  const hasLegacyContext =
    sourceFiles.length > 0 || sourceDirectories.length > 0 || existsSync(legacyBootstrapPath);
  if (!hasLegacyContext) {
    if (existsSync(copyMarkerPath)) {
      writeFileSync(
        cleanupMarkerPath,
        `${JSON.stringify({ version: 2, copiedFiles: 0, source: legacyWorkspace })}\n`,
        "utf-8",
      );
      unlinkSync(copyMarkerPath);
    }
    return;
  }

  mkdirSync(mainWorkspace, { recursive: true });
  const legacySetupCompleted =
    !existsSync(join(legacyWorkspace, "BOOTSTRAP.md")) &&
    sourceFiles.some(
      (name) => name === "IDENTITY.md" || name === "USER.md" || name === "MEMORY.md",
    );
  const targetIsFreshBootstrap = existsSync(join(mainWorkspace, "BOOTSTRAP.md"));
  const replaceGeneratedTemplates = legacySetupCompleted && targetIsFreshBootstrap;

  let copiedFiles = 0;
  for (const name of sourceFiles) {
    const targetPath = join(mainWorkspace, name);
    if (!replaceGeneratedTemplates && existsSync(targetPath)) continue;
    copyFileSync(join(legacyWorkspace, name), targetPath);
    copiedFiles += 1;
  }
  for (const name of sourceDirectories) {
    copiedFiles += copyMissingTree(join(legacyWorkspace, name), join(mainWorkspace, name));
  }
  if (existsSync(legacyBootstrapPath) && !existsSync(mainBootstrapPath)) {
    copyFileSync(legacyBootstrapPath, mainBootstrapPath);
    copiedFiles += 1;
  }

  if (legacySetupCompleted && existsSync(mainBootstrapPath)) {
    unlinkSync(mainBootstrapPath);
  }

  // The v1 marker is the durable boundary between copy and cleanup. Existing
  // installations may already have this marker from the copy-only migration;
  // rerunning the copy above is idempotent and lets them continue into cleanup.
  writeFileSync(
    copyMarkerPath,
    `${JSON.stringify({ version: 1, copiedFiles, source: legacyWorkspace })}\n`,
    "utf-8",
  );

  for (const name of sourceFiles) {
    unlinkSync(join(legacyWorkspace, name));
  }
  for (const name of sourceDirectories) {
    rmSync(join(legacyWorkspace, name), { recursive: true, force: true });
  }
  if (existsSync(legacyBootstrapPath)) {
    unlinkSync(legacyBootstrapPath);
  }

  writeFileSync(
    cleanupMarkerPath,
    `${JSON.stringify({ version: 2, copiedFiles, source: legacyWorkspace })}\n`,
    "utf-8",
  );
  unlinkSync(copyMarkerPath);
  log.info(
    `migrated main agent context to ${mainWorkspace} (${copiedFiles} copied file(s)); removed legacy agent files`,
  );
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

function rewriteLegacyOpenAIProviderRefs(value: unknown): {
  value: unknown;
  changed: number;
} {
  if (typeof value === "string") {
    if (value === "openai-codex") {
      return { value: "openai", changed: 1 };
    }
    if (value.startsWith("openai-codex/")) {
      return { value: `openai/${value.slice("openai-codex/".length)}`, changed: 1 };
    }
    return { value, changed: 0 };
  }

  if (Array.isArray(value)) {
    let changed = 0;
    const next = value.map((entry) => {
      const migrated = rewriteLegacyOpenAIProviderRefs(entry);
      changed += migrated.changed;
      return migrated.value;
    });
    return { value: changed > 0 ? next : value, changed };
  }

  if (!isRecord(value)) return { value, changed: 0 };

  let changed = 0;
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const migratedKey = key.startsWith("openai-codex/")
      ? `openai/${key.slice("openai-codex/".length)}`
      : key;
    if (migratedKey !== key) changed += 1;

    const migratedEntry = rewriteLegacyOpenAIProviderRefs(entry);
    changed += migratedEntry.changed;

    // If both canonical and legacy keys exist, preserve the canonical value.
    if (!(migratedKey in next) || migratedKey === key) {
      next[migratedKey] = migratedEntry.value;
    }
  }
  return { value: changed > 0 ? next : value, changed };
}

function rewriteLegacyOpenAISessionStore(value: unknown): {
  value: unknown;
  changed: number;
} {
  if (!isRecord(value)) return { value, changed: 0 };

  let changed = 0;
  const nextStore: Record<string, unknown> = { ...value };
  for (const [sessionKey, rawEntry] of Object.entries(value)) {
    if (!isRecord(rawEntry)) continue;

    let nextEntry: Record<string, unknown> | undefined;
    for (const field of ["providerOverride", "modelProvider", "model", "modelOverride"]) {
      const current = rawEntry[field];
      if (typeof current !== "string") continue;
      const migrated = rewriteLegacyOpenAIProviderRefs(current);
      if (migrated.changed === 0) continue;
      nextEntry ??= { ...rawEntry };
      nextEntry[field] = migrated.value;
      changed += migrated.changed;
    }
    if (nextEntry) nextStore[sessionKey] = nextEntry;
  }

  return { value: changed > 0 ? nextStore : value, changed };
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

function pruneLegacyPluginLoadPaths(value: unknown): { value: unknown; changed: boolean } {
  if (!Array.isArray(value)) return { value, changed: false };
  const next = value.filter((entry) => {
    if (typeof entry !== "string") return true;
    const normalized = entry.replace(/\\/g, "/");
    return !REMOVED_PLUGIN_LOAD_PATH_HINTS.some((hint) =>
      normalized.includes(hint.replace(/\\/g, "/")),
    );
  });
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
  if (isRecord(agents)) {
    const migratedAgents = rewriteLegacyOpenAIProviderRefs(agents);
    if (migratedAgents.changed > 0) {
      config.agents = migratedAgents.value;
      touched.push("agents openai-codex model references");
    }
  }

  const plugins = config.plugins;
  if (isRecord(plugins)) {
    const load = isRecord(plugins.load) ? plugins.load : undefined;
    if (load) {
      const loadPaths = pruneLegacyPluginLoadPaths(load.paths);
      if (loadPaths.changed) {
        load.paths = loadPaths.value;
        touched.push("plugins.load.paths");
      }
    }

    const allow = pruneRemovedPluginIds(plugins.allow);
    if (allow.changed) {
      plugins.allow = allow.value;
      touched.push("plugins.allow");
    }

    const deny = Array.isArray(plugins.deny)
      ? {
          value: plugins.deny.filter(
            (entry) =>
              typeof entry !== "string" ||
              (!REMOVED_PLUGIN_IDS.has(entry) && !STALE_OPTIONAL_PLUGIN_DENY_IDS.has(entry)),
          ),
          changed: plugins.deny.some(
            (entry) =>
              typeof entry === "string" &&
              (REMOVED_PLUGIN_IDS.has(entry) || STALE_OPTIONAL_PLUGIN_DENY_IDS.has(entry)),
          ),
        }
      : { value: plugins.deny, changed: false };
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
  const media = isRecord(tools) && isRecord(tools.media) ? tools.media : undefined;
  const audio = media && isRecord(media.audio) ? media.audio : undefined;
  if (media && audio && Array.isArray(audio.models)) {
    const existingModels = Array.isArray(media.models) ? media.models : [];
    const seen = new Set(existingModels.map((model) => JSON.stringify(model)));
    media.models = [
      ...existingModels,
      ...audio.models.filter((model) => {
        const key = JSON.stringify(model);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    ];
    delete audio.models;
    touched.push("tools.media.audio.models");
  }

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
  log.info(
    `removed legacy OpenClaw config keys in ${configPath}: ${[...new Set(touched)].join(", ")}`,
  );
}

/**
 * OpenClaw now owns ChatGPT/Codex OAuth under runtime provider `openai`.
 * Migrate only the small session index files that can carry active model
 * overrides. Transcript JSONL files and generated models.json stay untouched.
 */
export function migrateLegacyOpenAISessionProviders(stateDir: string): void {
  const agentsDir = join(stateDir, "agents");
  if (!existsSync(agentsDir)) return;

  let agents: Dirent[];
  try {
    agents = readdirSync(agentsDir, { withFileTypes: true });
  } catch (err) {
    log.warn(`failed to list ${agentsDir} - skipping OpenAI session provider migration:`, err);
    return;
  }

  let changedStores = 0;
  for (const agent of agents) {
    if (!agent.isDirectory()) continue;

    const storePath = join(agentsDir, agent.name, "sessions", "sessions.json");
    if (!existsSync(storePath)) continue;

    let store: unknown;
    try {
      store = JSON.parse(readFileSync(storePath, "utf-8")) as unknown;
    } catch (err) {
      log.warn(`failed to parse ${storePath} - skipping OpenAI session provider migration:`, err);
      continue;
    }

    const migrated = rewriteLegacyOpenAISessionStore(store);
    if (migrated.changed === 0) continue;

    const tempPath = `${storePath}.${process.pid}.provider-migration.tmp`;
    try {
      writeFileSync(tempPath, JSON.stringify(migrated.value, null, 2), {
        encoding: "utf-8",
        mode: statSync(storePath).mode,
      });
      renameSync(tempPath, storePath);
      changedStores += 1;
    } catch (err) {
      if (existsSync(tempPath)) {
        try {
          unlinkSync(tempPath);
        } catch {
          // Best effort cleanup; preserve the original sessions.json.
        }
      }
      log.warn(`failed to migrate OpenAI provider references in ${storePath}:`, err);
    }
  }

  if (changedStores > 0) {
    log.info(`migrated OpenAI provider references in ${changedStores} session store(s)`);
  }
}
