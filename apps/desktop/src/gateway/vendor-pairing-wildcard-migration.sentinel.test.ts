import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0031-vendor-openclaw-ignore-wildcard-pairing-bindings-dur.patch",
);

describe("vendor patch 0031: wildcard pairing migration", () => {
  const patch = readFileSync(PATCH_FILE, "utf-8");

  it("does not treat wildcard route bindings as concrete pairing accounts", () => {
    expect(patch).toContain("resolveConcreteBindingAccountId");
    expect(patch).toContain('accountId !== "*"');
    expect(patch).toContain("does not treat wildcard route bindings as pairing account ids");
  });

  it("keeps one invalid account candidate from aborting the migration", () => {
    expect(patch).toContain("One invalid configured candidate must not abort every legacy migration");
    expect(patch).toContain("ignores invalid account candidates while resolving scoped filenames");
  });

  it("records the exact upstream removal condition", () => {
    expect(patch).toContain("718e9c88204772c496e8f625cd63be8106cfa106");
    expect(patch).toContain("PR #116610");
  });
});
