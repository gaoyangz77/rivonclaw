import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("vendor patch: CPU debugging diagnostics", () => {
  const patchPath = resolve(
    __dirname,
    "../../../vendor-patches/openclaw/0017-vendor-openclaw-add-cpu-debugging-diagnostics.patch",
  );

  const patch = readFileSync(patchPath, "utf-8");

  it("keeps diagnostics behind an explicit CPU debugging switch", () => {
    expect(patch).toContain("CPU_DEBUGGING");
    expect(patch).toContain("RIVONCLAW_CPU_DEBUGGING");
    expect(patch).toContain("+export function isCpuDebuggingEnabled");
  });

  it("logs stale model-call details and recovery ineligibility", () => {
    expect(patch).toContain("[cpu-debug] stalled-session-detail");
    expect(patch).toContain("[cpu-debug] stuck-recovery-not-eligible");
    expect(patch).toContain("[cpu-debug] model-call-end-without-start");
    expect(patch).toContain("[cpu-debug] model-call-end-without-session");
  });

  it("logs reload deferral and task registry inspection timings", () => {
    expect(patch).toContain("[cpu-debug] channel-reload-active-counts");
    expect(patch).toContain("taskBlockersMs=");
    expect(patch).toContain("[cpu-debug] task-registry-inspect");
    expect(patch).toContain("reconcileMs=");
  });

  it("carries an e2e proof that CPU debug output reaches file logs", () => {
    expect(patch).toContain("src/tasks/task-registry.cpu-debugging.e2e.test.ts");
    expect(patch).toContain(
      "emits sampled task inspection diagnostics through the real file logger",
    );
    expect(patch).toContain("runId=cpu-debug-e2e-run");
  });

  it("starts a gated low-frequency task inspection sampler at gateway startup", () => {
    expect(patch).toContain("startCpuDebuggingTaskInspectionSampler");
    expect(patch).toContain("CPU_DEBUG_TASK_INSPECTION_INTERVAL_MS = 30_000");
    expect(patch).toContain("[cpu-debug] task-inspection-sampler");
  });
});
