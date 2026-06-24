// @ts-check
// afterPack hook for electron-builder — copies vendor/openclaw/node_modules
// into the packaged app's extraResources.
//
// electron-builder respects .gitignore files (including the root one that has
// "node_modules/"), which silently blocks node_modules from extraResources copy.
// This hook works around that by copying node_modules manually after packing.

const fs = require("fs");
const path = require("path");

const ARCH_NAMES = {
  0: "ia32",
  1: "x64",
  2: "armv7l",
  3: "arm64",
  4: "universal",
};

/** Recursively count files in a directory. */
function countFiles(/** @type {string} */ dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

function detectElectronAbi() {
  try {
    const electronPackagePath = require.resolve("electron/package.json", {
      paths: [path.resolve(__dirname, "..")],
    });
    const electronDir = path.dirname(electronPackagePath);
    const abiPath = path.join(electronDir, "abi_version");
    if (fs.existsSync(abiPath)) {
      const abi = fs.readFileSync(abiPath, "utf8").trim();
      if (/^\d+$/.test(abi)) return abi;
    }
  } catch {}

  return null;
}

/**
 * Keep packaged desktop native bindings to the Electron runtime ABI/arch only.
 * The workspace keeps Node.js and Electron better-sqlite3 prebuilds side-by-side
 * for tests, but shipping Node.js ABI binaries makes macOS codesign process
 * irrelevant native files and can hang on timestamping.
 *
 * @param {string} resourcesDir
 * @param {import("electron-builder").AfterPackContext} context
 */
function prunePackagedBetterSqliteBindings(resourcesDir, context) {
  const bindingDir = path.join(
    resourcesDir,
    "app.asar.unpacked",
    "node_modules",
    "better-sqlite3",
    "lib",
    "binding",
  );
  if (!fs.existsSync(bindingDir)) return;

  const electronAbi = detectElectronAbi();
  const targetArch = ARCH_NAMES[context.arch] || String(context.arch || "");
  const targetPlatform = context.electronPlatformName;
  const keepName = electronAbi && targetArch && targetArch !== "universal"
    ? `node-v${electronAbi}-${targetPlatform}-${targetArch}`
    : null;

  let removedCount = 0;
  let keptCount = 0;
  for (const entry of fs.readdirSync(bindingDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("node-v")) continue;

    if (keepName && entry.name === keepName) {
      keptCount++;
      continue;
    }

    fs.rmSync(path.join(bindingDir, entry.name), { recursive: true, force: true });
    removedCount++;
  }

  const releaseBinding = path.join(
    resourcesDir,
    "app.asar.unpacked",
    "node_modules",
    "better-sqlite3",
    "build",
    "Release",
    "better_sqlite3.node",
  );
  const hasReleaseBinding = fs.existsSync(releaseBinding);
  console.log(
    `[copy-vendor-deps] Pruned packaged better-sqlite3 bindings: ` +
    `removed ${removedCount}, kept ${keptCount}${keepName ? ` (${keepName})` : ""}, ` +
    `build/Release ${hasReleaseBinding ? "present" : "missing"}.`,
  );

  if (!hasReleaseBinding && keptCount === 0) {
    throw new Error(
      "[copy-vendor-deps] FAIL: packaged better-sqlite3 has neither build/Release nor a target Electron binding.",
    );
  }
}

/**
 * @param {import("electron-builder").AfterPackContext} context
 */
exports.default = async function copyVendorDeps(context) {
  const { appOutDir, electronPlatformName } = context;

  // Resolve paths based on platform
  let resourcesDir;
  if (electronPlatformName === "darwin") {
    const productName = context.packager.appInfo.productFilename;
    resourcesDir = path.join(appOutDir, `${productName}.app`, "Contents", "Resources");
  } else {
    // Windows / Linux
    resourcesDir = path.join(appOutDir, "resources");
  }

  prunePackagedBetterSqliteBindings(resourcesDir, context);

  // ─── macOS: archive-based vendor runtime ───
  // On macOS, the vendor runtime ships as a single tar archive instead of
  // 33k+ exploded files (which cause EMFILE during code signing). The archive
  // is extracted to ~/Library/Application Support/RivonClaw/runtime/<version>/
  // on first launch.
  if (electronPlatformName === "darwin") {
    const vendorDestDir = path.join(resourcesDir, "vendor", "openclaw");
    const archiveFile = path.join(vendorDestDir, "vendor-runtime.tar");
    const manifestFile = path.join(vendorDestDir, "vendor-runtime-manifest.json");

    // Verify archive files exist (created by archive-vendor-runtime.cjs)
    if (!fs.existsSync(archiveFile)) {
      throw new Error(
        `[copy-vendor-deps] FAIL: vendor-runtime.tar not found at ${archiveFile}. ` +
        `Run archive-vendor-runtime.cjs before electron-builder.`
      );
    }
    if (!fs.existsSync(manifestFile)) {
      throw new Error(
        `[copy-vendor-deps] FAIL: vendor-runtime-manifest.json not found at ${manifestFile}. ` +
        `Run archive-vendor-runtime.cjs before electron-builder.`
      );
    }

    // Remove everything extraResources copied EXCEPT the archive and manifest.
    // electron-builder's extraResources filter copies dist/, packages/, extensions/,
    // docs/, openclaw.mjs, package.json, etc. — none of that is needed on macOS
    // since everything is inside the archive.
    const KEEP_FILES = new Set(["vendor-runtime.tar", "vendor-runtime-manifest.json"]);
    const entries = fs.readdirSync(vendorDestDir, { withFileTypes: true });
    let removedCount = 0;
    for (const entry of entries) {
      if (KEEP_FILES.has(entry.name)) continue;
      const fullPath = path.join(vendorDestDir, entry.name);
      fs.rmSync(fullPath, { recursive: true, force: true });
      removedCount++;
    }

    const archiveSize = fs.statSync(archiveFile).size;
    const archiveSizeMB = (archiveSize / 1024 / 1024).toFixed(1);
    console.log(`[copy-vendor-deps] macOS archive mode: kept archive (${archiveSizeMB}MB) + manifest, removed ${removedCount} other entries.`);
    return;
  }

  // ─── Windows / Linux: copy node_modules as before ───
  const vendorDest = path.join(resourcesDir, "vendor", "openclaw", "node_modules");
  const vendorSrc = path.resolve(__dirname, "..", "..", "..", "vendor", "openclaw", "node_modules");

  if (!fs.existsSync(vendorSrc)) {
    console.log(`[copy-vendor-deps] vendor/openclaw/node_modules not found at ${vendorSrc}, skipping.`);
    return;
  }

  if (fs.existsSync(vendorDest)) {
    console.log("[copy-vendor-deps] vendor/openclaw/node_modules already present, skipping.");
    return;
  }

  console.log(`[copy-vendor-deps] Copying vendor node_modules...`);
  console.log(`  from: ${vendorSrc}`);
  console.log(`  to:   ${vendorDest}`);

  // Native binaries (.node, .dylib) that are architecture-specific.
  // Exception: sharp/koffi/davey are required at runtime.
  const SKIP_NATIVE_EXTS = new Set([".node", ".dylib"]);
  const ALLOWED_NATIVE_PATTERNS = [
    /[\\/]@img[\\/]sharp-/,
    /[\\/]koffi[\\/]/,
    /[\\/]@snazzah[\\/]davey-/,
  ];
  let skippedCount = 0;

  // Collect relative symlinks to recreate after copy (cpSync can't handle them)
  /** @type {Array<{dest: string, target: string}>} */
  const deferredSymlinks = [];

  fs.cpSync(vendorSrc, vendorDest, {
    recursive: true,
    filter: (src) => {
      const basename = path.basename(src);

      // Skip VCS metadata. Nested repos can contain read-only .git/objects files,
      // which break macOS ShipIt quarantine cleanup and add useless installer weight.
      if (basename === ".git") {
        skippedCount++;
        return false;
      }

      // Skip ALL .bin directories at any depth (CLI convenience links, not needed at runtime)
      if (basename === ".bin") {
        skippedCount++;
        return false;
      }

      // Handle symlinks: preserve relative ones (pnpm), skip absolute ones
      try {
        const stat = fs.lstatSync(src);
        if (stat.isSymbolicLink()) {
          const target = fs.readlinkSync(src);
          if (path.isAbsolute(target)) {
            skippedCount++;
            return false;
          }
          // Relative symlink — defer recreation
          const rel = path.relative(vendorSrc, src);
          deferredSymlinks.push({ dest: path.join(vendorDest, rel), target });
          return false;
        }
      } catch {
        skippedCount++;
        return false;
      }

      // Skip native binaries (except whitelisted)
      const ext = path.extname(src);
      if (SKIP_NATIVE_EXTS.has(ext)) {
        if (ALLOWED_NATIVE_PATTERNS.some((re) => re.test(src))) {
          return true;
        }
        skippedCount++;
        return false;
      }

      return true;
    },
  });

  // Recreate relative symlinks
  let symlinkCount = 0;
  for (const { dest, target } of deferredSymlinks) {
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.symlinkSync(target, dest);
      symlinkCount++;
    } catch (err) {
      console.log(`[copy-vendor-deps] Warning: failed to create symlink ${path.relative(vendorDest, dest)} -> ${target}: ${err instanceof Error ? err.message : err}`);
    }
  }

  const filesCopied = countFiles(vendorDest);
  console.log(`[copy-vendor-deps] Done — ${filesCopied} files copied, ${symlinkCount} symlinks recreated, ${skippedCount} entries skipped.`);

};
