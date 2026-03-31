/**
 * Tests for context overflow detection logic used during model switching.
 *
 * checkContextOverflow() determines whether switching to a new model would
 * exceed its context window, given the current session's token count.
 *
 * formatTokenCount() produces compact "Xk" / "X.Xm" display strings.
 */
import { describe, it, expect } from "vitest";
import { checkContextOverflow, formatTokenCount } from "../../src/pages/chat/chat-utils.js";

describe("checkContextOverflow", () => {
  // ---- Scenario A: block (tokens exceed new model's window) ----

  it("returns block when tokens exceed new context window", () => {
    const result = checkContextOverflow(150_000, 32_000);
    expect(result).toEqual({
      action: "block",
      currentTokens: 150_000,
      newContextWindow: 32_000,
    });
  });

  it("returns block when tokens barely exceed (150001 > 150000)", () => {
    const result = checkContextOverflow(150_001, 150_000);
    expect(result.action).toBe("block");
  });

  it("returns block for extreme overflow (1M tokens → 8K model)", () => {
    const result = checkContextOverflow(1_000_000, 8_000);
    expect(result.action).toBe("block");
  });

  // ---- Scenario B: warn (tokens > 80% but within window) ----

  it("returns warn when tokens exceed 80% of new context window", () => {
    // 110k tokens, 128k window → 85.9% → warn
    expect(checkContextOverflow(110_000, 128_000).action).toBe("warn");
  });

  it("returns warn at exactly 81% usage", () => {
    // 81 tokens, 100 window → 81%
    expect(checkContextOverflow(81, 100).action).toBe("warn");
  });

  it("returns warn just above 80% threshold", () => {
    // 80001 tokens, 100000 window → 80.001%
    expect(checkContextOverflow(80_001, 100_000).action).toBe("warn");
  });

  // ---- OK: safe to switch ----

  it("returns ok when tokens are well below new window", () => {
    expect(checkContextOverflow(20_000, 128_000).action).toBe("ok");
  });

  it("returns ok at exactly 80% usage", () => {
    // 80 tokens, 100 window → exactly 80% → ok (threshold is >80%)
    expect(checkContextOverflow(80, 100).action).toBe("ok");
  });

  it("returns ok when tokens are 0", () => {
    expect(checkContextOverflow(0, 128_000).action).toBe("ok");
  });

  it("returns ok when switching to a larger model", () => {
    expect(checkContextOverflow(100_000, 262_144).action).toBe("ok");
  });

  // ---- Edge cases ----

  it("returns ok when contextWindow is undefined", () => {
    expect(checkContextOverflow(150_000, undefined).action).toBe("ok");
  });

  it("returns ok when contextWindow is 0", () => {
    expect(checkContextOverflow(150_000, 0).action).toBe("ok");
  });

  it("returns ok when contextWindow is negative", () => {
    expect(checkContextOverflow(150_000, -1).action).toBe("ok");
  });

  it("returns ok when currentTokens is negative", () => {
    expect(checkContextOverflow(-1, 128_000).action).toBe("ok");
  });

  // ---- Real-world scenarios from the issue ----

  it("blocks: Qwen3.5 (202k) session switching to GLM-4 (128k)", () => {
    // User accumulated 150k tokens on Qwen3.5, switches to GLM-4
    const result = checkContextOverflow(150_000, 128_000);
    expect(result.action).toBe("block");
  });

  it("warns: moderate session switching to slightly smaller model", () => {
    // 105k tokens, switching to 128k model → 82% → warn
    expect(checkContextOverflow(105_000, 128_000).action).toBe("warn");
  });

  it("ok: small session switching to large model", () => {
    // 5k tokens, switching to Kimi K2.5 (262k) → fine
    expect(checkContextOverflow(5_000, 262_144).action).toBe("ok");
  });

  it("blocks: moonshot-v1-128k session switching to moonshot-v1-8k", () => {
    const result = checkContextOverflow(50_000, 8_000);
    expect(result.action).toBe("block");
  });
});

describe("formatTokenCount", () => {
  it("formats small numbers as-is", () => {
    expect(formatTokenCount(0)).toBe("0");
    expect(formatTokenCount(500)).toBe("500");
    expect(formatTokenCount(999)).toBe("999");
  });

  it("formats thousands as Xk", () => {
    expect(formatTokenCount(1000)).toBe("1k");
    expect(formatTokenCount(8000)).toBe("8k");
    expect(formatTokenCount(32000)).toBe("32k");
    expect(formatTokenCount(128000)).toBe("128k");
    expect(formatTokenCount(262144)).toBe("262k");
  });

  it("rounds thousands to nearest k", () => {
    expect(formatTokenCount(1500)).toBe("2k");
    expect(formatTokenCount(150_000)).toBe("150k");
    expect(formatTokenCount(204_800)).toBe("205k");
  });

  it("formats millions as Xm", () => {
    expect(formatTokenCount(1_000_000)).toBe("1m");
    expect(formatTokenCount(10_000_000)).toBe("10m");
  });

  it("formats fractional millions as X.Xm", () => {
    expect(formatTokenCount(1_500_000)).toBe("1.5m");
    expect(formatTokenCount(2_300_000)).toBe("2.3m");
  });
});
