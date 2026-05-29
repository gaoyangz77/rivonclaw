// @ts-check
// Prunes vendor/openclaw to production-only dependencies before
// electron-builder packages the app.
//
// Five-phase pruning:
// 1. `pnpm install --prod` removes devDependencies and their transitive deps
// 2. Manual removal of packages that survive the prune due to pnpm workspace
//    hoisting (e.g. vite is a prod dep of ui/ but not needed by the gateway)
// 3. Strip non-runtime files (docs, tests, source maps, etc.) from node_modules
//    — critical for HFS+ DMGs where each file takes ≥4KB due to block
//    allocation, and excessive file count can overflow the DMG volume.
// 4. Strip non-runtime files from dist-runtime/ and extensions/, remove nested
//    node_modules (symlinked), and delete dist/control-ui/ (Panel provides UI)
// 5. Write .pruned marker for idempotency
//
// Idempotent: skips if already pruned (detected by .pruned marker).

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const vendorDir = process.env.VENDOR_DIR_OVERRIDE
  ? path.resolve(process.env.VENDOR_DIR_OVERRIDE)
  : path.resolve(__dirname, "..", "..", "..", "vendor", "openclaw");
const nmDir = path.join(vendorDir, "node_modules");
const PRUNE_PROFILE_VERSION = "unified-runtime-prune-2026-05-29.1";
const macRuntimeArch = process.env.RIVONCLAW_MAC_RUNTIME_ARCH === "arm64" ||
  process.env.RIVONCLAW_MAC_RUNTIME_ARCH === "x64"
  ? process.env.RIVONCLAW_MAC_RUNTIME_ARCH
  : process.platform === "darwin" && (process.arch === "arm64" || process.arch === "x64")
    ? process.arch
    : null;

if (!fs.existsSync(nmDir)) {
  console.log("[prune-vendor-deps] vendor/openclaw/node_modules not found, skipping.");
  process.exit(0);
}

// Idempotency: if .pruned marker exists and node_modules looks pruned, skip.
// If marker exists but node_modules is full (e.g. after vendor restore), the
// marker is stale — delete it and re-prune.
const prunedMarkerPath = path.join(vendorDir, "dist", ".pruned");
if (fs.existsSync(prunedMarkerPath)) {
  // Quick check: if typescript exists, node_modules was restored (not pruned)
  const hasDevDeps = fs.existsSync(path.join(nmDir, "typescript"));
  const markerText = fs.readFileSync(prunedMarkerPath, "utf-8");
  const hasCurrentPruneProfile = markerText.includes(`profile=${PRUNE_PROFILE_VERSION}`);
  const hasRemovedRuntimeBaggage = [
    path.join(nmDir, "@jimp"),
    path.join(nmDir, "@openai", "codex"),
    path.join(nmDir, "@zed-industries", "codex-acp"),
    path.join(nmDir, "@anthropic-ai", "claude-agent-sdk"),
  ].some((candidate) => fs.existsSync(candidate));
  // macOS pruning depends on current target arch and optional native package
  // policy, so a cached marker from an older prune script is not enough.
  if (!hasDevDeps && !macRuntimeArch && hasCurrentPruneProfile && !hasRemovedRuntimeBaggage) {
    console.log("[prune-vendor-deps] Already pruned (.pruned marker found), skipping.");
    process.exit(0);
  }
  const reason = hasDevDeps
    ? "dev deps present"
    : !hasCurrentPruneProfile
      ? "prune profile changed"
      : hasRemovedRuntimeBaggage
        ? "new runtime baggage removal required"
        : "macOS runtime prune must refresh cached marker";
  console.log(`[prune-vendor-deps] Stale .pruned marker (${reason}), re-pruning...`);
  fs.unlinkSync(prunedMarkerPath);
}

// --- Phase 2 config: packages not needed by the gateway runtime ---
const EXTRA_REMOVE = [
  // vite + its dependency tree (build tool for ui/)
  "vite",
  "esbuild",
  "@esbuild",
  "rollup",
  "@rollup",
  "@rolldown",
  "lightningcss",
  // typescript (peer dep only, not used at runtime)
  "typescript",
  // node-llama-cpp (optional peer dep for local LLMs)
  "node-llama-cpp",
  "@node-llama-cpp",
  // tsx (devDep that survives hoisting)
  "tsx",
  // test/dev packages that can survive through hoisted workspace edges
  "jsdom",
  "vitest",
  "@vitest",
  "@copilotkit",
  "@types",
  // lit (ui/ dependency, not needed by gateway)
  "lit",
  "lit-html",
  "lit-element",
  "@lit",
  "@lit-labs",
  // Heavy packages that are bundled into vendor/openclaw/dist by OpenClaw's
  // build or only support source/test/control-ui paths we do not ship.
  "@jimp",
  "jimp",
  "bmp-ts",
  "gifwrap",
  "image-q",
  "jpeg-js",
  "omggif",
  "pixelmatch",
  "pngjs",
  "utif2",
  "@shikijs",
  "shiki",
  "highlight.js",
  "react",
  "react-dom",
  "@mistralai",
  "@wasm-audio-decoders",
  "ogg-opus-decoder",
  "node-wav",
  "apache-arrow",
  // Optional native feature packages are not part of the desktop gateway's
  // core runtime. Keeping them inside the macOS app makes Apple notarization
  // recurse into the vendor archive and reject unsigned Mach-O payloads.
  "@agentclientprotocol/claude-agent-acp",
  "@anthropic-ai/claude-agent-sdk",
  "@discordjs/opus",
  "@lydell/node-pty",
  "@matrix-org/matrix-sdk-crypto-nodejs",
  "@openai/codex",
  "@zed-industries/codex-acp",
  "bare-fs",
  "bare-os",
  "bare-url",
  "fsevents",
  "koffi",
  "playwright",
  "sharp",
  "sqlite-vec",
];

const EXTRA_REMOVE_PREFIXES = [
  // One cross-platform rule per optional native family. This keeps the prune
  // profile unified while still removing darwin/linux/win32 variant packages.
  "lightningcss-",
  "@anthropic-ai/claude-agent-sdk-",
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
  "sqlite-vec-",
];

// --- Phase 3 config: non-runtime files to strip ---
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
  ".bin", // Not needed at runtime
]);

const STRIP_EXTS = [".map", ".md", ".mdx", ".c", ".h", ".cc", ".cpp", ".gyp", ".gypi"];
// TypeScript declarations (.d.ts, .d.mts, .d.cts) — ~33K files, ~61MB after prod install
const STRIP_DTS_RE = /\.d\.[mc]?ts$/;

function isPluginSkillMarkdown(filePath) {
  const rel = path.relative(vendorDir, filePath).replace(/\\/g, "/");
  return /^dist-runtime\/extensions\/[^/]+\/skills\/[^/]+\/SKILL\.md$/u.test(rel);
}

/** Return total size of a directory in bytes. */
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

/** Count files in a directory (excluding symlinks). */
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
      if (!entry.isDirectory()) continue;
      if (!entry.name.startsWith(packagePrefix)) continue;
      matches.push(path.join(scopeDir, entry.name));
    }
    return matches;
  }

  for (const entry of fs.readdirSync(nmDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(normalizedPrefix)) {
      matches.push(path.join(nmDir, entry.name));
    }
  }
  return matches;
}

function removePackageDir(pkgDir, label) {
  if (!fs.existsSync(pkgDir)) return false;
  const size = dirSize(pkgDir);
  fs.rmSync(pkgDir, { recursive: true, force: true });
  console.log(`  removed ${label} (${(size / 1024 / 1024).toFixed(1)}MB)`);
  return true;
}

const sizeBefore = dirSize(nmDir);
const filesBefore = fileCount(nmDir);
console.log(
  `[prune-vendor-deps] Before: ${(sizeBefore / 1024 / 1024).toFixed(0)}MB, ${filesBefore} files`,
);

// ─── Phase 1: pnpm install --prod ───
console.log("[prune-vendor-deps] Phase 1: pnpm install --prod ...");
try {
  // pnpm traverses upward and finds the monorepo workspace root, causing it
  // to hoist ALL workspace dependencies into vendor/node_modules (inflating
  // from ~2K to 30K+ files). Place an empty pnpm-workspace.yaml to make pnpm
  // treat vendorDir as its own workspace root, preventing upward traversal.
  // Keep vendor's own pnpm-workspace.yaml as-is. It lists extensions/* whose
  // runtime dependencies (grammy, @aws-sdk/*, etc.) must be hoisted into
  // node_modules/. Overriding this causes missing module errors at runtime.
  execSync("pnpm install --prod --no-frozen-lockfile --ignore-scripts", {
    cwd: vendorDir,
    stdio: "inherit",
    timeout: 120_000,
    env: { ...process.env, CI: "true", npm_config_node_linker: "hoisted" },
  });
  // No workspace yaml restoration needed (using vendor's original)
} catch (err) {
  console.error("[prune-vendor-deps] pnpm install --prod failed:", err.message);
  process.exit(1);
}

// Restore tracked files dirtied by pnpm install (e.g. .npmrc) so the
// pre-commit hook doesn't block commits due to vendor repo being dirty.
try {
  execSync("git checkout -- .", { cwd: vendorDir, stdio: "ignore" });
} catch {}

const sizeP1 = dirSize(nmDir);
console.log(
  `[prune-vendor-deps] After Phase 1: ${(sizeP1 / 1024 / 1024).toFixed(0)}MB ` +
    `(saved ${((sizeBefore - sizeP1) / 1024 / 1024).toFixed(0)}MB)`,
);

// ─── Phase 2: remove non-gateway packages ───
console.log("[prune-vendor-deps] Phase 2: removing non-gateway packages ...");
for (const pkg of EXTRA_REMOVE) {
  const pkgDir = path.join(nmDir, pkg);
  removePackageDir(pkgDir, pkg);
}
for (const prefix of EXTRA_REMOVE_PREFIXES) {
  for (const pkgDir of packageDirsForPrefix(prefix)) {
    removePackageDir(pkgDir, path.relative(nmDir, pkgDir).replace(/\\/g, "/"));
  }
}

const sizeP2 = dirSize(nmDir);
console.log(
  `[prune-vendor-deps] After Phase 2: ${(sizeP2 / 1024 / 1024).toFixed(0)}MB ` +
    `(saved ${((sizeBefore - sizeP2) / 1024 / 1024).toFixed(0)}MB)`,
);

// ─── Phase 2b: remove native prebuilds for the other macOS architecture ───
if (macRuntimeArch) {
  const otherArch = macRuntimeArch === "arm64" ? "x64" : "arm64";
  const otherArchMarkers = [
    `darwin-${otherArch}`,
    `darwin_${otherArch}`,
    otherArch === "x64" ? "darwin-x86_64" : "darwin-aarch64",
  ];
  let removedArchEntries = 0;
  let removedArchBytes = 0;

  function stripOtherDarwinArch(dir) {
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
        const count = entry.isSymbolicLink()
          ? 1
          : entry.isDirectory()
            ? fileCount(full)
            : 1;
        fs.rmSync(full, { recursive: true, force: true });
        removedArchBytes += size;
        removedArchEntries += count;
        continue;
      }
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        stripOtherDarwinArch(full);
      }
    }
  }

  stripOtherDarwinArch(nmDir);
  console.log(
    `[prune-vendor-deps] Phase 2b: removed ${removedArchEntries} non-${macRuntimeArch} macOS files ` +
      `(${(removedArchBytes / 1024 / 1024).toFixed(1)}MB)`,
  );
}

// tree-sitter-bash is used through its WASM grammar at runtime; the native
// prebuilds are optional package baggage and create notarization work.
const treeSitterBashPrebuilds = path.join(nmDir, "tree-sitter-bash", "prebuilds");
if (fs.existsSync(treeSitterBashPrebuilds)) {
  const size = dirSize(treeSitterBashPrebuilds);
  const count = fileCount(treeSitterBashPrebuilds);
  fs.rmSync(treeSitterBashPrebuilds, { recursive: true, force: true });
  console.log(
    `[prune-vendor-deps] Removed tree-sitter-bash native prebuilds ` +
      `(${(size / 1024 / 1024).toFixed(1)}MB, ${count} files)`,
  );
}

// ─── Phase 3: strip non-runtime files ───
// This is critical for HFS+ DMGs: 55K+ files cause block allocation overhead
// that can overflow the DMG volume. Stripping docs/tests/maps reduces file
// count by ~15K and frees ~110MB.
console.log("[prune-vendor-deps] Phase 3: stripping non-runtime files ...");
let strippedFiles = 0;
let strippedBytes = 0;

function stripDir(dir, depth) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;

    if (entry.isDirectory()) {
      // Remove entire directories matching STRIP_DIRS (only within packages, depth ≤ 3)
      if (depth <= 3 && STRIP_DIRS.has(entry.name)) {
        const size = dirSize(full);
        const count = fileCount(full);
        fs.rmSync(full, { recursive: true, force: true });
        strippedBytes += size;
        strippedFiles += count;
        continue;
      }
      stripDir(full, depth + 1);
    } else {
      // Remove files matching STRIP_FILES or STRIP_EXTS
      if (STRIP_FILES.has(entry.name)) {
        strippedBytes += fs.statSync(full).size;
        fs.unlinkSync(full);
        strippedFiles++;
        continue;
      }
      for (const ext of STRIP_EXTS) {
        if (entry.name.endsWith(ext)) {
          if (isPluginSkillMarkdown(full)) {
            break;
          }
          strippedBytes += fs.statSync(full).size;
          fs.unlinkSync(full);
          strippedFiles++;
          break;
        }
      }
      // TypeScript declarations (not caught by STRIP_EXTS since .ts != .d.ts)
      if (STRIP_DTS_RE.test(entry.name)) {
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
console.log(
  `  stripped ${strippedFiles} files (${(strippedBytes / 1024 / 1024).toFixed(0)}MB)`,
);

// ─── Phase 4: strip non-runtime files from dist-runtime/ and extensions/ ───
console.log("[prune-vendor-deps] Phase 4: stripping non-runtime files from dist-runtime/ and extensions/ ...");
let phase4Files = 0;
let phase4Bytes = 0;

// Helper: recursively remove all node_modules/ directories (real or symlinked)
function removeNestedNodeModules(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      if (entry.name === "node_modules") {
        fs.unlinkSync(full);
        phase4Files++;
      }
      continue;
    }
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") {
        const size = dirSize(full);
        const count = fileCount(full);
        fs.rmSync(full, { recursive: true, force: true });
        phase4Bytes += size;
        phase4Files += count;
        continue;
      }
      removeNestedNodeModules(full);
    }
  }
}

// 4a: Remove nested node_modules AND all symlinks from dist/, dist-runtime/,
// and extensions/. node_modules are symlinked or duplicated — runtime resolves
// deps from the top-level node_modules/. Other symlinks (SKILL.md, .json stamp
// files) break Windows 7-Zip packaging.
function removeSymlinksRecursive(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      try { fs.unlinkSync(full); phase4Files++; } catch {}
      continue;
    }
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") {
        const size = dirSize(full);
        const count = fileCount(full);
        fs.rmSync(full, { recursive: true, force: true });
        phase4Bytes += size;
        phase4Files += count;
        continue;
      }
      removeSymlinksRecursive(full);
    }
  }
}
for (const subdir of ["dist", "dist-runtime", "extensions"]) {
  const target = path.join(vendorDir, subdir);
  if (fs.existsSync(target)) {
    removeSymlinksRecursive(target);
  }
}

// 4b: Strip .d.ts, .map, .md, .mdx from dist-runtime/ and extensions/
const distRuntimeDir = path.join(vendorDir, "dist-runtime");
if (fs.existsSync(distRuntimeDir)) {
  stripDir(distRuntimeDir, 0);
}

// 4b: Strip .d.ts, .map, .md, .mdx from extensions/ (vendor extensions)
const extensionsDir = path.join(vendorDir, "extensions");
if (fs.existsSync(extensionsDir)) {
  stripDir(extensionsDir, 0);
}

// 4c: Remove dist/control-ui/ (runtime doesn't need it — Panel provides UI)
const controlUiDir = path.join(vendorDir, "dist", "control-ui");
if (fs.existsSync(controlUiDir)) {
  const size = dirSize(controlUiDir);
  const count = fileCount(controlUiDir);
  fs.rmSync(controlUiDir, { recursive: true, force: true });
  phase4Bytes += size;
  phase4Files += count;
  console.log(`  removed dist/control-ui/ (${(size / 1024 / 1024).toFixed(1)}MB, ${count} files)`);
}

// 4d: Remove CLAUDE.md symlinks — git stores them as text files containing
// the symlink target. On CI with core.symlinks=true they become real symlinks.
// Windows 7-Zip treats them as invalid directories, crashing NSIS packaging.
function removeCLAUDEmdSymlinks(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeCLAUDEmdSymlinks(full);
    } else if (entry.name === "CLAUDE.md" || entry.name === "AGENTS.md") {
      // Check if it's a symlink or a small file containing a symlink target
      try {
        if (entry.isSymbolicLink()) {
          fs.unlinkSync(full);
          phase4Files++;
        } else {
          const content = fs.readFileSync(full, "utf-8").trim();
          // Git symlink files contain just the target filename
          if (content.length < 100 && /^[A-Z][A-Z_-]+\.md$/.test(content)) {
            fs.unlinkSync(full);
            phase4Files++;
          }
        }
      } catch {}
    }
  }
}
removeCLAUDEmdSymlinks(vendorDir);

// 4e: Make dist/ and dist-runtime/ visible to electron-builder.
// vendor/.gitignore excludes them but electron-builder needs to copy them.
// Remove these lines from .gitignore (keep everything else like node_modules).
const gitignorePath = path.join(vendorDir, ".gitignore");
if (fs.existsSync(gitignorePath)) {
  const original = fs.readFileSync(gitignorePath, "utf-8");
  const filtered = original
    .split("\n")
    .filter((line) => line.trim() !== "dist" && line.trim() !== "dist-runtime")
    .join("\n");
  if (filtered !== original) {
    // Save original to .git/info/exclude so git status stays clean
    const excludePath = path.join(vendorDir, ".git", "info", "exclude");
    try { fs.writeFileSync(excludePath, original, "utf-8"); } catch {}
    fs.writeFileSync(gitignorePath, filtered, "utf-8");
    console.log("  updated .gitignore: removed dist and dist-runtime exclusions");
  }
}

// 4f: Remove orphaned dist-runtime extension wrappers.
// dist-runtime/extensions/ contains ESM wrappers that re-export from
// dist/extensions/. If an extension is removed from dist/ but its wrapper
// survives in dist-runtime/, the gateway logs repeated "failed to load"
// warnings. Compare the two directories and remove any dist-runtime entry
// that has no corresponding dist entry.
const distRuntimeExtDir = path.join(vendorDir, "dist-runtime", "extensions");
const distExtDir = path.join(vendorDir, "dist", "extensions");
if (fs.existsSync(distRuntimeExtDir)) {
  const runtimeEntries = fs.readdirSync(distRuntimeExtDir, { withFileTypes: true });
  const distEntries = fs.existsSync(distExtDir)
    ? new Set(
        fs.readdirSync(distExtDir, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name),
      )
    : new Set();
  for (const entry of runtimeEntries) {
    if (!entry.isDirectory()) continue;
    if (distEntries.has(entry.name)) continue;
    const full = path.join(distRuntimeExtDir, entry.name);
    const size = dirSize(full);
    const count = fileCount(full);
    fs.rmSync(full, { recursive: true, force: true });
    phase4Bytes += size;
    phase4Files += count;
    console.log(`  removed orphaned dist-runtime wrapper: ${entry.name}`);
  }
}

console.log(`  stripped ${phase4Files} files (${(phase4Bytes / 1024 / 1024).toFixed(0)}MB) from dist-runtime/ and extensions/`);

// 4g: Thin source extension metadata and remove other source-only payloads.
// OpenClaw still needs extension manifests for bundled plugin discovery, but
// packaged desktop runtime code is loaded from dist/extensions.
const sourceExtensionsDir = path.join(vendorDir, "extensions");
if (fs.existsSync(sourceExtensionsDir)) {
  let removedSourceExtensionFiles = 0;
  let removedSourceExtensionBytes = 0;
  const sourceExtensionKeepFiles = new Set();
  const sourceExtensionStripDirs = new Set([
    "test",
    "tests",
    "__tests__",
    "__test__",
    "__fixtures__",
    "__snapshots__",
    "fixtures",
    "coverage",
    ".turbo",
    ".cache",
  ]);
  const sourceExtensionStripFileRe = /(?:^|[./-])(?:test|spec|mock|mocks|fixture|fixtures|snapshot|snapshots|helper|helpers)\.[cm]?[jt]sx?$/u;

  function addSourceExtensionKeepCandidate(extensionDir, specifier) {
    if (typeof specifier !== "string") return;
    const trimmed = specifier.trim();
    if (!trimmed.startsWith("./") && !trimmed.startsWith("../")) return;

    const basePath = path.resolve(extensionDir, trimmed);
    const candidates = [
      basePath,
      `${basePath}.ts`,
      `${basePath}.js`,
      `${basePath}.mjs`,
      `${basePath}.cjs`,
      path.join(basePath, "index.ts"),
      path.join(basePath, "index.js"),
      path.join(basePath, "index.mjs"),
      path.join(basePath, "index.cjs"),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        sourceExtensionKeepFiles.add(path.normalize(candidate));
      }
    }
  }

  function collectRelativeModuleSpecifiers(value, out) {
    if (typeof value === "string") {
      if (value.trim().startsWith("./") || value.trim().startsWith("../")) {
        out.add(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) collectRelativeModuleSpecifiers(item, out);
      return;
    }
    if (value && typeof value === "object") {
      for (const item of Object.values(value)) collectRelativeModuleSpecifiers(item, out);
    }
  }

  for (const entry of fs.readdirSync(sourceExtensionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const extensionDir = path.join(sourceExtensionsDir, entry.name);
    for (const manifestFile of ["package.json", "openclaw.plugin.json"]) {
      const file = path.join(extensionDir, manifestFile);
      if (fs.existsSync(file)) sourceExtensionKeepFiles.add(path.normalize(file));
    }

    const packageJsonPath = path.join(extensionDir, "package.json");
    if (!fs.existsSync(packageJsonPath)) continue;
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const specifiers = new Set();
      collectRelativeModuleSpecifiers(packageJson.openclaw, specifiers);
      for (const specifier of specifiers) {
        addSourceExtensionKeepCandidate(extensionDir, specifier);
      }
    } catch {}
  }

  function shouldKeepSourceExtensionFile(filePath) {
    if (sourceExtensionKeepFiles.has(path.normalize(filePath))) return true;
    const rel = path.relative(sourceExtensionsDir, filePath).replace(/\\/g, "/");
    const parts = rel.split("/");
    if (parts.length < 2) return false;
    if (parts.length === 2 && (parts[1] === "package.json" || parts[1] === "openclaw.plugin.json")) {
      return true;
    }
    if (parts[1] === "skills" && parts.at(-1) === "SKILL.md") return true;
    const basename = path.basename(filePath);
    if (sourceExtensionStripFileRe.test(basename)) return false;
    if (
      basename === "tsconfig.json" ||
      basename.startsWith("tsconfig.") ||
      basename.startsWith("vitest.config.") ||
      basename.startsWith("tsdown.config.") ||
      basename === "README.md" ||
      basename === "CHANGELOG.md" ||
      basename.endsWith(".map") ||
      basename.endsWith(".md") ||
      STRIP_DTS_RE.test(basename)
    ) {
      return false;
    }
    return true;
  }

  function thinSourceExtensionDir(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        fs.unlinkSync(full);
        removedSourceExtensionFiles++;
        continue;
      }
      if (entry.isDirectory()) {
        if (sourceExtensionStripDirs.has(entry.name)) {
          const size = dirSize(full);
          const count = fileCount(full);
          fs.rmSync(full, { recursive: true, force: true });
          removedSourceExtensionBytes += size;
          removedSourceExtensionFiles += count;
          continue;
        }
        thinSourceExtensionDir(full);
        try {
          if (fs.readdirSync(full).length === 0) {
            fs.rmdirSync(full);
          }
        } catch {}
        continue;
      }
      if (shouldKeepSourceExtensionFile(full)) continue;
      removedSourceExtensionBytes += fs.statSync(full).size;
      fs.unlinkSync(full);
      removedSourceExtensionFiles++;
    }
  }

  thinSourceExtensionDir(sourceExtensionsDir);
  phase4Bytes += removedSourceExtensionBytes;
  phase4Files += removedSourceExtensionFiles;
  console.log(
    `  thinned source extensions/ metadata (${removedSourceExtensionFiles} files, ` +
      `${(removedSourceExtensionBytes / 1024 / 1024).toFixed(1)}MB removed)`,
  );
}

for (const relativePath of ["docs", "packages"]) {
  const target = path.join(vendorDir, relativePath);
  if (!fs.existsSync(target)) continue;
  const size = dirSize(target);
  const count = fileCount(target);
  fs.rmSync(target, { recursive: true, force: true });
  phase4Bytes += size;
  phase4Files += count;
  console.log(
    `  removed source-only ${relativePath}/ (${(size / 1024 / 1024).toFixed(1)}MB, ${count} files)`,
  );
}

// ─── Phase 5: write .pruned marker ───
const prunedMarker = path.join(vendorDir, "dist", ".pruned");
fs.writeFileSync(
  prunedMarker,
  `profile=${PRUNE_PROFILE_VERSION}\ncreatedAt=${new Date().toISOString()}\n`,
  "utf-8",
);
console.log("[prune-vendor-deps] Wrote .pruned marker");

// ─── Summary ───
const sizeAfter = dirSize(nmDir);
const filesAfter = fileCount(nmDir);
const totalSaved = sizeBefore - sizeAfter;
console.log(
  `[prune-vendor-deps] Final: ${(sizeAfter / 1024 / 1024).toFixed(0)}MB, ${filesAfter} files ` +
    `(saved ${(totalSaved / 1024 / 1024).toFixed(0)}MB / ${((totalSaved / sizeBefore) * 100).toFixed(0)}%, ` +
    `removed ${filesBefore - filesAfter} files)`,
);
