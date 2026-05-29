// @ts-check
// Build-time script: creates a tar.gz archive of vendor/openclaw for macOS
// distribution. On macOS (or when ARCHIVE_VENDOR_RUNTIME=1), this replaces the
// 33k+ exploded files with a single archive that is extracted on first launch.
//
// Must run AFTER prune-vendor-deps.cjs (so node_modules is production-only)
// and BEFORE electron-builder (so the archive is available for extraResources).

const { execSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const isMacOS = process.platform === "darwin";
const forceArchive = process.env.ARCHIVE_VENDOR_RUNTIME === "1";

if (!isMacOS && !forceArchive) {
  // Not macOS and not explicitly requested — nothing to do.
  process.exit(0);
}

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const vendorDir = path.resolve(repoRoot, "vendor", "openclaw");
const archiveFile = "vendor-runtime.tar.gz";
const archivePath = path.join(vendorDir, archiveFile);
const manifestPath = path.join(vendorDir, "vendor-runtime-manifest.json");

if (!fs.existsSync(vendorDir)) {
  console.error("[archive-vendor-runtime] vendor/openclaw not found, aborting.");
  process.exit(1);
}

// ─── Compute version key ───
// SHA256 of (.openclaw-version + sorted patch contents + prune script content),
// truncated to 12 hex chars. This ensures the archive is invalidated when the
// vendor version, patches, or pruning logic changes.

const hash = crypto.createHash("sha256");

// 1. .openclaw-version
const openclawVersionPath = path.join(repoRoot, ".openclaw-version");
const openclawVersion = fs.readFileSync(openclawVersionPath, "utf-8").trim();
hash.update(openclawVersion);

// 2. Sorted patch contents
const patchDir = path.join(repoRoot, "vendor-patches", "openclaw");
if (fs.existsSync(patchDir)) {
  const patches = fs.readdirSync(patchDir)
    .filter((f) => f.endsWith(".patch"))
    .sort();
  for (const p of patches) {
    hash.update(fs.readFileSync(path.join(patchDir, p)));
  }
}

// 3. Build scripts that define the archive contents
for (const scriptName of ["prune-vendor-deps.cjs", "archive-vendor-runtime.cjs"]) {
  const scriptPath = path.join(__dirname, scriptName);
  if (fs.existsSync(scriptPath)) {
    hash.update(scriptName);
    hash.update(fs.readFileSync(scriptPath));
  }
}

const version = hash.digest("hex").slice(0, 12);
console.log(`[archive-vendor-runtime] Version key: ${version}`);

// ─── Create tar.gz archive ───
// Explicit include list: only runtime-required payload. This avoids shipping
// .git (455MB), .github, CI configs, and other repo metadata.
const RUNTIME_INCLUDES = [
  "openclaw.mjs",
  "package.json",
  "docs/reference/templates",
  "dist",
  "dist-runtime",
  "extensions",
  "node_modules",
];

// Verify at least the entry point exists before archiving
if (!fs.existsSync(path.join(vendorDir, "openclaw.mjs"))) {
  console.error("[archive-vendor-runtime] FAIL: vendor/openclaw/openclaw.mjs not found. Is vendor set up?");
  process.exit(1);
}

function shellQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function findDeveloperIdIdentity() {
  try {
    const keychainArg = process.env.MACOS_KEYCHAIN_PATH
      ? ` ${shellQuote(process.env.MACOS_KEYCHAIN_PATH)}`
      : "";
    const output = execSync(`security find-identity -v -p codesigning${keychainArg}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const match = output.match(/"([^"]*Developer ID Application:[^"]+)"/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function listMachOBinaries(rootDir) {
  const files = [];
  const stack = [rootDir];
  const nativeExtensions = new Set([".bare", ".bundle", ".dylib", ".node", ".so"]);

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;

      const extension = path.extname(entry.name);
      if (nativeExtensions.has(extension)) {
        files.push(fullPath);
        continue;
      }

      try {
        const mode = fs.statSync(fullPath).mode;
        if ((mode & 0o111) !== 0) {
          files.push(fullPath);
        }
      } catch {
        // Non-readable files are ignored; tar validation below still catches
        // missing runtime payloads.
      }
    }
  }

  console.log(`[archive-vendor-runtime] Checking ${files.length} native binary candidate files...`);

  const machoFiles = [];
  for (const file of files) {
    try {
      const description = execSync(`file -b ${shellQuote(file)}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 10_000,
      });
      if (description.includes("Mach-O")) {
        machoFiles.push(file);
      }
    } catch {
      // Non-readable files are ignored; tar validation below still catches
      // missing runtime payloads.
    }
  }

  return machoFiles;
}

function signMacOSRuntimeBinaries(machoFiles) {
  if (!isMacOS) return false;

  if (machoFiles.length === 0) {
    console.log("[archive-vendor-runtime] No vendor Mach-O binaries found to sign.");
    return false;
  }

  if (process.env.RIVONCLAW_REQUIRE_NO_VENDOR_MACHO === "1") {
    console.error(`[archive-vendor-runtime] FAIL: Found ${machoFiles.length} vendor Mach-O binaries after pruning:`);
    for (const file of machoFiles) {
      console.error(`[archive-vendor-runtime]   ${path.relative(vendorDir, file)}`);
    }
    console.error("[archive-vendor-runtime] Prune these native runtime files instead of signing them inside vendor-runtime.tar.gz.");
    process.exit(1);
  }

  const identity = process.env.CSC_NAME || findDeveloperIdIdentity();
  if (!identity) {
    console.warn("[archive-vendor-runtime] No Developer ID identity found; skipping vendor Mach-O signing and verification.");
    return false;
  }

  console.log(`[archive-vendor-runtime] Signing ${machoFiles.length} vendor Mach-O binaries with ${identity}...`);
  const keychainArgs = process.env.MACOS_KEYCHAIN_PATH
    ? ["--keychain", shellQuote(process.env.MACOS_KEYCHAIN_PATH)]
    : [];
  machoFiles.forEach((file, index) => {
    const relative = path.relative(vendorDir, file);
    console.log(`[archive-vendor-runtime] Signing ${index + 1}/${machoFiles.length}: ${relative}`);
    execSync(
      [
        "codesign",
        "--force",
        "--options", "runtime",
        "--timestamp",
        ...keychainArgs,
        "--sign", shellQuote(identity),
        shellQuote(file),
      ].join(" "),
      { stdio: "inherit", timeout: 120_000 },
    );
  });
  console.log("[archive-vendor-runtime] Vendor Mach-O signing complete.");
  return true;
}

function verifyMacOSRuntimeBinaries(machoFiles) {
  if (!isMacOS) return;

  if (machoFiles.length === 0) {
    console.log("[archive-vendor-runtime] No vendor Mach-O binaries to verify.");
    return;
  }

  console.log(`[archive-vendor-runtime] Verifying ${machoFiles.length} signed vendor Mach-O binaries...`);
  for (const file of machoFiles) {
    try {
      execSync(`codesign --verify --strict --verbose=2 ${shellQuote(file)}`, {
        stdio: ["ignore", "ignore", "pipe"],
        timeout: 30_000,
      });
    } catch (err) {
      console.error(`[archive-vendor-runtime] FAIL: unsigned or invalid Mach-O: ${path.relative(vendorDir, file)}`);
      if (err && typeof err === "object" && "stderr" in err && err.stderr) {
        console.error(String(err.stderr));
      }
      process.exit(1);
    }
  }
  console.log("[archive-vendor-runtime] Vendor Mach-O verification complete.");
}

const macOSRuntimeMachOBinaries = isMacOS ? listMachOBinaries(vendorDir) : [];

if (process.env.SKIP_VENDOR_RUNTIME_SIGNING === "1") {
  console.log("[archive-vendor-runtime] SKIP_VENDOR_RUNTIME_SIGNING=1; skipping vendor Mach-O signing and verification.");
} else {
  const didSignMacOSRuntimeBinaries = signMacOSRuntimeBinaries(macOSRuntimeMachOBinaries);
  if (didSignMacOSRuntimeBinaries) {
    verifyMacOSRuntimeBinaries(macOSRuntimeMachOBinaries);
  }
}

// Build the include arguments — only add paths that actually exist
const includeArgs = RUNTIME_INCLUDES
  .filter((p) => fs.existsSync(path.join(vendorDir, p)))
  .map((p) => shellQuote(p))
  .join(" ");

console.log(`[archive-vendor-runtime] Creating archive at ${archivePath}...`);
const startMs = Date.now();

execSync(
  `tar -czf ${shellQuote(archivePath)} -C ${shellQuote(vendorDir)} ${includeArgs}`,
  { stdio: "inherit", timeout: 300_000 },
);

const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);
console.log(`[archive-vendor-runtime] Archive created in ${elapsedSec}s`);

// ─── Validate archive ───
const archiveStats = fs.statSync(archivePath);
const archiveSizeBytes = archiveStats.size;
const archiveSizeMB = (archiveSizeBytes / 1024 / 1024).toFixed(1);

if (archiveSizeBytes < 1024 * 1024) {
  console.error(`[archive-vendor-runtime] FAIL: Archive is only ${archiveSizeBytes} bytes (< 1MB). Something is wrong.`);
  process.exit(1);
}

console.log(`[archive-vendor-runtime] Archive size: ${archiveSizeMB}MB`);

// Verify entry point exists in archive (use grep to avoid buffering the full listing)
try {
  execSync(`tar -tzf ${shellQuote(archivePath)} | grep -q "openclaw\\.mjs"`, {
    timeout: 60_000,
  });
} catch (err) {
  console.error("[archive-vendor-runtime] FAIL: openclaw.mjs not found in archive.");
  process.exit(1);
}

console.log("[archive-vendor-runtime] Archive verification passed (openclaw.mjs found).");

for (const requiredPath of [
  "docs/reference/templates/AGENTS.md",
  "docs/reference/templates/SOUL.md",
  "docs/reference/templates/TOOLS.md",
]) {
  try {
    execSync(`tar -tzf ${shellQuote(archivePath)} | grep -q ${shellQuote(`^${requiredPath}$`)}`, {
      timeout: 60_000,
    });
  } catch {
    console.error(`[archive-vendor-runtime] FAIL: ${requiredPath} not found in archive.`);
    process.exit(1);
  }
}
console.log("[archive-vendor-runtime] Archive verification passed (workspace templates found).");

// ─── Write manifest ───
const manifest = {
  version,
  archiveFile,
  openclawVersion,
  archiveSizeBytes,
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
console.log(`[archive-vendor-runtime] Manifest written: ${JSON.stringify(manifest)}`);
