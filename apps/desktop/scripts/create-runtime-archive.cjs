// @ts-check
// Creates a runtime archive (.tar.gz) from vendor/openclaw for inclusion in the
// Electron installer. All transformations happen on a temporary staging copy —
// the canonical vendor/openclaw directory is NEVER modified.
//
// Pipeline:
//   0. Create staging directory (copy vendor/openclaw, dereference symlinks, skip .git)
//   1. Extract static assets (model catalog, Codex OAuth helper) — staging
//   2. Pre-bundle vendor extensions (CJS, plugin-sdk inlined where small) — staging
//   3. Bundle plugin-sdk into single CJS file — staging
//   4. Bundle entry.js with esbuild (ESM code-split) — staging
//   5. Replace dist/ with bundled output, apply runtime patches — staging
//   6. Prune node_modules (EXTRA_REMOVE + keepSet + strip) — staging
//   7. Smoke-test the bundled gateway — staging
//   8. Generate V8 compile cache — staging
//   9. Create tar.gz archive + runtime-manifest.json — staging -> output
//  10. Clean up staging directory
//
// esbuild bundling is still necessary because:
// - vendor/openclaw/dist/ has 100+ ESM source files; bundling reduces to ~10 chunks for faster startup
// - Code splitting via esbuild removes dead code and tree-shakes unused exports
// - The health interval patch can only be applied during the esbuild load phase
// - plugin-sdk must be bundled to CJS for extension compatibility
// - All bundling now operates on the staging copy, so vendor/ stays clean
//
// Produces:
//   apps/desktop/runtime-archive/openclaw-runtime.tar.gz
//   apps/desktop/runtime-archive/runtime-manifest.json

const { execSync, execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { writeManifest, MANIFEST_FILENAME } = require("./runtime-manifest.cjs");
const {
  ALWAYS_EXTERNAL_PACKAGES,
  RUNTIME_REQUIRED_PACKAGES,
  matchesPackagePattern,
} = require("../../../scripts/vendor-runtime-packages.cjs");

// ─── Paths (read-only source) ───

const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const vendorDir = path.join(ROOT_DIR, "vendor", "openclaw");
const desktopDir = path.resolve(__dirname, "..");
const extStagingDir = path.join(desktopDir, ".prebundled-extensions");

const ARCHIVE_DIR = path.join(desktopDir, "runtime-archive");
const ARCHIVE_FILE = "openclaw-runtime.tar.gz";

// ─── Staging paths (set dynamically in createStagingDir) ───

/** @type {string} */ let stagingParent;
/** @type {string} */ let stagingDir;
/** @type {string} */ let distDir;
/** @type {string} */ let nmDir;
/** @type {string} */ let extensionsDir;
/** @type {string} */ let ENTRY_FILE;
/** @type {string} */ let BUNDLE_TEMP_DIR;
/** @type {string} */ let VENDOR_MODELS_JSON;
/** @type {string} */ let VENDOR_CODEX_OAUTH_JS;
/** @type {string} */ let VENDOR_CODEX_PKCE_JS;

const KEEP_DIST_FILES = new Set([
  "entry.js",
  "babel.cjs",
  ".bundled",
  "vendor-codex-oauth.js",
  "vendor-codex-pkce.js",
  "vendor-models.json",
  "warning-filter.js",
  "warning-filter.mjs",
]);

const KEEP_DIST_DIRS = new Set([
  "bundled",
  "canvas-host",
  "cli",
  "control-ui",
  "export-html",
  "plugin-sdk",
]);

// ─── Vendor workspace packages (cause circular symlinks/junctions) ───
// These are pnpm workspace packages inside vendor/openclaw. They create
// node_modules links that point back into the vendor root, causing infinite
// recursion when dereferencing during staging copy.
const VENDOR_WORKSPACE_PKGS = new Set(["openclaw", "clawdbot", "moltbot", "openclaw-control-ui"]);

// ─── Prune config ───

const EXTRA_REMOVE = [
  "vite", "esbuild", "@esbuild", "rollup", "@rollup", "@rolldown",
  "lightningcss", "lightningcss-darwin-arm64", "lightningcss-darwin-x64",
  "lightningcss-linux-x64-gnu", "lightningcss-win32-x64-msvc",
  "typescript", "node-llama-cpp", "@node-llama-cpp", "tsx",
  "lit", "lit-html", "lit-element", "@lit", "@lit-labs",
];

const STRIP_FILES = new Set([
  "README.md", "README", "readme.md", "CHANGELOG.md", "CHANGELOG",
  "changelog.md", "HISTORY.md", "CHANGES.md", "LICENSE", "LICENSE.md",
  "license", "LICENSE.txt", "LICENSE-MIT", "LICENSE-MIT.txt", "AUTHORS",
  "CONTRIBUTORS", "SECURITY.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md",
  ".npmignore", ".eslintrc", ".eslintrc.json", ".eslintrc.js",
  ".prettierrc", ".prettierrc.json", ".editorconfig", "tsconfig.json",
  ".travis.yml", "Makefile", "Gruntfile.js", "Gulpfile.js",
  ".gitattributes", "appveyor.yml", ".babelrc", "jest.config.js",
  "karma.conf.js", ".jshintrc", ".nycrc", "tslint.json",
]);

const STRIP_DIRS = new Set([
  "test", "tests", "__tests__", "__test__", "testing",
  "docs", "documentation", "example", "examples", "demo", "demos",
  ".github", ".idea", ".vscode",
  "benchmark", "benchmarks", ".nyc_output", "coverage",
]);

const STRIP_EXTS = [".map", ".md", ".mdx", ".c", ".h", ".cc", ".cpp", ".gyp", ".gypi"];
const STRIP_DTS_RE = /\.d\.[mc]?ts$/;

// ─── Node builtins ───

const NODE_BUILTINS = new Set([
  "assert", "async_hooks", "buffer", "child_process", "cluster", "console",
  "constants", "crypto", "dgram", "diagnostics_channel", "dns", "domain",
  "events", "fs", "http", "http2", "https", "inspector", "module", "net",
  "os", "path", "perf_hooks", "process", "punycode", "querystring",
  "readline", "repl", "stream", "string_decoder", "sys", "timers", "tls",
  "trace_events", "tty", "url", "util", "v8", "vm", "wasi", "worker_threads",
  "zlib",
]);

function isNodeBuiltin(/** @type {string} */ name) {
  return name.startsWith("node:") || NODE_BUILTINS.has(name);
}

// ─── Utility helpers ───

function dirSize(/** @type {string} */ dir) {
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        total += dirSize(full);
      } else {
        total += fs.statSync(full).size;
      }
    }
  } catch {}
  return total;
}

function countFiles(/** @type {string} */ dir) {
  let count = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) count++;
      else if (entry.isDirectory()) count += countFiles(full);
      else count++;
    }
  } catch {}
  return count;
}

/** @param {number} bytes */
function fmtSize(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${(bytes / 1024).toFixed(1)}KB`;
}

function log(/** @type {string} */ msg) {
  console.log(`[create-runtime-archive] ${msg}`);
}

function warn(/** @type {string} */ msg) {
  console.warn(`[create-runtime-archive] WARNING: ${msg}`);
}

/** Resolve esbuild from apps/desktop devDependencies. */
function loadEsbuild() {
  try {
    return require(require.resolve("esbuild", { paths: [desktopDir] }));
  } catch {
    console.error(
      "[create-runtime-archive] esbuild not found. Ensure it is listed in " +
        "apps/desktop/package.json devDependencies and `pnpm install` has been run.",
    );
    process.exit(1);
  }
}

// ─── Phase 0: Create staging directory ───

function createStagingDir() {
  log("Creating staging directory...");

  // Validate vendor is in a usable state (not previously pruned)
  const vendorNmDir = path.join(vendorDir, "node_modules");
  if (!fs.existsSync(vendorNmDir)) {
    console.error(
      "[create-runtime-archive] vendor/openclaw/node_modules not found. " +
        "Run setup-vendor.sh first.",
    );
    process.exit(1);
  }
  const typescriptDir = path.join(vendorNmDir, "typescript");
  const keepSetPath = path.join(vendorNmDir, ".bundle-keepset.json");
  if (!fs.existsSync(typescriptDir) || fs.existsSync(keepSetPath)) {
    console.error(
      "[create-runtime-archive] vendor/openclaw appears to be pruned. " +
        "Run setup-vendor.sh to restore full dependencies before building.",
    );
    process.exit(1);
  }

  // Fail if vendor SOURCE files have been modified. setup-vendor.sh legitimately
  // modifies .npmrc, .gitignore, and creates node_modules/dist/ — those are fine.
  // We only block on src/ or extension source changes that would leak into the archive.
  try {
    const gitDiff = execSync("git diff --name-only -- src/ extensions/", {
      cwd: vendorDir,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10_000,
    }).trim();
    if (gitDiff) {
      const lines = gitDiff.split("\n").filter(Boolean);
      console.error(
        `[create-runtime-archive] ERROR: vendor/openclaw has ${lines.length} modified source file(s):\n` +
          lines.slice(0, 15).map((l) => `  ${l}`).join("\n") +
          "\n\nVendor source modifications would leak into the archive." +
          "\nRun: cd vendor/openclaw && git checkout -- .",
      );
      process.exit(1);
    }
  } catch {
    // git not available or not a git repo — skip check
  }

  // Create temp directory
  stagingParent = fs.mkdtempSync(path.join(os.tmpdir(), "easyclaw-runtime-"));

  // Copy vendor/openclaw to staging, dereferencing symlinks.
  //
  // On macOS/Linux, pnpm uses symlinks; on Windows, pnpm uses directory junctions.
  // tar -h dereferences symlinks but NOT junctions, so Windows staging copies end
  // up with broken junction targets. Use Node.js fs.cpSync with dereference:true
  // which handles both symlinks and junctions correctly on all platforms.
  //
  // pnpm workspace packages (moltbot, clawdbot) have links like
  //   packages/moltbot/node_modules/openclaw -> ../../..
  // which point back to the vendor root, creating infinite recursion when
  // dereferencing. The filter function excludes these circular references.
  const vendorParent = path.dirname(vendorDir);
  const vendorBase = path.basename(vendorDir);
  const stagingTarget = path.join(stagingParent, vendorBase);
  fs.cpSync(vendorDir, stagingTarget, {
    recursive: true,
    dereference: true,
    filter: (src) => {
      const rel = path.relative(vendorDir, src);
      // Exclude .git directories
      if (rel === ".git" || rel.startsWith(".git" + path.sep)) return false;
      // Exclude .bin directories — they contain symlinks to CLI executables
      // which may be broken (targets not installed). Runtime doesn't need them.
      const base = path.basename(src);
      if (base === ".bin" && src.includes("node_modules")) return false;
      // Exclude any node_modules/openclaw or node_modules/clawdbot directories.
      // pnpm workspace packages create symlinks/junctions like:
      //   packages/moltbot/node_modules/openclaw -> ../../..
      //   node_modules/.pnpm/node_modules/openclaw -> (another .pnpm entry)
      //   node_modules/.pnpm/node_modules/clawdbot -> (workspace package)
      // These point back into the vendor root, causing infinite recursion
      // when dereferencing. We detect them by checking if any component in
      // the path is a node_modules/<workspace-pkg> pattern.
      const sep = /[\\/]/;
      const segments = rel.split(sep);
      for (let i = 0; i < segments.length - 1; i++) {
        if (segments[i] === "node_modules" && VENDOR_WORKSPACE_PKGS.has(segments[i + 1])) {
          return false;
        }
      }
      return true;
    },
  });

  // Set staging paths
  stagingDir = path.join(stagingParent, vendorBase);
  distDir = path.join(stagingDir, "dist");
  nmDir = path.join(stagingDir, "node_modules");
  extensionsDir = path.join(stagingDir, "extensions");
  ENTRY_FILE = path.join(distDir, "entry.js");
  BUNDLE_TEMP_DIR = path.join(distDir, "_bundled");
  VENDOR_MODELS_JSON = path.join(distDir, "vendor-models.json");
  VENDOR_CODEX_OAUTH_JS = path.join(distDir, "vendor-codex-oauth.js");
  VENDOR_CODEX_PKCE_JS = path.join(distDir, "vendor-codex-pkce.js");

  const stagingSize = dirSize(stagingDir);
  log(`Staging directory created: ${stagingDir} (${fmtSize(stagingSize)})`);

}

/**
 * Collect all .pnpm/[entry]/node_modules/ paths for use as esbuild nodePaths.
 * This lets esbuild resolve transitive deps that pnpm didn't hoist to the
 * top-level node_modules, WITHOUT copying files or mutating the staging dir.
 *
 * @returns {string[]} absolute paths to pass as esbuild `nodePaths`
 */
function collectPnpmNodePaths() {
  const pnpmDir = path.join(nmDir, ".pnpm");
  if (!fs.existsSync(pnpmDir)) return [];

  /** @type {string[]} */
  const paths = [];
  for (const entry of fs.readdirSync(pnpmDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const innerNm = path.join(pnpmDir, entry.name, "node_modules");
    if (fs.existsSync(innerNm)) paths.push(innerNm);
  }
  log(`Collected ${paths.length} pnpm node_modules paths for bundler resolution`);
  return paths;
}

/**
 * Verify all keepSet packages exist at the top-level node_modules.
 *
 * With the current pipeline (packages:"external" in esbuild + metafile-driven
 * keepSet), all keepSet packages should be ones that pnpm already hoisted to
 * the top level. If any are missing, that signals a dependency graph change
 * that needs investigation — we fail loud rather than silently hoisting a
 * potentially wrong version.
 *
 * @param {Set<string>} keepSet
 */
function verifyKeepSetTopLevel(keepSet) {
  const missing = [];
  for (const pkgName of keepSet) {
    if (!fs.existsSync(path.join(nmDir, pkgName))) {
      missing.push(pkgName);
    }
  }
  if (missing.length > 0) {
    console.error(`\n[create-runtime-archive] ${missing.length} keepSet package(s) missing from top-level node_modules:\n`);
    for (const pkg of missing.sort()) console.error(`  ${pkg}`);
    console.error(`\nThese packages are needed at runtime but pnpm did not hoist them.`);
    console.error(`This usually means a new vendor dependency introduced a non-hoisted transitive dep.`);
    console.error(`Fix: add the package to ALWAYS_EXTERNAL_PACKAGES in scripts/vendor-runtime-packages.cjs,`);
    console.error(`or investigate why the metafile reports it as a runtime external.\n`);
    process.exit(1);
  }
}

// ─── Phase 0.0: Extract vendor model catalog ───

async function extractVendorModelCatalog() {
  log("Extracting vendor model catalog...");

  const piAiModelsPath = path.join(nmDir, "@mariozechner", "pi-ai", "dist", "models.generated.js");
  if (!fs.existsSync(piAiModelsPath)) {
    log("models.generated.js not found, writing empty catalog.");
    fs.writeFileSync(VENDOR_MODELS_JSON, "{}\n", "utf-8");
    return;
  }

  const { pathToFileURL } = require("url");
  const mod = await import(pathToFileURL(piAiModelsPath).href);
  const allModels = mod.MODELS;

  if (!allModels || typeof allModels !== "object") {
    fs.writeFileSync(VENDOR_MODELS_JSON, "{}\n", "utf-8");
    return;
  }

  /** @type {Record<string, Array<{id: string, name: string}>>} */
  const catalog = {};
  let totalModels = 0;

  for (const [provider, modelMap] of Object.entries(allModels)) {
    if (!modelMap || typeof modelMap !== "object") continue;
    const entries = [];
    for (const model of Object.values(/** @type {Record<string, any>} */ (modelMap))) {
      const id = String(model?.id ?? "").trim();
      if (!id) continue;
      entries.push({ id, name: String(model?.name ?? id).trim() || id });
    }
    if (entries.length > 0) {
      catalog[provider] = entries;
      totalModels += entries.length;
    }
  }

  fs.writeFileSync(VENDOR_MODELS_JSON, JSON.stringify(catalog) + "\n", "utf-8");
  log(`Wrote vendor-models.json: ${Object.keys(catalog).length} providers, ${totalModels} models`);
}

// ─── Phase 0.1: Extract Codex OAuth helper ───

function extractVendorCodexOAuthHelper() {
  log("Extracting vendor Codex OAuth helper...");

  const oauthDir = path.join(nmDir, "@mariozechner", "pi-ai", "dist", "utils", "oauth");
  const sourceOauth = path.join(oauthDir, "openai-codex.js");
  const sourcePkce = path.join(oauthDir, "pkce.js");

  if (!fs.existsSync(sourceOauth) || !fs.existsSync(sourcePkce)) {
    throw new Error("Missing vendor Codex OAuth helper files.");
  }

  const oauthSource = fs.readFileSync(sourceOauth, "utf8");
  const pkceSource = fs.readFileSync(sourcePkce, "utf8");

  // Validate expected structure
  const relativeImports = [...oauthSource.matchAll(/^import\s+.*?from\s+["'](.+?)["'];?$/gmu)].map((m) => m[1]);
  if (relativeImports.length !== 1 || relativeImports[0] !== "./pkce.js") {
    throw new Error(`Unexpected Codex OAuth helper imports: ${relativeImports.join(", ") || "(none)"}`);
  }
  if (!oauthSource.includes("export async function loginOpenAICodex(")) {
    throw new Error("Vendor Codex OAuth helper no longer exports loginOpenAICodex.");
  }
  if ([...pkceSource.matchAll(/^import\s+.*?from\s+["'](.+?)["'];?$/gmu)].length > 0) {
    throw new Error("Vendor Codex PKCE helper gained imports.");
  }

  /** @param {string} text */
  const stripSourceMapComment = (text) => text.replace(/\n\/\/# sourceMappingURL=.*\n?$/u, "\n");

  fs.writeFileSync(VENDOR_CODEX_OAUTH_JS, stripSourceMapComment(oauthSource.replace("./pkce.js", "./vendor-codex-pkce.js")), "utf8");
  fs.writeFileSync(VENDOR_CODEX_PKCE_JS, stripSourceMapComment(pkceSource), "utf8");
  log("Wrote vendor-codex-oauth.js and vendor-codex-pkce.js");
}

// ─── Plugin-sdk helpers ───

function resolvePluginSdkSubpathFiles() {
  const pkg = JSON.parse(fs.readFileSync(path.join(stagingDir, "package.json"), "utf-8"));
  /** @type {string[]} */
  const files = [];
  for (const key of Object.keys(pkg.exports || {})) {
    if (!key.startsWith("./plugin-sdk/")) continue;
    const subpath = key.replace("./plugin-sdk/", "");
    if (subpath === "account-id") continue;
    files.push(subpath + ".js");
  }
  return files;
}

function resolvePluginSdkAliasAndExternals() {
  const pluginSdkDir = path.join(distDir, "plugin-sdk");
  /** @type {Record<string, string>} */
  const alias = {};
  /** @type {string[]} */
  const externals = [];
  for (const subFile of resolvePluginSdkSubpathFiles()) {
    const subpath = subFile.replace(".js", "");
    const importSpec = `openclaw/plugin-sdk/${subpath}`;
    alias[importSpec] = path.join(pluginSdkDir, subFile);
    externals.push(importSpec);
  }
  alias["openclaw/plugin-sdk/account-id"] = path.join(pluginSdkDir, "account-id.js");
  externals.push("openclaw/plugin-sdk/account-id");
  alias["openclaw/plugin-sdk"] = path.join(pluginSdkDir, "index.js");
  externals.push("openclaw/plugin-sdk");
  return { alias, externals };
}

// ─── Phase 0.5b: Pre-bundle vendor extensions ───

function prebundleExtensions() {
  log("Pre-bundling vendor extensions...");

  if (!fs.existsSync(extensionsDir)) {
    log("extensions/ not found, skipping.");
    return { externals: new Set(), inlinedCount: 0 };
  }

  if (fs.existsSync(extStagingDir)) {
    fs.rmSync(extStagingDir, { recursive: true, force: true });
  }
  fs.mkdirSync(extStagingDir, { recursive: true });

  const esbuild = loadEsbuild();
  const INLINE_SIZE_LIMIT = 2 * 1024 * 1024;

  const { alias: pluginSdkAlias, externals: pluginSdkExternals } = resolvePluginSdkAliasAndExternals();
  const pluginSdkDir = path.join(distDir, "plugin-sdk");
  const pluginSdkPkg = path.join(pluginSdkDir, "package.json");
  const hadPkgJson = fs.existsSync(pluginSdkPkg);
  fs.writeFileSync(pluginSdkPkg, JSON.stringify({ sideEffects: false }), "utf-8");

  // Find extensions with openclaw.plugin.json
  /** @type {Array<{name: string, dir: string}>} */
  const extDirs = [];
  for (const entry of fs.readdirSync(extensionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (fs.existsSync(path.join(extensionsDir, entry.name, "openclaw.plugin.json"))) {
      extDirs.push({ name: entry.name, dir: path.join(extensionsDir, entry.name) });
    }
  }

  let bundled = 0;
  let inlinedCount = 0;
  let skipped = 0;
  /** @type {Array<{name: string, error: string}>} */
  const errors = [];
  const allExtPkgs = new Set();

  /**
   * @param {string} entryPoint
   * @param {string} outfile
   * @param {{inline: boolean, extDir: string}} opts
   */
  function buildExtension(entryPoint, outfile, opts) {
    // Use packages:"external" to externalize all bare-specifier imports.
    // When inline:true, plugin-sdk is aliased to file paths (not bare specifiers)
    // so it gets inlined; everything else (npm deps) stays external.
    // When inline:false, plugin-sdk is also listed in external via pluginSdkExternals.
    return esbuild.buildSync({
      entryPoints: [entryPoint],
      outfile,
      bundle: true,
      format: "cjs",
      platform: "node",
      target: "node22",
      packages: "external",
      define: { "import.meta.url": "__import_meta_url" },
      banner: { js: 'var __import_meta_url = require("url").pathToFileURL(__filename).href;' },
      ...(opts.inline ? { alias: pluginSdkAlias } : {}),
      metafile: true,
      minify: true,
      logLevel: "warning",
    });
  }

  /** @param {string} extDir */
  function resolveExtensionEntryTs(extDir) {
    const pkgPath = path.join(extDir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        const entries = pkgJson?.openclaw?.extensions;
        if (Array.isArray(entries)) {
          for (const entry of entries) {
            if (typeof entry !== "string") continue;
            const candidate = path.resolve(extDir, entry.trim());
            if (candidate.startsWith(extDir) && fs.existsSync(candidate) && candidate.endsWith(".ts")) {
              return candidate;
            }
          }
        }
      } catch {}
    }
    const indexTs = path.join(extDir, "index.ts");
    return fs.existsSync(indexTs) ? indexTs : null;
  }

  for (const ext of extDirs) {
    const entryTs = resolveExtensionEntryTs(ext.dir);
    if (!entryTs) { skipped++; continue; }

    const stagingExtDir = path.join(extStagingDir, ext.name);
    fs.mkdirSync(stagingExtDir, { recursive: true });
    const indexJs = path.join(stagingExtDir, "index.js");

    try {
      let result = buildExtension(entryTs, indexJs, { inline: true, extDir: ext.dir });

      // If output exceeds threshold, rebuild with plugin-sdk external
      if (fs.statSync(indexJs).size > INLINE_SIZE_LIMIT) {
        result = buildExtension(entryTs, indexJs, { inline: false, extDir: ext.dir });
      } else {
        inlinedCount++;
      }

      // Collect external packages from metafile
      if (result.metafile) {
        for (const output of Object.values(result.metafile.outputs)) {
          for (const imp of /** @type {any} */ (output).imports || []) {
            if (imp.external) {
              const parts = imp.path.split("/");
              allExtPkgs.add(imp.path.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]);
            }
          }
        }
      }

      // Copy manifest
      fs.copyFileSync(path.join(ext.dir, "openclaw.plugin.json"), path.join(stagingExtDir, "openclaw.plugin.json"));

      // Write package.json (fix entry refs, remove "type": "module")
      const srcPkgPath = path.join(ext.dir, "package.json");
      if (fs.existsSync(srcPkgPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(srcPkgPath, "utf-8"));
        const raw = JSON.stringify(pkgJson);
        if (raw.includes("./index.ts")) Object.assign(pkgJson, JSON.parse(raw.replace(/\.\/index\.ts/g, "./index.js")));
        if (raw.includes("./plugin.ts")) Object.assign(pkgJson, JSON.parse(raw.replace(/\.\/plugin\.ts/g, "./index.js")));
        if (pkgJson.type === "module") delete pkgJson.type;
        fs.writeFileSync(path.join(stagingExtDir, "package.json"), JSON.stringify(pkgJson, null, 2) + "\n", "utf-8");
      }

      bundled++;
    } catch (err) {
      errors.push({ name: ext.name, error: /** @type {Error} */ (err).message });
    }
  }

  // Ensure staged dirs have package.json without "type": "module"
  for (const entry of fs.readdirSync(extStagingDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const stagingPkgPath = path.join(extStagingDir, entry.name, "package.json");
    if (!fs.existsSync(stagingPkgPath) && fs.existsSync(path.join(extStagingDir, entry.name, "index.js"))) {
      fs.writeFileSync(stagingPkgPath, "{}\n", "utf-8");
    }
  }

  // Clean up temp package.json
  if (!hadPkgJson) {
    try { fs.unlinkSync(pluginSdkPkg); } catch {}
  }

  log(`Pre-bundled ${bundled} extensions (${inlinedCount} with plugin-sdk inlined)` +
    (skipped > 0 ? ` (${skipped} skipped)` : ""));

  if (errors.length > 0) {
    console.error(`\n[create-runtime-archive] ${errors.length} extension(s) failed to bundle:\n`);
    for (const { name, error } of errors) {
      console.error(`  ${name}: ${error.substring(0, 200)}\n`);
    }
    process.exit(1);
  }

  return { externals: allExtPkgs, inlinedCount };
}

// ─── Phase 0.5a: Bundle plugin-sdk ───

function bundlePluginSdk() {
  log("Bundling plugin-sdk...");

  const pluginSdkDir = path.join(distDir, "plugin-sdk");
  const pluginSdkIndex = path.join(pluginSdkDir, "index.js");
  if (!fs.existsSync(pluginSdkIndex)) {
    log("dist/plugin-sdk/index.js not found, skipping.");
    return new Set();
  }

  const esbuild = loadEsbuild();

  // Use packages:"external" — all bare-specifier npm imports stay external.
  // The metafile accurately reports only the packages actually referenced.
  const allSdkPkgs = new Set();

  /** Collect external packages from metafile */
  function collectExternals(result) {
    if (!result?.metafile) return;
    for (const output of Object.values(result.metafile.outputs)) {
      for (const imp of /** @type {any} */ (output).imports || []) {
        if (imp.external) {
          const parts = imp.path.split("/");
          allSdkPkgs.add(imp.path.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]);
        }
      }
    }
  }

  /** @param {string} entryPoint @param {string} outfile */
  function bundleCjs(entryPoint, outfile) {
    const tmpOut = outfile + ".tmp.cjs";
    const result = esbuild.buildSync({
      entryPoints: [entryPoint],
      outfile: tmpOut,
      bundle: true,
      format: "cjs",
      platform: "node",
      target: "node22",
      packages: "external",
      define: { "import.meta.url": "__import_meta_url" },
      banner: { js: 'var __import_meta_url = require("url").pathToFileURL(__filename).href;' },
      metafile: true,
      minify: true,
      logLevel: "warning",
    });
    collectExternals(result);
    fs.unlinkSync(entryPoint);
    fs.renameSync(tmpOut, entryPoint);
  }

  // Bundle index.js
  const tmpOut = path.join(pluginSdkDir, "index.bundled.mjs");
  const indexResult = esbuild.buildSync({
    entryPoints: [pluginSdkIndex],
    outfile: tmpOut,
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node22",
    packages: "external",
    define: { "import.meta.url": "__import_meta_url" },
    banner: { js: 'var __import_meta_url = require("url").pathToFileURL(__filename).href;' },
    metafile: true,
    minify: true,
    logLevel: "warning",
  });
  collectExternals(indexResult);
  const bundleSize = fs.statSync(tmpOut).size;
  fs.unlinkSync(pluginSdkIndex);
  fs.renameSync(tmpOut, pluginSdkIndex);

  // Bundle account-id.js
  const accountIdPath = path.join(pluginSdkDir, "account-id.js");
  if (fs.existsSync(accountIdPath)) {
    bundleCjs(accountIdPath, accountIdPath);
  }

  // Bundle scoped subpath files
  const scopedSubpathFiles = resolvePluginSdkSubpathFiles();
  const keepFiles = new Set(["index.js", "account-id.js", "package.json"]);
  for (const subFile of scopedSubpathFiles) {
    keepFiles.add(subFile);
    const subPath = path.join(pluginSdkDir, subFile);
    if (fs.existsSync(subPath)) {
      bundleCjs(subPath, subPath);
    }
  }

  // Delete chunk files and subdirs
  let deleted = 0;
  for (const entry of fs.readdirSync(pluginSdkDir, { withFileTypes: true })) {
    if (keepFiles.has(entry.name)) continue;
    const fullPath = path.join(pluginSdkDir, entry.name);
    if (entry.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
    deleted++;
  }

  // Write CJS package.json
  fs.writeFileSync(path.join(pluginSdkDir, "package.json"), '{"type":"commonjs"}\n', "utf-8");

  log(`plugin-sdk bundled: ${fmtSize(bundleSize)}, deleted ${deleted} chunk files`);
  return allSdkPkgs;
}

// ─── Phase 1: esbuild bundle with code splitting ───

const VENDOR_HEALTH_HANDLER_MARKER = "background health refresh failed";

function createVendorHealthIntervalPatchPlugin() {
  return {
    name: "easyclaw-vendor-health-interval-patch",
    /** @param {any} build */
    setup(build) {
      let patchedFiles = 0;

      build.onLoad({ filter: /\.js$/ }, (/** @type {any} */ args) => {
        if (!args.path.startsWith(distDir)) return null;
        let contents = fs.readFileSync(args.path, "utf-8");
        if (!contents.includes(VENDOR_HEALTH_HANDLER_MARKER)) return null;

        const markerIndex = contents.indexOf(VENDOR_HEALTH_HANDLER_MARKER);
        const windowStart = Math.max(0, markerIndex - 800);
        const windowText = contents.slice(windowStart, markerIndex);
        const tsComparisons = [...windowText.matchAll(/\.ts<([^)\s{;&|,]+)/g)];

        if (tsComparisons.length === 0) return null;

        const lastMatch = tsComparisons[tsComparisons.length - 1];
        const token = lastMatch[1];
        if (token === "3e5" || token === "300000") return null;

        const tokenStart = windowStart + lastMatch.index + lastMatch[0].lastIndexOf(token);
        contents = contents.slice(0, tokenStart) + "3e5" + contents.slice(tokenStart + token.length);
        patchedFiles++;
        return { contents, loader: "js" };
      });

      build.onEnd((/** @type {any} */ result) => {
        if (result.errors.length > 0) return;
        if (patchedFiles > 0) {
          log(`Patched health cache interval: 60s -> 300s (${patchedFiles} file(s))`);
        }
      });
    },
  };
}

/**
 * Scan a package directory for native module indicators:
 * - .node files (compiled native addons)
 * - binding.gyp (node-gyp build file)
 * - prebuild-install in dependencies (prebuilt native binaries)
 * @param {string} pkgDir
 * @returns {boolean}
 */
function hasNativeIndicators(pkgDir) {
  // Check for binding.gyp at package root
  if (fs.existsSync(path.join(pkgDir, "binding.gyp"))) return true;

  // Check for prebuild-install dependency
  try {
    const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf-8"));
    const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
    if (allDeps["prebuild-install"] || allDeps["node-pre-gyp"] || allDeps["@mapbox/node-pre-gyp"] || allDeps["node-gyp-build"] || allDeps["cmake-js"]) {
      return true;
    }
    // Check install scripts that typically compile native code
    if (pkgJson.scripts?.install || pkgJson.scripts?.preinstall || pkgJson.scripts?.postinstall) {
      const scripts = [pkgJson.scripts.install, pkgJson.scripts.preinstall, pkgJson.scripts.postinstall].filter(Boolean).join(" ");
      if (/\b(node-gyp|prebuild-install|node-pre-gyp|cmake-js|napi)\b/.test(scripts)) return true;
    }
  } catch {}

  // Recursively scan for .node files (limit depth to avoid deep traversals)
  /** @param {string} dir @param {number} depth @returns {boolean} */
  const findNodeFile = (dir, depth) => {
    if (depth > 4) return false;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && entry.name.endsWith(".node")) return true;
        if (entry.isDirectory() && findNodeFile(fullPath, depth + 1)) return true;
      }
    } catch {}
    return false;
  };
  return findNodeFile(pkgDir, 0);
}

/**
 * Auto-detect external packages by scanning staging node_modules for native
 * modules, then merge with the minimal ALWAYS_EXTERNAL_PACKAGES list.
 *
 * Missing packages (not in node_modules) are always treated as external —
 * they are platform-specific optional deps that should never be bundled.
 *
 * Returns the effective externals list (patterns for esbuild).
 */
function detectExternalPackages() {
  const autoDetected = [];
  const alreadyCoveredByAlways = new Set();

  // Scan all top-level packages in node_modules for native indicators
  if (fs.existsSync(nmDir)) {
    for (const entry of fs.readdirSync(nmDir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      if (entry.name.startsWith("@")) {
        // Scoped packages
        const scopeDir = path.join(nmDir, entry.name);
        try {
          for (const scopeEntry of fs.readdirSync(scopeDir, { withFileTypes: true })) {
            const pkgName = `${entry.name}/${scopeEntry.name}`;
            const pkgDir = path.join(scopeDir, scopeEntry.name);
            if (scopeEntry.isDirectory() && hasNativeIndicators(pkgDir)) {
              // Check if already covered by ALWAYS_EXTERNAL_PACKAGES
              if (ALWAYS_EXTERNAL_PACKAGES.some((p) => matchesPackagePattern(pkgName, p))) {
                alreadyCoveredByAlways.add(pkgName);
              } else {
                autoDetected.push(pkgName);
              }
            }
          }
        } catch {}
      } else if (entry.isDirectory()) {
        const pkgDir = path.join(nmDir, entry.name);
        if (hasNativeIndicators(pkgDir)) {
          if (ALWAYS_EXTERNAL_PACKAGES.some((p) => matchesPackagePattern(entry.name, p))) {
            alreadyCoveredByAlways.add(entry.name);
          } else {
            autoDetected.push(entry.name);
          }
        }
      }
    }
  }

  // Merge: ALWAYS_EXTERNAL_PACKAGES + auto-detected native modules
  const effectiveExternals = [...ALWAYS_EXTERNAL_PACKAGES, ...autoDetected];

  // Filter out non-wildcard patterns that are missing from node_modules.
  // Missing packages are kept as external (never attempt to bundle them)
  // so esbuild emits a bare import that fails loudly at runtime if needed.
  const available = [];
  const missing = [];
  for (const pattern of effectiveExternals) {
    if (pattern.endsWith("/*") || pattern.endsWith("-*")) {
      available.push(pattern);
    } else {
      // Both present and missing packages stay external — missing ones are
      // platform-specific optional deps that should not be bundled.
      available.push(pattern);
      if (!fs.existsSync(path.join(nmDir, pattern))) {
        missing.push(pattern);
      }
    }
  }

  // Diagnostic logging
  if (autoDetected.length > 0) {
    log(`Auto-detected ${autoDetected.length} native module(s): ${autoDetected.join(", ")}`);
  }
  if (alreadyCoveredByAlways.size > 0) {
    log(`${alreadyCoveredByAlways.size} native module(s) already in ALWAYS_EXTERNAL_PACKAGES: ${[...alreadyCoveredByAlways].join(", ")}`);
  }
  if (missing.length > 0) {
    log(`${missing.length} external package(s) not in node_modules (platform-specific, kept external): ${missing.join(", ")}`);
  }
  log(`Effective externals: ${available.length} patterns (${ALWAYS_EXTERNAL_PACKAGES.length} always + ${autoDetected.length} auto-detected)`);

  return available;
}

async function bundleEntryJs() {
  log("Bundling dist/entry.js with code splitting...");

  const esbuild = loadEsbuild();

  if (fs.existsSync(BUNDLE_TEMP_DIR)) {
    fs.rmSync(BUNDLE_TEMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(BUNDLE_TEMP_DIR, { recursive: true });

  // Use nodePaths so esbuild can resolve transitive deps that pnpm didn't
  // hoist to the top level, without mutating the staging dir.
  const pnpmNodePaths = collectPnpmNodePaths();

  // Auto-detect native modules and merge with ALWAYS_EXTERNAL_PACKAGES.
  // Missing packages are kept external (platform-specific optional deps).
  const effectiveExternals = detectExternalPackages();

  const t0 = Date.now();
  const result = await esbuild.build({
    entryPoints: [ENTRY_FILE],
    bundle: true,
    outdir: BUNDLE_TEMP_DIR,
    splitting: true,
    chunkNames: "chunk-[hash]",
    format: "esm",
    platform: "node",
    target: "node22",
    external: effectiveExternals,
    nodePaths: pnpmNodePaths,
    logLevel: "warning",
    metafile: true,
    sourcemap: false,
    minify: true,
    plugins: [createVendorHealthIntervalPatchPlugin()],
    banner: {
      js: 'import { createRequire as __cr } from "module"; const require = __cr(import.meta.url);',
    },
  });

  const elapsed = Date.now() - t0;
  const outputFiles = fs.readdirSync(BUNDLE_TEMP_DIR);
  const entryOut = path.join(BUNDLE_TEMP_DIR, "entry.js");
  const entrySize = fs.existsSync(entryOut) ? fs.statSync(entryOut).size : 0;
  const chunkFiles = outputFiles.filter((f) => f !== "entry.js");
  let totalSize = entrySize;
  for (const f of chunkFiles) totalSize += fs.statSync(path.join(BUNDLE_TEMP_DIR, f)).size;

  log(`Bundle created in ${elapsed}ms: entry.js ${fmtSize(entrySize)} + ${chunkFiles.length} chunks = ${fmtSize(totalSize)} total`);

  // Collect external packages
  const usedExternals = new Set();
  if (result.metafile) {
    for (const output of Object.values(result.metafile.outputs)) {
      for (const imp of /** @type {any} */ (output).imports || []) {
        if (imp.external) {
          const parts = imp.path.split("/");
          usedExternals.add(imp.path.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]);
        }
      }
    }
  }
  return usedExternals;
}

// ─── Phase 2: Replace dist/ with bundle output ───

function replaceEntryWithBundle() {
  log("Replacing dist/ with split bundle...");

  // Delete old files, keep known-needed ones
  let deletedOld = 0;
  for (const entry of fs.readdirSync(distDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === "_bundled" || KEEP_DIST_DIRS.has(entry.name)) continue;
      fs.rmSync(path.join(distDir, entry.name), { recursive: true, force: true });
      deletedOld++;
    } else {
      if (KEEP_DIST_FILES.has(entry.name)) continue;
      try { fs.unlinkSync(path.join(distDir, entry.name)); deletedOld++; } catch {}
    }
  }

  // Move bundled files to dist/
  const bundledFiles = fs.readdirSync(BUNDLE_TEMP_DIR);
  for (const file of bundledFiles) {
    fs.renameSync(path.join(BUNDLE_TEMP_DIR, file), path.join(distDir, file));
  }
  fs.rmSync(BUNDLE_TEMP_DIR, { recursive: true, force: true });

  // Copy babel.cjs as safety net for jiti
  const babelSrc = [
    path.join(nmDir, "jiti", "dist", "babel.cjs"),
    path.join(nmDir, "@mariozechner", "jiti", "dist", "babel.cjs"),
  ].find((p) => fs.existsSync(p));
  if (babelSrc) {
    fs.copyFileSync(babelSrc, path.join(distDir, "babel.cjs"));
  }

  log(`Replaced dist/: removed ${deletedOld} old files, moved ${bundledFiles.length} bundled files`);
}

// ─── Phase 2.5: Patch isMainModule ───

function patchIsMainModule() {
  log("Patching isMainModule for code splitting...");

  const PAIRS_RE =
    /\[\{wrapperBasename:"openclaw\.mjs",entryBasename:"entry\.js"\},\{wrapperBasename:"openclaw\.js",entryBasename:"entry\.js"\}(?:,\{wrapperBasename:"(?:openclaw\.mjs|openclaw\.js|entry\.js)",entryBasename:"chunk-[A-Z0-9]+\.js"\})*\]/;

  const entryJs = fs.readFileSync(ENTRY_FILE, "utf-8");
  const entryChunkMatch = entryJs.match(/from"\.\/(chunk-[A-Z0-9]+\.js)"/);
  const entryChunkFile = entryChunkMatch?.[1] ?? null;

  if (!entryChunkFile) {
    warn("Could not resolve entry chunk from entry.js - isMainModule may fail at runtime");
    return;
  }

  const chunkFiles = fs.readdirSync(distDir).filter((f) => f.startsWith("chunk-") && f.endsWith(".js"));
  let patchedFile = null;

  for (const chunkFile of chunkFiles) {
    const chunkPath = path.join(distDir, chunkFile);
    const content = fs.readFileSync(chunkPath, "utf-8");
    if (!content.includes('wrapperBasename:"openclaw.mjs"')) continue;
    const matchedPairs = content.match(PAIRS_RE)?.[0];
    if (!matchedPairs) continue;

    const patchedPairs =
      '[{wrapperBasename:"openclaw.mjs",entryBasename:"entry.js"},' +
      '{wrapperBasename:"openclaw.js",entryBasename:"entry.js"},' +
      `{wrapperBasename:"openclaw.mjs",entryBasename:"${entryChunkFile}"},` +
      `{wrapperBasename:"openclaw.js",entryBasename:"${entryChunkFile}"},` +
      `{wrapperBasename:"entry.js",entryBasename:"${entryChunkFile}"}]`;

    fs.writeFileSync(chunkPath, content.replace(matchedPairs, patchedPairs), "utf-8");
    patchedFile = chunkFile;
    break;
  }

  if (patchedFile) {
    log(`Patched wrapperEntryPairs in ${patchedFile} for entry chunk ${entryChunkFile}`);
  } else {
    warn("Could not find wrapperEntryPairs in any chunk - isMainModule may fail at runtime");
  }
}

// ─── Phase 2.6: Plugin-sdk preload ───

function patchPluginSdkPreload() {
  log("Injecting plugin-sdk preload...");

  const content = fs.readFileSync(ENTRY_FILE, "utf-8");
  const preloadCode = [
    "// -- Plugin-SDK preload (bypass jiti) --",
    'var __sdkDir=require("path").join(require("url").fileURLToPath(import.meta.url),"..","plugin-sdk");',
    'var __sdkIndex=require("path").join(__sdkDir,"index.js");',
    "try{",
    "  require(__sdkIndex);",
    '  var __fs=require("fs"),__path=require("path");',
    "  var __subFiles=__fs.readdirSync(__sdkDir).filter(function(f){return f.endsWith('.js')&&f!=='index.js'});",
    "  __subFiles.forEach(function(f){try{require(__path.join(__sdkDir,f))}catch(e){}});",
    '}catch(e){process.stderr.write("[preload] plugin-sdk: "+e.message+"\\n")}',
  ].join("\n");

  const requireIdx = content.indexOf("const require");
  if (requireIdx === -1) {
    warn("Could not find 'const require' - plugin-sdk preload NOT injected");
    return;
  }
  const afterRequireLine = content.indexOf("\n", requireIdx);
  if (afterRequireLine === -1) {
    warn("No newline after 'const require' - plugin-sdk preload NOT injected");
    return;
  }

  fs.writeFileSync(
    ENTRY_FILE,
    content.slice(0, afterRequireLine + 1) + preloadCode + "\n" + content.slice(afterRequireLine + 1),
    "utf-8",
  );
  log("Plugin-sdk preload injected");
}

// ─── Phase 3: Prune node_modules (filesystem-level, no pnpm) ───

function pruneNodeModules() {
  log("Pruning node_modules (filesystem-level)...");

  const sizeBefore = dirSize(nmDir);
  const filesBefore = countFiles(nmDir);
  log(`Before prune: ${fmtSize(sizeBefore)}, ${filesBefore} files`);

  // Step 1: Remove EXTRA_REMOVE packages
  for (const pkg of EXTRA_REMOVE) {
    const pkgDir = path.join(nmDir, pkg);
    if (fs.existsSync(pkgDir)) {
      fs.rmSync(pkgDir, { recursive: true, force: true });
    }
  }

  // Step 2: Strip non-runtime files
  let strippedFiles = 0;
  let strippedBytes = 0;

  /** @param {string} dir @param {number} depth */
  function stripDir(dir, depth) {
    /** @type {import("fs").Dirent[]} */
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        if (depth <= 3 && STRIP_DIRS.has(entry.name)) {
          const size = dirSize(full);
          const count = countFiles(full);
          fs.rmSync(full, { recursive: true, force: true });
          strippedBytes += size;
          strippedFiles += count;
          continue;
        }
        stripDir(full, depth + 1);
      } else {
        if (STRIP_FILES.has(entry.name)) {
          strippedBytes += fs.statSync(full).size;
          fs.unlinkSync(full);
          strippedFiles++;
          continue;
        }
        const shouldStrip = STRIP_EXTS.some((ext) => entry.name.endsWith(ext)) || STRIP_DTS_RE.test(entry.name);
        if (shouldStrip) {
          try {
            strippedBytes += fs.statSync(full).size;
            fs.unlinkSync(full);
            strippedFiles++;
          } catch {}
        }
      }
    }
  }

  stripDir(nmDir, 0);

  const sizeAfter = dirSize(nmDir);
  const filesAfter = countFiles(nmDir);
  log(`After prune: ${fmtSize(sizeAfter)}, ${filesAfter} files (saved ${fmtSize(sizeBefore - sizeAfter)}, stripped ${strippedFiles} files)`);
}

// ─── Phase 4: Clean node_modules to keepSet ───

/**
 * Parse .pnpm dir name to extract package name.
 * @param {string} dirName
 */
function parsePnpmDirName(dirName) {
  if (dirName.startsWith("@")) {
    const plusIdx = dirName.indexOf("+");
    if (plusIdx === -1) return null;
    const afterPlus = dirName.substring(plusIdx + 1);
    const atIdx = afterPlus.indexOf("@");
    if (atIdx === -1) return null;
    return `${dirName.substring(0, plusIdx)}/${afterPlus.substring(0, atIdx)}`;
  }
  const atIdx = dirName.indexOf("@");
  if (atIdx <= 0) return dirName;
  return dirName.substring(0, atIdx);
}

/**
 * BFS from seed packages to find all transitive deps to keep.
 * Seeds are derived from actual bundle externals (usedExternals from esbuild
 * metafile) plus any extra seeds, NOT from a hardcoded list.
 * Packages are resolved from the top-level node_modules (which includes
 * hoisted pnpm deps from the staging setup phase).
 */
function buildKeepSet(extraSeeds = new Set()) {
  const keepSet = new Set();
  /** @type {string[]} */
  const queue = [];

  // Seed with packages that bundles actually use as runtime externals.
  // This is the key change: seeds come from esbuild metafile (actual imports)
  // rather than a hardcoded list. The caller passes usedExternals as extraSeeds.
  for (const pkg of extraSeeds) {
    queue.push(pkg);
  }

  // Also expand any wildcard patterns from ALWAYS_EXTERNAL_PACKAGES that
  // might match installed packages (these are runtime-loaded, not in metafile).
  for (const pattern of ALWAYS_EXTERNAL_PACKAGES) {
    if (pattern.endsWith("/*")) {
      const scope = pattern.slice(0, pattern.indexOf("/"));
      try { for (const entry of fs.readdirSync(path.join(nmDir, scope))) queue.push(`${scope}/${entry}`); } catch {}
    } else if (pattern.endsWith("-*")) {
      const prefix = pattern.slice(0, -1);
      const scope = prefix.startsWith("@") ? prefix.split("/")[0] : null;
      if (scope) {
        try { for (const entry of fs.readdirSync(path.join(nmDir, scope))) { if (`${scope}/${entry}`.startsWith(prefix)) queue.push(`${scope}/${entry}`); } } catch {}
      } else {
        try { for (const entry of fs.readdirSync(nmDir)) { if (entry.startsWith(prefix)) queue.push(entry); } } catch {}
      }
    }
    // Non-wildcard patterns: only add if they aren't already in extraSeeds
    // (they would be there if actually imported). Add them anyway as safety net
    // for runtime-loaded packages not visible in esbuild metafile.
    else {
      queue.push(pattern);
    }
  }

  while (queue.length > 0) {
    const pkgName = /** @type {string} */ (queue.shift());
    if (keepSet.has(pkgName) || isNodeBuiltin(pkgName) || pkgName.startsWith("@types/")) continue;
    const pkgJsonPath = path.join(nmDir, pkgName, "package.json");
    if (!fs.existsSync(pkgJsonPath)) continue;
    keepSet.add(pkgName);
    try {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
      for (const depMap of [pkgJson.dependencies, pkgJson.optionalDependencies]) {
        if (!depMap) continue;
        for (const dep of Object.keys(depMap)) {
          if (!keepSet.has(dep) && !isNodeBuiltin(dep) && !dep.startsWith("@types/")) queue.push(dep);
        }
      }
    } catch {}
  }
  return keepSet;
}

/** Resolve symlinks in node_modules to real directories. */
function resolveNodeModulesSymlinks() {
  let resolved = 0;
  /** @param {string} dir */
  const resolveInDir = (dir) => {
    /** @type {import("fs").Dirent[]} */
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        try {
          const realPath = fs.realpathSync(fullPath);
          if (fs.statSync(realPath).isDirectory()) {
            fs.unlinkSync(fullPath);
            fs.cpSync(realPath, fullPath, { recursive: true });
            resolved++;
          }
        } catch {}
      } else if (entry.isDirectory() && entry.name.startsWith("@")) {
        resolveInDir(fullPath);
      }
    }
  };
  resolveInDir(nmDir);
  if (resolved > 0) log(`Resolved ${resolved} symlinks to real directories`);
}

function cleanupNodeModules(usedExternals = new Set()) {
  log("Cleaning node_modules to external-packages keepSet...");

  if (!fs.existsSync(nmDir)) return new Set();

  resolveNodeModulesSymlinks();

  const filesBefore = countFiles(nmDir);
  const keepSet = buildKeepSet(usedExternals);
  log(`Packages to keep: ${keepSet.size}`);
  // Diagnostic: verify critical runtime packages are in keepSet
  for (const critical of ["@sinclair/typebox", "undici", "ws"]) {
    if (!keepSet.has(critical)) {
      log(`WARNING: ${critical} is NOT in keepSet but is expected at runtime`);
    }
  }

  // Clean top-level entries
  let removedTopLevel = 0;
  for (const entry of fs.readdirSync(nmDir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name.startsWith("@")) {
      const scopeDir = path.join(nmDir, entry.name);
      let scopeEntries;
      try { scopeEntries = fs.readdirSync(scopeDir, { withFileTypes: true }); } catch { continue; }
      for (const scopeEntry of scopeEntries) {
        if (!keepSet.has(`${entry.name}/${scopeEntry.name}`)) {
          fs.rmSync(path.join(scopeDir, scopeEntry.name), { recursive: true, force: true });
          removedTopLevel++;
        }
      }
      try { if (fs.readdirSync(scopeDir).length === 0) fs.rmdirSync(scopeDir); } catch {}
    } else {
      if (!keepSet.has(entry.name)) {
        fs.rmSync(path.join(nmDir, entry.name), { recursive: true, force: true });
        removedTopLevel++;
      }
    }
  }

  // Clean .pnpm/ entries
  const pnpmDir = path.join(nmDir, ".pnpm");
  let removedPnpm = 0;
  if (fs.existsSync(pnpmDir)) {
    for (const entry of fs.readdirSync(pnpmDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "node_modules") continue;
      const pkgName = parsePnpmDirName(entry.name);
      if (pkgName && !keepSet.has(pkgName)) {
        fs.rmSync(path.join(pnpmDir, entry.name), { recursive: true, force: true });
        removedPnpm++;
      }
    }
  }

  // Clean broken symlinks
  /** @param {string} dir */
  const cleanBrokenSymlinks = (dir) => {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        try {
          const lstat = fs.lstatSync(fullPath);
          if (lstat.isSymbolicLink()) {
            try { fs.statSync(fullPath); } catch { fs.unlinkSync(fullPath); }
          } else if (lstat.isDirectory() && entry.name.startsWith("@")) {
            cleanBrokenSymlinks(fullPath);
            try { if (fs.readdirSync(fullPath).length === 0) fs.rmdirSync(fullPath); } catch {}
          }
        } catch {}
      }
    } catch {}
  };
  cleanBrokenSymlinks(nmDir);

  // Remove .bin/
  const binDir = path.join(nmDir, ".bin");
  if (fs.existsSync(binDir)) fs.rmSync(binDir, { recursive: true, force: true });

  // Clean .pnpm/node_modules/ broken symlinks
  const pnpmNmDir = path.join(pnpmDir, "node_modules");
  if (fs.existsSync(pnpmNmDir)) cleanBrokenSymlinks(pnpmNmDir);

  const filesAfter = countFiles(nmDir);
  log(`node_modules: ${filesBefore} -> ${filesAfter} files (removed ${removedTopLevel} top-level, ${removedPnpm} .pnpm entries)`);

  return keepSet;
}

// ─── Phase 4.5: Verify external imports ───

function verifyExternalImports(/** @type {Set<string>} */ allExternals, /** @type {Set<string>} */ keepSet) {
  log("Verifying external imports...");

  const missing = [];
  let verified = 0;
  const packagesToVerify = new Set([...allExternals, ...RUNTIME_REQUIRED_PACKAGES]);

  for (const pkg of [...packagesToVerify].sort()) {
    if (isNodeBuiltin(pkg)) continue;
    if (!ALWAYS_EXTERNAL_PACKAGES.some((p) => matchesPackagePattern(pkg, p)) && !keepSet.has(pkg)) continue;
    if (!keepSet.has(pkg) || !fs.existsSync(path.join(nmDir, pkg))) continue; // never installed or not kept, expected
    verified++;
  }

  if (missing.length > 0) {
    console.error(`\n[create-runtime-archive] IMPORT VERIFICATION FAILED: ${missing.length} package(s) missing:\n`);
    for (const pkg of missing) console.error(`  ${pkg}`);
    process.exit(1);
  }
  log(`All ${verified} installed external imports verified.`);
}

// ─── Phase 5: Smoke test ───

function smokeTestGateway() {
  log("Smoke testing bundled gateway...");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "easyclaw-archive-smoke-"));
  const openclawMjs = path.join(stagingDir, "openclaw.mjs");

  const minimalConfig = {
    gateway: { port: 59999, mode: "local" },
    models: {},
    agents: { defaults: { skipBootstrap: true } },
  };
  fs.writeFileSync(path.join(tmpDir, "openclaw.json"), JSON.stringify(minimalConfig), "utf-8");

  let allOutput = "";
  let exitCode = null;
  let killed = false;

  try {
    const stdout = execFileSync(process.execPath, [openclawMjs, "gateway"], {
      cwd: tmpDir,
      timeout: 90_000,
      env: {
        ...process.env,
        OPENCLAW_CONFIG_PATH: path.join(tmpDir, "openclaw.json"),
        OPENCLAW_STATE_DIR: tmpDir,
        OPENCLAW_BUNDLED_PLUGINS_DIR: extensionsDir,
        NODE_COMPILE_CACHE: undefined,
      },
      stdio: ["ignore", "pipe", "pipe"],
      killSignal: "SIGTERM",
    });
    exitCode = 0;
    allOutput = (stdout || "").toString();
  } catch (err) {
    exitCode = /** @type {any} */ (err).status ?? null;
    killed = /** @type {any} */ (err).killed ?? false;
    allOutput = ((/** @type {any} */ (err).stdout || "").toString()) + "\n" + ((/** @type {any} */ (err).stderr || "").toString());
  }

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

  const gatewayStarted = allOutput.includes("[gateway]");

  if (gatewayStarted) {
    if (allOutput.includes("Cannot find module")) {
      const matches = allOutput.match(/Cannot find module '([^']+)'/g) || [];
      const modules = [...new Set(matches.map((m) => m.match(/Cannot find module '([^']+)'/)?.[1] || "?"))];
      console.error(`\n[create-runtime-archive] SMOKE TEST FAILED: ${modules.length} module(s) missing: ${modules.join(", ")}\n`);
      process.exit(1);
    }
    log("Smoke test passed: gateway started successfully.");
    return;
  }

  if (exitCode === 0 && !allOutput.trim()) {
    console.error("\n[create-runtime-archive] SMOKE TEST FAILED: Gateway exited with code 0 and no output (isMainModule check failed).\n");
    process.exit(1);
  }

  if (allOutput.includes("Dynamic require of")) {
    const match = allOutput.match(/Dynamic require of "([^"]+)" is not supported/);
    console.error(`\n[create-runtime-archive] SMOKE TEST FAILED: Dynamic require of "${match?.[1] || "unknown"}" not supported.\n`);
    process.exit(1);
  }

  if (allOutput.includes("Cannot find module")) {
    const match = allOutput.match(/Cannot find module '([^']+)'/);
    console.error(`\n[create-runtime-archive] SMOKE TEST FAILED: Cannot find module '${match?.[1] || "unknown"}'.\n`);
    process.exit(1);
  }

  const filtered = allOutput.split("\n")
    .filter((l) => !l.startsWith("(node:") && !l.startsWith("(Use `node --trace-warnings"))
    .join("\n").trim();

  if (killed) {
    console.error(`\n[create-runtime-archive] SMOKE TEST FAILED: Gateway timed out (90s).\n  Output: ${(filtered || "(empty)").substring(0, 3000)}\n`);
    process.exit(1);
  }

  console.error(`\n[create-runtime-archive] SMOKE TEST FAILED: Gateway exited with code ${exitCode}.\n  Output: ${(filtered || "(empty)").substring(0, 3000)}\n`);
  process.exit(1);
}

// ─── Phase 5.5: Generate V8 compile cache ───

function generateCompileCache() {
  log("Generating V8 compile cache...");

  let electronPath;
  try {
    electronPath = require("electron");
    if (typeof electronPath !== "string") {
      log("Electron binary path not a string, skipping compile cache.");
      return;
    }
  } catch {
    log("Electron binary not found, skipping compile cache generation.");
    return;
  }

  const cacheDir = path.join(distDir, "compile-cache");
  if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true, force: true });
  fs.mkdirSync(cacheDir, { recursive: true });

  const openclawMjs = path.join(stagingDir, "openclaw.mjs");
  const useRealGateway = fs.existsSync(openclawMjs);
  const startupTimerPath = path.resolve(ROOT_DIR, "packages", "gateway", "src", "startup-timer.cjs");
  const hasStartupTimer = fs.existsSync(startupTimerPath);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "easyclaw-compile-cache-"));
  const minimalConfig = {
    gateway: { port: 59998, mode: "local" },
    models: {},
    agents: { defaults: { skipBootstrap: true } },
  };
  fs.writeFileSync(path.join(tmpDir, "openclaw.json"), JSON.stringify(minimalConfig), "utf-8");

  const childEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_COMPILE_CACHE: cacheDir,
    OPENCLAW_CONFIG_PATH: path.join(tmpDir, "openclaw.json"),
    OPENCLAW_STATE_DIR: tmpDir,
    OPENCLAW_BUNDLED_PLUGINS_DIR: extensionsDir,
  };

  if (useRealGateway) {
    const warmupScript = path.join(__dirname, "compile-cache-warmup.cjs");
    const args = [warmupScript, electronPath, openclawMjs];
    if (hasStartupTimer) args.push("--startup-timer", startupTimerPath);
    try {
      execFileSync(process.execPath, args, {
        cwd: tmpDir,
        timeout: 65_000,
        env: childEnv,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      if (/** @type {any} */ (err).killed) {
        log("Compile cache warm-up timed out (cache may be incomplete).");
      }
    }
  } else {
    const warmUpScript = path.join(distDir, "_warmup.cjs");
    fs.writeFileSync(warmUpScript, [
      "'use strict';",
      "const { pathToFileURL } = require('url');",
      "const entryPath = process.argv[2];",
      "import(pathToFileURL(entryPath).href)",
      "  .then(() => setTimeout(() => process.exit(0), 1000))",
      "  .catch(() => setTimeout(() => process.exit(0), 1000));",
      "setTimeout(() => process.exit(0), 25000);",
    ].join("\n"), "utf-8");
    try {
      execFileSync(electronPath, [warmUpScript, ENTRY_FILE], {
        cwd: tmpDir, timeout: 30_000, env: childEnv,
        stdio: ["ignore", "pipe", "pipe"], killSignal: "SIGTERM",
      });
    } catch {}
    fs.unlinkSync(warmUpScript);
  }

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

  const cacheFiles = fs.existsSync(cacheDir)
    ? fs.readdirSync(cacheDir).filter((f) => !f.startsWith("."))
    : [];

  if (cacheFiles.length === 0) {
    log("No compile cache files generated. Skipping.");
    fs.rmSync(cacheDir, { recursive: true, force: true });
    return;
  }

  // Write version marker
  const hashStream = crypto.createHash("sha256");
  for (const f of fs.readdirSync(distDir).filter((f) => f.endsWith(".js")).sort()) {
    hashStream.update(fs.readFileSync(path.join(distDir, f)));
  }
  fs.writeFileSync(path.join(cacheDir, ".version"), hashStream.digest("hex").slice(0, 16), "utf-8");

  log(`Compile cache generated: ${cacheFiles.length} file(s), ${fmtSize(dirSize(cacheDir))}`);
}

// ─── Phase 6: Create archive ───

function createArchive() {
  log("Creating runtime archive...");

  // Ensure output dir exists
  if (fs.existsSync(ARCHIVE_DIR)) {
    fs.rmSync(ARCHIVE_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

  const archivePath = path.join(ARCHIVE_DIR, ARCHIVE_FILE);

  // Read vendor version from staging copy
  const vendorPkg = JSON.parse(fs.readFileSync(path.join(stagingDir, "package.json"), "utf-8"));
  const vendorVersion = vendorPkg.version || "unknown";

  // Write a runtime-manifest.json inside the staging dir so the hydrator can
  // verify after extraction (this is a preliminary copy; we update it with
  // the real SHA-256 after creating the archive).
  const manifestInsideStaging = path.join(stagingDir, MANIFEST_FILENAME);
  fs.writeFileSync(manifestInsideStaging, JSON.stringify({ version: vendorVersion, placeholder: true }) + "\n", "utf-8");

  // Pre-bundled extensions were already copied into staging/extensions/ before the smoke test.

  // Build tar exclusion list
  const excludes = [
    "--exclude=.git",
    "--exclude=.gitignore",
    "--exclude=.gitattributes",
    "--exclude=node_modules/.cache",
    "--exclude=node_modules/.package-lock.json",
    "--exclude=.turbo",
    "--exclude=.bundled",
    "--exclude=.bundle-keepset.json",
  ];

  // Create tar.gz archive from the staging directory.
  // Use -C to cd into the staging parent so the archive root is "openclaw/"
  // On Windows, convert backslashes to forward slashes for tar compatibility.
  const toSlash = (p) => p.replace(/\\/g, "/");
  const tarCmd = [
    "tar", "czf", toSlash(archivePath),
    ...excludes,
    "-C", toSlash(path.dirname(stagingDir)),
    path.basename(stagingDir),
  ].join(" ");

  const t0 = Date.now();
  try {
    execSync(tarCmd, { stdio: "inherit", timeout: 600_000 });
  } catch (err) {
    console.error("[create-runtime-archive] tar command failed:", /** @type {Error} */ (err).message);
    process.exit(1);
  }
  const elapsed = Date.now() - t0;

  // Compute SHA-256 of the archive
  const archiveBuffer = fs.readFileSync(archivePath);
  const sha256 = crypto.createHash("sha256").update(archiveBuffer).digest("hex");
  const archiveSize = archiveBuffer.length;

  // Write the real manifest alongside the archive
  /** @type {import("./runtime-manifest.cjs").RuntimeManifest} */
  const manifest = {
    version: vendorVersion,
    sha256,
    platform: process.platform,
    arch: process.arch,
    createdAt: new Date().toISOString(),
    archiveFile: ARCHIVE_FILE,
  };
  writeManifest(ARCHIVE_DIR, manifest);

  log(`Archive created in ${(elapsed / 1000).toFixed(1)}s: ${fmtSize(archiveSize)} (SHA-256: ${sha256.slice(0, 16)}...)`);
  log(`Output: ${archivePath}`);

  return manifest;
}

// ─── Main ───

(async () => {
  const t0 = Date.now();

  // Skip if runtime archive already exists (e.g. downloaded from CI artifact)
  const existingArchive = path.join(ARCHIVE_DIR, ARCHIVE_FILE);
  const existingManifest = path.join(ARCHIVE_DIR, MANIFEST_FILENAME);
  if (fs.existsSync(existingArchive) && fs.existsSync(existingManifest)) {
    console.log("[create-runtime-archive] Runtime archive already exists, skipping.");
    console.log(`  Archive: ${existingArchive}`);
    console.log(`  Manifest: ${existingManifest}`);
    process.exit(0);
  }

  // Guards — validate the read-only vendor directory
  if (!fs.existsSync(vendorDir)) {
    console.error("[create-runtime-archive] vendor/openclaw/ not found.");
    process.exit(1);
  }
  const vendorEntryFile = path.join(vendorDir, "dist", "entry.js");
  if (!fs.existsSync(vendorEntryFile)) {
    console.error("[create-runtime-archive] vendor/openclaw/dist/entry.js not found.");
    process.exit(1);
  }

  log("Starting runtime archive creation...");
  log(`Vendor dir (read-only): ${vendorDir}`);
  log(`Output dir: ${ARCHIVE_DIR}`);

  try {
    // Phase 0: Create staging copy of vendor
    createStagingDir();

    // Phase 0.0-0.1: Extract static assets (from staging)
    await extractVendorModelCatalog();
    extractVendorCodexOAuthHelper();

    // Phase 0.5b: Pre-bundle extensions (reads from staging, BEFORE plugin-sdk bundling)
    const { externals: extExternals, inlinedCount } = prebundleExtensions();

    // Phase 0.5a: Bundle plugin-sdk (in staging)
    const sdkExternals = bundlePluginSdk();

    // Phase 1: Bundle entry.js (in staging)
    const bundleExternals = await bundleEntryJs();

    // Phase 2: Replace dist/ with bundled output (in staging)
    replaceEntryWithBundle();

    // Phase 2.5-2.6: Runtime patches (in staging)
    patchIsMainModule();
    patchPluginSdkPreload();

    // Phase 3: Prune node_modules (filesystem-level, no pnpm needed)
    pruneNodeModules();

    // Phase 4: Clean node_modules to keepSet (in staging)
    const allExternals = new Set([...extExternals, ...(sdkExternals || []), ...bundleExternals]);
    const keepSet = cleanupNodeModules(allExternals);

    // Phase 4.1: Verify all keepSet packages are at the top level.
    // With packages:"external" + metafile-driven keepSet, all runtime packages
    // should be ones pnpm already hoisted. Fail loud if any are missing.
    verifyKeepSetTopLevel(keepSet);

    verifyExternalImports(allExternals, keepSet);

    // Copy pre-bundled extensions into staging BEFORE smoke test so they can
    // resolve packages from the staging node_modules via Node resolution.
    if (fs.existsSync(extStagingDir)) {
      for (const entry of fs.readdirSync(extStagingDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const src = path.join(extStagingDir, entry.name);
        const dst = path.join(extensionsDir, entry.name);
        fs.cpSync(src, dst, { recursive: true, force: true });
      }
      log("Copied pre-bundled extensions into staging for smoke test");
    }

    // Phase 5: Smoke test (using staging's openclaw.mjs)
    smokeTestGateway();

    // Phase 5.5: Compile cache (in staging)
    generateCompileCache();

    // Phase 6: Create the archive (from staging)
    const manifest = createArchive();

    const totalElapsed = ((Date.now() - t0) / 1000).toFixed(1);
    log(`Done in ${totalElapsed}s. Archive: ${ARCHIVE_FILE} (${fmtSize(fs.statSync(path.join(ARCHIVE_DIR, ARCHIVE_FILE)).size)}), version ${manifest.version}`);
  } finally {
    // Always clean up both staging directories, even on error
    if (stagingParent && fs.existsSync(stagingParent)) {
      log("Cleaning up staging directory...");
      try { fs.rmSync(stagingParent, { recursive: true, force: true }); } catch {}
    }
    if (fs.existsSync(extStagingDir)) {
      try { fs.rmSync(extStagingDir, { recursive: true, force: true }); } catch {}
    }
  }
})();
