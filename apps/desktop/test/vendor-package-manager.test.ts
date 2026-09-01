import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

type InstallArgs = { cacheDir: string; spec: string; version: string };

const { readVendorPnpmVersion, resolveVendorPnpmBinary } = require(
  "../scripts/vendor-package-manager.cjs",
) as {
  readVendorPnpmVersion: (vendorDir: string) => string;
  resolveVendorPnpmBinary: (
    vendorDir: string,
    options?: { repoRoot?: string; cacheRoot?: string; install?: (args: InstallArgs) => void },
  ) => string;
};

const PNPM_BIN = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function makeVendor(packageManager?: string): string {
  const vendorDir = makeTempDir("rivonclaw-vendor-package-manager-");
  writeFileSync(join(vendorDir, "package.json"), JSON.stringify({ packageManager }));
  return vendorDir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("vendor package manager", () => {
  it("uses the exact pnpm version declared by OpenClaw", () => {
    expect(readVendorPnpmVersion(makeVendor("pnpm@12.1.0"))).toBe("12.1.0");
  });

  it("strips Corepack integrity metadata", () => {
    expect(readVendorPnpmVersion(makeVendor("pnpm@12.1.0+sha512.deadbeef"))).toBe("12.1.0");
  });

  it.each([undefined, "npm@11.0.0", "pnpm@", "pnpm@12.1.0 bad"])(
    "rejects unsupported packageManager %s",
    (packageManager) => {
      expect(() => readVendorPnpmVersion(makeVendor(packageManager))).toThrow(
        /packageManager=pnpm@<version>/,
      );
    },
  );

  it("reuses an already installed pnpm without reinstalling", () => {
    const vendorDir = makeVendor("pnpm@12.1.0");
    const cacheRoot = makeTempDir("rivonclaw-vendor-pnpm-cache-");
    const binDir = join(cacheRoot, "12.1.0", "node_modules", ".bin");
    mkdirSync(binDir, { recursive: true });
    const binary = join(binDir, PNPM_BIN);
    writeFileSync(binary, "#!/bin/sh\n");
    chmodSync(binary, 0o755);

    const install = () => {
      throw new Error("install must not run when the pinned pnpm is already cached");
    };

    expect(resolveVendorPnpmBinary(vendorDir, { cacheRoot, install })).toBe(binary);
  });

  it("installs the pinned pnpm outside the vendor tree", () => {
    const vendorDir = makeVendor("pnpm@12.1.0");
    const cacheRoot = makeTempDir("rivonclaw-vendor-pnpm-cache-");
    const calls: InstallArgs[] = [];
    const install = (args: InstallArgs) => {
      calls.push(args);
      const binDir = join(args.cacheDir, "node_modules", ".bin");
      mkdirSync(binDir, { recursive: true });
      writeFileSync(join(binDir, PNPM_BIN), "#!/bin/sh\n");
    };

    const binary = resolveVendorPnpmBinary(vendorDir, { cacheRoot, install });

    const cacheDir = join(cacheRoot, "12.1.0");
    expect(calls).toEqual([{ cacheDir, spec: "pnpm@12.1.0", version: "12.1.0" }]);
    expect(binary).toBe(join(cacheDir, "node_modules", ".bin", PNPM_BIN));
    // The whole point: the vendor .npmrc cooldown must not apply to the
    // package manager the vendor itself pins.
    expect(cacheDir.startsWith(vendorDir)).toBe(false);
    // npm resolves its local prefix by walking up to the nearest package.json.
    // Without this anchor the install would land in the repo's own workspace.
    expect(existsSync(join(cacheDir, "package.json"))).toBe(true);
  });

  it("fails loudly when the install does not produce a pnpm binary", () => {
    const vendorDir = makeVendor("pnpm@12.1.0");
    const cacheRoot = makeTempDir("rivonclaw-vendor-pnpm-cache-");

    expect(() => resolveVendorPnpmBinary(vendorDir, { cacheRoot, install: () => {} })).toThrow(
      /did not produce/,
    );
  });
});
