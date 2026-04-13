import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("vendor patch: prewarm defer", () => {
  const src = readFileSync(
    resolve(__dirname, "../../../vendor/openclaw/src/gateway/server-startup-post-attach.ts"),
    "utf-8",
  );

  it("startChannels runs before prewarmConfiguredPrimaryModel in the skipChannels block", () => {
    // Extract the !skipChannels block
    const blockStart = src.indexOf("if (!skipChannels)");
    expect(blockStart).toBeGreaterThan(-1);

    const relevantCode = src.slice(blockStart, blockStart + 800);

    const channelsIdx = relevantCode.indexOf("startChannels()");
    const prewarmIdx = relevantCode.indexOf("prewarmConfiguredPrimaryModel(");

    expect(channelsIdx).toBeGreaterThan(-1);
    expect(prewarmIdx).toBeGreaterThan(-1);
    expect(channelsIdx).toBeLessThan(prewarmIdx);
  });

  it("prewarmConfiguredPrimaryModel is deferred via setTimeout, not awaited inline", () => {
    const blockStart = src.indexOf("if (!skipChannels)");
    const relevantCode = src.slice(blockStart, blockStart + 800);

    // Should NOT have `await prewarmConfiguredPrimaryModel`
    expect(relevantCode).not.toMatch(/await\s+prewarmConfiguredPrimaryModel/);

    // Should have setTimeout wrapping prewarm
    expect(relevantCode).toMatch(/setTimeout\s*\(\s*\(\)\s*=>\s*\{?\s*\n?\s*prewarmConfiguredPrimaryModel/);
  });
});
