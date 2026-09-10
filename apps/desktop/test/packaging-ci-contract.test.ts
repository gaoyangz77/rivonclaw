import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const builder = createRequire(require.resolve("electron-builder"));
const yaml = createRequire(builder.resolve("app-builder-lib"))("yaml");
const { VENDOR_PRUNE_INPUTS } = require("../scripts/vendor-runtime-cache.cjs");
const repo = path.resolve(import.meta.dirname, "../../..");
const workflow = (name: string) => yaml.parse(fs.readFileSync(path.join(repo, ".github/workflows", name), "utf8"));

describe("SQLite installer pruning", () => {
  it.each([
    ["electron-builder.yml", "mac", "darwin", "arm64"],
    ["electron-builder.yml", "mac", "darwin", "x64"],
    ["electron-builder.win.yml", "win", "win32", "x64"],
    ["electron-builder.win.unsigned.yml", "win", "win32", "x64"],
    ["electron-builder.linux.yml", "linux", "linux", "x64"],
  ])("%s keeps only the %s target N-API prebuild (%s/%s)", (file, platform, os, arch) => {
    const read = (name: string) => yaml.parse(fs.readFileSync(path.join(repo, "apps/desktop", name), "utf8"));
    const config = read("electron-builder.yml");
    const { getNodeModuleFileMatcher } = builder("app-builder-lib/out/fileMatcher.js");
    const matcher = getNodeModuleFileMatcher(repo, path.join(repo, "unused"),
      (value: string) => value.replaceAll("${arch}", arch), read(file)[platform],
      { config, debugLogger: { isEnabled: false } });
    const filter = matcher.createFilter();
    const includes = (relative: string) => filter(path.join(repo, "node_modules/better-sqlite3", relative),
      { isDirectory: () => false });
    for (const target of ["darwin-arm64", "darwin-x64", "win32-x64", "win32-arm64", "linux-x64", "linux-arm64", "linuxmusl-x64"]) {
      expect(includes(`prebuilds/${target}.node`)).toBe(target === `${os}-${arch}`);
    }
    for (const file of ["deps/sqlite3/sqlite3.c", "src/better_sqlite3.cpp"]) expect(includes(file)).toBe(false);
    for (const file of ["lib/binding.js", "lib/database.js", "package.json", "LICENSE"]) expect(includes(file)).toBe(true);
  });
});

describe("packaged runtime CI coverage", () => {
  it.each(["build-macos-arm64", "build-macos-x64"])("%s keeps its temporary signing keychain unlocked for the bounded build", (id) => {
    const steps = workflow("build.yml").jobs[id].steps;
    const setup = steps.find((step: any) => step.name === "Import Code Signing Certificate");
    expect(setup.run).toContain('security set-keychain-settings -lut 21600 "$MACOS_KEYCHAIN_PATH"');
    const build = steps.find((step: any) => step.env?.CODESIGN_TIMEOUT_SECONDS);
    expect(build.env.CODESIGN_TIMEOUT_SECONDS).toBe("300");
    expect(build.env.DEBUG).toContain("electron-osx-sign*");
  });

  it("runs the Intel runtime natively and never restores ARM dependency caches", () => {
    const job = workflow("build.yml").jobs["build-macos-x64"];
    expect(job["runs-on"]).toBe("macos-15-intel");
    for (const id of ["cache-vendor-nm", "cache-pixel-nm"]) {
      const cache = job.steps.find((step: any) => step.id === id);
      expect(cache.with.key).toContain("${{ runner.arch }}");
      expect(cache.with["restore-keys"]).toContain("${{ runner.arch }}");
    }
  });

  it("signs merchant native modules rather than excluding their directory", () => {
    const config = yaml.parse(fs.readFileSync(path.join(repo, "apps/desktop/electron-builder.yml"), "utf8"));
    const native = "TK Copilot.app/Contents/Resources/extensions-merchant/rivonclaw-cloud-tools/node_modules/@napi-rs/canvas-darwin-arm64/skia.darwin-arm64.node";
    for (const pattern of config.mac.signIgnore ?? []) expect(new RegExp(pattern).test(native)).toBe(false);
  });

  it("installs x64 optional dependencies in the product workspace before cross-packaging", () => {
    const steps = workflow("build.yml").jobs["build-macos-x64"].steps;
    const install = steps.find((step: any) => step.name === "Install dependencies");
    expect(install.run).toContain("withPnpmTargetArchitecture");
    expect(install.run).toContain("workspacePath: path.resolve('pnpm-workspace.yaml')");
    expect(install.run).toContain("targetArch: 'x64'");
    expect(install.run).toContain("--frozen-lockfile");
  });

  it.each([["build.yml", 4], ["test-build.yml", 1]])("%s checks the actual executable and external Resources", (name, count) => {
    const steps = Object.values(workflow(name as string).jobs).flatMap((job: any) => job.steps);
    const runs = steps.flatMap((step: any) => typeof step.run === "string" ? step.run.split("\n") : [])
      .filter((line: string) => line.includes("node apps/desktop/scripts/verify-vendor-runtime-contract.cjs"));
    expect(runs).toHaveLength(count as number);
    for (const line of runs) {
      expect(line).toContain("--runtime ");
      expect(line).toContain("--resources ");
    }
  });

  it("invalidates every production vendor cache for helper-only changes", () => {
    const steps = Object.values(workflow("build.yml").jobs).flatMap((job: any) => job.steps);
    const caches = steps.filter((step: any) => step.id === "cache-vendor-prod");
    expect(caches).toHaveLength(4);
    for (const cache of caches) for (const input of VENDOR_PRUNE_INPUTS) expect(cache.with.key).toContain(`apps/desktop/scripts/${input}`);
  });

  it("keeps the Linux allocated-size cap at 1000 MiB", () => {
    const steps = Object.values(workflow("build.yml").jobs).flatMap((job: any) => job.steps);
    const guard = steps.find((step: any) => step.run?.includes("Linux vendor payload is too large"));
    expect(guard.run).toContain('du -sm "$VENDOR"');
    expect(guard.run).toContain('test "$SIZE_MB" -le 1000');
  });
});
