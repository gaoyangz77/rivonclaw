import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0026-vendor-openclaw-recover-reply-session-initialization.patch",
);

describe("vendor patch 0026: recover reply session initialization conflicts", () => {
  const patch = readFileSync(PATCH_FILE, "utf8");

  it("narrows false conflicts and retries real conflicts outside the writer lane", () => {
    expect(patch).toContain('Pick<SessionEntry, "sessionFile" | "sessionId">');
    expect(patch).toContain("SESSION_INIT_CONFLICT_MAX_ATTEMPTS = 5");
    expect(patch).toContain("runWithSessionInitConflictRetry");
    expect(patch).toContain("signal: opts?.abortSignal");
  });

  it("records both upstream fixes and an exact removal condition", () => {
    expect(patch).toContain("826c84ea19429ece853d62aba5b674cae90f5824 (PR #98835)");
    expect(patch).toContain("101b601df8acb9139dedc6070081b993dcd5fccb (PR #105754)");
    expect(patch).toContain("containing both upstream commits");
  });
});
