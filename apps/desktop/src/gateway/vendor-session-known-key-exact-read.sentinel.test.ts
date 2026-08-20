import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0035-vendor-openclaw-bound-known-key-session-reads.patch",
);

const VENDOR_SOURCE = resolve(
  __dirname,
  "../../../../tmp/vendor-patched/openclaw/src/gateway/server-methods/sessions-shared.ts",
);

function functionBody(source: string, name: string, nextName: string): string {
  const start = source.indexOf(`export function ${name}`);
  const end = source.indexOf(`export function ${nextName}`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("vendor patch 0035: bounded known-key session reads", () => {
  const patch = readFileSync(PATCH_FILE, "utf-8");
  const source = readFileSync(VENDOR_SOURCE, "utf-8");

  it("keeps accessor lookups bounded to exact SQLite rows", () => {
    const body = functionBody(
      source,
      "loadAccessorSessionEntryForGatewayTarget",
      "loadSessionEntriesForTarget",
    );
    expect(body).toContain("exactRead: true");
    expect(body).toContain("fs.existsSync(target.storePath)");
  });

  it("keeps describe/get lookups bounded to exact SQLite rows", () => {
    const body = functionBody(source, "loadSessionEntriesForTarget", "emitSessionOperation");
    expect(body).toContain("exactRead: true");
    expect(body).toContain("fs.existsSync(target.storePath)");
  });

  it("carries vendor regression coverage and an explicit upstream removal condition", () => {
    expect(patch).toContain("sessions-shared.exact-read.test.ts");
    expect(patch).toContain("257b8e0");
    expect(patch).toContain("Removal:");
  });
});
