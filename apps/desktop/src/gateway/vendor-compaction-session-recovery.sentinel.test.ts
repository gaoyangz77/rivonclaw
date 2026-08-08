import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0029-vendor-openclaw-rotate-sessions-after-compaction-failure.patch",
);

describe("vendor patch 0029: compaction-failure lifecycle reset", () => {
  const patch = readFileSync(PATCH_FILE, "utf-8");

  it("resets the SQLite lifecycle instead of repeatedly reusing poisoned context", () => {
    expect(patch).toContain("resetSessionAfterCompactionFailure");
    expect(patch).toContain("clean lifecycle");
    expect(patch).toContain("the failed transcript remains available");
  });

  it("keeps the upstream preserved-session fallback when reset is unavailable", () => {
    expect(patch).toContain("preserveSessionMapping: !didReset");
    expect(patch).toContain("because reset was unavailable");
  });

  it("covers both payload and thrown compaction failures", () => {
    expect(patch).toContain(
      'it("resets the session lifecycle when embedded overflow recovery fails"',
    );
    expect(patch).toContain(
      'it("resets the session lifecycle when compaction failure is thrown before reply"',
    );
  });
});
