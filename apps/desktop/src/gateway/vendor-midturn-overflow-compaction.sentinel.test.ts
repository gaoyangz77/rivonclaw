import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const VENDOR_ROOT = resolve(__dirname, "../../../../vendor/openclaw");

describe("OpenClaw v2026.8.1: settled mid-turn overflow recovery", () => {
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

  it("admits only settled, synchronous mid-turn work through the first fence", () => {
    expect(recovery).toContain("canContinueSettledMidTurnOverflow");
    expect(recovery).toContain('attempt.preflightRecovery?.source === "mid-turn"');
    expect(recovery).toContain("midTurnBatchSettled");
    expect(recovery).toContain("!hasAsyncActivity(attempt.toolMetas)");
    expect(recovery).toContain("!canContinueSettledMidTurnOverflow");
  });

  it("re-closes replaying recovery after current-transcript compaction", () => {
    const overflowIndex = recovery.indexOf("recoverEmbeddedRunOverflow");
    const replayFenceIndex = recovery.indexOf(
      "if (!currentAttemptReplaySafe) {",
      overflowIndex,
    );
    expect(overflowIndex).toBeGreaterThan(-1);
    expect(replayFenceIndex).toBeGreaterThan(overflowIndex);
  });

  it("carries settled-tool and parked Code Mode regressions", () => {
    expect(regression).toContain(
      'it("compacts settled replay-unsafe tools and continues from their recorded result"',
    );
    expect(regression).toContain("replaySafe: false");
    expect(regression).toContain("keeps a parked Code Mode run fail-closed");
  });
});
