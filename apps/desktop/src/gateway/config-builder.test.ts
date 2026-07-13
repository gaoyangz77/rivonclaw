import { describe, expect, it } from "vitest";
import {
  buildCustomProviderOverridesFromKeys,
  DEFAULT_GATEWAY_TOOL_ALLOWLIST,
  normalizeGeminiOAuthModelId,
} from "./config-builder.js";

describe("gateway config builder", () => {
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

  it("preserves cloud model context and output limits", () => {
    const overrides = buildCustomProviderOverridesFromKeys([
      {
        provider: "rivonclaw-pro",
        authType: "custom",
        baseUrl: "https://api.rivonclaw.com/llm/v1",
        customProtocol: "openai",
        customModelsJson: JSON.stringify([
          {
            id: "gpt-5.6-terra",
            display_name: "GPT 5.6 Terra",
            context_length: 372_000,
            max_completion_tokens: 128_000,
          },
        ]),
      },
    ]);

    expect(overrides["rivonclaw-pro"]?.models).toEqual([
      {
        id: "gpt-5.6-terra",
        name: "GPT 5.6 Terra",
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
});
