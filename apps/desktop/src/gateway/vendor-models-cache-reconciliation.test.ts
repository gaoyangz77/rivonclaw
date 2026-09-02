import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MODELS_CONFIG_FILE = resolve(
  __dirname,
  "../../../../vendor/openclaw/src/agents/models-config.ts",
);
const MODELS_PLAN_FILE = resolve(
  __dirname,
  "../../../../vendor/openclaw/src/agents/models-config.plan.ts",
);
const MODELS_MERGE_FILE = resolve(
  __dirname,
  "../../../../vendor/openclaw/src/agents/models-config.merge.ts",
);
/**
 * `tmp/vendor-patched/` is a disposable workspace that only exists while patches
 * are being authored, so it cannot be the sole source: this file previously
 * read it unconditionally and passed for months against a months-old copy,
 * failing the moment the stale directory was cleared. Every sibling sentinel
 * already falls back to the real vendor checkout; this one now does too.
 */
const PATCHED_VENDOR_ROOT = resolve(__dirname, "../../../../tmp/vendor-patched/openclaw");
const VENDOR_ROOT = existsSync(PATCHED_VENDOR_ROOT)
  ? PATCHED_VENDOR_ROOT
  : resolve(__dirname, "../../../../vendor/openclaw");
const GATEWAY_STARTUP_FILE = resolve(
  VENDOR_ROOT,
  "src/gateway/server-startup-post-attach.ts",
);

describe("OpenClaw managed-provider models.json reconciliation", () => {
  it("serializes cache refreshes and replaces models.json atomically", () => {
    const source = readFileSync(MODELS_CONFIG_FILE, "utf8");

    expect(source).toContain("withModelsJsonWriteLock(targetPath");
    expect(source).toContain("writeModelsFileAtomicForModelsJson(targetPath, plan.contents)");
    expect(source).toContain("MODELS_JSON_STATE.readyCache.set(cacheKey, pending)");
    expect(source).toContain("MODELS_JSON_STATE.readyCache.delete(cacheKey)");
  });

  it("uses merge mode to preserve self-contained user providers while refreshing managed entries", () => {
    const planner = readFileSync(MODELS_PLAN_FILE, "utf8");
    const merger = readFileSync(MODELS_MERGE_FILE, "utf8");

    expect(planner).toContain('if (params.mode !== "merge")');
    expect(planner).toContain("mergeWithExistingProviderSecrets({");
    expect(merger).toContain(
      "for (const [key, entry] of Object.entries(normalizedExistingProviders))",
    );
    expect(merger).toContain("if (!isExistingProviderSelfContained(entry))");
    expect(merger).toContain("mergedProviders[key] = entry");
    expect(merger).toContain(
      "for (const [key, newEntry] of Object.entries(normalizedNextProviders))",
    );
    expect(merger).toContain("mergedProviders[key] = { ...newEntry, ...preserved }");
  });

  it("publishes configured model runtime before chat metadata and channels", () => {
    const startup = readFileSync(GATEWAY_STARTUP_FILE, "utf8");

    expect(startup).toContain('catalogMode: "static"');
    expect(startup).toContain("await publication(params)");

    const modelRuntimeIndex = startup.indexOf('"sidecars.model-runtime"');
    const chatMetadataIndex = startup.indexOf('"sidecars.chat-metadata"');
    const channelsIndex = startup.indexOf('"sidecars.channels"');

    expect(modelRuntimeIndex).toBeGreaterThanOrEqual(0);
    expect(chatMetadataIndex).toBeGreaterThan(modelRuntimeIndex);
    expect(channelsIndex).toBeGreaterThan(chatMetadataIndex);
  });
});
