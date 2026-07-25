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

describe("vendor patch 0029: compaction-failure successor session", () => {
  const patch = readFileSync(PATCH_FILE, "utf-8");

  it("rotates the route instead of repeatedly reusing an unrecoverable transcript", () => {
    expect(patch).toContain("resetSessionAfterCompactionFailure");
    expect(patch).toContain("Rotated");
    expect(patch).toContain("clean successor session");
  });

  it("keeps the upstream preserved-session fallback when rotation is unavailable", () => {
    expect(patch).toContain("preserveSessionMapping: !didReset");
    expect(patch).toContain("because successor rotation was unavailable");
  });

  it("carries an integration test that preserves the failed transcript", () => {
    expect(patch).toContain(
      'it("rotates an unrecoverable compaction session while preserving its transcript"',
    );
    expect(patch).toContain('expect(await fs.readFile(sessionFile, "utf-8")).toContain');
  });
});
