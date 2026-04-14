// @ts-check
// Build-time wrapper that pre-warms the V8 compile cache for the OpenClaw
// gateway. Spawns the gateway once via compile-cache-warmup.cjs so the
// resulting cache blobs ship inside the packaged app. The launcher seeds
// the user's writable state dir from this shipped cache on first launch,
// saving ~3-4 seconds of parse+compile time.
//
// Must run BEFORE prune-vendor-deps.cjs (pruning removes dev deps the
// gateway needs during warmup).
//
// All exit paths return 0 — compile cache is best-effort, non-blocking.

"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TAG = "[warmup-compile-cache]";

// ── Resolve paths ──

const scriptDir = __dirname;
const desktopDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(desktopDir, "..", "..");
const vendorDir = path.resolve(repoRoot, "vendor", "openclaw");

let electronPath;
try {
  electronPath = require("electron");
  if (typeof electronPath !== "string") {
    throw new Error("require('electron') did not return a path string");
  }
} catch (err) {
  console.warn(`${TAG} Could not resolve Electron binary: ${err.message}`);
  console.warn(`${TAG} Skipping compile cache warmup.`);
  process.exit(0);
}

const openclawMjs = path.resolve(vendorDir, "openclaw.mjs");
if (!fs.existsSync(openclawMjs)) {
  console.warn(`${TAG} vendor/openclaw/openclaw.mjs not found, skipping.`);
  process.exit(0);
}

const compileCacheDir = path.join(vendorDir, "dist", "compile-cache");
const warmupScript = path.join(scriptDir, "compile-cache-warmup.cjs");
if (!fs.existsSync(warmupScript)) {
  console.warn(`${TAG} compile-cache-warmup.cjs not found, skipping.`);
  process.exit(0);
}

// ── Resolve startup-timer preload ──

let startupTimerPath;
const candidates = [
  path.resolve(repoRoot, "packages", "gateway", "dist", "startup-timer.cjs"),
  path.resolve(repoRoot, "packages", "gateway", "src", "startup-timer.cjs"),
];
for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    startupTimerPath = candidate;
    break;
  }
}

// ── Create temp directory with minimal gateway config ──

const tmpDir = path.join(os.tmpdir(), `rivonclaw-compile-cache-warmup-${process.pid}`);

function cleanup() {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}

try {
  fs.mkdirSync(tmpDir, { recursive: true });

  const configPath = path.join(tmpDir, "openclaw.json");
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      { gateway: { port: 0, auth: { mode: "none" } } },
      null,
      2,
    ),
    "utf-8",
  );

  // ── Build environment ──

  const bundledPluginsDir = path.join(vendorDir, "dist-runtime", "extensions");

  const childEnv = Object.assign({}, process.env, {
    OPENCLAW_CONFIG_PATH: configPath,
    OPENCLAW_STATE_DIR: tmpDir,
    OPENCLAW_BUNDLED_PLUGINS_DIR: fs.existsSync(bundledPluginsDir)
      ? bundledPluginsDir
      : "",
    NODE_COMPILE_CACHE: compileCacheDir,
    OPENCLAW_SKIP_BROWSER_CONTROL_SERVER: "1",
    OPENCLAW_NO_RESPAWN: "1",
    OPENCLAW_DISABLE_BONJOUR: "1",
  });

  // ── Ensure compile-cache output directory exists ──

  fs.mkdirSync(compileCacheDir, { recursive: true });

  // ── Spawn the warmup ──

  console.log(`${TAG} Starting compile cache warmup...`);

  const args = [warmupScript, electronPath, openclawMjs];
  if (startupTimerPath) {
    args.push("--startup-timer", startupTimerPath);
  }

  execFileSync(process.execPath, args, {
    cwd: desktopDir,
    env: childEnv,
    stdio: "inherit",
    timeout: 90_000,
  });

  // ── Write .version marker ──

  const pkgJson = JSON.parse(
    fs.readFileSync(path.join(desktopDir, "package.json"), "utf-8"),
  );
  const version = pkgJson.version || "unknown";
  fs.writeFileSync(
    path.join(compileCacheDir, ".version"),
    version + "\n",
    "utf-8",
  );

  // ── Count cache entries ──

  let entryCount = 0;
  try {
    const entries = fs.readdirSync(compileCacheDir);
    entryCount = entries.filter((e) => e !== ".version").length;
  } catch {}

  console.log(
    `${TAG} Compile cache warmed successfully (${entryCount} entries, version ${version})`,
  );
} catch (err) {
  console.warn(
    `${TAG} Warmup failed (non-fatal): ${err instanceof Error ? err.message : err}`,
  );
} finally {
  cleanup();
}

process.exit(0);
