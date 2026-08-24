import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0040-vendor-openclaw-keep-precheck-overflow-compaction-fo.patch",
);
const PATCHED_VENDOR_ROOT = resolve(__dirname, "../../../../tmp/vendor-patched/openclaw");
const VENDOR_ROOT = existsSync(PATCHED_VENDOR_ROOT)
  ? PATCHED_VENDOR_ROOT
  : resolve(__dirname, "../../../../vendor/openclaw");

describe("vendor patch 0040: replay-unsafe mid-turn overflow compaction", () => {
  const patch = readFileSync(PATCH_FILE, "utf8");
  const recovery = readFileSync(
    resolve(VENDOR_ROOT, "src/agents/embedded-agent-runner/run/attempt-recovery.ts"),
    "utf8",
  );
  const regression = readFileSync(
    resolve(
      VENDOR_ROOT,
      "src/agents/embedded-agent-runner/run.midturn-precheck-retry.test-support.ts",
    ),
    "utf8",
  );

  it("keeps the narrow precheck carve-out in the replay-safe fence", () => {
    expect(recovery).toContain("precheckOverflowRecoveryEligible");
    expect(recovery).toContain('promptErrorSource === "precheck"');
    expect(recovery).toContain(
      "if (!currentAttemptReplaySafe && !precheckOverflowRecoveryEligible) {",
    );
    expect(recovery).toContain("isLikelyContextOverflowError(formatErrorMessage(promptError))");
  });

  it("re-closes the fence after overflow recovery so replaying branches stay protected", () => {
    // Exactly one narrowed gate plus one unconditional re-close; the replaying
    // recovery branches below the re-close must never see replay-unsafe attempts.
    const narrowed = recovery.split(
      "if (!currentAttemptReplaySafe && !precheckOverflowRecoveryEligible) {",
    );
    expect(narrowed).toHaveLength(2);
    const afterNarrowedGate = narrowed[1];
    expect(afterNarrowedGate).toContain("if (!currentAttemptReplaySafe) {");
    expect(afterNarrowedGate.indexOf("recoverEmbeddedRunOverflow")).toBeLessThan(
      afterNarrowedGate.indexOf("if (!currentAttemptReplaySafe) {"),
    );
  });

  it("carries the failing-first replay-unsafe regression", () => {
    expect(regression).toContain(
      'it("compacts a replay-unsafe mid-turn precheck overflow instead of surfacing the error"',
    );
    expect(regression).toContain('promptErrorSource: "precheck"');
    expect(regression).toContain("replaySafe: false");
  });

  it("records the upstream source and removal condition", () => {
    expect(patch).toContain("b46181bfc0c");
    expect(patch).toContain("#122516");
    expect(patch).toContain("Removal:");
    expect(patch).toContain(
      "src/agents/embedded-agent-runner/run.midturn-precheck-retry.test-support.ts",
    );
    expect(patch).toContain(
      "apps/desktop/src/gateway/vendor-midturn-overflow-compaction.sentinel.test.ts",
    );
  });
});
