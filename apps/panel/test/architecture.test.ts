/**
 * Architecture guardrail tests.
 *
 * These run the same checks as `scripts/check-panel-architecture.mjs`
 * inside vitest, so `pnpm test` catches violations even if an agent
 * skips `pnpm lint`.
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const SRC_ROOT = resolve(__dirname, "../src");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);

const SHARED_LAYERS = new Set([
  "api", "lib", "store", "components", "providers",
  "layout", "tutorial", "i18n", "hooks",
]);

const IMPORT_FROM_RE = /from\s+["']([^"']+)["']/g;
const SIDE_EFFECT_IMPORT_RE = /^\s*import\s+["']([^"']+)["']/gm;

function extOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot);
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (SOURCE_EXTENSIONS.has(extOf(entry.name))) files.push(full);
  }
  return files;
}

function extractImports(content: string): string[] {
  const imports: string[] = [];
  let match;
  IMPORT_FROM_RE.lastIndex = 0;
  while ((match = IMPORT_FROM_RE.exec(content)) !== null) imports.push(match[1]);
  SIDE_EFFECT_IMPORT_RE.lastIndex = 0;
  while ((match = SIDE_EFFECT_IMPORT_RE.exec(content)) !== null) imports.push(match[1]);
  return imports;
}

function getFeature(relPath: string): string | null {
  const m = relPath.match(/^pages\/([^/]+)\//);
  return m ? m[1] : null;
}

function resolveRelativeImport(filePath: string, importPath: string): string | null {
  if (!importPath.startsWith(".")) return null;
  const resolved = resolve(dirname(filePath), importPath);
  const rel = relative(SRC_ROOT, resolved);
  if (rel.startsWith("..")) return null;
  return rel.replace(/\\/g, "/");
}

// Scan all source files once
const allFiles = walk(SRC_ROOT);

describe("Panel architecture guardrails", () => {
  it("no page files directly under pages/ (must be in pages/<feature>/)", () => {
    const violations: string[] = [];
    for (const filePath of allFiles) {
      const relPath = relative(SRC_ROOT, filePath).replace(/\\/g, "/");
      if (/^pages\/[^/]+$/.test(relPath)) {
        violations.push(relPath);
      }
    }
    expect(violations, `Page files in pages/ root: ${violations.join(", ")}`).toEqual([]);
  });

  it("no cross-feature imports between pages/<A>/ and pages/<B>/", () => {
    const violations: string[] = [];
    for (const filePath of allFiles) {
      const relPath = relative(SRC_ROOT, filePath).replace(/\\/g, "/");
      const fileFeature = getFeature(relPath);
      if (!fileFeature) continue;
      const content = readFileSync(filePath, "utf-8");
      for (const imp of extractImports(content)) {
        const resolved = resolveRelativeImport(filePath, imp);
        if (!resolved) continue;
        const impFeature = getFeature(resolved);
        if (impFeature && impFeature !== fileFeature) {
          violations.push(`${relPath} → pages/${impFeature}/`);
        }
      }
    }
    expect(violations, `Cross-feature imports:\n${violations.join("\n")}`).toEqual([]);
  });

  it("shared layers (api, lib, store, components, ...) do not import from pages/", () => {
    const violations: string[] = [];
    for (const filePath of allFiles) {
      const relPath = relative(SRC_ROOT, filePath).replace(/\\/g, "/");
      const topDir = relPath.split("/")[0];
      if (!SHARED_LAYERS.has(topDir)) continue;
      const content = readFileSync(filePath, "utf-8");
      for (const imp of extractImports(content)) {
        const resolved = resolveRelativeImport(filePath, imp);
        if (!resolved) continue;
        if (resolved.startsWith("pages/") || resolved.startsWith("pages\\")) {
          violations.push(`${relPath} → ${resolved}`);
        }
      }
    }
    expect(violations, `Upward imports:\n${violations.join("\n")}`).toEqual([]);
  });

  it("App.tsx does not import directly from pages/", () => {
    const appPath = join(SRC_ROOT, "App.tsx");
    if (!existsSync(appPath)) return;
    const content = readFileSync(appPath, "utf-8");
    const pageImports = extractImports(content).filter(
      (imp) => imp.startsWith("./pages/") || imp.startsWith("../pages/"),
    );
    expect(pageImports, "App.tsx imports from pages/ directly").toEqual([]);
  });

  it("Layout.tsx does not declare NAV_ITEMS, NAV_ICONS, or AUTH_REQUIRED_PATHS", () => {
    const layoutPath = join(SRC_ROOT, "layout", "Layout.tsx");
    if (!existsSync(layoutPath)) return;
    const content = readFileSync(layoutPath, "utf-8");
    const forbidden = ["NAV_ITEMS", "NAV_ICONS", "AUTH_REQUIRED_PATHS"];
    const found = forbidden.filter((name) => new RegExp(`\\bconst\\s+${name}\\b`).test(content));
    expect(found, "Route metadata declared in Layout.tsx").toEqual([]);
  });

  it("routes.tsx exists", () => {
    expect(existsSync(join(SRC_ROOT, "routes.tsx"))).toBe(true);
  });

  it("App.tsx and Layout.tsx both import from routes", () => {
    const checks = [
      { file: join(SRC_ROOT, "App.tsx"), label: "App.tsx" },
      { file: join(SRC_ROOT, "layout", "Layout.tsx"), label: "Layout.tsx" },
    ];
    for (const { file, label } of checks) {
      if (!existsSync(file)) continue;
      const content = readFileSync(file, "utf-8");
      const imports = extractImports(content);
      const hasRoutes = imports.some((imp) => /routes/.test(imp));
      expect(hasRoutes, `${label} does not import from routes.tsx`).toBe(true);
    }
  });
});
