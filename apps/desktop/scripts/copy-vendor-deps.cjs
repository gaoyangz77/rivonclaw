// @ts-check
// afterPack hook for electron-builder — copies vendor/openclaw/node_modules
// into the packaged app's extraResources.
//
// electron-builder respects .gitignore files (including the root one that has
// "node_modules/"), which silently blocks node_modules from extraResources copy.
// This hook works around that by copying node_modules manually after packing.

const fs = require("fs");
const path = require("path");
const { compileMerchantBytecode } = require("./compile-merchant-bytecode.cjs");

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

  const vendorDest = path.join(resourcesDir, "vendor", "openclaw", "node_modules");
  const vendorSrc = path.resolve(__dirname, "..", "..", "..", "vendor", "openclaw", "node_modules");

  if (!fs.existsSync(vendorSrc)) {
    console.log(`[copy-vendor-deps] vendor/openclaw/node_modules not found at ${vendorSrc}, skipping.`);
    // Still run bytecode compilation
    await compileMerchantBytecode(context, resourcesDir);
    return;
  }

  if (fs.existsSync(vendorDest)) {
    console.log("[copy-vendor-deps] vendor/openclaw/node_modules already present, skipping.");
    await compileMerchantBytecode(context, resourcesDir);
    return;
  }

  console.log(`[copy-vendor-deps] Copying vendor node_modules...`);
  console.log(`  from: ${vendorSrc}`);
  console.log(`  to:   ${vendorDest}`);

  // Native binaries (.node, .dylib) that break macOS universal merge.
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

  // Compile merchant extensions to V8 bytecode
  await compileMerchantBytecode(context, resourcesDir);
};
