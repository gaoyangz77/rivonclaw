import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0023-vendor-openclaw-preserve-Feishu-task-lifecycle-after.patch",
);

describe("vendor patch 0023: preserve Feishu task lifecycle after queue eviction", () => {
  const patch = readFileSync(PATCH_FILE, "utf8");

  it("unblocks the queue without resolving the original message handler", () => {
    expect(patch).toContain("const run = previous.then(");
    expect(patch).toContain("const next = boundedWait(key, run, taskTimeoutMs, onTaskTimeout)");
    expect(patch).toContain("return run");
  });

  it("tests that an evicted task remains pending for its caller", () => {
    expect(patch).toContain("expect(stuckSettled).toBe(false)");
    expect(patch).toContain("The caller still observes the original task lifecycle");
  });
});
