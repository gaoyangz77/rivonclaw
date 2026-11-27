/**
 * Tests for formatTokenCount() produces compact "Xk" / "X.Xm" display strings.
 */
import { describe, it, expect } from "vitest";
import { formatTokenCount } from "../../src/pages/chat/chat-utils.js";

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
