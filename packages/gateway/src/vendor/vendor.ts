import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Relative path from this source file (packages/gateway/src/) to the vendor directory.
 * After build (packages/gateway/dist/), the same relative path applies since
 * both src/ and dist/ are one level below packages/gateway/.
 */
const VENDOR_RELATIVE_PATH = "../../../vendor/openclaw";
const VENDOR_ENTRY_FILE = "openclaw.mjs";
const VENDOR_PACKAGE_JSON = "package.json";

/**
 * Resolves the absolute path to the vendored OpenClaw directory.
 *
 * Accepts an optional override for testing or non-standard layouts.
 * By default, resolves relative to this file location using import.meta.url.
 */
export function resolveVendorDir(vendorDir?: string): string {
  if (vendorDir) {
    return resolve(vendorDir);
  }
  const thisDir = fileURLToPath(new URL(".", import.meta.url));
  return resolve(thisDir, VENDOR_RELATIVE_PATH);
}

/**
 * Resolves the absolute path to the vendored OpenClaw entry point (openclaw.mjs).
 */
export function resolveVendorEntryPath(vendorDir?: string): string {
  return join(resolveVendorDir(vendorDir), VENDOR_ENTRY_FILE);
}

/**
 * Reads the version string from the vendored OpenClaw package.json.
 *
 * This is the authoritative source for which OpenClaw version is pinned.
 */
export function resolveVendorVersion(vendorDir?: string): string {
  const pkgPath = join(resolveVendorDir(vendorDir), VENDOR_PACKAGE_JSON);
  if (!existsSync(pkgPath)) {
    throw new Error(
      `OpenClaw vendor package.json not found at: ${pkgPath}. Ensure the vendor submodule is initialized.`,
    );
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };
  return pkg.version;
}

/**
 * Asserts that the vendored OpenClaw entry point exists on disk.
 *
 * Throws a descriptive error if the vendor directory or entry file is missing,
 * guiding the user to initialize the submodule.
 */
export function assertVendorExists(vendorDir?: string): void {
  const dir = resolveVendorDir(vendorDir);
  if (!existsSync(dir)) {
    throw new Error(
      `OpenClaw vendor directory not found at: ${dir}. Run "git submodule update --init" to initialize.`,
    );
  }
  const entryPath = resolveVendorEntryPath(vendorDir);
  if (!existsSync(entryPath)) {
    throw new Error(
      `OpenClaw vendor entry not found at: ${entryPath}. The vendor directory exists but the entry file is missing. Ensure the submodule is at the correct commit.`,
    );
  }
}

/**
 * Returns the gateway start command arguments for running the vendored OpenClaw gateway.
 *
 * This ensures the gateway always runs from the pinned vendor binary,
 * never from a global install.
 */
export function getGatewayCommand(vendorDir?: string): { command: string; args: string[] } {
  assertVendorExists(vendorDir);
  const entryPath = resolveVendorEntryPath(vendorDir);
  return {
    command: "node",
    args: [entryPath, "gateway"],
  };
}
