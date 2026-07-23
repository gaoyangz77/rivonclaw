import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeGatewayConfig } from "@rivonclaw/gateway";
import { describe, expect, it } from "vitest";
import {
  buildCustomProviderOverridesFromKeys,
  buildManagedGatewayAgents,
  createGatewayConfigBuilder,
  DEFAULT_GATEWAY_TOOL_ALLOWLIST,
  IMAGE_GENERATION_MODEL_REF,
  IMAGE_GENERATION_TIMEOUT_MS,
  normalizeGeminiOAuthModelId,
  RIVONCLAW_CLOUD_PROVIDER_TIMEOUT_SECONDS,
} from "./config-builder.js";

describe("gateway config builder", () => {
  it("isolates the Affiliate agent without restricting the main agent", () => {
    const agents = buildManagedGatewayAgents("/tmp/rivonclaw-openclaw");
    const main = agents.find((agent) => agent.id === "main");
    const affiliate = agents.find((agent) => agent.id === "affiliate");

    expect(main).toEqual({ id: "main", default: true });
    expect(main).not.toHaveProperty("tools");
    expect(affiliate).toEqual({
      id: "affiliate",
      workspace: "/tmp/rivonclaw-openclaw/workspace-affiliate",
      skills: ["affiliate-workflow"],
      contextTokens: null,
      thinkingDefault: "low",
      reasoningDefault: "off",
      tools: {
        deny: ["write", "edit", "exec", "bash", "process", "apply_patch"],
        fs: { workspaceOnly: true },
      },
    });
  });

  it("does not enable the OpenClaw pdf tool by default", () => {
    expect(DEFAULT_GATEWAY_TOOL_ALLOWLIST).not.toContain("pdf");
  });

  it("normalizes Gemini OAuth model ids that already include a gateway provider prefix", () => {
    expect(normalizeGeminiOAuthModelId("google-gemini-cli/gemini-3-pro-preview")).toBe(
      "gemini-3-pro-preview",
    );
    expect(
      normalizeGeminiOAuthModelId("google-gemini-cli/google-gemini-cli/gemini-3-pro-preview"),
    ).toBe("gemini-3-pro-preview");
    expect(normalizeGeminiOAuthModelId("google/gemini-3-pro-preview")).toBe("gemini-3-pro-preview");
  });

  it("forces RivonClaw cloud models to support image input", () => {
    const overrides = buildCustomProviderOverridesFromKeys([
      {
        provider: "rivonclaw-pro",
        authType: "custom",
        baseUrl: "https://api.rivonclaw.com/llm/v1",
        customProtocol: "openai",
        customModelsJson: JSON.stringify([{ id: "vision", input: ["text"] }]),
        inputModalities: ["text"],
      },
    ]);

    expect(overrides["rivonclaw-pro"]?.models).toEqual([
      { id: "vision", name: "vision", input: ["text", "image"] },
    ]);
    expect(overrides["rivonclaw-pro"]?.timeoutSeconds).toBe(
      RIVONCLAW_CLOUD_PROVIDER_TIMEOUT_SECONDS,
    );
  });

  it("does not apply the cloud timeout to other custom providers", () => {
    const overrides = buildCustomProviderOverridesFromKeys([
      {
        provider: "custom-openai",
        authType: "custom",
        baseUrl: "https://example.com/v1",
        customProtocol: "openai",
        customModelsJson: JSON.stringify(["custom-model"]),
      },
    ]);

    expect(overrides["custom-openai"]?.timeoutSeconds).toBeUndefined();
  });

  it("persists the cloud timeout through gateway config validation", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "rivonclaw-cloud-timeout-"));
    const configPath = join(tmpDir, "openclaw.json");

    try {
      const extraProviders = buildCustomProviderOverridesFromKeys([
        {
          provider: "rivonclaw-pro",
          authType: "custom",
          baseUrl: "https://api.rivonclaw.com/llm/v1",
          customProtocol: "openai",
          customModelsJson: JSON.stringify(["gpt-5.6-terra"]),
        },
      ]);

      writeGatewayConfig({ configPath, extraProviders });

      const config = JSON.parse(readFileSync(configPath, "utf8"));
      expect(config.models.providers["rivonclaw-pro"].timeoutSeconds).toBe(
        RIVONCLAW_CLOUD_PROVIDER_TIMEOUT_SECONDS,
      );
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("uses key-level image input when a custom model object has no per-model modalities", () => {
    const overrides = buildCustomProviderOverridesFromKeys([
      {
        provider: "rivonclaw-pro",
        authType: "custom",
        baseUrl: "https://api.rivonclaw.com/llm/v1",
        customProtocol: "openai",
        customModelsJson: JSON.stringify([{ id: "vision" }]),
        inputModalities: ["text", "image"],
      },
    ]);

    expect(overrides["rivonclaw-pro"]?.models).toEqual([
      { id: "vision", name: "vision", input: ["text", "image"] },
    ]);
  });

  it("preserves Flagship context and output limits", () => {
    const overrides = buildCustomProviderOverridesFromKeys([
      {
        provider: "rivonclaw-pro",
        authType: "custom",
        baseUrl: "https://api.rivonclaw.com/llm/v1",
        customProtocol: "openai",
        customModelsJson: JSON.stringify([
          {
            id: "rivonclaw-flagship",
            display_name: "Flagship",
            context_length: 372_000,
            context_tokens: 244_000,
            max_completion_tokens: 128_000,
          },
        ]),
      },
    ]);

    expect(overrides["rivonclaw-pro"]?.models).toEqual([
      {
        id: "rivonclaw-flagship",
        name: "Flagship",
        input: ["text", "image"],
        contextWindow: 372_000,
        contextTokens: 244_000,
        maxTokens: 128_000,
      },
    ]);
  });

  it("restores runtime limits for legacy cloud model ID lists", () => {
    const overrides = buildCustomProviderOverridesFromKeys([
      {
        provider: "rivonclaw-pro",
        authType: "custom",
        baseUrl: "https://api.rivonclaw.com/llm/v1",
        customProtocol: "openai",
        customModelsJson: JSON.stringify(["gpt-5.6-terra", "gpt-5.6-luna"]),
      },
    ]);

    expect(overrides["rivonclaw-pro"]?.models).toEqual([
      {
        id: "gpt-5.6-terra",
        name: "gpt-5.6-terra",
        input: ["text", "image"],
        contextWindow: 372_000,
        contextTokens: 244_000,
        maxTokens: 128_000,
      },
      {
        id: "gpt-5.6-luna",
        name: "gpt-5.6-luna",
        input: ["text", "image"],
        contextWindow: 372_000,
        contextTokens: 244_000,
        maxTokens: 128_000,
      },
    ]);
  });

  it("restores Flagship runtime limits for an ID-only cloud catalog", () => {
    const overrides = buildCustomProviderOverridesFromKeys([
      {
        provider: "rivonclaw-pro",
        authType: "custom",
        baseUrl: "https://api.rivonclaw.com/llm/v1",
        customProtocol: "openai",
        customModelsJson: JSON.stringify(["rivonclaw-flagship"]),
      },
    ]);

    expect(overrides["rivonclaw-pro"]?.models).toEqual([
      {
        id: "rivonclaw-flagship",
        name: "rivonclaw-flagship",
        input: ["text", "image"],
        contextWindow: 372_000,
        contextTokens: 244_000,
        maxTokens: 128_000,
      },
    ]);
  });

  it("routes image generation through the RivonClaw backend for the active cloud key", async () => {
    const cloudKey = {
      id: "cloud-rivonclaw-pro",
      provider: "rivonclaw-pro",
      authType: "custom",
      isDefault: true,
      model: "rivonclaw-flagship",
      baseUrl: "https://api.rivonclaw.com/llm/v1",
      customProtocol: "openai",
      customModelsJson: JSON.stringify(["rivonclaw-flagship"]),
    };
    const storage = {
      providerKeys: {
        getActive: () => cloudKey,
        getAll: () => [cloudKey],
        getByProvider: (provider: string) => (provider === cloudKey.provider ? [cloudKey] : []),
      },
      settings: { get: () => undefined },
      channelAccounts: { list: () => [], get: () => undefined },
      channelRecipients: { getOwners: () => [] },
    };
    const builder = createGatewayConfigBuilder({
      storage: storage as never,
      secretStore: { get: async () => null } as never,
      locale: "en",
      configPath: "/tmp/openclaw.json",
      stateDir: "/tmp/openclaw",
      extensionsDir: "/tmp/extensions",
      sttCliPath: "/tmp/stt.js",
      channelPluginEntries: () => ({}),
      channelConfigAccounts: () => [],
    });

    const config = await builder.buildFullGatewayConfig(18789);
    expect(config.imageGenerationModel).toEqual({
      primary: IMAGE_GENERATION_MODEL_REF,
      timeoutMs: IMAGE_GENERATION_TIMEOUT_MS,
    });
    expect(config.extraProviders?.openai).toMatchObject({
      baseUrl: "https://api.rivonclaw.com/llm/v1",
      api: "openai-completions",
      timeoutSeconds: 300,
      models: [{ id: "gpt-image-2", name: "GPT Image 2" }],
    });
  });

  it("uses native Codex OAuth for image generation without a cloud provider override", async () => {
    const codexKey = {
      id: "codex-oauth",
      provider: "openai-codex",
      authType: "oauth",
      isDefault: true,
      model: "gpt-5.6-terra",
    };
    const storage = {
      providerKeys: {
        getActive: () => codexKey,
        getAll: () => [codexKey],
        getByProvider: (provider: string) => (provider === codexKey.provider ? [codexKey] : []),
      },
      settings: { get: () => undefined },
      channelAccounts: { list: () => [], get: () => undefined },
      channelRecipients: { getOwners: () => [] },
    };
    const builder = createGatewayConfigBuilder({
      storage: storage as never,
      secretStore: { get: async () => null } as never,
      locale: "en",
      configPath: "/tmp/openclaw.json",
      stateDir: "/tmp/openclaw",
      extensionsDir: "/tmp/extensions",
      sttCliPath: "/tmp/stt.js",
      channelPluginEntries: () => ({}),
      channelConfigAccounts: () => [],
    });

    const config = await builder.buildFullGatewayConfig(18789);
    expect(config.imageGenerationModel).toEqual({
      primary: IMAGE_GENERATION_MODEL_REF,
      timeoutMs: IMAGE_GENERATION_TIMEOUT_MS,
    });
    expect(config.extraProviders?.openai).toBeUndefined();
  });
});
