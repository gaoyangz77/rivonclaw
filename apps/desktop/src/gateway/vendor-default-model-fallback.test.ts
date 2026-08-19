import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveGatewayModelParts } from "@rivonclaw/core";
import { writeGatewayConfig } from "@rivonclaw/gateway";
import { describe, expect, it } from "vitest";
import { buildTemporaryOpenAICodexProviderOverride } from "./config-builder.js";

/**
 * Regression cover for the silent provider hijack behind the customer report
 * "The agent run failed before producing a reply." (2026-08-17).
 *
 * The compatibility overlay always writes an `openai` provider row containing
 * OpenClaw's built-in default model. OpenClaw only derives a default itself
 * when `agents.defaults.model.primary` is absent, and that derivation
 * (`resolveConfiguredProviderFallback`) returns null the moment the default
 * provider row already carries the default model — so the gateway ran
 * `openai/gpt-5.6-sol` while the user had selected the Volcengine coding plan.
 *
 * These tests pin both halves: the vendor precondition that makes the trap
 * real, and the seeding behaviour that disarms it.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const VENDOR_DEFAULTS_FILE = resolve(__dirname, "../../../../vendor/openclaw/src/agents/defaults.ts");
const VENDOR_FALLBACK_FILE = resolve(
  __dirname,
  "../../../../vendor/openclaw/src/agents/configured-provider-fallback.ts",
);

/** Mirrors a Desktop install whose active key is the Volcengine coding plan. */
const ARK_PROVIDER = "volcengine-coding";
const ARK_MODEL = "ark-code-latest";

function buildExtraProviders() {
  return {
    ...buildTemporaryOpenAICodexProviderOverride(),
    [ARK_PROVIDER]: {
      baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3",
      models: [{ id: ARK_MODEL, name: "Ark Code (Latest)" }],
    },
  };
}

function withTempConfig<T>(run: (configPath: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "rivonclaw-default-model-"));
  try {
    return run(join(dir, "openclaw.json"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("OpenClaw default-model fallback preconditions", () => {
  it("still falls back to a hardcoded OpenAI model when no primary is configured", () => {
    const defaults = readFileSync(VENDOR_DEFAULTS_FILE, "utf8");

    // If either constant changes, the seeding rationale below must be re-checked:
    // these are the values a user silently gets when primary is absent.
    expect(defaults).toContain('export const DEFAULT_PROVIDER = "openai"');
    expect(defaults).toContain('export const DEFAULT_MODEL = "gpt-5.6-sol"');
  });

  it("still declines to pick a configured provider once the default row carries the default model", () => {
    const fallback = readFileSync(VENDOR_FALLBACK_FILE, "utf8");

    // This is the branch that skips the Volcengine row entirely: when the
    // `openai` row has models and includes the default model, the function
    // returns null and the caller hands back DEFAULT_PROVIDER/DEFAULT_MODEL.
    expect(fallback).toContain(
      "if (defaultProviderHasConfiguredModel && (!defaultModel || defaultProviderHasDefaultModel))",
    );
    expect(fallback).toContain("return null;");
  });

  it("writes an openai row that satisfies exactly that branch", () => {
    const overlayModelIds = buildTemporaryOpenAICodexProviderOverride().openai.models.map(
      (model) => model.id,
    );
    // The overlay supplies both preconditions at once: a non-empty model list
    // for the default provider, and the default model id within it.
    expect(overlayModelIds.length).toBeGreaterThan(0);
    expect(overlayModelIds).toContain("gpt-5.6-sol");
  });
});

describe("gateway default model seeding", () => {
  it("seeds the active provider key as an explicit primary so the overlay cannot hijack it", () => {
    withTempConfig((configPath) => {
      const seed = resolveGatewayModelParts({ provider: ARK_PROVIDER, model: ARK_MODEL });
      expect(seed).toEqual({ provider: ARK_PROVIDER, modelId: ARK_MODEL });

      writeGatewayConfig({
        configPath,
        extraProviders: buildExtraProviders(),
        defaultModelSeed: seed,
      });
      const config = JSON.parse(readFileSync(configPath, "utf8"));

      // With primary set, OpenClaw never reaches the fallback path at all.
      expect(config.agents.defaults.model.primary).toBe(`${ARK_PROVIDER}/${ARK_MODEL}`);
      expect(config.agents.defaults.model.primary).not.toContain("openai");
    });
  });

  it("never overwrites a selection that already exists", () => {
    withTempConfig((configPath) => {
      writeGatewayConfig({
        configPath,
        extraProviders: buildExtraProviders(),
        defaultModel: { provider: "anthropic", modelId: "claude-sonnet-4-5" },
      });
      // A later regeneration seeds from a different active key; the existing
      // selection must win, preserving the "vendor state is authoritative"
      // contract that full config regeneration has always honored.
      writeGatewayConfig({
        configPath,
        extraProviders: buildExtraProviders(),
        defaultModelSeed: { provider: ARK_PROVIDER, modelId: ARK_MODEL },
      });

      const config = JSON.parse(readFileSync(configPath, "utf8"));
      expect(config.agents.defaults.model.primary).toBe("anthropic/claude-sonnet-4-5");
    });
  });

  it("leaves an absent selection absent when there is nothing to seed from", () => {
    withTempConfig((configPath) => {
      writeGatewayConfig({
        configPath,
        extraProviders: buildExtraProviders(),
        defaultModelSeed: null,
      });
      const config = JSON.parse(readFileSync(configPath, "utf8"));
      expect(config.agents?.defaults?.model?.primary).toBeUndefined();
    });
  });
});

describe("resolveGatewayModelParts", () => {
  it("maps a subscription plan onto its own gateway provider id", () => {
    expect(resolveGatewayModelParts({ provider: "openai-codex", model: "gpt-5.6" })).toEqual({
      provider: "openai",
      modelId: "gpt-5.6",
    });
  });

  it("strips an already-qualified model id instead of double-prefixing it", () => {
    expect(resolveGatewayModelParts({ provider: "openai-codex", model: "openai/gpt-5.6" })).toEqual({
      provider: "openai",
      modelId: "gpt-5.6",
    });
  });

  it("leaves custom providers unmapped", () => {
    expect(
      resolveGatewayModelParts({ provider: "my-proxy", model: "my-model", authType: "custom" }),
    ).toEqual({ provider: "my-proxy", modelId: "my-model" });
  });

  it("returns null when the key cannot name a model", () => {
    expect(resolveGatewayModelParts({ provider: "openai-codex", model: "" })).toBeNull();
    expect(resolveGatewayModelParts({ provider: "", model: "gpt-5.6" })).toBeNull();
  });
});
