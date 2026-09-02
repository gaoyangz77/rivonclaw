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
 *   8. table-contract        — Product tables use native semantics, TkTableFrame, and shared rows
 *   9. panel-contract        — Legacy card hooks use TkPanel
 *  10. radius-contract       — Radius scale stays compact; product CSS has no large raw radii
 *  11. tab-contract          — Tab-list interaction uses TkTabs
 *  12. modal-contract        — Modal backdrops use the shared Modal component
 *  13. state-contract        — Generic feedback states use design-system primitives
 *  14. shell-layout-contract — Page sections do not compress; sidebar overlays stay visible
 *  15. contrast-contract     — Shared secondary text meets the WCAG AA contrast floor
 *  16. overlay-boundary      — Product pages use shared overlay primitives
 *  17. switch-contract       — Product code uses the shared switch implementation
 *  18. css-ownership-contract — CSS manifests stay import-only and no monolith can regrow
 *  19. control-boundary       — Legacy focus bridges cannot override Design System controls
 *  20. scroll-axis-contract   — Horizontal navigation declares and suppresses vertical overflow
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

function relativeLuminance(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [value >> 16, (value >> 8) & 255, value & 255].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (left, right) => right - left,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}

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

function walkFilesByExtension(dir, extension, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFilesByExtension(full, extension, files);
    } else if (entry.name.endsWith(extension)) {
      files.push(full);
    }
  }
  return files;
}

function readCssGraph(entryPath, seen = new Set()) {
  const resolvedEntry = resolve(entryPath);
  if (seen.has(resolvedEntry)) return "";
  seen.add(resolvedEntry);

  const source = readFileSync(resolvedEntry, "utf-8");
  return source.replace(/^\s*@import\s+["']([^"']+)["'];\s*$/gm, (_statement, importPath) =>
    readCssGraph(resolve(dirname(resolvedEntry), importPath), seen),
  );
}

function isImportOnlyCssManifest(source) {
  return (
    source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*@import\s+["'][^"']+["'];\s*$/gm, "")
      .trim() === ""
  );
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

function countTablesOutsideFrames(content) {
  const tokens = content.matchAll(/<\/TkTableFrame\s*>|<TkTableFrame\b[^>]*>|<table\b/g);
  let frameDepth = 0;
  let outsideCount = 0;
  for (const match of tokens) {
    const token = match[0];
    if (token.startsWith("</")) {
      frameDepth = Math.max(0, frameDepth - 1);
    } else if (token.startsWith("<TkTableFrame")) {
      frameDepth += 1;
    } else if (frameDepth === 0) {
      outsideCount += 1;
    }
  }
  return outsideCount;
}

function pseudoTableClasses(content) {
  const violations = [];
  const openingTags = content.matchAll(
    /<([A-Za-z][\w.-]*)\b[^>]*\bclassName=(?:"([^"]*)"|\{`([^`]*)`\})[^>]*>/g,
  );
  for (const match of openingTags) {
    const tag = match[1];
    if (
      tag === "table" ||
      tag === "tr" ||
      tag === "TkTableFrame" ||
      tag === "TkInteractiveTableRow"
    ) {
      continue;
    }
    const classes = (match[2] ?? match[3] ?? "").split(/\s+/);
    for (const className of classes) {
      if (/(?:^|-)table$/.test(className) || /-table-(?:head|row)$/.test(className)) {
        violations.push(`${tag}.${className}`);
      }
    }
  }
  return violations;
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

// Header and body primitives whose own inset the design system owns outright.
const OWNED_INSET_PRIMITIVES =
  /\.tk-v1-(?:page-header|panel-header|section-header|modal-header|panel-body|section-body)\b/;

const fileCount = files.length;
const rawSurfacePattern =
  /<(?:div|section|article)\b[^>]*className=(?:"[^"]*\b(?:section-card|panel-card)\b[^"]*"|\{`[^`]*\b(?:section-card|panel-card)\b[^`]*`\})/g;
const rawBackdropPattern =
  /<(?:div|section)\b[^>]*className=(?:"[^"]*\bmodal-backdrop\b[^"]*"|\{`[^`]*\bmodal-backdrop\b[^`]*`\})/;

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

  if (filePath.endsWith(".tsx")) {
    const tableCount = content.match(/<table\b/g)?.length ?? 0;
    const frameCount = content.match(/<TkTableFrame\b/g)?.length ?? 0;
    if (tableCount !== frameCount) {
      violations.push(
        `FAIL [table-frame-contract] ${relPath} has ${tableCount} table(s) and ${frameCount} TkTableFrame(s).`,
      );
    }
    const unframedTableCount = countTablesOutsideFrames(content);
    if (unframedTableCount > 0) {
      violations.push(
        `FAIL [table-frame-contract] ${relPath} has ${unframedTableCount} table(s) outside TkTableFrame.`,
      );
    }

    const pseudoTables = pseudoTableClasses(content);
    if (pseudoTables.length > 0) {
      violations.push(
        `FAIL [table-semantic-contract] ${relPath} implements table UI with non-table markup (${pseudoTables.join(", ")}). Use native table elements inside TkTableFrame.`,
      );
    }

    const ariaTables = content.match(/<[^>]*\brole="table"[^>]*>/g) ?? [];
    const undocumentedAriaTables = ariaTables.filter(
      (tag) => !tag.includes('data-tk-table-exception="analytics-matrix"'),
    );
    if (undocumentedAriaTables.length > 0) {
      violations.push(
        `FAIL [table-semantic-contract] ${relPath} declares role="table" without the documented analytics-matrix exception. Use a native table inside TkTableFrame.`,
      );
    }

    if (relPath !== "components/design-system/Primitives.tsx") {
      const rawInteractiveRows = content.match(
        /<tr\b[^>]*(?:\btabIndex=|\bonClick=|\bonKeyDown=|\brole="button")/g,
      );
      if (rawInteractiveRows?.length) {
        violations.push(
          `FAIL [table-row-contract] ${relPath} hand-wires ${rawInteractiveRows.length} interactive table row(s). Use TkInteractiveTableRow.`,
        );
      }
    }

    rawSurfacePattern.lastIndex = 0;
    if (rawSurfacePattern.test(content)) {
      violations.push(`FAIL [panel-contract] ${relPath} uses a legacy card hook without TkPanel.`);
    }

    if (
      relPath !== "components/design-system/Primitives.tsx" &&
      content.includes('role="tablist"')
    ) {
      violations.push(
        `FAIL [tab-contract] ${relPath} declares custom tab-list markup. Use TkTabs.`,
      );
    }

    if (relPath !== "components/modals/Modal.tsx" && rawBackdropPattern.test(content)) {
      violations.push(
        `FAIL [modal-contract] ${relPath} declares a custom modal backdrop. Use Modal.`,
      );
    }

    if (relPath.startsWith("pages/") && /\bcreatePortal\s*\(/.test(content)) {
      violations.push(
        `FAIL [overlay-boundary] ${relPath} creates a portal. Use TkModal, TkTooltip, TkPopover, or TkMenu.`,
      );
    }

    const importsLowLevelModal = imports.some((imp) =>
      /(?:^|\/)components\/modals\/Modal\.js$|^\.\/Modal\.js$/.test(imp),
    );
    const lowLevelModalAllowed =
      relPath === "components/design-system/Overlays.tsx" ||
      relPath === "components/modals/Modal.test.tsx";
    if (importsLowLevelModal && !lowLevelModalAllowed) {
      violations.push(
        `FAIL [overlay-boundary] ${relPath} imports the low-level Modal. Use TkModal.`,
      );
    }

    if (/\b(?:toggle-switch|toggle-track|toggle-thumb|extras-toggle)\b/.test(content)) {
      violations.push(
        `FAIL [switch-contract] ${relPath} recreates switch markup. Use TkSwitch or TkSwitchControl.`,
      );
    }

    const forbiddenStateClasses = new Set([
      "error-alert",
      "warning-alert",
      "loading-state",
      "empty-state",
      "centered-muted",
      "modal-error-box",
      "modal-loading",
      "modal-empty-state",
    ]);
    for (const match of content.matchAll(/className="([^"]+)"/g)) {
      const legacyClasses = match[1].split(/\s+/).filter((name) => forbiddenStateClasses.has(name));
      if (legacyClasses.length > 0) {
        violations.push(
          `FAIL [state-contract] ${relPath} uses ${legacyClasses.join(", ")}. Use TkAlert, TkLoadingState, or TkEmptyState.`,
        );
      }
    }
  }
}

const designSystemCssPath = join(SRC_ROOT, "components", "design-system", "tk-v1.css");
if (existsSync(designSystemCssPath)) {
  const manifest = readFileSync(designSystemCssPath, "utf-8");
  const css = readCssGraph(designSystemCssPath);
  if (!isImportOnlyCssManifest(manifest)) {
    violations.push(
      "FAIL [css-ownership-contract] design-system/tk-v1.css must remain an import-only manifest.",
    );
  }
  const radiusValues = [...css.matchAll(/^\s*--tk-v1-radius-[\w-]+:\s*([^;]+);/gm)].map((match) =>
    match[1].trim(),
  );
  const expectedRadiusValues = ["2px", "4px", "6px", "8px", "12px", "999px"];
  if (JSON.stringify(radiusValues) !== JSON.stringify(expectedRadiusValues)) {
    violations.push(`FAIL [radius-contract] tk-v1.css radius scale is ${radiusValues.join(", ")}.`);
  }

  if (!/\.tk-v1-page\s*>\s*\*\s*\{[^}]*flex-shrink:\s*0;/s.test(css)) {
    violations.push(
      "FAIL [shell-layout-contract] TkPageFrame children may compress and overlap inside the scroll pane.",
    );
  }
  if (
    !/\[data-theme="dark"\]\s+\.main-content\s*\{[^}]*background-image:\s*var\(--tk-v1-canvas-optical\);/s.test(
      css,
    )
  ) {
    violations.push(
      "FAIL [shell-layout-contract] Dark mode can fall back to the legacy dotted canvas.",
    );
  }

  const lightMuted = css.match(/:root,[\s\S]*?--tk-v1-fg-muted:\s*(#[0-9a-f]{6});/i)?.[1];
  const darkMuted = css.match(
    /\[data-theme="dark"\][\s\S]*?--tk-v1-fg-muted:\s*(#[0-9a-f]{6});/i,
  )?.[1];
  if (!lightMuted || contrastRatio(lightMuted, "#f2f4f6") < 4.5) {
    violations.push(
      "FAIL [contrast-contract] Light muted text falls below the WCAG AA contrast floor.",
    );
  }
  if (!darkMuted || contrastRatio(darkMuted, "#171a1f") < 4.5) {
    violations.push(
      "FAIL [contrast-contract] Dark muted text falls below the WCAG AA contrast floor.",
    );
  }
}

const appStylesPath = join(SRC_ROOT, "styles.css");
if (existsSync(appStylesPath)) {
  const manifest = readFileSync(appStylesPath, "utf-8");
  const css = readCssGraph(appStylesPath);
  const lineCount = manifest.split("\n").length;
  if (lineCount > 64) {
    violations.push(
      `FAIL [css-ownership-contract] styles.css grew to ${lineCount} lines. It is an import manifest, not a stylesheet owner.`,
    );
  }
  if (!isImportOnlyCssManifest(manifest)) {
    violations.push(
      "FAIL [css-ownership-contract] styles.css must remain import-only; put declarations in their owning component or feature.",
    );
  }
  if (!/\.sidebar\s*\{[^}]*z-index:\s*var\(--tk-v1-z-shell/s.test(css)) {
    violations.push(
      "FAIL [shell-layout-contract] Sidebar must use the semantic shell layer below portal overlays.",
    );
  }
}

const layoutSourcePath = join(SRC_ROOT, "layout", "Layout.tsx");
if (existsSync(layoutSourcePath)) {
  const layoutSource = readFileSync(layoutSourcePath, "utf-8");
  if (!layoutSource.includes("<TkHierarchicalNav")) {
    violations.push(
      "FAIL [shell-layout-contract] Sidebar navigation must use the shared two-level navigation.",
    );
  }
  if (!layoutSource.includes("<PageErrorBoundary")) {
    violations.push(
      "FAIL [shell-layout-contract] A page render failure can erase the application shell.",
    );
  }
}

for (const filePath of walkFilesByExtension(SRC_ROOT, ".css")) {
  const content = readFileSync(filePath, "utf-8");
  const relPath = relative(SRC_ROOT, filePath).replace(/\\/g, "/");
  const lineCount = content.split("\n").length;
  if (lineCount > 4500) {
    violations.push(
      `FAIL [css-ownership-contract] ${relPath} has ${lineCount} lines. Split it by component or domain responsibility.`,
    );
  }
  const broadFocusBridge =
    /:is\(\s*input\s*,\s*select\s*,\s*textarea\s*,\s*summary\s*,\s*button\s*\)(?!:not\(\[class\*=["']tk-v1-["']\]\)):focus-visible/;
  if (broadFocusBridge.test(content)) {
    violations.push(
      `FAIL [control-boundary] ${relPath} has a broad focus bridge that can override tk-v1 controls. Exclude [class*="tk-v1-"].`,
    );
  }
  const navigationSelectorPattern = /(?:^|[-_.])(?:tabs?|nav|rail|strip)(?:[-_.\s:#]|$)/i;
  for (const match of content.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim();
    const declarations = match[2];
    if (!navigationSelectorPattern.test(selector)) continue;
    if (!/overflow-x:\s*(?:auto|scroll)\s*;/.test(declarations)) continue;
    if (/overflow-y:\s*(?:hidden|clip|auto|scroll)\s*;/.test(declarations)) continue;
    violations.push(
      `FAIL [scroll-axis-contract] ${relPath} lets horizontal navigation implicitly become a vertical scroller: ${selector}`,
    );
  }
  for (const match of content.matchAll(/border-radius:\s*(\d+)px/g)) {
    if (Number(match[1]) <= 8) continue;
    const line = content.slice(0, match.index).split("\n").length;
    violations.push(
      `FAIL [radius-contract] ${relPath}:${line} hard-codes a radius larger than 8px.`,
    );
  }
  // Rule 8: spacing-ownership — the design system owns header and body insets.
  // A page that hand-writes them is how the Ads page ended up with its section
  // titles flush against the card edge: the class had no padding of its own and
  // silently relied on a parent TkPanel that later passed padding="none".
  if (!relPath.startsWith("components/design-system/")) {
    // Blank comments but keep line numbers, so a "header" mentioned in prose
    // cannot be mistaken for a selector.
    const declarationSource = content.replace(/\/\*[\s\S]*?\*\//g, (block) =>
      block.replace(/[^\n]/g, " "),
    );
    for (const rule of declarationSource.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectorList = rule[1].trim();
      if (!selectorList || selectorList.startsWith("@")) continue;
      const declarations = rule[2];
      const line = declarationSource.slice(0, rule.index).split("\n").length;

      for (const selector of selectorList.split(",").map((part) => part.trim()).filter(Boolean)) {
        // Only the element the rule actually targets counts. A tk-v1 class used
        // as an ancestor scope, or a margin between siblings, is legitimate.
        const target = selector.split(/[\s>+~]+/).filter(Boolean).pop() ?? "";

        for (const declaration of declarations.matchAll(
          /(?:^|[\s;])(padding|margin)(?:-[\w-]+)?:\s*([^;]+)/g,
        )) {
          const [, property, value] = declaration;

          if (property === "padding" && OWNED_INSET_PRIMITIVES.test(target)) {
            violations.push(
              `FAIL [spacing-ownership] ${relPath}:${line} sets padding on ${target}. TkPageHeader/TkPanelHeader/TkModalHeader own their inset; do not restate it.`,
            );
          }

          if (!/-header\b/.test(target)) continue;
          if (/var\(--tk-v1-/.test(value)) continue;
          // Zero and negative values are hairline pulls, not spacing.
          const pixels = [...value.matchAll(/(-?\d*\.?\d+)px/g)].map((px) => Number(px[1]));
          if (pixels.some((px) => px > 0)) {
            violations.push(
              `FAIL [spacing-ownership] ${relPath}:${line} hard-codes header spacing on ${target} (${property}: ${value.trim()}). Use --tk-v1-space-* or a design-system header.`,
            );
          }
        }
      }
    }
  }
}

// Rule 6: route-registry-exists — routes.tsx must exist
const routesFile = join(SRC_ROOT, "routes.tsx");
if (!existsSync(routesFile)) {
  violations.push(`FAIL [route-registry-missing] apps/panel/src/routes.tsx does not exist.`);
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
      violations.push(`FAIL [route-registry-unused] ${label} does not import from routes.tsx.`);
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
  console.log(`\u2713 Panel architecture check passed (${fileCount} files scanned)`);
}
