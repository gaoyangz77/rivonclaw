// @ts-check
//
// Resolves the exact pnpm release that the vendored OpenClaw checkout declares
// in its own `packageManager` field, installing it OUTSIDE the vendor tree and
// returning an absolute path to the binary.
//
// Why outside the vendor tree: `vendor/openclaw/.npmrc` sets `min-release-age`,
// a supply-chain cooldown that npm >= 11 enforces while resolving packages. npm
// picks up that setting from the nearest project directory, so any
// `npx --yes pnpm@<version>` run from inside the vendor checkout applies the
// cooldown to the package manager itself and fails with "No matching version
// found for pnpm@<version> with a date before <cutoff>" whenever the vendor
// pins a pnpm newer than the cooldown window.
//
// That is the wrong policy for this one package. The cooldown decides which
// *dependency* versions we are willing to adopt; the pnpm version is not a
// choice we make at all — it comes from the vendor's own manifest, and the
// vendor lockfile can only be installed by that exact release. Installing it
// into <repoRoot>/tmp/vendor-pnpm/<version> keeps the cooldown fully in force
// for the vendor's dependency install (which still runs with the vendor
// directory as cwd) while letting the pinned package manager be fetched under
// the repo's own npm config.
//
// Usage:
//   const { resolveVendorPnpmBinary } = require("<repo>/scripts/vendor-pnpm.cjs");
//   node scripts/vendor-pnpm.cjs <vendorDir>   # prints the binary path

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const IS_WINDOWS = process.platform === "win32";

/**
 * Read the pnpm version pinned by a vendor checkout's `packageManager` field.
 *
 * @param {string} vendorDir Directory containing the vendor `package.json`.
 * @returns {string} The bare semver, with any Corepack integrity hash stripped.
 */
function readVendorPnpmVersion(vendorDir) {
  const manifestPath = path.join(vendorDir, "package.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const packageManager = typeof manifest.packageManager === "string" ? manifest.packageManager : "";
  const match = /^pnpm@([^+\s]+)(?:\+.*)?$/u.exec(packageManager);
  if (!match) {
    throw new Error(
      `Vendor package.json must declare packageManager=pnpm@<version>: ${manifestPath}`,
    );
  }
  return match[1];
}

/**
 * Install one pnpm release into its own cache directory with plain npm.
 *
 * @param {{ cacheDir: string, spec: string }} args
 */
function installWithNpm({ cacheDir, spec }) {
  execFileSync(
    IS_WINDOWS ? "npm.cmd" : "npm",
    ["install", "--no-audit", "--no-fund", "--no-package-lock", "--loglevel=error", spec],
    {
      cwd: cacheDir,
      // npm writes its install summary to stdout. This module's stdout is the
      // resolved binary path and nothing else, because callers capture it with
      // `$(...)`, so route npm's progress to stderr. stdin is closed: a prompt
      // here would hang an unattended CI install.
      stdio: ["ignore", 2, 2],
    },
  );
}

/**
 * Resolve (installing on first use) the pnpm binary pinned by a vendor checkout.
 *
 * @param {string} vendorDir Directory containing the vendor `package.json`.
 * @param {{
 *   repoRoot?: string,
 *   cacheRoot?: string,
 *   install?: (args: { cacheDir: string, spec: string, version: string }) => void,
 * }} [options]
 * @returns {string} Absolute path to the pnpm binary.
 */
function resolveVendorPnpmBinary(vendorDir, options = {}) {
  const version = readVendorPnpmVersion(vendorDir);
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const cacheRoot = options.cacheRoot ?? path.join(repoRoot, "tmp", "vendor-pnpm");
  const cacheDir = path.join(cacheRoot, version);
  const binary = path.join(cacheDir, "node_modules", ".bin", IS_WINDOWS ? "pnpm.cmd" : "pnpm");

  if (fs.existsSync(binary)) return binary;

  fs.mkdirSync(cacheDir, { recursive: true });
  // Anchor npm's local prefix here. Without a manifest npm walks up to the
  // nearest ancestor package.json — the repo root — and would install pnpm
  // into the workspace's own node_modules instead of this cache directory.
  const manifestPath = path.join(cacheDir, "package.json");
  if (!fs.existsSync(manifestPath)) {
    fs.writeFileSync(
      manifestPath,
      `${JSON.stringify({ name: "rivonclaw-vendor-pnpm", version: "0.0.0", private: true }, null, 2)}\n`,
    );
  }

  const spec = `pnpm@${version}`;
  process.stderr.write(`Installing ${spec} into ${cacheDir}\n`);
  (options.install ?? installWithNpm)({ cacheDir, spec, version });

  if (!fs.existsSync(binary)) {
    throw new Error(`Installing ${spec} did not produce ${binary}`);
  }
  return binary;
}

module.exports = { readVendorPnpmVersion, resolveVendorPnpmBinary };

if (require.main === module) {
  const vendorDirArg = process.argv[2];
  if (!vendorDirArg) {
    process.stderr.write("Usage: node scripts/vendor-pnpm.cjs <vendorDir>\n");
    process.exit(1);
  }
  process.stdout.write(`${resolveVendorPnpmBinary(path.resolve(vendorDirArg))}\n`);
}
