import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { Rule } from "@rivonclaw/core";
import { createStorage, type Storage } from "@rivonclaw/storage";
import { ArtifactPipeline } from "./pipeline.js";

// ---------------------------------------------------------------------------
// Mock the LLM client
// ---------------------------------------------------------------------------

const mockChatCompletion = vi.fn();
vi.mock("../llm/llm-client.js", () => ({
  chatCompletion: (...args: unknown[]) => mockChatCompletion(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRule(text: string, id?: string): Rule {
  const now = new Date().toISOString();
  return { id: id ?? randomUUID(), text, createdAt: now, updatedAt: now };
}

function setupLLMSuccess(): void {
  // Classification
  mockChatCompletion.mockResolvedValueOnce({
    content: '{"type": "policy-fragment", "reasoning": "ok"}',
  });
  // Generation
  mockChatCompletion.mockResolvedValueOnce({
    content: "LLM-generated policy content",
  });
}

// ---------------------------------------------------------------------------
// Pipeline retry logic tests
// ---------------------------------------------------------------------------

describe("ArtifactPipeline LLM retry logic", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage(":memory:");
    mockChatCompletion.mockReset();
  });

  afterEach(() => {
    storage.close();
  });

  it("uses LLM compilation when config is available", async () => {
    const pipeline = new ArtifactPipeline({
      storage,
      resolveLLMConfig: async () => ({
        gatewayUrl: "http://localhost:9999",
        authToken: "token",
      }),
      maxRetries: 1,
      retryBaseDelayMs: 0,
    });

    setupLLMSuccess();

    const rule = makeRule("Be polite");
    storage.rules.create(rule);
    const artifact = await pipeline.compileRule(rule);

    expect(artifact.status).toBe("ok");
    expect(artifact.content).toBe("LLM-generated policy content");
    expect(mockChatCompletion).toHaveBeenCalled();
  });

  it("falls back to heuristic when resolveLLMConfig returns null", async () => {
    const pipeline = new ArtifactPipeline({
      storage,
      resolveLLMConfig: async () => null,
    });

    const rule = makeRule("Be polite");
    storage.rules.create(rule);
    const artifact = await pipeline.compileRule(rule);

    expect(artifact.status).toBe("ok");
    // Heuristic fallback produces [POLICY] prefix
    expect(artifact.content).toBe("[POLICY] Be polite");
    expect(mockChatCompletion).not.toHaveBeenCalled();
  });

  it("falls back to heuristic when resolveLLMConfig throws", async () => {
    const pipeline = new ArtifactPipeline({
      storage,
      resolveLLMConfig: async () => {
        throw new Error("Config not available");
      },
    });

    const rule = makeRule("Be polite");
    storage.rules.create(rule);
    const artifact = await pipeline.compileRule(rule);

    expect(artifact.status).toBe("ok");
    expect(artifact.content).toBe("[POLICY] Be polite");
    expect(mockChatCompletion).not.toHaveBeenCalled();
  });

  it("retries LLM compilation on failure and succeeds on second attempt", async () => {
    const pipeline = new ArtifactPipeline({
      storage,
      resolveLLMConfig: async () => ({
        gatewayUrl: "http://localhost:9999",
        authToken: "token",
      }),
      maxRetries: 3,
      retryBaseDelayMs: 0, // no delay in tests
    });

    // First attempt: fails at classification
    mockChatCompletion.mockRejectedValueOnce(new Error("Temporary error"));
    // Second attempt: succeeds
    setupLLMSuccess();

    const rule = makeRule("Be polite");
    storage.rules.create(rule);
    const artifact = await pipeline.compileRule(rule);

    expect(artifact.status).toBe("ok");
    expect(artifact.content).toBe("LLM-generated policy content");
    // 1 failed classification + 2 successful (classification + generation)
    expect(mockChatCompletion).toHaveBeenCalledTimes(3);
  });

  it("falls back to heuristic after all LLM retries are exhausted", async () => {
    const pipeline = new ArtifactPipeline({
      storage,
      resolveLLMConfig: async () => ({
        gatewayUrl: "http://localhost:9999",
        authToken: "token",
      }),
      maxRetries: 2,
      retryBaseDelayMs: 0,
    });

    // Both attempts fail
    mockChatCompletion.mockRejectedValueOnce(new Error("Error 1"));
    mockChatCompletion.mockRejectedValueOnce(new Error("Error 2"));

    const rule = makeRule("Be polite");
    storage.rules.create(rule);
    const artifact = await pipeline.compileRule(rule);

    expect(artifact.status).toBe("ok");
    // Fell back to heuristic
    expect(artifact.content).toBe("[POLICY] Be polite");
    expect(mockChatCompletion).toHaveBeenCalledTimes(2);
  });

  it("uses heuristic fallback without retries when no LLM config resolver", async () => {
    const pipeline = new ArtifactPipeline({ storage });

    const rule = makeRule("Block dangerous operations");
    storage.rules.create(rule);
    const artifact = await pipeline.compileRule(rule);

    expect(artifact.status).toBe("ok");
    expect(artifact.type).toBe("guard");
    expect(mockChatCompletion).not.toHaveBeenCalled();
  });

  it("respects custom maxRetries configuration", async () => {
    const pipeline = new ArtifactPipeline({
      storage,
      resolveLLMConfig: async () => ({
        gatewayUrl: "http://localhost:9999",
        authToken: "token",
      }),
      maxRetries: 1,
      retryBaseDelayMs: 0,
    });

    // Single retry that fails
    mockChatCompletion.mockRejectedValueOnce(new Error("Only attempt"));

    const rule = makeRule("Be polite");
    storage.rules.create(rule);
    const artifact = await pipeline.compileRule(rule);

    // Falls back to heuristic after 1 retry
    expect(artifact.status).toBe("ok");
    expect(artifact.content).toBe("[POLICY] Be polite");
    expect(mockChatCompletion).toHaveBeenCalledTimes(1);
  });

  it("resolves LLM config fresh on each compile call", async () => {
    let callCount = 0;
    const pipeline = new ArtifactPipeline({
      storage,
      resolveLLMConfig: async () => {
        callCount++;
        return null; // Always return null so it uses heuristic
      },
    });

    const rule1 = makeRule("Rule 1");
    const rule2 = makeRule("Rule 2");
    storage.rules.create(rule1);
    storage.rules.create(rule2);

    await pipeline.compileRule(rule1);
    await pipeline.compileRule(rule2);

    // Config was resolved for each compile call
    expect(callCount).toBe(2);
  });

  it("emits compiled event with LLM-generated artifact", async () => {
    const pipeline = new ArtifactPipeline({
      storage,
      resolveLLMConfig: async () => ({
        gatewayUrl: "http://localhost:9999",
        authToken: "token",
      }),
      maxRetries: 1,
      retryBaseDelayMs: 0,
    });

    setupLLMSuccess();

    const handler = vi.fn();
    pipeline.on("compiled", handler);

    const rule = makeRule("Be polite");
    storage.rules.create(rule);
    await pipeline.compileRule(rule);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      rule.id,
      expect.objectContaining({
        ruleId: rule.id,
        status: "ok",
        content: "LLM-generated policy content",
      }),
    );
  });
});
