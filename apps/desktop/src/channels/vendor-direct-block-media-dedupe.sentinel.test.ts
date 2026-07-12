import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0025-vendor-openclaw-dedupe-directly-sent-block-media.patch",
);

describe("vendor patch 0025: dedupe directly sent block media", () => {
  const patch = readFileSync(PATCH_FILE, "utf8");

  it("tracks successfully delivered media separately from final reply payloads", () => {
    expect(patch).toContain("directlySentBlockMediaUrls");
    expect(patch).toContain("directlySentBlockTextFragments");
    expect(patch).toContain("keeps only media not already sent with a direct block");
    expect(patch).toMatch(
      /   await params\.onBlockReply\(params\.payload\);\n\+  params\.directlySentBlockKeys\.add/,
    );
  });

  it("records both upstream fixes that make the patch removable", () => {
    expect(patch).toContain("Temporary backport");
    expect(patch).toContain("openclaw/openclaw@9922da3965");
    expect(patch).toContain("openclaw/openclaw@41000143a1");
    expect(patch).toContain("Delete this temporary patch");
  });
});
