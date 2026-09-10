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

describe("packaged runtime CI coverage", () => {
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
