import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, dirname, join } from "node:path";

const SRC_ROOT = resolve(__dirname, "../../..");

/** Domain directories — not app/ and not infra/ */
const DOMAIN_DIRS = new Set([
  "auth", "settings", "providers", "channels", "cs-bridge", "browser-profiles",
  "mobile", "chat", "skills", "usage", "cloud", "deps", "doctor", "gateway",
  "updater", "stt", "telemetry", "tray", "i18n", "utils", "generated",
]);

/** Recursively find all .ts files under a directory. */
function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      results.push(...findTsFiles(full));
    } else if (entry.name.endsWith(".ts") && !entry.name.includes(".test.") && !entry.name.includes(".spec.")) {
      // Skip test files and __tests__ directories
      if (!full.includes("__tests__")) results.push(full);
    }
  }
  return results;
}

/** Extract relative import paths from a TypeScript file. */
function extractRelativeImports(filePath: string): string[] {
  const content = readFileSync(filePath, "utf-8");
  const imports: string[] = [];
  const regex = /(?:import|export)\s+(?:.*?\s+from\s+)?["'](\.[^"']+)["']/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    imports.push(match[1]!);
  }
  return imports;
}

/**
 * Shared singletons in app/ that domains are allowed to import.
 * These are cross-domain aggregation stores, refs, and shared types — not application-layer code.
 */
const APP_SHARED_PATHS = new Set([
  "app/store/desktop-store",
  "app/store/runtime-status-store",
  "app/storage-ref",
  "app/api-context",
]);

/** Resolve a relative import to a top-level directory category under src/. */
function resolveCategory(fromFile: string, importPath: string): { topDir: string; relPath: string } | null {
  const fromDir = dirname(fromFile);
  const resolved = resolve(fromDir, importPath.replace(/\.js$/, ".ts"));
  const rel = relative(SRC_ROOT, resolved);
  const topDir = rel.split("/")[0];
  if (!topDir || topDir.startsWith("..")) return null;
  return { topDir, relPath: rel.replace(/\.ts$/, "") };
}

describe("Layer boundary enforcement", () => {
  it("infra/ files do not import from app/ or domain directories", () => {
    const infraDir = join(SRC_ROOT, "infra");
    const infraFiles = findTsFiles(infraDir);
    const violations: string[] = [];

    for (const file of infraFiles) {
      const rel = relative(SRC_ROOT, file);
      for (const imp of extractRelativeImports(file)) {
        const target = resolveCategory(file, imp);
        if (target && (target.topDir === "app" || DOMAIN_DIRS.has(target.topDir))) {
          violations.push(`${rel} imports from ${target.topDir}/ (${imp})`);
        }
      }
    }

    expect(violations, `infra/ layer violations:\n  ${violations.join("\n  ")}`).toEqual([]);
  });

  it("domain files do not import from app/ (except shared singletons)", () => {
    const violations: string[] = [];

    for (const domain of DOMAIN_DIRS) {
      const domainDir = join(SRC_ROOT, domain);
      try { statSync(domainDir); } catch { continue; }

      const files = findTsFiles(domainDir);
      for (const file of files) {
        const rel = relative(SRC_ROOT, file);
        for (const imp of extractRelativeImports(file)) {
          const target = resolveCategory(file, imp);
          if (target && target.topDir === "app" && !APP_SHARED_PATHS.has(target.relPath)) {
            violations.push(`${rel} imports from app/ (${imp}) — only app/store/* and app/storage-ref are allowed`);
          }
        }
      }
    }

    expect(violations, `Domain → app/ violations:\n  ${violations.join("\n  ")}`).toEqual([]);
  });
});
