import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0016-vendor-openclaw-allow-session-context-token-patch.patch",
);

describe("vendor patch 0016: sessions.patch contextTokens support", () => {
  const patch = readFileSync(PATCH_FILE, "utf-8");

  it("exposes contextTokens in the sessions.patch protocol schema", () => {
    expect(patch).toContain("diff --git a/src/gateway/protocol/schema/sessions.ts");
    expect(patch).toContain(
      "+    contextTokens: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Null()])),",
    );
  });

  it("persists and clears contextTokens in the patch handler", () => {
    expect(patch).toContain("diff --git a/src/gateway/sessions-patch.ts");
    expect(patch).toContain('+  if ("contextTokens" in patch) {');
    expect(patch).toContain("+      delete next.contextTokens;");
    expect(patch).toContain("+      next.contextTokens = raw;");
  });

  it("carries vendor handler tests for contextTokens set and clear", () => {
    expect(patch).toContain('test("persists contextTokens override"');
    expect(patch).toContain("contextTokens: 100_000");
    expect(patch).toContain('test("clears contextTokens override"');
  });
});
