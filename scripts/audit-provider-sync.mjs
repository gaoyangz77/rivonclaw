#!/usr/bin/env node
/**
 * Audit the compiled app's fresh-state model catalog against built vendor data.
 * Modern OpenClaw owns catalogs in plugin manifests, not @openclaw/ai transports.
 * No provider discovery, credentials, network requests, or real user state are used.
 *
 * node scripts/audit-provider-sync.mjs [--compare-vendor-dir <old-vendor>] [--json]
 * Exit: 0 = no empty non-local providers; 1 = coverage gaps; 2 = invalid inputs.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function readJson(path) {
  if (!existsSync(path)) throw new Error(`Required audit source is missing: ${path}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Read declarative inventory only. Presence does not imply enabled/account-visible. */
export function readVendorInventory(vendorDir) {
  const manifestDir = join(vendorDir, "dist/extensions");
  if (!existsSync(manifestDir)) {
    throw new Error(`Required built catalog source is missing: ${manifestDir}`);
  }
  const providers = new Set();
  const models = new Map();
  let manifestCount = 0;
  for (const entry of readdirSync(manifestDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(manifestDir, entry.name, "openclaw.plugin.json");
    if (!existsSync(path)) continue;
    const manifest = readJson(path);
    if (!isRecord(manifest) || typeof manifest.id !== "string") {
      throw new Error(`Invalid plugin manifest: ${path}`);
    }
    manifestCount++;
    for (const provider of manifest.providers ?? []) providers.add(provider);
    const catalog = manifest.modelCatalog;
    if (catalog === undefined) continue;
    if (!isRecord(catalog) || (catalog.providers !== undefined && !isRecord(catalog.providers))) {
      throw new Error(`Invalid modelCatalog: ${path}`);
    }
    for (const [provider, config] of Object.entries(catalog.providers ?? {})) {
      if (!isRecord(config) || !Array.isArray(config.models)) {
        throw new Error(`Invalid modelCatalog provider ${provider}: ${path}`);
      }
      providers.add(provider);
      for (const model of config.models) {
        if (!isRecord(model) || typeof model.id !== "string" || !model.id.trim()) {
          throw new Error(`Invalid model ID for ${provider}: ${path}`);
        }
        models.set(`${provider}/${model.id}`, {
          provider,
          id: model.id,
          name: model.name ?? model.id,
          contextWindow: model.contextWindow,
          contextTokens: model.contextTokens,
          status: model.status ?? "available",
          discovery: catalog.discovery?.[provider] ?? "static",
          pluginId: manifest.id,
        });
      }
    }
  }
  if (manifestCount === 0 || models.size === 0) {
    throw new Error(`No usable built manifest model catalog found: ${manifestDir}`);
  }
  return {
    vendorDir,
    manifestCount,
    providers: [...providers].sort(),
    models: [...models.values()],
  };
}

export function compareInventories(previous, current) {
  const oldModels = new Map(
    previous.models.map((model) => [`${model.provider}/${model.id}`, model]),
  );
  const newModels = new Map(
    current.models.map((model) => [`${model.provider}/${model.id}`, model]),
  );
  return {
    previousVendorDir: previous.vendorDir,
    added: [...newModels.keys()].filter((key) => !oldModels.has(key)).sort(),
    removed: [...oldModels.keys()].filter((key) => !newModels.has(key)).sort(),
    contextChanged: [...newModels].flatMap(([key, model]) => {
      const old = oldModels.get(key);
      if (
        !old ||
        (old.contextWindow === model.contextWindow && old.contextTokens === model.contextTokens)
      )
        return [];
      return [
        {
          model: key,
          before: { contextWindow: old.contextWindow, contextTokens: old.contextTokens },
          after: { contextWindow: model.contextWindow, contextTokens: model.contextTokens },
        },
      ];
    }),
  };
}

export function auditCoverage(core, catalog, inventory, normalizeCatalog) {
  const local = new Set(core.LOCAL_PROVIDER_IDS);
  const providers = core.ALL_PROVIDERS.map((provider) => {
    const meta = core.getProviderMeta(provider);
    return {
      provider,
      models: catalog[provider]?.length ?? 0,
      extraModels: meta?.extraModels?.length ?? 0,
      fallbackModels: meta?.fallbackModels?.length ?? 0,
      runtimeDiscovery: local.has(provider),
    };
  });
  const staticCatalog = {};
  for (const model of inventory.models) {
    if (model.status === "disabled" || model.discovery === "runtime") continue;
    (staticCatalog[model.provider] ??= []).push(model);
  }
  const normalized = normalizeCatalog(staticCatalog);
  return {
    providers,
    emptyProviders: providers
      .filter((provider) => provider.models === 0 && !provider.runtimeDiscovery)
      .map((provider) => provider.provider),
    missingDeclaredModels: providers.flatMap(({ provider }) => {
      const available = new Set((catalog[provider] ?? []).map((model) => model.id));
      const missing = (normalized[provider] ?? [])
        .filter((model) => !available.has(model.id))
        .map((model) => model.id);
      return missing.length ? [{ provider, models: missing }] : [];
    }),
    upstreamOnlyProviders: inventory.providers.filter(
      (provider) => !core.ALL_PROVIDERS.includes(provider),
    ),
  };
}

export async function runAudit({
  vendorDir = join(rootDir, "vendor/openclaw"),
  compareVendorDir,
} = {}) {
  // Preflight before the app's deliberately forgiving runtime reader can hide
  // a missing build/catalog source behind an empty fallback.
  const inventory = readVendorInventory(vendorDir);
  const previous = compareVendorDir ? readVendorInventory(compareVendorDir) : undefined;
  const corePath = join(rootDir, "packages/core/dist/index.mjs");
  const gatewayPath = join(rootDir, "packages/gateway/dist/index.mjs");
  for (const path of [corePath, gatewayPath]) {
    if (!existsSync(path))
      throw new Error(`Required compiled app source is missing: ${path}; build first`);
  }
  const core = await import(pathToFileURL(corePath).href);
  const gateway = await import(pathToFileURL(gatewayPath).href);
  if (
    !Array.isArray(core.ALL_PROVIDERS) ||
    !core.ALL_PROVIDERS.length ||
    !Array.isArray(core.LOCAL_PROVIDER_IDS) ||
    typeof core.getProviderMeta !== "function" ||
    typeof gateway.readFullModelCatalog !== "function" ||
    typeof gateway.normalizeCatalog !== "function"
  ) {
    throw new Error("Compiled app catalog API is missing or incompatible; rebuild before auditing");
  }
  const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-provider-audit-"));
  try {
    const env = {
      HOME: stateDir,
      USERPROFILE: stateDir,
      OPENCLAW_STATE_DIR: stateDir,
      OPENCLAW_CONFIG_PATH: join(stateDir, "openclaw.json"),
      OPENCLAW_AGENT_DIR: join(stateDir, "agent"),
    };
    const catalog = await gateway.readFullModelCatalog(env, vendorDir);
    return {
      vendorDir,
      scope:
        "Fresh-state compiled app coverage; manifest inventory is not plugin enablement or account entitlement",
      manifestCount: inventory.manifestCount,
      manifestModelCount: inventory.models.length,
      ...auditCoverage(core, catalog, inventory, gateway.normalizeCatalog),
      ...(previous ? { comparison: compareInventories(previous, inventory) } : {}),
    };
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      "vendor-dir": { type: "string" },
      "compare-vendor-dir": { type: "string" },
      json: { type: "boolean", default: false },
    },
  });
  const report = await runAudit({
    vendorDir: values["vendor-dir"] ? resolve(values["vendor-dir"]) : undefined,
    compareVendorDir: values["compare-vendor-dir"]
      ? resolve(values["compare-vendor-dir"])
      : undefined,
  });
  if (values.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log("=== Provider / Model Sync Audit ===");
    console.log(report.scope);
    console.log(
      `Built manifests: ${report.manifestCount}; declared models: ${report.manifestModelCount}`,
    );
    console.log(
      "\nApp model counts (includes extras, fallbacks, aliases and subscription inheritance):",
    );
    for (const p of report.providers)
      console.log(
        `  ${p.provider}: ${p.models}${p.runtimeDiscovery ? " (local runtime discovery)" : ""}`,
      );
    console.log(`\nEmpty non-local providers: ${report.emptyProviders.join(", ") || "none"}`);
    console.log(
      "\nDeclared static models absent from fresh-state app (not proof of runtime availability):",
    );
    for (const p of report.missingDeclaredModels)
      console.log(`  ${p.provider}: ${p.models.join(", ")}`);
    console.log(
      `\nUpstream-only provider IDs (informational): ${report.upstreamOnlyProviders.join(", ")}`,
    );
    if (report.comparison) {
      console.log(
        "\nBuilt-manifest comparison only (excludes runtime discovery and module-only catalogs):",
      );
      console.log(`  Added: ${report.comparison.added.join(", ") || "none"}`);
      console.log(`  Removed: ${report.comparison.removed.join(", ") || "none"}`);
      console.log(`  Context changes: ${JSON.stringify(report.comparison.contextChanged)}`);
    }
  }
  process.exitCode = report.emptyProviders.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[audit error] ${error.message}`);
    process.exitCode = 2;
  });
}
