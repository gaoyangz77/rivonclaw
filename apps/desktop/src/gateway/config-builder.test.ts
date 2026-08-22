import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeGatewayConfig } from "@rivonclaw/gateway";
import { describe, expect, it } from "vitest";
import {
  buildCustomProviderOverridesFromKeys,
  buildManagedGatewayAgents,
  buildTemporaryOpenAICodexProviderOverride,
  createGatewayConfigBuilder,
  DEFAULT_GATEWAY_TOOL_ALLOWLIST,
  isOpenAICodexOAuthActive,
  RIVONCLAW_CLOUD_PROVIDER_TIMEOUT_SECONDS,
} from "./config-builder.js";

describe("gateway config builder", () => {
  const deviceId = "a".repeat(64);

  it("adds the stable device header only to the RivonClaw cloud provider", () => {
    const overrides = buildCustomProviderOverridesFromKeys(
      [
        {
          provider: "rivonclaw-pro",
          authType: "custom",
          baseUrl: "https://api.rivonclaw.com/llm/v1",
          customProtocol: "openai",
          customModelsJson: JSON.stringify(["rivonclaw-flagship"]),
        },
        {
          provider: "custom-openai",
          authType: "custom",
          baseUrl: "https://example.com/v1",
          customProtocol: "openai",
          customModelsJson: JSON.stringify(["example-model"]),
        },
      ],
      deviceId,
    );

    expect(overrides["rivonclaw-pro"]?.headers).toEqual({ "X-Device-Id": deviceId });
    expect(overrides["custom-openai"]?.headers).toBeUndefined();
  });

  it.each([undefined, "unknown", "A".repeat(64), "a".repeat(63)])(
    "omits the device header for a non-canonical device id (%s)",
    (invalidDeviceId) => {
      const overrides = buildCustomProviderOverridesFromKeys(
        [
          {
            provider: "rivonclaw-pro",
            authType: "custom",
            baseUrl: "https://api.rivonclaw.com/llm/v1",
            customProtocol: "openai",
            customModelsJson: JSON.stringify(["rivonclaw-flagship"]),
          },
        ],
        invalidDeviceId,
      );

      expect(overrides["rivonclaw-pro"]?.headers).toBeUndefined();
    },
  );

  it("allows long-running RivonClaw cloud requests up to five minutes", () => {
    expect(RIVONCLAW_CLOUD_PROVIDER_TIMEOUT_SECONDS).toBe(300);
  });

  it("isolates the Affiliate agent without restricting the main agent", () => {
    const agents = buildManagedGatewayAgents("/tmp/rivonclaw-openclaw");
    const main = agents.find((agent) => agent.id === "main");
    const affiliate = agents.find((agent) => agent.id === "affiliate");

    expect(main).toEqual({
      id: "main",
      default: true,
      workspace: "/tmp/rivonclaw-openclaw/workspace/main",
    });
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

  it("does not expose the RPC-only local-tools plugin as a tool namespace", () => {
    expect(DEFAULT_GATEWAY_TOOL_ALLOWLIST).toContain("rivonclaw-cloud-tools");
    expect(DEFAULT_GATEWAY_TOOL_ALLOWLIST).not.toContain("rivonclaw-local-tools");
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

    expect(
      overrides["rivonclaw-pro"]?.models.filter((model) => model.id !== "gpt-image-2"),
    ).toEqual([{ id: "vision", name: "vision", input: ["text", "image"] }]);
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

    expect(
      overrides["rivonclaw-pro"]?.models.filter((model) => model.id !== "gpt-image-2"),
    ).toEqual([{ id: "vision", name: "vision", input: ["text", "image"] }]);
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

    expect(
      overrides["rivonclaw-pro"]?.models.filter((model) => model.id !== "gpt-image-2"),
    ).toEqual([
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

    expect(
      overrides["rivonclaw-pro"]?.models.filter((model) => model.id !== "gpt-image-2"),
    ).toEqual([
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

    expect(
      overrides["rivonclaw-pro"]?.models.filter((model) => model.id !== "gpt-image-2"),
    ).toEqual([
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

  it("keeps TK image models in the TK provider without rewriting the Vendor selection", async () => {
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
      deviceId,
      channelPluginEntries: () => ({}),
      channelConfigAccounts: () => [],
    });

    const config = await builder.buildFullGatewayConfig(18789);
    expect(config.imageGenerationModel).toBeUndefined();
    const cloudToolsEntry = config.plugins?.entries?.["rivonclaw-cloud-tools"] as
      | { hooks?: { allowConversationAccess?: boolean } }
      | undefined;
    expect(cloudToolsEntry?.hooks).toEqual({
      allowConversationAccess: true,
    });
    expect(config.extraProviders?.["rivonclaw-pro"]?.models).toContainEqual({
      id: "gpt-image-2",
      name: "GPT Image 2",
      input: ["text", "image"],
    });
    expect(config.extraProviders?.["rivonclaw-pro"]?.headers).toEqual({
      "X-Device-Id": deviceId,
    });
    expect(config.extraProviders?.openai).toMatchObject({
      baseUrl: "https://api.openai.com/v1",
      api: "openai-responses",
    });
  });

  it("adds the temporary GPT-5.6 model overlay independent of active metadata", async () => {
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
    expect(config.imageGenerationModel).toBeUndefined();
    expect(config.extraProviders?.openai).toMatchObject({
      baseUrl: "https://api.openai.com/v1",
      api: "openai-responses",
    });
    expect(config.extraProviders?.openai?.models.map((model) => model.id)).toEqual([
      "gpt-5.6",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
    ]);
    expect(config.extraProviders?.openai?.models[0]).toMatchObject({
      api: "openai-responses",
      contextWindow: 1_050_000,
      contextTokens: 272_000,
      maxTokens: 128_000,
    });
  });

  it("keeps official OpenAI transport for an API key profile", () => {
    const override = buildTemporaryOpenAICodexProviderOverride().openai;
    expect(override).toMatchObject({
      baseUrl: "https://api.openai.com/v1",
      api: "openai-responses",
    });
    expect(override.models.every((model) => model.api === "openai-responses")).toBe(true);
  });

  it("routes the OpenAI provider through the Codex compatibility boundary for OAuth", () => {
    const override = buildTemporaryOpenAICodexProviderOverride(
      "http://127.0.0.1:45678",
      true,
    ).openai;

    expect(override).toMatchObject({
      baseUrl: "http://127.0.0.1:45678",
      api: "openai-chatgpt-responses",
    });
    expect(override.models.every((model) => model.api === "openai-chatgpt-responses")).toBe(true);
  });

  it("persists the temporary provider-level Codex transport through config validation", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "rivonclaw-codex-56-"));
    const configPath = join(tmpDir, "openclaw.json");
    try {
      writeGatewayConfig({
        configPath,
        extraProviders: buildTemporaryOpenAICodexProviderOverride("http://127.0.0.1:45678", true),
      });
      const config = JSON.parse(readFileSync(configPath, "utf8"));
      expect(config.models.providers.openai).toMatchObject({
        baseUrl: "http://127.0.0.1:45678",
        api: "openai-chatgpt-responses",
      });
      expect(config.models.providers.openai.models[0]).toMatchObject({
        id: "gpt-5.6",
        api: "openai-chatgpt-responses",
      });
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("uses Vendor auth ordering to resolve the active OpenAI transport", () => {
    const profiles = [
      { id: "openai:oauth", provider: "openai", type: "oauth" as const },
      { id: "openai:api", provider: "openai", type: "api_key" as const },
    ];

    expect(
      isOpenAICodexOAuthActive({
        profiles,
        order: { openai: ["openai:oauth", "openai:api"] },
      }),
    ).toBe(true);
    expect(
      isOpenAICodexOAuthActive({
        profiles,
        order: { openai: ["openai:api", "openai:oauth"] },
      }),
    ).toBe(false);
  });

  it("leaves standard third-party provider catalogs to vendor OpenClaw", async () => {
    const volcengineKey = {
      id: "volcengine-api-key",
      provider: "volcengine",
      authType: "api",
      isDefault: true,
      model: "doubao-seed-2-0-pro-260215",
    };
    const storage = {
      providerKeys: {
        getActive: () => volcengineKey,
        getAll: () => [volcengineKey],
        getByProvider: (provider: string) =>
          provider === volcengineKey.provider ? [volcengineKey] : [],
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
    expect(config.extraProviders?.volcengine).toBeUndefined();
    expect(config.managedProviderKeys).toBeUndefined();
    expect(config.overlayProviderKeys).toEqual(["openai"]);
  });

  /**
   * The compatibility overlay always writes an `openai` provider row holding
   * OpenClaw's built-in default model, which disables OpenClaw's own
   * configured-provider fallback. The builder must therefore state the active
   * key as an explicit default, or the gateway silently runs the OpenAI default
   * regardless of what the user selected. See
   * vendor-default-model-fallback.test.ts for the vendor half of this pair.
   */
  it("seeds the gateway default model from the active provider key", async () => {
    const arkKey = {
      id: "ark-1",
      provider: "volcengine-coding",
      label: "Volcengine Coding Plan",
      isDefault: true,
      model: "ark-code-latest",
    };
    const builder = createGatewayConfigBuilder({
      storage: {
        providerKeys: {
          getActive: () => arkKey,
          getAll: () => [arkKey],
          getByProvider: (provider: string) => (provider === arkKey.provider ? [arkKey] : []),
        },
        settings: { get: () => undefined },
        channelAccounts: { list: () => [], get: () => undefined },
        channelRecipients: { getOwners: () => [] },
      } as never,
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
    expect(config.defaultModelSeed).toEqual({
      provider: "volcengine-coding",
      modelId: "ark-code-latest",
    });
    // Regeneration must still never overwrite an existing selection.
    expect(config.defaultModel).toBeUndefined();
  });

  it("leaves the gateway default model untouched when no provider key is active", async () => {
    const builder = createGatewayConfigBuilder({
      storage: {
        providerKeys: {
          getActive: () => undefined,
          getAll: () => [],
          getByProvider: () => [],
        },
        settings: { get: () => undefined },
        channelAccounts: { list: () => [], get: () => undefined },
        channelRecipients: { getOwners: () => [] },
      } as never,
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
    expect(config.defaultModelSeed).toBeNull();
    expect(config.defaultModel).toBeUndefined();
  });
});
