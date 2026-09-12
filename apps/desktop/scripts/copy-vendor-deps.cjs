// @ts-check
// afterPack hook for electron-builder — copies vendor/openclaw/node_modules
// into the packaged app's extraResources.
//
// electron-builder respects .gitignore files (including the root one that has
// "node_modules/"), which silently blocks node_modules from extraResources copy.
// This hook works around that by copying node_modules manually after packing.

const fs = require("fs");
const path = require("path");
const { selectedPluginDirs, assertSelectedPluginDependencies } = require("./vendor-plugin-dependencies.cjs");
const { packageExternalPlugins } = require("./package-external-plugins.cjs");
const { deduplicateMirroredPluginDependencies, deduplicateRuntimeDependencies } = require("./vendor-plugin-size.cjs");

function shouldCopyVendorNative(file) {
  if (![".node", ".dylib"].includes(path.extname(file))) return true;
  return /[\\/]@img[\\/]sharp-/.test(file) || /[\\/]koffi[\\/]/.test(file) ||
    /[\\/]@koromix[\\/]koffi-win32-/.test(file) ||
    /[\\/]@snazzah[\\/]davey-/.test(file) ||
    /[\\/]fs-safe-(?:darwin|linux|win32)-[^\\/]+[\\/]/.test(file) ||
    /[\\/]sqlite-vec-[^\\/]+[\\/]/.test(file);
}

function copySelectedPluginDependencies(vendorSrcDir, vendorDestDir) {
  for (const pluginDir of selectedPluginDirs(vendorSrcDir)) {
    const source = path.join(pluginDir, "node_modules");
    if (!fs.existsSync(source)) continue;
    const destination = path.join(vendorDestDir, path.relative(vendorSrcDir, source));
    fs.rmSync(destination, { recursive: true, force: true });
    fs.cpSync(source, destination, {
      recursive: true,
      filter: (file) => ![".git", ".bin"].includes(path.basename(file)) && shouldCopyVendorNative(file),
    });
  }
  assertSelectedPluginDependencies(vendorDestDir);
  // fs.cpSync does not preserve hardlinks. Re-establish sharing in Windows
  // and Linux resources without linking any packaged file back to the checkout.
  deduplicateMirroredPluginDependencies(vendorDestDir);
  deduplicateRuntimeDependencies(vendorDestDir);
}

function verifyPackagedRuntime(context, resourcesDir) {
  const arch = require("node:module").createRequire(require.resolve("electron-builder"))("builder-util").Arch[context.arch];
  if (context.electronPlatformName !== process.platform || arch !== process.arch) {
    console.log("[copy-vendor-deps] Cross-target runtime contract must run on the target host; not executed here.");
    return;
  }
  const product = context.packager.appInfo.productFilename;
  const runtime = context.electronPlatformName === "darwin"
    ? path.join(context.appOutDir, `${product}.app`, "Contents", "MacOS", product)
    : path.join(context.appOutDir, context.electronPlatformName === "win32" ? `${product}.exe` : context.packager.executableName);
  const vendor = path.join(resourcesDir, "vendor", "openclaw");
  const args = context.electronPlatformName === "darwin"
    ? ["--archive", path.join(vendor, "vendor-runtime.tar")]
    : ["--vendor", vendor];
  require("node:child_process").execFileSync(process.execPath, [
    path.join(__dirname, "verify-vendor-runtime-contract.cjs"), ...args, "--runtime", runtime, "--resources", resourcesDir,
  ], { stdio: "inherit", timeout: 600_000 });
}


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

  packageExternalPlugins(resourcesDir, path.resolve(__dirname, "../../.."), {
    platform: electronPlatformName,
    arch: require("node:module").createRequire(require.resolve("electron-builder"))("builder-util").Arch[context.arch],
  });

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
    verifyPackagedRuntime(context, resourcesDir);
    return;
  }

  // ─── Windows / Linux: copy node_modules as before ───
  const vendorDest = path.join(resourcesDir, "vendor", "openclaw", "node_modules");
  const vendorSrc = path.resolve(__dirname, "..", "..", "..", "vendor", "openclaw", "node_modules");

  if (!fs.existsSync(vendorSrc)) {
    console.log(`[copy-vendor-deps] vendor/openclaw/node_modules not found at ${vendorSrc}, skipping.`);
    return;
  }

  // Refresh even when extraResources left a partial tree behind.
  fs.rmSync(vendorDest, { recursive: true, force: true });

  console.log(`[copy-vendor-deps] Copying vendor node_modules...`);
  console.log(`  from: ${vendorSrc}`);
  console.log(`  to:   ${vendorDest}`);

  // Native binaries (.node, .dylib) that are architecture-specific.
  // Exception: sharp/koffi/davey are required at runtime.
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
      if (!shouldCopyVendorNative(src)) {
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
  copySelectedPluginDependencies(path.dirname(vendorSrc), path.dirname(vendorDest));
  verifyPackagedRuntime(context, resourcesDir);
};

exports.shouldCopyVendorNative = shouldCopyVendorNative;
exports.copySelectedPluginDependencies = copySelectedPluginDependencies;
