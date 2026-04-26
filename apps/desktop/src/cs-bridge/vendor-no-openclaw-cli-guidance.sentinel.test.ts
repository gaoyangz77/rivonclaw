import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0009-vendor-openclaw-replace-cli-guidance-for-rivonclaw-desktop.patch",
);

describe("vendor patch 0009: replace OpenClaw CLI guidance", () => {
  const patch = readFileSync(PATCH_FILE, "utf-8");

  it("removes the upstream OpenClaw CLI quick reference", () => {
    expect(patch).toContain("-    \"## OpenClaw CLI Quick Reference\"");
    expect(patch).toContain("-    \"- openclaw gateway status\"");
    expect(patch).toContain("-    \"If unsure, ask the user to run `openclaw help`");
  });

  it("adds RivonClaw Desktop runtime guidance instead", () => {
    expect(patch).toContain("+    \"## RivonClaw Desktop Runtime\"");
    expect(patch).toContain("Do not run or ask the user to run `openclaw` CLI commands");
    expect(patch).toContain("use first-class runtime tools");
  });

  it("removes the docs-section instruction to run openclaw status", () => {
    expect(patch).toContain("-    \"When diagnosing issues, run `openclaw status` yourself");
    expect(patch).toContain("use available first-class runtime tools instead of shelling out");
  });
});
