import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { compileRuleWithLLM } from "./compiler.js";
import type { LLMConfig } from "./llm-client.js";

// ---------------------------------------------------------------------------
// Mock the LLM client
// ---------------------------------------------------------------------------

const mockChatCompletion = vi.fn();
vi.mock("./llm-client.js", () => ({
  chatCompletion: (...args: unknown[]) => mockChatCompletion(...args),
}));

const fakeLLMConfig: LLMConfig = {
  gatewayUrl: "http://127.0.0.1:9999",
  authToken: "test-token",
};

// ---------------------------------------------------------------------------
// Tests for LLM-based compilation
// ---------------------------------------------------------------------------

describe("compileRuleWithLLM", () => {
  beforeEach(() => {
    mockChatCompletion.mockReset();
  });

  it("classifies as policy-fragment and generates policy content", async () => {
    // First call: classification
    mockChatCompletion.mockResolvedValueOnce({
      content: '{"type": "policy-fragment", "reasoning": "This is a behavioral guideline"}',
    });
    // Second call: generation
    mockChatCompletion.mockResolvedValueOnce({
      content: "Always respond in a polite and professional manner.",
    });

    const result = await compileRuleWithLLM("Be polite", fakeLLMConfig);

    expect(result.artifactType).toBe("policy-fragment");
    expect(result.content).toBe("Always respond in a polite and professional manner.");
    expect(mockChatCompletion).toHaveBeenCalledTimes(2);
  });

  it("classifies as guard and generates guard JSON", async () => {
    mockChatCompletion.mockResolvedValueOnce({
      content: '{"type": "guard", "reasoning": "This blocks file writes"}',
    });
    const guardJson = JSON.stringify({
      type: "guard",
      toolPattern: "write_file",
      condition: "tool:write_file",
      action: "block",
      reason: "Writing files is not allowed",
      params: {},
    });
    mockChatCompletion.mockResolvedValueOnce({
      content: guardJson,
    });

    const result = await compileRuleWithLLM("Block all file writes", fakeLLMConfig);

    expect(result.artifactType).toBe("guard");
    expect(result.content).toBe(guardJson);
  });

  it("classifies as action-bundle and generates SKILL.md content", async () => {
    mockChatCompletion.mockResolvedValueOnce({
      content: '{"type": "action-bundle", "reasoning": "This adds new functionality"}',
    });
    const skillContent = [
      "---",
      "name: web-search",
      "description: Search the web for information",
      "---",
      "",
      "Instructions for web search...",
    ].join("\n");
    mockChatCompletion.mockResolvedValueOnce({
      content: skillContent,
    });

    const result = await compileRuleWithLLM("Add a skill to search the web", fakeLLMConfig);

    expect(result.artifactType).toBe("action-bundle");
    expect(result.content).toBe(skillContent);
  });

  it("handles LLM response wrapped in markdown code fences", async () => {
    mockChatCompletion.mockResolvedValueOnce({
      content: '```json\n{"type": "guard", "reasoning": "blocking rule"}\n```',
    });
    mockChatCompletion.mockResolvedValueOnce({
      content: '{"type":"guard","condition":"tool:*","action":"block","reason":"blocked"}',
    });

    const result = await compileRuleWithLLM("Block everything", fakeLLMConfig);

    expect(result.artifactType).toBe("guard");
  });

  it("falls back to policy-fragment when LLM returns unparseable JSON", async () => {
    mockChatCompletion.mockResolvedValueOnce({
      content: "I think this should be a policy fragment because...",
    });
    // Since classification falls back to policy-fragment, generation is still called
    mockChatCompletion.mockResolvedValueOnce({
      content: "Follow this guideline.",
    });

    const result = await compileRuleWithLLM("Some rule text", fakeLLMConfig);

    expect(result.artifactType).toBe("policy-fragment");
    expect(result.content).toBe("Follow this guideline.");
  });

  it("falls back to policy-fragment when LLM returns unknown type", async () => {
    mockChatCompletion.mockResolvedValueOnce({
      content: '{"type": "unknown-type", "reasoning": "made up"}',
    });
    mockChatCompletion.mockResolvedValueOnce({
      content: "Generated policy.",
    });

    const result = await compileRuleWithLLM("Some rule", fakeLLMConfig);

    expect(result.artifactType).toBe("policy-fragment");
  });

  it("passes the rule text to the classification call", async () => {
    mockChatCompletion.mockResolvedValueOnce({
      content: '{"type": "policy-fragment", "reasoning": "ok"}',
    });
    mockChatCompletion.mockResolvedValueOnce({
      content: "policy text",
    });

    await compileRuleWithLLM("My specific rule text", fakeLLMConfig);

    // Classification call should include the rule text
    const classificationCall = mockChatCompletion.mock.calls[0];
    const messages = classificationCall[1];
    expect(messages).toContainEqual({ role: "user", content: "My specific rule text" });
  });

  it("passes the rule text to the generation call", async () => {
    mockChatCompletion.mockResolvedValueOnce({
      content: '{"type": "guard", "reasoning": "ok"}',
    });
    mockChatCompletion.mockResolvedValueOnce({
      content: "{}",
    });

    await compileRuleWithLLM("Block dangerous commands", fakeLLMConfig);

    // Generation call should include the rule text
    const generationCall = mockChatCompletion.mock.calls[1];
    const messages = generationCall[1];
    expect(messages).toContainEqual({ role: "user", content: "Block dangerous commands" });
  });

  it("uses the correct system prompt for guard generation", async () => {
    mockChatCompletion.mockResolvedValueOnce({
      content: '{"type": "guard", "reasoning": "ok"}',
    });
    mockChatCompletion.mockResolvedValueOnce({
      content: "{}",
    });

    await compileRuleWithLLM("Block files", fakeLLMConfig);

    const generationCall = mockChatCompletion.mock.calls[1];
    const messages = generationCall[1];
    const systemMessage = messages.find((m: { role: string }) => m.role === "system");
    expect(systemMessage.content).toContain("guard specification writer");
  });

  it("uses the correct system prompt for action-bundle generation", async () => {
    mockChatCompletion.mockResolvedValueOnce({
      content: '{"type": "action-bundle", "reasoning": "ok"}',
    });
    mockChatCompletion.mockResolvedValueOnce({
      content: "---\nname: test\n---\nbody",
    });

    await compileRuleWithLLM("Add a skill", fakeLLMConfig);

    const generationCall = mockChatCompletion.mock.calls[1];
    const messages = generationCall[1];
    const systemMessage = messages.find((m: { role: string }) => m.role === "system");
    expect(systemMessage.content).toContain("skill author");
  });

  it("trims whitespace from LLM content", async () => {
    mockChatCompletion.mockResolvedValueOnce({
      content: '  {"type": "policy-fragment", "reasoning": "ok"}  \n',
    });
    mockChatCompletion.mockResolvedValueOnce({
      content: "  Generated content with spaces  \n\n",
    });

    const result = await compileRuleWithLLM("Rule", fakeLLMConfig);

    expect(result.content).toBe("Generated content with spaces");
  });

  it("propagates errors from the LLM client during classification", async () => {
    mockChatCompletion.mockRejectedValueOnce(new Error("Network error"));

    await expect(
      compileRuleWithLLM("Some rule", fakeLLMConfig),
    ).rejects.toThrow("Network error");
  });

  it("propagates errors from the LLM client during generation", async () => {
    mockChatCompletion.mockResolvedValueOnce({
      content: '{"type": "policy-fragment", "reasoning": "ok"}',
    });
    mockChatCompletion.mockRejectedValueOnce(new Error("Generation failed"));

    await expect(
      compileRuleWithLLM("Some rule", fakeLLMConfig),
    ).rejects.toThrow("Generation failed");
  });
});
