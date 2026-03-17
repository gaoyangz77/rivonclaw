import { spawn } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { createLogger } from "@easyclaw/logger";

const log = createLogger("runtime-hydrator");

export interface HydrateProgress {
  phase: "checking" | "extracting" | "verifying" | "ready" | "error";
  message: string;
  percent?: number; // 0-100 during extracting
}

export interface HydrateResult {
  runtimeDir: string; // absolute path to the ready runtime directory
  version: string;
  wasExtracted: boolean; // true if we did extraction, false if already existed
}

interface RuntimeManifest {
  sha256: string;
  version: string;
}

/**
 * Read and parse the runtime-manifest.json from a directory.
 * Returns null if the file doesn't exist or is malformed.
 * The manifest uses `sha256` as the content hash field (written by create-runtime-archive.cjs).
 */
function readManifest(dir: string): RuntimeManifest | null {
  const manifestPath = join(dir, "runtime-manifest.json");
  if (!existsSync(manifestPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
    if (typeof raw.sha256 !== "string" || typeof raw.version !== "string") return null;
    return { sha256: raw.sha256, version: raw.version };
  } catch {
    return null;
  }
}

/**
 * Fast synchronous check — returns the runtime dir path if already hydrated
 * and the sha256 matches the archive manifest. Returns null if extraction is needed.
 */
export function checkRuntimeReady(
  archiveDir: string,
  runtimeBaseDir: string,
): string | null {
  const sourceManifest = readManifest(archiveDir);
  if (!sourceManifest) {
    log.warn(`No valid runtime-manifest.json in archive dir: ${archiveDir}`);
    return null;
  }

  const runtimeDir = join(runtimeBaseDir, sourceManifest.sha256);
  const installedManifest = readManifest(runtimeDir);
  if (!installedManifest) return null;

  if (installedManifest.sha256 !== sourceManifest.sha256) return null;

  log.info(`Runtime already hydrated at ${runtimeDir} (v${installedManifest.version})`);
  return runtimeDir;
}

/**
 * Run tar extraction asynchronously, polling the output directory size
 * to report real progress. Returns a promise that resolves when tar exits.
 */
/**
 * Count top-level entries in a directory (fast, cross-platform).
 * Returns 0 if the directory doesn't exist or can't be read.
 */
function countTopLevelEntries(dir: string): number {
  try {
    return readdirSync(dir).length;
  } catch {
    return 0;
  }
}

/**
 * Run tar extraction asynchronously, polling the output directory for
 * newly created entries to report real progress. Pure Node.js — no
 * platform-specific commands like `du`.
 */
function extractWithProgress(
  archivePath: string,
  extractDir: string,
  report: (progress: HydrateProgress) => void,
): Promise<void> {
  // The runtime archive contains ~800 top-level entries after --strip-components=1
  // (dist/, node_modules/, extensions/, openclaw.mjs, etc. with node_modules
  // being the bulk). We use this as the denominator for progress estimation.
  // Overestimating is fine — the bar just won't quite reach 90% before completion.
  const ESTIMATED_ENTRY_COUNT = 900;

  return new Promise<void>((resolve, reject) => {
    const child = spawn("tar", ["xzf", archivePath, "--strip-components=1", "-C", extractDir], {
      stdio: "pipe",
    });

    // Poll every 2 seconds: count top-level entries in extractDir as progress
    const pollInterval = setInterval(() => {
      const count = countTopLevelEntries(extractDir);
      // Map to 5%-90% range (reserve 0-5% for prep, 90-100% for verify)
      const rawPercent = Math.min(count / ESTIMATED_ENTRY_COUNT, 1);
      const percent = Math.round(5 + rawPercent * 85);
      report({ phase: "extracting", message: "extracting", percent });
    }, 2_000);

    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      child.kill("SIGTERM");
      reject(new Error("Archive extraction timed out (5 minutes)"));
    }, 300_000);

    child.on("close", (code) => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`tar exited with code ${code}`));
      }
    });

    child.on("error", (err) => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Extract the runtime archive and set up the runtime directory.
 *
 * - Reads runtime-manifest.json from archiveDir for hash + version
 * - Checks if {runtimeBaseDir}/{hash}/runtime-manifest.json exists and matches (fast path)
 * - If not: extracts openclaw-runtime.tar.gz to {hash}.extracting/, verifies, atomic renames
 * - Cleans up old versions and stale .extracting directories
 * - Reports progress via onProgress callback
 *
 * Safe against concurrent runs: uses .extracting suffix as a lock indicator;
 * stale .extracting dirs from interrupted attempts are cleaned up on next run.
 */
export async function hydrateRuntime(opts: {
  archiveDir: string;
  runtimeBaseDir: string;
  onProgress?: (progress: HydrateProgress) => void;
}): Promise<HydrateResult> {
  const { archiveDir, runtimeBaseDir, onProgress } = opts;

  const report = (progress: HydrateProgress): void => {
    log.debug(`[hydrate] ${progress.phase}: ${progress.message}`);
    onProgress?.(progress);
  };

  // ── Phase: checking ──
  report({ phase: "checking", message: "Reading runtime manifest..." });

  const sourceManifest = readManifest(archiveDir);
  if (!sourceManifest) {
    const msg = `No valid runtime-manifest.json found in ${archiveDir}`;
    report({ phase: "error", message: msg });
    throw new Error(msg);
  }

  const { sha256, version } = sourceManifest;
  const runtimeDir = join(runtimeBaseDir, sha256);
  const extractDir = join(runtimeBaseDir, `${sha256}.extracting`);

  // Fast path: already hydrated
  const installedManifest = readManifest(runtimeDir);
  if (installedManifest && installedManifest.sha256 === sha256) {
    report({ phase: "ready", message: `Runtime v${version} already available` });
    cleanupOldRuntimes(runtimeBaseDir, sha256);
    return { runtimeDir, version, wasExtracted: false };
  }

  // ── Phase: extracting ──
  const archivePath = join(archiveDir, "openclaw-runtime.tar.gz");
  if (!existsSync(archivePath)) {
    const msg = `Runtime archive not found: ${archivePath}`;
    report({ phase: "error", message: msg });
    throw new Error(msg);
  }

  report({ phase: "extracting", message: "Preparing extraction...", percent: 0 });

  // Clean up any stale extraction directory from a previous interrupted attempt
  if (existsSync(extractDir)) {
    log.info(`Removing stale extraction directory: ${extractDir}`);
    rmSync(extractDir, { recursive: true, force: true });
  }

  mkdirSync(extractDir, { recursive: true });

  report({ phase: "extracting", message: "Extracting runtime archive...", percent: 5 });

  try {
    // Async extraction with real progress polling (not execSync which blocks
    // the event loop and prevents the bootstrap window from rendering).
    await extractWithProgress(archivePath, extractDir, report);
  } catch (err) {
    // Clean up failed extraction
    rmSync(extractDir, { recursive: true, force: true });
    const msg = `Archive extraction failed: ${err instanceof Error ? err.message : String(err)}`;
    report({ phase: "error", message: msg });
    throw new Error(msg);
  }

  report({ phase: "extracting", message: "Extraction complete", percent: 92 });

  // ── Phase: verifying ──
  report({ phase: "verifying", message: "Verifying extracted runtime..." });

  // Copy the external manifest (with real SHA-256) into the extracted directory.
  // The archive only contains a placeholder manifest (hash unknown at archive time).
  // The real manifest lives alongside the archive and is the source of truth.
  const externalManifestPath = join(archiveDir, "runtime-manifest.json");
  const extractedManifestPath = join(extractDir, "runtime-manifest.json");
  try {
    copyFileSync(externalManifestPath, extractedManifestPath);
  } catch (err) {
    rmSync(extractDir, { recursive: true, force: true });
    const msg = `Failed to copy manifest into runtime dir: ${err instanceof Error ? err.message : String(err)}`;
    report({ phase: "error", message: msg });
    throw new Error(msg);
  }

  const extractedManifest = readManifest(extractDir);
  if (!extractedManifest || extractedManifest.sha256 !== sha256) {
    rmSync(extractDir, { recursive: true, force: true });
    const msg = extractedManifest
      ? `Manifest hash mismatch: expected ${sha256}, got ${extractedManifest.sha256}`
      : "Extracted runtime is missing valid runtime-manifest.json";
    report({ phase: "error", message: msg });
    throw new Error(msg);
  }

  // Verify the entry point exists
  const entryPath = join(extractDir, "openclaw.mjs");
  if (!existsSync(entryPath)) {
    rmSync(extractDir, { recursive: true, force: true });
    const msg = "Extracted runtime is missing openclaw.mjs entry point";
    report({ phase: "error", message: msg });
    throw new Error(msg);
  }

  report({ phase: "extracting", message: "Finalizing...", percent: 97 });

  // ── Atomic rename ──
  // If the target directory appeared while we were extracting (concurrent run),
  // the other instance won the race — use its result.
  if (existsSync(runtimeDir)) {
    const concurrentManifest = readManifest(runtimeDir);
    if (concurrentManifest && concurrentManifest.sha256 === sha256) {
      log.info("Another instance completed extraction concurrently, using its result");
      rmSync(extractDir, { recursive: true, force: true });
      report({ phase: "ready", message: `Runtime v${version} ready` });
      cleanupOldRuntimes(runtimeBaseDir, sha256);
      return { runtimeDir, version, wasExtracted: true };
    }
    // Stale directory with wrong hash — remove it
    rmSync(runtimeDir, { recursive: true, force: true });
  }

  try {
    renameSync(extractDir, runtimeDir);
  } catch (err) {
    // rename can fail cross-device; this shouldn't happen since both paths
    // are under runtimeBaseDir, but handle it defensively
    const msg = `Failed to finalize runtime directory: ${err instanceof Error ? err.message : String(err)}`;
    report({ phase: "error", message: msg });
    throw new Error(msg);
  }

  log.info(`Runtime v${version} hydrated at ${runtimeDir}`);
  report({ phase: "ready", message: `Runtime v${version} ready`, percent: 100 });

  // ── Cleanup ──
  cleanupOldRuntimes(runtimeBaseDir, sha256);

  return { runtimeDir, version, wasExtracted: true };
}

/**
 * Remove old runtime versions and stale .extracting directories.
 * Keeps only the directory matching the current hash.
 */
function cleanupOldRuntimes(runtimeBaseDir: string, currentHash: string): void {
  if (!existsSync(runtimeBaseDir)) return;

  let entries: string[];
  try {
    entries = readdirSync(runtimeBaseDir);
  } catch {
    return;
  }

  for (const entry of entries) {
    // Keep the current version
    if (entry === currentHash) continue;

    const fullPath = join(runtimeBaseDir, entry);
    try {
      rmSync(fullPath, { recursive: true, force: true });
      log.info(`Cleaned up old runtime: ${entry}`);
    } catch (err) {
      log.warn(`Failed to clean up ${fullPath}:`, err);
    }
  }
}
