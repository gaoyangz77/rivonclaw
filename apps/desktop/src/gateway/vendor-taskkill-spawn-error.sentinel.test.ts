import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0022-vendor-openclaw-handle-taskkill-spawn-errors.patch",
);

describe("vendor patch 0022: tolerate taskkill spawn errors", () => {
  const patch = readFileSync(PATCH_FILE, "utf8");

  it("handles asynchronous taskkill spawn errors before they reach the gateway", () => {
    expect(patch).toContain('const child = spawn("taskkill", args');
    expect(patch).toContain('child.once("error", () => {})');
  });

  it("carries the upstream behavior test for an asynchronous ENOENT", () => {
    expect(patch).toContain("on Windows ignores asynchronous taskkill spawn errors");
    expect(patch).toContain('taskkillChild.emit("error", new Error("spawn ENOENT"))');
  });
});
