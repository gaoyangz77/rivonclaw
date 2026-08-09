import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0033-vendor-openclaw-avoid-legacy-context-engine-self-degradation.patch",
);

describe("vendor patch 0033: avoid legacy context-engine self-degradation", () => {
  const patch = readFileSync(PATCH_FILE, "utf-8");

  it("keeps the baseline legacy engine configured for transcript-host turns", () => {
    expect(patch).toContain("isBaselineEngineSelection");
    expect(patch).toContain(
      "resolution.configured.registeredId === resolution.fallback.registeredId",
    );
    expect(patch).toContain("Legacy delegates durable transcript ownership to SessionManager");
  });

  it("retains real degradation for a distinct configured engine", () => {
    expect(patch).toContain('if (state === "started")');
    expect(patch).toContain("degradedReason ??= reason");
  });

  it("documents the upstream fix and removal condition", () => {
    expect(patch).toContain("b550c140c7ee21a8a297d089f09be84e9e4b2541");
    expect(patch).toContain("#120722");
  });
});
