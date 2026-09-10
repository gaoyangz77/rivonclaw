import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const { STAGED_VENDOR_SOURCE_PLUGINS } = require("../scripts/vendor-runtime-plugin-inventory.cjs");
const { VENDOR_PRUNE_INPUTS, readVendorPruneProfile } = require("../scripts/vendor-runtime-cache.cjs");
const { assertBundledPluginEntries } = require("../scripts/vendor-plugin-dependencies.cjs");
const script = path.resolve(import.meta.dirname, "../scripts/stage-official-vendor-plugins.cjs");
let root: string;
const write = (file: string, value: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
};
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "vendor-runtime-staging-")); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

function fixture() {
  write(path.join(root, "package.json"), JSON.stringify({ name: "openclaw", version: "2026.9.3" }));
  write(path.join(root, "dist/plugin-sdk/index.js"), "export const sdk = true;");
  for (const { id, packageName } of STAGED_VENDOR_SOURCE_PLUGINS) {
    const dir = path.join(root, "dist/extensions", id);
    write(path.join(dir, "package.json"), JSON.stringify({ name: packageName, version: "2026.9.3", openclaw: { extensions: ["./index.js"] } }));
    write(path.join(dir, "openclaw.plugin.json"), JSON.stringify({ id }));
    write(path.join(dir, "index.js"), "export { patched } from './local-chunk.mjs';");
    write(path.join(dir, "local-chunk.mjs"), "export const patched = true;");
    write(path.join(dir, "assets/icon.png"), "test asset");
    write(path.join(root, "extensions", id, "index.ts"), "throw new Error('source must not be staged');");
  }
}
function stage() {
  return spawnSync(process.execPath, [script], { encoding: "utf8", env: { ...process.env, VENDOR_DIR_OVERRIDE: root } });
}

describe("built external plugin staging", () => {
  it("stages local built entries, mjs chunks and assets and is repeatable after source removal", () => {
    fixture();
    fs.rmSync(path.join(root, "extensions"), { recursive: true });
    for (let pass = 0; pass < 2; pass++) {
      const result = stage();
      expect(result.status, result.stderr).toBe(0);
      for (const { id } of STAGED_VENDOR_SOURCE_PLUGINS) {
        const dir = path.join(root, "dist-runtime/extensions", id);
        expect(JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).openclaw.extensions).toEqual(["./index.js"]);
        expect(fs.readFileSync(path.join(dir, "local-chunk.mjs"), "utf8")).toContain("patched = true");
        expect(fs.readFileSync(path.join(dir, "assets/icon.png"), "utf8")).toBe("test asset");
        expect(fs.existsSync(path.join(dir, "index.ts"))).toBe(false);
      }
    }
  });

  it.each(["./index.ts", "../outside.js", "./missing.js"])("rejects invalid built entry %s", (entry) => {
    fixture();
    const file = path.join(root, "dist/extensions/groq/package.json");
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    manifest.openclaw.extensions = [entry];
    write(file, JSON.stringify(manifest));
    const result = stage();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("invalid or missing built entry");
  });

  it("does not fall back to pristine/source plugins when local build output is absent", () => {
    fixture();
    fs.rmSync(path.join(root, "dist/extensions/groq"), { recursive: true });
    const result = stage();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Built vendor plugin is missing");
  });
});

describe("vendor prune cache inputs", () => {
  it.each(VENDOR_PRUNE_INPUTS as string[])("invalidates the profile after changing only %s", (changed) => {
    for (const name of VENDOR_PRUNE_INPUTS) write(path.join(root, name), `// ${name}\n`);
    const before = readVendorPruneProfile(root);
    expect(readVendorPruneProfile(root)).toBe(before);
    fs.appendFileSync(path.join(root, changed), "// changed\n");
    expect(readVendorPruneProfile(root)).not.toBe(before);
  });

  it("shares helper inputs between pruning and archive versioning", () => {
    expect(VENDOR_PRUNE_INPUTS).toContain("vendor-package-manager.cjs");
    const prune = fs.readFileSync(new URL("../scripts/prune-vendor-deps.cjs", import.meta.url), "utf8");
    const archive = fs.readFileSync(new URL("../scripts/archive-vendor-runtime.cjs", import.meta.url), "utf8");
    expect(prune).toContain("const PRUNE_PROFILE_VERSION = readVendorPruneProfile();");
    expect(archive).toContain("...VENDOR_PRUNE_INPUTS,");
    expect(prune).toContain('plugin.id, "index.js"');
    const contract = fs.readFileSync(new URL("../scripts/verify-vendor-runtime-contract.cjs", import.meta.url), "utf8");
    expect(contract).toContain("dist-runtime/extensions/${plugin.id}/index.js");
  });
});

describe("Windows SQLite native runtime pruning", () => {
  it.each(["win32", "darwin", "linux"])("retains Koffi only for Windows (%s)", (platform) => {
    const source = fs.readFileSync(new URL("../scripts/prune-vendor-deps.cjs", import.meta.url), "utf8");
    const blacklist = source.slice(source.indexOf("const EXTRA_REMOVE ="), source.indexOf("const STRIP_FILES ="));
    const removed = runInNewContext(`${blacklist}\nEXTRA_REMOVE`, { process: { platform } });
    expect(removed.includes("koffi")).toBe(platform !== "win32");
  });

  it.each(["win32", "darwin", "linux"])("keeps only the required Koffi native target (%s)", (platform) => {
    const source = fs.readFileSync(new URL("../scripts/prune-vendor-deps.cjs", import.meta.url), "utf8");
    const target = source.slice(source.indexOf("const koffiTargetPackage ="), source.indexOf("const needsCrossArchMacDependencies ="));
    const start = source.indexOf('for (const pkgDir of packageDirsForPrefix("@koromix/koffi-"))');
    const prune = source.slice(start, source.indexOf("removeDisabledVendorExtensions();", start));
    const packages = ["@koromix/koffi-win32-x64", "@koromix/koffi-win32-arm64", "@koromix/koffi-darwin-arm64", "@koromix/koffi-linux-x64"];
    const retained = new Set(packages);
    runInNewContext(`${target}\n${prune}`, {
      process: { platform, arch: "x64" },
      packageDirsForPrefix: () => packages, packageLabel: (name: string) => name,
      removePackageDir: (name: string) => retained.delete(name),
    });
    expect([...retained]).toEqual(platform === "win32" ? ["@koromix/koffi-win32-x64"] : []);
  });
});

describe("vendor prune cache-hit acceptance", () => {
  function cachedFixture() {
    write(path.join(root, "dist/.pruned"), "profile=fixture-profile\n");
    write(path.join(root, ".gitignore"), "dist\ndist-runtime\nnode_modules/\n");
    for (const base of ["dist", "dist-runtime"]) {
      write(path.join(root, base, "extensions/msteams/package.json"), JSON.stringify({ openclaw: { extensions: ["./index.cjs"], setupEntry: "./setup-entry.cjs" } }));
      write(path.join(root, base, "extensions/msteams/index.cjs"), "module.exports = {};");
      write(path.join(root, base, "extensions/msteams/setup-entry.cjs"), "module.exports = {};");
    }
  }
  function runCacheBranch() {
    const source = fs.readFileSync(new URL("../scripts/prune-vendor-deps.cjs", import.meta.url), "utf8");
    const visibility = source.slice(source.indexOf("function makeDistVisibleToElectronBuilder()"), source.indexOf("function copyExtensionManifestsIntoDist()"));
    const cache = source.slice(source.indexOf("const prunedMarkerPath ="), source.indexOf("const sizeBefore ="));
    return runInNewContext(`${visibility}\n${cache}`, {
      fs, path, vendorDir: root, nmDir: path.join(root, "node_modules"), PRUNE_PROFILE_VERSION: "fixture-profile",
      hasCompletedProductionInstall: () => true, hasBlacklistedPackage: () => false,
      hasOtherSqliteVecPlatforms: () => false, disabledVendorExtensionDirs: () => [],
      hasRequiredOfficialVendorPlugins: () => true, hasMaterializedWorkspaceDependencies: () => true,
      assertSelectedPluginDependencies: () => {}, assertBundledPluginEntries,
      console: { log: () => {} }, process: { exit: (code: number) => { throw new Error(`cache-exit:${code}`); } },
    });
  }
  it("restores dist visibility after pristine checkout without re-pruning or changing the marker", () => {
    cachedFixture();
    const marker = fs.readFileSync(path.join(root, "dist/.pruned"), "utf8");
    expect(() => runCacheBranch()).toThrow("cache-exit:0");
    expect(fs.readFileSync(path.join(root, ".gitignore"), "utf8")).toBe("node_modules/\n");
    expect(fs.readFileSync(path.join(root, "dist/.pruned"), "utf8")).toBe(marker);
  });
  it("rejects a current-profile cache with an unselected plugin's missing CJS entry", () => {
    cachedFixture();
    fs.unlinkSync(path.join(root, "dist-runtime/extensions/msteams/setup-entry.cjs"));
    expect(() => runCacheBranch()).toThrow("Missing retained plugin entry");
    expect(fs.readFileSync(path.join(root, ".gitignore"), "utf8")).toContain("dist-runtime");
  });
});

describe("development runtime plugin boundaries", () => {
  it("materializes CJS/MJS entrypoints and local chunks idempotently without touching source", () => {
    const source = path.join(root, "dist/extensions/msteams");
    const target = path.join(root, "dist-runtime/extensions/msteams");
    const manifest = JSON.stringify({ openclaw: { extensions: ["./index.cjs"], setupEntry: "./setup-entry.cjs" } });
    write(path.join(source, "package.json"), manifest);
    write(path.join(target, "package.json"), manifest);
    const files = ["index.cjs", "setup-entry.cjs", "chunk.mjs"];
    for (const file of files) {
      write(path.join(source, file), "// original built content\n");
      fs.symlinkSync(path.relative(target, path.join(source, file)), path.join(target, file));
    }
    expect(() => assertBundledPluginEntries(root)).toThrow();
    const helper = path.resolve(import.meta.dirname, "../scripts/vendor-plugin-dependencies.cjs");
    for (let pass = 0; pass < 2; pass++) {
      const result = spawnSync(process.execPath, [helper, root], { encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
      for (const file of files) {
        expect(fs.lstatSync(path.join(target, file)).isSymbolicLink()).toBe(false);
        expect(fs.readFileSync(path.join(target, file), "utf8")).toBe("// original built content\n");
        expect(fs.readFileSync(path.join(source, file), "utf8")).toBe("// original built content\n");
      }
    }
  });

  it("rejects links to unexpected files instead of disabling the package boundary check", () => {
    const source = path.join(root, "dist/extensions/msteams/index.cjs");
    const target = path.join(root, "dist-runtime/extensions/msteams/index.cjs");
    write(source, "// trusted entry");
    write(path.join(root, "unexpected.cjs"), "// unexpected entry");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.symlinkSync(path.relative(path.dirname(target), path.join(root, "unexpected.cjs")), target);
    const helper = path.resolve(import.meta.dirname, "../scripts/vendor-plugin-dependencies.cjs");
    const result = spawnSync(process.execPath, [helper, root], { encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Unexpected runtime module link");
    expect(fs.lstatSync(target).isSymbolicLink()).toBe(true);
  });

  it("runs boundary preparation after vendor build/cache restore and before Desktop dev starts", () => {
    for (const file of ["scripts/setup-vendor.sh", "scripts/provision-vendor-patched.sh"]) {
      const source = fs.readFileSync(path.resolve(import.meta.dirname, "../../..", file), "utf8");
      expect(source.indexOf("vendor-plugin-dependencies.cjs")).toBeGreaterThan(source.indexOf("vendor_pnpm run build"));
    }
    const config = fs.readFileSync(new URL("../tsdown.config.ts", import.meta.url), "utf8");
    expect(config).toContain("materializeRuntimeModuleLinks(vendorDir)");
    expect(config).toContain("assertBundledPluginEntries(vendorDir)");
  });
});
