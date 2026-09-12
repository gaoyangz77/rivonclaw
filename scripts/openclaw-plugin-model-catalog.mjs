import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Extract data only: never load provider plugins or run account discovery. */
export function readPluginModelCatalog(extensionsDir, computedCatalogs = {}) {
  const providers = new Set();
  const catalogs = new Map();
  let manifests = 0;

  function addProvider(provider) {
    if (typeof provider !== "string" || !provider.trim()) {
      throw new Error(`Invalid provider ID in ${extensionsDir}`);
    }
    const id = provider.trim().toLowerCase();
    providers.add(id);
    return id;
  }

  function addModels(provider, models, source) {
    const id = addProvider(provider);
    if (!Array.isArray(models)) throw new Error(`Missing model array for ${id}: ${source}`);
    const entries = catalogs.get(id) ?? new Map();
    for (const model of models) {
      if (!isRecord(model) || typeof model.id !== "string" || !model.id.trim()) {
        throw new Error(`Invalid model ID for ${id}: ${source}`);
      }
      if (model.status === "disabled") continue;
      const entry = { id: model.id, name: model.name ?? model.id };
      for (const key of ["contextWindow", "contextTokens"]) {
        if (model[key] === undefined) continue;
        if (!Number.isSafeInteger(model[key]) || model[key] <= 0) {
          throw new Error(`Invalid ${key} for ${id}/${model.id}: ${source}`);
        }
        entry[key] = model[key];
      }
      // Manifest values are authoritative; computed entries fill missing fields
      // and append models without dropping manifest-only metadata.
      entries.set(model.id, { ...entry, ...entries.get(model.id) });
    }
    if (entries.size) catalogs.set(id, entries);
  }

  for (const dir of readdirSync(extensionsDir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (!dir.isDirectory()) continue;
    const file = join(extensionsDir, dir.name, "openclaw.plugin.json");
    if (!existsSync(file)) continue;
    const manifest = JSON.parse(readFileSync(file, "utf8"));
    if (!isRecord(manifest) || typeof manifest.id !== "string") {
      throw new Error(`Invalid plugin manifest: ${file}`);
    }
    manifests++;
    if (manifest.providers !== undefined && !Array.isArray(manifest.providers)) {
      throw new Error(`Invalid providers array: ${file}`);
    }
    for (const provider of manifest.providers ?? []) addProvider(provider);
    const catalog = manifest.modelCatalog;
    if (catalog === undefined) continue;
    if (!isRecord(catalog) || (catalog.providers !== undefined && !isRecord(catalog.providers))) {
      throw new Error(`Invalid modelCatalog: ${file}`);
    }
    for (const [provider, config] of Object.entries(catalog.providers ?? {})) {
      addModels(provider, config?.models, file);
    }
  }
  if (!manifests) throw new Error(`No built plugin manifests found in ${extensionsDir}`);
  for (const [provider, models] of Object.entries(computedCatalogs)) {
    addModels(provider, models, "computed catalog");
  }
  return {
    providerIds: [...providers].sort(),
    catalog: Object.fromEntries(
      [...catalogs]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([provider, entries]) => [provider, [...entries.values()]]),
    ),
  };
}
