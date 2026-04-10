#!/usr/bin/env node

/**
 * Panel Architecture Guard
 *
 * Enforces structural rules for the Panel app to maintain clean feature
 * isolation and dependency direction.
 *
 * Rules:
 *   1. no-root-page          — No page files directly under pages/
 *   2. no-cross-feature      — pages/<A>/ must not import from pages/<B>/
 *   3. no-upward-import      — Shared layers must not import from pages/
 *   4. no-direct-page-import — App.tsx must not import directly from pages/
 *   5. no-route-metadata-in-layout — Layout.tsx must not declare route metadata
 *   6. route-registry-exists — routes.tsx must exist
 *   7. route-registry-used   — App.tsx and Layout.tsx must import from routes
 *
 * Exit 0 = PASS
 * Exit 1 = FAIL
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC_ROOT = join(ROOT, "apps", "panel", "src");
const PAGES_DIR = join(SRC_ROOT, "pages");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);

const SHARED_LAYERS = new Set([
  "api",
  "lib",
  "store",
  "components",
  "providers",
  "layout",
  "tutorial",
  "i18n",
  "hooks",
]);

const IMPORT_FROM_RE = /from\s+["']([^"']+)["']/g;
const SIDE_EFFECT_IMPORT_RE = /^\s*import\s+["']([^"']+)["']/gm;

// ---------------------------------------------------------------------------
// Walk directories
// ---------------------------------------------------------------------------

function extOf(name) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot);
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (SOURCE_EXTENSIONS.has(extOf(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract all import paths: both `from "..."` and side-effect `import "..."`. */
function extractImports(content) {
  const imports = [];
  let match;
  IMPORT_FROM_RE.lastIndex = 0;
  while ((match = IMPORT_FROM_RE.exec(content)) !== null) {
    imports.push(match[1]);
  }
  SIDE_EFFECT_IMPORT_RE.lastIndex = 0;
  while ((match = SIDE_EFFECT_IMPORT_RE.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

/** Get the feature directory name for a path under pages/, or null. */
function getFeature(relPath) {
  const m = relPath.match(/^pages\/([^/]+)\//);
  return m ? m[1] : null;
}

/** Check if a relative-to-src path is under pages/. */
function isUnderPages(relPath) {
  return relPath.startsWith("pages/") || relPath.startsWith("pages\\");
}

/** Resolve a relative import and return path relative to SRC_ROOT, or null. */
function resolveRelativeImport(filePath, importPath) {
  if (!importPath.startsWith(".")) return null;
  const resolved = resolve(dirname(filePath), importPath);
  const rel = relative(SRC_ROOT, resolved);
  // Ignore imports that escape src/
  if (rel.startsWith("..")) return null;
  return rel.replace(/\\/g, "/");
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

const violations = [];

let files;
try {
  files = walk(SRC_ROOT);
} catch {
  console.error(`Could not scan ${SRC_ROOT}`);
  process.exit(1);
}

const fileCount = files.length;

for (const filePath of files) {
  const relPath = relative(SRC_ROOT, filePath).replace(/\\/g, "/");
  const content = readFileSync(filePath, "utf-8");
  const imports = extractImports(content);

  // Rule 1: no-root-page — no files directly under pages/
  if (/^pages\/[^/]+$/.test(relPath)) {
    const fileName = relPath.replace("pages/", "");
    violations.push(
      `FAIL [no-root-page] ${relPath} must live inside pages/<feature>/, not directly under pages/.`,
    );
  }

  // Rule 2: no-cross-feature — pages/<A>/ must not import from pages/<B>/
  const fileFeature = getFeature(relPath);
  if (fileFeature) {
    for (const imp of imports) {
      const resolved = resolveRelativeImport(filePath, imp);
      if (!resolved) continue;
      const impFeature = getFeature(resolved);
      if (impFeature && impFeature !== fileFeature) {
        violations.push(
          `FAIL [no-cross-feature] ${relPath} imports from pages/${impFeature}/. Move shared code to lib/ or api/.`,
        );
      }
    }
  }

  // Rule 3: no-upward-import — shared layers must not import from pages/
  const topDir = relPath.split("/")[0];
  if (SHARED_LAYERS.has(topDir)) {
    for (const imp of imports) {
      const resolved = resolveRelativeImport(filePath, imp);
      if (!resolved) continue;
      if (isUnderPages(resolved)) {
        violations.push(
          `FAIL [no-upward-import] ${relPath} imports from pages/. Move shared types to lib/.`,
        );
      }
    }
  }

  // Rule 4: no-direct-page-import — App.tsx must not import from pages/
  if (relPath === "App.tsx") {
    for (const imp of imports) {
      if (/^\.\/pages\//.test(imp) || /^\.\.\/pages\//.test(imp)) {
        violations.push(
          `FAIL [no-direct-page-import] App.tsx imports directly from pages/. Use routes.tsx instead.`,
        );
      }
    }
  }

  // Rule 5: no-route-metadata-in-layout — Layout.tsx must not declare route metadata
  if (relPath === "layout/Layout.tsx") {
    const metadataPatterns = [
      { re: /\bconst\s+NAV_ITEMS\b/, name: "NAV_ITEMS" },
      { re: /\bconst\s+NAV_ICONS\b/, name: "NAV_ICONS" },
      { re: /\bconst\s+AUTH_REQUIRED_PATHS\b/, name: "AUTH_REQUIRED_PATHS" },
    ];
    for (const { re, name } of metadataPatterns) {
      if (re.test(content)) {
        violations.push(
          `FAIL [no-route-metadata-in-layout] Layout.tsx declares ${name}. Route metadata belongs in routes.tsx.`,
        );
      }
    }
  }
}

// Rule 6: route-registry-exists — routes.tsx must exist
const routesFile = join(SRC_ROOT, "routes.tsx");
if (!existsSync(routesFile)) {
  violations.push(
    `FAIL [route-registry-missing] apps/panel/src/routes.tsx does not exist.`,
  );
}

// Rule 7: route-registry-used — App.tsx and Layout.tsx must import from routes
const checkRouteImports = [
  { rel: "App.tsx", label: "App.tsx" },
  { rel: "layout/Layout.tsx", label: "Layout.tsx" },
];
for (const { rel, label } of checkRouteImports) {
  const absPath = join(SRC_ROOT, rel);
  if (existsSync(absPath)) {
    const content = readFileSync(absPath, "utf-8");
    const imports = extractImports(content);
    const hasRoutesImport = imports.some((imp) => /routes/.test(imp));
    if (!hasRoutesImport) {
      violations.push(
        `FAIL [route-registry-unused] ${label} does not import from routes.tsx.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log("");

if (violations.length > 0) {
  console.log("Panel architecture check:\n");
  for (const v of violations) {
    console.log(`  ${v}`);
  }
  console.log("");
  console.log(
    `Result: FAIL — ${violations.length} violation${violations.length === 1 ? "" : "s"} found`,
  );
  process.exit(1);
} else {
  console.log(
    `\u2713 Panel architecture check passed (${fileCount} files scanned)`,
  );
}
