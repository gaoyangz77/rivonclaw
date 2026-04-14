import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Tests Phase 4f of prune-vendor-deps.cjs: orphaned dist-runtime wrapper cleanup.
 *
 * Phase 4f removes dist-runtime/extensions entries that have no corresponding
 * dist/extensions entry. This test covers the edge case where dist/extensions
 * is entirely missing (all dist-runtime entries are orphans).
 */
describe("prune-vendor-deps Phase 4f: orphan wrapper cleanup", () => {
  let vendorDir: string;

  beforeEach(() => {
    vendorDir = join(tmpdir(), `prune-4f-test-${process.pid}-${Date.now()}`);
    // Minimal vendor structure needed by prune-vendor-deps
    mkdirSync(join(vendorDir, "dist"), { recursive: true });
    mkdirSync(join(vendorDir, "node_modules", "typescript"), { recursive: true });
    // .pruned marker absent → prune will run (but we only test Phase 4f logic)
  });

  afterEach(() => {
    rmSync(vendorDir, { recursive: true, force: true });
  });

  /**
   * Extract and run only Phase 4f logic from prune-vendor-deps.cjs.
   * We inline the relevant code rather than running the full script
   * (which needs pnpm install, etc.).
   */
  function runPhase4f(): string[] {
    const distRuntimeExtDir = join(vendorDir, "dist-runtime", "extensions");
    const distExtDir = join(vendorDir, "dist", "extensions");
    const removed: string[] = [];
    if (existsSync(distRuntimeExtDir)) {
      const { readdirSync } = require("node:fs") as typeof import("node:fs");
      const runtimeEntries = readdirSync(distRuntimeExtDir, { withFileTypes: true });
      const distEntries = existsSync(distExtDir)
        ? new Set(
            readdirSync(distExtDir, { withFileTypes: true })
              .filter((e: { isDirectory: () => boolean }) => e.isDirectory())
              .map((e: { name: string }) => e.name),
          )
        : new Set<string>();
      for (const entry of runtimeEntries) {
        if (!entry.isDirectory()) continue;
        if (distEntries.has(entry.name)) continue;
        rmSync(join(distRuntimeExtDir, entry.name), { recursive: true, force: true });
        removed.push(entry.name);
      }
    }
    return removed;
  }

  it("removes orphan wrappers when dist/extensions exists but is a subset", () => {
    // dist-runtime has a, b, c; dist has only a
    mkdirSync(join(vendorDir, "dist-runtime", "extensions", "a"), { recursive: true });
    mkdirSync(join(vendorDir, "dist-runtime", "extensions", "b"), { recursive: true });
    mkdirSync(join(vendorDir, "dist-runtime", "extensions", "c"), { recursive: true });
    mkdirSync(join(vendorDir, "dist", "extensions", "a"), { recursive: true });

    const removed = runPhase4f();

    expect(removed.sort()).toEqual(["b", "c"]);
    expect(existsSync(join(vendorDir, "dist-runtime", "extensions", "a"))).toBe(true);
    expect(existsSync(join(vendorDir, "dist-runtime", "extensions", "b"))).toBe(false);
    expect(existsSync(join(vendorDir, "dist-runtime", "extensions", "c"))).toBe(false);
  });

  it("removes ALL orphan wrappers when dist/extensions is entirely missing", () => {
    // dist-runtime has entries but dist/extensions doesn't exist at all
    mkdirSync(join(vendorDir, "dist-runtime", "extensions", "modelstudio"), { recursive: true });
    writeFileSync(
      join(vendorDir, "dist-runtime", "extensions", "modelstudio", "index.js"),
      'export * from "../../../dist/extensions/modelstudio/index.js";',
    );
    mkdirSync(join(vendorDir, "dist-runtime", "extensions", "stale-plugin"), { recursive: true });
    // dist/extensions does NOT exist

    const removed = runPhase4f();

    expect(removed.sort()).toEqual(["modelstudio", "stale-plugin"]);
    expect(existsSync(join(vendorDir, "dist-runtime", "extensions", "modelstudio"))).toBe(false);
    expect(existsSync(join(vendorDir, "dist-runtime", "extensions", "stale-plugin"))).toBe(false);
  });

  it("does nothing when dist-runtime/extensions does not exist", () => {
    // No dist-runtime at all → nothing to clean
    const removed = runPhase4f();
    expect(removed).toEqual([]);
  });

  it("preserves entries that have a matching dist/extensions directory", () => {
    mkdirSync(join(vendorDir, "dist-runtime", "extensions", "telegram"), { recursive: true });
    mkdirSync(join(vendorDir, "dist", "extensions", "telegram"), { recursive: true });

    const removed = runPhase4f();

    expect(removed).toEqual([]);
    expect(existsSync(join(vendorDir, "dist-runtime", "extensions", "telegram"))).toBe(true);
  });
});
