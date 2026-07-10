import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0020-vendor-openclaw-stream-feishu-card-deltas.patch",
);

describe("vendor patch 0020: stable Feishu CardKit streaming", () => {
  const patch = readFileSync(PATCH_FILE, "utf8");

  it("does not seed a permanent Thinking placeholder before CardKit updates", () => {
    expect(patch).toContain('{ tag: "markdown", content: "", element_id: "content" }');
    expect(patch).toContain("instead of a permanent Thinking card");
  });

  it("tracks successful CardKit delivery and surfaces rejected updates", () => {
    expect(patch).toContain("sentText: string");
    expect(patch).toContain("Update card content failed with HTTP");
    expect(patch).toContain("does not mark failed CardKit updates as delivered");
  });

  it("keeps streaming active when OpenClaw does not queue a final payload", () => {
    expect(patch).toContain("partial-only runs that do not queue a final payload");
    expect(patch).toContain('update).toHaveBeenCalledWith("和最终正文")');
  });

  it("records the upstream transport fixes that make the patch removable", () => {
    expect(patch).toContain("openclaw/openclaw#82419");
    expect(patch).toContain("openclaw/openclaw#90181");
  });
});
