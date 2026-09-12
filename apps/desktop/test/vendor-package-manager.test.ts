import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

type InstallArgs = { cacheDir: string; spec: string; version: string };

type ModulesState = {
  nodeLinker?: string;
  included?: { dependencies?: boolean; devDependencies?: boolean; optionalDependencies?: boolean };
};

const {
  readVendorPnpmVersion,
  resolveVendorPnpmEntry,
  VENDOR_PRODUCTION_INSTALL_ARGS,
  isCompletedVendorProductionInstall,
} = require(
  "../scripts/vendor-package-manager.cjs",
) as {
  readVendorPnpmVersion: (vendorDir: string) => string;
  resolveVendorPnpmEntry: (
    vendorDir: string,
    options?: { repoRoot?: string; cacheRoot?: string; install?: (args: InstallArgs) => void },
  ) => string;
  VENDOR_PRODUCTION_INSTALL_ARGS: readonly string[];
  isCompletedVendorProductionInstall: (state: ModulesState | null | undefined) => boolean;
};

const PNPM_ENTRY = join("node_modules", "pnpm", "bin", "pnpm.mjs");

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
  it.each([
    ["setup-vendor.sh", 3],
    ["provision-vendor-patched.sh", 2],
  ] as const)("keeps every %s install on the same explicit packaging boundary", (script, expectedCount) => {
    const source = readFileSync(new URL(`../../../scripts/${script}`, import.meta.url), "utf8");
    const commands = source.split("\n").filter((line) => /^\s*vendor_pnpm install\b/.test(line));
    expect(commands).toHaveLength(expectedCount);
    for (const command of commands) {
      expect(command).toContain("--node-linker=hoisted");
      expect(command).toContain("--optional");
      expect(command).toContain("--frozen-lockfile");
    }
    expect(source).not.toMatch(/^\s*export npm_config_node_linker=/m);
  });

  it("explicitly requests a hoisted production install with native optional packages", () => {
    const args = [...VENDOR_PRODUCTION_INSTALL_ARGS];
    expect(args.slice(args.indexOf("install"))).toEqual([
      "install", "--prod", "--node-linker=hoisted", "--optional", "--frozen-lockfile", "--ignore-scripts",
    ]);
    expect(args).not.toContain("--force");
    expect(args).not.toContain("--trust-lockfile");
  });

  it("accepts only a completed flat production layout", () => {
    expect(isCompletedVendorProductionInstall({
      nodeLinker: "hoisted",
      included: { dependencies: true, devDependencies: false, optionalDependencies: true },
    })).toBe(true);
  });

  it.each<ModulesState | null | undefined>([
    undefined,
    null,
    {},
    { nodeLinker: "hoisted" },
    { nodeLinker: "isolated", included: { dependencies: true, devDependencies: false, optionalDependencies: true } },
    { nodeLinker: "hoisted", included: { dependencies: true, devDependencies: true, optionalDependencies: true } },
    { nodeLinker: "hoisted", included: { dependencies: false, devDependencies: false, optionalDependencies: true } },
    { nodeLinker: "hoisted", included: { dependencies: true, devDependencies: false, optionalDependencies: false } },
  ])("rejects incomplete or non-packageable install state %j", (state) => {
    expect(isCompletedVendorProductionInstall(state)).toBe(false);
  });

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

  it("accepts prerelease pins", () => {
    expect(readVendorPnpmVersion(makeVendor("pnpm@12.2.0-beta.1"))).toBe("12.2.0-beta.1");
  });

  it("reuses an already installed pnpm without reinstalling", () => {
    const vendorDir = makeVendor("pnpm@12.1.0");
    const cacheRoot = makeTempDir("rivonclaw-vendor-pnpm-cache-");
    const entry = join(cacheRoot, "12.1.0", PNPM_ENTRY);
    mkdirSync(dirname(entry), { recursive: true });
    writeFileSync(entry, "// pnpm\n");

    const install = () => {
      throw new Error("install must not run when the pinned pnpm is already cached");
    };

    expect(resolveVendorPnpmEntry(vendorDir, { cacheRoot, install })).toBe(entry);
  });

  it("installs the pinned pnpm outside the vendor tree", () => {
    const vendorDir = makeVendor("pnpm@12.1.0");
    const cacheRoot = makeTempDir("rivonclaw-vendor-pnpm-cache-");
    const calls: InstallArgs[] = [];
    const install = (args: InstallArgs) => {
      calls.push(args);
      const entry = join(args.cacheDir, PNPM_ENTRY);
      mkdirSync(dirname(entry), { recursive: true });
      writeFileSync(entry, "// pnpm\n");
    };

    const entry = resolveVendorPnpmEntry(vendorDir, { cacheRoot, install });

    const cacheDir = join(cacheRoot, "12.1.0");
    expect(calls).toEqual([{ cacheDir, spec: "pnpm@12.1.0", version: "12.1.0" }]);
    // The JS entry, never a platform .bin shim: Windows cannot spawn .cmd
    // without a shell, and Git Bash cannot exec it at all.
    expect(entry).toBe(join(cacheDir, PNPM_ENTRY));
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

    expect(() => resolveVendorPnpmEntry(vendorDir, { cacheRoot, install: () => {} })).toThrow(
      /did not produce a pnpm CLI entry/,
    );
  });
});
