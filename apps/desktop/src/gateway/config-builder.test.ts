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
    expect(normalizeGeminiOAuthModelId("google-gemini-cli/gemini-3-pro-preview"))
      .toBe("gemini-3-pro-preview");
    expect(normalizeGeminiOAuthModelId("google-gemini-cli/google-gemini-cli/gemini-3-pro-preview"))
      .toBe("gemini-3-pro-preview");
    expect(normalizeGeminiOAuthModelId("google/gemini-3-pro-preview"))
      .toBe("gemini-3-pro-preview");
  });

  it("forces RivonClaw cloud models to support image input", () => {
    const overrides = buildCustomProviderOverridesFromKeys([
      {
        provider: "rivonclaw-pro",
        authType: "custom",
        baseUrl: "https://api.rivonclaw.com/llm/v1",
        customProtocol: "openai",
        customModelsJson: JSON.stringify([
          { id: "vision", input: ["text"] },
        ]),
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
});
