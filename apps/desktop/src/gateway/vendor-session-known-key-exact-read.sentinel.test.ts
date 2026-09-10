import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const VENDOR_ROOT = resolve(
  process.env.OPENCLAW_VENDOR_ROOT ?? resolve(import.meta.dirname, "../../../../vendor/openclaw"),
);
const source = readFileSync(
  resolve(VENDOR_ROOT, "src/gateway/server-methods/sessions-shared.ts"),
  "utf8",
);

function functionBody(name: string, nextName: string): string {
  const start = source.indexOf("export function " + name);
  const end = source.indexOf("export function " + nextName, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

// Real SQLite/query-plan coverage is in vendor-patches/openclaw/tests/known-key-retirement.test.ts.
describe("upstream bounded known-key session reads", () => {
  it.each([
    ["loadAccessorSessionEntryForGatewayTarget", "loadSessionEntriesForTarget"],
    ["loadSessionEntriesForTarget", "emitSessionOperation"],
  ])("keeps %s exact, canonical, and hidden-effects aware", (name, nextName) => {
    const body = functionBody(name, nextName);
    expect(body).toContain("exactRead: true");
    expect(body).toContain("resolveCanonicalSessionEntryFromStoreKeys(");
    expect(body).toContain("isInternalSessionEffectsKey(target.canonicalKey)");
    expect(body).not.toContain("fs.existsSync(target.storePath)");
    expect(body.match(/resolveGatewaySessionStoreTargetWithStore\(/g)).toHaveLength(1);
  });

  it("makes child inclusion explicit for detail reads", () => {
    const body = functionBody("loadSessionEntriesForTarget", "emitSessionOperation");
    expect(body).toContain("includeStoreChildEntries?: boolean");
    expect(body).toContain("includeStoreChildEntries: params.includeStoreChildEntries");
    const handlers = readFileSync(
      resolve(VENDOR_ROOT, "src/gateway/server-methods/sessions-read-by-key.ts"),
      "utf8",
    );
    const describeStart = handlers.indexOf('"sessions.describe":');
    const getStart = handlers.indexOf('"sessions.get":');
    expect(describeStart).toBeGreaterThanOrEqual(0);
    expect(getStart).toBeGreaterThan(describeStart);
    expect(handlers.slice(describeStart, getStart)).toContain("includeStoreChildEntries: true");
    expect(handlers.slice(getStart)).not.toContain("includeStoreChildEntries: true");
  });

  it("routes exact probes to candidate reads, not catalog materialization", () => {
    const reader = readFileSync(
      resolve(VENDOR_ROOT, "src/gateway/session-utils-store-read.ts"),
      "utf8",
    );
    const exactStart = reader.indexOf("if (options.exactKeys)");
    const listStart = reader.indexOf("const listEntries", exactStart);
    expect(exactStart).toBeGreaterThanOrEqual(0);
    expect(listStart).toBeGreaterThan(exactStart);
    const exact = reader.slice(exactStart, listStart);
    expect(exact).toContain("loadExactSessionEntryCandidates(");
    expect(exact).toContain("sessionKeys: options.exactKeys");
    expect(exact).toContain("readOnly: options.readOnly !== false || clone === false");
    expect(exact).not.toContain("listAccessorSessionEntries(");
  });
});
