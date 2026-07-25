import { readFileSync } from "node:fs";
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
const GATEWAY_STARTUP_FILE = resolve(
  __dirname,
  "../../../../vendor/openclaw/src/gateway/server-startup-post-attach.ts",
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
    expect(merger).toContain("for (const [key, entry] of Object.entries(existingProviders))");
    expect(merger).toContain("if (!isExistingProviderSelfContained(entry))");
    expect(merger).toContain("mergedProviders[key] = entry");
    expect(merger).toContain("for (const [key, newEntry] of Object.entries(nextProviders))");
    expect(merger).toContain("mergedProviders[key] = { ...newEntry, ...preserved }");
  });

  it("treats startup reconciliation failures as non-fatal", () => {
    const startup = readFileSync(GATEWAY_STARTUP_FILE, "utf8");

    expect(startup).toContain("await ensureOpenClawModelsJson(params.cfg, agentDir");
    expect(startup).toContain(
      "startup model warmup failed for ${provider}/${model}: ${String(err)}",
    );
    expect(startup).toContain("continuing without waiting");
  });
});
