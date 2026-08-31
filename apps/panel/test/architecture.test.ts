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

function relativeLuminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [value >> 16, (value >> 8) & 255, value & 255].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(foreground: string, background: string): number {
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (left, right) => right - left,
  );
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

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
const allCssFiles = walkFilesByExtension(SRC_ROOT, ".css");

function walkFilesByExtension(dir: string, extension: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkFilesByExtension(full, extension, files);
    else if (entry.name.endsWith(extension)) files.push(full);
  }
  return files;
}

function readCssGraph(entryPath: string, seen = new Set<string>()): string {
  const resolvedEntry = resolve(entryPath);
  if (seen.has(resolvedEntry)) return "";
  seen.add(resolvedEntry);

  const source = readFileSync(resolvedEntry, "utf-8");
  return source.replace(
    /^\s*@import\s+["']([^"']+)["'];\s*$/gm,
    (_statement, importPath: string) =>
      readCssGraph(resolve(dirname(resolvedEntry), importPath), seen),
  );
}

function isImportOnlyCssManifest(source: string): boolean {
  return (
    source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*@import\s+["'][^"']+["'];\s*$/gm, "")
      .trim() === ""
  );
}

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

  it("uses styled confirmation components instead of native window.confirm", () => {
    const violations = allFiles
      .filter((filePath) => readFileSync(filePath, "utf-8").includes("window.confirm"))
      .map((filePath) => relative(SRC_ROOT, filePath).replace(/\\/g, "/"));

    expect(
      violations,
      `Native window.confirm calls bypass the shared styled dialog:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps migrated commerce page geometry in the design-system primitives", () => {
    const migratedPages = [
      ["account", "AccountPage.tsx"],
      ["billing", "BillingPage.tsx"],
      ["channels", "ChannelsPage.tsx"],
      ["crons", "CronsPage.tsx"],
      ["ecommerce", "AdsManagementPage.tsx"],
      ["ecommerce", "CustomerServiceEscalationsPage.tsx"],
      ["ecommerce", "CustomerServiceExperimentsPage.tsx"],
      ["ecommerce", "CustomerServicePerformancePage.tsx"],
      ["ecommerce", "EcommercePage.tsx"],
      ["ecommerce", "InventoryManagementPage.tsx"],
      ["ecommerce", "ShopAnalyticsPage.tsx"],
      ["extras", "ExtrasPage.tsx"],
      ["providers", "ProvidersPage.tsx"],
      ["settings", "SettingsPage.tsx"],
      ["skills", "SkillsPage.tsx"],
      ["stt", "SttPage.tsx"],
      ["tiktok-shops", "TikTokShopsPage.tsx"],
      ["usage", "KeyUsagePage.tsx"],
    ];

    const violations: string[] = [];
    for (const [feature, fileName] of migratedPages) {
      const content = readFileSync(join(SRC_ROOT, "pages", feature, fileName), "utf-8");
      if (!content.includes("<TkPageFrame") || !content.includes("<TkPageHeader")) {
        violations.push(`${feature}/${fileName}`);
      }
    }

    expect(
      violations,
      `Migrated pages bypass TkPageFrame or TkPageHeader:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("routes every product table through TkTableFrame", () => {
    const violations: string[] = [];

    for (const filePath of allFiles.filter((file) => file.endsWith(".tsx"))) {
      const content = readFileSync(filePath, "utf-8");
      const tableCount = content.match(/<table\b/g)?.length ?? 0;
      if (tableCount === 0) continue;

      const frameCount = content.match(/<TkTableFrame\b/g)?.length ?? 0;
      if (frameCount !== tableCount) {
        violations.push(
          `${relative(SRC_ROOT, filePath).replace(/\\/g, "/")}: ${tableCount} table(s), ${frameCount} frame(s)`,
        );
      }
    }

    expect(violations, `Tables bypassing TkTableFrame:\n${violations.join("\n")}`).toEqual([]);
  });

  it("routes legacy card surfaces through TkPanel", () => {
    const violations: string[] = [];
    const rawSurfacePattern =
      /<(?:div|section|article)\b[^>]*className=(?:"[^"]*\b(?:section-card|panel-card)\b[^"]*"|\{`[^`]*\b(?:section-card|panel-card)\b[^`]*`\})/g;

    for (const filePath of allFiles.filter((file) => file.endsWith(".tsx"))) {
      const content = readFileSync(filePath, "utf-8");
      if (!rawSurfacePattern.test(content)) continue;
      violations.push(relative(SRC_ROOT, filePath).replace(/\\/g, "/"));
      rawSurfacePattern.lastIndex = 0;
    }

    expect(
      violations,
      `Legacy surfaces bypassing TkPanel:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("routes tab-list interaction through TkTabs", () => {
    const primitivePath = join(SRC_ROOT, "components", "design-system", "Primitives.tsx");
    const violations = allFiles
      .filter((filePath) => filePath.endsWith(".tsx") && filePath !== primitivePath)
      .filter((filePath) => readFileSync(filePath, "utf-8").includes('role="tablist"'))
      .map((filePath) => relative(SRC_ROOT, filePath).replace(/\\/g, "/"));

    expect(
      violations,
      `Custom tab-list markup bypassing TkTabs:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("routes modal backdrops through the shared Modal component", () => {
    const modalPath = join(SRC_ROOT, "components", "modals", "Modal.tsx");
    const rawBackdropPattern =
      /<(?:div|section)\b[^>]*className=(?:"[^"]*\bmodal-backdrop\b[^"]*"|\{`[^`]*\bmodal-backdrop\b[^`]*`\})/;
    const violations = allFiles
      .filter((filePath) => filePath.endsWith(".tsx") && filePath !== modalPath)
      .filter((filePath) => rawBackdropPattern.test(readFileSync(filePath, "utf-8")))
      .map((filePath) => relative(SRC_ROOT, filePath).replace(/\\/g, "/"));

    expect(
      violations,
      `Custom modal backdrops bypassing Modal:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps product overlays behind design-system boundaries", () => {
    const violations: string[] = [];
    for (const filePath of allFiles.filter((file) => file.endsWith(".tsx"))) {
      const relPath = relative(SRC_ROOT, filePath).replace(/\\/g, "/");
      const content = readFileSync(filePath, "utf-8");
      const imports = extractImports(content);
      if (relPath.startsWith("pages/") && /\bcreatePortal\s*\(/.test(content)) {
        violations.push(`${relPath}: createPortal`);
      }
      const importsLowLevelModal = imports.some((imp) =>
        /(?:^|\/)components\/modals\/Modal\.js$|^\.\/Modal\.js$/.test(imp),
      );
      const allowed =
        relPath === "components/design-system/Overlays.tsx" ||
        relPath === "components/modals/Modal.test.tsx";
      if (importsLowLevelModal && !allowed) violations.push(`${relPath}: low-level Modal`);
    }
    expect(violations, `Overlay boundary violations:\n${violations.join("\n")}`).toEqual([]);
  });

  it("routes switch interaction through TkSwitch or TkSwitchControl", () => {
    const violations = allFiles
      .filter((filePath) => filePath.endsWith(".tsx"))
      .filter((filePath) =>
        /\b(?:toggle-switch|toggle-track|toggle-thumb|extras-toggle)\b/.test(
          readFileSync(filePath, "utf-8"),
        ),
      )
      .map((filePath) => relative(SRC_ROOT, filePath).replace(/\\/g, "/"));

    expect(violations, `Switches bypassing the design system:\n${violations.join("\n")}`).toEqual(
      [],
    );
  });

  it("routes generic feedback states through design-system primitives", () => {
    const forbidden = new Set([
      "error-alert",
      "warning-alert",
      "loading-state",
      "empty-state",
      "centered-muted",
      "modal-error-box",
      "modal-loading",
      "modal-empty-state",
    ]);
    const violations: string[] = [];

    for (const filePath of allFiles.filter((file) => file.endsWith(".tsx"))) {
      const content = readFileSync(filePath, "utf-8");
      for (const match of content.matchAll(/className="([^"]+)"/g)) {
        const legacyClasses = match[1].split(/\s+/).filter((name) => forbidden.has(name));
        if (legacyClasses.length > 0) {
          violations.push(
            `${relative(SRC_ROOT, filePath).replace(/\\/g, "/")}: ${legacyClasses.join(", ")}`,
          );
        }
      }
    }

    expect(
      violations,
      `Generic states bypassing TkAlert, TkLoadingState, or TkEmptyState:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps the design-system radius scale compact and semantic", () => {
    const css = readCssGraph(join(SRC_ROOT, "components", "design-system", "tk-v1.css"));
    const declaredRadiusValues = [
      ...css.matchAll(/^\s*--tk-v1-radius-[\w-]+:\s*([^;]+);/gm),
    ].map((match) => match[1].trim());

    expect(declaredRadiusValues).toEqual(["2px", "4px", "6px", "8px", "12px", "999px"]);
  });

  it("keeps shell overlays visible and page sections out of flex compression", () => {
    const designSystemCss = readCssGraph(
      join(SRC_ROOT, "components", "design-system", "tk-v1.css"),
    );
    const appCss = readCssGraph(join(SRC_ROOT, "styles.css"));
    const layoutSource = readFileSync(join(SRC_ROOT, "layout", "Layout.tsx"), "utf-8");

    expect(designSystemCss).toMatch(
      /\.tk-v1-page\s*>\s*\*\s*\{[^}]*flex-shrink:\s*0;/s,
    );
    expect(designSystemCss).toMatch(
      /\[data-theme="dark"\]\s+\.main-content\s*\{[^}]*background-image:\s*var\(--tk-v1-canvas-optical\);/s,
    );
    expect(appCss).toMatch(/\.sidebar\s*\{[^}]*z-index:\s*var\(--tk-v1-z-shell/s);
    expect(layoutSource).toContain("<TkHierarchicalNav");
    expect(layoutSource).toContain("<PageErrorBoundary");
  });

  it("keeps CSS manifests import-only and prevents new monoliths", () => {
    const appManifest = readFileSync(join(SRC_ROOT, "styles.css"), "utf-8");
    const designSystemManifest = readFileSync(
      join(SRC_ROOT, "components", "design-system", "tk-v1.css"),
      "utf-8",
    );

    expect(isImportOnlyCssManifest(appManifest)).toBe(true);
    expect(isImportOnlyCssManifest(designSystemManifest)).toBe(true);
    expect(appManifest.split("\n").length).toBeLessThanOrEqual(64);

    const oversized = allCssFiles
      .map((filePath) => ({
        path: relative(SRC_ROOT, filePath).replace(/\\/g, "/"),
        lines: readFileSync(filePath, "utf-8").split("\n").length,
      }))
      .filter(({ lines }) => lines > 4500);
    expect(oversized).toEqual([]);
  });

  it("prevents legacy focus bridges from overriding Design System controls", () => {
    const broadFocusBridge =
      /:is\(\s*input\s*,\s*select\s*,\s*textarea\s*,\s*summary\s*,\s*button\s*\)(?!:not\(\[class\*=["']tk-v1-["']\]\)):focus-visible/;
    const violations = allCssFiles
      .filter((filePath) => broadFocusBridge.test(readFileSync(filePath, "utf-8")))
      .map((filePath) => relative(SRC_ROOT, filePath).replace(/\\/g, "/"));

    expect(
      violations,
      `Legacy focus bridges can override tk-v1 controls:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps horizontal navigation from becoming an implicit vertical scroller", () => {
    const navigationSelectorPattern =
      /(?:^|[-_.])(?:tabs?|nav|rail|strip)(?:[-_.\s:#]|$)/i;
    const violations: string[] = [];

    for (const filePath of allCssFiles) {
      const content = readFileSync(filePath, "utf-8");
      for (const match of content.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selector = match[1]!.trim();
        const declarations = match[2]!;
        if (!navigationSelectorPattern.test(selector)) continue;
        if (!/overflow-x:\s*(?:auto|scroll)\s*;/.test(declarations)) continue;
        if (/overflow-y:\s*(?:hidden|clip|auto|scroll)\s*;/.test(declarations)) continue;
        violations.push(`${relative(SRC_ROOT, filePath).replace(/\\/g, "/")}: ${selector}`);
      }
    }

    expect(
      violations,
      `Horizontal navigation can gain a vertical scrollbar:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps shared muted text above the WCAG AA contrast floor", () => {
    const css = readCssGraph(join(SRC_ROOT, "components", "design-system", "tk-v1.css"));
    const lightMuted = css.match(/:root,[\s\S]*?--tk-v1-fg-muted:\s*(#[0-9a-f]{6});/i)?.[1];
    const darkMuted = css.match(
      /\[data-theme="dark"\][\s\S]*?--tk-v1-fg-muted:\s*(#[0-9a-f]{6});/i,
    )?.[1];

    expect(lightMuted).toBeTruthy();
    expect(darkMuted).toBeTruthy();
    expect(contrastRatio(lightMuted!, "#f2f4f6")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(darkMuted!, "#171a1f")).toBeGreaterThanOrEqual(4.5);
  });

  it("does not hard-code large radii in product styles", () => {
    const violations: string[] = [];

    for (const filePath of allCssFiles) {
      const content = readFileSync(filePath, "utf-8");
      for (const match of content.matchAll(/border-radius:\s*(\d+)px/g)) {
        if (Number(match[1]) <= 8) continue;
        const line = content.slice(0, match.index).split("\n").length;
        violations.push(`${relative(SRC_ROOT, filePath).replace(/\\/g, "/")}:${line}`);
      }
    }

    expect(
      violations,
      `Large hard-coded radii bypass Design System v1 tokens:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
