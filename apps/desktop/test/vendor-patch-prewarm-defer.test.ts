import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("vendor patch: prewarm defer", () => {
  const patchPath = resolve(
    __dirname,
    "../../../vendor-patches/openclaw/0007-vendor-openclaw-defer-prewarmConfiguredPrimaryModel.patch",
  );

  const patch = readFileSync(patchPath, "utf-8");

  it("patch removes synchronous model-runtime publication before channel startup", () => {
    expect(patch).toContain(
      '-  await measureStartup(params.startupTrace, "sidecars.model-runtime", () =>',
    );
    expect(patch).toContain("-    publishStartupModelRuntime(");
  });

  it("patch defers primary-model prewarm scheduling via setTimeout", () => {
    expect(patch).toContain("+        const prewarmTimer = setTimeout(() => {");
    expect(patch).toContain("+          void publishStartupModelRuntime(");
    expect(patch).toContain("+          ).catch((err) => {");
    expect(patch).toContain("+        prewarmTimer.unref?.();");
    expect(patch).toContain("+        }, 15_000);");
    // Must not add a new immediate prewarm await line.
    expect(patch).not.toMatch(/^\+\s+await prewarmConfiguredPrimaryModel/m);
  });
});
