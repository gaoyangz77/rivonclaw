/**
 * macOS vendor runtime extractor.
 *
 * On macOS, the vendor runtime ships as a single tar archive inside the .app
 * bundle to avoid EMFILE errors during code signing (33k+ exploded files).
 * This module extracts the archive to a user-data directory on first launch and
 * returns the extracted path for use as vendorDir.
 *
 * Extraction is idempotent: if the target directory already contains the
 * required runtime contract, extraction is skipped. Stale versions and
 * incomplete extractions (.extracting-* temp dirs) are cleaned up automatically.
 */

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { app } from "electron";

interface VendorRuntimeManifest {
  version: string;
  archiveFile: string;
  openclawVersion: string;
  archiveSizeBytes: number;
}

const ENTRY_FILE = "openclaw.mjs";
const REQUIRED_RUNTIME_FILES = [
  ENTRY_FILE,
  "package.json",
  "docs/reference/templates/AGENTS.md",
  "docs/reference/templates/BOOTSTRAP.md",
  "docs/reference/templates/SOUL.md",
  "docs/reference/templates/TOOLS.md",
  "dist/extensions/acpx/openclaw.plugin.json",
  "dist/extensions/memory-core/openclaw.plugin.json",
];

function missingRuntimeFiles(runtimeDir: string): string[] {
  return REQUIRED_RUNTIME_FILES.filter((relativePath) => {
    return !existsSync(join(runtimeDir, relativePath));
  });
}

/**
 * Ensures the vendor runtime is extracted and ready for use.
 *
 * @param archiveDir - Path to the directory containing vendor-runtime.tar
 *   and vendor-runtime-manifest.json (typically Contents/Resources/vendor/openclaw/).
 * @returns Absolute path to the extracted vendor runtime directory.
 */
export async function ensureVendorRuntime(archiveDir: string): Promise<string> {
  const manifestPath = join(archiveDir, "vendor-runtime-manifest.json");
  const manifest: VendorRuntimeManifest = JSON.parse(
    readFileSync(manifestPath, "utf-8"),
  );

  const runtimeBaseDir = join(app.getPath("userData"), "runtime");
  const targetDir = join(runtimeBaseDir, manifest.version, "openclaw");
  const entryPath = join(targetDir, ENTRY_FILE);

  // Idempotent: already extracted and complete.
  if (existsSync(entryPath)) {
    const missingFiles = missingRuntimeFiles(targetDir);
    if (missingFiles.length === 0) {
      console.log(
        `[vendor-runtime] Already extracted (version ${manifest.version}), skipping.`,
      );
      cleanupStaleVersions(runtimeBaseDir, manifest.version);
      return targetDir;
    }

    console.warn(
      `[vendor-runtime] Existing runtime ${manifest.version} is incomplete; ` +
        `missing ${missingFiles.join(", ")}. Re-extracting.`,
    );
    rmSync(join(runtimeBaseDir, manifest.version), { recursive: true, force: true });
  }

  // Extract
  const archivePath = join(archiveDir, manifest.archiveFile);
  if (!existsSync(archivePath)) {
    throw new Error(
      `[vendor-runtime] Archive not found: ${archivePath}`,
    );
  }

  console.log(
    `[vendor-runtime] Extracting vendor runtime (version ${manifest.version})...`,
  );
  const startMs = Date.now();

  // Extract to a temp directory first, then atomically rename to the final path.
  // This prevents a half-extracted directory from being used if the app crashes
  // or is killed mid-extraction.
  const tempDir = join(
    runtimeBaseDir,
    `.extracting-${manifest.version}-${Date.now()}`,
  );

  try {
    mkdirSync(tempDir, { recursive: true });

    const tarFlags = manifest.archiveFile.endsWith(".gz") ? "-xzf" : "-xf";
    execSync(`tar ${tarFlags} "${archivePath}" -C "${tempDir}"`, {
      timeout: 300_000,
    });

    // Verify the runtime contract was extracted.
    const tempMissingFiles = missingRuntimeFiles(tempDir);
    if (tempMissingFiles.length > 0) {
      throw new Error(
        `[vendor-runtime] Extraction failed: missing ${tempMissingFiles.join(", ")} in extracted archive.`,
      );
    }

    // Ensure parent of target exists
    const targetParent = join(runtimeBaseDir, manifest.version);
    mkdirSync(targetParent, { recursive: true });

    // Atomic rename to final location
    renameSync(tempDir, targetDir);
  } catch (err) {
    // Clean up temp dir on failure
    rmSync(tempDir, { recursive: true, force: true });
    throw err;
  }

  const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);
  const archiveSizeMB = (
    statSync(archivePath).size /
    1024 /
    1024
  ).toFixed(1);
  console.log(
    `[vendor-runtime] Extracted ${archiveSizeMB}MB archive in ${elapsedSec}s to ${targetDir}`,
  );

  cleanupStaleVersions(runtimeBaseDir, manifest.version);

  return targetDir;
}

/**
 * Removes stale version directories and incomplete .extracting-* temp dirs
 * from the runtime base directory.
 */
function cleanupStaleVersions(
  runtimeBaseDir: string,
  currentVersion: string,
): void {
  if (!existsSync(runtimeBaseDir)) return;

  let entries;
  try {
    entries = readdirSync(runtimeBaseDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    // Clean up incomplete extractions
    if (entry.name.startsWith(".extracting-")) {
      const fullPath = join(runtimeBaseDir, entry.name);
      console.log(
        `[vendor-runtime] Cleaning up stale temp dir: ${entry.name}`,
      );
      rmSync(fullPath, { recursive: true, force: true });
      continue;
    }

    // Clean up old version directories
    if (entry.isDirectory() && entry.name !== currentVersion) {
      const fullPath = join(runtimeBaseDir, entry.name);
      console.log(
        `[vendor-runtime] Cleaning up old version: ${entry.name}`,
      );
      rmSync(fullPath, { recursive: true, force: true });
    }
  }
}
