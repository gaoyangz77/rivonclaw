import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0024-vendor-openclaw-allow-buffer-verified-ZIP-attachment.patch",
);

describe("vendor patch 0024: allow buffer-verified ZIP attachments", () => {
  const patch = readFileSync(PATCH_FILE, "utf8");

  it("allows genuine ZIP payloads without trusting the file extension", () => {
    expect(patch).toContain('"application/zip"');
    expect(patch).toContain("allows host-read ZIP files");
    expect(patch).toContain("file-type detects application/zip from these magic bytes");
  });

  it("records the upstream fix that makes the patch removable", () => {
    expect(patch).toContain("Temporary backport");
    expect(patch).toContain("already fixed this regression upstream");
    expect(patch).toContain("openclaw/openclaw@d6881962a3");
    expect(patch).toContain("Delete this temporary patch");
  });
});
