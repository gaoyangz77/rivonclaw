// @ts-check
// Conservatively prunes vendor/openclaw before electron-builder packages the app.
//
// This intentionally avoids clever runtime-dependency discovery. OpenClaw loads
// many plugins from config and dynamic imports, so aggressive pruning breaks
// real user configurations after vendor upgrades. Keep this script boring:
// install production deps, remove a tiny blacklist of known-heavy packages, and
// copy extension manifests into the compiled dist tree.

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const vendorDir = process.env.VENDOR_DIR_OVERRIDE
  ? path.resolve(process.env.VENDOR_DIR_OVERRIDE)
  : path.resolve(__dirname, "..", "..", "..", "vendor", "openclaw");
const nmDir = path.join(vendorDir, "node_modules");
const PRUNE_PROFILE_VERSION = "conservative-runtime-blacklist-2026-05-29.1";

const EXTRA_REMOVE = [
  "@agentclientprotocol/claude-agent-acp",
  "@anthropic-ai/claude-agent-sdk",
  "@openai/codex",
  "@zed-industries/codex-acp",
];

const EXTRA_REMOVE_PREFIXES = [
  "@anthropic-ai/claude-agent-sdk-",
  "@openai/codex-",
  "@zed-industries/codex-acp-",
];

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
    return fs.readdirSync(scopeDir, { withFileTypes: true })
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

const prunedMarkerPath = path.join(vendorDir, "dist", ".pruned");
if (fs.existsSync(prunedMarkerPath)) {
  const markerText = fs.readFileSync(prunedMarkerPath, "utf-8");
  const hasCurrentPruneProfile = markerText.includes(`profile=${PRUNE_PROFILE_VERSION}`);
  const hasDevDeps = fs.existsSync(path.join(nmDir, "typescript"));

  if (hasCurrentPruneProfile && !hasDevDeps && !hasBlacklistedPackage()) {
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
  execSync("pnpm install --prod --no-frozen-lockfile --ignore-scripts", {
    cwd: vendorDir,
    stdio: "inherit",
    timeout: 120_000,
    env: { ...process.env, CI: "true", npm_config_node_linker: "hoisted" },
  });
} catch (err) {
  console.error("[prune-vendor-deps] pnpm install --prod failed:", err.message);
  process.exit(1);
}

try {
  execSync("git checkout -- .", { cwd: vendorDir, stdio: "ignore" });
} catch {}

console.log("[prune-vendor-deps] Phase 2: removing conservative blacklist ...");
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
