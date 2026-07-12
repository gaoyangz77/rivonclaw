import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0019-vendor-openclaw-run-image-tool-prompts-in-child-process.patch",
);

describe("vendor patch 0019: worker-backed OpenClaw image tool", () => {
  const patch = readFileSync(PATCH_FILE, "utf-8");

  it("keeps the official image tool surface instead of introducing a replacement tool", () => {
    expect(patch).toContain("RivonClaw needs to keep the official image tool name");
    expect(patch).toContain("runImagePromptWithWorkerFallback");
    expect(patch).not.toContain("rivonclaw-image-worker");
  });

  it("runs image prompt execution through a child process worker by default", () => {
    expect(patch).toContain('import { fork } from "node:child_process"');
    expect(patch).toContain("image-tool-worker.ts");
    expect(patch).toContain("OPENCLAW_IMAGE_TOOL_CHILD_PROCESS");
  });

  it("carries a vendor behavior test for child runner delegation", () => {
    expect(patch).toContain('describe("image tool child process delegation"');
    expect(patch).toContain('vi.stubEnv("OPENCLAW_IMAGE_TOOL_CHILD_PROCESS", "1")');
    expect(patch).toContain("expect(childRunner).toHaveBeenCalledTimes(1)");
  });

});
