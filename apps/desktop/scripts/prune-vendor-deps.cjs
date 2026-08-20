// @ts-check
// Prunes vendor/openclaw before electron-builder packages the app.
//
// Keep this intentionally boring: no import-graph discovery and no dynamic
// runtime inference. OpenClaw uses plugins and dynamic imports, so the safest
// size win is a fixed blacklist of large packages we have explicitly decided
// not to ship, plus fixed non-runtime file patterns.

const { execSync } = require("child_process");
const fs = require("fs");
const { createRequire } = require("module");
const path = require("path");
const { withPnpmTargetArchitecture } = require("./pnpm-target-architecture.cjs");
const {
  DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS,
  STAGED_VENDOR_SOURCE_PLUGINS,
} = require("./vendor-runtime-plugin-inventory.cjs");

const vendorDir = process.env.VENDOR_DIR_OVERRIDE
  ? path.resolve(process.env.VENDOR_DIR_OVERRIDE)
  : path.resolve(__dirname, "..", "..", "..", "vendor", "openclaw");
const nmDir = path.join(vendorDir, "node_modules");
const PRUNE_PROFILE_VERSION = "cross-platform-mid-blacklist-2026-08-20.1";
const stageOfficialVendorPluginsScript = path.join(__dirname, "stage-official-vendor-plugins.cjs");
const DISABLED_VENDOR_EXTENSIONS = [
  "copilot",
  "copilot-proxy",
  "github-copilot",
  // These optional plugins are not exposed by RivonClaw Desktop. Their
  // workspace dependencies otherwise add local inference and sandbox runtimes
  // to every packaged app.
  "memory-lancedb",
  "mxc",
  "cua-computer",
];
const PRESERVED_DIST_RUNTIME_EXTENSIONS = new Set(
  STAGED_VENDOR_SOURCE_PLUGINS.map((plugin) => plugin.id),
);

function hasCompletedProductionInstall() {
  try {
    const modulesState = JSON.parse(fs.readFileSync(path.join(nmDir, ".modules.yaml"), "utf-8"));
    return (
      modulesState?.included?.dependencies === true &&
      modulesState?.included?.devDependencies === false
    );
  } catch {
    return false;
  }
}

const macRuntimeArch =
  process.env.RIVONCLAW_MAC_RUNTIME_ARCH === "arm64" ||
  process.env.RIVONCLAW_MAC_RUNTIME_ARCH === "x64"
    ? process.env.RIVONCLAW_MAC_RUNTIME_ARCH
    : process.platform === "darwin" && (process.arch === "arm64" || process.arch === "x64")
      ? process.arch
      : null;
const sqliteVecRuntimePlatform = process.platform === "win32" ? "windows" : process.platform;
const sqliteVecRuntimeArch = process.platform === "darwin" ? macRuntimeArch : process.arch;
const sqliteVecTargetPackage =
  ["darwin", "linux", "windows"].includes(sqliteVecRuntimePlatform) &&
  ["arm64", "x64"].includes(sqliteVecRuntimeArch ?? "")
    ? `sqlite-vec-${sqliteVecRuntimePlatform}-${sqliteVecRuntimeArch}`
    : null;
const needsCrossArchMacDependencies =
  process.platform === "darwin" &&
  sqliteVecRuntimeArch !== null &&
  sqliteVecRuntimeArch !== process.arch;

function withCrossArchMacDependencies(runInstall) {
  if (!needsCrossArchMacDependencies) return runInstall();

  const workspacePath = path.join(vendorDir, "pnpm-workspace.yaml");
  const requireFromVendor = createRequire(path.join(vendorDir, "package.json"));
  const YAML = requireFromVendor("yaml");
  const targetArch = sqliteVecRuntimeArch;
  if (targetArch !== "arm64" && targetArch !== "x64") return runInstall();

  console.log(
    `[prune-vendor-deps] Installing macOS dependencies for host ${process.arch} ` +
      `and target ${targetArch} ...`,
  );
  return withPnpmTargetArchitecture({
    workspacePath,
    targetArch,
    yaml: YAML,
    run: runInstall,
  });
}

// Package blacklist. Scope-only entries remove every package inside that scope.
const EXTRA_REMOVE = [
  // Agent/tool runtimes that RivonClaw does not invoke from packaged OpenClaw.
  "@agentclientprotocol/claude-agent-acp",
  "@anthropic-ai/claude-agent-sdk",
  "@openai/codex",
  "@tloncorp/tlon-skill",
  "@zed-industries/codex-acp",

  // RivonClaw does not expose OpenClaw's optional GitHub Copilot runtimes.
  "@github/copilot",
  "@github/copilot-sdk",

  // Dependencies exclusive to disabled memory-lancedb and mxc plugins.
  "@huggingface/transformers",
  "@lancedb",
  "onnxruntime-common",
  "onnxruntime-node",
  "onnxruntime-web",
  "@microsoft/mxc-sdk",
  "node-pty",
  "@trycua",

  // Build/UI dependencies left behind by hoisted production installs.
  "@awesome.me",
  "@codemirror",
  "@lezer",
  "@openclaw/libterminal",
  "@typescript",
  "ghostty-web",
  "vite",
  "esbuild",
  "@esbuild",
  "rollup",
  "@rollup",
  "@rolldown",
  "lightningcss",
  "typescript",
  "tsx",
  "lit",
  "lit-html",
  "lit-element",
  "@lit",
  "@lit-labs",

  // Optional native feature packages not used by the desktop gateway runtime.
  "node-llama-cpp",
  "@node-llama-cpp",
  "@discordjs/opus",
  "@matrix-org/matrix-sdk-crypto-nodejs",
  "bare-fs",
  "bare-os",
  "bare-url",
  "fsevents",
  "koffi",
  "playwright",
  "sharp",
];

const EXTRA_REMOVE_PREFIXES = [
  "@anthropic-ai/claude-agent-sdk-",
  "@github/copilot-",
  "@img/sharp-",
  "@img/sharp-libvips-",
  "@lancedb/lancedb-",
  "@lydell/node-pty-",
  "@mariozechner/clipboard-",
  "@napi-rs/canvas-",
  "@openai/codex-",
  "@snazzah/davey-",
  "@tloncorp/tlon-skill-",
  "@zed-industries/codex-acp-",
  "lightningcss-",
];

const STRIP_FILES = new Set([
  "README.md",
  "README",
  "readme.md",
  "CHANGELOG.md",
  "CHANGELOG",
  "changelog.md",
  "HISTORY.md",
  "CHANGES.md",
  "LICENSE",
  "LICENSE.md",
  "license",
  "LICENSE.txt",
  "LICENSE-MIT",
  "LICENSE-MIT.txt",
  "AUTHORS",
  "CONTRIBUTORS",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  ".npmignore",
  ".eslintrc",
  ".eslintrc.json",
  ".eslintrc.js",
  ".prettierrc",
  ".prettierrc.json",
  ".editorconfig",
  "tsconfig.json",
  ".travis.yml",
  "Makefile",
  "Gruntfile.js",
  "Gulpfile.js",
  ".gitattributes",
  "appveyor.yml",
  ".babelrc",
  "jest.config.js",
  "karma.conf.js",
  ".jshintrc",
  ".nycrc",
  "tslint.json",
]);

const STRIP_DIRS = new Set([
  "test",
  "tests",
  "__tests__",
  "__test__",
  "testing",
  "docs",
  "documentation",
  "example",
  "examples",
  "demo",
  "demos",
  ".github",
  ".idea",
  ".vscode",
  "benchmark",
  "benchmarks",
  ".nyc_output",
  "coverage",
  ".bin",
]);

const STRIP_EXTS = [".map", ".md", ".mdx", ".c", ".h", ".cc", ".cpp", ".gyp", ".gypi"];
const STRIP_DTS_RE = /\.d\.[mc]?ts$/;

if (!fs.existsSync(nmDir)) {
  console.log("[prune-vendor-deps] vendor/openclaw/node_modules not found, skipping.");
  process.exit(0);
}

function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      total += dirSize(full);
    } else {
      total += fs.statSync(full).size;
    }
  }
  return total;
}

function fileCount(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      count += fileCount(full);
    } else {
      count++;
    }
  }
  return count;
}

function packageDirsForExactOrScope(pkg) {
  if (pkg.startsWith("@") && !pkg.includes("/")) {
    const scopeDir = path.join(nmDir, pkg);
    if (!fs.existsSync(scopeDir)) return [];
    return fs
      .readdirSync(scopeDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(scopeDir, entry.name));
  }

  const pkgDir = path.join(nmDir, pkg);
  return fs.existsSync(pkgDir) ? [pkgDir] : [];
}

function packageDirsForPrefix(prefix) {
  const normalizedPrefix = prefix.replace(/\\/g, "/");
  const matches = [];

  if (normalizedPrefix.startsWith("@")) {
    const slashIndex = normalizedPrefix.indexOf("/");
    if (slashIndex === -1) return matches;

    const scope = normalizedPrefix.slice(0, slashIndex);
    const packagePrefix = normalizedPrefix.slice(slashIndex + 1);
    const scopeDir = path.join(nmDir, scope);
    if (!fs.existsSync(scopeDir)) return matches;

    for (const entry of fs.readdirSync(scopeDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith(packagePrefix)) {
        matches.push(path.join(scopeDir, entry.name));
      }
    }
    return matches;
  }

  for (const entry of fs.readdirSync(nmDir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith(normalizedPrefix)) {
      matches.push(path.join(nmDir, entry.name));
    }
  }
  return matches;
}

function packageLabel(pkgDir) {
  return path.relative(nmDir, pkgDir).replace(/\\/g, "/");
}

function removePackageDir(pkgDir) {
  if (!fs.existsSync(pkgDir)) return false;
  const size = dirSize(pkgDir);
  const label = packageLabel(pkgDir);
  fs.rmSync(pkgDir, { recursive: true, force: true });
  console.log(`  removed ${label} (${(size / 1024 / 1024).toFixed(1)}MB)`);
  return true;
}

function hasBlacklistedPackage() {
  for (const pkg of EXTRA_REMOVE) {
    if (packageDirsForExactOrScope(pkg).length > 0) return true;
  }
  for (const prefix of EXTRA_REMOVE_PREFIXES) {
    if (packageDirsForPrefix(prefix).length > 0) return true;
  }
  return false;
}

function disabledVendorExtensionDirs() {
  const matches = [];
  for (const root of ["extensions", "dist/extensions", "dist-runtime/extensions"]) {
    for (const extensionId of DISABLED_VENDOR_EXTENSIONS) {
      const extensionDir = path.join(vendorDir, root, extensionId);
      if (fs.existsSync(extensionDir)) matches.push(extensionDir);
    }
  }
  return matches;
}

function removeDisabledVendorExtensions() {
  for (const extensionDir of disabledVendorExtensionDirs()) {
    const size = dirSize(extensionDir);
    const label = path.relative(vendorDir, extensionDir).replace(/\\/g, "/");
    fs.rmSync(extensionDir, { recursive: true, force: true });
    console.log(`  removed disabled extension ${label} (${(size / 1024 / 1024).toFixed(1)}MB)`);
  }
}

function removeReplacedVendorExtensionSources() {
  for (const plugin of STAGED_VENDOR_SOURCE_PLUGINS) {
    const extensionDir = path.join(vendorDir, "extensions", plugin.id);
    if (!fs.existsSync(extensionDir)) continue;
    const size = dirSize(extensionDir);
    fs.rmSync(extensionDir, { recursive: true, force: true });
    console.log(
      `  removed source-only ${plugin.id} extension replaced by staged runtime ` +
        `(${(size / 1024 / 1024).toFixed(1)}MB)`,
    );
  }
}

function removeOtherSqliteVecPlatforms() {
  for (const pkgDir of packageDirsForPrefix("sqlite-vec-")) {
    if (packageLabel(pkgDir) === sqliteVecTargetPackage) continue;
    removePackageDir(pkgDir);
  }
}

function hasOtherSqliteVecPlatforms() {
  return packageDirsForPrefix("sqlite-vec-").some(
    (pkgDir) => packageLabel(pkgDir) !== sqliteVecTargetPackage,
  );
}

function hasRequiredOfficialVendorPlugins() {
  const requiredPaths = [
    ...DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS.map((pluginId) =>
      path.join(vendorDir, "dist-runtime", "extensions", pluginId, "openclaw.plugin.json"),
    ),
    ...STAGED_VENDOR_SOURCE_PLUGINS.map((plugin) =>
      path.join(vendorDir, "dist-runtime", "extensions", plugin.id, "index.ts"),
    ),
    path.join(nmDir, "@larksuiteoapi", "node-sdk", "package.json"),
    path.join(nmDir, "openclaw", "package.json"),
    path.join(nmDir, "sqlite-vec", "package.json"),
  ];
  if (sqliteVecTargetPackage) {
    requiredPaths.push(path.join(nmDir, sqliteVecTargetPackage, "package.json"));
  }
  return requiredPaths.every((requiredPath) => fs.existsSync(requiredPath));
}

function workspaceDependencies() {
  const manifest = JSON.parse(fs.readFileSync(path.join(vendorDir, "package.json"), "utf-8"));
  return Object.entries(manifest.dependencies ?? {})
    .filter(([, version]) => String(version).startsWith("workspace:"))
    .map(([name]) => name);
}

function packageDir(packageName) {
  return path.join(nmDir, ...packageName.split("/"));
}

function hasMaterializedWorkspaceDependencies() {
  return workspaceDependencies().every((packageName) => {
    const destination = packageDir(packageName);
    try {
      return (
        !fs.lstatSync(destination).isSymbolicLink() &&
        fs.existsSync(path.join(destination, "package.json"))
      );
    } catch {
      return false;
    }
  });
}

function materializeWorkspaceDependencies() {
  for (const packageName of workspaceDependencies()) {
    const destination = packageDir(packageName);
    let source;
    try {
      source = fs.realpathSync(destination);
    } catch {
      throw new Error(`workspace dependency is not installed: ${packageName}`);
    }

    const relativeSource = path.relative(vendorDir, source);
    if (relativeSource.startsWith("..") || path.isAbsolute(relativeSource)) {
      throw new Error(`workspace dependency points outside vendor: ${packageName} -> ${source}`);
    }

    if (!fs.lstatSync(destination).isSymbolicLink()) {
      continue;
    }

    const manifestPath = path.join(source, "package.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const publishedFiles = Array.isArray(manifest.files) ? manifest.files : [];
    if (publishedFiles.length === 0) {
      throw new Error(`workspace dependency has no package files allowlist: ${packageName}`);
    }

    const staged = `${destination}.rivonclaw-materialize-${process.pid}`;
    fs.rmSync(staged, { recursive: true, force: true });
    fs.mkdirSync(staged, { recursive: true });
    fs.copyFileSync(manifestPath, path.join(staged, "package.json"));

    for (const entry of publishedFiles) {
      if (typeof entry !== "string" || /[*?{}[\]]/u.test(entry)) {
        throw new Error(`unsupported package files entry for ${packageName}: ${String(entry)}`);
      }
      const sourceEntry = path.join(source, entry);
      if (!fs.existsSync(sourceEntry)) continue;
      fs.cpSync(sourceEntry, path.join(staged, entry), { recursive: true });
    }

    fs.rmSync(destination, { recursive: true, force: true });
    fs.renameSync(staged, destination);
    console.log(`  materialized workspace dependency ${packageName}`);
  }
}

function makeDistVisibleToElectronBuilder() {
  const gitignorePath = path.join(vendorDir, ".gitignore");
  if (!fs.existsSync(gitignorePath)) return;

  const original = fs.readFileSync(gitignorePath, "utf-8");
  const filtered = original
    .split("\n")
    .filter((line) => line.trim() !== "dist" && line.trim() !== "dist-runtime")
    .join("\n");

  if (filtered !== original) {
    fs.writeFileSync(gitignorePath, filtered, "utf-8");
    console.log("  updated .gitignore: removed dist and dist-runtime exclusions");
  }
}

function copyExtensionManifestsIntoDist() {
  const sourceExtensionsDir = path.join(vendorDir, "extensions");
  const distExtensionsDir = path.join(vendorDir, "dist", "extensions");
  if (!fs.existsSync(sourceExtensionsDir) || !fs.existsSync(distExtensionsDir)) return;

  let copiedManifests = 0;
  for (const entry of fs.readdirSync(distExtensionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sourceDir = path.join(sourceExtensionsDir, entry.name);
    const distDir = path.join(distExtensionsDir, entry.name);
    for (const manifestName of ["package.json", "openclaw.plugin.json"]) {
      const source = path.join(sourceDir, manifestName);
      const target = path.join(distDir, manifestName);
      if (!fs.existsSync(source) || fs.existsSync(target)) continue;
      fs.copyFileSync(source, target);
      copiedManifests++;
    }
  }

  if (copiedManifests > 0) {
    console.log(`  copied ${copiedManifests} extension manifests into dist/extensions`);
  }
}

function isPluginSkillMarkdown(filePath) {
  const rel = path.relative(vendorDir, filePath).replace(/\\/g, "/");
  return /^(dist\/extensions|dist-runtime\/extensions|extensions)\/[^/]+\/skills\/[^/]+\/SKILL\.md$/u.test(
    rel,
  );
}

function stripNonRuntimeFiles(rootDir, depth = 0) {
  let entries;
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return { files: 0, bytes: 0 };
  }

  let files = 0;
  let bytes = 0;

  for (const entry of entries) {
    const full = path.join(rootDir, entry.name);
    if (entry.isSymbolicLink()) continue;

    if (entry.isDirectory()) {
      if (depth <= 3 && STRIP_DIRS.has(entry.name)) {
        const size = dirSize(full);
        const count = fileCount(full);
        fs.rmSync(full, { recursive: true, force: true });
        files += count;
        bytes += size;
        continue;
      }
      const stripped = stripNonRuntimeFiles(full, depth + 1);
      files += stripped.files;
      bytes += stripped.bytes;
      continue;
    }

    let shouldStrip = STRIP_FILES.has(entry.name) || STRIP_DTS_RE.test(entry.name);
    if (!shouldStrip) {
      shouldStrip =
        STRIP_EXTS.some((ext) => entry.name.endsWith(ext)) && !isPluginSkillMarkdown(full);
    }
    if (!shouldStrip) continue;

    try {
      bytes += fs.statSync(full).size;
      fs.unlinkSync(full);
      files++;
    } catch {}
  }

  return { files, bytes };
}

function stripOtherDarwinArch() {
  if (!macRuntimeArch) return;

  const otherArch = macRuntimeArch === "arm64" ? "x64" : "arm64";
  const otherArchMarkers = [
    `darwin-${otherArch}`,
    `darwin_${otherArch}`,
    otherArch === "x64" ? "darwin-x86_64" : "darwin-aarch64",
  ];
  let removedEntries = 0;
  let removedBytes = 0;

  function stripDir(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(nmDir, full).replace(/\\/g, "/");
      if (otherArchMarkers.some((marker) => rel.includes(marker))) {
        const size = entry.isSymbolicLink()
          ? 0
          : entry.isDirectory()
            ? dirSize(full)
            : fs.statSync(full).size;
        const count = entry.isSymbolicLink() ? 1 : entry.isDirectory() ? fileCount(full) : 1;
        fs.rmSync(full, { recursive: true, force: true });
        removedBytes += size;
        removedEntries += count;
        continue;
      }
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        stripDir(full);
      }
    }
  }

  stripDir(nmDir);
  console.log(
    `[prune-vendor-deps] Removed ${removedEntries} non-${macRuntimeArch} macOS files ` +
      `(${(removedBytes / 1024 / 1024).toFixed(1)}MB)`,
  );
}

function removeTreeSitterBashPrebuilds() {
  const prebuilds = path.join(nmDir, "tree-sitter-bash", "prebuilds");
  if (!fs.existsSync(prebuilds)) return;

  const size = dirSize(prebuilds);
  const count = fileCount(prebuilds);
  fs.rmSync(prebuilds, { recursive: true, force: true });
  console.log(
    `[prune-vendor-deps] Removed tree-sitter-bash native prebuilds ` +
      `(${(size / 1024 / 1024).toFixed(1)}MB, ${count} files)`,
  );
}

function stageOfficialVendorPlugins() {
  if (!fs.existsSync(stageOfficialVendorPluginsScript)) return;
  execSync(`node ${JSON.stringify(stageOfficialVendorPluginsScript)}`, {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    env: {
      ...process.env,
      VENDOR_DIR_OVERRIDE: vendorDir,
    },
  });
}

function removeSymlinksAndNestedNodeModules(rootDir) {
  let entries;
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return { files: 0, bytes: 0 };
  }

  let files = 0;
  let bytes = 0;

  for (const entry of entries) {
    const full = path.join(rootDir, entry.name);
    if (entry.isSymbolicLink()) {
      try {
        fs.unlinkSync(full);
        files++;
      } catch {}
      continue;
    }
    if (!entry.isDirectory()) continue;

    if (entry.name === "node_modules") {
      const size = dirSize(full);
      const count = fileCount(full);
      fs.rmSync(full, { recursive: true, force: true });
      files += count;
      bytes += size;
      continue;
    }

    const removed = removeSymlinksAndNestedNodeModules(full);
    files += removed.files;
    bytes += removed.bytes;
  }

  return { files, bytes };
}

function removeSymlinkMarkerDocs(rootDir) {
  let entries;
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return 0;
  }

  let files = 0;
  for (const entry of entries) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files += removeSymlinkMarkerDocs(full);
      continue;
    }
    if (entry.name !== "CLAUDE.md" && entry.name !== "AGENTS.md") continue;

    try {
      if (entry.isSymbolicLink()) {
        fs.unlinkSync(full);
        files++;
        continue;
      }
      const content = fs.readFileSync(full, "utf-8").trim();
      if (content.length < 100 && /^[A-Z][A-Z_-]+\.md$/.test(content)) {
        fs.unlinkSync(full);
        files++;
      }
    } catch {}
  }
  return files;
}

function removeOrphanedDistRuntimeWrappers() {
  const distRuntimeExtDir = path.join(vendorDir, "dist-runtime", "extensions");
  const distExtDir = path.join(vendorDir, "dist", "extensions");
  if (!fs.existsSync(distRuntimeExtDir)) return { files: 0, bytes: 0 };

  let files = 0;
  let bytes = 0;
  const distEntries = fs.existsSync(distExtDir)
    ? new Set(
        fs
          .readdirSync(distExtDir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name),
      )
    : new Set();

  for (const entry of fs.readdirSync(distRuntimeExtDir, { withFileTypes: true })) {
    if (
      !entry.isDirectory() ||
      distEntries.has(entry.name) ||
      PRESERVED_DIST_RUNTIME_EXTENSIONS.has(entry.name)
    ) {
      continue;
    }

    const full = path.join(distRuntimeExtDir, entry.name);
    const size = dirSize(full);
    const count = fileCount(full);
    fs.rmSync(full, { recursive: true, force: true });
    files += count;
    bytes += size;
    console.log(`  removed orphaned dist-runtime wrapper: ${entry.name}`);
  }

  return { files, bytes };
}

const prunedMarkerPath = path.join(vendorDir, "dist", ".pruned");
if (fs.existsSync(prunedMarkerPath)) {
  const markerText = fs.readFileSync(prunedMarkerPath, "utf-8");
  const hasCurrentPruneProfile = markerText.includes(`profile=${PRUNE_PROFILE_VERSION}`);
  const hasDevDeps = fs.existsSync(path.join(nmDir, "typescript"));

  if (
    hasCurrentPruneProfile &&
    !hasDevDeps &&
    !hasBlacklistedPackage() &&
    !hasOtherSqliteVecPlatforms() &&
    disabledVendorExtensionDirs().length === 0 &&
    hasRequiredOfficialVendorPlugins() &&
    hasMaterializedWorkspaceDependencies()
  ) {
    console.log("[prune-vendor-deps] Already pruned (.pruned marker found), skipping.");
    process.exit(0);
  }

  console.log("[prune-vendor-deps] Stale .pruned marker, re-pruning...");
  fs.unlinkSync(prunedMarkerPath);
}

const sizeBefore = dirSize(nmDir);
const filesBefore = fileCount(nmDir);
console.log(
  `[prune-vendor-deps] Before: ${(sizeBefore / 1024 / 1024).toFixed(0)}MB, ${filesBefore} files`,
);

console.log("[prune-vendor-deps] Phase 1: pnpm install --prod ...");
try {
  withCrossArchMacDependencies(() =>
    execSync(
      "pnpm --config.manage-package-manager-versions=false --config.auto-install-peers=false install --prod --no-frozen-lockfile --ignore-scripts",
      {
        cwd: vendorDir,
        stdio: "inherit",
        timeout: 120_000,
        env: { ...process.env, CI: "true", npm_config_node_linker: "hoisted" },
      },
    ),
  );
} catch (err) {
  if (err?.code === "ETIMEDOUT" && hasCompletedProductionInstall()) {
    console.warn(
      "[prune-vendor-deps] pnpm finished the production install but did not exit; continuing after verified timeout.",
    );
  } else {
    console.error("[prune-vendor-deps] pnpm install --prod failed:", err.message);
    process.exit(1);
  }
}

if (
  sqliteVecTargetPackage &&
  !fs.existsSync(path.join(nmDir, sqliteVecTargetPackage, "package.json"))
) {
  console.error(
    `[prune-vendor-deps] pnpm did not install required target package ${sqliteVecTargetPackage}`,
  );
  process.exit(1);
}

console.log("[prune-vendor-deps] Materializing production workspace dependencies ...");
materializeWorkspaceDependencies();

try {
  execSync("git checkout -- .", { cwd: vendorDir, stdio: "ignore" });
} catch {}

console.log("[prune-vendor-deps] Staging official external vendor plugins ...");
stageOfficialVendorPlugins();

const sizeP1 = dirSize(nmDir);
console.log(
  `[prune-vendor-deps] After Phase 1: ${(sizeP1 / 1024 / 1024).toFixed(0)}MB ` +
    `(saved ${((sizeBefore - sizeP1) / 1024 / 1024).toFixed(0)}MB)`,
);

console.log("[prune-vendor-deps] Phase 2: removing package blacklist ...");
for (const pkg of EXTRA_REMOVE) {
  for (const pkgDir of packageDirsForExactOrScope(pkg)) {
    removePackageDir(pkgDir);
  }
}
for (const prefix of EXTRA_REMOVE_PREFIXES) {
  for (const pkgDir of packageDirsForPrefix(prefix)) {
    removePackageDir(pkgDir);
  }
}
removeOtherSqliteVecPlatforms();
removeDisabledVendorExtensions();
removeReplacedVendorExtensionSources();

const sizeP2 = dirSize(nmDir);
console.log(
  `[prune-vendor-deps] After Phase 2: ${(sizeP2 / 1024 / 1024).toFixed(0)}MB ` +
    `(saved ${((sizeBefore - sizeP2) / 1024 / 1024).toFixed(0)}MB)`,
);

stripOtherDarwinArch();
removeTreeSitterBashPrebuilds();

console.log("[prune-vendor-deps] Phase 3: stripping non-runtime node_modules files ...");
const strippedNodeModules = stripNonRuntimeFiles(nmDir, 0);
console.log(
  `  stripped ${strippedNodeModules.files} files ` +
    `(${(strippedNodeModules.bytes / 1024 / 1024).toFixed(0)}MB)`,
);

console.log("[prune-vendor-deps] Phase 4: stripping dist and extension baggage ...");
let phase4Files = 0;
let phase4Bytes = 0;

for (const subdir of ["dist", "dist-runtime", "extensions"]) {
  const target = path.join(vendorDir, subdir);
  if (!fs.existsSync(target)) continue;
  const removed = removeSymlinksAndNestedNodeModules(target);
  phase4Files += removed.files;
  phase4Bytes += removed.bytes;
}

for (const subdir of ["dist-runtime", "extensions"]) {
  const target = path.join(vendorDir, subdir);
  if (!fs.existsSync(target)) continue;
  const stripped = stripNonRuntimeFiles(target, 0);
  phase4Files += stripped.files;
  phase4Bytes += stripped.bytes;
}

const controlUiDir = path.join(vendorDir, "dist", "control-ui");
if (fs.existsSync(controlUiDir)) {
  const size = dirSize(controlUiDir);
  const count = fileCount(controlUiDir);
  fs.rmSync(controlUiDir, { recursive: true, force: true });
  phase4Bytes += size;
  phase4Files += count;
  console.log(`  removed dist/control-ui/ (${(size / 1024 / 1024).toFixed(1)}MB, ${count} files)`);
}

phase4Files += removeSymlinkMarkerDocs(vendorDir);
const orphaned = removeOrphanedDistRuntimeWrappers();
phase4Files += orphaned.files;
phase4Bytes += orphaned.bytes;

console.log(
  `  stripped ${phase4Files} files ` +
    `(${(phase4Bytes / 1024 / 1024).toFixed(0)}MB) from dist-runtime/ and extensions/`,
);

makeDistVisibleToElectronBuilder();
copyExtensionManifestsIntoDist();

fs.writeFileSync(
  prunedMarkerPath,
  `profile=${PRUNE_PROFILE_VERSION}\ncreatedAt=${new Date().toISOString()}\n`,
  "utf-8",
);
console.log("[prune-vendor-deps] Wrote .pruned marker");

const sizeAfter = dirSize(nmDir);
const filesAfter = fileCount(nmDir);
const totalSaved = sizeBefore - sizeAfter;
console.log(
  `[prune-vendor-deps] Final: ${(sizeAfter / 1024 / 1024).toFixed(0)}MB, ${filesAfter} files ` +
    `(saved ${(totalSaved / 1024 / 1024).toFixed(0)}MB / ${((totalSaved / sizeBefore) * 100).toFixed(0)}%, ` +
    `removed ${filesBefore - filesAfter} files)`,
);
