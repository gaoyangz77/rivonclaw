import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("vendor patch: prewarm defer", () => {
  const patchPath = resolve(
    __dirname,
    "../../../vendor-patches/openclaw/0007-vendor-openclaw-defer-prewarmConfiguredPrimaryModel.patch",
  );

  const patch = readFileSync(patchPath, "utf-8");

  it("patch removes the inline primary-model prewarm scheduling before channel startup", () => {
    // The patch must remove the prewarm scheduling that ran before startChannels.
    expect(patch).toContain("-        schedulePrimaryModelPrewarm(");
  });

  it("patch defers primary-model prewarm scheduling via setTimeout", () => {
    expect(patch).toContain("+        setTimeout(() => {");
    expect(patch).toContain("+          schedulePrimaryModelPrewarm(");
    expect(patch).toContain("+        }, 15_000);");
    // Must not add a new immediate prewarm await line.
    expect(patch).not.toMatch(/^\+\s+await prewarmConfiguredPrimaryModel/m);
  });
});
