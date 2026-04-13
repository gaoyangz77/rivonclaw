import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("vendor patch: prewarm defer", () => {
  const patchPath = resolve(
    __dirname,
    "../../../vendor-patches/openclaw/0007-vendor-openclaw-defer-prewarmConfiguredPrimaryModel.patch",
  );

  const patch = readFileSync(patchPath, "utf-8");

  it("patch removes the inline await of prewarmConfiguredPrimaryModel", () => {
    // The patch must remove the `await prewarmConfiguredPrimaryModel` that ran before startChannels
    expect(patch).toContain("-      await prewarmConfiguredPrimaryModel({");
  });

  it("patch defers prewarmConfiguredPrimaryModel via setTimeout", () => {
    expect(patch).toContain("+      setTimeout(() => {");
    expect(patch).toContain("+        prewarmConfiguredPrimaryModel({");
    // Must not add a new `await prewarmConfiguredPrimaryModel` line
    expect(patch).not.toMatch(/^\+\s+await prewarmConfiguredPrimaryModel/m);
  });
});
